# Supabase schema and seed

## 1. Create schema

In the [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**:

1. Open **New query**.
2. Paste and run the contents of `migrations/001_app_schema.sql`.

## 2. Load fake data

In the same SQL Editor:

1. New query.
2. Paste and run the contents of `seed.sql`.

This inserts 3 past events (Sarah's Birthday, Q1 Team Offsite, Wine & Cheese Mixer), their chat timelines (13 messages each), and a few sample tasks/subtasks.

## 3. Use in the app

- Events: `events` (id = UUID, evt_slug = `evt-past-001` etc.).
- Chat: `chat_messages` by `event_id`.
- Tasks: `tasks` + `subtasks` by `event_id`.

Map DB rows to your app types in `src/lib/supabase.ts` or a dedicated `src/lib/eventsDb.ts` (e.g. `eventRowToPlannerEvent`, `chatRowsToTimeline`).

## Re-running seed

`seed.sql` truncates events, chat_messages, tasks, subtasks, documents, collaborators then re-inserts. Run it again anytime to reset to the 3 fake events.
