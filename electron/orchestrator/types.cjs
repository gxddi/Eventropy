/**
 * types.cjs -> Orchestrator type constants and built-in tool definitions.
 * These are the pseudo-tools always available to the AI regardless of connectors.
 */

/** OrchestratorState -> Possible states for the orchestrator state machine. */
const OrchestratorState = {
  IDLE: "idle",
  PLANNING: "planning",
  EXECUTING: "executing",
  WAITING_FOR_USER: "waiting_for_user",
  COMPLETED: "completed",
  FAILED: "failed",
};

/**
 * BUILTIN_TOOLS -> Tools always available to Claude regardless of connectors.
 * These control the orchestrator flow (request input, mark complete, update progress).
 */
const BUILTIN_TOOLS = [
  {
    name: "request_user_input",
    description:
      "Request input from the user when you need information you cannot determine autonomously. " +
      "Use this when you are missing critical data like contact lists, preferences, passwords, " +
      "or any information that only the user can provide. The orchestrator will pause this task " +
      "and move to other tasks while waiting for the user's response.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The specific question to ask the user",
        },
        context: {
          type: "string",
          description: "Why this information is needed for the current task",
        },
        suggestions: {
          type: "array",
          items: { type: "string" },
          description: "Optional suggested answers to help the user respond quickly",
        },
      },
      required: ["question", "context"],
    },
  },
  {
    name: "mark_task_complete",
    description:
      "Mark the current task as completed. Call this when all work for the task is done. " +
      "Provide a clear summary of what was accomplished so the user can review it.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Summary of what was accomplished for this task",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "update_task_progress",
    description:
      "Update the visible progress on the current task. Call this periodically to keep " +
      "the user informed about what you are doing. The progress text appears in the task list.",
    input_schema: {
      type: "object",
      properties: {
        progress: {
          type: "string",
          description: "Human-readable description of current progress",
        },
        percentage: {
          type: "number",
          description: "Estimated completion percentage from 0 to 100",
        },
      },
      required: ["progress"],
    },
  },
  {
    name: "write_event_file",
    description:
      "Create or overwrite a .txt file for this event. Use this to save any document you " +
      "generate: email templates, guest lists, run-of-show schedules, budget breakdowns, " +
      "invitation drafts, or any other text output. The file will be visible to the user " +
      "in the event's Files section and they can open it in their text editor.",
    input_schema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description:
            "The filename including .txt extension (e.g. 'guest-list.txt', 'email-template.txt', " +
            "'schedule.txt'). Use lowercase-with-hyphens naming.",
        },
        content: {
          type: "string",
          description: "The full text content to write to the file.",
        },
      },
      required: ["filename", "content"],
    },
  },
];

/**
 * TASK_TOOLS -> Tools available in the category chat so the AI can read/write
 * task documents and event details. Injected into every callClaude() request
 * made by the orchestrator:category-chat IPC handler.
 */
const TASK_TOOLS = [
  {
    name: "list_tasks",
    description:
      "List tasks for this event. Returns id, title, description, status, priority, due_date, agent_id, and the first 200 chars of body for each task. " +
      "Use this to understand what work exists before deciding what to work on.",
    input_schema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          enum: ["guests", "venue-catering", "entertainment-logistics", "general"],
          description: "Optional: only return tasks for this agent category.",
        },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "done", "blocked"],
          description: "Optional: only return tasks with this status.",
        },
      },
    },
  },
  {
    name: "read_task",
    description:
      "Read the full details and current document body of a specific task. " +
      "Call this before writing to a task so you do not overwrite existing work.",
    input_schema: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: {
          type: "string",
          description: "The task UUID from list_tasks.",
        },
      },
    },
  },
  {
    name: "write_task_body",
    description:
      "Write or replace the markdown document body of a task. " +
      "This is the task's working document — use it to record research findings, " +
      "draft content, decisions, checklists, and progress notes. " +
      "Always read the task first so you preserve any existing content the user wrote.",
    input_schema: {
      type: "object",
      required: ["taskId", "body"],
      properties: {
        taskId: {
          type: "string",
          description: "The task UUID.",
        },
        body: {
          type: "string",
          description: "Full markdown content to save as the task body.",
        },
      },
    },
  },
  {
    name: "update_task_status",
    description:
      "Update a task's status. Use 'in-progress' when starting work, 'done' when complete.",
    input_schema: {
      type: "object",
      required: ["taskId", "status"],
      properties: {
        taskId: {
          type: "string",
          description: "The task UUID.",
        },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "done", "blocked"],
          description: "New status for the task.",
        },
      },
    },
  },
  {
    name: "read_event_details",
    description:
      "Read the current event details (name, date, time, venue, guest count, goals, notes) as structured JSON.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_event_details",
    description:
      "Patch event fields. Only include fields you want to change. " +
      "Use this to record a confirmed venue, finalized date, or updated notes.",
    input_schema: {
      type: "object",
      properties: {
        eventDate: { type: "string", description: "Event date (YYYY-MM-DD)" },
        startTime: { type: "string", description: "Start time (HH:MM)" },
        endTime: { type: "string", description: "End time (HH:MM)" },
        venuePref: { type: "string", description: "Venue preference or confirmed venue name" },
        guestCount: { type: "string", description: "Expected guest count" },
        notes: { type: "string", description: "Additional notes or updated information" },
      },
    },
  },
];

/**
 * CLAUDE_MODEL -> Claude Haiku 4.5 for task execution and category chat.
 */
const CLAUDE_MODEL = "claude-haiku-4-5";

/**
 * MAX_TOKENS -> Maximum tokens per Claude response.
 */
const MAX_TOKENS = 4096;

module.exports = {
  OrchestratorState,
  BUILTIN_TOOLS,
  TASK_TOOLS,
  CLAUDE_MODEL,
  MAX_TOKENS,
};
