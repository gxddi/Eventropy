/**
 * eventsDb — Supabase fetch + map to app types (PlannerEvent, ChatMessage, Task, etc.)
 */
import { supabase } from "./supabase";
import type {
  PlannerEvent,
  EventFormData,
  EventStatus,
  ChatMessage,
  Task,
  Subtask,
  Document,
  Collaborator,
} from "../types";

/** DB row shapes (match Supabase schema) */
export interface EventRow {
  id: string;
  evt_slug: string | null;
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_pref: string | null;
  venue_location: Record<string, unknown> | null;
  guest_count: string | null;
  food_drinks: string | null;
  goals: Record<string, unknown> | null;
  budget: number | null;
  notes: string | null;
  linked_event_ids: string[] | null;
  status: string;
  account_type: string | null;
  retro_created: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  event_id: string;
  agent_id: string;
  role: string;
  content: string;
  message_at: string;
}

export interface TaskRow {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  assigned_to: string | null;
  agent_id: string | null;
  dependencies: string[] | null;
  blockers: string[] | null;
  completed_at: string | null;
  created_at: string;
  /** body -> Collaborative markdown document (added in migration 003) */
  body: string;
}

export interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  status: string;
  completed_at: string | null;
}

export interface DocumentRow {
  id: string;
  event_id: string;
  type: string;
  name: string;
  url: string;
  category: string | null;
  uploaded_at: string;
}

export interface CollaboratorRow {
  id: string;
  event_id: string;
  name: string;
  email: string;
  role: string | null;
}

function eventRowToFormData(row: EventRow): EventFormData {
  return {
    eventReason: row.name,
    eventDate: row.event_date ?? "",
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    venuePref: row.venue_pref ?? "",
    venueLocation: row.venue_location
      ? (row.venue_location as EventFormData["venueLocation"])
      : undefined,
    guestCount: row.guest_count ?? "",
    foodDrinks: (row.food_drinks as EventFormData["foodDrinks"]) ?? "none",
    goals: row.goals ? (row.goals as EventFormData["goals"]) : undefined,
    budget: row.budget ?? undefined,
    notes: row.notes ?? "",
    linkedEventIds: row.linked_event_ids ?? undefined,
  };
}

function chatRowToMessage(row: ChatMessageRow, evtId: string): ChatMessage {
  return {
    msgId: row.id,
    agentId: row.agent_id as ChatMessage["agentId"],
    role: row.role as ChatMessage["role"],
    content: row.content,
    timestamp: row.message_at,
  };
}

function taskRowToTask(row: TaskRow, subtasks: Subtask[]): Task {
  const dueDateRaw = row.due_date ?? undefined;
  const dueDate =
    dueDateRaw != null && String(dueDateRaw).trim() !== ""
      ? String(dueDateRaw).trim().slice(0, 10)
      : undefined;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as Task["status"],
    priority: row.priority,
    dueDate,
    assignedTo: row.assigned_to ?? undefined,
    dependencies: row.dependencies ?? [],
    blockers: row.blockers ?? [],
    subtasks: subtasks.length ? subtasks : undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    agentId: (row.agent_id as Task["agentId"]) ?? undefined,
    body: row.body ?? "",
  };
}

function subtaskRowToSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Subtask["status"],
    completedAt: row.completed_at ?? undefined,
  };
}

function documentRowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    type: row.type as "file" | "link",
    name: row.name,
    url: row.url,
    uploadedAt: row.uploaded_at,
    category: (row.category as Document["category"]) ?? undefined,
  };
}

function collaboratorRowToCollaborator(row: CollaboratorRow): Collaborator {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? undefined,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve app evtId (evt_slug or UUID) to Supabase events.id (UUID). */
export async function getEventIdByEvtId(evtId: string): Promise<string | null> {
  if (UUID_REGEX.test(evtId.trim())) return evtId.trim();
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("evt_slug", evtId)
    .maybeSingle();
  if (error) {
    console.error("[Eventropy] getEventIdByEvtId error:", error);
    return null;
  }
  return data?.id ?? null;
}

/** Insert a new event; returns id and evt_slug for use as evtId in the app. */
export async function insertEvent(
  formData: EventFormData,
  opts: { status?: EventStatus; accountType?: "personal" | "organization" }
): Promise<{ id: string; evt_slug: string }> {
  const evt_slug = `evt-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("events")
    .insert({
      evt_slug,
      name: formData.eventReason,
      event_date: formData.eventDate || null,
      start_time: formData.startTime || null,
      end_time: formData.endTime || null,
      venue_pref: formData.venuePref || null,
      venue_location: formData.venueLocation ?? null,
      guest_count: formData.guestCount || null,
      food_drinks: formData.foodDrinks || null,
      goals: formData.goals ?? null,
      budget: formData.budget ?? null,
      notes: formData.notes ?? null,
      linked_event_ids: formData.linkedEventIds ?? null,
      status: opts.status ?? "planning",
      account_type: opts.accountType ?? "personal",
    })
    .select("id, evt_slug")
    .single();
  if (error) throw error;
  return { id: data.id, evt_slug: data.evt_slug ?? evt_slug };
}

/** Insert one chat message for an event (event_id = Supabase events.id). */
export async function insertChatMessage(
  eventId: string,
  msg: { agent_id: string; role: string; content: string; message_at?: string }
): Promise<void> {
  const { error } = await supabase.from("chat_messages").insert({
    event_id: eventId,
    agent_id: msg.agent_id,
    role: msg.role,
    content: msg.content,
    message_at: msg.message_at ?? new Date().toISOString(),
  });
  if (error) throw error;
}

/** CategoryChatMessage -> Simplified chat message for category chat UI. */
export interface CategoryChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Get category chat messages for an event filtered by agent_id.
 * evtId can be events.id (UUID) or evt_slug.
 */
export async function getCategoryChatMessages(
  evtId: string,
  agentId: string
): Promise<CategoryChatMessage[]> {
  const eventUuid = await getEventIdByEvtId(evtId);
  if (!eventUuid) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, message_at")
    .eq("event_id", eventUuid)
    .eq("agent_id", agentId)
    .in("role", ["user", "agent"])
    .order("message_at", { ascending: true });

  if (error) {
    console.error("[Eventropy] getCategoryChatMessages error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role === "agent" ? "assistant" : "user",
    content: row.content,
    timestamp: row.message_at,
  }));
}

/**
 * Insert a category chat message (user or assistant).
 * Maps "assistant" role to "agent" for Supabase storage.
 * evtId can be events.id (UUID) or evt_slug.
 */
export async function insertCategoryChatMessage(
  evtId: string,
  agentId: string,
  msg: { role: "user" | "assistant"; content: string }
): Promise<void> {
  const eventUuid = await getEventIdByEvtId(evtId);
  if (!eventUuid) {
    console.warn("[Eventropy] insertCategoryChatMessage: event not found for evtId:", evtId);
    return;
  }

  const { error } = await supabase.from("chat_messages").insert({
    event_id: eventUuid,
    agent_id: agentId,
    role: msg.role === "assistant" ? "agent" : "user",
    content: msg.content,
    message_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Eventropy] insertCategoryChatMessage error:", error);
    throw error;
  }
}

/** Replace all tasks (and subtasks) for an event. Returns persisted tasks with DB ids. evtId can be events.id (UUID) or evt_slug. */
export async function syncEventTasks(evtId: string, tasks: Task[]): Promise<Task[]> {
  const eventUuid = await getEventIdByEvtId(evtId);
  if (!eventUuid) {
    console.warn("[Eventropy] syncEventTasks: event not found for evtId:", evtId, "- tasks not persisted.");
    return tasks;
  }

  const { error: delError } = await supabase
    .from("tasks")
    .delete()
    .eq("event_id", eventUuid);
  if (delError) throw delError;

  for (const t of tasks) {
    const dueDateVal =
      t.dueDate != null && String(t.dueDate).trim() !== ""
        ? String(t.dueDate).trim()
        : null;
    const { data: taskRow, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        event_id: eventUuid,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        due_date: dueDateVal,
        assigned_to: t.assignedTo ?? null,
        agent_id: t.agentId ?? null,
        dependencies: t.dependencies ?? [],
        blockers: t.blockers ?? [],
        completed_at: t.completedAt ?? null,
        /** body -> Preserve existing task document (migration 003 required) */
        body: t.body ?? "",
      })
      .select("id")
      .single();
    if (taskErr) throw taskErr;

    const subtasks = t.subtasks ?? [];
    for (const s of subtasks) {
      const { error: subErr } = await supabase.from("subtasks").insert({
        task_id: taskRow.id,
        title: s.title,
        status: s.status,
        completed_at: s.completedAt ?? null,
      });
      if (subErr) throw subErr;
    }
  }

  const [tasksRes, subtasksRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("event_id", eventUuid).order("created_at"),
    supabase.from("subtasks").select("*"),
  ]);
  const taskRows: TaskRow[] = tasksRes.data ?? [];
  const allSubtaskRows: SubtaskRow[] = subtasksRes.data ?? [];
  const taskIds = new Set(taskRows.map((r) => r.id));
  const subtasksByTaskId = new Map<string, Subtask[]>();
  for (const row of allSubtaskRows) {
    if (!taskIds.has(row.task_id)) continue;
    const sub = subtaskRowToSubtask(row);
    if (!subtasksByTaskId.has(row.task_id)) subtasksByTaskId.set(row.task_id, []);
    subtasksByTaskId.get(row.task_id)!.push(sub);
  }
  return taskRows.map((row) => taskRowToTask(row, subtasksByTaskId.get(row.id) ?? []));
}

/**
 * updateTaskBody -> Update the collaborative document body for a task.
 * Called by the renderer when the user edits the task body manually (debounced).
 * The AI uses the task:update-body IPC channel to do the same from the main process.
 * @param taskId - Supabase tasks.id (UUID)
 * @param body - Full markdown content to save
 */
export async function updateTaskBody(taskId: string, body: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ body }).eq("id", taskId);
  if (error) throw error;
}

/**
 * Delete an event and all related rows (Supabase CASCADE: chat_messages, tasks, subtasks,
 * documents, collaborators, orchestrator_runs, orchestrator_messages, orchestrator_notifications).
 * evtId can be events.id (UUID) or evt_slug.
 */
export async function deleteEvent(evtId: string): Promise<void> {
  const eventUuid = await getEventIdByEvtId(evtId);
  if (!eventUuid) return;
  const { error } = await supabase.from("events").delete().eq("id", eventUuid);
  if (error) throw error;
}

/** Update event fields (status, formData-backed columns, etc.). */
export async function updateEvent(
  evtId: string,
  updates: Partial<{
    status: EventStatus;
    formData: EventFormData;
    retro_created: boolean;
  }>
): Promise<void> {
  const eventUuid = await getEventIdByEvtId(evtId);
  if (!eventUuid) return;

  const row: Record<string, unknown> = {};
  if (updates.status) row.status = updates.status;
  if (updates.retro_created != null) row.retro_created = updates.retro_created;
  if (updates.formData) {
    const f = updates.formData;
    row.name = f.eventReason;
    row.event_date = f.eventDate || null;
    row.start_time = f.startTime || null;
    row.end_time = f.endTime || null;
    row.venue_pref = f.venuePref || null;
    row.venue_location = f.venueLocation ?? null;
    row.guest_count = f.guestCount || null;
    row.food_drinks = f.foodDrinks || null;
    row.goals = f.goals ?? null;
    row.budget = f.budget ?? null;
    row.notes = f.notes ?? null;
    row.linked_event_ids = f.linkedEventIds ?? null;
  }
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("events").update(row).eq("id", eventUuid);
  if (error) throw error;
}

/**
 * Fetch all events with chat messages, tasks (and subtasks), documents, collaborators.
 * Returns PlannerEvent[] for use in eventRegistry.
 */
export async function fetchAllEvents(): Promise<PlannerEvent[]> {
  const [eventsRes, messagesRes, tasksRes, subtasksRes, docsRes, collabRes] = await Promise.all([
    supabase.from("events").select("*").order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("*").order("message_at", { ascending: true }),
    supabase.from("tasks").select("*"),
    supabase.from("subtasks").select("*"),
    supabase.from("documents").select("*"),
    supabase.from("collaborators").select("*"),
  ]);

  if (eventsRes.error) throw eventsRes.error;

  const events: EventRow[] = eventsRes.data ?? [];
  const messages: ChatMessageRow[] = messagesRes.data ?? [];
  const tasks: TaskRow[] = tasksRes.data ?? [];
  const subtasks: SubtaskRow[] = subtasksRes.data ?? [];
  const documents: DocumentRow[] = docsRes.data ?? [];
  const collaborators: CollaboratorRow[] = collabRes.data ?? [];

  const subtasksByTaskId = new Map<string, Subtask[]>();
  for (const row of subtasks) {
    const sub = subtaskRowToSubtask(row);
    if (!subtasksByTaskId.has(row.task_id))
      subtasksByTaskId.set(row.task_id, []);
    subtasksByTaskId.get(row.task_id)!.push(sub);
  }

  return events.map((evt) => {
    const evtId = evt.evt_slug ?? evt.id;
    const eventMessages = messages
      .filter((m) => m.event_id === evt.id)
      .map((m) => chatRowToMessage(m, evtId));
    const eventTasks = tasks
      .filter((t) => t.event_id === evt.id)
      .map((t) =>
        taskRowToTask(t, subtasksByTaskId.get(t.id) ?? [])
      );
    const eventDocs = documents
      .filter((d) => d.event_id === evt.id)
      .map(documentRowToDocument);
    const eventCollabs = collaborators
      .filter((c) => c.event_id === evt.id)
      .map(collaboratorRowToCollaborator);

    const formData = eventRowToFormData(evt);

    const plannerEvent: PlannerEvent = {
      evtId,
      formData,
      status: evt.status as EventStatus,
      createdAt: evt.created_at,
      chatTimeline: eventMessages,
      tasks: eventTasks.length ? eventTasks : undefined,
      documents: eventDocs.length ? eventDocs : undefined,
      collaborators: eventCollabs.length ? eventCollabs : undefined,
      accountType: (evt.account_type as PlannerEvent["accountType"]) ?? undefined,
      retroCreated: evt.retro_created ?? undefined,
    };

    return plannerEvent;
  });
}
