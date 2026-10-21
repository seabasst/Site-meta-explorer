'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, ImageOff } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/spend-estimator';
import { countryName, Lead, LeadDialog, Monogram, shortDate, TopBar } from '../../ui';

// =============================================================================
// /dashboard/v3/brand/[pageId] — the quick report behind a search hit.
// Live ads, EU reach, reach by country, gender and age, the top 3 live ads by
// reach and a spend estimate the viewer tunes. Fetches /api/genome/brand/[pageId].
// =============================================================================

type Report = {
  brand: { pageId: string; name: string; category: string | null; country: string | null; website: string | null };
  checkedAt: string | null;
  liveAds: number;
  reach: number;
  countries: { code: string; share: number; reach: number }[];
  genders: { gender: string; share: number }[];
  ages: { age: string; share: number }[];
  demographics: { sampleAds: number; updatedAt: string | null };
  topAds: { adId: string; reach: number | null; title: string | null; body: string | null; format: string | null; startDate: string | null; image: string | null; video: string | null }[];
  spend: { reach30: number; ads30: number; defaultCpmEur: number; fx: { rate: number; date: string } | null };
};

const eur = (n: number) => formatCurrency(n, 'EUR');
const pct = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}%`;
const adLibraryUrl = (adId: string) => `https://www.facebook.com/ads/library/?id=${adId}`;

export default function BrandReportPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const [d, setD] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetch(`/api/genome/brand/${pageId}`)
      .then(async (r) => { if (!r.ok) throw new Error(r.status === 404 ? 'notfound' : 'failed'); return r.json(); })
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [pageId]);

  return (
    <div className="min-h-[100dvh] bg-[#FAF9F7] text-stone-900 antialiased" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <TopBar onEarlyBird={() => setLead({ kind: 'earlybird', subject: d?.brand.name })} />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-6">
        <Link href="/dashboard/v3" className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900">
          <ArrowLeft size={15} strokeWidth={1.75} /> New search
        </Link>

        {err === 'notfound' && (
          <div className="mt-10 rounded-[32px] bg-white p-8 ring-1 ring-stone-200/70">
            <h1 className="text-2xl font-semibold tracking-tight">We don&apos;t track this account</h1>
            <p className="mt-2 text-stone-500">Page {pageId} isn&apos;t in the database.</p>
            <button onClick={() => setLead({ kind: 'data', subject: `Page ${pageId}` })} className="mt-6 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">Request data</button>
          </div>
        )}
        {err === 'failed' && <p className="mt-10 rounded-3xl bg-white p-6 text-sm text-stone-500 ring-1 ring-stone-200/70">Couldn&apos;t build the report right now. Try again in a moment.</p>}
        {!d && !err && <ReportSkeleton />}
        {d && <ReportBody d={d} onEarlyBird={() => setLead({ kind: 'earlybird', subject: d.brand.name })} />}
      </main>
      <LeadDialog lead={lead} onClose={() => setLead(null)} />
    </div>
  );
}

function ReportBody({ d, onEarlyBird }: { d: Report; onEarlyBird: () => void }) {
  const [cpm, setCpm] = useState(d.spend.defaultCpmEur);
  const [freq, setFreq] = useState(1);
  const impressions = d.spend.reach30 * freq;
  const spend = (impressions / 1000) * cpm;
  const windowLabel = d.checkedAt ? `30 days to ${shortDate(d.checkedAt)}` : 'last 30 days';
  const meta = [d.brand.category && d.brand.category !== 'auto-sweep' ? d.brand.category : null, d.brand.country ? countryName(d.brand.country) : null, `Page ${d.brand.pageId}`].filter(Boolean);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
      {/* Header */}
      <header className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <Monogram name={d.brand.name} pageId={d.brand.pageId} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em] md:text-[44px] md:leading-[1.05]">{d.brand.name}</h1>
            <p className="mt-1.5 text-[15px] text-stone-500 first-letter:uppercase">{meta.join(' · ')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.checkedAt && <span className="rounded-full bg-white px-3.5 py-1.5 text-xs text-stone-500 ring-1 ring-stone-200/80">Data as of {shortDate(d.checkedAt)}</span>}
          <a href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&view_all_page_id=${d.brand.pageId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200/80 transition hover:ring-stone-400">
            Meta Ad Library <ArrowUpRight size={13} strokeWidth={1.75} />
          </a>
        </div>
      </header>

      {/* KPIs */}
      <section className="mt-8 grid grid-cols-1 divide-y divide-stone-200/70 rounded-[32px] bg-white ring-1 ring-stone-200/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Kpi label="Live ads" value={d.liveAds.toLocaleString('en-US')} sub="Active at our last check" />
        <Kpi label="EU reach" value={formatNumber(d.reach)} sub="Summed over live ads, since each started" />
        <Kpi label="Estimated spend, last 30 days" value={eur(spend)} sub={<a href="#spend" className="underline decoration-stone-300 underline-offset-2 hover:text-stone-900">{windowLabel} · CPM €{cpm} · frequency {freq.toFixed(1)}. Adjust</a>} accent />
      </section>

      {/* Countries + audience */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <Card title="Reach by country" sub={d.countries.length ? `Share of reach, applied to total EU reach (estimate)` : undefined}>
          {d.countries.length ? <Countries rows={d.countries} /> : <Empty>No country data stored for this account yet.</Empty>}
        </Card>
        <Card title="Who they reach" sub={d.genders.length ? 'Share of reach by gender and age' : undefined}>
          {d.genders.length || d.ages.length ? <Audience genders={d.genders} ages={d.ages} /> : <Empty>No audience data stored for this account yet.</Empty>}
        </Card>
      </div>

      {/* Top ads */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Top 3 ads by reach</h2>
        <p className="mt-1 text-[15px] text-stone-500">Among the live ads, ranked by EU reach.</p>
        {d.topAds.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 md:grid-rows-2">
            {d.topAds.map((ad, i) => <AdCard key={ad.adId} ad={ad} rank={i + 1} hero={i === 0} />)}
          </div>
        ) : <Empty>No live ads at our last check.</Empty>}
      </section>

      {/* Spend */}
      <section id="spend" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Estimated spend, last 30 days</h2>
        <p className="mt-1 text-[15px] text-stone-500">Meta doesn&apos;t publish spend for commercial ads. Set your own CPM in euro and frequency.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="space-y-8 rounded-[32px] bg-white p-7 ring-1 ring-stone-200/70 md:p-8">
            <Slider
              id="cpm" label="CPM (EUR per 1,000 impressions)" value={cpm} min={1} max={40} step={0.5} onChange={setCpm}
              help={`Default €${d.spend.defaultCpmEur}: country CPMs from Enhencer's 2024 benchmark (USD, a few countries estimated), weighted by this account's reach, ${d.spend.fx ? `converted at the ECB rate of ${shortDate(d.spend.fx.date)} (1 EUR = ${d.spend.fx.rate} USD)` : 'not converted: the ECB rate was unavailable'}.`}
            />
            <Slider
              id="freq" label="Frequency (impressions per person reached)" value={freq} min={1} max={6} step={0.1} onChange={setFreq}
              help="1.0 is the floor: everyone reached saw an ad once."
            />
          </div>
          <div className="flex flex-col rounded-[32px] bg-stone-900 p-7 text-white md:p-8">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-300">Estimate</div>
            <div className="mt-4 text-5xl font-semibold tracking-[-0.045em] tabular-nums md:text-6xl">{eur(spend)}</div>
            <div className="mt-1 text-sm text-stone-400">{windowLabel}</div>
            <dl className="mt-8 space-y-2.5 text-[14px] text-stone-300">
              <Row k="EU reach in the window (est.)" v={d.spend.reach30.toLocaleString('en-US')} />
              <Row k={`× frequency ${freq.toFixed(1)}`} v={`${Math.round(impressions).toLocaleString('en-US')} impressions`} />
              <Row k={`÷ 1,000 × CPM €${cpm}`} v={eur(spend)} />
            </dl>
            <p className="mt-auto pt-8 text-xs leading-relaxed text-stone-400">
              Meta reports reach per ad since it started, not per day, so the window is estimated: each ad&apos;s EU reach is spread evenly over
              the days it ran and the share inside the window counts. Based on {d.spend.ads30.toLocaleString('en-US')} ads that ran in the window,
              including ones that stopped. An estimate, not a platform-reported number.
            </p>
          </div>
        </div>
      </section>

      {/* Early bird */}
      <section className="mt-12 grid items-center gap-8 rounded-[32px] bg-rose-50 p-8 ring-1 ring-rose-100 md:grid-cols-[1.4fr_1fr] md:p-12">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-600">Early bird · 99 USD</div>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] md:text-4xl">Want the deeper analysis?</h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-stone-600">
            Get API access to the whole database and more access to analysis of your competitors.
          </p>
        </div>
        <div className="md:justify-self-end">
          <button onClick={onEarlyBird} className="w-full rounded-full bg-stone-900 px-7 py-4 text-[15px] font-medium text-white transition hover:bg-stone-800 active:scale-[0.98] md:w-auto">
            Request early bird account
          </button>
        </div>
      </section>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-stone-400">
        Source: Meta Ad Library API (ads_archive), stored in Genome&apos;s database. Live ads are ads active when we last checked this account
        {d.checkedAt ? ` (${shortDate(d.checkedAt)})` : ''}. Reach is Meta&apos;s eu_total_reach: EU only, cumulative since each ad started.
        {d.demographics.sampleAds > 0 && ` Country, gender and age shares come from ${d.demographics.sampleAds} sampled ads${d.demographics.updatedAt ? `, updated ${shortDate(d.demographics.updatedAt)}` : ''}; reach per country is that share applied to total EU reach.`}
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: React.ReactNode; accent?: boolean }) {
  return (
    <div className="p-6 md:p-7">
      <div className="text-[13px] text-stone-500">{label}</div>
      <div className={`mt-2 text-4xl font-semibold tracking-[-0.04em] tabular-nums ${accent ? 'text-rose-600' : ''}`}>{value}</div>
      <div className="mt-1.5 text-xs text-stone-400">{sub}</div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[32px] bg-white p-6 ring-1 ring-stone-200/70 md:p-7">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-1 text-[13px] text-stone-500">{sub}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-8 text-sm text-stone-500">{children}</p>;

function Countries({ rows }: { rows: Report['countries'] }) {
  const top = rows.slice(0, 8);
  const rest = rows.slice(8);
  const list = rest.length
    ? [...top, { code: '', share: rest.reduce((a, r) => a + r.share, 0), reach: rest.reduce((a, r) => a + r.reach, 0) }]
    : top;
  const max = Math.max(...list.map((r) => r.share), 1);
  return (
    <ul className="space-y-3.5">
      {list.map((c) => (
        <li key={c.code || 'other'} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3">
          <span className="rounded-md bg-stone-100 py-0.5 text-center font-mono text-[11px] text-stone-600">{c.code || '…'}</span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium">{c.code ? countryName(c.code) : `${rest.length} other countries`}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-rose-500" style={{ width: `${(c.share / max) * 100}%` }} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[14px] font-medium tabular-nums">{pct(c.share)}</div>
            <div className="text-[11px] tabular-nums text-stone-400">≈ {formatNumber(c.reach)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const GENDER_COLOR: Record<string, string> = { female: 'bg-rose-500', male: 'bg-stone-800', unknown: 'bg-stone-300' };

function Audience({ genders, ages }: { genders: Report['genders']; ages: Report['ages'] }) {
  const ageOrder = (a: string) => { const n = parseInt(a, 10); return Number.isNaN(n) ? 999 : n; };
  // Meta's 'Unknown' age bucket is usually a rounding error; keep it only when it's visible.
  const sortedAges = ages.filter((a) => a.share >= 0.5).sort((a, b) => ageOrder(a.age) - ageOrder(b.age));
  const maxAge = Math.max(...sortedAges.map((a) => a.share), 1);
  return (
    <div>
      {genders.length > 0 && (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-stone-100">
            {genders.map((g) => <div key={g.gender} className={GENDER_COLOR[g.gender] ?? 'bg-stone-300'} style={{ width: `${g.share}%` }} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            {genders.map((g) => (
              <span key={g.gender} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${GENDER_COLOR[g.gender] ?? 'bg-stone-300'}`} />
                <span className="capitalize text-stone-600">{g.gender}</span>
                <b className="font-medium tabular-nums">{pct(g.share)}</b>
              </span>
            ))}
          </div>
        </>
      )}
      {sortedAges.length > 0 && (
        <div className="mt-8 flex h-44 items-end gap-2">
          {sortedAges.map((a) => (
            <div key={a.age} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[11px] font-medium tabular-nums text-stone-600">{pct(a.share)}</span>
              <div className="w-full rounded-t-lg bg-stone-800" style={{ height: `${(a.share / maxAge) * 100}%`, minHeight: 2 }} />
              <span className="text-[11px] text-stone-400">{a.age}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdCard({ ad, rank, hero }: { ad: Report['topAds'][number]; rank: number; hero: boolean }) {
  return (
    <a
      href={adLibraryUrl(ad.adId)} target="_blank" rel="noreferrer"
      className={`group flex overflow-hidden rounded-[32px] bg-white ring-1 ring-stone-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(28,25,23,0.2)] ${hero ? 'flex-col md:row-span-2' : 'flex-row'}`}
    >
      <div className={`relative shrink-0 bg-stone-100 ${hero ? 'aspect-[4/3] w-full' : 'w-32 sm:w-40'}`}>
        {ad.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={ad.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          : ad.video
            ? <video src={ad.video} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
            : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-stone-400">
                <ImageOff size={22} strokeWidth={1.5} />
                <span className="text-[11px]">Preview not stored yet</span>
              </div>
            )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">#{rank}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5 md:p-6">
        <div className="flex items-baseline gap-2">
          <span className={`font-semibold tracking-[-0.03em] tabular-nums ${hero ? 'text-3xl' : 'text-2xl'}`}>{ad.reach != null ? formatNumber(ad.reach) : 'n/a'}</span>
          <span className="text-xs text-stone-400">EU reach</span>
        </div>
        {ad.title && <p className="mt-3 line-clamp-2 text-[15px] font-medium">{ad.title}</p>}
        {ad.body && <p className={`mt-1.5 text-[14px] leading-relaxed text-stone-500 ${hero ? 'line-clamp-4' : 'line-clamp-2'}`}>{ad.body}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-stone-400">
          <span className="first-letter:uppercase">{[ad.format, ad.startDate ? `live since ${shortDate(ad.startDate)}` : null].filter(Boolean).join(' · ')}</span>
          <ArrowUpRight size={15} strokeWidth={1.75} className="shrink-0 transition group-hover:text-stone-900" />
        </div>
      </div>
    </a>
  );
}

function Slider({ id, label, value, min, max, step, onChange, help }: {
  id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; help: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">{label}</label>
      <div className="mt-3 flex items-center gap-4">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-rose-600" />
        <input
          type="number" min={min} max={max} step={step} value={value} aria-label={label}
          onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
          className="w-20 rounded-xl bg-stone-50 px-3 py-2 text-right text-[15px] tabular-nums outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-400">{help}</p>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2.5">
    <dt>{k}</dt><dd className="tabular-nums text-white">{v}</dd>
  </div>
);

function ReportSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="flex items-center gap-4"><div className="h-16 w-16 rounded-[30%] bg-stone-200/60" /><div className="h-10 w-64 rounded-xl bg-stone-200/60" /></div>
      <div className="mt-8 h-36 rounded-[32px] bg-stone-200/50" />
      <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="h-80 rounded-[32px] bg-stone-200/40" /><div className="h-80 rounded-[32px] bg-stone-200/40" /></div>
    </div>
  );
}
