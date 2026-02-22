import { useState } from "react";
import { CalendarDays, Clock, Users, MapPin, DollarSign, FileText, Link as LinkIcon, Edit2, Save, Trash2, Upload, X, ChevronDown, ChevronUp } from "lucide-react";
import AddressAutocomplete from "./AddressAutocomplete";
import type { PlannerEvent, EventFormData, EventGoals, Document } from "../types";

/**
 * EventOverviewProps -> Derived from `Event` + `Overview` + `Props`.
 */
interface EventOverviewProps {
  /** event -> The event to display overview for */
  event: PlannerEvent;
  /** allEvents -> All events in the registry, for resolving linked event IDs */
  allEvents?: PlannerEvent[];
  /** onUpdateEvent -> Callback to update the event */
  onUpdateEvent?: (updates: Partial<PlannerEvent>) => void;
  /** onDeleteEvent -> Callback to delete the event (only shown in edit mode) */
  onDeleteEvent?: () => void;
  /** onEditingChange -> Called when entering or leaving edit mode (so parent can hide header toggle) */
  onEditingChange?: (editing: boolean) => void;
}

/**
 * EventOverview -> Editable detailed view of event information (like onboarding form).
 */
export default function EventOverview({ event, allEvents = [], onUpdateEvent, onDeleteEvent, onEditingChange }: EventOverviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EventFormData>(event.formData);
  const [goals, setGoals] = useState<EventGoals>(event.formData.goals || {});
  const [documents, setDocuments] = useState<Document[]>(event.documents || []);
  const [newLink, setNewLink] = useState({ name: "", url: "" });
  const [selectedLinkedEvents, setSelectedLinkedEvents] = useState<string[]>(event.formData.linkedEventIds || []);
  const [linkedEventsExpanded, setLinkedEventsExpanded] = useState(false);
  const [linkedEventModal, setLinkedEventModal] = useState<PlannerEvent | null>(null);
  const [linkedEventModalTasksCollapsed, setLinkedEventModalTasksCollapsed] = useState(false);

  const setEditing = (value: boolean) => {
    setIsEditing(value);
    onEditingChange?.(value);
  };

  const handleSave = () => {
    if (onUpdateEvent) {
      onUpdateEvent({
        formData: {
          ...formData,
          goals: Object.keys(goals).length > 0 ? goals : undefined,
          linkedEventIds: selectedLinkedEvents.length > 0 ? selectedLinkedEvents : undefined,
        },
        documents: documents.length > 0 ? documents : undefined,
      });
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setFormData(event.formData);
    setGoals(event.formData.goals || {});
    setDocuments(event.documents || []);
    setSelectedLinkedEvents(event.formData.linkedEventIds || []);
    setEditing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const doc: Document = {
      id: `doc-${Date.now()}`,
      type: "file",
      name: file.name,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
      category: file.name.toLowerCase().includes("budget") ? "budget" : "other",
    };
    setDocuments((prev) => [...prev, doc]);
    if (doc.category === "budget") {
      setFormData((prev) => ({ ...prev, budgetSpreadsheet: doc }));
    }
  };

  const handleAddLink = () => {
    if (!newLink.name || !newLink.url) return;
    const doc: Document = {
      id: `link-${Date.now()}`,
      type: "link",
      name: newLink.name,
      url: newLink.url,
      uploadedAt: new Date().toISOString(),
      category: newLink.name.toLowerCase().includes("vendor") ? "vendor" : "other",
    };
    setDocuments((prev) => [...prev, doc]);
    setNewLink({ name: "", url: "" });
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (formData.budgetSpreadsheet?.id === id) {
      setFormData((prev) => ({ ...prev, budgetSpreadsheet: undefined }));
    }
  };

  const handleDelete = () => {
    if (!onDeleteEvent) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this event? This will permanently remove the event and all its tasks, chat messages, documents, and related data."
    );
    if (confirmed) onDeleteEvent();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGoalChange = (field: keyof EventGoals, value: string | number | undefined) => {
    setGoals((prev) => ({ ...prev, [field]: value }));
  };

  if (isEditing) {
    return (
      <div className="event-overview-editable">
        <div className="overview-editor-header">
          <h2>Edit Event Information</h2>
          <div className="overview-editor-actions">
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            {onDeleteEvent && (
              <button type="button" className="btn-danger" onClick={handleDelete}>
                <Trash2 size={16} />
                Delete Event
              </button>
            )}
            <button type="button" className="btn-primary" onClick={handleSave}>
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>

        <form className="event-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

          <div className="form-group full-width">
            <label>
              Event Name / Reason <span className="required-indicator">*</span>
            </label>
            <input
              type="text"
              name="eventReason"
              placeholder="e.g. Birthday party, Corporate mixer, Wedding reception..."
              value={formData.eventReason}
              onChange={handleChange}
              required
            />
          </div>

          {/* Event Goals Section */}
          <div className="form-section-header">
            <h3>Event Goals</h3>
            <p className="form-section-description">
              What does success look like for this event?
            </p>
          </div>

          <div className="form-group">
            <label>Attendance Target</label>
            <input
              type="number"
              placeholder="e.g. 200"
              min="1"
              value={goals.attendanceTarget ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                const num = raw === "" ? undefined : parseInt(raw, 10);
                handleGoalChange("attendanceTarget", num != null && !Number.isNaN(num) && num >= 1 ? num : undefined);
              }}
            />
          </div>

          <div className="form-group">
            <label>Revenue Target ($)</label>
            <input
              type="number"
              placeholder="e.g. 5000"
              min="0"
              value={goals.revenue ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                const num = raw === "" ? undefined : parseInt(raw, 10);
                handleGoalChange("revenue", num != null && !Number.isNaN(num) && num >= 0 ? num : undefined);
              }}
            />
          </div>

          <div className="form-group full-width">
            <label>Other Goals</label>
            <textarea
              placeholder="Community growth, brand awareness, networking goals..."
              value={goals.other || ""}
              onChange={(e) => handleGoalChange("other", e.target.value)}
              rows={2}
            />
          </div>

          {/* Date & Time Section */}
          <div className="form-section-header">
            <h3>Date & Time</h3>
            <p className="form-section-description">
              Leave blank if dates need to be researched
            </p>
          </div>

          <div className="form-group">
            <label>
              Date <span className="optional-indicator">(optional)</span>
            </label>
            <input
              type="date"
              name="eventDate"
              value={formData.eventDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-row form-row-times">
            <div className="form-group">
              <label>Start Time</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Venue Section */}
          <div className="form-section-header">
            <h3>Venue</h3>
          </div>

          <div className="form-group">
            <label>Venue Preference / Location</label>
            <input
              type="text"
              name="venuePref"
              placeholder="e.g. Downtown, Outdoor, Rooftop..."
              value={formData.venuePref}
              onChange={handleChange}
            />
          </div>

          <div className="form-group full-width">
            <label>Venue Selection (Map)</label>
            <AddressAutocomplete
              value={formData.venueLocation}
              onChange={(location) =>
                setFormData((prev) => ({ ...prev, venueLocation: location }))
              }
            />
          </div>

          {/* Other Details */}
          <div className="form-group">
            <label>Number of Guests</label>
            <input
              type="number"
              name="guestCount"
              placeholder="e.g. 50"
              min="1"
              value={formData.guestCount}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Food & Drinks</label>
            <select
              name="foodDrinks"
              value={formData.foodDrinks}
              onChange={handleChange}
            >
              <option value="full-catering">Full Catering</option>
              <option value="light-bites">Light Bites & Appetizers</option>
              <option value="drinks-only">Drinks Only</option>
              <option value="byob">BYOB / Potluck</option>
              <option value="none">No Food or Drinks</option>
            </select>
          </div>

          <div className="form-group">
            <label>Budget ($)</label>
            <input
              type="number"
              name="budget"
              placeholder="e.g. 10000"
              min="0"
              value={formData.budget || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  budget: parseInt(e.target.value) || undefined,
                }))
              }
            />
          </div>

          {/* Documents & Links Section */}
          <div className="form-section-header">
            <h3>Documents & Links</h3>
            <p className="form-section-description">
              Upload documents or add links (e.g., vendor websites, budget spreadsheets)
            </p>
          </div>

          <div className="form-group full-width">
            <label>Upload Documents</label>
            <div className="file-upload-area">
              <input
                type="file"
                id="file-upload-edit"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <label htmlFor="file-upload-edit" className="btn-file-upload">
                <Upload size={16} />
                Upload File
              </label>
              <span className="file-upload-hint">
                Budget spreadsheets, contracts, etc.
              </span>
            </div>

            {documents.filter((d) => d.type === "file").length > 0 && (
              <div className="documents-list">
                {documents
                  .filter((d) => d.type === "file")
                  .map((doc) => (
                    <div key={doc.id} className="document-item">
                      <span>{doc.name}</span>
                      <button
                        type="button"
                        className="btn-remove-doc"
                        onClick={() => handleRemoveDocument(doc.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="form-group full-width">
            <label>Add Links</label>
            <div className="link-input-group">
              <input
                type="text"
                placeholder="Link name (e.g., Vendor Website)"
                value={newLink.name}
                onChange={(e) => setNewLink({ ...newLink, name: e.target.value })}
              />
              <input
                type="url"
                placeholder="https://..."
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAddLink}
              >
                <LinkIcon size={14} />
                Add Link
              </button>
            </div>

            {documents.filter((d) => d.type === "link").length > 0 && (
              <div className="documents-list">
                {documents
                  .filter((d) => d.type === "link")
                  .map((doc) => (
                    <div key={doc.id} className="document-item">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        {doc.name}
                      </a>
                      <button
                        type="button"
                        className="btn-remove-doc"
                        onClick={() => handleRemoveDocument(doc.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Link Past Events */}
          {allEvents.filter((e) => e.evtId !== event.evtId).length > 0 && (
            <div className="form-group full-width linked-events-section">
              <button
                type="button"
                className="linked-events-toggle-header"
                onClick={() => setLinkedEventsExpanded((v) => !v)}
                aria-expanded={linkedEventsExpanded}
              >
                <span className="linked-events-toggle-label">Link Related Events</span>
                {linkedEventsExpanded ? (
                  <ChevronUp size={18} className="linked-events-chevron" />
                ) : (
                  <ChevronDown size={18} className="linked-events-chevron" />
                )}
              </button>
              <p className="form-hint">Link similar events to share tasks, documents, and knowledge</p>
              {linkedEventsExpanded && (
                <div className="linked-events-selector">
                  {allEvents
                    .filter((e) => e.evtId !== event.evtId)
                    .map((evt) => (
                      <label key={evt.evtId} className="linked-event-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedLinkedEvents.includes(evt.evtId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLinkedEvents([...selectedLinkedEvents, evt.evtId]);
                            } else {
                              setSelectedLinkedEvents(
                                selectedLinkedEvents.filter((id) => id !== evt.evtId)
                              );
                            }
                          }}
                        />
                        <span>{evt.formData.eventReason}</span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="form-group full-width">
            <label>Additional Notes</label>
            <textarea
              name="notes"
              placeholder="Any special requirements, themes, accessibility needs..."
              value={formData.notes}
              onChange={handleChange}
            />
          </div>
        </form>
      </div>
    );
  }

  // Read-only view
  const fd = event.formData;

  return (
    <div className="event-overview">
      <div className="overview-header">
        <h2>Event Overview</h2>
        {onUpdateEvent && (
          <button
            className="btn-edit-overview-header"
            onClick={() => setEditing(true)}
          >
            <Edit2 size={16} />
            Edit Event
          </button>
        )}
      </div>
      {/* Basic Info */}
      <section className="overview-section">
        <h3 className="overview-section-title">Event Details</h3>
        <div className="overview-grid">
          <div className="overview-item">
            <CalendarDays size={16} />
            <div className="overview-item-content">
              <span className="overview-label">Date</span>
              <span className="overview-value">{fd.eventDate || "Not set"}</span>
            </div>
          </div>
          <div className="overview-item">
            <Clock size={16} />
            <div className="overview-item-content">
              <span className="overview-label">Time</span>
              <span className="overview-value">
                {fd.startTime && fd.endTime
                  ? `${fd.startTime} - ${fd.endTime}`
                  : fd.startTime
                  ? `${fd.startTime} (start)`
                  : "Not set"}
              </span>
            </div>
          </div>
          <div className="overview-item">
            <Users size={16} />
            <div className="overview-item-content">
              <span className="overview-label">Guests</span>
              <span className="overview-value">{fd.guestCount || "Not set"}</span>
            </div>
          </div>
          <div className="overview-item">
            <MapPin size={16} />
            <div className="overview-item-content">
              <span className="overview-label">Venue</span>
              <span className="overview-value">
                {fd.venueLocation?.address || fd.venuePref || "Not set"}
              </span>
              {fd.venueLocation?.mapUrl && (
                <a
                  href={fd.venueLocation.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="overview-link"
                >
                  View on Map
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Goals */}
      {fd.goals && Object.keys(fd.goals).length > 0 ? (
        <section className="overview-section">
          <h3 className="overview-section-title">
            Event Goals
          </h3>
          <div className="overview-grid">
            {fd.goals.attendanceTarget != null && Number(fd.goals.attendanceTarget) > 0 ? (
              <div className="overview-item">
                <Users size={16} />
                <div className="overview-item-content">
                  <span className="overview-label">Attendance Target</span>
                  <span className="overview-value">{fd.goals.attendanceTarget} guests</span>
                </div>
              </div>
            ) : null}
            {fd.goals.revenue != null && Number(fd.goals.revenue) > 0 ? (
              <div className="overview-item">
                <DollarSign size={16} />
                <div className="overview-item-content">
                  <span className="overview-label">Revenue Target</span>
                  <span className="overview-value">${fd.goals.revenue.toLocaleString()}</span>
                </div>
              </div>
            ) : null}
            {fd.goals.other != null && String(fd.goals.other).trim() !== "" ? (
              <div className="overview-item full-width">
                <FileText size={16} />
                <div className="overview-item-content">
                  <span className="overview-label">Other Goals</span>
                  <span className="overview-value">{fd.goals.other}</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Budget */}
      {fd.budget != null ? (
        <section className="overview-section">
          <h3 className="overview-section-title">
            Budget
          </h3>
          <div className="overview-budget">
            <span className="overview-budget-amount">${fd.budget.toLocaleString()}</span>
            {fd.budgetSpreadsheet && (
              <a
                href={fd.budgetSpreadsheet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="overview-link"
              >
                <FileText size={14} />
                View Budget Spreadsheet
              </a>
            )}
          </div>
        </section>
      ) : null}

      {/* Documents & Links */}
      {event.documents && event.documents.length > 0 ? (
        <section className="overview-section">
          <h3 className="overview-section-title">
            <FileText size={16} />
            Documents & Links
          </h3>
          <div className="overview-documents">
            {event.documents.map((doc) => (
              <div key={doc.id} className="overview-document-item">
                {doc.type === "link" ? (
                  <LinkIcon size={14} />
                ) : (
                  <FileText size={14} />
                )}
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="overview-link"
                >
                  {doc.name}
                </a>
                {doc.category && (
                  <span className="overview-doc-category">{doc.category}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Notes */}
      {fd.notes != null && String(fd.notes).trim() !== "" ? (
        <section className="overview-section">
          <h3 className="overview-section-title">
            Notes
          </h3>
          <p className="overview-notes">{fd.notes}</p>
        </section>
      ) : null}

      {/* Linked Events */}
      {fd.linkedEventIds && fd.linkedEventIds.length > 0 ? (
        <section className="overview-section">
          <h3 className="overview-section-title">Linked Events</h3>
          <div className="overview-linked-events">
            {fd.linkedEventIds.map((linkedId) => {
              const linkedEvt = allEvents.find((e) => e.evtId === linkedId);
              if (!linkedEvt) return null;
              return (
                <button
                  key={linkedId}
                  type="button"
                  className="overview-linked-event-btn"
                  onClick={() => { setLinkedEventModal(linkedEvt); setLinkedEventModalTasksCollapsed(false); }}
                >
                  <LinkIcon size={14} />
                  <span>{linkedEvt.formData.eventReason}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Linked Event Modal */}
      {linkedEventModal && (
        <div className="linked-event-modal-overlay" onClick={() => setLinkedEventModal(null)}>
          <div className="linked-event-modal" onClick={(e) => e.stopPropagation()}>
            <div className="linked-event-modal-header">
              <h3>{linkedEventModal.formData.eventReason}</h3>
              <button type="button" className="linked-event-modal-close" onClick={() => setLinkedEventModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="linked-event-modal-body">
              <div className="overview-grid">
                <div className="overview-item">
                  <CalendarDays size={16} />
                  <div className="overview-item-content">
                    <span className="overview-label">Date</span>
                    <span className="overview-value">{linkedEventModal.formData.eventDate || "Not set"}</span>
                  </div>
                </div>
                <div className="overview-item">
                  <Clock size={16} />
                  <div className="overview-item-content">
                    <span className="overview-label">Time</span>
                    <span className="overview-value">
                      {linkedEventModal.formData.startTime && linkedEventModal.formData.endTime
                        ? `${linkedEventModal.formData.startTime} - ${linkedEventModal.formData.endTime}`
                        : "Not set"}
                    </span>
                  </div>
                </div>
                <div className="overview-item">
                  <Users size={16} />
                  <div className="overview-item-content">
                    <span className="overview-label">Guests</span>
                    <span className="overview-value">{linkedEventModal.formData.guestCount || "Not set"}</span>
                  </div>
                </div>
                <div className="overview-item">
                  <MapPin size={16} />
                  <div className="overview-item-content">
                    <span className="overview-label">Venue</span>
                    <span className="overview-value">
                      {linkedEventModal.formData.venueLocation?.address || linkedEventModal.formData.venuePref || "Not set"}
                    </span>
                  </div>
                </div>
              </div>
              {linkedEventModal.formData.budget != null && (
                <div className="linked-event-modal-detail">
                  <DollarSign size={14} />
                  <span>Budget: ${linkedEventModal.formData.budget.toLocaleString()}</span>
                </div>
              )}
              {linkedEventModal.formData.notes && (
                <div className="linked-event-modal-detail">
                  <FileText size={14} />
                  <span>{linkedEventModal.formData.notes}</span>
                </div>
              )}
              {linkedEventModal.tasks && linkedEventModal.tasks.length > 0 && (
                <div className="linked-event-modal-tasks collapsible-section">
                  <button
                    type="button"
                    className="collapsible-toggle-header"
                    onClick={() => setLinkedEventModalTasksCollapsed((c) => !c)}
                    aria-expanded={!linkedEventModalTasksCollapsed}
                  >
                    <span className="collapsible-toggle-label">
                      Related tasks ({linkedEventModal.tasks.filter((t) => t.status === "done").length}/{linkedEventModal.tasks.length} done)
                    </span>
                    {linkedEventModalTasksCollapsed ? (
                      <ChevronDown size={18} className="collapsible-toggle-chevron" />
                    ) : (
                      <ChevronUp size={18} className="collapsible-toggle-chevron" />
                    )}
                  </button>
                  {!linkedEventModalTasksCollapsed && (
                    <div className="collapsible-section-body">
                      <ul>
                        {linkedEventModal.tasks.slice(0, 8).map((t) => (
                          <li key={t.id} className={t.status === "done" ? "completed" : ""}>
                            {t.title}
                          </li>
                        ))}
                        {linkedEventModal.tasks.length > 8 && (
                          <li className="more-indicator">+{linkedEventModal.tasks.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
