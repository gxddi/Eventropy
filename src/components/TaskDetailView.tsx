import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Bot, ChevronDown, ChevronRight, Wrench, MessageSquare, Pencil, Eye } from "lucide-react";
import {
  getTaskMessages,
  updateTaskBody,
  onTaskBodyUpdated,
  isElectron,
} from "../lib/electronBridge";
import type { Task, PlannerEvent, ActiveView, OrchestratorMessage } from "../types";

/**
 * TaskDetailViewProps -> Derived from `Task` + `Detail` + `View` + `Props`.
 */
interface TaskDetailViewProps {
  /** task -> The task being viewed */
  task: Task;
  /** event -> The event this task belongs to */
  event: PlannerEvent;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
  /** onUpdateTask -> Callback to update the task */
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

/**
 * TaskDetailView -> Task document page.
 * Displays an editable markdown body shared between user and AI agent.
 * Autosaves via the task:update-body IPC handler (debounced 800 ms).
 */
export default function TaskDetailView({
  task,
  event,
  onNavigate,
  onUpdateTask,
}: TaskDetailViewProps) {
  const [bodyVal, setBodyVal] = useState(task.body ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [bodyMode, setBodyMode] = useState<"write" | "preview">("preview");
  // aiLog -> Orchestrator messages for this task (loaded on expand)
  const [aiLog, setAiLog] = useState<OrchestratorMessage[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const [logLoading, setLogLoading] = useState(false);

  // debounceRef -> Timer handle for autosave debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync body when navigating to a different task
  useEffect(() => {
    setBodyVal(task.body ?? "");
    setSaveState("idle");
  }, [task.id]);

  // Subscribe to AI body pushes from main process
  useEffect(() => {
    if (!isElectron()) return;
    const unsub = onTaskBodyUpdated(({ taskId, body: newBody }) => {
      if (taskId === task.id) {
        setBodyVal(newBody);
        onUpdateTask(task.id, { body: newBody });
      }
    });
    return unsub;
  }, [task.id, onUpdateTask]);

  // handleBodyChange -> Debounce autosave; update local state immediately
  const handleBodyChange = useCallback(
    (value: string) => {
      setBodyVal(value);
      setSaveState("saving");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        await updateTaskBody(task.id, value);
        onUpdateTask(task.id, { body: value });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }, 800);
    },
    [task.id, onUpdateTask]
  );

  // Load AI activity log when the user expands the collapsible section
  useEffect(() => {
    if (!logExpanded || !isElectron()) return;
    setLogLoading(true);
    getTaskMessages(task.id).then((msgs) => {
      setAiLog(msgs);
      setLogLoading(false);
    });
  }, [logExpanded, task.id]);

  return (
    <div className="task-document-view">
      {/* Header */}
      <div className="task-document-header">
        <button
          className="agent-detail-back"
          onClick={() => onNavigate({ kind: "event-chat", evtId: event.evtId, initialViewMode: "tasks" })}
          title="Back to tasks"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="task-document-title-section">
          <h2 className="task-document-title">{task.title}</h2>
        </div>
        <button
          className="task-agent-group-action-btn"
          onClick={() =>
            onNavigate({
              kind: "agent-category-chat",
              evtId: event.evtId,
              agentId: task.agentId ?? "general",
            })
          }
        >
          <MessageSquare size={14} />
          Chat
        </button>
      </div>

      {/* Body mode toggle */}
      <div className="task-document-mode-bar">
        <div className="task-document-mode-toggle">
          <button
            className={`view-mode-btn ${bodyMode === "write" ? "active" : ""}`}
            onClick={() => setBodyMode("write")}
          >
            <Pencil size={14} />
            <span>Write</span>
          </button>
          <button
            className={`view-mode-btn ${bodyMode === "preview" ? "active" : ""}`}
            onClick={() => setBodyMode("preview")}
          >
            <Eye size={14} />
            <span>Preview</span>
          </button>
        </div>
        <span className="task-doc-autosave-indicator-inline">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
        </span>
      </div>

      {/* Document body */}
      <div className="task-document-body-wrap">
        {bodyMode === "write" ? (
          <textarea
            className="task-document-body"
            value={bodyVal}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="Start writing or ask the agent to work on this task in the chat…"
            spellCheck={false}
          />
        ) : (
          <div className="task-document-preview">
            {bodyVal.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyVal}</ReactMarkdown>
            ) : (
              <p className="task-document-preview-empty">Nothing here yet. Switch to Write or ask the agent in Chat.</p>
            )}
          </div>
        )}
      </div>

      {/* Collapsible AI activity log */}
      <div className="task-document-ai-log">
        <button
          className="task-document-ai-log-toggle"
          onClick={() => setLogExpanded((v) => !v)}
          type="button"
        >
          {logExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Bot size={13} />
          AI activity
          {aiLog.length > 0 && (
            <span className="task-document-ai-log-count">{aiLog.length} turns</span>
          )}
        </button>
        {logExpanded && (
          <div className="task-document-ai-log-body">
            {logLoading ? (
              <p className="task-document-ai-log-empty">Loading…</p>
            ) : aiLog.length === 0 ? (
              <p className="task-document-ai-log-empty">No AI activity yet.</p>
            ) : (
              aiLog.map((msg) => (
                <div key={msg.id} className={`task-ai-log-entry log-role-${msg.role}`}>
                  <span className="task-ai-log-label">
                    {msg.toolName ? (
                      <>
                        <Wrench size={11} />
                        {msg.toolName}
                      </>
                    ) : (
                      <>
                        <Bot size={11} />
                        {msg.role}
                      </>
                    )}
                  </span>
                  <span className="task-ai-log-content">
                    {msg.content ??
                      (msg.toolResult ? JSON.stringify(msg.toolResult) : "")}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
