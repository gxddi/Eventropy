-- Orchestrator schema — AI execution tracking, notifications, and connector configs.
-- Run in Supabase SQL Editor or via Supabase CLI after 001_app_schema.sql.

-- =============================================================================
-- ORCHESTRATOR RUNS (one per "Run" button press per event)
-- =============================================================================
CREATE TABLE IF NOT EXISTS orchestrator_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | paused | completed | failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_event_id ON orchestrator_runs(event_id);

-- =============================================================================
-- ORCHESTRATOR MESSAGES (AI reasoning log + tool calls per task)
-- =============================================================================
CREATE TABLE IF NOT EXISTS orchestrator_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES orchestrator_runs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  role TEXT NOT NULL,              -- assistant | user | tool_result | system
  content TEXT,                    -- Text content or JSON for tool calls
  tool_name TEXT,                  -- If this is a tool_use or tool_result message
  tool_input JSONB,               -- Tool call input parameters
  tool_result JSONB,              -- Tool execution result
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_messages_run_id ON orchestrator_messages(run_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_messages_task_id ON orchestrator_messages(task_id);

-- =============================================================================
-- ORCHESTRATOR NOTIFICATIONS (human-in-the-loop prompts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS orchestrator_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  run_id UUID REFERENCES orchestrator_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'input_needed',  -- input_needed | error | info | completion
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  suggestions JSONB,              -- Optional suggested responses as JSON array of strings
  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_response TEXT,         -- User's response when resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON orchestrator_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON orchestrator_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_is_resolved ON orchestrator_notifications(is_resolved);

-- =============================================================================
-- CONNECTOR CONFIGS (non-secret metadata; secrets stored locally via safeStorage)
-- =============================================================================
CREATE TABLE IF NOT EXISTS connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id TEXT NOT NULL UNIQUE,  -- 'gmail' | 'google-calendar' | 'notion' | 'luma'
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  config_public JSONB,               -- Non-secret config (calendar ID, workspace, etc.)
  last_tested_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ADD COLUMNS TO TASKS (orchestrator tracking fields)
-- =============================================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_progress_pct INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_progress_text TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);

-- =============================================================================
-- TRIGGER: updated_at for connector_configs
-- =============================================================================
DROP TRIGGER IF EXISTS connector_configs_updated_at ON connector_configs;
CREATE TRIGGER connector_configs_updated_at
  BEFORE UPDATE ON connector_configs
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
