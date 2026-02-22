import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, Plus, Edit2, ChevronDown, ChevronRight, Users, Building2, Calendar, Package, MessageSquare } from "lucide-react";
import { formatDueDateDisplay } from "../lib/dateUtils";
import type { Task, PlannerEvent, AccountSettings, TaskStatus, ActiveView, AgentId } from "../types";

/** AGENT_GROUPS -> Ordered agent sections for the task list. */
const AGENT_GROUPS: { id: AgentId; label: string; Icon: React.ElementType; color: string }[] = [
  { id: "guests", label: "Guests", Icon: Users, color: "#7c5bf5" },
  { id: "venue-catering", label: "Venue & Catering", Icon: Building2, color: "#22c55e" },
  { id: "entertainment-logistics", label: "Entertainment & Logistics", Icon: Calendar, color: "#f59e0b" },
  { id: "general", label: "General", Icon: Package, color: "#94a3b8" },
];

/**
 * TaskManagerProps -> Derived from `Task` + `Manager` + `Props`.
 */
interface TaskManagerProps {
  /** event -> The event whose tasks are being managed */
  event: PlannerEvent;
  /** accountSettings -> Current account settings */
  accountSettings: AccountSettings;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
  /** onUpdateEvent -> Callback to update the event */
  onUpdateEvent: (updates: Partial<PlannerEvent>) => void;
  /** taskSyncInProgress -> Disable toggle/delete to prevent duplicate syncs */
  taskSyncInProgress?: boolean;
}

/**
 * TaskManager -> Task management component with assignment and AI agent support.
 */
export default function TaskManager({
  event,
  accountSettings,
  onNavigate,
  onUpdateEvent,
  taskSyncInProgress = false,
}: TaskManagerProps) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Partial<Task>>({});
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: 0 as 0 | 1 | 2,
    dueDate: "",
    agentId: "general" as AgentId,
  });

  const tasks = event.tasks || [];
  const eventDate = event.formData.eventDate ? new Date(event.formData.eventDate) : null;
  const maxDueDate = eventDate ? eventDate.toISOString().split("T")[0] : undefined;

  const validateDueDate = (dueDate: string): boolean => {
    if (!dueDate) return true;
    if (!eventDate) return true;
    const due = new Date(dueDate);
    return due <= eventDate;
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    if (newTask.dueDate && !validateDueDate(newTask.dueDate)) {
      alert("Due date must be before or on the event date.");
      return;
    }

    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      description: newTask.description || undefined,
      status: "todo",
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      agentId: newTask.agentId,
      dependencies: [],
      blockers: [],
      createdAt: new Date().toISOString(),
    };

    onUpdateEvent({
      tasks: [...tasks, task],
    });

    setNewTask({
      title: "",
      description: "",
      priority: 0,
      dueDate: "",
      agentId: "general",
    });
    setShowAddTask(false);
  };

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTask({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : undefined,
      priority: task.priority,
      agentId: task.agentId ?? "general",
    });
  };

  const handleSaveEdit = (taskId: string) => {
    // Validate due date
    if (editingTask.dueDate && !validateDueDate(editingTask.dueDate)) {
      alert("Due date must be before or on the event date.");
      return;
    }

    const updatedTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const merged = { ...task, ...editingTask };
      const dueVal = editingTask.dueDate !== undefined
        ? (editingTask.dueDate && String(editingTask.dueDate).trim() ? String(editingTask.dueDate).trim() : undefined)
        : task.dueDate;
      return { ...merged, dueDate: dueVal };
    });

    onUpdateEvent({ tasks: updatedTasks });
    setEditingTaskId(null);
    setEditingTask({});
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTask({});
  };

  const handleTaskClick = (task: Task) => {
    onNavigate({ kind: "task-detail", evtId: event.evtId, taskId: task.id });
  };

  const handleToggleTask = (taskId: string) => {
    if (taskSyncInProgress) return;
    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId) {
        const newStatus: TaskStatus =
          task.status === "done" ? "todo" : "done";
        return {
          ...task,
          status: newStatus,
          completedAt:
            newStatus === "done" ? new Date().toISOString() : undefined,
        };
      }
      return task;
    });

    onUpdateEvent({ tasks: updatedTasks });
  };

  const handleRemoveTask = (taskId: string) => {
    if (taskSyncInProgress) return;
    onUpdateEvent({
      tasks: tasks.filter((t) => t.id !== taskId),
    });
  };

  const getPriorityClass = (priority: number): string => {
    if (priority >= 2) return "task-priority-high";
    if (priority === 1) return "task-priority-medium";
    return "task-priority-low";
  };

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    if (taskSyncInProgress) return;
    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId && task.subtasks) {
        const updatedSubtasks = task.subtasks.map((subtask) => {
          if (subtask.id === subtaskId) {
            const newStatus: TaskStatus = subtask.status === "done" ? "todo" : "done";
            return {
              ...subtask,
              status: newStatus,
              completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
            };
          }
          return subtask;
        });
        return { ...task, subtasks: updatedSubtasks };
      }
      return task;
    });

    onUpdateEvent({ tasks: updatedTasks });
  };

  const sortTask = (a: Task, b: Task) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  };

  /** getGroupTasks -> Returns tasks belonging to an agent group, sorted. */
  const getGroupTasks = (agentId: AgentId) =>
    tasks.filter((t) => (t.agentId ?? "general") === agentId).sort(sortTask);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<AgentId>>(new Set());

  const toggleGroup = (agentId: AgentId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(agentId) ? next.delete(agentId) : next.add(agentId);
      return next;
    });
  };

  const handleCategoryChat = (agentId: AgentId) => {
    onNavigate({ kind: "agent-category-chat", evtId: event.evtId, agentId });
  };

  return (
    <div className="task-manager-full-page">
      <div className="task-manager-header">
        <h2>Tasks</h2>
        <button
          className="btn-add-task"
          onClick={() => setShowAddTask(!showAddTask)}
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>

      {showAddTask && (
        <div className="add-task-form">
          <div className="add-task-field-group">
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
          </div>
          <div className="add-task-field-group">
            <textarea
              placeholder="Description (optional)"
              value={newTask.description}
              onChange={(e) =>
                setNewTask({ ...newTask, description: e.target.value })
              }
              rows={2}
            />
          </div>
          <div className="add-task-options">
            <div className="add-task-inline-row">
              <div className="add-task-row">
                <span className="field-label">Category</span>
                <div className="category-picker">
                  {AGENT_GROUPS.map(({ id, label, Icon, color }) => (
                    <button
                      key={id}
                      type="button"
                      className={`category-option ${newTask.agentId === id ? "selected" : ""}`}
                      onClick={() => setNewTask({ ...newTask, agentId: id })}
                    >
                      <Icon size={12} style={{ color }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="add-task-row">
                <span className="field-label">Priority</span>
                <div className="priority-picker">
                  {([0, 1, 2] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`task-priority ${getPriorityClass(p)} ${newTask.priority === p ? "selected" : ""}`}
                      onClick={() => setNewTask({ ...newTask, priority: p })}
                    >
                      {p === 2 ? "High" : p === 1 ? "Medium" : "Low"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="add-task-row">
              <span className="field-label">Due date</span>
              <input
                type="date"
                value={newTask.dueDate}
                max={maxDueDate}
                onChange={(e) =>
                  setNewTask({ ...newTask, dueDate: e.target.value })
                }
              />
              {maxDueDate && (
                <span className="date-hint">Must be before {new Date(maxDueDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="add-task-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowAddTask(false)}>
              Cancel
            </button>
            <button type="button" className="btn-add-task" onClick={handleAddTask}>
              <Plus size={16} />
              Add Task
            </button>
          </div>
        </div>
      )}

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="task-empty">
            <p>No tasks yet. Add one to get started!</p>
          </div>
        ) : (
        AGENT_GROUPS.map(({ id: groupId, label, Icon, color }) => {
          const groupTasks = getGroupTasks(groupId);
          const isCollapsed = collapsedGroups.has(groupId);
            const blockedCount = groupTasks.filter((t) => t.status === "blocked").length;
          const doneCount = groupTasks.filter((t) => t.status === "done").length;
          return (
            <div key={groupId} className="task-agent-group">
              <div className="task-agent-group-header-row">
                <button
                  className="task-agent-group-header"
                  onClick={() => toggleGroup(groupId)}
                  style={{ "--agent-color": color } as React.CSSProperties}
                >
                  <span className="task-agent-group-chevron">
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                  <Icon size={15} style={{ color }} />
                  <span className="task-agent-group-label">{label}</span>
                  {blockedCount > 0 && (
                    <AlertCircle size={13} className="task-agent-group-alert" />
                  )}
                  <span className="task-agent-group-count">
                    {doneCount}/{groupTasks.length}
                  </span>
                </button>
                <div className="task-agent-group-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="task-agent-group-action-btn"
                    onClick={() => handleCategoryChat(groupId)}
                  >
                    <MessageSquare size={14} />
                    Chat
                  </button>
                </div>
              </div>
              {!isCollapsed && (
                groupTasks.length === 0 ? (
                  <div className="task-agent-group-empty">No tasks in this section</div>
                ) : (
                  groupTasks.map((task) => (
            <div
              key={task.id}
              className={`task-item ${task.status === "done" ? "completed" : ""} ${task.blockers.length > 0 ? "blocked" : ""} ${task.assignedTo === "ai-agent" ? "ai-assigned" : ""}`}
            >
              <div className="task-item-main">
                <button
                  type="button"
                  className="task-checkbox"
                  onClick={() => handleToggleTask(task.id)}
                  disabled={taskSyncInProgress}
                  aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
                  title={taskSyncInProgress ? "Syncing…" : undefined}
                >
                  {task.status === "done" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>
                <div className="task-content">
                  {editingTaskId === task.id ? (
                    <div className="task-edit-form">
                      <input
                        type="text"
                        value={editingTask.title || ""}
                        onChange={(e) =>
                          setEditingTask({ ...editingTask, title: e.target.value })
                        }
                        placeholder="Task title"
                      />
                      <textarea
                        value={editingTask.description || ""}
                        onChange={(e) =>
                          setEditingTask({ ...editingTask, description: e.target.value })
                        }
                        placeholder="Description (optional)"
                        rows={2}
                      />
                      <div className="add-task-inline-row">
                        <div className="add-task-row">
                          <span className="field-label">Category</span>
                          <div className="category-picker">
                            {AGENT_GROUPS.map(({ id, label, Icon, color }) => (
                              <button
                                key={id}
                                type="button"
                                className={`category-option ${(editingTask.agentId ?? "general") === id ? "selected" : ""}`}
                                onClick={() => setEditingTask({ ...editingTask, agentId: id })}
                              >
                                <Icon size={12} style={{ color }} />
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="add-task-row">
                          <span className="field-label">Priority</span>
                          <div className="priority-picker">
                            {([0, 1, 2] as const).map((p) => (
                              <button
                                key={p}
                                type="button"
                                className={`task-priority ${getPriorityClass(p)} ${(editingTask.priority ?? 0) === p ? "selected" : ""}`}
                                onClick={() => setEditingTask({ ...editingTask, priority: p })}
                              >
                                {p === 2 ? "High" : p === 1 ? "Medium" : "Low"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="add-task-row">
                        <span className="field-label">Due date</span>
                        <input
                          type="date"
                          value={editingTask.dueDate || ""}
                          max={maxDueDate}
                          onChange={(e) =>
                            setEditingTask({ ...editingTask, dueDate: e.target.value })
                          }
                        />
                        {maxDueDate && editingTask.dueDate && !validateDueDate(editingTask.dueDate) && (
                          <span className="date-error">Due date must be before event date</span>
                        )}
                      </div>
                      <div className="task-edit-actions">
                        <button
                          className="btn-secondary"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => handleSaveEdit(task.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="task-header">
                        <h3
                          className="task-title"
                          onClick={() => handleTaskClick(task)}
                          style={{ cursor: "pointer" }}
                        >
                          {task.title}
                        </h3>
                        <div className="task-header-actions">
                          {(task.priority === 0 || task.priority === 1 || task.priority === 2) && (
                            <span
                              className={`task-priority ${getPriorityClass(task.priority)}`}
                            >
                              {task.priority === 2 ? "High" : task.priority === 1 ? "Medium" : "Low"}
                            </span>
                          )}
                          <button
                            className="task-edit-btn"
                            onClick={() => handleStartEdit(task)}
                            title="Edit task"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                      <div className="task-meta">
                        {task.dueDate && (
                          <span className="task-due-date">
                            Due: {formatDueDateDisplay(task.dueDate)}
                          </span>
                        )}
                      </div>
                      {/* Body excerpt — first 80 chars of the document */}
                      {task.body && task.body.trim().length > 0 && (
                        <p className="task-body-excerpt">
                          {task.body.trim().slice(0, 80)}
                          {task.body.trim().length > 80 ? "…" : ""}
                        </p>
                      )}
                      {task.blockers.length > 0 && (
                        <div className="task-blockers">
                          <AlertCircle size={14} />
                          <span>Blocked by {task.blockers.length} task(s)</span>
                        </div>
                      )}
                      {task.dependencies.length > 0 && (
                        <div className="task-dependencies">
                          <span>Depends on {task.dependencies.length} task(s)</span>
                        </div>
                      )}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="task-subtasks">
                          <button
                            className="task-subtasks-toggle"
                            onClick={() => toggleTaskExpansion(task.id)}
                          >
                            {expandedTasks.has(task.id) ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                            <span>
                              Subtasks ({task.subtasks.filter((s) => s.status === "done").length}/{task.subtasks.length})
                            </span>
                          </button>
                          {expandedTasks.has(task.id) && (
                            <div className="subtasks-list">
                              {task.subtasks.map((subtask) => (
                                <div
                                  key={subtask.id}
                                  className={`subtask-item ${subtask.status === "done" ? "completed" : ""}`}
                                >
                                  <button
                                    className="subtask-checkbox"
                                    onClick={() => handleToggleSubtask(task.id, subtask.id)}
                                  >
                                    {subtask.status === "done" ? (
                                      <CheckCircle2 size={16} />
                                    ) : (
                                      <Circle size={16} />
                                    )}
                                  </button>
                                  <span className="subtask-title">{subtask.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {editingTaskId !== task.id && (
                <button
                  type="button"
                  className="task-remove"
                  onClick={() => handleRemoveTask(task.id)}
                  disabled={taskSyncInProgress}
                  aria-label="Remove task"
                  title={taskSyncInProgress ? "Syncing…" : "Remove task"}
                >
                  ×
                </button>
              )}
            </div>
                ))
              )
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
