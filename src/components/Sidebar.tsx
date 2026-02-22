import { LayoutDashboard, Settings, Calendar, Clock } from "lucide-react";
import SidebarEventList from "./SidebarEventList";
import type { PlannerEvent, ActiveView, SidebarState, AccountSettings } from "../types";

/**
 * SidebarProps -> Derived from `Sidebar` + `Props`.
 */
interface SidebarProps {
  /** state -> Open or closed */
  state: SidebarState;
  /** events -> Full event registry for rendering sidebar entries */
  events: PlannerEvent[];
  /** activeView -> Current navigation state for active highlighting */
  activeView: ActiveView;
  /** accountSettings -> Current account settings */
  accountSettings: AccountSettings;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
  /** onClose -> Callback to close sidebar (overlay click) */
  onClose: () => void;
}

/**
 * Sidebar -> Collapsible overlay navigation panel.
 * Hidden by default (transform off-screen), slides in when state === "open".
 * Contains: brand, dashboard link, event list, calendar/timeline views, settings.
 */
export default function Sidebar({
  state,
  events,
  activeView,
  accountSettings,
  onNavigate,
  onClose,
}: SidebarProps) {
  const isOpen = state === "open";

  // Count overdue tasks
  const overdueTasksCount = events.reduce((count, event) => {
    if (!event.tasks) return count;
    const now = new Date();
    return (
      count +
      event.tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.dueDate &&
          new Date(task.dueDate) < now
      ).length
    );
  }, 0);

  // Count upcoming tasks (due in next 7 days)
  const upcomingTasksCount = events.reduce((count, event) => {
    if (!event.tasks) return count;
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return (
      count +
      event.tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.dueDate &&
          new Date(task.dueDate) >= now &&
          new Date(task.dueDate) <= weekFromNow
      ).length
    );
  }, 0);

  return (
    <>
      {/* Overlay — click to close */}
      <div
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay--visible" : ""}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/Eventrop.png" alt="Eventropy" className="sidebar-brand-logo" />
          <span className="sidebar-brand-name font-header">EVENTROPY</span>
        </div>

        {/* Account type indicator */}
        <div className="sidebar-account-indicator">
          <span className="account-badge">
            {accountSettings.currentAccount === "personal" ? "Personal" : "Organization"}
          </span>
        </div>

        {/* Dashboard nav */}
        <div
          className={`nav-item ${activeView.kind === "dashboard" ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "dashboard" })}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </div>

        {/* Calendar View */}
        <div
          className={`nav-item ${activeView.kind === "calendar" ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "calendar" })}
        >
          <Calendar size={18} />
          <span>Calendar View</span>
        </div>

        {/* Timeline View */}
        <div
          className={`nav-item ${activeView.kind === "timeline" ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "timeline" })}
        >
          <Clock size={18} />
          <span>Timeline View</span>
          {(overdueTasksCount > 0 || upcomingTasksCount > 0) && (
            <span className="nav-item-count">{overdueTasksCount + upcomingTasksCount}</span>
          )}
        </div>

        {/* Dynamic event entries */}
        <SidebarEventList
          events={events}
          activeView={activeView}
          onNavigate={onNavigate}
        />

        <div style={{ flex: 1 }} />

        {/* Settings */}
        <div
          className={`nav-item ${activeView.kind === "settings" ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "settings" })}
        >
          <Settings size={18} />
          <span>Settings</span>
        </div>
      </div>
    </>
  );
}
