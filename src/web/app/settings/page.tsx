'use client';

import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'openrouter_api_key';

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  tokenExpiresAt: string | null;
  createdAt: string;
}

const PLATFORM_INFO: Record<string, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: 'bg-pink-500' },
  facebook: { label: 'Facebook', color: 'bg-blue-600' },
  tiktok: { label: 'TikTok', color: 'bg-gray-800 dark:bg-gray-200' },
};

export default function Settings() {
  // ─── OpenRouter state ──────────────────────────────────────────────
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [configSource, setConfigSource] = useState('none');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; response?: string; error?: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Social accounts state ─────────────────────────────────────────
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [mockMode, setMockMode] = useState(true);

  // ─── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      setSavedKey(stored);
      setApiKey(stored);
    }

    fetch('http://localhost:4001/api/settings/openrouter-key/status')
      .then((res) => res.json())
      .then((data) => {
        setConfigured(data.configured);
        setConfigSource(data.source);
      })
      .catch(() => {
        setConfigured(false);
        setConfigSource('error');
      });

    loadAccounts();
  }, []);

  // ─── OpenRouter handlers ──────────────────────────────────────────
  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Enter an API key before saving.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
    setSavedKey(trimmed);

    try {
      const res = await fetch('http://localhost:4001/api/settings/openrouter-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save on backend');
      }

      setConfigured(true);
      setConfigSource('runtime');
      setMessage({ type: 'success', text: 'API key saved successfully!' });
    } catch (err: any) {
      setConfigured(true);
      setConfigSource('localStorage');
      setMessage({ type: 'success', text: 'Saved locally. Backend unavailable.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);

    try {
      const res = await fetch('http://localhost:4001/api/settings/openrouter-key/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ valid: false, error: 'Cannot reach backend' });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setApiKey('');
    setSavedKey('');
    setConfigured(false);
    setConfigSource('none');
    setTestResult(null);
    setMessage({ type: 'success', text: 'API key cleared.' });
  };

  const maskedKey = (key: string) => {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
  };

  // ─── Social account handlers ───────────────────────────────────────
  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const [accountsRes, mockRes] = await Promise.all([
        fetch('http://localhost:4001/api/auth/accounts'),
        fetch('http://localhost:4001/api/auth/mock-toggle')
      ]);
      const accountsData = await accountsRes.json();
      const mockData = await mockRes.json();
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setMockMode(mockData.mock !== false);
    } catch {
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleConnect = (platform: string) => {
    window.location.href = `http://localhost:4001/api/auth/${platform}/authorize`;
  };

  const handleDisconnect = async (id: string, platform: string) => {
    if (!confirm(`Disconnect ${platform} account?`)) return;

    try {
      const res = await fetch(`http://localhost:4001/api/auth/accounts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setMessage({ type: 'success', text: `${platform} account disconnected.` });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  // Check for OAuth result from URL params (redirected back from callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_success');
    const error = params.get('oauth_error');

    if (success) {
      setMessage({ type: 'success', text: `✅ ${success} account connected!` });
      loadAccounts();
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    }
    if (error) {
      setMessage({ type: 'error', text: `OAuth error: ${error}` });
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-black p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">
          Settings
        </h1>

        {/* ═══════ OpenRouter API Key ═══════ */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            OpenRouter API Key
          </h2>

          <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                configured ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-700 dark:text-gray-300">
              {configured
                ? `Key configured (${configSource === 'runtime' ? 'server session' : configSource === 'env' ? '.env file' : 'localStorage'})`
                : 'No API key configured — using mock fallback'}
            </span>
          </div>

          {savedKey && (
            <div className="mb-4 p-2 px-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-md text-xs text-indigo-700 dark:text-indigo-300 font-mono break-all">
              Saved: {maskedKey(savedKey)}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Get your free key at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                openrouter.ai/keys
              </a>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !configured}
              className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleClear}
              disabled={!savedKey && !configured}
              className="px-5 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ═══════ Social Accounts ═══════ */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Connected Social Accounts
          </h2>

          {/* Mock mode badge */}
          <div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
            <span
              className={`inline-block w-3 h-3 rounded-full ${mockMode ? 'bg-amber-500' : 'bg-green-500'}`}
            />
            <span className="text-gray-700 dark:text-gray-300">
              {mockMode
                ? 'Mock mode active — social API calls are simulated'
                : 'Real mode — OAuth tokens will be used'}
            </span>
          </div>

          {/* Connected accounts list */}
          {loadingAccounts ? (
            <p className="text-sm text-gray-400">Loading accounts...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              No social accounts connected yet. Connect one below.
            </p>
          ) : (
            <div className="space-y-3 mb-5">
              {accounts.map((acc) => {
                const info = PLATFORM_INFO[acc.platform] || { label: acc.platform, color: 'bg-gray-500' };
                const expires = acc.tokenExpiresAt
                  ? new Date(acc.tokenExpiresAt).toLocaleDateString()
                  : 'Never';
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${info.color}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {info.label}: {acc.accountName}
                        </p>
                        <p className="text-xs text-gray-400">
                          Token expires: {expires}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(acc.id, info.label)}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Connect buttons */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(PLATFORM_INFO).map(([key, info]) => {
              const alreadyConnected = accounts.some((a) => a.platform === key);
              return (
                <button
                  key={key}
                  onClick={() => handleConnect(key)}
                  disabled={alreadyConnected}
                  className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                    alreadyConnected
                      ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 cursor-default'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {alreadyConnected ? `✓ ${info.label}` : `+ ${info.label}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`mb-6 p-3 rounded-md text-sm ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Test Result
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  testResult.valid ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {testResult.valid ? 'Connection successful' : 'Connection failed'}
              </span>
            </div>
            {testResult.response && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                Response: {testResult.response}
              </p>
            )}
            {testResult.error && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{testResult.error}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center">
          <a href="/" className="text-sm text-indigo-500 hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}