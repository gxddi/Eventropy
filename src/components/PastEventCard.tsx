import { CalendarDays, Users, Clock } from "lucide-react";
import type { PlannerEvent } from "../types";

/**
 * PastEventCardProps -> Derived from `Past` + `Event` + `Card` + `Props`.
 */
interface PastEventCardProps {
  /** event -> The PlannerEvent to render as a card */
  event: PlannerEvent;
  /** onClick -> Callback when the card is clicked (navigates to event chat) */
  onClick: () => void;
}

/**
 * PastEventCard -> Dashboard card displaying a past/existing event summary.
 * Shows event reason, date, guest count, and duration.
 */
export default function PastEventCard({ event, onClick }: PastEventCardProps) {
  // fd -> Derived from `form` (f) + `Data` (d) — shorthand alias for event.formData
  const fd = event.formData;

  return (
    <div className="past-event-card" onClick={onClick}>
      <div className="past-event-card-title">{fd.eventReason || "Untitled Event"}</div>
      <div className="past-event-card-meta">
        <span><CalendarDays size={13} /> {fd.eventDate || "No date"}</span>
        <span><Users size={13} /> {fd.guestCount || "?"} guests</span>
        <span><Clock size={13} /> {fd.startTime && fd.endTime ? `${fd.startTime}–${fd.endTime}` : "?"}</span>
      </div>
    </div>
  );
}
