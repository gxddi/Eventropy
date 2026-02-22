import { useMemo } from "react";
import { CalendarDays, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import type { PlannerEvent, ActiveView, Task } from "../types";

/**
 * TimelineViewProps -> Derived from `Timeline` + `View` + `Props`.
 */
interface TimelineViewProps {
  /** events -> All events to display */
  events: PlannerEvent[];
  /** eventId -> Optional specific event to focus on */
  eventId?: string;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
}

/**
 * TimelineView -> Timeline view showing tasks and deadlines across events.
 */
export default function TimelineView({
  events,
  eventId,
  onNavigate,
}: TimelineViewProps) {
  // Collect all tasks from all events
  const allTasks = useMemo(() => {
    const tasks: Array<{ task: Task; event: PlannerEvent }> = [];
    events.forEach((event) => {
      if (event.tasks) {
        event.tasks.forEach((task) => {
          tasks.push({ task, event });
        });
      }
    });
    return tasks.sort((a, b) => {
      const dateA = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity;
      const dateB = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [events]);

  // Filter by event if specified
  const filteredTasks = eventId
    ? allTasks.filter((t) => t.event.evtId === eventId)
    : allTasks;

  // Separate tasks by status
  const tasksWithDates = filteredTasks.filter((t) => t.task.dueDate);
  const tasksWithoutDates = filteredTasks.filter((t) => !t.task.dueDate);
  const overdueTasks = tasksWithDates.filter((t) => {
    const dueDate = new Date(t.task.dueDate!);
    return dueDate < new Date() && t.task.status !== "done";
  });
  const upcomingTasks = tasksWithDates.filter((t) => {
    const dueDate = new Date(t.task.dueDate!);
    return dueDate >= new Date() && t.task.status !== "done";
  });
  const completedTasks = filteredTasks.filter((t) => t.task.status === "done");

  const formatDate = (dateStr: string): string => {
    const ymd = dateStr.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return dateStr;
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntil = (dateStr: string): number => {
    const ymd = dateStr.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 0;
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getPriorityClass = (priority: number): string => {
    if (priority >= 2) return "task-priority-high";
    if (priority === 1) return "task-priority-medium";
    return "task-priority-low";
  };

  const renderTaskItem = (
    item: { task: Task; event: PlannerEvent },
    showOverdue: boolean = false
  ) => {
    const daysUntil = item.task.dueDate ? getDaysUntil(item.task.dueDate) : null;
    const isDone = item.task.status === "done";
    const isOverdue = !isDone && daysUntil !== null && daysUntil < 0;

    return (
      <div
        key={item.task.id}
        className={`timeline-task-item ${isOverdue ? "overdue" : ""} ${isDone ? "completed" : ""}`}
        onClick={() =>
          onNavigate({ kind: "event-chat", evtId: item.event.evtId, initialViewMode: "tasks" })
        }
      >
        <div className="timeline-task-header">
          <div className="timeline-task-title-row">
            <h3 className="timeline-task-title">{item.task.title}</h3>
            {item.task.priority > 0 && (
              <span
                className={`timeline-task-priority ${getPriorityClass(item.task.priority)}`}
              >
                {item.task.priority === 2 ? "High" : "Medium"}
              </span>
            )}
          </div>
          <div className="timeline-task-meta">
            <span className="timeline-task-event">{item.event.formData.eventReason}</span>
            {item.task.dueDate && (
              <span className="timeline-task-date">
                <CalendarDays size={12} />
                {formatDate(item.task.dueDate)}
                {!isDone && daysUntil !== null && (
                  <span className={`timeline-days-until ${isOverdue ? "overdue" : ""}`}>
                    {isOverdue ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d left`}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        {!isDone && item.task.description && (
          <p className="timeline-task-description">{item.task.description}</p>
        )}
        {item.task.blockers.length > 0 && (
          <div className="timeline-task-blockers">
            <AlertCircle size={14} />
            <span>Blocked by {item.task.blockers.length} task(s)</span>
          </div>
        )}
        
      </div>
    );
  };

  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <h1>Timeline View</h1>
        {eventId && (
          <p className="timeline-subtitle">
            Showing tasks for:{" "}
            {events.find((e) => e.evtId === eventId)?.formData.eventReason}
          </p>
        )}
      </div>

      <div className="timeline-content">
        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <section className="timeline-section overdue-section">
            <h2 className="timeline-section-title overdue">
              <AlertCircle size={18} />
              Overdue Tasks ({overdueTasks.length})
            </h2>
            <div className="timeline-task-list">
              {overdueTasks.map((item) => renderTaskItem(item, true))}
            </div>
          </section>
        )}

        {/* Upcoming Tasks */}
        {upcomingTasks.length > 0 && (
          <section className="timeline-section">
            <h2 className="timeline-section-title">
              <Clock size={18} />
              Upcoming Tasks ({upcomingTasks.length})
            </h2>
            <div className="timeline-task-list">
              {upcomingTasks.map((item) => renderTaskItem(item))}
            </div>
          </section>
        )}

        {/* Tasks Without Dates */}
        {tasksWithoutDates.length > 0 && (
          <section className="timeline-section">
            <h2 className="timeline-section-title">
              Tasks Without Dates ({tasksWithoutDates.length})
            </h2>
            <div className="timeline-task-list">
              {tasksWithoutDates.map((item) => renderTaskItem(item))}
            </div>
          </section>
        )}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <section className="timeline-section completed-section">
            <h2 className="timeline-section-title completed">
              <CheckCircle2 size={18} />
              Completed Tasks ({completedTasks.length})
            </h2>
            <div className="timeline-task-list">
              {completedTasks.map((item) => renderTaskItem(item))}
            </div>
          </section>
        )}

        {filteredTasks.length === 0 && (
          <div className="timeline-empty">
            <p>No tasks found.</p>
            {eventId && (
              <p className="timeline-empty-hint">
                This event doesn't have any tasks yet. Create tasks in the event chat view.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
