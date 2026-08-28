const API_KEY_STORAGE_KEY = 'foodenvy.anthropicApiKey';
const WORKSPACE_ID_STORAGE_KEY = 'foodenvy.anthropicWorkspaceId';

export function getApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch {
    throw new Error('Failed to save API key to local storage');
  }
}

export function clearApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    throw new Error('Failed to clear API key from local storage');
  }
}

export function getWorkspaceId() {
  try {
    return localStorage.getItem(WORKSPACE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setWorkspaceId(id) {
  try {
    if (id) {
      localStorage.setItem(WORKSPACE_ID_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(WORKSPACE_ID_STORAGE_KEY);
    }
  } catch {
    throw new Error('Failed to save workspace ID to local storage');
  }
}
