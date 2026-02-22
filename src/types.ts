import type { LucideIcon } from "lucide-react";

/**
 * AccountType -> Derived from `Account` + `Type` (personal vs organization).
 */
export type AccountType = "personal" | "organization";

/**
 * EventStatus -> Derived from `Event` + `Status` (planning state).
 */
export type EventStatus = "on-track" | "at-risk" | "complete" | "planning";

/** Consistent status labels for dashboard + timeline (uppercase, hyphen → space). */
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  planning: "PLANNING",
  "on-track": "ON TRACK",
  "at-risk": "AT RISK",
  complete: "COMPLETE",
};

/**
 * TaskStatus -> Derived from `Task` + `Status` (completion state).
 */
export type TaskStatus = "todo" | "in-progress" | "done" | "blocked";

/**
 * AgentId -> Derived from `Agent` (AI worker) + `Id` (identifier).
 * Union literal of the 4 canonical agent slugs.
 */
export type AgentId =
  | "guests"
  | "venue-catering"
  | "entertainment-logistics"
  | "general";

/**
 * AgentStatus -> Derived from `Agent` + `Status` (operational state).
 */
export type AgentStatus = "working" | "alert" | "done";

/**
 * AgentDef -> Derived from `Agent` + `Definition` (configuration object).
 * Static metadata for a single AI agent.
 */
export interface AgentDef {
  id: AgentId;
  name: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  status: AgentStatus;
  statusText: string;
  hasAlert: boolean;
}

/**
 * MessageRole -> Derived from `Message` + `Role` (sender classification).
 */
export type MessageRole = "agent" | "user" | "system";

/**
 * ChatMessage -> Derived from `Chat` (conversation) + `Message` (single entry).
 * One message in the unified timeline or agent sub-tab.
 */
export interface ChatMessage {
  /** msgId -> `message` (msg) + `Id` (unique identifier) */
  msgId: string;
  /** agentId -> Which agent authored this message */
  agentId: AgentId;
  /** role -> Sender classification */
  role: MessageRole;
  /** content -> Message text */
  content: string;
  /** timestamp -> ISO 8601 string for ordering */
  timestamp: string;
}

/**
 * FoodDrinkOption -> Derived from `Food` + `Drink` + `Option` (catering selection).
 */
export type FoodDrinkOption =
  | "full-catering"
  | "light-bites"
  | "drinks-only"
  | "byob"
  | "none";

/**
 * Collaborator -> Derived from `Collaborator` (team member).
 */
export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role?: string;
}

/**
 * Document -> Derived from `Document` (uploaded file or link).
 */
export interface Document {
  id: string;
  type: "file" | "link";
  name: string;
  url: string;
  uploadedAt: string;
  category?: "vendor" | "budget" | "other";
}

/**
 * Subtask -> Derived from `Subtask` (nested task item).
 */
export interface Subtask {
  id: string;
  title: string;
  status: TaskStatus;
  completedAt?: string;
}

/**
 * Task -> Derived from `Task` (action item).
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number; // 0 = low, 1 = medium, 2 = high
  dueDate?: string;
  assignedTo?: string; // Collaborator ID or "ai-agent"
  dependencies: string[]; // Array of task IDs
  blockers: string[]; // Array of blocker task IDs
  subtasks?: Subtask[]; // Array of subtasks
  createdAt: string;
  completedAt?: string;
  /** chatMessages -> Chat messages for AI-assigned tasks */
  chatMessages?: ChatMessage[];
  /** agentId -> Which agent category this task belongs to */
  agentId?: AgentId;
  /** aiProgressPct -> AI execution progress 0-100 */
  aiProgressPct?: number;
  /** aiProgressText -> Human-readable progress description */
  aiProgressText?: string;
  /** aiSummary -> Completion summary from the AI */
  aiSummary?: string;
  /** body -> Collaborative markdown document; both user and AI can read/write this */
  body?: string;
}

/**
 * EventGoals -> Derived from `Event` + `Goals` (success metrics).
 */
export interface EventGoals {
  attendanceTarget?: number;
  revenue?: number;
  communityGrowth?: string;
  brandAwareness?: string;
  other?: string;
}

/**
 * VenueLocation -> Derived from `Venue` + `Location` (map coordinates).
 */
export interface VenueLocation {
  address?: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
}

/**
 * EventFormData -> Derived from `Event` + `Form` (input group) + `Data` (payload).
 * Shape of the event creation form fields.
 */
export interface EventFormData {
  eventReason: string;
  eventDate: string; // Can be blank if TBD
  startTime: string;
  endTime: string;
  venuePref: string;
  venueLocation?: VenueLocation;
  guestCount: string;
  foodDrinks: FoodDrinkOption;
  goals?: EventGoals;
  budget?: number;
  budgetSpreadsheet?: Document;
  notes: string;
  linkedEventIds?: string[]; // IDs of related past events
  /** When true (default), AI will generate initial tasks for this event on plan */
  generateAiTasks?: boolean;
}

/**
 * PlannerEvent -> Derived from `Planner` (app context) + `Event` (planned gathering).
 * Named "PlannerEvent" to avoid collision with the DOM Event type.
 */
export interface PlannerEvent {
  /** evtId -> `event` (evt) + `Id` (unique identifier) */
  evtId: string;
  /** formData -> The original form submission data */
  formData: EventFormData;
  /** status -> Current event status */
  status: EventStatus;
  /** createdAt -> ISO 8601 timestamp of creation */
  createdAt: string;
  /** chatTimeline -> Ordered array of all agent messages for this event */
  chatTimeline: ChatMessage[];
  /** tasks -> Array of tasks for this event */
  tasks?: Task[];
  /** documents -> Array of uploaded documents and links */
  documents?: Document[];
  /** collaborators -> Array of collaborators (for organization accounts) */
  collaborators?: Collaborator[];
  /** accountType -> Personal or organization */
  accountType?: AccountType;
  /** retroCreated -> Whether retro has been created for past events */
  retroCreated?: boolean;
}

/**
 * ActiveView -> Derived from `Active` (current) + `View` (rendered panel).
 * Discriminated union of all navigable view states.
 */
export type ActiveView =
  | { kind: "dashboard" }
  | { kind: "event-chat"; evtId: string; initialViewMode?: "tasks" | "details" }
  | { kind: "agent-detail"; evtId: string; agentId: AgentId }
  | { kind: "agent-category-chat"; evtId: string; agentId: AgentId }
  | { kind: "task-detail"; evtId: string; taskId: string }
  | { kind: "settings" }
  | { kind: "calendar" }
  | { kind: "timeline"; evtId?: string };

/**
 * SidebarState -> Derived from `Sidebar` + `State` (open/closed).
 */
export type SidebarState = "open" | "closed";

/**
 * AccountSettings -> Derived from `Account` + `Settings` (user preferences).
 */
export interface AccountSettings {
  currentAccount: AccountType;
  personalAccount: {
    name: string;
    email: string;
  };
  organizationAccount?: {
    name: string;
    email: string;
    collaborators: Collaborator[];
  };
}

// =============================================================================
// ORCHESTRATOR TYPES
// =============================================================================

/**
 * OrchestratorRunStatus -> Derived from `Orchestrator` + `Run` + `Status`.
 * Lifecycle state of a single orchestrator execution run.
 * Values match OrchestratorState in electron/orchestrator/types.cjs exactly.
 */
export type OrchestratorRunStatus =
  | "idle"
  | "planning"
  | "executing"
  | "waiting_for_user"
  | "completed"
  | "failed";

/**
 * OrchestratorRun -> Derived from `Orchestrator` + `Run`.
 * One execution session triggered by the Run button.
 */
export interface OrchestratorRun {
  id: string;
  eventId: string;
  status: OrchestratorRunStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

/**
 * OrchestratorMessageRole -> Role classification for orchestrator messages.
 */
export type OrchestratorMessageRole =
  | "assistant"
  | "user"
  | "tool_result"
  | "system";

/**
 * OrchestratorMessage -> Derived from `Orchestrator` + `Message`.
 * A single entry in the AI reasoning log for a task.
 */
export interface OrchestratorMessage {
  id: string;
  runId: string;
  taskId?: string;
  role: OrchestratorMessageRole;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  createdAt: string;
}

/**
 * NotificationType -> Derived from `Notification` + `Type`.
 */
export type NotificationType =
  | "input_needed"
  | "error"
  | "info"
  | "completion";

/**
 * OrchestratorNotification -> Derived from `Orchestrator` + `Notification`.
 * Human-in-the-loop prompt or status alert from the AI.
 */
export interface OrchestratorNotification {
  id: string;
  eventId: string;
  taskId?: string;
  runId?: string;
  type: NotificationType;
  title: string;
  message: string;
  suggestions?: string[];
  isRead: boolean;
  isResolved: boolean;
  resolvedResponse?: string;
  createdAt: string;
}

/**
 * ConnectorAuthType -> Authentication method for a connector.
 */
export type ConnectorAuthType = "api_key" | "oauth2";

/**
 * ConnectorConfigField -> Derived from `Connector` + `Config` + `Field`.
 * Schema for a single configuration field in the Settings UI.
 */
export interface ConnectorConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

/**
 * ConnectorStatus -> Derived from `Connector` + `Status`.
 * Renderer-side view of a connector's state.
 */
export interface ConnectorStatus {
  connectorId: string;
  displayName: string;
  description: string;
  icon: string;
  authType: ConnectorAuthType;
  configFields: ConnectorConfigField[];
  isEnabled: boolean;
  isConnected: boolean;
  lastTestedAt?: string;
  lastTestOk?: boolean;
}

/**
 * ChatToolTurn -> Derived from `Chat` + `Tool` + `Turn`.
 * Represents a single tool call + result within an agent chat response,
 * rendered as a collapsible pill in the AgentCategoryChatView.
 */
export interface ChatToolTurn {
  /** toolName -> Name of the tool Claude called */
  toolName: string;
  /** toolInput -> Arguments passed to the tool */
  toolInput: Record<string, unknown>;
  /** resultSummary -> Human-readable one-line summary of the result */
  resultSummary: string;
}

/**
 * TaskProgressUpdate -> Derived from `Task` + `Progress` + `Update`.
 * Real-time progress event emitted from the orchestrator via IPC.
 */
export interface TaskProgressUpdate {
  eventId: string;
  taskId: string;
  status: TaskStatus;
  progressPct: number;
  progressText: string;
  summary?: string;
}

/**
 * OrchestratorStatus -> Derived from `Orchestrator` + `Status`.
 * Aggregate status of the orchestrator for a given event + agent group.
 */
export interface OrchestratorStatus {
  eventId: string;
  /** agentId -> Which agent group this orchestrator belongs to. */
  agentId?: AgentId;
  runId?: string;
  runStatus: OrchestratorRunStatus;
  activeTaskId?: string;
  completedCount: number;
  totalCount: number;
  blockedCount: number;
}
