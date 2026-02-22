-- 003_task_body.sql
-- Adds a collaborative document body to each task.
-- Both the user (via TaskDocumentView) and the AI agent (via write_task_body tool)
-- can read and write this column. Defaults to empty string so existing rows are unaffected.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
