import ChatMessageBubble from "./ChatMessageBubble";
import { getAgentDef } from "../mockData";
import type { ChatMessage, AgentId } from "../types";

/**
 * ChatTimelineProps -> Derived from `Chat` + `Timeline` + `Props`.
 */
interface ChatTimelineProps {
  /** messages -> Ordered array of chat messages to display */
  messages: ChatMessage[];
  /** onMessageClick -> Callback when a message bubble is clicked (navigate to agent) */
  onMessageClick: (agentId: AgentId) => void;
}

/**
 * ChatTimeline -> Scrollable vertical feed of ChatMessageBubble components.
 * Messages are rendered in timestamp order.
 */
export default function ChatTimeline({ messages, onMessageClick }: ChatTimelineProps) {
  return (
    <div className="chat-timeline">
      {messages.map((msg) => (
        <ChatMessageBubble
          key={msg.msgId}
          message={msg}
          agentDef={getAgentDef(msg.agentId)}
          onClick={() => onMessageClick(msg.agentId)}
        />
      ))}
    </div>
  );
}
