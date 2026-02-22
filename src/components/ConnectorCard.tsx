import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader,
  ExternalLink,
  Notebook,
  Mail,
  Calendar,
  Ticket,
} from "lucide-react";
import {
  saveConnectorSecret,
  testConnector,
  toggleConnector,
  startOAuth,
  isElectron,
} from "../lib/electronBridge";
import type { ConnectorStatus, ConnectorConfigField } from "../types";

/**
 * ConnectorCardProps -> Props for a single connector configuration card.
 */
interface ConnectorCardProps {
  connector: ConnectorStatus;
  onRefresh: () => void;
}

const ICON_MAP: Record<string, typeof Notebook> = {
  notebook: Notebook,
  mail: Mail,
  calendar: Calendar,
  ticket: Ticket,
};

/**
 * ConnectorCard -> Individual connector configuration card in Settings.
 */
export default function ConnectorCard({ connector, onRefresh }: ConnectorCardProps) {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const IconComponent = ICON_MAP[connector.icon] || Notebook;

  const handleSaveSecret = async (field: ConnectorConfigField) => {
    const value = secrets[field.key];
    if (!value?.trim()) return;

    setSaving(true);
    try {
      await saveConnectorSecret(connector.connectorId, field.key, value);
      await toggleConnector(connector.connectorId, true);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnector(connector.connectorId);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleOAuth = async () => {
    setOauthLoading(true);
    try {
      // First save any config fields (client_id, client_secret)
      for (const field of connector.configFields) {
        const value = secrets[field.key];
        if (value?.trim()) {
          await saveConnectorSecret(connector.connectorId, field.key, value);
        }
      }
      const result = await startOAuth(connector.connectorId);
      if (result.error) {
        setTestResult({ ok: false, error: result.error });
      } else {
        onRefresh();
      }
    } finally {
      setOauthLoading(false);
    }
  };

  const handleToggle = async () => {
    await toggleConnector(connector.connectorId, !connector.isEnabled);
    onRefresh();
  };

  return (
    <div className={`connector-card ${connector.isConnected ? "connected" : ""}`}>
      <div className="connector-card-header">
        <div className="connector-card-icon">
          <IconComponent size={24} />
        </div>
        <div className="connector-card-info">
          <h3>{connector.displayName}</h3>
          <p className="connector-card-desc">{connector.description}</p>
        </div>
        <div className="connector-card-status">
          {connector.isConnected ? (
            <span className="connector-connected">
              <CheckCircle2 size={16} />
              Connected
            </span>
          ) : (
            <span className="connector-disconnected">
              <XCircle size={16} />
              Not connected
            </span>
          )}
        </div>
      </div>

      <div className="connector-card-body">
        {/* Configuration fields */}
        {connector.configFields.map((field) => (
          <div key={field.key} className="connector-field">
            <label>{field.label}</label>
            <div className="connector-field-input">
              <input
                type={field.type === "password" ? "password" : "text"}
                placeholder={field.placeholder || ""}
                value={secrets[field.key] || ""}
                onChange={(e) =>
                  setSecrets({ ...secrets, [field.key]: e.target.value })
                }
              />
              {connector.authType === "api_key" && (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => handleSaveSecret(field)}
                  disabled={saving || !secrets[field.key]?.trim()}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
            {field.helpText && (
              <span className="connector-field-help">{field.helpText}</span>
            )}
          </div>
        ))}

        {/* OAuth Connect button */}
        {connector.authType === "oauth2" && (
          <button
            className="btn-primary connector-oauth-btn"
            onClick={handleOAuth}
            disabled={oauthLoading}
          >
            {oauthLoading ? (
              <>
                <Loader size={14} className="spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink size={14} />
                {connector.isConnected ? "Reconnect" : "Connect with Google"}
              </>
            )}
          </button>
        )}

        {/* Actions */}
        <div className="connector-card-actions">
          <button
            className="btn-secondary btn-sm"
            onClick={handleTest}
            disabled={testing || !connector.isConnected}
          >
            {testing ? (
              <>
                <Loader size={14} className="spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </button>

          {connector.isConnected && (
            <button
              className={`btn-sm ${connector.isEnabled ? "btn-secondary" : "btn-primary"}`}
              onClick={handleToggle}
            >
              {connector.isEnabled ? "Disable" : "Enable"}
            </button>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`connector-test-result ${testResult.ok ? "success" : "error"}`}>
            {testResult.ok ? (
              <><CheckCircle2 size={14} /> Connection successful</>
            ) : (
              <><XCircle size={14} /> {testResult.error}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
