import { useEffect, useState } from 'react';
import { getApiKey, setApiKey, clearApiKey, getWorkspaceId, setWorkspaceId } from '../../lib/apiKeyStorage.js';
import './SettingsPanel.css';

export default function SettingsPanel() {
  const [apiKey, setApiKeyLocal] = useState('');
  const [savedKey, setSavedKey] = useState(null);
  const [workspaceId, setWorkspaceIdLocal] = useState('');
  const [savedWorkspaceId, setSavedWorkspaceId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const stored = getApiKey();
    setSavedKey(stored);
    const wsId = getWorkspaceId();
    setSavedWorkspaceId(wsId);
  }, []);

  function handleInputChange(e) {
    setApiKeyLocal(e.target.value);
    setSaveMessage('');
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      setSaveMessage('Please enter an API key');
      return;
    }
    setSaving(true);
    try {
      setApiKey(apiKey);
      setSavedKey(apiKey);
      if (workspaceId.trim()) {
        setWorkspaceId(workspaceId);
        setSavedWorkspaceId(workspaceId);
      }
      setApiKeyLocal('');
      setWorkspaceIdLocal('');
      setSaveMessage('API key saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!window.confirm('Clear your saved API key?')) return;
    try {
      clearApiKey();
      setSavedKey(null);
      setApiKeyLocal('');
      setWorkspaceId(null);
      setSavedWorkspaceId(null);
      setSaveMessage('API key cleared');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`);
    }
  }

  function formatKeyDisplay(key) {
    if (!key) return null;
    const end = key.slice(-4);
    return `Key saved, ending in …${end}`;
  }

  return (
    <div className="settings-panel">
      <section className="settings-section">
        <h2>API Configuration</h2>
        <p className="settings-description">
          Your Anthropic API key is stored in this browser only and never shared or exported.
        </p>

        <div className="api-key-form">
          {!savedKey ? (
            <>
              <div>
                <label className="settings-label">API Key</label>
                <input
                  type="password"
                  className="api-key-input"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="settings-label">Workspace ID (optional, for identity-linked keys)</label>
                <input
                  type="text"
                  className="api-key-input"
                  placeholder="Leave blank for standard API keys"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceIdLocal(e.target.value)}
                  disabled={saving}
                />
              </div>
              <button onClick={handleSave} disabled={saving || !apiKey.trim()} className="btn btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <div className="api-key-display">{formatKeyDisplay(savedKey)}</div>
              {savedWorkspaceId && <div className="workspace-id-display">Workspace: {savedWorkspaceId}</div>}
              <div className="api-key-actions">
                <button onClick={handleClear} className="btn btn-secondary">
                  Clear Key
                </button>
              </div>
            </>
          )}
        </div>

        {saveMessage && <div className={`settings-message ${saveMessage.startsWith('Error') ? 'error' : 'success'}`}>{saveMessage}</div>}
      </section>
    </div>
  );
}
