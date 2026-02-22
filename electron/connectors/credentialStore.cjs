/**
 * credentialStore.cjs -> Encrypted credential storage using Electron's safeStorage.
 * Credentials are encrypted via the OS keychain (Windows DPAPI, macOS Keychain, Linux Secret Service).
 * Encrypted blobs are persisted to a JSON file in the app's userData directory.
 */

const { safeStorage } = require("electron");
const { app } = require("electron");
const fs = require("fs");
const path = require("path");

/** @type {string | null} */
let storePath = null;

/** @type {Record<string, string>} connectorId:key -> encrypted base64 */
let store = {};

/**
 * initCredentialStore -> Load the encrypted credential store from disk.
 * Must be called after app.whenReady().
 */
function initCredentialStore() {
  storePath = path.join(app.getPath("userData"), "connectors.enc.json");

  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, "utf-8");
      store = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Failed to load credential store:", err);
    store = {};
  }
}

/**
 * saveStore -> Persist the store to disk.
 */
function saveStore() {
  if (!storePath) return;
  try {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save credential store:", err);
  }
}

/**
 * setSecret -> Encrypt and store a secret.
 * @param {string} connectorId - The connector this secret belongs to
 * @param {string} key - The secret key (e.g., "api_key", "access_token")
 * @param {string} value - The plaintext secret value
 */
function setSecret(connectorId, key, value) {
  const storeKey = `${connectorId}:${key}`;

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value);
    store[storeKey] = encrypted.toString("base64");
  } else {
    // Fallback: store in plaintext (dev mode only)
    console.warn("safeStorage encryption not available. Storing in plaintext.");
    store[storeKey] = `plain:${value}`;
  }

  saveStore();
}

/**
 * getSecret -> Retrieve and decrypt a secret.
 * @param {string} connectorId
 * @param {string} key
 * @returns {string | null} The plaintext secret, or null if not found
 */
function getSecret(connectorId, key) {
  const storeKey = `${connectorId}:${key}`;
  const stored = store[storeKey];

  if (!stored) return null;

  if (stored.startsWith("plain:")) {
    return stored.slice(6);
  }

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, "base64");
      return safeStorage.decryptString(buffer);
    } catch (err) {
      console.error("Failed to decrypt secret:", err);
      return null;
    }
  }

  return null;
}

/**
 * hasSecret -> Check if a secret exists for a connector.
 * @param {string} connectorId
 * @param {string} key
 * @returns {boolean}
 */
function hasSecret(connectorId, key) {
  return `${connectorId}:${key}` in store;
}

/**
 * deleteSecret -> Remove a secret.
 * @param {string} connectorId
 * @param {string} key
 */
function deleteSecret(connectorId, key) {
  delete store[`${connectorId}:${key}`];
  saveStore();
}

/**
 * deleteConnectorSecrets -> Remove all secrets for a connector.
 * @param {string} connectorId
 */
function deleteConnectorSecrets(connectorId) {
  const prefix = `${connectorId}:`;
  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      delete store[key];
    }
  }
  saveStore();
}

module.exports = {
  initCredentialStore,
  setSecret,
  getSecret,
  hasSecret,
  deleteSecret,
  deleteConnectorSecrets,
};
