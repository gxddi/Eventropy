const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Load .env into process.env before anything else reads it
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// ── Orchestrator imports ────────────────────────────────────────────────────
const { initClaudeClient, hasClaudeKey, callClaude, extractToolUseBlocks, extractTextContent } = require("./orchestrator/claude.cjs");
const { planEventTasks } = require("./orchestrator/EventOrchestrator.cjs");
const { registerConnector, getAllConnectors, getConnector } = require("./orchestrator/toolRegistry.cjs");
const { TASK_TOOLS } = require("./orchestrator/types.cjs");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Connector imports ───────────────────────────────────────────────────────
const { NotionConnector } = require("./connectors/notion.cjs");
const { GmailConnector } = require("./connectors/gmail.cjs");
const { GoogleCalendarConnector } = require("./connectors/googleCalendar.cjs");
const { LumaConnector } = require("./connectors/luma.cjs");
const {
  initCredentialStore,
  setSecret,
  getSecret,
} = require("./connectors/credentialStore.cjs");

// isDev -> Derived from `is` + `Development` environment flag
const isDev = !app.isPackaged;

// Set app name before window creation so the OS title bar reflects it
app.setName("Eventropy");

/** @type {BrowserWindow | null} */
let mainWin = null;

/** @type {Map<string, EventOrchestrator>} eventId -> active orchestrator */
const activeOrchestrators = new Map();

// ── App Initialization ──────────────────────────────────────────────────────

function createWindow() {
  mainWin = new BrowserWindow({
    title: "Eventropy",
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: "#1a1a1a",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    mainWin.loadURL("http://localhost:5173");
  } else {
    mainWin.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Force window title after page finishes loading (Vite dev server can override <title>)
  mainWin.webContents.on("did-finish-load", () => {
    mainWin.setTitle("Eventropy");
  });

  // Also set the icon programmatically for the taskbar / window frame
  const iconPath = path.join(__dirname, "../public/Eventrop.png");
  try { mainWin.setIcon(iconPath); } catch (_) { /* icon file may not exist in prod build */ }
}

app.whenReady().then(async () => {
  // Initialize Claude client with API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    initClaudeClient(apiKey);
    console.log("Claude client initialized.");
  } else {
    console.warn("ANTHROPIC_API_KEY not set. AI orchestration will not function.");
  }

  // Initialize encrypted credential store (must run after app.whenReady)
  initCredentialStore();

  // Instantiate and register all connectors, loading saved secrets
  await initConnectors();

  createWindow();
  registerIpcHandlers();

  // Check DB migrations after window is ready to show dialogs
  const supabaseCheck = createSupabaseClient();
  if (supabaseCheck) {
    checkMigrations(supabaseCheck).catch((err) => {
      console.warn("[Eventory] checkMigrations threw:", err.message);
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ────────────────────────────────────────────────────────────

/**
 * resolveEventUuid -> Resolve an evtId (evt_slug or UUID) to a Supabase events.id UUID.
 * @param {object} supabase - Supabase client
 * @param {string} evtId - Event slug or UUID
 * @returns {Promise<string|null>}
 */
async function resolveEventUuid(supabase, evtId) {
  if (!evtId) return null;
  if (UUID_REGEX.test(evtId.trim())) return evtId.trim();
  const { data } = await supabase.from("events").select("id").eq("evt_slug", evtId.trim()).maybeSingle();
  return data?.id ?? null;
}

/**
 * checkMigrations -> Verify that required DB migrations have been applied.
 * Specifically checks for the `body` column on the tasks table (migration 003).
 * Shows a dialog if the column is missing so the user knows what to fix.
 * @param {object} supabase - Supabase client
 */
async function checkMigrations(supabase) {
  try {
    const { error } = await supabase.from("tasks").select("body").limit(1);
    if (error) {
      console.warn("[Eventory] Migration check failed — tasks.body column may be missing:", error.message);
      dialog.showMessageBox(mainWin, {
        type: "warning",
        title: "Database Migration Required",
        message: "The tasks table is missing the 'body' column.",
        detail:
          "Run this SQL in your Supabase Dashboard → SQL Editor:\n\n" +
          "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';\n\n" +
          "Then go to Project Settings → Database → Schema → click 'Reload schema'.\n\n" +
          "Until this is done, task documents and AI task writing will not work.",
        buttons: ["OK"],
      }).catch(() => {});
    } else {
      console.log("[Eventory] Migration check passed — tasks.body column exists.");
    }
  } catch (err) {
    console.warn("[Eventory] checkMigrations error:", err.message);
  }
}

function registerIpcHandlers() {
  // ── Task Body: user-side write (renderer → main → Supabase) ───────────
  ipcMain.handle("task:update-body", async (_event, { taskId, body }) => {
    const supabase = createSupabaseClient();
    if (!supabase) return { error: "Supabase not configured." };
    const { error } = await supabase.from("tasks").update({ body }).eq("id", taskId);
    if (error) return { error: error.message };
    return { success: true };
  });

  // ── Category Chat with task tools (tool-use loop) ─────────────────────
  // Replaces the previous simple callClaudeChat() call with a full tool-use
  // loop so the agent can read/write task bodies and update task statuses.
  ipcMain.handle("orchestrator:category-chat", async (_event, payload) => {
    console.log("[Eventropy] Category chat requested", payload?.agentId);
    if (!hasClaudeKey()) {
      return { error: "ANTHROPIC_API_KEY not configured." };
    }

    const { evtId, agentId, eventContext, tasksForCategory, messages } = payload || {};

    const supabase = createSupabaseClient();
    if (!supabase) return { error: "Supabase not configured." };

    // Resolve event UUID for Supabase queries
    const eventUuid = await resolveEventUuid(supabase, evtId);

    const agentLabels = {
      guests: "Guests",
      "venue-catering": "Venue & Catering",
      "entertainment-logistics": "Entertainment & Logistics",
      general: "General",
    };
    const agentLabel = agentLabels[agentId] || agentId;
    const eventName = eventContext?.eventReason || "Untitled";
    const agentPersonas = {
      guests: `You are the user's **Guests** specialist for their event: **${eventName}**. Your sole responsibility is managing everything guest-related for this specific event:
- Building and maintaining the guest list
- Drafting and sending invitations (email, physical, etc.)
- Tracking RSVPs, dietary restrictions, accessibility needs
- Managing seating arrangements and name tags
- Handling plus-ones, waitlists, and last-minute changes
- Guest communication and reminders

You do NOT handle venue, catering, entertainment, or budgeting — those belong to other specialists. Stay focused on guests.`,
      "venue-catering": `You are the user's **Venue & Catering** specialist for their event: **${eventName}**. Your sole responsibility is managing venue and food/drink logistics for this specific event:
- Researching venues matching the budget, capacity, and location preferences
- Comparing venue options and making recommendations
- Coordinating catering menus, dietary accommodations, and tastings
- Managing vendor contracts for venue and catering
- Handling setup/teardown logistics at the venue
- Drink service planning (bar, beverages, service style)

You do NOT handle guest lists, entertainment, or general coordination — those belong to other specialists. Stay focused on venue and catering.`,
      "entertainment-logistics": `You are the user's **Entertainment & Logistics** specialist for their event: **${eventName}**. Your sole responsibility is the event programme and operational logistics for this specific event:
- Planning the event schedule / run-of-show
- Booking entertainment (DJs, bands, speakers, activities)
- Coordinating decorations, themes, and ambiance
- Managing vendor logistics (setup times, equipment, AV)
- Planning activities, games, or interactive elements
- Creating operational checklists and contingency plans

You do NOT handle guest lists, venue/catering booking, or budgets — those belong to other specialists. Stay focused on entertainment and logistics.`,
      general: `You are the user's **General Coordination** specialist for their event: **${eventName}**. Your responsibility is cross-cutting coordination and anything that doesn't fit the other categories for this specific event:
- Budget tracking and expense management
- Contract review and legal considerations
- Timeline and milestone management
- Cross-team coordination between the other specialists
- Insurance, permits, and compliance
- Any tasks that span multiple categories

You handle the big picture and fill gaps between the other specialists.`,
    };

    const taskListStr = (tasksForCategory || [])
      .map((t, i) => {
        let line = `${i + 1}. [${t.status.toUpperCase()}] **${t.title}** (id: ${t.id})`;
        if (t.description) line += `\n   ${t.description}`;
        return line;
      })
      .join("\n");

    const todoCount = (tasksForCategory || []).filter((t) => t.status === "todo").length;
    const inProgressCount = (tasksForCategory || []).filter((t) => t.status === "in-progress").length;
    const doneCount = (tasksForCategory || []).filter((t) => t.status === "done").length;
    const blockedCount = (tasksForCategory || []).filter((t) => t.status === "blocked").length;

    const systemPrompt = `${agentPersonas[agentId] || agentPersonas.general}

You work directly for the user — your job is to help them make **${eventName}** a success. You have access to tools that let you read and write task documents.

## How to work
1. Use **list_tasks** or **read_task** to understand the current state before making changes.
2. Use **write_task_body** to save research, drafts, checklists, or plans to a task's document. Always read first to preserve existing content.
3. Use **update_task_status** to mark tasks in-progress or done when appropriate.
4. Focus ONLY on the tasks assigned to your area (${agentLabel}). Do not work on tasks outside your scope.

## This Event
- **Event**: ${eventName}
- **Date**: ${eventContext?.eventDate || "TBD"}
- **Time**: ${eventContext?.startTime || "?"} – ${eventContext?.endTime || "?"}
- **Venue preference**: ${eventContext?.venuePref || "Not specified"}
- **Expected guests**: ${eventContext?.guestCount || "Not specified"}
- **Food & drinks**: ${eventContext?.foodDrinks || "Not specified"}
- **Budget**: ${eventContext?.budget ? `$${eventContext.budget}` : "Not specified"}
- **Notes**: ${eventContext?.notes || "None"}

## Your assigned tasks (${agentLabel}) — ${(tasksForCategory || []).length} total | ${todoCount} to-do, ${inProgressCount} in progress, ${doneCount} done, ${blockedCount} blocked
${taskListStr || "(No tasks assigned yet.)"}

## Response style
- Use markdown formatting in your replies: **bold** for emphasis, bullet lists for options, headings for structure.
- Be concise but thorough. Do the work with tools, then summarize what you accomplished.
- When the user asks a question, ground your answer in the specific tasks and event details above.
- If the user asks about something outside your area, let them know which specialist handles it.`;

    // Build initial message list for Claude
    const claudeMessages = (messages || []).map((m) => ({ role: m.role, content: m.content }));

    const toolTurns = [];
    let finalContent = "";
    const MAX_ROUNDS = 10;

    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const response = await callClaude(systemPrompt, claudeMessages, TASK_TOOLS);
        const textContent = extractTextContent(response);
        const toolUseBlocks = extractToolUseBlocks(response);

        if (toolUseBlocks.length === 0) {
          finalContent = textContent;
          break;
        }

        // Append assistant turn (may include text + tool_use blocks)
        claudeMessages.push({ role: "assistant", content: response.content });

        // Execute each tool call and collect results
        const toolResultContents = [];
        for (const toolUse of toolUseBlocks) {
          let result;
          let resultSummary = "";

          try {
            switch (toolUse.name) {
              case "list_tasks": {
                // Use select("*") so the query is resilient to missing columns
                // (e.g., `body` before migration 003 is applied).
                let query = supabase.from("tasks").select("*");
                if (eventUuid) query = query.eq("event_id", eventUuid);
                if (toolUse.input.agentId) query = query.eq("agent_id", toolUse.input.agentId);
                if (toolUse.input.status) query = query.eq("status", toolUse.input.status);
                const { data: taskRows, error: listErr } = await query.order("created_at");
                if (listErr) {
                  result = { error: listErr.message };
                  resultSummary = `list_tasks query failed: ${listErr.message}`;
                  console.error("[Eventory] list_tasks error:", listErr);
                } else {
                  // Truncate body preview to 200 chars
                  result = (taskRows || []).map((r) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description,
                    status: r.status,
                    priority: r.priority,
                    due_date: r.due_date,
                    agent_id: r.agent_id,
                    body: r.body ? r.body.slice(0, 200) + (r.body.length > 200 ? "…" : "") : "",
                  }));
                  resultSummary = `Found ${result.length} task(s)`;
                }
                break;
              }
              case "read_task": {
                // Use select("*") so the query is resilient to missing columns.
                const { data: taskRow, error: readErr } = await supabase
                  .from("tasks")
                  .select("*")
                  .eq("id", toolUse.input.taskId)
                  .maybeSingle();
                if (readErr) {
                  result = { error: readErr.message };
                  resultSummary = `read_task query failed: ${readErr.message}`;
                  console.error("[Eventory] read_task error:", readErr);
                } else if (!taskRow) {
                  result = { error: "Task not found" };
                  resultSummary = "Task not found";
                } else {
                  result = taskRow;
                  resultSummary = `Read task: "${taskRow.title}"`;
                }
                break;
              }
              case "write_task_body": {
                const { taskId, body } = toolUse.input;
                const { error: writeErr } = await supabase
                  .from("tasks")
                  .update({ body })
                  .eq("id", taskId);
                if (writeErr) {
                  result = { error: writeErr.message };
                  resultSummary = `Write failed: ${writeErr.message}`;
                } else {
                  result = { success: true };
                  resultSummary = `Saved ${String(body).length} characters to task document`;
                  sendToRenderer("task:body-updated", { taskId, body });
                }
                break;
              }
              case "update_task_status": {
                const { taskId, status } = toolUse.input;
                const { error: statusErr } = await supabase
                  .from("tasks")
                  .update({ status })
                  .eq("id", taskId);
                if (statusErr) {
                  result = { error: statusErr.message };
                  resultSummary = `Status update failed: ${statusErr.message}`;
                } else {
                  result = { success: true };
                  resultSummary = `Task status updated to "${status}"`;
                  sendToRenderer("task:status-updated", { taskId, status });
                }
                break;
              }
              case "read_event_details": {
                if (!eventUuid) {
                  result = { error: "No event ID provided" };
                  resultSummary = "No event ID";
                } else {
                  const { data: evtRow } = await supabase
                    .from("events")
                    .select("*")
                    .eq("id", eventUuid)
                    .single();
                  result = evtRow || { error: "Event not found" };
                  resultSummary = evtRow ? `Read event: "${evtRow.name}"` : "Event not found";
                }
                break;
              }
              case "update_event_details": {
                if (!eventUuid) {
                  result = { error: "No event ID provided" };
                  resultSummary = "No event ID";
                } else {
                  const updates = {};
                  const inp = toolUse.input;
                  if (inp.eventDate !== undefined) updates.event_date = inp.eventDate || null;
                  if (inp.startTime !== undefined) updates.start_time = inp.startTime || null;
                  if (inp.endTime !== undefined) updates.end_time = inp.endTime || null;
                  if (inp.venuePref !== undefined) updates.venue_pref = inp.venuePref || null;
                  if (inp.guestCount !== undefined) updates.guest_count = inp.guestCount || null;
                  if (inp.notes !== undefined) updates.notes = inp.notes || null;
                  const { error: evtErr } = await supabase
                    .from("events")
                    .update(updates)
                    .eq("id", eventUuid);
                  if (evtErr) {
                    result = { error: evtErr.message };
                    resultSummary = `Event update failed: ${evtErr.message}`;
                  } else {
                    result = { success: true, updatedFields: Object.keys(updates) };
                    resultSummary = `Updated event fields: ${Object.keys(updates).join(", ")}`;
                    // Notify the renderer so it can update formData without a full reload
                    sendToRenderer("event:details-updated", { evtId, updates: inp });
                  }
                }
                break;
              }
              default:
                result = { error: `Unknown tool: ${toolUse.name}` };
                resultSummary = `Unknown tool: ${toolUse.name}`;
            }
          } catch (toolErr) {
            result = { error: toolErr.message };
            resultSummary = `Error: ${toolErr.message}`;
            console.error(`[Eventropy] Tool ${toolUse.name} error:`, toolErr);
          }

          toolTurns.push({ toolName: toolUse.name, toolInput: toolUse.input, resultSummary });
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        // Append tool results as a user message (Claude API convention)
        claudeMessages.push({ role: "user", content: toolResultContents });

        // If stop_reason is "end_turn" there are no more tool_use blocks pending
        if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
          finalContent = textContent;
          break;
        }
      }

      console.log(
        `[Eventropy] Category chat: ${toolTurns.length} tool turn(s), reply length ${finalContent.length}`
      );
      return { content: finalContent, toolTurns };
    } catch (err) {
      console.error("[Eventropy] Category chat error:", err);
      return { error: err?.message ?? String(err) };
    }
  });

  // ── Orchestrator: Plan Event ───────────────────────────────────────────
  ipcMain.handle("orchestrator:plan", async (_event, eventId, formData) => {
    console.log("[Eventropy] Plan event requested for", eventId, formData?.eventReason || "Untitled");
    if (!hasClaudeKey()) {
      console.warn("[Eventropy] ANTHROPIC_API_KEY not set.");
      return { error: "ANTHROPIC_API_KEY not configured.", tasks: [] };
    }

    try {
      const tasks = await planEventTasks(formData);
      console.log("[Eventropy] Plan event returned", tasks?.length ?? 0, "tasks");
      return { success: true, tasks };
    } catch (err) {
      console.error("[Eventropy] Plan event error:", err);
      return { error: err.message, tasks: [] };
    }
  });

  // ── Orchestrator: Task Messages ────────────────────────────────────────
  ipcMain.handle("orchestrator:task-messages", async (_event, taskId) => {
    const supabase = createSupabaseClient();
    if (!supabase) return { messages: [] };

    const { data, error } = await supabase
      .from("orchestrator_messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch task messages error:", error);
      return { messages: [] };
    }

    return {
      messages: (data || []).map((row) => ({
        id: row.id,
        runId: row.run_id,
        taskId: row.task_id,
        role: row.role,
        content: row.content,
        toolName: row.tool_name,
        toolInput: row.tool_input,
        toolResult: row.tool_result,
        createdAt: row.created_at,
      })),
    };
  });

  // ── Notifications ──────────────────────────────────────────────────────
  ipcMain.handle("notifications:get", async (_event, eventId) => {
    const supabase = createSupabaseClient();
    if (!supabase) return { notifications: [] };

    const { data, error } = await supabase
      .from("orchestrator_notifications")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false });

    if (error) return { notifications: [] };

    return {
      notifications: (data || []).map((row) => ({
        id: row.id,
        eventId: row.event_id,
        taskId: row.task_id,
        runId: row.run_id,
        type: row.type,
        title: row.title,
        message: row.message,
        suggestions: row.suggestions,
        isRead: row.is_read,
        isResolved: row.is_resolved,
        resolvedResponse: row.resolved_response,
        createdAt: row.created_at,
      })),
    };
  });

  ipcMain.handle("notifications:mark-read", async (_event, notificationId) => {
    const supabase = createSupabaseClient();
    if (!supabase) return { error: "Supabase not configured." };

    await supabase
      .from("orchestrator_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    return { success: true };
  });

  // ── Connectors ─────────────────────────────────────────────────────────
  ipcMain.handle("connectors:statuses", async () => {
    const connectors = getAllConnectors();
    return {
      connectors: connectors.map((c) => ({
        connectorId: c.id,
        displayName: c.name,
        description: c.description || "",
        icon: c.icon || "",
        authType: c.authType || "api_key",
        configFields: c.configFields || [],
        isEnabled: c.enabled,
        isConnected: c.isConnected || false,
        lastTestedAt: c.lastTestedAt,
        lastTestOk: c.lastTestOk,
      })),
    };
  });

  ipcMain.handle("connectors:save-config", async (_event, _connectorId, _config) => {
    // Non-secret config is currently handled via save-secret for all field values
    return { success: true };
  });

  ipcMain.handle("connectors:save-secret", async (_event, connectorId, secretKey, secretValue) => {
    setSecret(connectorId, secretKey, secretValue);
    // Re-initialize the connector so the new secret takes effect immediately
    const connector = getConnector(connectorId);
    if (connector) {
      const secrets = loadSecretsForConnector(connector);
      await connector.initialize(secrets).catch((err) => {
        console.warn(`Connector ${connectorId} re-init after secret save failed:`, err.message);
      });
    }
    return { success: true };
  });

  ipcMain.handle("connectors:test", async (_event, connectorId) => {
    const connector = getConnector(connectorId);
    if (!connector) return { ok: false, error: "Connector not found." };
    try {
      return await connector.testConnection();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("connectors:toggle", async (_event, connectorId, enabled) => {
    const connector = getConnector(connectorId);
    if (!connector) return { error: "Connector not found." };
    connector.enabled = enabled;
    return { success: true };
  });

  ipcMain.handle("connectors:start-oauth", async (_event, connectorId) => {
    const connector = getConnector(connectorId);
    if (!connector) return { error: "Connector not found." };
    if (typeof connector.startOAuthFlow !== "function") {
      return { error: "This connector does not support OAuth." };
    }
    try {
      // startOAuthFlow opens the system browser and resolves with { refresh_token }
      const result = await connector.startOAuthFlow();
      if (result.refresh_token) {
        setSecret(connectorId, "refresh_token", result.refresh_token);
        // Re-initialize so the new token is active
        const secrets = loadSecretsForConnector(connector);
        await connector.initialize(secrets);
      }
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Event Files ────────────────────────────────────────────────────────

  /** files:list -> List all .txt files for an event. */
  ipcMain.handle("files:list", (_event, evtId) => {
    try {
      const dir = evtFilesDir(evtId);
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
        .map((e) => {
          const filePath = path.join(dir, e.name);
          const stat = fs.statSync(filePath);
          return {
            name: e.name,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      return { files };
    } catch {
      return { files: [] };
    }
  });

  /** files:read -> Read the content of a .txt file for an event. */
  ipcMain.handle("files:read", (_event, evtId, filename) => {
    try {
      const dir = evtFilesDir(evtId);
      const filePath = path.join(dir, path.basename(filename));
      const content = fs.readFileSync(filePath, "utf-8");
      return { content };
    } catch (err) {
      return { error: err.message };
    }
  });

  /** files:write -> Write or overwrite a .txt file for an event. */
  ipcMain.handle("files:write", (_event, evtId, filename, content) => {
    try {
      const safeName = path.basename(String(filename));
      const filePath = writeEvtFile(evtId, safeName, String(content));
      const stat = fs.statSync(filePath);
      return {
        success: true,
        name: safeName,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  /** files:delete -> Delete a .txt file for an event. */
  ipcMain.handle("files:delete", (_event, evtId, filename) => {
    try {
      const filePath = path.join(evtFilesDir(evtId), path.basename(filename));
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  /** files:open -> Open a file in the OS default text editor. */
  ipcMain.handle("files:open", async (_event, evtId, filename) => {
    const filePath = path.join(evtFilesDir(evtId), path.basename(filename));
    const errMsg = await shell.openPath(filePath);
    return errMsg ? { error: errMsg } : { success: true };
  });

  /** files:pick -> Open a native file picker and return the .txt file's content. */
  ipcMain.handle("files:pick", async () => {
    const result = await dialog.showOpenDialog(mainWin, {
      title: "Add a text file",
      properties: ["openFile"],
      filters: [{ name: "Text Files", extensions: ["txt"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true };
    const srcPath = result.filePaths[0];
    const filename = path.basename(srcPath);
    const content = fs.readFileSync(srcPath, "utf-8");
    return { filename, content };
  });
}

// ── Connector Initialization ──────────────────────────────────────────────────

/**
 * initConnectors -> Instantiate all connectors, register them with the tool
 * registry, and initialize each one with any saved credentials.
 */
async function initConnectors() {
  const connectorInstances = [
    new NotionConnector(),
    new GmailConnector(),
    new GoogleCalendarConnector(),
    new LumaConnector(),
  ];

  for (const connector of connectorInstances) {
    registerConnector(connector);
    const secrets = loadSecretsForConnector(connector);
    try {
      await connector.initialize(secrets);
    } catch (err) {
      // Non-fatal: connector simply won't be connected until secrets are saved
      console.warn(`Connector ${connector.id} init skipped:`, err.message);
    }
  }
}

/**
 * loadSecretsForConnector -> Retrieve all stored secrets for a connector.
 * Reads each configField key plus the oauth2 refresh_token if applicable.
 * @param {object} connector - A BaseConnector instance
 * @returns {Record<string, string>} Map of secretKey -> plaintext value
 */
function loadSecretsForConnector(connector) {
  const secrets = {};
  for (const field of connector.configFields || []) {
    const value = getSecret(connector.id, field.key);
    if (value) secrets[field.key] = value;
  }
  if (connector.authType === "oauth2") {
    const refreshToken = getSecret(connector.id, "refresh_token");
    if (refreshToken) secrets.refresh_token = refreshToken;
  }
  return secrets;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * sendToRenderer -> Send an IPC event to the renderer process.
 * @param {string} channel - IPC channel name
 * @param {any} data - Data to send
 */
function sendToRenderer(channel, data) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data);
  }
}

/**
 * evtFilesDir -> Resolved path to a per-event files directory.
 * Creates the directory if it does not exist.
 * @param {string} evtId - Event slug or UUID used as the folder name
 * @returns {string} Absolute directory path
 */
function evtFilesDir(evtId) {
  const dir = path.join(app.getPath("userData"), "eventory-files", String(evtId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * writeEvtFile -> Write content to a .txt file for an event.
 * Called by both the IPC handler and the orchestrator onWriteFile callback.
 * @param {string} evtId
 * @param {string} filename - Already-sanitized filename with .txt extension
 * @param {string} content
 */
function writeEvtFile(evtId, filename, content) {
  const filePath = path.join(evtFilesDir(evtId), filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/**
 * createSupabaseClient -> Create a Supabase client for the main process.
 * Uses the same env vars as the renderer.
 * @returns {object | null}
 */
function createSupabaseClient() {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      console.warn("Supabase env vars not set (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).");
      return null;
    }
    return createClient(url, key);
  } catch (err) {
    console.error("Failed to create Supabase client:", err);
    return null;
  }
}
