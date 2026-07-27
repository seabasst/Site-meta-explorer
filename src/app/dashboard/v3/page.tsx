'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

// =============================================================================
// /dashboard/v3 — Genome: Creative Intelligence
// Light-only, warm-daylight identity (Klarna paper × Airbnb air, pink accent).
// Wires to the real routes: /api/genome/pulse, /api/genome,
// /api/genome/winner, /api/genome/remix.
// =============================================================================

type Pulse = {
  totals: { ads: number; brands: number; activeAds: number };
  ingestion: {
    last7d: number; last24h: number; lastAdAt: string | null;
    hoursSinceLastAd: number | null; status: 'live' | 'idle' | 'stalled';
    daily: { day: string; n: number }[];
  };
  refresh: { brandsFresh: number; brandsDue: number; coveragePct: number };
};

type Gene = {
  gene: string; ads: number; prevalence: number; medianDays: number;
  reachM: number; provenScore: number; quadrant: 'edge' | 'standard' | 'fading' | 'low';
};
type GenomeResp = {
  meta: { totalAds: number; classifiedAds: number; coveragePct: number };
  dimensions: Record<string, Gene[]>;
};

const DIMENSIONS: [string, string][] = [
  ['hookTactic', 'Hook tactic'], ['messagingAngle', 'Messaging angle'],
  ['creativeMechanic', 'Mechanic'], ['offerType', 'Offer'],
  ['visualFormat', 'Format'], ['awarenessStage', 'Awareness'],
];
const QUAD_COLOR: Record<Gene['quadrant'], string> = {
  edge: 'var(--v3-pink)', standard: 'var(--v3-teal)', fading: 'var(--v3-amber)', low: 'var(--v3-ink-3)',
};
const pretty = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmt = (n: number) => n.toLocaleString('en-US');

// ---- count-up hook (respects reduced motion) -------------------------------
function useCountUp(target: number, ms = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target); return;
    }
    let raf = 0; const start = performance.now(); const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

export default function V3Page() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [genome, setGenome] = useState<GenomeResp | null>(null);
  const [dim, setDim] = useState<string>('hookTactic');

  useEffect(() => {
    fetch('/api/genome/pulse').then((r) => r.json()).then(setPulse).catch(() => {});
    fetch('/api/genome').then((r) => r.json()).then(setGenome).catch(() => {});
  }, []);

  return (
    <div className="v3root">
      <style>{CSS}</style>

      <header className="v3-top">
        <div className="v3-wrap v3-top-in">
          <div className="v3-brand"><span className="v3-dot">🧬</span>Genome <small>v3</small></div>
          <span style={{ flex: 1 }} />
          <Link href="/dashboard/v3/brief" className="v3-ghost" style={{ marginRight: 8, borderColor: 'var(--v3-pink)', color: 'var(--v3-pink-press)' }}>✨ Brief generator</Link>
          <Link href="/dashboard/v2" className="v3-ghost">← Back to v2</Link>
        </div>
      </header>

      <main className="v3-wrap">
        <LivePipeline pulse={pulse} />
        <FastGrowing />
        <GenomeSection genome={genome} dim={dim} setDim={setDim} />
        <StealWinner />
      </main>

      <footer className="v3-foot v3-wrap">
        <span><b>Genome v3</b> — live from your pipeline.</span>
        <span>Longevity + reach → creative DNA → generation.</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Live ingestion pipeline
// ---------------------------------------------------------------------------
function LivePipeline({ pulse }: { pulse: Pulse | null }) {
  const ads = useCountUp(pulse?.totals.ads ?? 0);
  const status = pulse?.ingestion.status ?? 'stalled';
  const statusLabel = status === 'live' ? 'Live · ingesting' : status === 'idle' ? 'Idle' : 'Stalled';
  const hrs = pulse?.ingestion.hoursSinceLastAd ?? null;

  const daily = pulse?.ingestion.daily ?? [];
  const maxN = Math.max(1, ...daily.map((d) => d.n));
  const cov = pulse?.refresh.coveragePct ?? 0;
  const ring = 2 * Math.PI * 34;

  return (
    <section className="v3-hero">
      <div className="v3-hero-main">
        <span className={`v3-status v3-status-${status}`}>
          <span className="v3-pulsedot" /> {statusLabel}
        </span>
        <div className="v3-bignum" aria-live="polite">{fmt(ads)}</div>
        <div className="v3-bignum-l">ads sequenced across {pulse ? fmt(pulse.totals.brands) : '—'} brands</div>

        {status !== 'live' && pulse && (
          <div className="v3-alert">
            <b>Pipeline {status}.</b> Last ad ingested {hrs != null ? `${Math.round(hrs / 24)} days ago` : 'unknown'}.
            {' '}{fmt(pulse.refresh.brandsDue)} of {fmt(pulse.totals.brands)} accounts are overdue for a weekly re-check.
          </div>
        )}

        <div className="v3-chips">
          <div className="v3-chip"><div className="v3-chip-n">{pulse ? fmt(pulse.totals.activeAds) : '—'}</div><div className="v3-chip-l">active ads</div></div>
          <div className="v3-chip"><div className="v3-chip-n">{pulse ? fmt(pulse.ingestion.last7d) : '—'}</div><div className="v3-chip-l">added this week</div></div>
          <div className="v3-chip"><div className="v3-chip-n">{pulse ? fmt(pulse.ingestion.last24h) : '—'}</div><div className="v3-chip-l">added today</div></div>
        </div>

        <div className="v3-spark">
          <div className="v3-spark-l">Ingestion · last 14 days</div>
          <div className="v3-spark-bars">
            {daily.length === 0 && <span className="v3-spark-empty">No ingestion recorded in the last 14 days</span>}
            {daily.map((d) => (
              <span key={d.day} className="v3-spark-bar" style={{ height: `${Math.max(4, (d.n / maxN) * 100)}%` }} title={`${d.day}: ${fmt(d.n)}`} />
            ))}
          </div>
        </div>
      </div>

      <aside className="v3-hero-side">
        <div className="v3-ring-l">Weekly refresh coverage</div>
        <svg viewBox="0 0 80 80" className="v3-ring" role="img" aria-label={`${cov}% of accounts checked this week`}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--v3-line)" strokeWidth="8" />
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--v3-pink)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={ring * (1 - cov / 100)} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
          <text x="40" y="44" textAnchor="middle" fontSize="19" fontWeight="800" fill="var(--v3-ink)">{cov}%</text>
        </svg>
        <div className="v3-ring-sub">
          {pulse ? `${fmt(pulse.refresh.brandsFresh)} of ${fmt(pulse.totals.brands)} accounts checked in the last 7 days` : 'Loading…'}
        </div>
        <div className="v3-ring-note">Every account is re-checked weekly for new ads. Overdue accounts are queued first.</div>
      </aside>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2) Genome
// ---------------------------------------------------------------------------
function GenomeSection({ genome, dim, setDim }: { genome: GenomeResp | null; dim: string; setDim: (d: string) => void }) {
  const genes = useMemo(() => {
    const g = genome?.dimensions?.[dim] ?? [];
    return [...g].sort((a, b) => b.provenScore - a.provenScore);
  }, [genome, dim]);
  const maxP = genes[0]?.provenScore ?? 100;
  const edge = useMemo(() => {
    const e = genes.filter((g) => g.quadrant === 'edge').sort((a, b) => b.medianDays - a.medianDays)[0]
      ?? [...genes].sort((a, b) => b.medianDays - a.medianDays)[0];
    return e;
  }, [genes]);

  return (
    <section className="v3-block">
      <div className="v3-kicker">The winning DNA</div>
      <h2 className="v3-h2">{DIMENSIONS.find((d) => d[0] === dim)?.[1]} genome</h2>
      <p className="v3-lead">Every gene ranked by <b>Proven Score</b> — a blend of median run-days and total reach. High score means battle-tested, not just common.</p>

      <div className="v3-cats">
        {DIMENSIONS.map(([k, l]) => (
          <button key={k} className={`v3-cat ${k === dim ? 'on' : ''}`} onClick={() => setDim(k)}>{l}</button>
        ))}
      </div>

      <div className="v3-grid2">
        <div className="v3-card">
          <h3 className="v3-h3">Genes, ranked by Proven Score</h3>
          <div className="v3-desc">{genome ? `${fmt(genome.meta.classifiedAds)} of ${fmt(genome.meta.totalAds)} ads sequenced (${genome.meta.coveragePct}%)` : 'Loading…'}</div>
          <div className="v3-genes">
            {genes.map((g, i) => (
              <div className="v3-gene" key={g.gene}>
                <span className="v3-rk">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="v3-gname">{pretty(g.gene)} <span className={`v3-tag ${g.quadrant}`}>{g.quadrant}</span></div>
                  <div className="v3-track"><span className="v3-fill" style={{ width: `${Math.round((g.provenScore / maxP) * 100)}%`, background: QUAD_COLOR[g.quadrant] }} /></div>
                </div>
                <div className="v3-score"><div className="v3-s">{g.provenScore}<span className="v3-pct"> pvn</span></div><div className="v3-meta">{g.medianDays}d · {g.reachM}M · {fmt(g.ads)} ads</div></div>
              </div>
            ))}
            {!genome && <div className="v3-desc" style={{ padding: '20px 0' }}>Loading genome…</div>}
          </div>
        </div>

        <div className="v3-card">
          <h3 className="v3-h3">Prevalence × Longevity</h3>
          <div className="v3-desc">Bubble size = reach. Top-left is your edge: rare genes that still run long.</div>
          <Quadrant genes={genes} />
          <div className="v3-legend">
            <span><i style={{ background: 'var(--v3-pink)' }} />Hidden edge</span>
            <span><i style={{ background: 'var(--v3-teal)' }} />Proven standard</span>
            <span><i style={{ background: 'var(--v3-amber)' }} />Crowded / fading</span>
            <span><i style={{ background: 'var(--v3-ink-3)' }} />Low signal</span>
          </div>
          {edge && (
            <div className="v3-insight"><b>Edge →</b> <span><b>{pretty(edge.gene)}</b> runs a median <b>{edge.medianDays} days</b> but is in only <b>{Math.round(edge.prevalence * 100)}%</b> of ads. Under-used, over-performing.</span></div>
          )}
        </div>
      </div>
    </section>
  );
}

function Quadrant({ genes }: { genes: Gene[] }) {
  if (!genes.length) return <div style={{ height: 300 }} />;
  const W = 460, H = 340, pad = { l: 46, r: 18, t: 18, b: 40 };
  const xMax = Math.max(0.5, Math.max(...genes.map((g) => g.prevalence)) * 1.1);
  const yMax = Math.max(...genes.map((g) => g.medianDays)) * 1.12;
  const yMin = Math.min(...genes.map((g) => g.medianDays)) * 0.9;
  const px = (v: number) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const py = (v: number) => (H - pad.b) - ((v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);
  const prevs = genes.map((g) => g.prevalence).sort((a, b) => a - b);
  const days = genes.map((g) => g.medianDays).sort((a, b) => a - b);
  const medX = prevs[Math.floor(prevs.length / 2)], medY = days[Math.floor(days.length / 2)];
  return (
    <div style={{ overflowX: 'auto', marginTop: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520, display: 'block', margin: '0 auto' }} role="img" aria-label="Prevalence vs longevity scatter">
        <rect x={pad.l} y={pad.t} width={Math.max(0, px(medX) - pad.l)} height={Math.max(0, py(medY) - pad.t)} fill="var(--v3-pink-tint)" />
        <line x1={px(medX)} y1={pad.t} x2={px(medX)} y2={H - pad.b} stroke="var(--v3-line-2)" strokeDasharray="4 4" />
        <line x1={pad.l} y1={py(medY)} x2={W - pad.r} y2={py(medY)} stroke="var(--v3-line-2)" strokeDasharray="4 4" />
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--v3-line-2)" />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="var(--v3-line-2)" />
        <text x={(pad.l + W - pad.r) / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--v3-ink-3)" fontWeight="600">Prevalence (share of ads) →</text>
        <text transform={`translate(14,${(pad.t + H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="var(--v3-ink-3)" fontWeight="600">Median run-days →</text>
        <text x={pad.l + 8} y={pad.t + 15} fontSize="10.5" fill="var(--v3-pink)" fontWeight="800">HIDDEN EDGE</text>
        <text x={W - pad.r - 8} y={pad.t + 15} fontSize="10.5" fill="var(--v3-ink-3)" fontWeight="800" textAnchor="end">PROVEN STANDARD</text>
        <text x={W - pad.r - 8} y={H - pad.b - 8} fontSize="10.5" fill="var(--v3-ink-3)" fontWeight="700" textAnchor="end">CROWDED · FADING</text>
        {genes.map((g) => {
          const r = Math.min(34, 6 + Math.sqrt(g.reachM) * 2);
          const c = QUAD_COLOR[g.quadrant];
          return <circle key={g.gene} cx={px(g.prevalence)} cy={py(g.medianDays)} r={r} fill={c} fillOpacity={0.6} stroke={c} strokeWidth={1.5}><title>{`${pretty(g.gene)} · ${g.medianDays}d · ${Math.round(g.prevalence * 100)}% · ${g.reachM}M`}</title></circle>;
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3) Steal the Winner
// ---------------------------------------------------------------------------
type WinnerResp = {
  brand: { name: string; totalAds: number; category: string | null };
  winner: { runDays: number; isActive: boolean; reach: number | null; headline: string | null; body: string | null; format: string | null };
  signal: string;
};
type RemixResp = {
  genome: Record<string, string>;
  remix: { brand: string; headline: string; primaryText: string; cta: string; imageDataUrl: string | null; imageError: string | null };
};

const MY_BRAND = { name: 'Lumen', category: 'Sustainable activewear', voice: 'warm, confident, unfussy', market: 'UK / English' };

function StealWinner() {
  const [input, setInput] = useState('');
  const [winner, setWinner] = useState<WinnerResp | null>(null);
  const [remix, setRemix] = useState<RemixResp | null>(null);
  const [loading, setLoading] = useState<'' | 'winner' | 'remix'>('');
  const [err, setErr] = useState<string | null>(null);
  const remixRef = useRef<HTMLDivElement>(null);

  const findWinner = useCallback(async (brand: string) => {
    if (!brand.trim()) return;
    setLoading('winner'); setErr(null); setWinner(null); setRemix(null);
    try {
      const r = await fetch(`/api/genome/winner?brand=${encodeURIComponent(brand.trim())}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Not found');
      setWinner(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(''); }
  }, []);

  const doRemix = useCallback(async () => {
    if (!winner) return;
    setLoading('remix'); setErr(null);
    try {
      const r = await fetch('/api/genome/remix', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ competitor: winner.brand.name, myBrand: MY_BRAND, generateImage: true }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Remix failed');
      setRemix(await r.json());
      setTimeout(() => remixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Remix failed'); }
    finally { setLoading(''); }
  }, [winner]);

  const suggestions = ['Vinted', 'Desenio', 'Gymshark', 'AG1', 'RevolutionRace', 'Primark'];

  return (
    <section className="v3-block">
      <div className="v3-kicker">The 60-second teardown</div>
      <h2 className="v3-h2">Steal a competitor&apos;s proven winner</h2>
      <p className="v3-lead">Meta hides every performance metric except one it can&apos;t: how long an ad runs. Type a competitor — Genome finds their longest-running ad, decodes it, and rewrites it as a <b>{MY_BRAND.name}</b> ad.</p>

      <div className="v3-search">
        <input className="v3-input" placeholder="Competitor brand name…" value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findWinner(input)} />
        <button className="v3-btn" onClick={() => findWinner(input)} disabled={loading === 'winner'}>
          {loading === 'winner' ? 'Searching…' : 'Expose their winner'}
        </button>
      </div>
      <div className="v3-suggest">
        {suggestions.map((s) => <button key={s} className="v3-sug" onClick={() => { setInput(s); findWinner(s); }}>{s}</button>)}
      </div>

      {err && <div className="v3-err">{err}</div>}

      {winner && (
        <div className="v3-card v3-winner">
          <div className="v3-winner-l">
            <span className="v3-flag">{winner.winner.isActive ? '● still live' : 'was live'} · {winner.winner.format ?? 'ad'}</span>
            <div className="v3-winner-h">{winner.winner.headline || '(no headline)'}</div>
            {winner.winner.body && <div className="v3-winner-b">{winner.winner.body.slice(0, 180)}</div>}
            <button className="v3-btn" style={{ marginTop: 18 }} onClick={doRemix} disabled={loading === 'remix'}>
              {loading === 'remix' ? 'Decoding & writing your ad…' : `Decode & remix for ${MY_BRAND.name} →`}
            </button>
          </div>
          <div className="v3-winner-r">
            <div className="v3-metric"><span className="v3-metric-n">{fmt(winner.winner.runDays)}</span><span className="v3-metric-u">days live</span></div>
            <div className="v3-metric-s">{winner.winner.reach != null ? `${(winner.winner.reach / 1e6).toFixed(1)}M reached · ` : ''}{winner.brand.name}&apos;s longest-running ad</div>
            <div className="v3-signal">{winner.signal}</div>
          </div>
        </div>
      )}

      {remix && (
        <div className="v3-remix" ref={remixRef}>
          <div className="v3-card">
            <div className="v3-kicker" style={{ marginBottom: 10 }}>Decoded recipe</div>
            {Object.entries(remix.genome).filter(([k]) => k !== 'whyItWorks').map(([k, v]) => (
              <div className="v3-atom" key={k}><span className="v3-atom-k">{pretty(k.replace(/([A-Z])/g, ' $1'))}</span><span className="v3-atom-chip">{pretty(String(v))}</span></div>
            ))}
            {remix.genome.whyItWorks && <div className="v3-why"><b>Why it works:</b> {remix.genome.whyItWorks}</div>}
          </div>
          <div>
            <div className="v3-kicker" style={{ marginBottom: 10 }}>Your ad — {remix.remix.brand}</div>
            <div className="v3-adcard">
              <div className="v3-adcreative">
                {remix.remix.imageDataUrl
                  ? <img src={remix.remix.imageDataUrl} alt="Generated ad creative" className="v3-adimg" />
                  : <><span className="v3-adcreative-h">{remix.remix.headline}</span><span className="v3-genbadge">{remix.remix.imageError ? 'image: ' + remix.remix.imageError.slice(0, 40) : '✨ image renders on deploy'}</span></>}
              </div>
              <div className="v3-adbody">
                <div className="v3-adcopy-h">{remix.remix.headline}</div>
                <div className="v3-adcopy-p">{remix.remix.primaryText}</div>
                <div className="v3-adcta"><span>{remix.remix.brand.toLowerCase()}.com</span><span className="v3-adcta-b">{remix.remix.cta}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1b) Fast-growing brands in Europe → click into a deep audit
// ---------------------------------------------------------------------------
const FLAGS: Record<string, string> = {
  SE: '🇸🇪', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', PL: '🇵🇱',
  DK: '🇩🇰', NO: '🇳🇴', FI: '🇫🇮', BE: '🇧🇪', AT: '🇦🇹', IE: '🇮🇪', PT: '🇵🇹', CH: '🇨🇭', TR: '🇹🇷',
};
type GrowthBrand = {
  pageId: string; name: string; category: string | null; country: string | null;
  reachNow: number; reachGrowthPct: number | null; adsNow: number; adsGrowthPct: number | null; series: number[];
};

function Sparkline({ data, w = 96, h = 30 }: { data: number[]; w?: number; h?: number }) {
  if (!data || data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="var(--v3-pink-tint)" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--v3-pink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FastGrowing() {
  const [brands, setBrands] = useState<GrowthBrand[] | null>(null);
  useEffect(() => {
    fetch('/api/genome/brands/growth?window=182&limit=9').then((r) => r.json()).then((d) => setBrands(d.brands ?? [])).catch(() => setBrands([]));
  }, []);
  return (
    <section className="v3-block">
      <div className="v3-kicker">Rising in Europe</div>
      <h2 className="v3-h2">Fast-growing brands to watch</h2>
      <p className="v3-lead">Ranked by EU reach growth over the last 6 months (from weekly snapshots). Click any brand for a deep audit of their ad account.</p>
      <div className="v3-fg-grid">
        {!brands && Array.from({ length: 6 }).map((_, i) => <div className="v3-fg-card v3-skel" key={i} />)}
        {brands?.map((b) => (
          <Link key={b.pageId} href={`/dashboard/v3/brand/${b.pageId}`} className="v3-fg-card">
            <div className="v3-fg-top">
              <span className="v3-fg-flag">{b.country ? FLAGS[b.country] ?? '🇪🇺' : '🇪🇺'}</span>
              <span className="v3-fg-name">{b.name}</span>
            </div>
            <div className="v3-fg-cat">{b.category ?? 'brand'}</div>
            <div className="v3-fg-mid">
              <div className="v3-fg-growth">{b.reachGrowthPct != null ? `${b.reachGrowthPct >= 0 ? '+' : ''}${b.reachGrowthPct}%` : '—'}</div>
              <Sparkline data={b.series} />
            </div>
            <div className="v3-fg-foot">
              <span>{(b.reachNow / 1e6).toFixed(1)}M reach</span>
              <span>{fmt(b.adsNow)} live ads{b.adsGrowthPct != null ? ` · ${b.adsGrowthPct >= 0 ? '+' : ''}${b.adsGrowthPct}%` : ''}</span>
            </div>
            <span className="v3-fg-cta">Audit their account →</span>
          </Link>
        ))}
        {brands && brands.length === 0 && <div className="v3-desc" style={{ padding: '20px 0' }}>No growth data yet — snapshots need a few weeks of history.</div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scoped styles
// ---------------------------------------------------------------------------
const CSS = `
.v3root{--v3-paper:#FBF8F4;--v3-card:#FFFFFF;--v3-sand:#F4EFE8;--v3-ink:#1C1A1D;--v3-ink-2:#56504F;--v3-ink-3:#928A86;
--v3-line:#EEE7DD;--v3-line-2:#E4DACD;--v3-pink:#FB4E74;--v3-pink-press:#E4315C;--v3-pink-soft:#FFD8E1;--v3-pink-tint:#FFEDF1;
--v3-teal:#0E8B7C;--v3-teal-soft:#D3ECE7;--v3-amber:#E1892A;--v3-green:#1F9D57;
--v3-shadow:0 2px 6px -2px rgba(28,20,18,.06),0 12px 28px -14px rgba(28,20,18,.14);
--v3-r:24px;--v3-r-sm:14px;--v3-pill:999px;
color-scheme:light;background:var(--v3-paper);color:var(--v3-ink);min-height:100vh;
font-family:"SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
.v3root *{box-sizing:border-box;}
.v3-wrap{max-width:1100px;margin:0 auto;padding:0 24px;}
.v3-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--v3-paper) 85%,transparent);backdrop-filter:saturate(1.5) blur(14px);border-bottom:1px solid var(--v3-line);}
.v3-top-in{display:flex;align-items:center;height:64px;}
.v3-brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.03em;font-size:19px;}
.v3-dot{width:29px;height:29px;border-radius:10px;background:var(--v3-pink);display:grid;place-items:center;font-size:15px;box-shadow:0 5px 14px -4px color-mix(in srgb,var(--v3-pink) 60%,transparent);}
.v3-brand small{font-weight:700;color:var(--v3-pink);font-size:11px;letter-spacing:.1em;text-transform:uppercase;}
.v3-ghost{text-decoration:none;font-size:13.5px;font-weight:650;color:var(--v3-ink-2);padding:9px 15px;border-radius:var(--v3-pill);border:1px solid var(--v3-line-2);}

.v3-hero{display:grid;grid-template-columns:1.5fr 1fr;gap:20px;margin-top:30px;}
@media (max-width:820px){.v3-hero{grid-template-columns:1fr;}}
.v3-hero-main,.v3-hero-side{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r);box-shadow:var(--v3-shadow);padding:26px;}
.v3-hero-side{display:flex;flex-direction:column;align-items:center;text-align:center;}
.v3-status{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;padding:6px 13px;border-radius:var(--v3-pill);}
.v3-status-live{color:var(--v3-green);background:#E5F5EC;}
.v3-status-idle{color:var(--v3-amber);background:#FBF0DF;}
.v3-status-stalled{color:var(--v3-pink-press);background:var(--v3-pink-tint);}
.v3-pulsedot{width:8px;height:8px;border-radius:50%;background:currentColor;animation:v3pulse 1.8s infinite;}
@keyframes v3pulse{0%{box-shadow:0 0 0 0 currentColor;opacity:1;}70%{box-shadow:0 0 0 7px transparent;opacity:.7;}100%{box-shadow:0 0 0 0 transparent;opacity:1;}}
.v3-bignum{font-size:clamp(46px,7vw,74px);font-weight:800;letter-spacing:-.04em;line-height:1;margin-top:16px;font-variant-numeric:tabular-nums;}
.v3-bignum-l{font-size:15px;color:var(--v3-ink-3);font-weight:600;margin-top:6px;}
.v3-alert{margin-top:16px;background:var(--v3-pink-tint);border-radius:var(--v3-r-sm);padding:13px 15px;font-size:13.5px;line-height:1.5;}
.v3-alert b{color:var(--v3-pink-press);}
.v3-chips{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;}
.v3-chip{background:var(--v3-sand);border-radius:var(--v3-r-sm);padding:12px 16px;min-width:110px;}
.v3-chip-n{font-size:22px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.v3-chip-l{font-size:12px;color:var(--v3-ink-3);font-weight:600;margin-top:2px;}
.v3-spark{margin-top:22px;}
.v3-spark-l{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--v3-ink-3);margin-bottom:8px;}
.v3-spark-bars{display:flex;align-items:flex-end;gap:4px;height:56px;background:var(--v3-sand);border-radius:12px;padding:8px 10px;}
.v3-spark-bar{flex:1;min-width:5px;border-radius:4px 4px 2px 2px;background:linear-gradient(180deg,var(--v3-pink),var(--v3-pink-press));}
.v3-spark-empty{font-size:12.5px;color:var(--v3-ink-3);font-weight:600;align-self:center;margin:0 auto;}
.v3-ring-l{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--v3-ink-3);}
.v3-ring{width:150px;height:150px;margin:14px 0 6px;}
.v3-ring-sub{font-size:13px;color:var(--v3-ink-2);font-weight:600;}
.v3-ring-note{font-size:12px;color:var(--v3-ink-3);margin-top:12px;line-height:1.5;}

.v3-block{padding:38px 0 8px;}
.v3-kicker{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--v3-pink);}
.v3-h2{font-size:clamp(24px,3.2vw,34px);font-weight:800;letter-spacing:-.03em;margin:10px 0 0;}
.v3-h3{font-size:17px;font-weight:750;margin:0;}
.v3-lead{color:var(--v3-ink-2);font-size:15.5px;max-width:62ch;margin:10px 0 0;}
.v3-desc{color:var(--v3-ink-3);font-size:13px;margin-top:5px;}
.v3-cats{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0;}
.v3-cat{border:1.5px solid var(--v3-line-2);background:var(--v3-card);color:var(--v3-ink-2);padding:9px 16px;border-radius:var(--v3-pill);font-weight:650;font-size:13.5px;cursor:pointer;font-family:inherit;}
.v3-cat.on{background:var(--v3-ink);border-color:var(--v3-ink);color:var(--v3-paper);}
.v3-grid2{display:grid;grid-template-columns:1.05fr 1fr;gap:20px;}
@media (max-width:900px){.v3-grid2{grid-template-columns:1fr;}}
.v3-card{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r);box-shadow:var(--v3-shadow);padding:24px;}
.v3-genes{margin-top:14px;}
.v3-gene{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:13px;padding:12px 0;border-top:1px solid var(--v3-line);}
.v3-gene:first-child{border-top:none;}
.v3-rk{font-family:var(--v3-mono,ui-monospace);font-size:12px;color:var(--v3-ink-3);font-weight:600;}
.v3-gname{font-weight:700;font-size:14.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.v3-tag{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:var(--v3-pill);}
.v3-tag.edge{background:var(--v3-pink-tint);color:var(--v3-pink-press);}
.v3-tag.standard{background:var(--v3-teal-soft);color:var(--v3-teal);}
.v3-tag.fading{background:var(--v3-sand);color:var(--v3-ink-3);}
.v3-tag.low{background:transparent;color:var(--v3-ink-3);border:1px dashed var(--v3-line-2);}
.v3-track{height:9px;border-radius:99px;background:var(--v3-sand);overflow:hidden;margin-top:8px;}
.v3-fill{display:block;height:100%;border-radius:99px;transition:width .8s cubic-bezier(.22,1,.36,1);}
.v3-score{text-align:right;}
.v3-s{font-weight:800;font-size:16px;font-variant-numeric:tabular-nums;}
.v3-pct{font-size:11px;color:var(--v3-ink-3);font-weight:600;}
.v3-meta{font-size:11px;color:var(--v3-ink-3);font-variant-numeric:tabular-nums;}
.v3-legend{display:flex;flex-wrap:wrap;gap:15px;margin-top:16px;font-size:12px;color:var(--v3-ink-2);}
.v3-legend span{display:inline-flex;align-items:center;gap:6px;}
.v3-legend i{width:11px;height:11px;border-radius:4px;}
.v3-insight{background:var(--v3-pink-tint);border-radius:var(--v3-r-sm);padding:14px 16px;font-size:13.5px;margin-top:18px;line-height:1.5;display:flex;gap:10px;}
.v3-insight b{color:var(--v3-pink-press);}

.v3-search{display:flex;gap:10px;margin-top:22px;max-width:560px;}
.v3-input{flex:1;height:48px;border:1.5px solid var(--v3-line-2);border-radius:var(--v3-pill);background:var(--v3-card);padding:0 20px;font-size:15px;font-family:inherit;color:var(--v3-ink);}
.v3-input:focus{outline:none;border-color:var(--v3-pink);}
.v3-btn{background:var(--v3-pink);color:#fff;border:none;height:48px;border-radius:var(--v3-pill);font-weight:750;font-size:14.5px;padding:0 22px;cursor:pointer;font-family:inherit;box-shadow:0 10px 24px -10px color-mix(in srgb,var(--v3-pink) 70%,transparent);}
.v3-btn:hover{background:var(--v3-pink-press);}
.v3-btn:disabled{opacity:.6;cursor:default;}
.v3-suggest{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
.v3-sug{border:1px solid var(--v3-line-2);background:var(--v3-card);color:var(--v3-ink-2);padding:6px 13px;border-radius:var(--v3-pill);font-size:12.5px;font-weight:650;cursor:pointer;font-family:inherit;}
.v3-sug:hover{border-color:var(--v3-pink);color:var(--v3-ink);}
.v3-err{margin-top:16px;background:var(--v3-pink-tint);color:var(--v3-pink-press);border-radius:var(--v3-r-sm);padding:13px 16px;font-size:13.5px;font-weight:600;}

.v3-winner{display:grid;grid-template-columns:1.3fr 1fr;gap:0;padding:0;overflow:hidden;margin-top:20px;}
@media (max-width:800px){.v3-winner{grid-template-columns:1fr;}}
.v3-winner-l{padding:26px;}
.v3-winner-r{padding:26px;background:var(--v3-sand);border-left:1px solid var(--v3-line);display:flex;flex-direction:column;justify-content:center;gap:6px;}
@media (max-width:800px){.v3-winner-r{border-left:none;border-top:1px solid var(--v3-line);}}
.v3-flag{display:inline-flex;font-size:11.5px;font-weight:750;color:var(--v3-ink-2);background:var(--v3-card);border:1px solid var(--v3-line);padding:4px 10px;border-radius:var(--v3-pill);}
.v3-winner-h{font-size:23px;font-weight:800;letter-spacing:-.02em;margin-top:14px;line-height:1.1;}
.v3-winner-b{font-size:14px;color:var(--v3-ink-2);margin-top:12px;line-height:1.5;}
.v3-metric{display:flex;align-items:baseline;gap:8px;}
.v3-metric-n{font-size:44px;font-weight:800;letter-spacing:-.04em;color:var(--v3-pink);font-variant-numeric:tabular-nums;line-height:1;}
.v3-metric-u{font-size:14px;font-weight:700;color:var(--v3-ink-2);}
.v3-metric-s{font-size:12.5px;color:var(--v3-ink-3);font-weight:600;}
.v3-signal{font-size:13px;color:var(--v3-ink-2);margin-top:14px;line-height:1.5;border-top:1px dashed var(--v3-line-2);padding-top:14px;}

.v3-remix{display:grid;grid-template-columns:1fr 1.15fr;gap:22px;margin-top:22px;}
@media (max-width:820px){.v3-remix{grid-template-columns:1fr;}}
.v3-atom{display:grid;grid-template-columns:130px 1fr;gap:12px;padding:11px 0;border-top:1px solid var(--v3-line);align-items:center;}
.v3-atom:first-of-type{border-top:none;}
.v3-atom-k{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--v3-ink-3);}
.v3-atom-chip{display:inline-block;background:var(--v3-pink-tint);color:var(--v3-pink-press);font-size:12.5px;font-weight:750;padding:4px 12px;border-radius:99px;justify-self:start;}
.v3-why{font-size:13px;color:var(--v3-ink-2);line-height:1.5;margin-top:14px;background:var(--v3-sand);border-radius:var(--v3-r-sm);padding:13px 15px;}
.v3-why b{color:var(--v3-ink);}
.v3-adcard{border-radius:var(--v3-r-sm);overflow:hidden;border:1px solid var(--v3-line);box-shadow:var(--v3-shadow);}
.v3-adcreative{aspect-ratio:4/5;max-height:320px;background:linear-gradient(155deg,#2A2530,#3A3340);position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:22px;overflow:hidden;}
.v3-adimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.v3-adcreative-h{position:relative;z-index:1;color:#fff;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.05;text-shadow:0 2px 20px rgba(0,0,0,.35);}
.v3-genbadge{position:absolute;bottom:14px;right:14px;z-index:1;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.4);padding:4px 9px;border-radius:99px;}
.v3-adbody{padding:16px 18px;background:var(--v3-card);}
.v3-adcopy-h{font-size:16px;font-weight:800;letter-spacing:-.01em;}
.v3-adcopy-p{font-size:14px;color:var(--v3-ink);line-height:1.5;margin-top:8px;}
.v3-adcta{display:flex;align-items:center;justify-content:space-between;margin-top:14px;font-size:12px;color:var(--v3-ink-3);font-weight:700;}
.v3-adcta-b{background:var(--v3-ink);color:var(--v3-paper);padding:9px 16px;border-radius:10px;font-size:13px;}

.v3-fg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:22px;}
.v3-fg-card{display:flex;flex-direction:column;gap:8px;background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r-sm);box-shadow:var(--v3-shadow);padding:18px;text-decoration:none;color:var(--v3-ink);transition:transform .14s,box-shadow .14s,border-color .14s;}
.v3-fg-card:hover{transform:translateY(-3px);border-color:var(--v3-pink);box-shadow:0 10px 30px -12px rgba(28,20,18,.2);}
.v3-skel{height:172px;background:linear-gradient(100deg,var(--v3-sand),var(--v3-card),var(--v3-sand));background-size:200% 100%;animation:v3shimmer 1.4s infinite;}
@keyframes v3shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.v3-fg-top{display:flex;align-items:center;gap:9px;}
.v3-fg-flag{font-size:19px;line-height:1;}
.v3-fg-name{font-weight:750;font-size:16px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.v3-fg-cat{font-size:11.5px;color:var(--v3-ink-3);font-weight:600;text-transform:capitalize;}
.v3-fg-mid{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:4px;}
.v3-fg-growth{font-size:30px;font-weight:800;letter-spacing:-.03em;color:var(--v3-green);font-variant-numeric:tabular-nums;line-height:1;}
.v3-fg-foot{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--v3-ink-2);font-weight:600;font-variant-numeric:tabular-nums;border-top:1px solid var(--v3-line);padding-top:10px;margin-top:2px;}
.v3-fg-cta{font-size:12.5px;font-weight:750;color:var(--v3-pink);margin-top:2px;}
.v3-foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid var(--v3-line);margin-top:44px;padding:30px 24px 60px;color:var(--v3-ink-3);font-size:13px;}
.v3-foot b{color:var(--v3-ink);}
@media (prefers-reduced-motion:reduce){.v3root *{animation:none!important;transition:none!important;}}
`;
