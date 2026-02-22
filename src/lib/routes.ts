import type { ActiveView, AgentId } from "../types";

/**
 * Pathname -> ActiveView. Parses the current URL path into app view state.
 */
export function pathnameToView(pathname: string): ActiveView {
  const segments = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] === "dashboard") return { kind: "dashboard" };
  if (segments[0] === "calendar") return { kind: "calendar" };
  if (segments[0] === "timeline") {
    const evtId = segments[1];
    return evtId ? { kind: "timeline", evtId } : { kind: "timeline" };
  }
  if (segments[0] === "event" && segments[1]) {
    const evtId = segments[1];
    if (segments[2] === "agent" && segments[3]) {
      const agentId = segments[3] as AgentId;
      return segments[4] === "chat" ? { kind: "agent-category-chat", evtId, agentId } : { kind: "agent-detail", evtId, agentId };
    }
    if (segments[2] === "task" && segments[3]) return { kind: "task-detail", evtId, taskId: segments[3] };
    const viewMode = segments[2] === "tasks" ? "tasks" : "details";
    return { kind: "event-chat", evtId, initialViewMode: viewMode };
  }
  if (segments[0] === "settings") return { kind: "settings" };
  return { kind: "dashboard" };
}

/**
 * ActiveView -> pathname. Builds the URL path for a given view (for use with navigate).
 */
export function viewToPath(view: ActiveView): string {
  switch (view.kind) {
    case "dashboard":
      return "/dashboard";
    case "calendar":
      return "/calendar";
    case "timeline":
      return view.evtId ? `/timeline/${view.evtId}` : "/timeline";
    case "event-chat": {
      const mode = view.initialViewMode === "tasks" ? "tasks" : "details";
      return `/event/${view.evtId}/${mode}`;
    }
    case "agent-detail":
      return `/event/${view.evtId}/agent/${view.agentId}`;
    case "agent-category-chat":
      return `/event/${view.evtId}/agent/${view.agentId}/chat`;
    case "task-detail":
      return `/event/${view.evtId}/task/${view.taskId}`;
    case "settings":
      return "/settings";
    default:
      return "/dashboard";
  }
}
