'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// =============================================================================
// /dashboard/v3/brand/[pageId] — deep audit of one brand's ad account.
// Built from ad-library data only (growth, efficiency, format mix, winner,
// genome slice, verdict). Fetches /api/genome/brand/[pageId]/audit.
// =============================================================================

const FLAGS: Record<string, string> = {
  SE: '🇸🇪', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', PL: '🇵🇱',
  DK: '🇩🇰', NO: '🇳🇴', FI: '🇫🇮', BE: '🇧🇪', AT: '🇦🇹', IE: '🇮🇪', PT: '🇵🇹', CH: '🇨🇭', TR: '🇹🇷',
};
const fmt = (n: number) => n.toLocaleString('en-US');
const pretty = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const reachStr = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`);

type Audit = {
  brand: { name: string; pageId: string; category: string | null; country: string | null; website: string | null };
  totals: { totalAds: number; activeAds: number; totalReach: number; activeReach: number; reachPerActiveAd: number };
  growth: { reachPct: number | null; adsPct: number | null; reachNowM: number | null; reachThenM: number | null; series: { week: string; activeAds: number; reachM: number; newAds: number }[] };
  formats: { format: string; count: number; pct: number }[];
  winner: { runDays: number; reach: number | null; headline: string | null; body: string | null; isActive: boolean; format: string | null } | null;
  genome: { classifiedAds: number; hooks: { gene: string; n: number; medianDays: number }[] };
  verdict: { tone: 'good' | 'warn' | 'note'; text: string }[];
};

export default function BrandAuditPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const [data, setData] = useState<Audit | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/genome/brand/${pageId}/audit`)
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error || 'Failed'); return r.json(); })
      .then(setData).catch((e) => setErr(e.message));
  }, [pageId]);

  return (
    <div className="v3root">
      <style>{CSS}</style>
      <header className="v3-top"><div className="v3-wrap v3-top-in">
        <div className="v3-brand"><span className="v3-dot">🧬</span>Genome <small>audit</small></div>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/v3" className="v3-ghost">← All brands</Link>
      </div></header>

      <main className="v3-wrap">
        {err && <div className="v3-err" style={{ marginTop: 40 }}>{err}</div>}
        {!data && !err && <div className="v3-loading">Auditing account…</div>}
        {data && <AuditBody d={data} />}
      </main>
    </div>
  );
}

function AuditBody({ d }: { d: Audit }) {
  const flag = d.brand.country ? FLAGS[d.brand.country] ?? '🇪🇺' : '🇪🇺';
  return (
    <>
      <section className="v3-head">
        <div className="v3-head-l">
          <div className="v3-brandrow"><span className="v3-bigflag">{flag}</span><h1 className="v3-title">{d.brand.name}</h1></div>
          <div className="v3-sub">{d.brand.category ?? 'brand'}{d.brand.website ? ` · ${d.brand.website.replace(/^https?:\/\//, '')}` : ''}</div>
        </div>
        {d.growth.reachPct != null && (
          <div className="v3-headgrowth">
            <div className={`v3-hg-n ${d.growth.reachPct >= 0 ? 'up' : 'down'}`}>{d.growth.reachPct >= 0 ? '+' : ''}{d.growth.reachPct}%</div>
            <div className="v3-hg-l">EU reach · 6 months</div>
          </div>
        )}
      </section>

      {/* verdict */}
      <section className="v3-verdict">
        {d.verdict.map((v, i) => (
          <div className={`v3-vrow v3-v-${v.tone}`} key={i}><span className="v3-vdot" />{v.text}</div>
        ))}
      </section>

      {/* stat tiles */}
      <section className="v3-tiles">
        <Tile n={fmt(d.totals.activeAds)} l="active ads" sub={`of ${fmt(d.totals.totalAds)} tracked`} />
        <Tile n={reachStr(d.totals.activeReach)} l="active reach" sub="EU, live ads" />
        <Tile n={reachStr(d.totals.reachPerActiveAd)} l="reach / active ad" sub={d.totals.reachPerActiveAd >= 300000 ? 'efficient' : d.totals.reachPerActiveAd < 30000 ? 'high volume' : 'moderate'} />
        <Tile n={d.growth.adsPct != null ? `${d.growth.adsPct >= 0 ? '+' : ''}${d.growth.adsPct}%` : '—'} l="ad-count growth" sub="6 months" />
      </section>

      <div className="v3-cols">
        {/* trajectory */}
        <div className="v3-card">
          <h3 className="v3-h3">Reach &amp; volume trajectory</h3>
          <div className="v3-desc">Weekly EU reach (area) and active ad count (line), last year</div>
          <Trajectory series={d.growth.series} />
        </div>
        {/* format mix */}
        <div className="v3-card">
          <h3 className="v3-h3">Creative format mix</h3>
          <div className="v3-desc">Share of all their ads by format</div>
          <div className="v3-fmt">
            {d.formats.slice(0, 6).map((f) => (
              <div className="v3-fmt-row" key={f.format}>
                <span className="v3-fmt-lbl">{f.format}</span>
                <span className="v3-fmt-track"><span className="v3-fmt-fill" style={{ width: `${f.pct}%` }} /></span>
                <span className="v3-fmt-v">{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="v3-cols">
        {/* winner */}
        {d.winner && (
          <div className="v3-card">
            <div className="v3-kicker" style={{ marginBottom: 8 }}>Proven winner</div>
            <div className="v3-win-h">{d.winner.headline || '(no headline)'}</div>
            {d.winner.body && <div className="v3-win-b">{d.winner.body.slice(0, 160)}</div>}
            <div className="v3-win-m">
              <span className="v3-win-days">{fmt(d.winner.runDays)}<small> days live</small></span>
              {d.winner.reach != null && <span className="v3-win-reach">{reachStr(d.winner.reach)} reached</span>}
              {d.winner.isActive && <span className="v3-win-live">● still running</span>}
            </div>
          </div>
        )}
        {/* genome */}
        <div className="v3-card">
          <div className="v3-kicker" style={{ marginBottom: 8 }}>Hook DNA</div>
          {d.genome.hooks.length === 0 && <div className="v3-desc">Not enough classified ads yet for a genome read.</div>}
          {d.genome.hooks.map((h) => (
            <div className="v3-hook" key={h.gene}>
              <span className="v3-hook-name">{pretty(h.gene)}</span>
              <span className="v3-hook-meta">{fmt(h.n)} ads · {h.medianDays}d median run</span>
            </div>
          ))}
          {d.genome.classifiedAds > 0 && <div className="v3-desc" style={{ marginTop: 10 }}>{fmt(d.genome.classifiedAds)} of their ads sequenced</div>}
        </div>
      </div>
    </>
  );
}

function Tile({ n, l, sub }: { n: string; l: string; sub?: string }) {
  return <div className="v3-tile"><div className="v3-tile-n">{n}</div><div className="v3-tile-l">{l}</div>{sub && <div className="v3-tile-s">{sub}</div>}</div>;
}

function Trajectory({ series }: { series: Audit['growth']['series'] }) {
  if (!series || series.length < 2) return <div style={{ height: 200 }} className="v3-desc">Not enough history.</div>;
  const W = 560, H = 200, pad = { l: 8, r: 8, t: 14, b: 22 };
  const reach = series.map((s) => s.reachM), ads = series.map((s) => s.activeAds);
  const rMax = Math.max(...reach) || 1, aMax = Math.max(...ads) || 1;
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const yR = (v: number) => (H - pad.b) - (v / rMax) * (H - pad.t - pad.b);
  const yA = (v: number) => (H - pad.b) - (v / aMax) * (H - pad.t - pad.b);
  const areaPts = series.map((s, i) => `${x(i)},${yR(s.reachM)}`);
  const adPts = series.map((s, i) => `${x(i)},${yA(s.activeAds)}`).join(' ');
  const first = series[0].week.slice(0, 7), last = series[series.length - 1].week.slice(0, 7);
  return (
    <div style={{ overflowX: 'auto', marginTop: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 620, display: 'block' }} role="img" aria-label="Reach and active-ads trajectory">
        <polyline points={`${pad.l},${H - pad.b} ${areaPts.join(' ')} ${W - pad.r},${H - pad.b}`} fill="var(--v3-pink-tint)" stroke="none" />
        <polyline points={areaPts.join(' ')} fill="none" stroke="var(--v3-pink)" strokeWidth={2.5} strokeLinejoin="round" />
        <polyline points={adPts} fill="none" stroke="var(--v3-teal)" strokeWidth={2} strokeDasharray="3 3" strokeLinejoin="round" />
        <text x={pad.l} y={H - 6} fontSize="10.5" fill="var(--v3-ink-3)" fontWeight="600">{first}</text>
        <text x={W - pad.r} y={H - 6} fontSize="10.5" fill="var(--v3-ink-3)" fontWeight="600" textAnchor="end">{last}</text>
      </svg>
      <div className="v3-legend" style={{ marginTop: 6 }}>
        <span><i style={{ background: 'var(--v3-pink)' }} />EU reach</span>
        <span><i style={{ background: 'var(--v3-teal)' }} />Active ads</span>
      </div>
    </div>
  );
}

const CSS = `
.v3root{--v3-paper:#FBF8F4;--v3-card:#FFFFFF;--v3-sand:#F4EFE8;--v3-ink:#1C1A1D;--v3-ink-2:#56504F;--v3-ink-3:#928A86;
--v3-line:#EEE7DD;--v3-line-2:#E4DACD;--v3-pink:#FB4E74;--v3-pink-press:#E4315C;--v3-pink-soft:#FFD8E1;--v3-pink-tint:#FFEDF1;
--v3-teal:#0E8B7C;--v3-teal-soft:#D3ECE7;--v3-amber:#E1892A;--v3-green:#1F9D57;
--v3-shadow:0 2px 6px -2px rgba(28,20,18,.06),0 12px 28px -14px rgba(28,20,18,.14);--v3-r:24px;--v3-r-sm:14px;--v3-pill:999px;
color-scheme:light;background:var(--v3-paper);color:var(--v3-ink);min-height:100vh;
font-family:"SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
.v3root *{box-sizing:border-box;}
.v3-wrap{max-width:1000px;margin:0 auto;padding:0 24px;}
.v3-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--v3-paper) 85%,transparent);backdrop-filter:saturate(1.5) blur(14px);border-bottom:1px solid var(--v3-line);}
.v3-top-in{display:flex;align-items:center;height:64px;}
.v3-brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.03em;font-size:19px;}
.v3-dot{width:29px;height:29px;border-radius:10px;background:var(--v3-pink);display:grid;place-items:center;font-size:15px;box-shadow:0 5px 14px -4px color-mix(in srgb,var(--v3-pink) 60%,transparent);}
.v3-brand small{font-weight:700;color:var(--v3-pink);font-size:11px;letter-spacing:.1em;text-transform:uppercase;}
.v3-ghost{text-decoration:none;font-size:13.5px;font-weight:650;color:var(--v3-ink-2);padding:9px 15px;border-radius:var(--v3-pill);border:1px solid var(--v3-line-2);}
.v3-loading{padding:80px 0;text-align:center;color:var(--v3-ink-3);font-size:15px;font-weight:600;}
.v3-err{background:var(--v3-pink-tint);color:var(--v3-pink-press);border-radius:var(--v3-r-sm);padding:14px 16px;font-weight:600;}

.v3-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:36px 0 8px;}
.v3-brandrow{display:flex;align-items:center;gap:12px;}
.v3-bigflag{font-size:34px;line-height:1;}
.v3-title{font-size:clamp(30px,4.5vw,44px);font-weight:800;letter-spacing:-.035em;margin:0;}
.v3-sub{color:var(--v3-ink-2);font-size:15px;margin-top:8px;text-transform:capitalize;}
.v3-headgrowth{text-align:right;}
.v3-hg-n{font-size:clamp(34px,5vw,52px);font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums;line-height:1;}
.v3-hg-n.up{color:var(--v3-green);} .v3-hg-n.down{color:var(--v3-amber);}
.v3-hg-l{font-size:12px;color:var(--v3-ink-3);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:4px;}

.v3-verdict{display:flex;flex-direction:column;gap:8px;margin:22px 0;}
.v3-vrow{display:flex;align-items:flex-start;gap:11px;background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r-sm);padding:14px 16px;font-size:14px;line-height:1.5;font-weight:500;box-shadow:var(--v3-shadow);}
.v3-vdot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex:0 0 auto;}
.v3-v-good .v3-vdot{background:var(--v3-green);} .v3-v-warn .v3-vdot{background:var(--v3-amber);} .v3-v-note .v3-vdot{background:var(--v3-ink-3);}

.v3-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:8px 0 6px;}
@media (max-width:720px){.v3-tiles{grid-template-columns:repeat(2,1fr);}}
.v3-tile{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r-sm);padding:18px;box-shadow:var(--v3-shadow);}
.v3-tile-n{font-size:26px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.v3-tile-l{font-size:12.5px;color:var(--v3-ink-2);font-weight:650;margin-top:3px;}
.v3-tile-s{font-size:11px;color:var(--v3-ink-3);font-weight:600;margin-top:2px;}

.v3-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;}
@media (max-width:820px){.v3-cols{grid-template-columns:1fr;}}
.v3-card{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r);box-shadow:var(--v3-shadow);padding:22px;}
.v3-h3{font-size:16.5px;font-weight:750;margin:0;}
.v3-kicker{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--v3-pink);}
.v3-desc{color:var(--v3-ink-3);font-size:13px;margin-top:5px;}
.v3-legend{display:flex;gap:15px;font-size:12px;color:var(--v3-ink-2);}
.v3-legend span{display:inline-flex;align-items:center;gap:6px;} .v3-legend i{width:11px;height:11px;border-radius:4px;}

.v3-fmt{margin-top:14px;display:flex;flex-direction:column;gap:11px;}
.v3-fmt-row{display:grid;grid-template-columns:90px 1fr 40px;align-items:center;gap:11px;}
.v3-fmt-lbl{font-size:13px;font-weight:650;text-transform:capitalize;}
.v3-fmt-track{height:10px;border-radius:99px;background:var(--v3-sand);overflow:hidden;}
.v3-fmt-fill{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--v3-pink),var(--v3-pink-press));}
.v3-fmt-v{text-align:right;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;}

.v3-win-h{font-size:20px;font-weight:800;letter-spacing:-.02em;margin-top:10px;line-height:1.15;}
.v3-win-b{font-size:13.5px;color:var(--v3-ink-2);margin-top:10px;line-height:1.5;}
.v3-win-m{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-top:16px;}
.v3-win-days{font-size:30px;font-weight:800;color:var(--v3-pink);letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.v3-win-days small{font-size:13px;color:var(--v3-ink-2);font-weight:700;}
.v3-win-reach{font-size:13.5px;font-weight:700;color:var(--v3-ink-2);}
.v3-win-live{font-size:12.5px;font-weight:750;color:var(--v3-green);}

.v3-hook{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--v3-line);}
.v3-hook:first-of-type{border-top:none;}
.v3-hook-name{font-weight:700;font-size:14.5px;}
.v3-hook-meta{font-size:12px;color:var(--v3-ink-3);font-weight:600;font-variant-numeric:tabular-nums;}
`;
