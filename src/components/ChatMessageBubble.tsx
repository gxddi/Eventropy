import { Bot, AlertTriangle } from "lucide-react";
import type { ChatMessage, AgentDef } from "../types";

/**
 * ChatMessageBubbleProps -> Derived from `Chat` + `Message` + `Bubble` + `Props`.
 */
interface ChatMessageBubbleProps {
  /** message -> The ChatMessage data to render */
  message: ChatMessage;
  /** agentDef -> Static metadata for the authoring agent */
  agentDef: AgentDef;
  /** onClick -> Callback to navigate to the agent's sub-tab */
  onClick: () => void;
}

/**
 * ChatMessageBubble -> Single message in the unified chat timeline.
 * Renders agent messages as clickable bubbles; system messages as alert banners.
 */
export default function ChatMessageBubble({ message, agentDef, onClick }: ChatMessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className="agent-input-needed" onClick={onClick} style={{ cursor: "pointer" }}>
        <div
          className="agent-icon"
          style={{
            background: agentDef.iconBg,
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <agentDef.icon size={14} style={{ color: agentDef.iconColor }} />
        </div>
        <AlertTriangle size={16} />
        <span>
          <strong>{agentDef.name}:</strong> {message.content}
        </span>
      </div>
    );
  }

  // fmtTime -> Derived from `format` (fmt) + `Time` (display string)
  const fmtTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="agent-message agent-message--clickable" onClick={onClick}>
      <div
        className="agent-message-avatar"
        style={{ background: agentDef.iconBg, color: agentDef.iconColor }}
      >
        <Bot size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="agent-message-name" style={{ color: agentDef.iconColor }}>
          {agentDef.name}
        </div>
        <div className="agent-message-content">{message.content}</div>
        <div className="agent-message-timestamp">{fmtTime}</div>
      </div>
    </div>
  );
}
