/**
 * gmail.cjs -> Gmail connector (OAuth2 authentication).
 * Exposes tools for sending emails, creating drafts, searching, and reading emails.
 */

const { BaseConnector } = require("./types.cjs");
const http = require("http");
const { shell } = require("electron");

class GmailConnector extends BaseConnector {
  constructor() {
    super({
      id: "gmail",
      name: "Gmail",
      description: "Send emails, create drafts, search your inbox, and read messages for event invitations and follow-ups.",
      icon: "mail",
      authType: "oauth2",
      configFields: [
        {
          key: "client_id",
          label: "Google OAuth Client ID",
          type: "text",
          required: true,
          placeholder: "xxxx.apps.googleusercontent.com",
          helpText: "From Google Cloud Console > APIs & Services > Credentials",
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
          name: "gmail_send_email",
          description: "Send an email to one or more recipients.",
          input_schema: {
            type: "object",
            properties: {
              to: {
                type: "array",
                items: { type: "string" },
                description: "List of recipient email addresses",
              },
              subject: { type: "string", description: "Email subject line" },
              body: { type: "string", description: "Email body in plain text" },
              cc: {
                type: "array",
                items: { type: "string" },
                description: "CC recipients (optional)",
              },
            },
            required: ["to", "subject", "body"],
          },
        },
        {
          name: "gmail_create_draft",
          description: "Create an email draft without sending it.",
          input_schema: {
            type: "object",
            properties: {
              to: {
                type: "array",
                items: { type: "string" },
                description: "List of recipient email addresses",
              },
              subject: { type: "string", description: "Email subject line" },
              body: { type: "string", description: "Email body in plain text" },
            },
            required: ["to", "subject", "body"],
          },
        },
        {
          name: "gmail_search_emails",
          description: "Search for emails matching a query.",
          input_schema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Gmail search query (same syntax as Gmail search bar)",
              },
              max_results: {
                type: "number",
                description: "Maximum number of results to return (default: 10)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "gmail_read_email",
          description: "Read the full content of a specific email by ID.",
          input_schema: {
            type: "object",
            properties: {
              message_id: {
                type: "string",
                description: "The Gmail message ID to read",
              },
            },
            required: ["message_id"],
          },
        },
      ],
    });

    this.clientId = null;
    this.clientSecret = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async initialize(secrets, config) {
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
      const res = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        this.lastTestOk = true;
        this.lastTestedAt = new Date().toISOString();
        return { ok: true, email: data.emailAddress };
      }
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: `Gmail API error: ${res.status}` };
    } catch (err) {
      this.lastTestOk = false;
      this.lastTestedAt = new Date().toISOString();
      return { ok: false, error: err.message };
    }
  }

  /**
   * startOAuthFlow -> Initiate the OAuth2 flow.
   * Opens system browser for user consent, captures the auth code via local redirect.
   * @returns {Promise<{ refresh_token: string }>}
   */
  async startOAuthFlow() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Client ID and Client Secret must be configured first.");
    }

    return new Promise((resolve, reject) => {
      const port = 8923 + Math.floor(Math.random() * 100);
      const redirectUri = `http://localhost:${port}/callback`;
      const scopes = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.readonly",
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
          // Exchange code for tokens
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

          if (tokens.error) {
            throw new Error(tokens.error_description || tokens.error);
          }

          this.accessToken = tokens.access_token;
          this.refreshToken = tokens.refresh_token;
          this.tokenExpiry = Date.now() + (tokens.expires_in || 3600) * 1000;
          this.isConnected = true;

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>Gmail connected successfully! You can close this window.</h2>");
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

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error("OAuth flow timed out."));
      }, 120000);
    });
  }

  async executeTool(toolName, input) {
    await this._ensureToken();

    switch (toolName) {
      case "gmail_send_email":
        return this._sendEmail(input);
      case "gmail_create_draft":
        return this._createDraft(input);
      case "gmail_search_emails":
        return this._searchEmails(input);
      case "gmail_read_email":
        return this._readEmail(input);
      default:
        throw new Error(`Unknown Gmail tool: ${toolName}`);
    }
  }

  async _sendEmail({ to, subject, body, cc }) {
    const raw = this._buildRawEmail(to, subject, body, cc);
    const res = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail send failed: ${err}`);
    }

    const data = await res.json();
    return { messageId: data.id, threadId: data.threadId };
  }

  async _createDraft({ to, subject, body }) {
    const raw = this._buildRawEmail(to, subject, body);
    const res = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/drafts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { raw } }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail create draft failed: ${err}`);
    }

    const data = await res.json();
    return { draftId: data.id, messageId: data.message.id };
  }

  async _searchEmails({ query, max_results }) {
    const maxResults = max_results || 10;
    const res = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail search failed: ${err}`);
    }

    const data = await res.json();
    return {
      resultCount: data.resultSizeEstimate || 0,
      messages: (data.messages || []).map((m) => ({
        id: m.id,
        threadId: m.threadId,
      })),
    };
  }

  async _readEmail({ message_id }) {
    const res = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${message_id}?format=full`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail read failed: ${err}`);
    }

    const data = await res.json();
    const headers = data.payload?.headers || [];
    const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    let bodyText = "";
    if (data.payload?.body?.data) {
      bodyText = Buffer.from(data.payload.body.data, "base64url").toString("utf-8");
    } else if (data.payload?.parts) {
      const textPart = data.payload.parts.find((p) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        bodyText = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
      }
    }

    return {
      id: data.id,
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
      snippet: data.snippet,
      body: bodyText,
    };
  }

  _buildRawEmail(to, subject, body, cc) {
    const toHeader = Array.isArray(to) ? to.join(", ") : to;
    let email = `To: ${toHeader}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n`;
    if (cc && cc.length > 0) {
      email += `Cc: ${cc.join(", ")}\r\n`;
    }
    email += `\r\n${body}`;
    return Buffer.from(email).toString("base64url");
  }

  async _ensureToken() {
    if (!this.accessToken || (this.tokenExpiry && Date.now() > this.tokenExpiry - 60000)) {
      await this._refreshAccessToken();
    }
  }

  async _refreshAccessToken() {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error("Gmail not authenticated. Complete OAuth flow first.");
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
    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  }
}

module.exports = { GmailConnector };
