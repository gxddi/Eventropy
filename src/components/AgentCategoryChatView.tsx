import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowUp, ChevronDown, ChevronRight, ChevronUp, Wrench } from "lucide-react";
import { getAgentDef } from "../mockData";
import {
  categoryChat,
  onTaskBodyUpdated,
  onEventDetailsUpdated,
  isElectron,
} from "../lib/electronBridge";
import { getCategoryChatMessages, insertCategoryChatMessage } from "../lib/eventsDb";
import { formatDueDateDisplay } from "../lib/dateUtils";
import type { PlannerEvent, AgentId, ActiveView, ChatToolTurn } from "../types";

const AGENT_GROUPS: { id: AgentId; label: string }[] = [
  { id: "guests", label: "Guests" },
  { id: "venue-catering", label: "Venue & Catering" },
  { id: "entertainment-logistics", label: "Entertainment & Logistics" },
  { id: "general", label: "General" },
];

/**
 * LocalMsg -> Local chat message including optional tool turns for rendering.
 * toolTurns is only present on assistant messages and never persisted to the DB.
 */
type LocalMsg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolTurns?: ChatToolTurn[] };

interface AgentCategoryChatViewProps {
  event: PlannerEvent;
  agentId: AgentId;
  onNavigate: (view: ActiveView) => void;
  onUpdateEvent: (updates: Partial<PlannerEvent>) => void;
}

/**
 * AgentCategoryChatView -> Chat interface for a specific agent category.
 * The AI can call TASK_TOOLS (list_tasks, read_task, write_task_body, etc.)
 * to work on tasks collaboratively with the user.
 */
export default function AgentCategoryChatView({
  event,
  agentId,
  onNavigate,
  onUpdateEvent,
}: AgentCategoryChatViewProps) {
  const [chatMessages, setChatMessages] = useState<LocalMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // updatedTaskIds -> Set of taskIds that the AI wrote to during this session (for indicator)
  const [updatedTaskIds, setUpdatedTaskIds] = useState<Set<string>>(new Set());
  // expandedToolPills -> Set of "{msgIdx}-{toolIdx}" strings for expanded tool pill state
  const [expandedPills, setExpandedPills] = useState<Set<string>>(new Set());
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const agentLabel = AGENT_GROUPS.find((g) => g.id === agentId)?.label ?? agentId;
  const agentDef = getAgentDef(agentId);
  const tasks = (event.tasks || []).filter((t) => (t.agentId ?? "general") === agentId);

  // Load persisted chat messages on mount
  useEffect(() => {
    let cancelled = false;
    getCategoryChatMessages(event.evtId, agentId).then((rows) => {
      if (!cancelled) {
        setChatMessages(rows.map((m) => ({ role: m.role, content: m.content })));
      }
    });
    return () => { cancelled = true; };
  }, [event.evtId, agentId]);

  // Auto-scroll to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Subscribe to AI body pushes — track which tasks were updated this session
  useEffect(() => {
    if (!isElectron()) return;
    const unsub = onTaskBodyUpdated(({ taskId, body }) => {
      setUpdatedTaskIds((prev) => new Set(prev).add(taskId));
      // Reflect body change in parent event state
      onUpdateEvent({
        tasks: (event.tasks ?? []).map((t) =>
          t.id === taskId ? { ...t, body } : t
        ),
      });
    });
    return unsub;
  }, [event.tasks, onUpdateEvent]);

  // Subscribe to AI event-detail updates — merge camelCase fields into formData
  useEffect(() => {
    if (!isElectron()) return;
    const unsub = onEventDetailsUpdated(({ evtId: updEvtId, updates }) => {
      if (updEvtId !== event.evtId) return;
      onUpdateEvent({
        formData: {
          ...event.formData,
          ...(updates.eventDate !== undefined && { eventDate: updates.eventDate ?? "" }),
          ...(updates.startTime !== undefined && { startTime: updates.startTime ?? "" }),
          ...(updates.endTime !== undefined && { endTime: updates.endTime ?? "" }),
          ...(updates.venuePref !== undefined && { venuePref: updates.venuePref ?? "" }),
          ...(updates.guestCount !== undefined && { guestCount: updates.guestCount ?? "" }),
          ...(updates.notes !== undefined && { notes: updates.notes ?? "" }),
        },
      });
    });
    return unsub;
  }, [event.evtId, event.formData, onUpdateEvent]);

  const togglePill = (key: string) => {
    setExpandedPills((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleBack = () =>
    onNavigate({ kind: "event-chat", evtId: event.evtId, initialViewMode: "tasks" });

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    if (!isElectron()) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Chat is only available in the Electron app." },
      ]);
      return;
    }

    const userMsg: LocalMsg = { role: "user", content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    insertCategoryChatMessage(event.evtId, agentId, { role: "user", content: text }).catch(
      (err) => console.error("[Eventory] Failed to save user message:", err)
    );

    try {
      const fd = event.formData;
      // Build payload including evtId so the backend can resolve the Supabase UUID
      const payload = {
        evtId: event.evtId,
        agentId,
        eventContext: {
          eventReason: fd.eventReason,
          eventDate: fd.eventDate,
          startTime: fd.startTime,
          endTime: fd.endTime,
          venuePref: fd.venuePref,
          guestCount: fd.guestCount,
          foodDrinks: fd.foodDrinks,
          budget: fd.budget,
          notes: fd.notes,
        },
        tasksForCategory: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
        })),
        // Send only role/content pairs (LocalMsg text fields)
        messages: [...chatMessages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const result = await categoryChat(payload);
      const replyText = result.error ? `Error: ${result.error}` : (result.content ?? "");
      const assistantMsg: LocalMsg = {
        role: "assistant",
        content: replyText,
        toolTurns: result.toolTurns ?? [],
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      insertCategoryChatMessage(event.evtId, agentId, {
        role: "assistant",
        content: replyText,
      }).catch((err) => console.error("[Eventory] Failed to save assistant message:", err));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const fd = event.formData;
  const evtSummary = `${fd.guestCount || "?"} guests · ${fd.startTime || "?"}-${fd.endTime || "?"} · ${fd.eventDate || "No date"}`;

  return (
    <div className="agent-category-chat-view event-page">
      {/* Header — same position/structure as full event details */}
      <div className="event-chat-header">
        <button type="button" className="agent-detail-back" onClick={handleBack}>
          <ArrowLeft size={18} />
        </button>
        <h2>{fd.eventReason || "Untitled Event"}</h2>
        <span className="agents-event-summary">{evtSummary}</span>
        <span
          className="event-chat-header-agent-pill"
          style={{ background: agentDef.iconBg, color: agentDef.iconColor }}
        >
          {agentLabel}
        </span>
      </div>

      <div className="agent-category-chat-body">
        <div className="agent-category-chat-scroll">
          {/* Task list sidebar — collapsible (same UI as Link Related Events) */}
          <section className="agent-category-tasks collapsible-section">
            <button
              type="button"
              className="collapsible-toggle-header"
              onClick={() => setTasksCollapsed((c) => !c)}
              aria-expanded={!tasksCollapsed}
              aria-label={tasksCollapsed ? "Show tasks" : "Hide tasks"}
            >
              <div className="agent-category-section-header">
              <h3>Tasks</h3>
            </div>
              {tasksCollapsed ? (
                <ChevronRight size={18} className="collapsible-toggle-chevron" />
              ) : (
                <ChevronUp size={18} className="collapsible-toggle-chevron" />
              )}
            </button>
            {!tasksCollapsed && (
              <div className="collapsible-section-body">
                {tasks.length === 0 ? (
                  <p className="agent-category-empty">No tasks in this category.</p>
                ) : (
                  <ul className="agent-category-task-list agent-category-task-list-cap">
                    {tasks.map((t) => (
                      <li
                        key={t.id}
                        className={`agent-category-task-item ${t.status === "done" ? "done" : ""} ${t.status === "blocked" ? "blocked" : ""}`}
                        onClick={() =>
                          onNavigate({ kind: "task-detail", evtId: event.evtId, taskId: t.id })
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <span className="agent-category-task-title">{t.title}</span>
                        <div className="agent-category-task-meta">
                          <span className={`task-priority task-priority-${t.priority === 2 ? "high" : t.priority === 1 ? "medium" : "low"}`}>
                            {t.priority === 2 ? "High" : t.priority === 1 ? "Medium" : "Low"}
                          </span>
                          <span className={`task-document-status status-badge status-${t.status}`}>
                            {t.status === "in-progress" ? "In Progress" : t.status === "todo" ? "To Do" : t.status === "done" ? "Done" : "Blocked"}
                          </span>
                          {t.dueDate && (
                            <span className="task-document-due">
                              {formatDueDateDisplay(t.dueDate)}
                            </span>
                          )}
                          {updatedTaskIds.has(t.id) && (
                            <span className="agent-category-task-updated">updated</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Chat — always visible so user can send first message */}
          <section className="agent-category-chat-log">
            <div className="agent-category-section-header">
              <h3>Chat</h3>
            </div>
            {chatMessages.length === 0 && !chatLoading ? (
              <p className="agent-category-chat-empty">No messages yet. Send a message below.</p>
            ) : (
              <>
                {chatMessages.map((m, msgIdx) => (
                <div key={msgIdx} className={`agent-category-chat-bubble ${m.role}`}>
                  {/* Tool-call pills for assistant messages */}
                  {m.role === "assistant" && m.toolTurns && m.toolTurns.length > 0 && (
                    <div className="tool-call-pills">
                      {m.toolTurns.map((turn, toolIdx) => {
                        const pillKey = `${msgIdx}-${toolIdx}`;
                        const isExpanded = expandedPills.has(pillKey);
                        return (
                          <div key={toolIdx} className="tool-call-pill">
                            <button
                              type="button"
                              className="tool-call-pill-header"
                              onClick={() => togglePill(pillKey)}
                            >
                              <Wrench size={12} />
                              <span className="tool-call-pill-name">{turn.toolName}</span>
                              {isExpanded ? (
                                <ChevronDown size={11} />
                              ) : (
                                <ChevronRight size={11} />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="tool-call-pill-body">
                                <div className="tool-call-pill-result">{turn.resultSummary}</div>
                                <pre className="tool-call-pill-input">
                                  {JSON.stringify(turn.toolInput, null, 2)}
                                </pre>
                              </div>
                            )}
                            {!isExpanded && (
                              <span className="tool-call-pill-summary">{turn.resultSummary}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {m.role === "assistant" ? (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              ))}
                {chatLoading && (
                  <div className="agent-category-chat-bubble assistant">
                    <span className="chat-loading-dots">…</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </section>
        </div>

        {/* Chat input */}
        <div className="agent-category-chat-input-wrap">
          <div className="agent-category-chat-input dashboard-prompt">
            <input
              type="text"
              placeholder="Ask about tasks or ask the agent to work on something…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              disabled={!isElectron() || chatLoading}
            />
            <button
              type="button"
              className="send-btn"
              onClick={handleChatSend}
              disabled={!isElectron() || chatLoading || !chatInput.trim()}
              title="Send"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
