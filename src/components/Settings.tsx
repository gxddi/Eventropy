import { useState, useEffect } from "react";
import { User, Users, ArrowLeft, Plug } from "lucide-react";
import ConnectorCard from "./ConnectorCard";
import { getConnectorStatuses, isElectron } from "../lib/electronBridge";
import type { AccountSettings, AccountType, Collaborator, ActiveView, ConnectorStatus } from "../types";

/**
 * SettingsProps -> Derived from `Settings` + `Props`.
 */
interface SettingsProps {
  /** settings -> Current account settings */
  settings: AccountSettings;
  /** onUpdate -> Callback when settings are updated */
  onUpdate: (settings: AccountSettings) => void;
  /** onNavigate -> Navigation callback */
  onNavigate: (view: ActiveView) => void;
}

/**
 * Settings -> Account management and preferences panel.
 */
export default function Settings({ settings, onUpdate, onNavigate }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AccountSettings>(settings);
  const [showAddCollaborator, setShowAddCollaborator] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState({ name: "", email: "", role: "" });
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);

  // ── Load connector statuses ───────────────────────────────────────────
  const refreshConnectors = async () => {
    if (isElectron()) {
      const statuses = await getConnectorStatuses();
      setConnectors(statuses);
    }
  };

  useEffect(() => {
    refreshConnectors();
  }, []);

  const handleAccountSwitch = (accountType: AccountType) => {
    setLocalSettings((prev) => ({ ...prev, currentAccount: accountType }));
    onUpdate({ ...localSettings, currentAccount: accountType });
  };

  const handleAddCollaborator = () => {
    if (!newCollaborator.name || !newCollaborator.email) return;

    const collaborator: Collaborator = {
      id: `collab-${Date.now()}`,
      name: newCollaborator.name,
      email: newCollaborator.email,
      role: newCollaborator.role || undefined,
    };

    const updatedSettings: AccountSettings = {
      ...localSettings,
      organizationAccount: {
        ...localSettings.organizationAccount!,
        collaborators: [...(localSettings.organizationAccount?.collaborators || []), collaborator],
      },
    };

    setLocalSettings(updatedSettings);
    onUpdate(updatedSettings);
    setNewCollaborator({ name: "", email: "", role: "" });
    setShowAddCollaborator(false);
  };

  const handleRemoveCollaborator = (id: string) => {
    if (!localSettings.organizationAccount) return;

    const updatedSettings: AccountSettings = {
      ...localSettings,
      organizationAccount: {
        ...localSettings.organizationAccount,
        collaborators: localSettings.organizationAccount.collaborators.filter((c) => c.id !== id),
      },
    };

    setLocalSettings(updatedSettings);
    onUpdate(updatedSettings);
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <button
          className="settings-back-btn"
          onClick={() => onNavigate({ kind: "dashboard" })}
        >
          <ArrowLeft size={18} />
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        {/* Account Switching */}
        <section className="settings-section">
          <h2>Account Type</h2>
          <p className="settings-description">
            Switch between personal events (private) and organization-wide events (with collaborators).
          </p>

          <div className="account-switcher">
            <button
              className={`account-option ${localSettings.currentAccount === "personal" ? "active" : ""}`}
              onClick={() => handleAccountSwitch("personal")}
            >
              <User size={20} />
              <div className="account-option-content">
                <div className="account-option-title">Personal</div>
                <div className="account-option-desc">Keep events private</div>
              </div>
            </button>

            <button
              className={`account-option ${localSettings.currentAccount === "organization" ? "active" : ""}`}
              onClick={() => handleAccountSwitch("organization")}
            >
              <Users size={20} />
              <div className="account-option-content">
                <div className="account-option-title">Organization</div>
                <div className="account-option-desc">Add collaborators with full control</div>
              </div>
            </button>
          </div>
        </section>

        {/* Personal Account Info */}
        <section className="settings-section">
          <h2>Personal Account</h2>
          <div className="account-info">
            <div className="info-row">
              <label>Name</label>
              <input
                type="text"
                value={localSettings.personalAccount.name}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    personalAccount: { ...localSettings.personalAccount, name: e.target.value },
                  })
                }
                onBlur={() => onUpdate(localSettings)}
              />
            </div>
            <div className="info-row">
              <label>Email</label>
              <input
                type="email"
                value={localSettings.personalAccount.email}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    personalAccount: { ...localSettings.personalAccount, email: e.target.value },
                  })
                }
                onBlur={() => onUpdate(localSettings)}
              />
            </div>
          </div>
        </section>

        {/* Organization Account & Collaborators */}
        {/* Connectors */}
        <section className="settings-section">
          <h2>
            <Plug size={20} />
            Connectors
          </h2>
          <p className="settings-description">
            Connect external services to enable AI agents to send emails, create calendar events,
            manage Notion pages, and track Luma registrations.
          </p>

          {connectors.length > 0 ? (
            <div className="connectors-list">
              {connectors.map((connector) => (
                <ConnectorCard
                  key={connector.connectorId}
                  connector={connector}
                  onRefresh={refreshConnectors}
                />
              ))}
            </div>
          ) : (
            <div className="connectors-empty">
              <p>
                {isElectron()
                  ? "No connectors available. Connectors are being initialized..."
                  : "Connectors are only available in the Electron desktop app."}
              </p>
            </div>
          )}
        </section>

        {localSettings.currentAccount === "organization" && (
          <section className="settings-section">
            <h2>Organization Account</h2>

            {!localSettings.organizationAccount ? (
              <div className="setup-org">
                <p>Set up your organization account to enable collaboration.</p>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const updated: AccountSettings = {
                      ...localSettings,
                      organizationAccount: {
                        name: "",
                        email: localSettings.personalAccount.email,
                        collaborators: [],
                      },
                    };
                    setLocalSettings(updated);
                    onUpdate(updated);
                  }}
                >
                  Set Up Organization Account
                </button>
              </div>
            ) : (
              <>
                <div className="account-info">
                  <div className="info-row">
                    <label>Organization Name</label>
                    <input
                      type="text"
                      value={localSettings.organizationAccount.name}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          organizationAccount: {
                            ...localSettings.organizationAccount!,
                            name: e.target.value,
                          },
                        })
                      }
                      onBlur={() => onUpdate(localSettings)}
                    />
                  </div>
                  <div className="info-row">
                    <label>Email</label>
                    <input
                      type="email"
                      value={localSettings.organizationAccount.email}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          organizationAccount: {
                            ...localSettings.organizationAccount!,
                            email: e.target.value,
                          },
                        })
                      }
                      onBlur={() => onUpdate(localSettings)}
                    />
                  </div>
                </div>

                {/* Collaborators */}
                <div className="collaborators-section">
                  <div className="collaborators-header">
                    <h3>Collaborators</h3>
                    <button
                      className="btn-secondary"
                      onClick={() => setShowAddCollaborator(!showAddCollaborator)}
                    >
                      {showAddCollaborator ? "Cancel" : "+ Add Collaborator"}
                    </button>
                  </div>

                  {showAddCollaborator && (
                    <div className="add-collaborator-form">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newCollaborator.name}
                        onChange={(e) => setNewCollaborator({ ...newCollaborator, name: e.target.value })}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={newCollaborator.email}
                        onChange={(e) => setNewCollaborator({ ...newCollaborator, email: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Role (optional)"
                        value={newCollaborator.role}
                        onChange={(e) => setNewCollaborator({ ...newCollaborator, role: e.target.value })}
                      />
                      <button className="btn-primary" onClick={handleAddCollaborator}>
                        Add
                      </button>
                    </div>
                  )}

                  <div className="collaborators-list">
                    {localSettings.organizationAccount.collaborators.map((collab) => (
                      <div key={collab.id} className="collaborator-item">
                        <div className="collaborator-info">
                          <div className="collaborator-name">{collab.name}</div>
                          <div className="collaborator-email">{collab.email}</div>
                          {collab.role && <div className="collaborator-role">{collab.role}</div>}
                        </div>
                        <button
                          className="btn-remove"
                          onClick={() => handleRemoveCollaborator(collab.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {localSettings.organizationAccount.collaborators.length === 0 && (
                      <p className="empty-state">No collaborators yet. Add one to get started.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
