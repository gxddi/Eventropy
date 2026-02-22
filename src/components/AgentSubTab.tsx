import { ArrowLeft, ArrowUp, Bot, AlertTriangle } from "lucide-react";
import { getAgentDef, getAgentMessages } from "../mockData";
import type { PlannerEvent, AgentId, ActiveView } from "../types";

/**
 * AgentSubTabProps -> Derived from `Agent` + `Sub` + `Tab` + `Props`.
 */
interface AgentSubTabProps {
  /** agentId -> Which agent's sub-tab to display */
  agentId: AgentId;
  /** event -> The parent PlannerEvent */
  event: PlannerEvent;
  /** onBack -> Navigate back to the event's unified chat */
  onBack: () => void;
}

/**
 * AgentSubTab -> Expanded single-agent view with filtered conversation.
 * Replaces the former AgentDetail component.
 */
export default function AgentSubTab({ agentId, event, onBack }: AgentSubTabProps) {
  // agentDef -> Derived from `agent` (AI worker) + `Definition` (config object)
  const agentDef = getAgentDef(agentId);
  // msgList -> Derived from `message` (msg) + `List` (filtered array)
  const msgList = getAgentMessages(agentId, event.chatTimeline);

  return (
    <div className="agent-detail">
      {/* Header */}
      <div className="agent-detail-header">
        <button className="agent-detail-back" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-detail-title">
          <div className="agent-icon" style={{ background: agentDef.iconBg }}>
            <agentDef.icon size={20} style={{ color: agentDef.iconColor }} />
          </div>
          <h2>{agentDef.name}</h2>
        </div>
        <div style={{ flex: 1 }} />
        <div className="agent-status">
          <span className={`status-dot ${agentDef.status}`} />
          <span className="status-text">{agentDef.statusText}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="agent-detail-body">
        {msgList.map((msg) => {
          if (msg.role === "system") {
            return (
              <div key={msg.msgId} className="agent-input-needed">
                <AlertTriangle size={18} />
                <span>{msg.content}</span>
              </div>
            );
          }

          return (
            <div key={msg.msgId} className="agent-message">
              <div
                className="agent-message-avatar"
                style={{ background: agentDef.iconBg, color: agentDef.iconColor }}
              >
                <Bot size={14} />
              </div>
              <div className="agent-message-content">{msg.content}</div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="agent-detail-input">
        <input type="text" placeholder={`Reply to ${agentDef.name}...`} readOnly />
        <button
          className="send-btn"
          type="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--clr-surface)",
            border: "1px solid var(--clr-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--clr-txt-muted)",
            flexShrink: 0,
          }}
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
