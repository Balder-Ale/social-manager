'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Brand {
  id: string;
  name: string;
  tone: string | null;
  guidelines: string | null;
}

interface TrendsResult {
  trends: string[];
  hooks: string[];
  source: string;
}

type Step = 1 | 2 | 3;

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok'] as const;
const FORMATS = ['Reel', 'Carousel', 'Story', 'Tweet', 'Short'] as const;

function getTenantHeaders(): Record<string, string> {
  const tenantId = typeof window !== 'undefined'
    ? localStorage.getItem('social-manager-tenant-id')
    : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  return headers;
}

export default function NewPostWizard() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [loadingBrands, setLoadingBrands] = useState(true);

  // Step 2 fields
  const [trendsResult, setTrendsResult] = useState<TrendsResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedTrend, setSelectedTrend] = useState('');
  const [selectedHook, setSelectedHook] = useState('');
  const [error, setError] = useState('');

  // Step 3
  const [publishing, setPublishing] = useState(false);

  // Load brands on mount
  useEffect(() => {
    fetch('/api/brands', { headers: getTenantHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setBrands(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load brands:', err))
      .finally(() => setLoadingBrands(false));
  }, []);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBrandId) {
      setError('Select a brand first');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    setAnalyzing(true);
    setError('');
    setTrendsResult(null);

    try {
      const res = await fetch('/api/analyze/trends', {
        method: 'POST',
        headers: getTenantHeaders(),
        body: JSON.stringify({
          brandId: selectedBrandId,
          topic: topic || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to analyze trends');
      }

      const data = await res.json();
      setTrendsResult({
        trends: data.trends || [],
        hooks: data.hooks || [],
        source: data.source || 'mock'
      });
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedTrend && (!trendsResult || trendsResult.trends.length === 0)) {
      setError('Select a trend before confirming');
      return;
    }

    setPublishing(true);
    setError('');

    const payload = {
      brandId: selectedBrandId,
      topic,
      platforms: selectedPlatforms,
      format: selectedFormat,
      trend: selectedTrend || (trendsResult?.trends[0] ?? ''),
      hook: selectedHook || (trendsResult?.hooks[0] ?? '')
    };

    // TODO: replace with actual publish endpoint when available
    console.log('[Publish] Payload:', payload);
    await new Promise((r) => setTimeout(r, 1000));
    setStep(3);
    setPublishing(false);
  };

  const resetWizard = () => {
    setStep(1);
    setTrendsResult(null);
    setSelectedTrend('');
    setSelectedHook('');
    setError('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-black p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
            New Post Wizard
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Step {step} of 3
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Configure */}
        {step === 1 && (
          <form onSubmit={handleAnalyze} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-5">
            {/* Brand selector */}
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Brand
              </label>
              {loadingBrands ? (
                <p className="text-sm text-gray-400">Loading brands...</p>
              ) : brands.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No brands found.{' '}
                  <a href="/brand-lab" className="underline">Create one in Brand Lab</a>
                </p>
              ) : (
                <select
                  id="brand"
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.tone ? `(${b.tone})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Topic */}
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Topic / Idea
              </label>
              <input
                id="topic"
                type="text"
                placeholder="e.g., summer product launch, behind the scenes, customer stories"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Platforms
              </label>
              <div className="flex flex-wrap gap-3">
                {PLATFORMS.map((p) => (
                  <label
                    key={p}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlatforms.includes(p)
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                      className="sr-only"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Format
              </label>
              <select
                id="format"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Auto-select</option>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={analyzing || brands.length === 0}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                {analyzing ? 'Analyzing...' : 'Generate Trends & Hooks'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Review Trends & Hooks */}
        {step === 2 && trendsResult && (
          <div className="space-y-5">
            {/* Trends */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Trending Ideas
              </h2>
              <div className="space-y-2">
                {trendsResult.trends.map((trend, idx) => (
                  <label
                    key={idx}
                    className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTrend === trend
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="trend"
                        checked={selectedTrend === trend}
                        onChange={() => setSelectedTrend(trend)}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{trend}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Hooks */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Hook Variations
              </h2>
              <div className="space-y-2">
                {trendsResult.hooks.map((hook, idx) => (
                  <label
                    key={idx}
                    className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedHook === hook
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="hook"
                        checked={selectedHook === hook}
                        onChange={() => setSelectedHook(hook)}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{hook}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Source badge */}
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Source: {trendsResult.source === 'openrouter' ? 'AI (OpenRouter)' : 'Mock (fallback)'}
            </p>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={publishing}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                  {publishing ? 'Publishing...' : 'Confirm & Publish'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Post Published!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your post has been queued for publishing on{' '}
              <strong>{selectedPlatforms.join(', ')}</strong>.
            </p>
            <div className="text-left bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>Topic:</strong> {topic || 'General'}</p>
              <p><strong>Format:</strong> {selectedFormat || 'Auto'}</p>
              {selectedTrend && <p><strong>Trend:</strong> {selectedTrend}</p>}
              {selectedHook && <p><strong>Hook:</strong> {selectedHook}</p>}
            </div>
            <button
              onClick={resetWizard}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              Create Another Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}