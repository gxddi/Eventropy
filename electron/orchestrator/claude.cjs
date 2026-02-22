/**
 * claude.cjs -> Anthropic SDK wrapper for the orchestrator.
 * Handles Claude API calls with tool use, streaming, and message history management.
 */

const Anthropic = require("@anthropic-ai/sdk");
const { CLAUDE_MODEL, MAX_TOKENS } = require("./types.cjs");

/** @type {Anthropic | null} */
let client = null;

/**
 * initClaudeClient -> Initialize the Anthropic SDK client.
 * Must be called once at app startup with the API key.
 * @param {string} apiKey - The ANTHROPIC_API_KEY
 */
function initClaudeClient(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    console.warn("claude.cjs: No ANTHROPIC_API_KEY provided, orchestrator will not function.");
    return;
  }
  client = new Anthropic({ apiKey: apiKey.trim() });
}

/**
 * getClient -> Get the initialized Anthropic client.
 * @returns {Anthropic}
 */
function getClient() {
  if (!client) {
    throw new Error("Claude client not initialized. Call initClaudeClient first.");
  }
  return client;
}

/**
 * hasClaudeKey -> Check if the Claude client is initialized.
 * @returns {boolean}
 */
function hasClaudeKey() {
  return client !== null;
}

/**
 * buildSystemPrompt -> Construct the system prompt for a task execution.
 * Includes event context, task details, and agent persona.
 * @param {object} event - The PlannerEvent data
 * @param {object} task - The Task being executed
 * @param {object[]} allTasks - All tasks for context
 * @returns {string}
 */
function buildSystemPrompt(event, task, allTasks) {
  const agentName = task.agentId || "general";
  const agentDescriptions = {
    guests: "You specialize in managing the guest list, sending personalized invitations via email, and tracking RSVPs and attendance confirmations.",
    "venue-catering": "You specialize in finding venues that match the event's location, capacity, and budget requirements, and coordinating all catering, food, and drink arrangements.",
    "entertainment-logistics": "You specialize in planning the event program, activities, music, decorations, scheduling, vendor coordination, budget tracking, and operational checklists.",
    general: "You are a general-purpose event planning assistant. Handle the assigned task using available tools and good judgment.",
  };

  const taskStatuses = allTasks
    .map((t) => `- [${t.status}] ${t.title}${t.id === task.id ? " (CURRENT)" : ""}`)
    .join("\n");

  return `You are the "${agentName}" assistant helping the user plan their event: **${event.formData?.eventReason || event.formData?.name || "Untitled Event"}**.

${agentDescriptions[agentName] || agentDescriptions.general}

You work directly for the user — your job is to help them make this specific event a success.

## This Event
- **Event**: ${event.formData?.eventReason || event.formData?.name || "Untitled Event"}
- **Date**: ${event.formData?.eventDate || "TBD"}
- **Time**: ${event.formData?.startTime || "TBD"} – ${event.formData?.endTime || "TBD"}
- **Venue Preference**: ${event.formData?.venuePref || "Not specified"}
- **Guest Count**: ${event.formData?.guestCount || "Not specified"}
- **Food & Drinks**: ${event.formData?.foodDrinks || "Not specified"}
- **Budget**: ${event.formData?.budget ? `$${event.formData.budget}` : "Not specified"}
- **Notes**: ${event.formData?.notes || "None"}

## Current Task
- **Title**: ${task.title}
- **Description**: ${task.description || "No description provided"}
- **Priority**: ${task.priority === 2 ? "High" : task.priority === 1 ? "Medium" : "Low"}
- **Due Date**: ${task.dueDate || "No deadline"}

## All Tasks for This Event
${taskStatuses}

## Instructions
1. Work on the current task using the available tools.
2. Use \`update_task_progress\` periodically to keep the user informed.
3. If you need information only the user can provide, use \`request_user_input\`.
4. When the task is fully complete, use \`mark_task_complete\` with a summary.
5. Be concise but thorough. Show your reasoning so the user can follow along.
6. If a tool call fails, try an alternative approach before asking the user for help.`;
}

/**
 * buildPlanningPrompt -> Construct the system prompt for event task breakdown.
 * @param {object} formData - The EventFormData
 * @returns {string}
 */
function buildPlanningPrompt(formData) {
  const goals = formData.goals || {};
  const goalsStr = Object.keys(goals).length
    ? [
        goals.attendanceTarget != null ? `Attendance target: ${goals.attendanceTarget}` : "",
        goals.revenue != null ? `Revenue target: $${goals.revenue}` : "",
        goals.other ? `Other goals: ${goals.other}` : "",
        goals.communityGrowth ? `Community: ${goals.communityGrowth}` : "",
        goals.brandAwareness ? `Brand: ${goals.brandAwareness}` : "",
      ]
        .filter(Boolean)
        .join("; ")
    : "None specified";
  const venueLocation = formData.venueLocation;
  const venueAddress = venueLocation?.address ? ` (Address: ${venueLocation.address})` : "";
  const hasEventDate = formData.eventDate && formData.eventDate.trim().length > 0;
  const linkedEventsNote = formData.linkedEventIds?.length
    ? ` The user linked ${formData.linkedEventIds.length} related past event(s) — consider reusing or adapting tasks from similar events.`
    : "";

  return `You are an AI event planning assistant built into Eventropy. The user is creating a new event and needs you to break it down into a comprehensive list of actionable tasks. **Use every piece of data the user provided** when generating tasks (event type, date, time, venue, guests, food, budget, goals, notes).${linkedEventsNote}

## Event Details (use all of this)
- **Event**: ${formData.eventReason || "Untitled Event"}
- **Date**: ${formData.eventDate || "TBD"}
- **Time**: ${formData.startTime || "TBD"} - ${formData.endTime || "TBD"}
- **Venue Preference**: ${formData.venuePref || "Not specified"}${venueAddress}
- **Guest Count**: ${formData.guestCount || "Not specified"}
- **Food & Drinks**: ${formData.foodDrinks || "Not specified"}
- **Budget**: ${formData.budget != null ? `$${formData.budget}` : "Not specified"}
- **Goals**: ${goalsStr}
- **Notes**: ${formData.notes || "None"}

## Instructions
Generate a comprehensive list of tasks and assign each to exactly one of the four agent sections. For each task, provide:
- **title**: Short, actionable task title (reference the event type, venue, or goals where relevant)
- **description**: What needs to be done (1-2 sentences), using guest count, budget, or venue when relevant
- **priority**: 0 (low), 1 (medium), or 2 (high)
- **agentId**: Exactly one of: "guests", "venue-catering", "entertainment-logistics", "general"
- **dependencies**: Array of task indices (0-based) that must complete before this task
- **dueDate**: ${hasEventDate ? `When the event has a date, set a due date (YYYY-MM-DD) for tasks that should be done before the event. E.g. "Send invitations" 2–3 weeks before, "Finalize catering" 1 week before, "Confirm venue" 2 weeks before. All due dates must be before the event date. Omit or null for tasks that don't need a specific date.` : "Omit or null (no event date provided)."}

**Required: Split tasks across all 4 agent sections.** Include at least 2 tasks per section. Use the user's goals, notes, and preferences to tailor task titles and descriptions.
- **guests**: Invitations, RSVPs, guest list (use guest count), communications
- **venue-catering**: Venue research/booking (use venue preference and budget), catering, food and drink (use foodDrinks)
- **entertainment-logistics**: Program, activities, vendors, schedule, run-of-show
- **general**: Budget tracking (use budget), contracts, coordination

Respond with ONLY a JSON array. No markdown, no explanation. Use exactly these agentId values: "guests", "venue-catering", "entertainment-logistics", "general".
Example (with event date): [{"title":"Research venue options","description":"Find 3-5 venues matching budget and capacity.","priority":2,"agentId":"venue-catering","dependencies":[],"dueDate":"2025-02-15"},{"title":"Create guest list","description":"Compile initial guest list.","priority":2,"agentId":"guests","dependencies":[],"dueDate":"2025-02-20"}]
${hasEventDate ? `Event date is ${formData.eventDate} — assign dueDate (YYYY-MM-DD) to tasks where it makes sense; all due dates must be before ${formData.eventDate}.` : ""}

Generate 10-16 tasks. Order them logically so dependencies make sense.`;
}

/**
 * callClaude -> Make a Claude API call with tool use support.
 * Returns the full message response including any tool_use blocks.
 * @param {string} systemPrompt - The system prompt
 * @param {object[]} messages - Message history array
 * @param {object[]} tools - Tool definitions
 * @returns {Promise<object>} Claude API response message
 */
async function callClaude(systemPrompt, messages, tools) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
    tools,
  });
  return response;
}

/**
 * callClaudePlanning -> Make a one-shot Claude call for event planning (no tools).
 * @param {string} systemPrompt - The planning system prompt
 * @param {string} userMessage - The user's message
 * @returns {Promise<string>} Text response from Claude
 */
async function callClaudePlanning(systemPrompt, userMessage) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "";
}

/**
 * callClaudeChat -> Multi-turn chat with no tools (cheapest model).
 * @param {string} systemPrompt - System prompt with event + task context
 * @param {Array<{ role: 'user'|'assistant', content: string }>} messages - Conversation history
 * @returns {Promise<string>} Latest assistant reply
 */
async function callClaudeChat(systemPrompt, messages) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "";
}

/**
 * extractToolUseBlocks -> Extract tool_use blocks from a Claude response.
 * @param {object} response - Claude API response
 * @returns {object[]} Array of { id, name, input } tool use blocks
 */
function extractToolUseBlocks(response) {
  return response.content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input,
    }));
}

/**
 * extractTextContent -> Extract text content from a Claude response.
 * @param {object} response - Claude API response
 * @returns {string} Combined text from all text blocks
 */
function extractTextContent(response) {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

module.exports = {
  initClaudeClient,
  getClient,
  hasClaudeKey,
  buildSystemPrompt,
  buildPlanningPrompt,
  callClaude,
  callClaudePlanning,
  callClaudeChat,
  extractToolUseBlocks,
  extractTextContent,
};
