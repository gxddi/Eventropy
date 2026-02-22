-- Eventory app schema — matches src/types.ts (PlannerEvent, EventFormData, Task, ChatMessage, etc.)
-- Run in Supabase SQL Editor or via Supabase CLI.

-- Optional: enable pgvector for future embeddings
-- CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- EVENTS (PlannerEvent → events table; form fields flattened)
-- =============================================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Optional for RLS later; leave NULL for demo
  user_id UUID,
  -- App-facing slug e.g. evt-past-001 (optional; can use id as evtId)
  evt_slug TEXT UNIQUE,
  -- EventFormData fields
  name TEXT NOT NULL,                    -- formData.eventReason
  event_date DATE,                       -- formData.eventDate
  start_time TEXT,                       -- formData.startTime e.g. "19:00"
  end_time TEXT,                         -- formData.endTime
  venue_pref TEXT,                       -- formData.venuePref
  venue_location JSONB,                  -- formData.venueLocation { address, latitude, longitude, mapUrl }
  guest_count TEXT,                      -- formData.guestCount (keep as text for "35" etc.)
  food_drinks TEXT,                      -- formData.foodDrinks enum
  goals JSONB,                           -- formData.goals { attendanceTarget, revenue, ... }
  budget NUMERIC,                        -- formData.budget
  notes TEXT,                            -- formData.notes
  linked_event_ids UUID[],               -- formData.linkedEventIds → references events(id)
  -- PlannerEvent fields
  status TEXT NOT NULL DEFAULT 'planning', -- EventStatus: planning | on-track | at-risk | complete
  account_type TEXT DEFAULT 'personal',  -- AccountType: personal | organization
  retro_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

-- =============================================================================
-- CHAT MESSAGES (ChatMessage → chat_timeline per event)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,                -- AgentId: guest-list | invitations | catering | venue | entertainment | logistics
  role TEXT NOT NULL,                    -- MessageRole: agent | user | system
  content TEXT NOT NULL,
  message_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_event_id ON chat_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_at ON chat_messages(message_at);

-- =============================================================================
-- TASKS (Task)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',   -- TaskStatus: todo | in-progress | done | blocked
  priority INTEGER NOT NULL DEFAULT 0,   -- 0 low, 1 medium, 2 high
  due_date TIMESTAMPTZ,
  assigned_to TEXT,                     -- collaborator id or 'ai-agent'
  dependencies UUID[],                  -- task ids this task depends on
  blockers UUID[],                       -- task ids blocking this task
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- =============================================================================
-- SUBTASKS (Subtask under Task)
-- =============================================================================
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

-- =============================================================================
-- DOCUMENTS (Document — file or link per event)
-- =============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- 'file' | 'link'
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT,                         -- 'vendor' | 'budget' | 'other'
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_event_id ON documents(event_id);

-- =============================================================================
-- COLLABORATORS (Collaborator — per event for organization)
-- =============================================================================
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_event_id ON collaborators(event_id);

-- =============================================================================
-- TRIGGER: updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
