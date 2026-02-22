/**
 * types.cjs -> Connector type definitions and base class.
 * Each connector implements this interface to expose tools to the orchestrator.
 */

/**
 * BaseConnector -> Abstract base for all connectors.
 * Subclasses must implement initialize(), testConnection(), executeTool(), and destroy().
 */
class BaseConnector {
  /**
   * @param {object} opts
   * @param {string} opts.id - Connector identifier (e.g., "gmail", "notion")
   * @param {string} opts.name - Display name
   * @param {string} opts.description - What this connector does
   * @param {string} opts.icon - Icon identifier for the UI
   * @param {string} opts.authType - "api_key" or "oauth2"
   * @param {object[]} opts.configFields - Configuration fields for settings UI
   * @param {object[]} opts.tools - Claude tool schemas
   */
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.description = opts.description;
    this.icon = opts.icon || "";
    this.authType = opts.authType || "api_key";
    this.configFields = opts.configFields || [];
    this.tools = opts.tools || [];
    this.enabled = false;
    this.isConnected = false;
    this.lastTestedAt = null;
    this.lastTestOk = null;
  }

  /**
   * initialize -> Set up the connector with credentials and config.
   * @param {Record<string, string>} secrets - API keys, tokens, etc.
   * @param {Record<string, unknown>} config - Non-secret configuration
   */
  async initialize(secrets, config) {
    throw new Error("initialize() must be implemented by subclass.");
  }

  /**
   * testConnection -> Verify the connector can reach its service.
   * @returns {Promise<{ ok: boolean; error?: string }>}
   */
  async testConnection() {
    throw new Error("testConnection() must be implemented by subclass.");
  }

  /**
   * executeTool -> Execute a tool by name with the given input.
   * @param {string} toolName - The tool to execute
   * @param {Record<string, unknown>} input - Tool input parameters
   * @returns {Promise<unknown>}
   */
  async executeTool(toolName, input) {
    throw new Error("executeTool() must be implemented by subclass.");
  }

  /**
   * destroy -> Clean up resources.
   */
  destroy() {
    // Override if needed
  }
}

module.exports = { BaseConnector };
