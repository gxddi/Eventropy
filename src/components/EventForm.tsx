import { useState } from "react";
import { MapPin, Upload, Link as LinkIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import AddressAutocomplete from "./AddressAutocomplete";
import type { EventFormData, FoodDrinkOption, EventGoals, Document } from "../types";

/**
 * EventFormProps -> Derived from `Event` + `Form` + `Props`.
 */
interface EventFormProps {
  /** onSubmit -> Callback with completed form data */
  onSubmit: (data: EventFormData) => void;
  /** onCancel -> Callback to collapse back to prompt bar */
  onCancel: () => void;
  /** existingEvents -> Past events for linking */
  existingEvents?: Array<{ evtId: string; formData: { eventReason: string } }>;
}

/**
 * INITIAL_FORM_DATA -> Derived from `INITIAL` (default) + `FORM` + `DATA`.
 * Default empty values for all event form fields.
 */
const INITIAL_FORM_DATA: EventFormData = {
  eventReason: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  venuePref: "",
  guestCount: "",
  foodDrinks: "full-catering",
  notes: "",
  generateAiTasks: true,
};

/**
 * EventForm -> Enhanced form for event creation with goals, documents, and venue map.
 * Manages its own local formState, emits completed data upward on submit.
 */
export default function EventForm({
  onSubmit,
  onCancel,
  existingEvents = [],
}: EventFormProps) {
  // formState -> Derived from `form` (input group) + `State` (React state)
  const [formState, setFormState] = useState<EventFormData>(INITIAL_FORM_DATA);
  const [goals, setGoals] = useState<EventGoals>({});
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newLink, setNewLink] = useState({ name: "", url: "" });
  const [showVenueMap, setShowVenueMap] = useState(false);
  const [selectedLinkedEvents, setSelectedLinkedEvents] = useState<string[]>([]);
  const [linkedEventsExpanded, setLinkedEventsExpanded] = useState(false);

  // handleChange -> Derived from `handle` (callback) + `Change` (input mutation)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGoalChange = (field: keyof EventGoals, value: string | number | undefined) => {
    setGoals((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const document: Document = {
      id: `doc-${Date.now()}`,
      type: "file",
      name: file.name,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
      category: file.name.toLowerCase().includes("budget") ? "budget" : "other",
    };

    setDocuments((prev) => [...prev, document]);
    
    // If it's a budget spreadsheet, also set it in formState
    if (document.category === "budget") {
      setFormState((prev) => ({ ...prev, budgetSpreadsheet: document }));
    }
  };

  const handleAddLink = () => {
    if (!newLink.name || !newLink.url) return;

    const document: Document = {
      id: `link-${Date.now()}`,
      type: "link",
      name: newLink.name,
      url: newLink.url,
      uploadedAt: new Date().toISOString(),
      category: newLink.name.toLowerCase().includes("vendor") ? "vendor" : "other",
    };

    setDocuments((prev) => [...prev, document]);
    setNewLink({ name: "", url: "" });
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (formState.budgetSpreadsheet?.id === id) {
      setFormState((prev) => ({ ...prev, budgetSpreadsheet: undefined }));
    }
  };

  // handleSubmit -> Derived from `handle` (callback) + `Submit` (form action)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If date is blank, create a task to research dates
    if (!formState.eventDate) {
      // This will be handled by AI task generation later
    }

    const finalData: EventFormData = {
      ...formState,
      goals: Object.keys(goals).length > 0 ? goals : undefined,
      linkedEventIds: selectedLinkedEvents.length > 0 ? selectedLinkedEvents : undefined,
      generateAiTasks: formState.generateAiTasks,
    };

    onSubmit(finalData);
  };

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {/* Required Fields Section */}
      <div className="form-section-header">
        <h3>Required Information</h3>
        <p className="form-section-description">Fill these out to get started</p>
      </div>

      <div className="form-group full-width">
        <label>
          Event Name / Reason <span className="required-indicator">*</span>
        </label>
        <input
          type="text"
          name="eventReason"
          placeholder="e.g. Birthday party, Corporate mixer, Wedding reception..."
          value={formState.eventReason}
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

      <div className="form-group full-width">
        <label>
          Date <span className="optional-indicator">(optional)</span>
        </label>
        <input
          type="date"
          name="eventDate"
          value={formState.eventDate}
          onChange={handleChange}
        />
        {!formState.eventDate && (
          <p className="form-hint">
            A task will be created to research possible dates and avoid conflicts
          </p>
        )}
      </div>

      <div className="form-row form-row-times">
        <div className="form-group">
          <label>Start Time</label>
          <input
            type="time"
            name="startTime"
            value={formState.startTime}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>End Time</label>
          <input
            type="time"
            name="endTime"
            value={formState.endTime}
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
          value={formState.venuePref}
          onChange={handleChange}
        />
      </div>

      <div className="form-group full-width">
        <label>Venue Selection (Map)</label>
        <AddressAutocomplete
          value={formState.venueLocation}
          onChange={(location) =>
            setFormState((prev) => ({
              ...prev,
              venueLocation: location,
            }))
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
          value={formState.guestCount}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label>Food & Drinks</label>
        <select
          name="foodDrinks"
          value={formState.foodDrinks}
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
          value={formState.budget || ""}
          onChange={(e) =>
            setFormState((prev) => ({
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
            id="file-upload"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <label htmlFor="file-upload" className="btn-file-upload">
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

      {/* Link Past Events — collapsible toggle list */}
      {existingEvents.length > 0 && (
        <div className="form-group full-width linked-events-section">
          <button
            type="button"
            className="linked-events-toggle-header"
            onClick={() => setLinkedEventsExpanded((v) => !v)}
            aria-expanded={linkedEventsExpanded}
          >
            <span className="linked-events-toggle-label">Link Related Past Events</span>
            {linkedEventsExpanded ? (
              <ChevronUp size={18} className="linked-events-chevron" />
            ) : (
              <ChevronDown size={18} className="linked-events-chevron" />
            )}
          </button>
          <p className="form-hint">Link similar events to share tasks, documents, and knowledge</p>
          {linkedEventsExpanded && (
            <div className="linked-events-selector">
              {existingEvents.map((event) => (
                <label key={event.evtId} className="linked-event-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedLinkedEvents.includes(event.evtId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLinkedEvents([...selectedLinkedEvents, event.evtId]);
                      } else {
                        setSelectedLinkedEvents(
                          selectedLinkedEvents.filter((id) => id !== event.evtId)
                        );
                      }
                    }}
                  />
                  <span>{event.formData.eventReason}</span>
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
          value={formState.notes}
          onChange={handleChange}
        />
      </div>

      <div className="form-actions">
        <label className="form-actions-option">
          <input
            type="checkbox"
            checked={formState.generateAiTasks !== false}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, generateAiTasks: e.target.checked }))
            }
          />
          <span>AI generate tasks for this event</span>
        </label>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Plan This Event
        </button>
      </div>
    </form>
  );
}
