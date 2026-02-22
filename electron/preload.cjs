/**
 * preload.cjs -> Electron preload script.
 * Exposes a typed IPC bridge to the renderer via contextBridge.
 * The renderer accesses this as `window.electronAPI`.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Orchestrator: Plan (one-shot task breakdown at event creation) ─────────
  /** planEvent -> One-shot AI task breakdown for a new event. */
  planEvent: (eventId, formData) =>
    ipcRenderer.invoke("orchestrator:plan", eventId, formData),

  // ── Category Chat (tool-use AI chat for each agent group) ─────────────────
  /** categoryChat -> Chat with category agent using task read/write tools. */
  categoryChat: (payload) =>
    ipcRenderer.invoke("orchestrator:category-chat", payload),

  // ── Task Body (collaborative document) ────────────────────────────────────
  /** updateTaskBody -> Write the task document body from the renderer. */
  updateTaskBody: (taskId, body) =>
    ipcRenderer.invoke("task:update-body", { taskId, body }),

  // ── Orchestrator Messages ─────────────────────────────────────────────────
  /** getTaskMessages -> Fetch AI tool-use messages for a specific task. */
  getTaskMessages: (taskId) =>
    ipcRenderer.invoke("orchestrator:task-messages", taskId),

  // ── Notifications ─────────────────────────────────────────────────────────
  /** getNotifications -> Fetch all unresolved notifications for an event. */
  getNotifications: (eventId) =>
    ipcRenderer.invoke("notifications:get", eventId),

  /** markNotificationRead -> Mark a notification as read. */
  markNotificationRead: (notificationId) =>
    ipcRenderer.invoke("notifications:mark-read", notificationId),

  // ── Connector Management ──────────────────────────────────────────────────
  /** getConnectorStatuses -> Get status of all connectors. */
  getConnectorStatuses: () =>
    ipcRenderer.invoke("connectors:statuses"),

  /** saveConnectorConfig -> Save connector configuration (non-secret). */
  saveConnectorConfig: (connectorId, config) =>
    ipcRenderer.invoke("connectors:save-config", connectorId, config),

  /** saveConnectorSecret -> Save a secret (API key / token) for a connector. */
  saveConnectorSecret: (connectorId, secretKey, secretValue) =>
    ipcRenderer.invoke("connectors:save-secret", connectorId, secretKey, secretValue),

  /** testConnector -> Test a connector's connection. */
  testConnector: (connectorId) =>
    ipcRenderer.invoke("connectors:test", connectorId),

  /** toggleConnector -> Enable or disable a connector. */
  toggleConnector: (connectorId, enabled) =>
    ipcRenderer.invoke("connectors:toggle", connectorId, enabled),

  /** startOAuth -> Initiate OAuth2 flow for a connector (Gmail, Calendar). */
  startOAuth: (connectorId) =>
    ipcRenderer.invoke("connectors:start-oauth", connectorId),

  // ── Real-time Push Events (main → renderer) ───────────────────────────────
  /** onTaskBodyUpdated -> Fired when the AI writes to a task's body document. */
  onTaskBodyUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("task:body-updated", handler);
    return () => ipcRenderer.removeListener("task:body-updated", handler);
  },

  /** onTaskStatusUpdated -> Fired when the AI updates a task's status. */
  onTaskStatusUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("task:status-updated", handler);
    return () => ipcRenderer.removeListener("task:status-updated", handler);
  },

  /** onChatMessage -> Listen for real-time AI chat messages (task detail log). */
  onChatMessage: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on("orchestrator:chat-message", handler);
    return () => ipcRenderer.removeListener("orchestrator:chat-message", handler);
  },

  /** onEventDetailsUpdated -> Fired when the AI uses update_event_details tool. */
  onEventDetailsUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("event:details-updated", handler);
    return () => ipcRenderer.removeListener("event:details-updated", handler);
  },
});
