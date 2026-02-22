import { useState, useMemo } from "react";
import { FileText, List, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import EventPromptBar from "./EventPromptBar";
import EventForm from "./EventForm";
import PastEventCard from "./PastEventCard";
import type {
  PlannerEvent,
  EventFormData,
  ActiveView,
  AccountSettings,
  EventStatus,
  Subtask,
} from "../types";
import { EVENT_STATUS_LABELS } from "../types";

/**
 * DashboardProps -> Derived from `Dashboard` + `Props`.
 */
interface DashboardProps {
  /** pastEvents -> Events to display as cards below the prompt */
  pastEvents: PlannerEvent[];
  /** accountSettings -> Current account settings */
  accountSettings: AccountSettings;
  /** onSubmit -> Callback with form data when a new event is created */
  onSubmit: (data: EventFormData) => void;
  /** onNavigate -> Navigation callback for clicking past event cards */
  onNavigate: (view: ActiveView) => void;
  /** onUpdateEvent -> Callback to update an event */
  onUpdateEvent: (evtId: string, updates: Partial<PlannerEvent>) => void;
}

/**
 * Dashboard -> Enhanced dashboard with editable goals, status indicators, and separated event sections.
 */
export default function Dashboard({
  pastEvents,
  accountSettings,
  onSubmit,
  onNavigate,
  onUpdateEvent,
}: DashboardProps) {
  // showForm -> Derived from `show` (visibility toggle) + `Form` (input section)
  const [showForm, setShowForm] = useState(false);

  // Separate events by status
  const { pastEventsList, activeEvents, upcomingEvents } = useMemo(() => {
    const now = new Date();
    const past: PlannerEvent[] = [];
    const active: PlannerEvent[] = [];
    const upcoming: PlannerEvent[] = [];

    pastEvents.forEach((event) => {
      const eventDate = event.formData.eventDate
        ? new Date(event.formData.eventDate)
        : null;

      if (event.status === "complete" || (eventDate && eventDate < now)) {
        past.push(event);
      } else if (event.status === "at-risk") {
        active.push(event);
      } else if (event.status === "on-track" || event.status === "planning") {
        upcoming.push(event);
      } else {
        upcoming.push(event);
      }
    });

    return {
      pastEventsList: past,
      activeEvents: active,
      upcomingEvents: upcoming,
    };
  }, [pastEvents]);

  const getStatusIcon = (status: EventStatus) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 size={16} />;
      case "at-risk":
        return <AlertTriangle size={16} />;
      case "on-track":
        return <Clock size={16} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: EventStatus): string => {
    switch (status) {
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

  const hasOverviewContent = (evt: PlannerEvent) =>
    Boolean(
      evt.formData.guestCount ||
      (evt.formData.startTime && evt.formData.endTime) ||
      evt.formData.eventDate
    );

  return (
    <div className="dashboard">
      {/* Logo */}
      <div className="dashboard-logo">
        <div className="dashboard-logo-wrap">
          <img src="/Eventrop.png" alt="Eventropy" className="dashboard-logo-img" />
          <img src="/Eventrop-blink.png" alt="" className="dashboard-logo-blink" aria-hidden="true" />
        </div>
      </div>

      {/* Prompt bar or form */}
      {!showForm ? (
        <EventPromptBar onActivate={() => setShowForm(true)} />
      ) : (
          <EventForm
            existingEvents={pastEvents}
            onSubmit={(data) => {
              setShowForm(false);
              onSubmit(data);
            }}
            onCancel={() => setShowForm(false)}
          />
      )}

      {/* Active/At-Risk Events */}
      {activeEvents.length > 0 && (
        <div className="events-section active-events-section">
          <div className="events-section-header">
            <h2 className="events-section-title">
              <AlertTriangle size={18} />
              Active Events - At Risk
            </h2>
          </div>
          <div className="events-grid">
            {activeEvents.map((evt) => (
              <div
                key={evt.evtId}
                className="event-card"
                style={{ borderLeftColor: getStatusColor(evt.status) }}
              >
                <div className="event-card-header">
                  <h3 className="event-card-title">{evt.formData.eventReason}</h3>
                  <div
                    className="event-status-badge"
                    style={{ backgroundColor: getStatusColor(evt.status), color: "#fff" }}
                  >
                    {getStatusIcon(evt.status)}
                    <span>{EVENT_STATUS_LABELS[evt.status]}</span>
                  </div>
                </div>
                {hasOverviewContent(evt) && (
                  <div className="event-card-overview">
                    <div className="event-overview-summary">
                      {evt.formData.guestCount && (
                        <span>{evt.formData.guestCount} guests</span>
                      )}
                      {evt.formData.startTime && evt.formData.endTime && (
                        <span>{evt.formData.startTime}-{evt.formData.endTime}</span>
                      )}
                      {evt.formData.eventDate && (
                        <span>{evt.formData.eventDate}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="event-card-view-toggle">
                  <button
                    type="button"
                    className="view-mode-btn"
                    onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId, initialViewMode: "details" })}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="view-mode-btn"
                    onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId, initialViewMode: "tasks" })}
                  >
                    Tasks
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="events-section upcoming-events-section">
          <div className="events-section-header">
            <h2 className="events-section-title">
              <Clock size={18} />
              Upcoming Events
            </h2>
          </div>
          <div className="events-grid">
            {upcomingEvents.map((evt) => (
              <div
                key={evt.evtId}
                className="event-card"
                style={{ borderLeftColor: getStatusColor(evt.status) }}
              >
                <div className="event-card-header">
                  <h3 className="event-card-title">{evt.formData.eventReason}</h3>
                  <div
                    className="event-status-badge"
                    style={{ backgroundColor: getStatusColor(evt.status), color: "#fff" }}
                  >
                    {getStatusIcon(evt.status)}
                    <span>{EVENT_STATUS_LABELS[evt.status]}</span>
                  </div>
                </div>
                {hasOverviewContent(evt) && (
                  <div className="event-card-overview">
                    <div className="event-overview-summary">
                      {evt.formData.guestCount && (
                        <span>{evt.formData.guestCount} guests</span>
                      )}
                      {evt.formData.startTime && evt.formData.endTime && (
                        <span>{evt.formData.startTime}-{evt.formData.endTime}</span>
                      )}
                      {evt.formData.eventDate && (
                        <span>{evt.formData.eventDate}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="event-card-view-toggle">
                  <button
                    type="button"
                    className="view-mode-btn"
                    onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId, initialViewMode: "details" })}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="view-mode-btn"
                    onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId, initialViewMode: "tasks" })}
                  >
                    Tasks
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Events */}
      {pastEventsList.length > 0 && (
        <div className="events-section past-events-section">
          <div className="events-section-header">
            <h2 className="events-section-title">Past Events</h2>
          </div>
          <div className="events-grid">
            {pastEventsList.map((evt) => (
              <div
                key={evt.evtId}
                className="event-card past-event-card"
              >
                <div className="event-card-header">
                  <h3 className="event-card-title">{evt.formData.eventReason}</h3>
                </div>
                {hasOverviewContent(evt) && (
                  <div className="event-card-overview">
                    <div className="event-overview-summary">
                      {evt.formData.guestCount && (
                        <span>{evt.formData.guestCount} guests</span>
                      )}
                      {evt.formData.startTime && evt.formData.endTime && (
                        <span>{evt.formData.startTime}-{evt.formData.endTime}</span>
                      )}
                      {evt.formData.eventDate && (
                        <span>{evt.formData.eventDate}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="event-card-view-toggle">
                  <button
                    type="button"
                    className="view-mode-btn"
                    onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId, initialViewMode: "details" })}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="view-mode-btn"
                    onClick={() => onNavigate({ kind: "event-chat", evtId: evt.evtId, initialViewMode: "tasks" })}
                  >
                    Tasks
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
