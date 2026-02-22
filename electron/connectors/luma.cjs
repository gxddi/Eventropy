/**
 * luma.cjs -> Luma connector (API key authentication).
 * Exposes tools for creating events, listing events, getting RSVPs, and updating events.
 */

const { BaseConnector } = require("./types.cjs");

class LumaConnector extends BaseConnector {
  constructor() {
    super({
      id: "luma",
      name: "Luma",
      description: "Create and manage Luma events, track RSVPs and registrations for your events.",
      icon: "ticket",
      authType: "api_key",
      configFields: [
        {
          key: "api_key",
          label: "Luma API Key",
          type: "password",
          required: true,
          placeholder: "luma_...",
          helpText: "Get your API key from the Luma developer dashboard",
        },
      ],
      tools: [
        {
          name: "luma_create_event",
          description: "Create a new event on Luma.",
          input_schema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Event name/title" },
              description: { type: "string", description: "Event description (supports markdown)" },
              start_at: {
                type: "string",
                description: "Start time in ISO 8601 format",
              },
              end_at: {
                type: "string",
                description: "End time in ISO 8601 format",
              },
              location: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["offline", "online"],
                    description: "Whether the event is in-person or virtual",
                  },
                  address: { type: "string", description: "Physical address (for offline events)" },
                  url: { type: "string", description: "URL (for online events)" },
                },
              },
              capacity: {
                type: "number",
                description: "Maximum number of attendees (optional)",
              },
              require_approval: {
                type: "boolean",
                description: "Whether registrations require host approval",
              },
            },
            required: ["name", "start_at"],
          },
        },
        {
          name: "luma_list_events",
          description: "List events from your Luma account.",
          input_schema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["upcoming", "past", "all"],
                description: "Filter by event status (default: upcoming)",
              },
              limit: {
                type: "number",
                description: "Maximum number of events to return (default: 20)",
              },
            },
            required: [],
          },
        },
        {
          name: "luma_get_rsvps",
          description: "Get the list of RSVPs/registrations for a Luma event.",
          input_schema: {
            type: "object",
            properties: {
              event_id: {
                type: "string",
                description: "The Luma event ID or API ID",
              },
            },
            required: ["event_id"],
          },
        },
        {
          name: "luma_update_event",
          description: "Update an existing Luma event.",
          input_schema: {
            type: "object",
            properties: {
              event_id: { type: "string", description: "The event ID to update" },
              name: { type: "string", description: "Updated name (optional)" },
              description: { type: "string", description: "Updated description (optional)" },
              start_at: { type: "string", description: "Updated start time (optional)" },
              end_at: { type: "string", description: "Updated end time (optional)" },
              capacity: { type: "number", description: "Updated capacity (optional)" },
            },
            required: ["event_id"],
          },
        },
      ],
    });

    this.apiKey = null;
    this.baseUrl = "https://api.lu.ma/public/v1";
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
      const res = await fetch(`${this.baseUrl}/calendar/list-events?after=${new Date().toISOString()}&limit=1`, {
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
      return { ok: false, error: `Luma API error ${res.status}: ${err}` };
    } catch (err) {
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: err.message };
    }
  }

  async executeTool(toolName, input) {
    if (!this.apiKey) throw new Error("Luma not connected.");

    switch (toolName) {
      case "luma_create_event":
        return this._createEvent(input);
      case "luma_list_events":
        return this._listEvents(input);
      case "luma_get_rsvps":
        return this._getRsvps(input);
      case "luma_update_event":
        return this._updateEvent(input);
      default:
        throw new Error(`Unknown Luma tool: ${toolName}`);
    }
  }

  async _createEvent({ name, description, start_at, end_at, location, capacity, require_approval }) {
    const body = {
      name,
      start_at,
    };
    if (description) body.description = description;
    if (end_at) body.end_at = end_at;
    if (location) body.geo = location;
    if (capacity) body.capacity = capacity;
    if (typeof require_approval === "boolean") body.require_approval = require_approval;

    const res = await fetch(`${this.baseUrl}/calendar/create-event`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Luma create event failed: ${err}`);
    }

    const data = await res.json();
    return {
      eventId: data.event?.api_id,
      url: data.event?.url,
      name: data.event?.name,
    };
  }

  async _listEvents({ status, limit }) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));

    let endpoint = `${this.baseUrl}/calendar/list-events`;
    if (status === "past") {
      params.set("before", new Date().toISOString());
    } else if (status !== "all") {
      params.set("after", new Date().toISOString());
    }

    const paramStr = params.toString();
    if (paramStr) endpoint += `?${paramStr}`;

    const res = await fetch(endpoint, { headers: this._headers() });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Luma list events failed: ${err}`);
    }

    const data = await res.json();
    return {
      events: (data.entries || []).map((entry) => ({
        id: entry.event?.api_id,
        name: entry.event?.name,
        startAt: entry.event?.start_at,
        endAt: entry.event?.end_at,
        url: entry.event?.url,
        guestCount: entry.event?.guest_count,
      })),
    };
  }

  async _getRsvps({ event_id }) {
    const res = await fetch(
      `${this.baseUrl}/event/get-guests?event_api_id=${event_id}`,
      { headers: this._headers() }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Luma get RSVPs failed: ${err}`);
    }

    const data = await res.json();
    return {
      guests: (data.entries || []).map((entry) => ({
        name: entry.guest?.name,
        email: entry.guest?.email,
        status: entry.guest?.approval_status,
        registeredAt: entry.guest?.created_at,
      })),
      totalCount: data.entries?.length || 0,
    };
  }

  async _updateEvent({ event_id, name, description, start_at, end_at, capacity }) {
    const body = { event_api_id: event_id };
    if (name) body.name = name;
    if (description) body.description = description;
    if (start_at) body.start_at = start_at;
    if (end_at) body.end_at = end_at;
    if (capacity) body.capacity = capacity;

    const res = await fetch(`${this.baseUrl}/calendar/update-event`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Luma update event failed: ${err}`);
    }

    return await res.json();
  }

  _headers() {
    return {
      "x-luma-api-key": this.apiKey,
      "Content-Type": "application/json",
    };
  }
}

module.exports = { LumaConnector };
