import {
  Users,
  Building2,
  Calendar,
  Package,
} from "lucide-react";
import type { AgentDef, AgentId, ChatMessage } from "./types";

/**
 * AGENT_DEFS -> Derived from `AGENT` (AI worker) + `DEFINITIONS` (config list).
 * Canonical array of the 4 AI agent definitions.
 */
export const AGENT_DEFS: AgentDef[] = [
  {
    id: "guests",
    name: "Guests",
    description:
      "Manages the invite list, sends personalized invitations, and tracks RSVPs.",
    icon: Users,
    iconBg: "rgba(124, 91, 245, 0.15)",
    iconColor: "#7c5bf5",
    status: "working",
    statusText: "Ready",
    hasAlert: false,
  },
  {
    id: "venue-catering",
    name: "Venue & Catering",
    description:
      "Finds venues matching your criteria and handles all food, drink, and catering logistics.",
    icon: Building2,
    iconBg: "rgba(34, 197, 94, 0.15)",
    iconColor: "#22c55e",
    status: "working",
    statusText: "Ready",
    hasAlert: false,
  },
  {
    id: "entertainment-logistics",
    name: "Entertainment & Logistics",
    description:
      "Plans activities, schedules, music, decorations, vendor coordination, and budget tracking.",
    icon: Calendar,
    iconBg: "rgba(245, 158, 11, 0.15)",
    iconColor: "#f59e0b",
    status: "working",
    statusText: "Ready",
    hasAlert: false,
  },
  {
    id: "general",
    name: "General",
    description:
      "Handles tasks that don't fall under a specific category.",
    icon: Package,
    iconBg: "rgba(148, 163, 184, 0.15)",
    iconColor: "#94a3b8",
    status: "working",
    statusText: "Ready",
    hasAlert: false,
  },
];

/**
 * getAgentDef -> Derived from `get` (retrieve) + `Agent` + `Definition`.
 * Lookup helper that returns the AgentDef for a given AgentId.
 */
export function getAgentDef(agentId: AgentId): AgentDef {
  return AGENT_DEFS.find((a) => a.id === agentId)!;
}

/**
 * getAgentMessages -> Derived from `get` (retrieve) + `Agent` + `Messages` (filtered subset).
 * Filters a full timeline to messages from a single agent.
 */
export function getAgentMessages(
  agentId: AgentId,
  timeline: ChatMessage[]
): ChatMessage[] {
  return timeline.filter((msg) => msg.agentId === agentId);
}
