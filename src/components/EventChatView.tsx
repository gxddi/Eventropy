import { useState, useEffect } from "react";
import { ArrowLeft, List, FileText } from "lucide-react";
import TaskManager from "./TaskManager";
import EventOverview from "./EventOverview";
import type { PlannerEvent, ActiveView, AccountSettings } from "../types";

/**
 * EventChatViewProps -> Derived from `Event` + `Chat` + `View` + `Props`.
 */
interface EventChatViewProps {
  /** event -> The PlannerEvent whose chat is being viewed */
  event: PlannerEvent;
  /** allEvents -> All events in the registry, for resolving linked event IDs */
  allEvents?: PlannerEvent[];
  /** accountSettings -> Current account settings */
  accountSettings?: AccountSettings;
  /** onNavigate -> Navigation callback (agent sub-tab, etc.) */
  onNavigate: (view: ActiveView) => void;
  /** onNavigateBack -> Go back to previous view (dashboard, calendar, or timeline); used for back button */
  onNavigateBack?: () => void;
  /** onUpdateEvent -> Callback to update the event */
  onUpdateEvent?: (updates: Partial<PlannerEvent>) => void;
  /** onDeleteEvent -> Callback to delete the event (navigate away after delete) */
  onDeleteEvent?: () => void;
  /** taskSyncInProgress -> True while tasks are syncing; disables toggle/delete to prevent duplicates */
  taskSyncInProgress?: boolean;
  /** initialViewMode -> Open directly to Details or Tasks when navigating from dashboard cards */
  initialViewMode?: "tasks" | "details";
}

type ViewMode = "tasks" | "details";

/**
 * EventChatView -> View switcher between detailed view and tasks view.
 */
export default function EventChatView({
  event,
  allEvents,
  accountSettings,
  onNavigate,
  onNavigateBack,
  onUpdateEvent,
  onDeleteEvent,
  taskSyncInProgress,
  initialViewMode,
}: EventChatViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? "tasks");
  const [isOverviewEditing, setIsOverviewEditing] = useState(false);

  useEffect(() => {
    if (initialViewMode) setViewMode(initialViewMode);
  }, [initialViewMode]);

  // fd -> shorthand alias for event.formData
  const fd = event.formData;

  // evtSummary -> Derived from `event` (evt) + `Summary` (condensed label)
  const startTime = fd.startTime || "?";
  const endTime = fd.endTime || "?";
  const evtSummary = `${fd.guestCount || "?"} guests · ${startTime}-${endTime} · ${fd.eventDate || "No date"}`;

  return (
    <div className="event-chat-view event-page">
      {/* Header — same position/structure as agent category chat */}
      <div className="event-chat-header">
        <button
          className="agent-detail-back"
          onClick={() => (onNavigateBack ? onNavigateBack() : onNavigate({ kind: "dashboard" }))}
        >
          <ArrowLeft size={18} />
        </button>
        <h2>{fd.eventReason || "Untitled Event"}</h2>
        <span className="agents-event-summary">{evtSummary}</span>
      </div>

      {/* View Mode Toggle — hidden when editing event details so the header stays clean */}
      {!isOverviewEditing && (
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === "details" ? "active" : ""}`}
            onClick={() => setViewMode("details")}
          >
            <FileText size={16} />
            <span>Detailed View</span>
          </button>
          <button
            className={`view-mode-btn ${viewMode === "tasks" ? "active" : ""}`}
            onClick={() => setViewMode("tasks")}
          >
            <List size={16} />
            <span>Task List</span>
          </button>
        </div>
      )}

      {/* Content */}
      {viewMode === "details" ? (
        <EventOverview
          event={event}
          allEvents={allEvents}
          onUpdateEvent={onUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          onEditingChange={setIsOverviewEditing}
        />
      ) : accountSettings && onUpdateEvent ? (
        <TaskManager
          event={event}
          accountSettings={accountSettings}
          onNavigate={onNavigate}
          onUpdateEvent={onUpdateEvent}
          taskSyncInProgress={taskSyncInProgress}
        />
      ) : (
        <div className="task-manager-placeholder">
          <p>Loading task manager...</p>
        </div>
      )}
    </div>
  );
}
