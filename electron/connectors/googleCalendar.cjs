/**
 * googleCalendar.cjs -> Google Calendar connector (OAuth2 authentication).
 * Exposes tools for creating events, listing events, checking availability, and updating events.
 * Shares OAuth2 credentials with the Gmail connector (same Google Cloud project).
 */

const { BaseConnector } = require("./types.cjs");
const http = require("http");
const { shell } = require("electron");

class GoogleCalendarConnector extends BaseConnector {
  constructor() {
    super({
      id: "google-calendar",
      name: "Google Calendar",
      description: "Create calendar events, check availability, list upcoming events, and manage deadlines.",
      icon: "calendar",
      authType: "oauth2",
      configFields: [
        {
          key: "client_id",
          label: "Google OAuth Client ID",
          type: "text",
          required: true,
          placeholder: "xxxx.apps.googleusercontent.com",
          helpText: "Same credentials as Gmail (from Google Cloud Console)",
        },
        {
          key: "client_secret",
          label: "Google OAuth Client Secret",
          type: "password",
          required: true,
          placeholder: "GOCSPX-...",
        },
      ],
      tools: [
        {
          name: "gcal_create_event",
          description: "Create a new calendar event.",
          input_schema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Event title" },
              description: { type: "string", description: "Event description" },
              start_datetime: {
                type: "string",
                description: "Start date/time in ISO 8601 format (e.g., 2025-01-15T14:00:00-05:00)",
              },
              end_datetime: {
                type: "string",
                description: "End date/time in ISO 8601 format",
              },
              location: { type: "string", description: "Event location (optional)" },
              attendees: {
                type: "array",
                items: { type: "string" },
                description: "List of attendee email addresses (optional)",
              },
              calendar_id: {
                type: "string",
                description: "Calendar ID (default: 'primary')",
              },
            },
            required: ["summary", "start_datetime", "end_datetime"],
          },
        },
        {
          name: "gcal_list_events",
          description: "List upcoming calendar events within a time range.",
          input_schema: {
            type: "object",
            properties: {
              time_min: {
                type: "string",
                description: "Start of time range in ISO 8601 (default: now)",
              },
              time_max: {
                type: "string",
                description: "End of time range in ISO 8601",
              },
              max_results: {
                type: "number",
                description: "Maximum number of events to return (default: 10)",
              },
              calendar_id: {
                type: "string",
                description: "Calendar ID (default: 'primary')",
              },
            },
            required: [],
          },
        },
        {
          name: "gcal_check_availability",
          description: "Check free/busy information for a time range.",
          input_schema: {
            type: "object",
            properties: {
              time_min: {
                type: "string",
                description: "Start of time range in ISO 8601",
              },
              time_max: {
                type: "string",
                description: "End of time range in ISO 8601",
              },
              calendar_ids: {
                type: "array",
                items: { type: "string" },
                description: "Calendar IDs to check (default: ['primary'])",
              },
            },
            required: ["time_min", "time_max"],
          },
        },
        {
          name: "gcal_update_event",
          description: "Update an existing calendar event.",
          input_schema: {
            type: "object",
            properties: {
              event_id: { type: "string", description: "The event ID to update" },
              summary: { type: "string", description: "Updated title (optional)" },
              description: { type: "string", description: "Updated description (optional)" },
              start_datetime: { type: "string", description: "Updated start time (optional)" },
              end_datetime: { type: "string", description: "Updated end time (optional)" },
              location: { type: "string", description: "Updated location (optional)" },
              calendar_id: { type: "string", description: "Calendar ID (default: 'primary')" },
            },
            required: ["event_id"],
          },
        },
      ],
    });

    this.clientId = null;
    this.clientSecret = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.baseUrl = "https://www.googleapis.com/calendar/v3";
  }

  async initialize(secrets) {
    this.clientId = secrets.client_id;
    this.clientSecret = secrets.client_secret;
    this.refreshToken = secrets.refresh_token;

    if (this.refreshToken) {
      await this._refreshAccessToken();
      this.isConnected = true;
    }
  }

  async testConnection() {
    if (!this.accessToken) {
      return { ok: false, error: "Not authenticated. Complete the OAuth flow first." };
    }

    try {
      const res = await fetch(`${this.baseUrl}/calendars/primary`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) {
        this.lastTestOk = true;
        this.lastTestedAt = new Date().toISOString();
        return { ok: true };
      }
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: `Calendar API error: ${res.status}` };
    } catch (err) {
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: err.message };
    }
  }

  async startOAuthFlow() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Client ID and Client Secret must be configured first.");
    }

    return new Promise((resolve, reject) => {
      const port = 9023 + Math.floor(Math.random() * 100);
      const redirectUri = `http://localhost:${port}/callback`;
      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ];

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(this.clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes.join(" "))}` +
        `&access_type=offline` +
        `&prompt=consent`;

      const server = http.createServer(async (req, res) => {
        if (!req.url.startsWith("/callback")) {
          res.writeHead(404);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>Authentication failed. You can close this window.</h2>");
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end("Missing auth code.");
          server.close();
          reject(new Error("No auth code received."));
          return;
        }

        try {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: this.clientId,
              client_secret: this.clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });

          const tokens = await tokenRes.json();
          if (tokens.error) throw new Error(tokens.error_description || tokens.error);

          this.accessToken = tokens.access_token;
          this.refreshToken = tokens.refresh_token;
          this.tokenExpiry = Date.now() + (tokens.expires_in || 3600) * 1000;
          this.isConnected = true;

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>Google Calendar connected! You can close this window.</h2>");
          server.close();
          resolve({ refresh_token: this.refreshToken });
        } catch (err) {
          res.writeHead(500);
          res.end("Token exchange failed.");
          server.close();
          reject(err);
        }
      });

      server.listen(port, () => {
        shell.openExternal(authUrl);
      });

      setTimeout(() => {
        server.close();
        reject(new Error("OAuth flow timed out."));
      }, 120000);
    });
  }

  async executeTool(toolName, input) {
    await this._ensureToken();

    switch (toolName) {
      case "gcal_create_event":
        return this._createEvent(input);
      case "gcal_list_events":
        return this._listEvents(input);
      case "gcal_check_availability":
        return this._checkAvailability(input);
      case "gcal_update_event":
        return this._updateEvent(input);
      default:
        throw new Error(`Unknown Calendar tool: ${toolName}`);
    }
  }

  async _createEvent({ summary, description, start_datetime, end_datetime, location, attendees, calendar_id }) {
    const calId = calendar_id || "primary";
    const body = {
      summary,
      description,
      start: { dateTime: start_datetime },
      end: { dateTime: end_datetime },
    };
    if (location) body.location = location;
    if (attendees && attendees.length > 0) {
      body.attendees = attendees.map((email) => ({ email }));
    }

    const res = await fetch(`${this.baseUrl}/calendars/${calId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Calendar create event failed: ${err}`);
    }

    const data = await res.json();
    return { eventId: data.id, htmlLink: data.htmlLink, summary: data.summary };
  }

  async _listEvents({ time_min, time_max, max_results, calendar_id }) {
    const calId = calendar_id || "primary";
    const params = new URLSearchParams({
      timeMin: time_min || new Date().toISOString(),
      maxResults: String(max_results || 10),
      singleEvents: "true",
      orderBy: "startTime",
    });
    if (time_max) params.set("timeMax", time_max);

    const res = await fetch(`${this.baseUrl}/calendars/${calId}/events?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Calendar list events failed: ${err}`);
    }

    const data = await res.json();
    return {
      events: (data.items || []).map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
        htmlLink: e.htmlLink,
      })),
    };
  }

  async _checkAvailability({ time_min, time_max, calendar_ids }) {
    const ids = calendar_ids || ["primary"];
    const res = await fetch(`${this.baseUrl}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: time_min,
        timeMax: time_max,
        items: ids.map((id) => ({ id })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Calendar check availability failed: ${err}`);
    }

    const data = await res.json();
    return { calendars: data.calendars };
  }

  async _updateEvent({ event_id, summary, description, start_datetime, end_datetime, location, calendar_id }) {
    const calId = calendar_id || "primary";
    const body = {};
    if (summary) body.summary = summary;
    if (description) body.description = description;
    if (start_datetime) body.start = { dateTime: start_datetime };
    if (end_datetime) body.end = { dateTime: end_datetime };
    if (location) body.location = location;

    const res = await fetch(`${this.baseUrl}/calendars/${calId}/events/${event_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Calendar update event failed: ${err}`);
    }

    return await res.json();
  }

  async _ensureToken() {
    if (!this.accessToken || (this.tokenExpiry && Date.now() > this.tokenExpiry - 60000)) {
      await this._refreshAccessToken();
    }
  }

  async _refreshAccessToken() {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error("Google Calendar not authenticated.");
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(`Token refresh failed: ${data.error}`);

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  }
}

module.exports = { GoogleCalendarConnector };
