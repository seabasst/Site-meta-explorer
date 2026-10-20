'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowRight, Loader2, Rocket, Search } from 'lucide-react';
import { formatNumber } from '@/lib/spend-estimator';
import { brandHref, Lead, LeadDialog, Monogram, shortDate, TopBar } from './ui';

// =============================================================================
// /dashboard/v3 — Genome front page (genome.kirimedia.co).
// One search box over the ad accounts in our database; anything we don't track
// can be requested. Below it, what's moving across the database.
// =============================================================================

type Hit = { pageId: string; pageName: string; category: string | null; country: string | null; activeAdCount: number };
type Launch = {
  pageId: string; pageName: string; category: string | null; liveAds: number;
  week: number; day: number; lastLaunch: string; firstAd: string | null;
};
type Trends = {
  anchor: string | null; brands: number;
  rocketDay: Launch | null; rocketWeek: Launch | null;
  launches: Launch[]; newAccounts: Launch[];
  mostActive: { pageId: string; pageName: string; category: string | null; liveAds: number }[];
  categories: { category: string; brands: number; liveAds: number }[];
};

export default function GenomeHome() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsError, setTrendsError] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetch('/api/genome/trends')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setTrends)
      .catch(() => setTrendsError(true));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#FAF9F7] text-stone-900 antialiased" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <TopBar onEarlyBird={() => setLead({ kind: 'earlybird' })} />

      <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4 pb-20 pt-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(55%_60%_at_50%_0%,#ffe4e6_0%,rgba(250,249,247,0)_70%)]" />
        <div className="relative flex w-full flex-col items-center">
          <span className="rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200/80">
            {trends ? `${trends.brands.toLocaleString('en-US')} ad accounts tracked` : 'Meta ad accounts, tracked daily'}
          </span>
          <h1 className="mt-6 max-w-3xl text-balance text-center text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[60px]">
            See what any brand runs on Meta.
          </h1>
          <p className="mt-5 max-w-[52ch] text-center text-base leading-relaxed text-stone-500 md:text-lg">
            Search a company or brand. Get its live ads, reach, audience and estimated spend.
          </p>
          <SearchBox onRequest={(q) => setLead({ kind: 'data', subject: q })} />
          <a href="#trends" className="mt-14 flex items-center gap-2 text-sm text-stone-400 transition hover:text-stone-700">
            What&apos;s moving right now <ArrowDown size={15} strokeWidth={1.75} className="animate-bounce motion-reduce:animate-none" />
          </a>
        </div>
      </section>

      <TrendsSection trends={trends} error={trendsError} />

      <footer className="mx-auto max-w-6xl px-4 pb-14 text-xs leading-relaxed text-stone-400 md:px-6">
        Source: Meta Ad Library API (ads_archive), stored in Genome&apos;s database. Reach is Meta&apos;s EU reach estimate per ad.
      </footer>

      <LeadDialog lead={lead} onClose={() => setLead(null)} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------------

function SearchBox({ onRequest }: { onRequest: (q: string) => void }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState('');
  // Last answer from the server; hits null = the request failed.
  const [res, setRes] = useState<{ term: string; hits: Hit[] | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = q.trim();
  const searching = term.length >= 2;
  const fresh = searching && res?.term === term;
  const loading = searching && !fresh;
  const failed = fresh && res?.hits === null;
  const empty = fresh && res?.hits?.length === 0;
  const hits = searching && res?.hits?.length ? res.hits : null; // may lag one keystroke behind
  const showPanel = open && (failed || empty || !!hits);

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ search: term, limit: '8', sortBy: 'activeAdCount', sortOrder: 'desc' });
      fetch(`/api/ad-library/brands?${qs}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { setRes({ term, hits: d.brands ?? [] }); setActive(0); })
        .catch(() => { if (!ctrl.signal.aborted) setRes({ term, hits: null }); });
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!hits) {
      if (e.key === 'Enter' && empty) onRequest(term);
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % hits.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + hits.length) % hits.length); }
    if (e.key === 'Enter') { e.preventDefault(); router.push(brandHref(hits[Math.min(active, hits.length - 1)].pageId)); }
  }

  return (
    <div className="relative mt-10 w-full max-w-2xl">
      <div className="flex h-16 items-center rounded-full bg-white pl-6 pr-2 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_16px_40px_-16px_rgba(28,25,23,0.22)] ring-1 ring-stone-200/80 transition focus-within:ring-2 focus-within:ring-stone-900 md:h-[72px]">
        <Search size={20} strokeWidth={1.75} className="shrink-0 text-stone-400" />
        <input
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && hits?.length ? `${listId}-${active}` : undefined}
          aria-label="Search a brand, company or website"
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder="Search a brand, company or website"
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-stone-400 md:text-lg"
        />
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-rose-600 text-white md:h-14 md:w-14">
          {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} strokeWidth={2} />}
        </span>
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-20 mt-3 overflow-hidden rounded-[28px] bg-white p-2 text-left shadow-[0_24px_60px_-20px_rgba(28,25,23,0.3)] ring-1 ring-stone-200/80 animate-in fade-in slide-in-from-top-1 duration-150">
          {failed ? (
            <p className="px-4 py-5 text-sm text-stone-500">Search is unavailable right now. Try again in a moment.</p>
          ) : hits ? (
            <>
              <ul id={listId} role="listbox">
                {hits.map((h, i) => (
                  <li key={h.pageId} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                    <Link
                      href={brandHref(h.pageId)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3.5 rounded-2xl px-3 py-2.5 ${i === active ? 'bg-stone-100' : ''}`}
                    >
                      <Monogram name={h.pageName} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{h.pageName}</span>
                        <span className="block truncate text-[13px] text-stone-500">
                          {[h.category && h.category !== 'auto-sweep' ? h.category : null, h.country, `Page ${h.pageId}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[15px] font-medium tabular-nums">{h.activeAdCount.toLocaleString('en-US')}</span>
                        <span className="block text-[11px] text-stone-400">live ads</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => onRequest(term)} className="mt-1 w-full rounded-2xl px-3 py-3 text-left text-[13px] text-stone-500 transition hover:bg-stone-50">
                Not the one you meant? <span className="font-medium text-rose-600">Request data for &ldquo;{term}&rdquo;</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-start gap-4 px-4 py-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-[15px] font-medium">We don&apos;t track &ldquo;{term}&rdquo; yet</p>
                <p className="mt-1 text-sm text-stone-500">Request it and we&apos;ll add the account to the database.</p>
              </div>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRequest(term)}
                className="shrink-0 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 active:scale-[0.98]"
              >
                Request data
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Trends
// -----------------------------------------------------------------------------

function TrendsSection({ trends, error }: { trends: Trends | null; error: boolean }) {
  return (
    <section id="trends" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 md:px-6">
      <div className="max-w-2xl">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-600">Across the database</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">What&apos;s moving on Meta</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
          {trends?.anchor
            ? <>Based on ads we first saw up to {shortDate(trends.anchor)}. A launch is a new ad that also started running in that window.</>
            : 'New ads, the busiest accounts and the categories behind them.'}
        </p>
      </div>

      {error && <p className="mt-10 rounded-3xl bg-white p-6 text-sm text-stone-500 ring-1 ring-stone-200/70">Couldn&apos;t load the trends right now.</p>}
      {!trends && !error && <TrendsSkeleton />}

      {trends && (
        <>
          <div className="mt-10 grid gap-4 md:grid-cols-[1.25fr_1fr]">
            <RocketCard label="Rocket of the day" launch={trends.rocketDay} count={trends.rocketDay?.day} when={trends.anchor ? shortDate(trends.anchor) : ''} highlight />
            <RocketCard label="Rocket of the week" launch={trends.rocketWeek} count={trends.rocketWeek?.week} when={trends.anchor ? `7 days to ${shortDate(trends.anchor)}` : ''} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Panel title="Launch feed" sub="Who else shipped new ads this week">
              <RankList
                rows={trends.launches.map((l) => ({ pageId: l.pageId, name: l.pageName, sub: `Latest launch ${shortDate(l.lastLaunch)}`, value: l.week, unit: 'new ads' }))}
                offset={2}
              />
            </Panel>
            <Panel title="Most active accounts" sub="Live ads at our last check">
              <RankList rows={trends.mostActive.map((b) => ({ pageId: b.pageId, name: b.pageName, sub: categoryLabel(b.category), value: b.liveAds, unit: 'live ads' }))} />
            </Panel>
            <Panel title="New accounts" sub="First ad in our data within 30 days, ranked by launches this week">
              <RankList rows={trends.newAccounts.map((l) => ({ pageId: l.pageId, name: l.pageName, sub: l.firstAd ? `First ad ${shortDate(l.firstAd)}` : '', value: l.week, unit: 'new ads' }))} />
            </Panel>
            <Panel title="Categories" sub="Live ads by category, from the search term that brought each account in">
              <CategoryList rows={trends.categories} />
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}

const categoryLabel = (c: string | null) => (c && c !== 'auto-sweep' ? c : 'Uncategorised');

function RocketCard({ label, launch, count, when, highlight }: { label: string; launch: Launch | null; count?: number; when: string; highlight?: boolean }) {
  const shell = `group relative flex min-h-[260px] flex-col rounded-[32px] p-7 md:p-8 ring-1 transition ${highlight ? 'bg-rose-50/70 ring-rose-100' : 'bg-white ring-stone-200/70'}`;
  const head = (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-rose-600">
      <Rocket size={15} strokeWidth={1.75} /> {label}
    </div>
  );
  if (!launch || !count) {
    return <div className={shell}>{head}<p className="mt-auto text-sm text-stone-500">No launches in this window.</p></div>;
  }
  return (
    <Link href={brandHref(launch.pageId)} className={`${shell} hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(28,25,23,0.18)]`}>
      {head}
      <div className="mt-6 flex items-center gap-3">
        <Monogram name={launch.pageName} size={44} />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold tracking-tight">{launch.pageName}</div>
          <div className="truncate text-sm text-stone-500">{categoryLabel(launch.category)} · {launch.liveAds.toLocaleString('en-US')} live ads</div>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
        <div>
          <div className="text-6xl font-semibold leading-none tracking-[-0.05em] tabular-nums">+{count.toLocaleString('en-US')}</div>
          <div className="mt-2 text-sm text-stone-500">new ads · {when}</div>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-stone-900 text-white transition group-hover:translate-x-0.5">
          <ArrowRight size={18} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[32px] bg-white p-6 ring-1 ring-stone-200/70 md:p-7">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-[13px] text-stone-500">{sub}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function RankList({ rows, offset = 1 }: { rows: { pageId: string; name: string; sub: string; value: number; unit: string }[]; offset?: number }) {
  if (!rows.length) return <p className="py-6 text-sm text-stone-500">Nothing in this window.</p>;
  return (
    <ol className="-mx-2">
      {rows.map((r, i) => (
        <li key={r.pageId} className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: `${i * 40}ms` }}>
          <Link href={brandHref(r.pageId)} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-stone-50">
            <span className="w-5 text-right text-xs tabular-nums text-stone-400">{i + offset}</span>
            <Monogram name={r.name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{r.name}</span>
              <span className="block truncate text-[12px] text-stone-500">{r.sub}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[14px] font-medium tabular-nums">{formatNumber(r.value)}</span>
              <span className="block text-[11px] text-stone-400">{r.unit}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function CategoryList({ rows }: { rows: Trends['categories'] }) {
  if (!rows.length) return <p className="py-6 text-sm text-stone-500">No categorised accounts in this window.</p>;
  const max = Math.max(...rows.map((r) => r.liveAds), 1);
  return (
    <ul className="space-y-3.5">
      {rows.map((c) => (
        <li key={c.category}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate font-medium first-letter:uppercase">{c.category}</span>
            <span className="shrink-0 tabular-nums text-stone-500">
              <b className="font-medium text-stone-900">{formatNumber(c.liveAds)}</b> live ads · {c.brands} accounts
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-stone-800" style={{ width: `${(c.liveAds / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TrendsSkeleton() {
  return (
    <div className="mt-10 grid animate-pulse gap-4 md:grid-cols-[1.25fr_1fr]">
      <div className="h-[260px] rounded-[32px] bg-stone-200/50" />
      <div className="h-[260px] rounded-[32px] bg-stone-200/50" />
      <div className="h-[420px] rounded-[32px] bg-stone-200/40" />
      <div className="h-[420px] rounded-[32px] bg-stone-200/40" />
    </div>
  );
}
