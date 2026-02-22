# 🗄️ Backend & Data Storage Recommendation

## 🎯 Recommended Solution: **Supabase**

### Why Supabase for Eventory?

**Perfect fit for hackathon needs:**
- ✅ **Free tier** - 500MB database, 1GB file storage, 2GB bandwidth/month
- ✅ **Knowledge graph support** - PostgreSQL with recursive CTEs + JSONB for relationships
- ✅ **AI agent ready** - pgvector extension for embeddings & semantic search
- ✅ **Document uploads** - Built-in file storage with CDN
- ✅ **Real-time** - Live subscriptions for dashboard updates
- ✅ **Quick setup** - Managed service, minimal config
- ✅ **TypeScript SDK** - Great Electron integration

---

## 📊 Comparison Matrix

| Feature | Supabase | Neo4j Aura | LlamaIndex KG | PocketBase |
|---------|----------|------------|---------------|------------|
| **Free Tier** | ✅ 500MB DB + 1GB storage | ✅ 50K nodes | ✅ Local only | ✅ Embedded |
| **Graph Support** | ✅ PostgreSQL + CTEs | ✅✅ Native graph | ✅ LLM-native | ❌ No |
| **Vector Search** | ✅ pgvector | ❌ No | ✅ Built-in | ❌ No |
| **File Storage** | ✅ Built-in | ❌ No | ❌ No | ✅ Built-in |
| **Real-time** | ✅ Subscriptions | ✅ Streams | ❌ No | ✅ Real-time |
| **Setup Time** | ⚡ 15 min | ⚡ 20 min | ⚡ 30 min | ⚡ 10 min |
| **AI Integration** | ✅✅ Excellent | ⚠️ Good | ✅✅ Excellent | ⚠️ Basic |

---

## 🏗️ Supabase Architecture for Eventory

### Database Schema (PostgreSQL)

```sql
-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_type TEXT DEFAULT 'personal', -- 'personal' or 'organization'
  name TEXT NOT NULL,
  event_type TEXT, -- 'tech-week', 'community', etc.
  goals JSONB, -- { attendance_target: 200, revenue: 5000, other: "..." }
  status TEXT DEFAULT 'planning', -- 'planning', 'on-track', 'at-risk', 'complete'
  event_date DATE,
  start_time TIME,
  end_time TIME,
  venue_pref TEXT,
  venue_location JSONB, -- { address, latitude, longitude, map_url }
  guest_count INTEGER,
  food_drinks TEXT,
  budget DECIMAL,
  notes TEXT,
  linked_event_ids UUID[], -- Array of related event IDs
  retro_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People (team members, vendors, speakers, sponsors)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  role TEXT, -- 'vendor', 'speaker', 'team-member', 'sponsor'
  metadata JSONB, -- performance history, ratings, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collaborators (for organization accounts)
CREATE TABLE collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL, -- References user_id for organization account
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  assigned_to UUID, -- Can reference people(id) or be 'ai-agent' or collaborator ID
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- 'todo', 'in-progress', 'done', 'blocked'
  priority INTEGER DEFAULT 0, -- 0 = low, 1 = medium, 2 = high
  due_date TIMESTAMPTZ,
  dependencies UUID[], -- Array of task IDs this task depends on
  blockers UUID[], -- Array of task IDs blocking this task
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Graph Relationships (using edge table pattern)
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'event', 'person', 'task'
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  relationship_type TEXT NOT NULL, -- 'organizes', 'depends_on', 'worked_with', etc.
  metadata JSONB, -- strength, context, timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id, relationship_type)
);

-- Communication threads (email, Discord, WhatsApp)
CREATE TABLE comms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'email', 'discord', 'whatsapp'
  thread_id TEXT, -- External thread ID
  participants UUID[], -- Array of people IDs
  summary TEXT, -- AI-generated summary
  key_decisions JSONB, -- Extracted decisions
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Retro insights
CREATE TABLE retros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  insights JSONB, -- { what_went_well: [...], blockers: [...] }
  learnings TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document uploads (metadata only - files stored in Supabase Storage)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'file' or 'link'
  storage_path TEXT, -- Path in Supabase Storage (for files)
  url TEXT, -- URL for links
  name TEXT NOT NULL,
  category TEXT, -- 'vendor', 'budget', 'other'
  mime_type TEXT,
  size_bytes INTEGER,
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_tasks_event_id ON tasks(event_id);
CREATE INDEX idx_relationships_source ON relationships(source_type, source_id);
CREATE INDEX idx_relationships_target ON relationships(target_type, target_id);
CREATE INDEX idx_comms_event_id ON comms(event_id);
CREATE INDEX idx_comms_embedding ON comms USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
```

### Graph Queries (Recursive CTEs)

```sql
-- Find all tasks that depend on a given task (transitive dependencies)
WITH RECURSIVE task_deps AS (
  SELECT id, title, dependencies, 0 as depth
  FROM tasks
  WHERE id = $1
  UNION ALL
  SELECT t.id, t.title, t.dependencies, td.depth + 1
  FROM tasks t
  JOIN task_deps td ON t.id = ANY(td.dependencies)
)
SELECT * FROM task_deps;

-- Find all people connected to an event (through tasks, comms, etc.)
SELECT DISTINCT p.*
FROM people p
WHERE p.id IN (
  SELECT unnest(participants) FROM comms WHERE event_id = $1
  UNION
  SELECT assigned_to FROM tasks WHERE event_id = $1
);

-- Find similar events using vector similarity
SELECT e.*, 1 - (e.embedding <=> $1) as similarity
FROM events e
WHERE 1 - (e.embedding <=> $1) > 0.7
ORDER BY similarity DESC
LIMIT 5;
```

---

## 🚀 Quick Setup Guide

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up (free tier)
3. Create new project
4. Wait ~2 minutes for provisioning

### 2. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 3. Environment Variables

Add to `.env`:
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Initialize Client

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 5. Enable pgvector Extension

In Supabase SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6. Run Schema Migration

Copy the schema above into Supabase SQL Editor and execute.

---

## 🔄 Integration with AI Agents

### Vector Embeddings

```typescript
import { supabase } from './lib/supabase'

// Generate embedding using OpenAI/Perplexity API
const embedding = await generateEmbedding(text)

// Store with document
await supabase
  .from('comms')
  .insert({
    event_id: eventId,
    channel: 'discord',
    summary: text,
    embedding: embedding
  })

// Semantic search
const { data } = await supabase.rpc('match_comms', {
  query_embedding: embedding,
  match_threshold: 0.7,
  match_count: 5
})
```

### Knowledge Graph Queries

```typescript
// Find all vendors used in past events
const { data } = await supabase
  .from('relationships')
  .select(`
    target_id,
    people!relationships_target_id_fkey(*)
  `)
  .eq('source_type', 'event')
  .eq('relationship_type', 'used_vendor')
  .in('source_id', pastEventIds)
```

---

## 📁 File Storage Setup

### Upload Documents

```typescript
// Upload file
const file = event.target.files[0]
const { data, error } = await supabase.storage
  .from('documents')
  .upload(`${eventId}/${file.name}`, file)

// Store metadata
await supabase
  .from('documents')
  .insert({
    event_id: eventId,
    storage_path: data.path,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size
  })
```

### Create Storage Bucket

In Supabase Dashboard:
1. Go to Storage
2. Create bucket: `documents`
3. Set public: `false` (use RLS policies)

---

## 🔐 Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms ENABLE ROW LEVEL SECURITY;

-- Users can only see their own events
CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## 🎯 Alternative: Neo4j Aura Free (If you need native graph)

**When to use:** If you need complex graph traversals and Cypher queries.

**Setup:**
1. Sign up at [neo4j.com/cloud/aura](https://neo4j.com/cloud/aura)
2. Create free database
3. Install: `npm install neo4j-driver`

**Example:**
```typescript
import neo4j from 'neo4j-driver'

const driver = neo4j.driver(
  'neo4j+s://xxx.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'password')
)

const session = driver.session()
const result = await session.run(
  'MATCH (e:Event)-[:HAS_TASK]->(t:Task)-[:DEPENDS_ON]->(d:Task) RETURN e, t, d'
)
```

**Trade-offs:**
- ✅ Native graph queries
- ❌ No built-in file storage (need separate solution)
- ❌ No vector search (need separate vector DB)
- ⚠️ More complex setup

---

## 🎯 Alternative: LlamaIndex Knowledge Graph (Local)

**When to use:** If you want offline-first, LLM-native queries, and don't need multi-user.

**Setup:**
```bash
npm install llamaindex
```

**Example:**
```typescript
import { SimpleGraphStore } from 'llamaindex'

const graphStore = new SimpleGraphStore()
await graphStore.addTriplets([
  ['Event1', 'has_task', 'Task1'],
  ['Task1', 'depends_on', 'Task2']
])

// Natural language query
const result = await graphStore.query(
  'What tasks depend on Task2?'
)
```

**Trade-offs:**
- ✅ LLM-native, natural language queries
- ✅ Works offline
- ❌ No built-in file storage
- ❌ Not ideal for multi-user
- ⚠️ Requires local storage management

---

## ✅ Final Recommendation

**Use Supabase** because:
1. ✅ Covers all requirements (graph, AI, files, real-time)
2. ✅ Free tier sufficient for hackathon demo
3. ✅ Fastest setup time
4. ✅ Best TypeScript/Electron integration
5. ✅ Can migrate to Neo4j later if needed

**Migration path:** Start with Supabase → If you need more complex graph queries later, migrate graph layer to Neo4j while keeping Supabase for files/auth.

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [pgvector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [PostgreSQL Graph Queries](https://www.postgresql.org/docs/current/queries-with.html)
