import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlannerEvent, ActiveView, Task } from "../types";

/**
 * CalendarViewProps -> Derived from `Calendar` + `View` + `Props`.
 */
interface CalendarViewProps {
  /** events -> All events to display */
  events: PlannerEvent[];
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
}

/**
 * CalendarView -> Calendar view showing events by date with countdown timers.
 */
export default function CalendarView({ events, onNavigate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Get events for this month
  const monthEvents = events.filter((event) => {
    if (!event.formData.eventDate) return false;
    const eventDate = new Date(event.formData.eventDate);
    return (
      eventDate.getFullYear() === year && eventDate.getMonth() === month
    );
  });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(
      new Date(year, month + (direction === "next" ? 1 : -1), 1)
    );
  };

  const getEventStatusColor = (event: PlannerEvent): string => {
    switch (event.status) {
      case "complete":
        return "var(--clr-txt-muted)";
      case "at-risk":
        return "var(--clr-alert)";
      case "on-track":
        return "var(--clr-success)";
      default:
        return "var(--clr-accent)";
    }
  };

  type DayItem =
    | { type: "event"; title: string; evtId: string; event: PlannerEvent }
    | { type: "task"; title: string; evtId: string; taskId: string; taskStatus: string; event: PlannerEvent };

  const getDayItems = (dateStr: string): DayItem[] => {
    const items: DayItem[] = [];
    // Events: only show on their event date
    monthEvents.forEach((event) => {
      if (event.formData.eventDate === dateStr) {
        items.push({
          type: "event",
          title: event.formData.eventReason || "Untitled Event",
          evtId: event.evtId,
          event,
        });
      }
    });
    // Tasks: check ALL events (task due dates can be in any month)
    events.forEach((event) => {
      (event.tasks || []).forEach((task: Task) => {
        if (task.dueDate === dateStr) {
          items.push({
            type: "task",
            title: task.title,
            evtId: event.evtId,
            taskId: task.id,
            taskStatus: task.status,
            event,
          });
        }
      });
    });
    return items;
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const getTaskStatusColor = (status: string): string => {
    switch (status) {
      case "done": return "var(--clr-success)";
      case "in-progress": return "var(--clr-accent)";
      case "blocked": return "var(--clr-alert)";
      default: return "var(--clr-txt-muted)";
    }
  };

  const MAX_VISIBLE = 2;

  const renderCalendarDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const items = getDayItems(dateStr);
    const visible = items.slice(0, MAX_VISIBLE);
    const restCount = items.length - MAX_VISIBLE;
    const isToday = dateStr === todayStr;

    return (
      <div key={day} className={`calendar-day ${isToday ? "calendar-day-today" : ""}`}>
        <div className="calendar-day-number">{day}</div>
        <div className="calendar-day-events">
          {visible.map((item) => {
            const isEvent = item.type === "event";
            const color = isEvent
              ? getEventStatusColor(item.event)
              : getTaskStatusColor(item.type === "task" ? item.taskStatus : "todo");
            return (
              <div
                key={isEvent ? item.evtId : item.type === "task" ? item.taskId : item.evtId}
                className={`calendar-event-row ${isEvent ? "calendar-row-event" : "calendar-row-task"}`}
                style={{ borderLeftColor: color }}
                onClick={() =>
                  isEvent
                    ? onNavigate({ kind: "event-chat", evtId: item.evtId, initialViewMode: "details" })
                    : onNavigate({ kind: "event-chat", evtId: item.evtId, initialViewMode: "tasks" })
                }
              >
                <span className="calendar-event-title" title={item.title}>
                  {item.title}
                </span>
              </div>
            );
          })}
          {restCount > 0 && (
            <div className="calendar-event-more">+{restCount}</div>
          )}
        </div>
      </div>
    );
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <button
          className="calendar-nav-btn"
          onClick={() => navigateMonth("prev")}
        >
          <ChevronLeft size={20} />
        </button>
        <h1>
          {monthNames[month]} {year}
        </h1>
        <button
          className="calendar-nav-btn"
          onClick={() => navigateMonth("next")}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-grid">
        {/* Day headers */}
        {dayNames.map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}

        {/* Empty cells for days before month starts */}
        {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} className="calendar-day empty" />
        ))}

        {/* Calendar days */}
        {Array.from({ length: daysInMonth }).map((_, idx) =>
          renderCalendarDay(idx + 1)
        )}
      </div>

      {/* Legend */}
      <div className="calendar-legends">
        <div className="calendar-legend">
          <span className="calendar-legend-label">Events</span>
          <div className="legend-item">
            <div className="legend-line legend-line-solid" style={{ borderColor: "var(--clr-accent)" }} />
            <span>Planning</span>
          </div>
          <div className="legend-item">
            <div className="legend-line legend-line-solid" style={{ borderColor: "var(--clr-success)" }} />
            <span>On Track</span>
          </div>
          <div className="legend-item">
            <div className="legend-line legend-line-solid" style={{ borderColor: "var(--clr-alert)" }} />
            <span>At Risk</span>
          </div>
          <div className="legend-item">
            <div className="legend-line legend-line-solid" style={{ borderColor: "var(--clr-txt-muted)" }} />
            <span>Complete</span>
          </div>
        </div>
        <div className="calendar-legend">
          <span className="calendar-legend-label">Tasks</span>
          <div className="legend-item">
            <div className="legend-line legend-line-dashed" style={{ borderColor: "var(--clr-txt-muted)" }} />
            <span>To Do</span>
          </div>
          <div className="legend-item">
            <div className="legend-line legend-line-dashed" style={{ borderColor: "var(--clr-accent)" }} />
            <span>In Progress</span>
          </div>
          <div className="legend-item">
            <div className="legend-line legend-line-dashed" style={{ borderColor: "var(--clr-success)" }} />
            <span>Done</span>
          </div>
          <div className="legend-item">
            <div className="legend-line legend-line-dashed" style={{ borderColor: "var(--clr-alert)" }} />
            <span>Blocked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
