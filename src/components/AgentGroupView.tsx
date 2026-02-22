import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Users, Building2, Calendar, Package, Bot, User, AlertCircle, CheckCircle2, Loader } from "lucide-react";
import {
  onChatMessage,
  getNotifications,
  isElectron,
} from "../lib/electronBridge";
import type { OrchestratorNotification } from "../lib/electronBridge";
import type {
  AgentId,
  ActiveView,
  PlannerEvent,
  OrchestratorMessage,
  Task,
} from "../types";

// ── Agent metadata ─────────────────────────────────────────────────────────

/** agentMeta -> Static display data for each agent. */
const AGENT_META: Record<AgentId, { label: string; Icon: React.ElementType; color: string }> = {
  guests: { label: "Guests", Icon: Users, color: "#7c5bf5" },
  "venue-catering": { label: "Venue & Catering", Icon: Building2, color: "#22c55e" },
  "entertainment-logistics": { label: "Entertainment & Logistics", Icon: Calendar, color: "#f59e0b" },
  general: { label: "General", Icon: Package, color: "#94a3b8" },
};

// ── Props ──────────────────────────────────────────────────────────────────

interface AgentGroupViewProps {
  /** agentId -> Which agent group to display */
  agentId: AgentId;
  /** event -> The parent event */
  event: PlannerEvent;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
  /** onUpdateEvent -> Callback to update event state from orchestrator IPC */
  onUpdateEvent?: (updates: Partial<PlannerEvent>, fromOrchestrator?: boolean) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * AgentGroupView -> Split-pane view for an agent's group conversation.
 * Left: task list with status/progress/summary for this agent's tasks.
 * Right: full group conversation thread + input for human-in-the-loop.
 */
export default function AgentGroupView({
  agentId,
  event,
  onNavigate,
  onUpdateEvent,
}: AgentGroupViewProps) {
  const meta = AGENT_META[agentId];
  const { Icon, color } = meta;

  // ── State ────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<OrchestratorMessage[]>([]);
  const [notifications, setNotifications] = useState<OrchestratorNotification[]>([]);
  const [localTasks, setLocalTasks] = useState<Task[]>(
    (event.tasks || []).filter((t) => (t.agentId ?? "general") === agentId)
  );
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  /** messagesEndRef -> Scroll anchor at the bottom of the conversation pane */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Initial data load ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoadingMsgs(true);

    (isElectron() ? getNotifications(event.evtId) : Promise.resolve([]))
      .then((notifs) => {
        if (cancelled) return;
        setNotifications(
          notifs.filter(
            (n: OrchestratorNotification) =>
              !n.isResolved && n.taskId && localTasks.some((t) => t.id === n.taskId)
          )
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingMsgs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event.evtId, agentId]);

  // ── Real-time IPC subscriptions ──────────────────────────────────────────

  useEffect(() => {
    if (!isElectron()) return;

    // Stream incoming chat messages for this group's tasks
    const unsubChat = onChatMessage((msg) => {
      if (localTasks.some((t) => t.id === msg.taskId)) {
        const orchestratorMsg: OrchestratorMessage = {
          id: `live-${Date.now()}`,
          runId: "",
          taskId: msg.taskId,
          role: msg.role as OrchestratorMessage["role"],
          content: msg.content,
          toolName: msg.toolName,
          toolInput: msg.toolInput,
          toolResult: msg.toolResult,
          createdAt: msg.createdAt,
        };
        setMessages((prev) => [...prev, orchestratorMsg]);
      }
    });

    return () => {
      unsubChat();
    };
  }, [event.evtId, agentId, localTasks.length]);

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Reply handler ────────────────────────────────────────────────────────


  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="agent-group-view">
      {/* Header */}
      <div className="agent-group-header">
        <button
          className="agent-detail-back"
          onClick={() => onNavigate({ kind: "event-chat", evtId: event.evtId })}
        >
          <ArrowLeft size={18} />
        </button>
        <Icon size={18} style={{ color }} />
        <h2 style={{ color }}>{meta.label} Agent</h2>
        <span className="agent-group-event-name">{event.formData.eventReason}</span>
      </div>

      {/* Body: two panes */}
      <div className="agent-group-body">

        {/* ── Left: Task list ── */}
        <div className="agent-group-tasks">
          <h3 className="agent-group-tasks-title">Tasks</h3>
          {localTasks.length === 0 ? (
            <p className="agent-group-tasks-empty">No tasks assigned to this agent.</p>
          ) : (
            <ul className="agent-group-task-list">
              {localTasks.map((task) => (
                <li
                  key={task.id}
                  className={`agent-group-task-item status-${task.status}`}
                >
                  <div className="agt-task-top">
                    {task.status === "done" ? (
                      <CheckCircle2 size={15} className="agt-status-icon done" />
                    ) : task.status === "in-progress" ? (
                      <Loader size={15} className="agt-status-icon spin in-progress" />
                    ) : task.status === "blocked" ? (
                      <AlertCircle size={15} className="agt-status-icon blocked" />
                    ) : (
                      <Bot size={15} className="agt-status-icon todo" />
                    )}
                    <span className="agt-task-title">{task.title}</span>
                  </div>
                  {/* Progress bar */}
                  {task.status === "in-progress" && (
                    <div className="agt-task-progress">
                      <div className="agt-task-progress-bar">
                        <div
                          className="agt-task-progress-fill"
                          style={{ width: `${task.aiProgressPct || 0}%` }}
                        />
                      </div>
                      {task.aiProgressText && (
                        <span className="agt-task-progress-text">{task.aiProgressText}</span>
                      )}
                    </div>
                  )}
                  {/* Completion summary (truncated) */}
                  {task.status === "done" && task.aiSummary && (
                    <p className="agt-task-summary">
                      {task.aiSummary.length > 120
                        ? `${task.aiSummary.slice(0, 120)}…`
                        : task.aiSummary}
                    </p>
                  )}
                  {/* Blocked badge */}
                  {task.status === "blocked" && (
                    <span className="agt-task-blocked-badge">Waiting for your input</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Right: Conversation thread ── */}
        <div className="agent-group-convo">
          <div className="agent-group-convo-messages">
            {loadingMsgs ? (
              <div className="agent-group-loading">
                <Loader size={20} className="spin" />
                <span>Loading conversation…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="agent-group-empty">
                <Bot size={32} style={{ opacity: 0.3 }} />
                <p>No conversation yet. Press Run on this group to start.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <AgentMessage key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Status footer */}
          <div className="agent-group-reply-idle">
            <User size={13} />
            <span>Use the Chat tab for this agent to interact with its tasks.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AgentMessage sub-component ─────────────────────────────────────────────

/**
 * AgentMessage -> Renders a single message in the group conversation.
 * Distinguishes assistant, user, tool_result, and system roles visually.
 */
function AgentMessage({ message }: { message: OrchestratorMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isToolResult = message.role === "tool_result";

  // Skip tool_result entries from connector calls — they are implementation noise.
  if (isToolResult && message.toolName && !["draft_document", "mark_task_complete", "request_user_input"].includes(message.toolName ?? "")) {
    return null;
  }

  return (
    <div className={`agent-msg role-${message.role}`}>
      {!isUser && !isSystem && (
        <div className="agent-msg-avatar">
          <Bot size={14} />
        </div>
      )}
      <div className="agent-msg-bubble">
        {message.toolName && !isToolResult && (
          <span className="agent-msg-tool-tag">{message.toolName}</span>
        )}
        {message.content && (
          <p className="agent-msg-text">{message.content}</p>
        )}
      </div>
      {isUser && (
        <div className="agent-msg-avatar user">
          <User size={14} />
        </div>
      )}
    </div>
  );
}
