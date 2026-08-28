import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiKey, setApiKey, clearApiKey } from './apiKeyStorage.js';

describe('apiKeyStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return null when no key is stored', () => {
    expect(getApiKey()).toBeNull();
  });

  it('should set and retrieve an API key', () => {
    const testKey = 'sk-ant-test-key-12345';
    setApiKey(testKey);
    expect(getApiKey()).toBe(testKey);
  });

  it('should clear an API key', () => {
    setApiKey('sk-ant-test-key-12345');
    clearApiKey();
    expect(getApiKey()).toBeNull();
  });

  it('should use isolated storage key', () => {
    setApiKey('sk-ant-test-key-12345');
    const allItems = { ...localStorage };
    const keys = Object.keys(allItems).filter((k) => k.includes('foodenvy'));
    expect(keys).toContain('foodenvy.anthropicApiKey');
  });

  it('should overwrite existing API keys', () => {
    setApiKey('sk-ant-old-key');
    setApiKey('sk-ant-new-key');
    expect(getApiKey()).toBe('sk-ant-new-key');
  });
});
