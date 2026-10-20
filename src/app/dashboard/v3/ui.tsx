'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';

// Shared pieces for the Genome front page and the brand report.

export const brandHref = (pageId: string) => `/dashboard/v3/brand/${pageId}`;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string) => {
  try { return regionNames.of(code) ?? code; } catch { return code; }
};

// Dates arrive as 'YYYY-MM-DD' strings from SQL; render them without a TZ shift.
export const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// The page's Facebook profile picture, with its initial underneath for pages
// without one (or while it loads).
export function Monogram({ name, pageId, size = 40 }: { name: string; pageId?: string; size?: number }) {
  const letter = name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?';
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[30%] bg-stone-100 font-semibold text-stone-600 ring-1 ring-inset ring-stone-200/70"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
      {pageId && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/genome/avatar/${pageId}`} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}

export function TopBar({ onEarlyBird }: { onEarlyBird: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/60 bg-[#FAF9F7]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 md:px-6">
        <Link href="/dashboard/v3" className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-[9px] bg-rose-600" aria-hidden />
          <span className="text-[17px] font-semibold tracking-[-0.03em]">genome</span>
          <span className="hidden text-xs text-stone-400 sm:inline">by KiriMedia</span>
        </Link>
        <span className="flex-1" />
        <button
          onClick={onEarlyBird}
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 transition hover:bg-white active:scale-[0.98]"
        >
          Early bird
        </button>
      </div>
    </header>
  );
}

export type Lead = { kind: 'data'; subject: string } | { kind: 'earlybird'; subject?: string };

// Both forms land in the same Notion sign-up database as /coming-soon, with the
// topic in the title so the team can tell a data request from an early-bird lead.
export function LeadDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (lead && !d.open) { setState('idle'); setError(''); d.showModal(); }
    if (!lead && d.open) d.close();
  }, [lead]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setState('sending'); setError('');
    const topic = lead.kind === 'data'
      ? `Data request: ${lead.subject}`
      : `Early bird (99 USD)${lead.subject ? `, from ${lead.subject} report` : ''}`;
    try {
      const r = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, topic }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Something went wrong');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setState('idle');
    }
  }

  const isData = lead?.kind === 'data';

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,460px)] rounded-[28px] bg-white p-0 text-stone-900 shadow-[0_30px_80px_-20px_rgba(28,25,23,0.35)] backdrop:bg-stone-900/40 backdrop:backdrop-blur-sm"
    >
      {lead && (
        <div className="relative p-7 md:p-8">
          <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
            <X size={18} strokeWidth={1.75} />
          </button>

          {state === 'done' ? (
            <div className="pt-2">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-rose-50 text-rose-600"><Check size={20} strokeWidth={2} /></span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">{isData ? 'Request received' : "You're on the list"}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
                {isData
                  ? <>We&apos;ll email <b className="font-medium text-stone-900">{email}</b> when the data for {lead.subject} is in.</>
                  : <>We&apos;ll be in touch at <b className="font-medium text-stone-900">{email}</b>.</>}
              </p>
              <button onClick={onClose} className="mt-7 w-full rounded-full bg-stone-900 py-3.5 text-[15px] font-medium text-white transition active:scale-[0.99]">Done</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-600">{isData ? 'Request data' : 'Early bird'}</div>
              <h2 className="mt-3 pr-8 text-2xl font-semibold leading-tight tracking-[-0.02em]">
                {isData ? <>Add &ldquo;{lead.subject}&rdquo; to Genome</> : <>99 USD for the full picture</>}
              </h2>
              {isData ? (
                <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
                  We don&apos;t track this account yet. It can take 1 to 2 days before all its ads are downloaded and analysed.
                  Leave your email and we&apos;ll mail you when it&apos;s in.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5 text-[15px] text-stone-700">
                  <li className="flex gap-3"><Check size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />API access to the whole database</li>
                  <li className="flex gap-3"><Check size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />Deeper analysis of your competitors</li>
                </ul>
              )}

              <label htmlFor="lead-email" className="mt-6 block text-sm font-medium text-stone-700">Email</label>
              <input
                id="lead-email" type="email" required autoFocus autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-2 w-full rounded-2xl bg-stone-50 px-4 py-3.5 text-[15px] outline-none ring-1 ring-stone-200 transition placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-rose-500"
              />
              {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
              <button
                type="submit" disabled={state === 'sending'}
                className="mt-5 w-full rounded-full bg-rose-600 py-3.5 text-[15px] font-medium text-white transition hover:bg-rose-700 active:scale-[0.99] disabled:opacity-60"
              >
                {state === 'sending' ? 'Sending…' : isData ? 'Request data' : 'Request early bird'}
              </button>
            </form>
          )}
        </div>
      )}
    </dialog>
  );
}
