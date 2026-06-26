'use client';

import { useState, useEffect } from 'react';

interface Brand {
  id: string;
  name: string;
  tone: string | null;
}

interface PlaybookDay {
  day: string;
  type: string;
  content: string;
}

interface Playbook {
  brand: string;
  industry: string;
  executiveSummary: string;
  weeklySchedule: PlaybookDay[];
  tacticalTips: string[];
  kpi: string[];
  source: string;
}

function getTenantHeaders(): Record<string, string> {
  const tenantId = typeof window !== 'undefined'
    ? localStorage.getItem('social-manager-tenant-id')
    : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  return headers;
}

export default function GrowthPlaybook() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [industry, setIndustry] = useState('');
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/brands', { headers: getTenantHeaders() })
      .then((r) => r.json())
      .then((data: Brand[]) => {
        setBrands(data);
        if (data.length > 0) setSelectedBrandId(data[0].id);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedBrandId) { setError('Select a brand'); return; }
    setLoading(true);
    setError('');
    setPlaybook(null);

    try {
      const res = await fetch('/api/analyze/playbook', {
        method: 'POST',
        headers: getTenantHeaders(),
        body: JSON.stringify({ brandId: selectedBrandId, industry: industry || undefined }),
      });
      if (!res.ok) throw new Error('Failed to generate playbook');
      const data = await res.json();
      setPlaybook(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'educational': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
      case 'engagement': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case 'promotional': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          Growth Playbook
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          AI-powered strategic analysis and content calendar for your brand.
        </p>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand</label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} {b.tone ? `(${b.tone})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry (optional)</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., fashion, tech, food"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedBrandId}
                className="w-full px-6 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Generating...' : 'Generate Playbook'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
        </div>

        {/* Playbook Results */}
        {playbook && (
          <>
            {/* Executive Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Executive Summary
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{playbook.executiveSummary}</p>
              <p className="text-xs text-gray-400 mt-2">
                Source: {playbook.source === 'openrouter' ? 'AI (OpenRouter)' : 'Mock'}
              </p>
            </div>

            {/* Weekly Schedule */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Recommended Weekly Schedule
              </h2>
              <div className="space-y-3">
                {playbook.weeklySchedule.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-3 border border-gray-100 dark:border-gray-700 rounded-lg">
                    <div className="min-w-[80px] font-medium text-gray-700 dark:text-gray-300">{item.day}</div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(item.type)}`}>
                      {item.type}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tactical Tips */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Tactical Tips
              </h2>
              <ul className="space-y-2">
                {playbook.tacticalTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* KPIs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Recommended KPIs
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {playbook.kpi.map((k, i) => (
                  <div key={i} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-center">
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}