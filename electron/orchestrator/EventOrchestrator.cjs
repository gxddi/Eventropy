/**
 * EventOrchestrator.cjs -> Core orchestration loop for a single event.
 * Manages the state machine: IDLE -> EXECUTING -> WAITING_FOR_USER -> COMPLETED.
 * Each task gets its own Claude conversation thread.
 */

const { OrchestratorState } = require("./types.cjs");
const {
  buildSystemPrompt,
  buildPlanningPrompt,
  callClaude,
  callClaudePlanning,
  extractToolUseBlocks,
  extractTextContent,
  hasClaudeKey,
} = require("./claude.cjs");
const { getAllTools, executeTool } = require("./toolRegistry.cjs");

/**
 * EventOrchestrator -> Manages AI task execution for one event.
 */
class EventOrchestrator {
  /**
   * @param {object} opts
   * @param {string} opts.eventId - The event ID
   * @param {object} opts.event - Full PlannerEvent data
   * @param {object[]} opts.tasks - AI-assigned tasks to execute
   * @param {function} opts.onTaskUpdate - Callback for task progress updates
   * @param {function} opts.onNotification - Callback for new notifications
   * @param {function} opts.onChatMessage - Callback for new chat messages
   * @param {function} opts.onStatusChange - Callback for orchestrator status changes
   * @param {function} [opts.onWriteFile] - Callback to write a file: (evtId, filename, content) => void
   * @param {object} opts.supabase - Supabase client
   */
  constructor(opts) {
    this.eventId = opts.eventId;
    this.event = opts.event;
    this.tasks = opts.tasks;
    this.onTaskUpdate = opts.onTaskUpdate;
    this.onNotification = opts.onNotification;
    this.onChatMessage = opts.onChatMessage;
    this.onStatusChange = opts.onStatusChange;
    this.onWriteFile = opts.onWriteFile || null;
    this.supabase = opts.supabase;

    this.state = OrchestratorState.IDLE;
    this.runId = null;
    this.activeTaskId = null;
    this.shouldStop = false;

    /** @type {Map<string, object[]>} taskId -> Claude message history */
    this.taskMessageHistories = new Map();

    /** @type {Map<string, string>} notificationId -> taskId for pending user responses */
    this.pendingResponses = new Map();
  }

  /**
   * start -> Begin the orchestrator execution loop.
   * Creates a run record, then enters the task selection/execution loop.
   */
  async start() {
    if (!hasClaudeKey()) {
      throw new Error("Claude API key not configured. Add ANTHROPIC_API_KEY to your environment.");
    }

    this.shouldStop = false;
    this.state = OrchestratorState.EXECUTING;

    // Create orchestrator_runs record
    const { data: run, error: runErr } = await this.supabase
      .from("orchestrator_runs")
      .insert({
        event_id: this.eventId,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runErr) {
      console.error("Failed to create orchestrator run:", runErr);
      throw runErr;
    }

    this.runId = run.id;
    this._emitStatusChange();

    // Enter the execution loop
    try {
      await this._executionLoop();
    } catch (err) {
      console.error("Orchestrator execution error:", err);
      this.state = OrchestratorState.FAILED;
      await this._updateRunStatus("failed");
      this._emitStatusChange();
    }
  }

  /**
   * stop -> Signal the orchestrator to stop after the current task step.
   */
  stop() {
    this.shouldStop = true;
  }

  /**
   * handleUserResponse -> Process a user's response to a human-in-the-loop prompt.
   * Unblocks the task and re-enters the execution loop.
   * @param {string} notificationId - The notification being resolved
   * @param {string} response - The user's response text
   */
  async handleUserResponse(notificationId, response) {
    const taskId = this.pendingResponses.get(notificationId);
    if (!taskId) {
      console.warn("No pending response found for notification:", notificationId);
      return;
    }

    // Mark notification as resolved in DB
    await this.supabase
      .from("orchestrator_notifications")
      .update({
        is_resolved: true,
        resolved_response: response,
      })
      .eq("id", notificationId);

    // Unblock the task
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = "in-progress";
      await this.supabase
        .from("tasks")
        .update({ status: "in-progress" })
        .eq("id", taskId);
    }

    // Add the user response to the task's message history as a tool_result
    const history = this.taskMessageHistories.get(taskId) || [];
    // Find the last assistant message with request_user_input tool_use
    const lastAssistantIdx = [...history].reverse().findIndex(
      (m) => m.role === "assistant"
    );
    if (lastAssistantIdx >= 0) {
      // The tool_result goes after the assistant message
      const toolUseId = this._findRequestUserInputToolId(history);
      if (toolUseId) {
        history.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseId,
              content: response,
            },
          ],
        });
        this.taskMessageHistories.set(taskId, history);
      }
    }

    this.pendingResponses.delete(notificationId);

    // Persist the user response as an orchestrator message
    await this._persistMessage(taskId, "user", response);

    // Emit the response as a chat message
    this.onChatMessage({
      taskId,
      eventId: this.eventId,
      role: "user",
      content: response,
      createdAt: new Date().toISOString(),
    });

    // If the orchestrator was waiting, resume execution
    if (this.state === OrchestratorState.WAITING_FOR_USER && !this.shouldStop) {
      this.state = OrchestratorState.EXECUTING;
      this._emitStatusChange();
      try {
        await this._executionLoop();
      } catch (err) {
        console.error("Orchestrator resume error:", err);
        this.state = OrchestratorState.FAILED;
        await this._updateRunStatus("failed");
        this._emitStatusChange();
      }
    }
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  /**
   * _executionLoop -> The main task selection and execution loop.
   * Continues until all tasks are done/blocked or stop is signaled.
   */
  async _executionLoop() {
    while (!this.shouldStop) {
      const nextTask = this._selectNextTask();
      if (!nextTask) {
        // Check if all tasks are done or all remaining are blocked
        const remaining = this.tasks.filter((t) => t.status !== "done");
        if (remaining.length === 0) {
          this.state = OrchestratorState.COMPLETED;
          await this._updateRunStatus("completed");
        } else {
          this.state = OrchestratorState.WAITING_FOR_USER;
          await this._updateRunStatus("paused");
        }
        this._emitStatusChange();
        return;
      }

      this.activeTaskId = nextTask.id;
      this._emitStatusChange();

      const shouldContinue = await this._executeTask(nextTask);
      if (!shouldContinue) {
        // Task was blocked (needs user input), continue to next task
        continue;
      }
    }

    // Stop was signaled
    if (this.shouldStop) {
      this.state = OrchestratorState.IDLE;
      await this._updateRunStatus("paused");
      this._emitStatusChange();
    }
  }

  /**
   * _selectNextTask -> Pick the highest-priority unblocked task.
   * Implements the smart task ordering algorithm.
   * @returns {object | null} The next task to execute, or null if none available
   */
  _selectNextTask() {
    const candidates = this.tasks.filter((task) => {
      // Must be assigned to AI
      if (task.assignedTo !== "ai-agent") return false;
      // Must not be done
      if (task.status === "done") return false;
      // Must not be blocked (waiting for user input)
      if (task.status === "blocked") return false;
      // Dependencies must all be done
      if (task.dependencies && task.dependencies.length > 0) {
        const allDepsDone = task.dependencies.every((depId) => {
          const dep = this.tasks.find((t) => t.id === depId);
          return dep && dep.status === "done";
        });
        if (!allDepsDone) return false;
      }
      return true;
    });

    if (candidates.length === 0) return null;

    // Sort by score (highest first)
    candidates.sort((a, b) => {
      const scoreA = this._taskScore(a);
      const scoreB = this._taskScore(b);
      return scoreB - scoreA;
    });

    return candidates[0];
  }

  /**
   * _taskScore -> Calculate a priority score for task ordering.
   * @param {object} task
   * @returns {number}
   */
  _taskScore(task) {
    let score = task.priority * 100;

    // Near due date bonus
    if (task.dueDate) {
      const daysUntilDue = (new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 3) score += 30;
      if (daysUntilDue < 1) score += 50;
    }

    // In-progress tasks get a bonus (resume them first)
    if (task.status === "in-progress") score += 20;

    return score;
  }

  /**
   * _executeTask -> Execute a single task via Claude API loop.
   * @param {object} task
   * @returns {Promise<boolean>} true if task completed, false if blocked
   */
  async _executeTask(task) {
    // Set task to in-progress
    task.status = "in-progress";
    await this.supabase
      .from("tasks")
      .update({ status: "in-progress" })
      .eq("id", task.id);

    this.onTaskUpdate({
      eventId: this.eventId,
      taskId: task.id,
      status: "in-progress",
      progressPct: task.aiProgressPct || 0,
      progressText: "Starting task...",
    });

    // Build system prompt with full event context
    const systemPrompt = buildSystemPrompt(this.event, task, this.tasks);
    const tools = getAllTools();

    // Get or initialize message history
    let messages = this.taskMessageHistories.get(task.id) || [];
    if (messages.length === 0) {
      // Initial user message to kick off the task
      messages.push({
        role: "user",
        content: `Please work on this task: "${task.title}". ${task.description || ""}`,
      });
      this.taskMessageHistories.set(task.id, messages);
    }

    // Claude conversation loop (tool use rounds)
    const MAX_ROUNDS = 20;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (this.shouldStop) return true;

      let response;
      try {
        response = await callClaude(systemPrompt, messages, tools);
      } catch (err) {
        console.error(`Claude API error for task ${task.id}:`, err);
        await this._persistMessage(task.id, "system", `Error: ${err.message}`);
        this.onChatMessage({
          taskId: task.id,
          eventId: this.eventId,
          role: "system",
          content: `Error communicating with AI: ${err.message}`,
          createdAt: new Date().toISOString(),
        });
        return true; // Don't block, just skip
      }

      // Add assistant response to history
      messages.push({ role: "assistant", content: response.content });
      this.taskMessageHistories.set(task.id, messages);

      // Extract text content for display
      const textContent = extractTextContent(response);
      if (textContent) {
        await this._persistMessage(task.id, "assistant", textContent);
        this.onChatMessage({
          taskId: task.id,
          eventId: this.eventId,
          role: "assistant",
          content: textContent,
          createdAt: new Date().toISOString(),
        });
      }

      // Extract tool use blocks
      const toolUses = extractToolUseBlocks(response);

      if (toolUses.length === 0) {
        // No tool calls — Claude has finished reasoning for this round
        if (response.stop_reason === "end_turn") {
          // Task step complete but not formally marked done
          // This is fine, the task stays in-progress
          return true;
        }
        continue;
      }

      // Process each tool call
      const toolResults = [];
      for (const toolUse of toolUses) {
        // Handle built-in tools
        if (toolUse.name === "request_user_input") {
          const blocked = await this._handleRequestUserInput(task, toolUse);
          return false; // Task is now blocked
        }

        if (toolUse.name === "mark_task_complete") {
          await this._handleMarkTaskComplete(task, toolUse);
          return true; // Task is done
        }

        if (toolUse.name === "update_task_progress") {
          await this._handleUpdateProgress(task, toolUse);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: "Progress updated.",
          });
          continue;
        }

        if (toolUse.name === "write_event_file") {
          const writeResult = await this._handleWriteEventFile(task, toolUse);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: writeResult,
          });
          continue;
        }

        // Execute connector tool
        await this._persistMessage(
          task.id,
          "assistant",
          null,
          toolUse.name,
          toolUse.input
        );

        this.onChatMessage({
          taskId: task.id,
          eventId: this.eventId,
          role: "assistant",
          content: `Using tool: ${toolUse.name}`,
          toolName: toolUse.name,
          toolInput: toolUse.input,
          createdAt: new Date().toISOString(),
        });

        const result = await executeTool(toolUse.name, toolUse.input);

        await this._persistMessage(
          task.id,
          "tool_result",
          null,
          toolUse.name,
          null,
          result
        );

        this.onChatMessage({
          taskId: task.id,
          eventId: this.eventId,
          role: "tool_result",
          content: result.success
            ? `Tool ${toolUse.name} succeeded.`
            : `Tool ${toolUse.name} failed: ${result.error}`,
          toolName: toolUse.name,
          toolResult: result,
          createdAt: new Date().toISOString(),
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool results to message history
      if (toolResults.length > 0) {
        messages.push({ role: "user", content: toolResults });
        this.taskMessageHistories.set(task.id, messages);
      }
    }

    // Max rounds exceeded
    console.warn(`Task ${task.id} hit max rounds (${MAX_ROUNDS}).`);
    return true;
  }

  // ── Built-in Tool Handlers ──────────────────────────────────────────────

  async _handleRequestUserInput(task, toolUse) {
    const { question, context, suggestions } = toolUse.input;

    // Block the task and store what human intervention is needed
    task.status = "blocked";
    const progressText = `Needs input: ${question}`;
    if (task.aiProgressText !== progressText) task.aiProgressText = progressText;
    await this.supabase
      .from("tasks")
      .update({ status: "blocked", ai_progress_text: progressText })
      .eq("id", task.id);

    // Create notification
    const { data: notification } = await this.supabase
      .from("orchestrator_notifications")
      .insert({
        event_id: this.eventId,
        task_id: task.id,
        run_id: this.runId,
        type: "input_needed",
        title: `Input needed: ${task.title}`,
        message: question,
        suggestions: suggestions || null,
      })
      .select("id")
      .single();

    const notificationId = notification?.id;
    if (notificationId) {
      this.pendingResponses.set(notificationId, task.id);
    }

    // Persist the question as a message
    await this._persistMessage(
      task.id,
      "assistant",
      `**Needs your input**: ${question}\n\n_Context: ${context}_${
        suggestions ? `\n\nSuggested answers: ${suggestions.join(", ")}` : ""
      }`
    );

    // Emit events
    this.onTaskUpdate({
      eventId: this.eventId,
      taskId: task.id,
      status: "blocked",
      progressPct: task.aiProgressPct || 0,
      progressText: "Waiting for your input...",
    });

    this.onNotification({
      id: notificationId,
      eventId: this.eventId,
      taskId: task.id,
      type: "input_needed",
      title: `Input needed: ${task.title}`,
      message: question,
      suggestions: suggestions || [],
      isRead: false,
      isResolved: false,
      createdAt: new Date().toISOString(),
    });

    return true;
  }

  async _handleMarkTaskComplete(task, toolUse) {
    const { summary } = toolUse.input;

    task.status = "done";
    task.completedAt = new Date().toISOString();
    task.aiSummary = summary;
    task.aiProgressPct = 100;

    await this.supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: task.completedAt,
        ai_summary: summary,
        ai_progress_pct: 100,
        ai_progress_text: "Completed",
      })
      .eq("id", task.id);

    await this._persistMessage(task.id, "assistant", `**Task completed**: ${summary}`);

    this.onTaskUpdate({
      eventId: this.eventId,
      taskId: task.id,
      status: "done",
      progressPct: 100,
      progressText: "Completed",
      summary,
    });

    this.onChatMessage({
      taskId: task.id,
      eventId: this.eventId,
      role: "assistant",
      content: `Task completed: ${summary}`,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * _handleWriteEventFile -> Write a .txt file for this event.
   * Delegates the actual filesystem write to the onWriteFile callback
   * (provided by main.cjs) to keep the orchestrator decoupled from Node fs.
   * @param {object} task
   * @param {object} toolUse - Claude tool_use block
   * @returns {Promise<string>} Tool result string for Claude
   */
  async _handleWriteEventFile(task, toolUse) {
    let { filename, content } = toolUse.input;

    // Sanitize filename: strip path separators, enforce .txt extension.
    filename = String(filename).replace(/[/\\]/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-");
    if (!filename.toLowerCase().endsWith(".txt")) filename += ".txt";

    const evtId = this.event?.evtId || this.eventId;

    try {
      if (this.onWriteFile) {
        await this.onWriteFile(evtId, filename, content);
      }

      await this._persistMessage(
        task.id,
        "assistant",
        `**Created file**: ${filename} (${content.length} chars)`
      );

      this.onChatMessage({
        taskId: task.id,
        eventId: this.eventId,
        role: "assistant",
        content: `Created file: ${filename}`,
        createdAt: new Date().toISOString(),
      });

      return `File '${filename}' written successfully (${content.length} characters).`;
    } catch (err) {
      return `Failed to write file '${filename}': ${err.message}`;
    }
  }

  async _handleUpdateProgress(task, toolUse) {
    const { progress, percentage } = toolUse.input;

    task.aiProgressText = progress;
    if (typeof percentage === "number") {
      task.aiProgressPct = Math.min(100, Math.max(0, percentage));
    }

    await this.supabase
      .from("tasks")
      .update({
        ai_progress_text: progress,
        ai_progress_pct: task.aiProgressPct || 0,
      })
      .eq("id", task.id);

    this.onTaskUpdate({
      eventId: this.eventId,
      taskId: task.id,
      status: task.status,
      progressPct: task.aiProgressPct || 0,
      progressText: progress,
    });
  }

  // ── Persistence Helpers ─────────────────────────────────────────────────

  async _persistMessage(taskId, role, content, toolName, toolInput, toolResult) {
    if (!this.runId) return;

    await this.supabase.from("orchestrator_messages").insert({
      run_id: this.runId,
      task_id: taskId,
      role,
      content: content || null,
      tool_name: toolName || null,
      tool_input: toolInput || null,
      tool_result: toolResult || null,
    });
  }

  async _updateRunStatus(status) {
    if (!this.runId) return;

    const updates = { status };
    if (status === "completed" || status === "failed") {
      updates.completed_at = new Date().toISOString();
    }

    await this.supabase
      .from("orchestrator_runs")
      .update(updates)
      .eq("id", this.runId);
  }

  _emitStatusChange() {
    const completed = this.tasks.filter((t) => t.status === "done").length;
    const blocked = this.tasks.filter((t) => t.status === "blocked").length;

    this.onStatusChange({
      eventId: this.eventId,
      runId: this.runId,
      runStatus: this.state,
      activeTaskId: this.activeTaskId,
      completedCount: completed,
      totalCount: this.tasks.length,
      blockedCount: blocked,
    });
  }

  _findRequestUserInputToolId(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const toolUse = msg.content.find(
          (block) => block.type === "tool_use" && block.name === "request_user_input"
        );
        if (toolUse) return toolUse.id;
      }
    }
    return null;
  }

  // ── Status Query ────────────────────────────────────────────────────────

  getStatus() {
    const completed = this.tasks.filter((t) => t.status === "done").length;
    const blocked = this.tasks.filter((t) => t.status === "blocked").length;

    return {
      eventId: this.eventId,
      runId: this.runId,
      runStatus: this.state,
      activeTaskId: this.activeTaskId,
      completedCount: completed,
      totalCount: this.tasks.length,
      blockedCount: blocked,
    };
  }
}

/**
 * planEventTasks -> One-shot Claude call to break down an event into tasks.
 * @param {object} formData - The EventFormData
 * @returns {Promise<object[]>} Array of task objects with title, description, priority, agentId, dependencies
 */
async function planEventTasks(formData) {
  const systemPrompt = buildPlanningPrompt(formData);
  const responseText = await callClaudePlanning(
    systemPrompt,
    "Generate the task breakdown for this event. Respond with only a JSON array."
  );

  try {
    // Strip any markdown code fences if present
    const cleaned = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const tasks = JSON.parse(cleaned);

    if (!Array.isArray(tasks)) {
      console.warn("planEventTasks: Response is not an array:", responseText);
      return [];
    }

    const VALID_AGENT_IDS = ["guests", "venue-catering", "entertainment-logistics", "general"];
    const normalizeAgentId = (id) =>
      id && VALID_AGENT_IDS.includes(String(id).toLowerCase()) ? String(id).toLowerCase() : "general";

    const eventDate = formData.eventDate ? new Date(formData.eventDate) : null;
    const isValidDueDate = (s) => {
      if (!s || typeof s !== "string") return false;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return false;
      const ymd = s.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
      if (eventDate && d >= eventDate) return false;
      return true;
    };

    return tasks
      .filter(
        (t) =>
          t &&
          typeof t === "object" &&
          typeof t.title === "string"
      )
      .map((t, idx) => {
        let dueDate = t.dueDate != null ? String(t.dueDate).trim().slice(0, 10) : null;
        if (dueDate && !isValidDueDate(dueDate)) dueDate = null;
        return {
          title: t.title,
          description: t.description || "",
          priority: typeof t.priority === "number" ? t.priority : 1,
          agentId: normalizeAgentId(t.agentId) || "general",
          dependencies: Array.isArray(t.dependencies)
            ? t.dependencies.filter((d) => typeof d === "number" && d < idx)
            : [],
          dueDate: dueDate || undefined,
        };
      });
  } catch (err) {
    console.error("planEventTasks: Failed to parse response:", err, responseText);
    return [];
  }
}

module.exports = {
  EventOrchestrator,
  planEventTasks,
};
