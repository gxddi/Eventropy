import { ArrowUp, Plus } from "lucide-react";

/**
 * EventPromptBarProps -> Derived from `Event` + `Prompt` + `Bar` + `Props`.
 */
interface EventPromptBarProps {
  /** onActivate -> Callback to expand into the event creation form */
  onActivate: () => void;
}

/**
 * EventPromptBar -> Ollama-style "What's your next event?" prompt bar.
 * Clicking anywhere on it triggers form expansion.
 */
export default function EventPromptBar({ onActivate }: EventPromptBarProps) {
  return (
    <div className="dashboard-prompt" onClick={onActivate} style={{ cursor: "pointer" }}>
      <input
        type="text"
        placeholder="What's your next event?"
        readOnly
        style={{ cursor: "pointer" }}
      />
      <div className="model-badge">
        <Plus size={14} />
        New Event
      </div>
      <button className="send-btn" type="button">
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
