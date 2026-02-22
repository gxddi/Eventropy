# Eventropy

A desktop app for event planning that uses AI agents to handle logistics — drafting communications, tracking tasks, managing registrations, and coordinating across tools like Gmail, Google Calendar, Notion, and Luma.

Built with Electron, React, and Claude (Anthropic).

---

## The Problem

Event planning is mostly coordination work. You're juggling vendor emails, guest lists, venue logistics, catering, timelines, and budgets across a dozen different tools. Most of this isn't creative — it's repetitive, time-sensitive, and easy to drop.

Existing tools either handle one piece (Eventbrite does ticketing, Notion does docs, Gmail does email) or try to do everything but add no intelligence (Cvent, Monday.com). Nobody ties these together with agents that can actually take action on your behalf.

Eventropy assigns AI agents to different categories of event work — guests, venue and catering, entertainment and logistics, general coordination — and lets them read your tasks, draft documents, update statuses, and interact with external services. You stay in the loop and approve what gets sent.

---

## Features

**Event management**
- Create events with date, venue, guest count, budget, and goals
- Link related past events for context
- Track status across planning stages (planning, on-track, at-risk, complete)

**AI task generation**
- On event creation, Claude generates an initial task breakdown
- Tasks are assigned to one of four agent categories: Guests, Venue & Catering, Entertainment & Logistics, General
- Tasks have priority levels, due dates, dependencies, and blockers

**Agent chat with tool use**
- Chat with category-specific agents that have context on their assigned tasks
- Agents can read and write task documents (collaborative markdown), update task statuses, and modify event details
- Tool-use loop runs up to 10 rounds per response — agents reason, call tools, and respond with results
- Human-in-the-loop by default

**Task management**
- Statuses: todo, in-progress, done, blocked
- Subtask support
- Per-task markdown documents for notes, drafts, and plans
- Dependency tracking between tasks

**Connector framework**
- Gmail and Google Calendar via OAuth2
- Notion and Luma via API key
- Credentials encrypted using Electron's safeStorage (OS keychain)
- Agents can use connector tools during chat (send emails, create calendar events, pull registration data, update Notion pages)

**Views**
- Dashboard: event gallery with status indicators
- Calendar: deadlines and milestones
- Timeline: chronological message history across agents
- Event detail: task list + agent chat side-by-side
- Settings: connector configuration and credential management

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Electron |
| Frontend | React 19, TypeScript, Vite, React Router |
| AI | Anthropic SDK (Claude), OpenAI (subtask generation) |
| Database | Supabase (PostgreSQL) |
| Styling | Custom CSS |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js
- A Supabase project (with migrations applied from `supabase/migrations/`)
- Anthropic API key

### Setup

```bash
git clone https://github.com/gxddi/Eventropy
cd Eventropy
npm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=your-key
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

Run the Supabase migrations (`001_app_schema.sql`, `002_orchestrator_schema.sql`, `003_task_body.sql`) against your database.

### Development

```bash
npm run dev
```

This starts Vite on port 5173 and launches the Electron app once the dev server is ready.

### Build

```bash
npm run build
```

---

## Architecture

Three layers:

1. **React frontend** (`src/`) — UI, routing, state. Communicates with the main process over IPC.
2. **Electron main process** (`electron/main.cjs`) — IPC handlers, Supabase client, credential storage, window management.
3. **AI orchestration** (`electron/orchestrator/`) — Claude API wrapper, tool registry, execution loop. Agents cycle through IDLE, EXECUTING, WAITING_FOR_USER, and COMPLETED states.

Data flows from user actions in React, through a typed IPC bridge, to the main process, which calls Claude, routes tool calls to connectors, persists results in Supabase, and streams responses back to the renderer.

---

## Current Limitations

- AI features only work inside Electron (not in a standalone browser)
- No knowledge graph yet — the app doesn't learn across events
- Discord and WhatsApp integrations are not implemented
- No Perplexity integration for web search
- No retrospective or post-event analysis feature
- No test suite
- Single-user only — no multi-user collaboration or org accounts beyond the schema

---

## Next Steps

- **Knowledge graph**: Implement cross-event memory so the system can reference past vendor performance, timelines, and recurring issues. Architecture TBD (Neo4j, LlamaIndex, or a lighter custom store).
- **Discord and WhatsApp connectors**: Route attendee questions and community messages through the agent layer.
- **Perplexity integration**: Let agents search the web for grants, sponsors, and venue options.
- **Retrospective feature**: After an event, generate a structured summary of what worked and what didn't, pulled from task completion rates, comms, and attendance data.
- **Testing**: Add unit and integration tests for the orchestrator, connectors, and IPC layer.
- **Multi-user support**: Wire up the collaborators table and add role-based access so teams can use the app together.
- **Auto-execute mode**: Allow trusted, low-risk agent actions (like calendar updates) to run without manual approval.

---

## License

ISC
