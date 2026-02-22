/**
 * electronBridge.ts -> Typed IPC API for the renderer process.
 * Wraps window.electronAPI with TypeScript types.
 * Falls back gracefully when running outside Electron (e.g., in a browser).
 */

import type {
  OrchestratorMessage,
  ConnectorStatus,
  EventFormData,
  ChatToolTurn,
} from "../types";

// ── Type declaration for the global electronAPI exposed by preload.cjs ──────

interface ElectronOrchestratorAPI {
  planEvent(eventId: string, formData: EventFormData): Promise<{ success?: boolean; error?: string; tasks: PlanTaskResult[] }>;
  categoryChat(payload: CategoryChatPayload): Promise<CategoryChatResult>;
  updateTaskBody(taskId: string, body: string): Promise<{ success?: boolean; error?: string }>;
  getTaskMessages(taskId: string): Promise<{ messages: OrchestratorMessage[] }>;
  getNotifications(eventId: string): Promise<{ notifications: OrchestratorNotification[] }>;
  markNotificationRead(notificationId: string): Promise<{ success?: boolean }>;
  getConnectorStatuses(): Promise<{ connectors: ConnectorStatus[] }>;
  saveConnectorConfig(connectorId: string, config: Record<string, unknown>): Promise<{ success?: boolean }>;
  saveConnectorSecret(connectorId: string, secretKey: string, secretValue: string): Promise<{ success?: boolean }>;
  testConnector(connectorId: string): Promise<{ ok: boolean; error?: string }>;
  toggleConnector(connectorId: string, enabled: boolean): Promise<{ success?: boolean }>;
  startOAuth(connectorId: string): Promise<{ success?: boolean; error?: string }>;
  onTaskBodyUpdated(callback: (data: { taskId: string; body: string }) => void): () => void;
  onTaskStatusUpdated(callback: (data: { taskId: string; status: string }) => void): () => void;
  onChatMessage(callback: (message: OrchestratorChatEvent) => void): () => void;
  onEventDetailsUpdated(callback: (data: { evtId: string; updates: Record<string, string | undefined> }) => void): () => void;
}

/** CategoryChatPayload -> Event + task context for category agent chat. */
export interface CategoryChatPayload {
  /** evtId -> Event slug or UUID so the backend can resolve and query tasks */
  evtId: string;
  agentId: string;
  eventContext: Record<string, unknown>;
  tasksForCategory: Array<{ id: string; title: string; description?: string; status: string }>;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/** CategoryChatResult -> Return shape from the category-chat IPC handler. */
export interface CategoryChatResult {
  /** content -> Final assistant text response */
  content?: string;
  /** toolTurns -> Ordered list of tool calls the AI made during this response */
  toolTurns?: ChatToolTurn[];
  error?: string;
}

/** PlanTaskResult -> Shape of a task returned from the AI planning call. */
export interface PlanTaskResult {
  title: string;
  description: string;
  priority: number;
  agentId: string;
  dependencies: number[];
  /** YYYY-MM-DD, must be before event date when event has a date */
  dueDate?: string;
}

/** OrchestratorChatEvent -> Real-time chat event from the orchestrator. */
export interface OrchestratorChatEvent {
  taskId: string;
  eventId: string;
  role: string;
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  createdAt: string;
}

/** OrchestratorNotification -> Human-in-the-loop prompt (legacy, kept for warm-restart). */
export interface OrchestratorNotification {
  id: string;
  eventId: string;
  taskId?: string;
  runId?: string;
  type: string;
  title: string;
  message: string;
  suggestions?: string[];
  isRead: boolean;
  isResolved: boolean;
  resolvedResponse?: string;
  createdAt: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronOrchestratorAPI;
  }
}

// ── Bridge Functions ────────────────────────────────────────────────────────

/**
 * isElectron -> Check if the app is running inside Electron with the IPC bridge.
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

/**
 * planEvent -> One-shot AI task breakdown for a new event.
 */
export async function planEvent(
  eventId: string,
  formData: EventFormData
): Promise<{ success?: boolean; error?: string; tasks: PlanTaskResult[] }> {
  if (!isElectron()) return { error: "Not running in Electron.", tasks: [] };
  return window.electronAPI!.planEvent(eventId, formData);
}

/**
 * categoryChat -> Chat with the category agent using task read/write tools.
 * The agent can list tasks, read task bodies, write to task bodies, and update statuses.
 */
export async function categoryChat(
  payload: CategoryChatPayload
): Promise<CategoryChatResult> {
  if (!isElectron()) return { error: "Not running in Electron." };
  return window.electronAPI!.categoryChat(payload);
}

/**
 * updateTaskBody -> Update the task document body from the renderer.
 * Called when the user edits the task document textarea (debounced).
 */
export async function updateTaskBody(
  taskId: string,
  body: string
): Promise<void> {
  if (!isElectron()) return;
  await window.electronAPI!.updateTaskBody(taskId, body);
}

/**
 * getTaskMessages -> Fetch AI tool-use messages for a specific task.
 */
export async function getTaskMessages(
  taskId: string
): Promise<OrchestratorMessage[]> {
  if (!isElectron()) return [];
  const result = await window.electronAPI!.getTaskMessages(taskId);
  return result.messages;
}

/**
 * getNotifications -> Fetch all unresolved notifications for an event.
 */
export async function getNotifications(
  eventId: string
): Promise<OrchestratorNotification[]> {
  if (!isElectron()) return [];
  const result = await window.electronAPI!.getNotifications(eventId);
  return result.notifications;
}

/**
 * markNotificationRead -> Mark a notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isElectron()) return;
  await window.electronAPI!.markNotificationRead(notificationId);
}

/**
 * getConnectorStatuses -> Get status of all connectors.
 */
export async function getConnectorStatuses(): Promise<ConnectorStatus[]> {
  if (!isElectron()) return [];
  const result = await window.electronAPI!.getConnectorStatuses();
  return result.connectors;
}

/**
 * saveConnectorConfig -> Save connector configuration.
 */
export async function saveConnectorConfig(
  connectorId: string,
  config: Record<string, unknown>
): Promise<void> {
  if (!isElectron()) return;
  await window.electronAPI!.saveConnectorConfig(connectorId, config);
}

/**
 * saveConnectorSecret -> Save a secret for a connector.
 */
export async function saveConnectorSecret(
  connectorId: string,
  secretKey: string,
  secretValue: string
): Promise<void> {
  if (!isElectron()) return;
  await window.electronAPI!.saveConnectorSecret(connectorId, secretKey, secretValue);
}

/**
 * testConnector -> Test a connector's connection.
 */
export async function testConnector(
  connectorId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isElectron()) return { ok: false, error: "Not running in Electron." };
  return window.electronAPI!.testConnector(connectorId);
}

/**
 * toggleConnector -> Enable or disable a connector.
 */
export async function toggleConnector(
  connectorId: string,
  enabled: boolean
): Promise<void> {
  if (!isElectron()) return;
  await window.electronAPI!.toggleConnector(connectorId, enabled);
}

/**
 * startOAuth -> Initiate OAuth2 flow for a connector.
 */
export async function startOAuth(
  connectorId: string
): Promise<{ success?: boolean; error?: string }> {
  if (!isElectron()) return { error: "Not running in Electron." };
  return window.electronAPI!.startOAuth(connectorId);
}

// ── Event Listeners ─────────────────────────────────────────────────────────

/**
 * onTaskBodyUpdated -> Subscribe to task body updates pushed by the AI.
 * Fires when the category-chat agent calls write_task_body.
 * Returns an unsubscribe function.
 */
export function onTaskBodyUpdated(
  callback: (data: { taskId: string; body: string }) => void
): () => void {
  if (!isElectron()) return () => {};
  return window.electronAPI!.onTaskBodyUpdated(callback);
}

/**
 * onTaskStatusUpdated -> Subscribe to task status changes pushed by the AI.
 * Fires when the category-chat agent calls update_task_status.
 * Returns an unsubscribe function.
 */
export function onTaskStatusUpdated(
  callback: (data: { taskId: string; status: string }) => void
): () => void {
  if (!isElectron()) return () => {};
  return window.electronAPI!.onTaskStatusUpdated(callback);
}

/**
 * onChatMessage -> Subscribe to real-time orchestrator chat messages.
 * Returns an unsubscribe function.
 */
export function onChatMessage(
  callback: (message: OrchestratorChatEvent) => void
): () => void {
  if (!isElectron()) return () => {};
  return window.electronAPI!.onChatMessage(callback);
}

/**
 * onEventDetailsUpdated -> Subscribe to event detail changes pushed by the AI.
 * Fires when the category-chat agent calls update_event_details.
 * Returns an unsubscribe function.
 */
export function onEventDetailsUpdated(
  callback: (data: { evtId: string; updates: Record<string, string | undefined> }) => void
): () => void {
  if (!isElectron()) return () => {};
  return window.electronAPI!.onEventDetailsUpdated(callback);
}
