/**
 * notion.cjs -> Notion connector (API key authentication).
 * Exposes tools for creating/updating pages, searching, and querying databases.
 */

const { BaseConnector } = require("./types.cjs");

class NotionConnector extends BaseConnector {
  constructor() {
    super({
      id: "notion",
      name: "Notion",
      description: "Create pages, update databases, and search your Notion workspace for event planning documentation.",
      icon: "notebook",
      authType: "api_key",
      configFields: [
        {
          key: "api_key",
          label: "Integration Token",
          type: "password",
          required: true,
          placeholder: "ntn_...",
          helpText: "Create an internal integration at notion.so/my-integrations",
        },
      ],
      tools: [
        {
          name: "notion_create_page",
          description: "Create a new page in a Notion database or as a child of another page.",
          input_schema: {
            type: "object",
            properties: {
              parent_id: {
                type: "string",
                description: "The ID of the parent page or database",
              },
              parent_type: {
                type: "string",
                enum: ["database_id", "page_id"],
                description: "Whether the parent is a database or page",
              },
              title: {
                type: "string",
                description: "The title of the new page",
              },
              content: {
                type: "string",
                description: "Markdown content for the page body",
              },
              properties: {
                type: "object",
                description: "Additional database properties as key-value pairs",
              },
            },
            required: ["parent_id", "parent_type", "title"],
          },
        },
        {
          name: "notion_update_page",
          description: "Update properties of an existing Notion page.",
          input_schema: {
            type: "object",
            properties: {
              page_id: {
                type: "string",
                description: "The ID of the page to update",
              },
              properties: {
                type: "object",
                description: "Properties to update as key-value pairs",
              },
            },
            required: ["page_id", "properties"],
          },
        },
        {
          name: "notion_search",
          description: "Search for pages and databases in the Notion workspace.",
          input_schema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query text",
              },
              filter_type: {
                type: "string",
                enum: ["page", "database"],
                description: "Filter results to pages or databases only",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "notion_query_database",
          description: "Query a Notion database with optional filters and sorts.",
          input_schema: {
            type: "object",
            properties: {
              database_id: {
                type: "string",
                description: "The ID of the database to query",
              },
              filter: {
                type: "object",
                description: "Notion filter object (optional)",
              },
              sorts: {
                type: "array",
                items: { type: "object" },
                description: "Array of sort objects (optional)",
              },
            },
            required: ["database_id"],
          },
        },
      ],
    });

    this.apiKey = null;
    this.baseUrl = "https://api.notion.com/v1";
    this.notionVersion = "2022-06-28";
  }

  async initialize(secrets) {
    this.apiKey = secrets.api_key;
    if (this.apiKey) {
      this.isConnected = true;
    }
  }

  async testConnection() {
    if (!this.apiKey) {
      return { ok: false, error: "No API key configured." };
    }

    try {
      const res = await fetch(`${this.baseUrl}/users/me`, {
        headers: this._headers(),
      });
      if (res.ok) {
        this.lastTestOk = true;
        this.lastTestedAt = new Date().toISOString();
        return { ok: true };
      }
      const err = await res.text();
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: `Notion API error ${res.status}: ${err}` };
    } catch (err) {
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: err.message };
    }
  }

  async executeTool(toolName, input) {
    if (!this.apiKey) throw new Error("Notion not connected.");

    switch (toolName) {
      case "notion_create_page":
        return this._createPage(input);
      case "notion_update_page":
        return this._updatePage(input);
      case "notion_search":
        return this._search(input);
      case "notion_query_database":
        return this._queryDatabase(input);
      default:
        throw new Error(`Unknown Notion tool: ${toolName}`);
    }
  }

  async _createPage({ parent_id, parent_type, title, content, properties }) {
    const body = {
      parent: { [parent_type]: parent_id },
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
        ...(properties || {}),
      },
    };

    if (content) {
      body.children = this._markdownToBlocks(content);
    }

    const res = await fetch(`${this.baseUrl}/pages`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion create page failed: ${err}`);
    }

    return await res.json();
  }

  async _updatePage({ page_id, properties }) {
    const res = await fetch(`${this.baseUrl}/pages/${page_id}`, {
      method: "PATCH",
      headers: this._headers(),
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion update page failed: ${err}`);
    }

    return await res.json();
  }

  async _search({ query, filter_type }) {
    const body = { query };
    if (filter_type) {
      body.filter = { property: "object", value: filter_type };
    }

    const res = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion search failed: ${err}`);
    }

    const data = await res.json();
    return {
      results: (data.results || []).map((r) => ({
        id: r.id,
        type: r.object,
        title: this._extractTitle(r),
        url: r.url,
      })),
    };
  }

  async _queryDatabase({ database_id, filter, sorts }) {
    const body = {};
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;

    const res = await fetch(`${this.baseUrl}/databases/${database_id}/query`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion query database failed: ${err}`);
    }

    return await res.json();
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": this.notionVersion,
    };
  }

  _extractTitle(page) {
    if (!page.properties) return "Untitled";
    for (const prop of Object.values(page.properties)) {
      if (prop.type === "title" && prop.title && prop.title.length > 0) {
        return prop.title.map((t) => t.plain_text).join("");
      }
    }
    return "Untitled";
  }

  _markdownToBlocks(markdown) {
    // Simple markdown-to-Notion-blocks conversion
    return markdown.split("\n").filter(Boolean).map((line) => {
      if (line.startsWith("# ")) {
        return {
          object: "block",
          type: "heading_1",
          heading_1: { rich_text: [{ text: { content: line.slice(2) } }] },
        };
      }
      if (line.startsWith("## ")) {
        return {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: line.slice(3) } }] },
        };
      }
      if (line.startsWith("- ")) {
        return {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ text: { content: line.slice(2) } }] },
        };
      }
      return {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: line } }] },
      };
    });
  }
}

module.exports = { NotionConnector };
