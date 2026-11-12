'use client';

import { useState } from 'react';

export function KeyForm({ termsVersion }: { termsVersion: string }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);

  async function getKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/mcp-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acceptTerms: accepted, termsVersion }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setKey(data.key);
    else setError(data.error ?? 'Something went wrong. Try again.');
  }

  if (key) {
    const endpoint = `${window.location.origin}/api/mcp`;
    return (
      <div className="space-y-4">
        <p className="text-[var(--text-primary)] font-medium">
          Your key. Copy it now: we only store a hash of it and cannot show it again.
        </p>
        <code className="block p-3 rounded-lg bg-[var(--bg-tertiary)] break-all select-all text-sm">{key}</code>
        <p>Claude Code:</p>
        <code className="block p-3 rounded-lg bg-[var(--bg-tertiary)] break-all select-all text-sm">
          {`claude mcp add --transport http kiri-benchmarks ${endpoint} --header "Authorization: Bearer ${key}"`}
        </code>
        <p>claude.ai (Settings, Connectors, Add custom connector), as the server URL:</p>
        <code className="block p-3 rounded-lg bg-[var(--bg-tertiary)] break-all select-all text-sm">{`${endpoint}/${key}`}</code>
      </div>
    );
  }

  return (
    <form onSubmit={getKey} className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          className="mt-1.5"
        />
        <span>I have read and accept these terms (version {termsVersion}).</span>
      </label>
      <button type="submit" disabled={!accepted || busy} className="btn-primary px-6 py-3 disabled:opacity-50">
        {busy ? 'Creating key...' : 'Get my API key'}
      </button>
      {error && <p role="alert" className="text-red-400">{error}</p>}
    </form>
  );
}
