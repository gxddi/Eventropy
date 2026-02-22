import Dashboard from "./Dashboard";
import EventChatView from "./EventChatView";
import AgentSubTab from "./AgentSubTab";
import AgentCategoryChatView from "./AgentCategoryChatView";
import TaskDetailView from "./TaskDetailView";
import Settings from "./Settings";
import CalendarView from "./CalendarView";
import TimelineView from "./TimelineView";
import type {
  ActiveView,
  PlannerEvent,
  EventFormData,
  AccountSettings,
} from "../types";

/**
 * MainContentProps -> Derived from `Main` + `Content` + `Props`.
 */
interface MainContentProps {
  /** activeView -> Discriminated union controlling which component renders */
  activeView: ActiveView;
  /** eventRegistry -> All events (mock past + user-created) */
  eventRegistry: PlannerEvent[];
  /** accountSettings -> Current account settings */
  accountSettings: AccountSettings;
  /** onEventCreate -> Callback with form data when a new event is created */
  onEventCreate: (data: EventFormData) => void;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
  /** onNavigateBack -> Go back to the view we were on before opening the event (dashboard/calendar/timeline) */
  onNavigateBack?: () => void;
  /** onUpdateEvent -> Callback to update an event */
  onUpdateEvent: (evtId: string, updates: Partial<PlannerEvent>) => void;
  /** onDeleteEvent -> Callback to delete an event and navigate away */
  onDeleteEvent: (evtId: string) => void;
  /** taskSyncInProgress -> True while tasks are syncing to DB; disables toggle/delete to prevent duplicates */
  taskSyncInProgress?: boolean;
  /** onUpdateSettings -> Callback to update account settings */
  onUpdateSettings: (settings: AccountSettings) => void;
}

/**
 * MainContent -> View router that switches on activeView.kind.
 * Renders the appropriate view component for the current navigation state.
 */
export default function MainContent({
  activeView,
  eventRegistry,
  accountSettings,
  onEventCreate,
  onNavigate,
  onNavigateBack,
  onUpdateEvent,
  onDeleteEvent,
  taskSyncInProgress,
  onUpdateSettings,
}: MainContentProps) {
  // renderView -> Derived from `render` (produce JSX) + `View` (active panel)
  const renderView = () => {
    switch (activeView.kind) {
      case "dashboard":
        return (
          <Dashboard
            pastEvents={eventRegistry}
            accountSettings={accountSettings}
            onSubmit={onEventCreate}
            onNavigate={onNavigate}
            onUpdateEvent={onUpdateEvent}
          />
        );

      case "event-chat": {
        const targetEvt = eventRegistry.find((e) => e.evtId === activeView.evtId);
        if (!targetEvt) return <div>Event not found.</div>;
        return (
          <EventChatView
            event={targetEvt}
            allEvents={eventRegistry}
            accountSettings={accountSettings}
            onNavigate={onNavigate}
            onNavigateBack={onNavigateBack}
            onUpdateEvent={(updates) => onUpdateEvent(activeView.evtId, updates)}
            onDeleteEvent={() => onDeleteEvent(activeView.evtId)}
            taskSyncInProgress={taskSyncInProgress}
            initialViewMode={activeView.initialViewMode}
          />
        );
      }

      case "agent-detail": {
        const targetEvt = eventRegistry.find((e) => e.evtId === activeView.evtId);
        if (!targetEvt) return <div>Event not found.</div>;
        return (
          <AgentSubTab
            agentId={activeView.agentId}
            event={targetEvt}
            onBack={() => onNavigate({ kind: "event-chat", evtId: activeView.evtId })}
          />
        );
      }

      case "agent-category-chat": {
        const targetEvt = eventRegistry.find((e) => e.evtId === activeView.evtId);
        if (!targetEvt) return <div>Event not found.</div>;
        return (
          <AgentCategoryChatView
            event={targetEvt}
            agentId={activeView.agentId}
            onNavigate={onNavigate}
            onUpdateEvent={(updates) => onUpdateEvent(activeView.evtId, updates)}
          />
        );
      }

      case "task-detail": {
        const targetEvt = eventRegistry.find((e) => e.evtId === activeView.evtId);
        if (!targetEvt) return <div>Event not found.</div>;
        const targetTask = targetEvt.tasks?.find((t) => t.id === activeView.taskId);
        if (!targetTask) return <div>Task not found.</div>;
        return (
          <TaskDetailView
            task={targetTask}
            event={targetEvt}
            onNavigate={onNavigate}
            onUpdateTask={(taskId, updates) => {
              const updatedTasks = targetEvt.tasks?.map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
              );
              onUpdateEvent(activeView.evtId, { tasks: updatedTasks });
            }}
          />
        );
      }

      case "settings":
        return (
          <Settings
            settings={accountSettings}
            onUpdate={onUpdateSettings}
            onNavigate={onNavigate}
          />
        );

      case "calendar":
        return (
          <CalendarView
            events={eventRegistry}
            onNavigate={onNavigate}
          />
        );

      case "timeline":
        return (
          <TimelineView
            events={eventRegistry}
            eventId={activeView.evtId}
            onNavigate={onNavigate}
          />
        );

      default:
        return null;
    }
  };

  return <div className="main-content">{renderView()}</div>;
}
