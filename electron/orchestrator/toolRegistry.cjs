/**
 * toolRegistry.cjs -> Collects tools from all enabled connectors + built-in tools.
 * Provides a unified interface for the orchestrator to discover and execute tools.
 */

const { BUILTIN_TOOLS } = require("./types.cjs");

/**
 * @typedef {Object} ConnectorInstance
 * @property {string} id
 * @property {string} name
 * @property {boolean} enabled
 * @property {object[]} tools - Claude tool schemas
 * @property {function(string, object): Promise<object>} executeTool
 */

/** @type {Map<string, ConnectorInstance>} */
const connectors = new Map();

/**
 * registerConnector -> Register a connector instance with the tool registry.
 * @param {ConnectorInstance} connector
 */
function registerConnector(connector) {
  connectors.set(connector.id, connector);
}

/**
 * unregisterConnector -> Remove a connector from the registry.
 * @param {string} connectorId
 */
function unregisterConnector(connectorId) {
  connectors.delete(connectorId);
}

/**
 * getConnector -> Get a connector by ID.
 * @param {string} connectorId
 * @returns {ConnectorInstance | undefined}
 */
function getConnector(connectorId) {
  return connectors.get(connectorId);
}

/**
 * getAllConnectors -> Get all registered connectors.
 * @returns {ConnectorInstance[]}
 */
function getAllConnectors() {
  return Array.from(connectors.values());
}

/**
 * getEnabledConnectors -> Get all enabled connectors.
 * @returns {ConnectorInstance[]}
 */
function getEnabledConnectors() {
  return Array.from(connectors.values()).filter((c) => c.enabled);
}

/**
 * getAllTools -> Get all tool definitions (built-in + enabled connectors).
 * Returns tool schemas in the format expected by the Claude API tools parameter.
 * @returns {object[]} Array of tool definitions
 */
function getAllTools() {
  const connectorTools = getEnabledConnectors().flatMap((c) => c.tools);
  return [...BUILTIN_TOOLS, ...connectorTools];
}

/**
 * executeTool -> Execute a tool by name, routing to the correct connector.
 * Built-in tools (request_user_input, mark_task_complete, update_task_progress)
 * are NOT executed here — they are handled by the EventOrchestrator directly.
 * @param {string} toolName - The tool name from Claude's tool_use block
 * @param {object} input - The tool input from Claude
 * @returns {Promise<object>} Tool execution result
 */
async function executeTool(toolName, input) {
  // Check if it's a built-in tool (handled by orchestrator, not here)
  const isBuiltin = BUILTIN_TOOLS.some((t) => t.name === toolName);
  if (isBuiltin) {
    return { _builtin: true, toolName, input };
  }

  // Find which connector owns this tool
  for (const connector of getEnabledConnectors()) {
    const tool = connector.tools.find((t) => t.name === toolName);
    if (tool) {
      try {
        const result = await connector.executeTool(toolName, input);
        return { success: true, data: result };
      } catch (err) {
        return {
          success: false,
          error: err.message || "Tool execution failed",
        };
      }
    }
  }

  return {
    success: false,
    error: `Unknown tool: ${toolName}. No connector provides this tool.`,
  };
}

module.exports = {
  registerConnector,
  unregisterConnector,
  getConnector,
  getAllConnectors,
  getEnabledConnectors,
  getAllTools,
  executeTool,
};
