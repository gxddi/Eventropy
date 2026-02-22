-- Eventory seed data — mirrors MOCK_PAST_EVENTS and generateMockTimeline()
-- Run once in Supabase SQL Editor after applying 001_app_schema.sql.
-- Uses fixed UUIDs so re-running after clearing tables is safe.

-- Clear in reverse dependency order (optional; comment out if you want to append)
TRUNCATE TABLE collaborators, documents, subtasks, tasks, chat_messages, events RESTART IDENTITY CASCADE;

-- =============================================================================
-- EVENTS (3 past events from mockData)
-- =============================================================================
INSERT INTO events (id, evt_slug, name, event_date, start_time, end_time, venue_pref, guest_count, food_drinks, notes, status, created_at) VALUES
  ('a0000001-0001-4000-8000-000000000001', 'evt-past-001', 'Sarah''s Birthday Party', '2026-01-15', '19:00', '23:00', 'Downtown rooftop', '35', 'full-catering', 'Surprise party, 80s theme', 'complete', '2026-01-02T14:30:00Z'),
  ('a0000001-0001-4000-8000-000000000002', 'evt-past-002', 'Q1 Team Offsite', '2026-02-05', '09:00', '17:00', 'Conference center', '60', 'light-bites', 'Need projector and breakout rooms', 'complete', '2026-01-20T09:00:00Z'),
  ('a0000001-0001-4000-8000-000000000003', 'evt-past-003', 'Wine & Cheese Mixer', '2026-02-14', '18:30', '21:30', 'Gallery space', '25', 'drinks-only', 'Valentine''s day theme', 'complete', '2026-02-01T11:00:00Z');

-- =============================================================================
-- CHAT MESSAGES (same 13 messages per event as generateMockTimeline; message_at = event created_at + offset minutes)
-- =============================================================================
WITH base_messages (agent_id, role, content, min_offset) AS (
  VALUES
    ('venue', 'agent', 'I''ve started searching for venues matching your preferences. Currently reviewing 12 locations in the area.', 0),
    ('guest-list', 'agent', 'Analyzing event parameters. For a gathering of this size, I''d recommend organizing guests into tiers: close friends/family, colleagues, and acquaintances.', 1),
    ('catering', 'agent', 'Based on your catering selection, I''m researching local caterers. Found 8 options so far with ratings above 4.5 stars.', 2),
    ('invitations', 'agent', 'Working on three invitation templates — formal, casual, and digital-friendly. Each will include event details and an RSVP link.', 3),
    ('entertainment', 'agent', 'Exploring entertainment options that match the event duration. Categories under review: live music, DJ, photo booth, and interactive games.', 4),
    ('logistics', 'agent', 'I''ve created a preliminary day-of timeline and vendor coordination checklist. Tracking 4 vendor dependencies so far.', 5),
    ('venue', 'agent', 'Top 3 venues so far:\n1. The Grand Hall — 200 capacity, full A/V, $2,500\n2. Riverside Terrace — 150 capacity, outdoor, $1,800\n3. City Loft — 100 capacity, modern, $1,200', 6),
    ('guest-list', 'system', 'Waiting for input: I need access to your contact list or a rough list of names to proceed.', 7),
    ('catering', 'system', 'Waiting for input: Are there any vegetarian, vegan, gluten-free, or allergy requirements?', 8),
    ('invitations', 'agent', 'Draft 1 (Casual): "Hey [Name]! You''re invited to [Event] on [Date]. We''d love to see you there! RSVP by [Date]."', 9),
    ('logistics', 'system', 'Waiting for input: To finalize the budget tracker, I need a target budget range (min/max).', 10),
    ('entertainment', 'agent', 'Putting together a timeline that spaces out activities so there''s always something engaging happening. Schedule coming shortly.', 11),
    ('venue', 'agent', 'Checking availability for your selected date now. I''ll have confirmation within a few minutes.', 12)
),
event_bases AS (
  SELECT id, created_at FROM events
)
INSERT INTO chat_messages (event_id, agent_id, role, content, message_at)
SELECT
  eb.id,
  bm.agent_id,
  bm.role,
  bm.content,
  (eb.created_at::timestamptz + (bm.min_offset || ' minutes')::interval)
FROM event_bases eb
CROSS JOIN base_messages bm;

-- =============================================================================
-- OPTIONAL: a few sample tasks for the first event (so dashboard/timeline have something to show)
-- =============================================================================
INSERT INTO tasks (id, event_id, title, description, status, priority, due_date, assigned_to, created_at) VALUES
  ('b0000001-0001-4000-8000-000000000001', 'a0000001-0001-4000-8000-000000000001', 'Book venue', 'Confirm Downtown rooftop space', 'done', 2, '2026-01-05T12:00:00Z', 'ai-agent', '2026-01-02T15:00:00Z'),
  ('b0000001-0001-4000-8000-000000000002', 'a0000001-0001-4000-8000-000000000001', 'Send invitations', 'Send to 35 guests', 'done', 2, '2026-01-08T18:00:00Z', 'ai-agent', '2026-01-02T15:30:00Z'),
  ('b0000001-0001-4000-8000-000000000003', 'a0000001-0001-4000-8000-000000000002', 'Reserve A/V equipment', 'Projector and mics', 'todo', 1, '2026-02-01T17:00:00Z', NULL, '2026-01-20T10:00:00Z');

-- Subtasks for first task
INSERT INTO subtasks (task_id, title, status, completed_at) VALUES
  ('b0000001-0001-4000-8000-000000000001', 'Compare 3 options', 'done', '2026-01-03T14:00:00Z'),
  ('b0000001-0001-4000-8000-000000000001', 'Sign contract', 'done', '2026-01-05T11:00:00Z');
