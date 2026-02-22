import { CalendarDays } from "lucide-react";
import type { PlannerEvent, ActiveView } from "../types";

/**
 * SidebarEventListProps -> Derived from `Sidebar` + `Event` + `List` + `Props`.
 */
interface SidebarEventListProps {
  /** events -> Full event registry for rendering sidebar entries */
  events: PlannerEvent[];
  /** activeView -> Current nav state for active highlighting */
  activeView: ActiveView;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
}

/**
 * SidebarEventList -> Dynamic list of event entries inside the sidebar.
 * Each entry shows event name and date. Active event is highlighted.
 */
export default function SidebarEventList({ events, activeView, onNavigate }: SidebarEventListProps) {
  if (events.length === 0) return null;

  // isActive -> Derived from `is` (predicate) + `Active` (current selection match)
  const isActive = (evtId: string): boolean => {
    if (activeView.kind === "event-chat" && activeView.evtId === evtId) return true;
    if (activeView.kind === "agent-detail" && activeView.evtId === evtId) return true;
    return false;
  };

  return (
    <div className="sidebar-event-list">
      <div className="sidebar-section-label">Your Events</div>
      {events.map((evt) => (
        <div
          key={evt.evtId}
          className={`sidebar-event-item ${isActive(evt.evtId) ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId })}
        >
          <span className="sidebar-event-name">
            <CalendarDays size={13} style={{ marginRight: 6, opacity: 0.5 }} />
            {evt.formData.eventReason || "Untitled Event"}
          </span>
          <span className="sidebar-event-date">{evt.formData.eventDate || "No date"}</span>
        </div>
      ))}
    </div>
  );
}
