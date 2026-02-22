import { AGENT_DEFS } from "../mockData";
import type { AgentId } from "../types";

/**
 * AgentTabBarProps -> Derived from `Agent` + `Tab` + `Bar` + `Props`.
 */
interface AgentTabBarProps {
  /** activeTab -> Currently selected agent tab; null = "All Agents" feed */
  activeTab: AgentId | null;
  /** onTabSelect -> Callback when a tab is clicked */
  onTabSelect: (agentId: AgentId | null) => void;
}

/**
 * AgentTabBar -> Horizontal scrollable row of agent sub-tabs.
 * First tab is "All" (combined feed), followed by the 6 individual agents.
 */
export default function AgentTabBar({ activeTab, onTabSelect }: AgentTabBarProps) {
  return (
    <div className="agent-tab-bar">
      <div
        className={`agent-tab ${activeTab === null ? "agent-tab--active" : ""}`}
        onClick={() => onTabSelect(null)}
      >
        All Agents
      </div>
      {AGENT_DEFS.map((agent) => (
        <div
          key={agent.id}
          className={`agent-tab ${activeTab === agent.id ? "agent-tab--active" : ""}`}
          onClick={() => onTabSelect(agent.id)}
        >
          <agent.icon size={14} style={{ color: agent.iconColor }} />
          {agent.name}
          {agent.hasAlert && <span className="tab-alert-dot" />}
        </div>
      ))}
    </div>
  );
}
