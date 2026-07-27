'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// =============================================================================
// /dashboard/v3/brief — the Ad Brief Generator.
// Pick your industry → get prescriptive creative recommendations (best hook,
// angle, mechanic, format, offer) drawn from the best-performing ads in that
// industry, plus an optional Claude-written ad from the brief.
// =============================================================================

const pretty = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const dimLabel: Record<string, string> = {
  hookTactic: 'Hook tactic', messagingAngle: 'Messaging angle', creativeMechanic: 'Mechanic',
  visualFormat: 'Format', offerType: 'Offer', awarenessStage: 'Awareness',
};
const fmt = (n: number) => n.toLocaleString('en-US');

type Gene = { gene: string; ads: number; medianDays: number; reachM: number; prevalence: number; provenScore: number; quadrant: string };
type Brief = {
  id: string; name: string; tagline: string;
  genes: Record<string, string | null>;
  evidence: { medianDays?: number; reachM?: number; prevalence?: number } | null;
  example: { brand: string; headline: string | null; days: number; reach: number | null } | null;
};
type BriefResp = {
  scope: { industry: string; classifiedAds: number; confidence: 'high' | 'medium' | 'low' };
  industries: { label: string; classifiedAds: number }[];
  recommendations: Record<string, { pick: Gene; alts: Gene[]; edge: Gene | null }>;
  briefs: Brief[];
};

const GENE_ORDER = ['hookTactic', 'messagingAngle', 'creativeMechanic', 'visualFormat', 'offerType'];

export default function BriefPage() {
  const [industry, setIndustry] = useState<string>('All industries');
  const [data, setData] = useState<BriefResp | null>(null);
  const [brand, setBrand] = useState('');

  const load = useCallback((ind: string) => {
    setData(null);
    const q = ind && ind !== 'All industries' ? `?industry=${encodeURIComponent(ind)}` : '';
    fetch(`/api/genome/brief${q}`).then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);
  useEffect(() => { load('All industries'); }, [load]);

  const industries = ['All industries', ...(data?.industries.map((i) => i.label) ?? [])];

  return (
    <div className="v3root">
      <style>{CSS}</style>
      <header className="v3-top"><div className="v3-wrap v3-top-in">
        <div className="v3-brand"><span className="v3-dot">🧬</span>Genome <small>· brief generator</small></div>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/v3" className="v3-ghost">← Dashboard</Link>
      </div></header>

      <main className="v3-wrap">
        <section className="v3-hero">
          <div className="v3-kicker">Ad Brief Generator</div>
          <h1 className="v3-h1">Build your next ad from what already wins.</h1>
          <p className="v3-lead">Pick your industry. Genome reads every classified ad in it, weights each creative choice by how long it runs and how far it reaches, and hands you the hook, angle, mechanic, format and offer most likely to work — plus a play nobody else is running.</p>

          <div className="v3-controls">
            <div className="v3-field">
              <label>Your industry</label>
              <div className="v3-pills">
                {industries.map((ind) => (
                  <button key={ind} className={`v3-pill ${ind === industry ? 'on' : ''}`} onClick={() => { setIndustry(ind); load(ind); }}>
                    {ind === 'All industries' ? ind : pretty(ind)}
                  </button>
                ))}
              </div>
            </div>
            <div className="v3-field">
              <label>Your brand <span className="v3-opt">(optional, for copy)</span></label>
              <input className="v3-input" placeholder="e.g. Lumen" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
          </div>

          {data && (
            <div className={`v3-conf v3-conf-${data.scope.confidence}`}>
              <b>{data.scope.confidence} confidence</b> · based on {fmt(data.scope.classifiedAds)} sequenced ads in {data.scope.industry === 'All industries' ? 'all industries' : pretty(data.scope.industry)}
            </div>
          )}
        </section>

        {!data && <div className="v3-loading">Reading the industry genome…</div>}

        {data && (
          <>
            <section className="v3-briefs">
              {data.briefs.map((b) => <BriefCard key={b.id} brief={b} brand={brand} industry={data.scope.industry} />)}
            </section>

            <section className="v3-block">
              <div className="v3-kicker">Full recommendations</div>
              <h2 className="v3-h2">Best-performing choice, by dimension</h2>
              <p className="v3-lead">Each dimension ranked by proven score. “Edge” = long-running but rare — your differentiator.</p>
              <div className="v3-recgrid">
                {GENE_ORDER.concat('awarenessStage').filter((d) => data.recommendations[d]).map((d) => {
                  const r = data.recommendations[d];
                  return (
                    <div className="v3-rec" key={d}>
                      <div className="v3-rec-dim">{dimLabel[d]}</div>
                      <div className="v3-rec-pick">
                        <span className="v3-chip">{pretty(r.pick.gene)}</span>
                        <span className="v3-rec-meta">{r.pick.medianDays}d median · {r.pick.reachM}M · {fmt(r.pick.ads)} ads</span>
                      </div>
                      {r.alts.length > 0 && (
                        <div className="v3-rec-alts">also: {r.alts.map((a) => pretty(a.gene)).join(', ')}</div>
                      )}
                      {r.edge && r.edge.gene !== r.pick.gene && (
                        <div className="v3-rec-edge">✦ Edge: <b>{pretty(r.edge.gene)}</b> — {r.edge.medianDays}d, only {Math.round(r.edge.prevalence * 100)}% use it</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="v3-foot"><div className="v3-wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span><b>Genome v3</b> · Ad Brief Generator — recommendations from best-performing ads.</span>
        <span>What wins in your category → your brief.</span>
      </div></footer>
    </div>
  );
}

function BriefCard({ brief, brand, industry }: { brief: Brief; brand: string; industry: string }) {
  const [copy, setCopy] = useState<{ headline: string; primaryText: string; cta: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const gen = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/genome/brief/copy', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ genes: brief.genes, brand: brand || 'Your brand', industry }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Generation failed');
      setCopy(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [brief, brand, industry]);

  const edge = brief.id === 'edge';
  return (
    <div className={`v3-brief ${edge ? 'edge' : ''}`}>
      <div className="v3-brief-name">{brief.name}{edge && <span className="v3-brief-badge">differentiator</span>}</div>
      <div className="v3-brief-tag">{brief.tagline}</div>
      <div className="v3-brief-genes">
        {GENE_ORDER.map((d) => brief.genes[d] && (
          <div className="v3-brief-gene" key={d}>
            <span className="v3-bg-dim">{dimLabel[d]}</span>
            <span className={`v3-chip ${edge ? 'edge' : ''}`}>{pretty(brief.genes[d]!)}</span>
          </div>
        ))}
      </div>
      {brief.evidence && (
        <div className="v3-brief-ev">
          {brief.evidence.medianDays != null && <>Runs a median <b>{brief.evidence.medianDays} days</b></>}
          {brief.evidence.reachM != null && <> · <b>{brief.evidence.reachM}M</b> reach</>}
          {brief.evidence.prevalence != null && <> · only <b>{Math.round(brief.evidence.prevalence * 100)}%</b> use it</>}
        </div>
      )}
      {brief.example && (
        <div className="v3-brief-ex">
          <span className="v3-ex-l">Proof</span>
          <span><b>{brief.example.brand}</b> — “{(brief.example.headline || 'ad').slice(0, 54)}” · {fmt(brief.example.days)} days live</span>
        </div>
      )}
      <button className="v3-btn" onClick={gen} disabled={loading}>{loading ? 'Writing your ad…' : '✨ Generate ad copy from this brief'}</button>
      {err && <div className="v3-copy-err">{err} — copy generation runs on your deployment (needs the AI key).</div>}
      {copy && (
        <div className="v3-copy">
          <div className="v3-copy-h">{copy.headline}</div>
          <div className="v3-copy-p">{copy.primaryText}</div>
          <div className="v3-copy-cta">{copy.cta}</div>
        </div>
      )}
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
.v3-wrap{max-width:1040px;margin:0 auto;padding:0 24px;}
.v3-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--v3-paper) 85%,transparent);backdrop-filter:saturate(1.5) blur(14px);border-bottom:1px solid var(--v3-line);}
.v3-top-in{display:flex;align-items:center;height:64px;}
.v3-brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.03em;font-size:19px;}
.v3-dot{width:29px;height:29px;border-radius:10px;background:var(--v3-pink);display:grid;place-items:center;font-size:15px;box-shadow:0 5px 14px -4px color-mix(in srgb,var(--v3-pink) 60%,transparent);}
.v3-brand small{font-weight:700;color:var(--v3-pink);font-size:11px;letter-spacing:.1em;text-transform:uppercase;}
.v3-ghost{text-decoration:none;font-size:13.5px;font-weight:650;color:var(--v3-ink-2);padding:9px 15px;border-radius:var(--v3-pill);border:1px solid var(--v3-line-2);}
.v3-loading{padding:70px 0;text-align:center;color:var(--v3-ink-3);font-size:15px;font-weight:600;}

.v3-hero{padding:44px 0 8px;}
.v3-kicker{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--v3-pink);}
.v3-h1{font-size:clamp(32px,5vw,54px);font-weight:800;letter-spacing:-.035em;line-height:1.02;margin:12px 0 0;max-width:18ch;}
.v3-h2{font-size:clamp(22px,3vw,30px);font-weight:800;letter-spacing:-.03em;margin:8px 0 0;}
.v3-lead{color:var(--v3-ink-2);font-size:16px;max-width:64ch;margin:16px 0 0;}
.v3-controls{display:flex;gap:24px;flex-wrap:wrap;margin-top:26px;align-items:flex-start;}
.v3-field label{display:block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--v3-ink-3);margin-bottom:9px;}
.v3-opt{text-transform:none;letter-spacing:0;font-weight:600;color:var(--v3-ink-3);}
.v3-pills{display:flex;gap:8px;flex-wrap:wrap;}
.v3-pill{border:1.5px solid var(--v3-line-2);background:var(--v3-card);color:var(--v3-ink-2);padding:9px 16px;border-radius:var(--v3-pill);font-weight:650;font-size:13.5px;cursor:pointer;font-family:inherit;}
.v3-pill.on{background:var(--v3-ink);border-color:var(--v3-ink);color:var(--v3-paper);}
.v3-input{height:44px;border:1.5px solid var(--v3-line-2);border-radius:var(--v3-pill);background:var(--v3-card);padding:0 18px;font-size:14.5px;font-family:inherit;color:var(--v3-ink);min-width:200px;}
.v3-input:focus{outline:none;border-color:var(--v3-pink);}
.v3-conf{display:inline-block;margin-top:22px;font-size:13px;padding:8px 14px;border-radius:var(--v3-pill);font-weight:600;}
.v3-conf b{text-transform:capitalize;}
.v3-conf-high{background:var(--v3-teal-soft);color:var(--v3-teal);}
.v3-conf-medium{background:#FBF0DF;color:var(--v3-amber);}
.v3-conf-low{background:var(--v3-pink-tint);color:var(--v3-pink-press);}

.v3-briefs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:30px 0 8px;}
@media (max-width:820px){.v3-briefs{grid-template-columns:1fr;}}
.v3-brief{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r);box-shadow:var(--v3-shadow);padding:24px;display:flex;flex-direction:column;gap:14px;}
.v3-brief.edge{border-color:var(--v3-pink-soft);background:linear-gradient(180deg,var(--v3-pink-tint),var(--v3-card) 60%);}
.v3-brief-name{font-size:20px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:10px;}
.v3-brief-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--v3-pink-press);background:var(--v3-card);border:1px solid var(--v3-pink-soft);padding:3px 9px;border-radius:var(--v3-pill);}
.v3-brief-tag{font-size:13.5px;color:var(--v3-ink-2);line-height:1.5;margin-top:-6px;}
.v3-brief-genes{display:flex;flex-direction:column;gap:9px;}
.v3-brief-gene{display:grid;grid-template-columns:120px 1fr;align-items:center;gap:10px;}
.v3-bg-dim{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--v3-ink-3);}
.v3-chip{display:inline-block;justify-self:start;background:var(--v3-sand);color:var(--v3-ink);font-size:13px;font-weight:750;padding:5px 13px;border-radius:99px;}
.v3-chip.edge{background:var(--v3-pink);color:#fff;}
.v3-brief-ev{font-size:13px;color:var(--v3-ink-2);background:var(--v3-sand);border-radius:var(--v3-r-sm);padding:11px 14px;}
.v3-brief-ev b{color:var(--v3-ink);}
.v3-brief-ex{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--v3-ink-2);line-height:1.45;}
.v3-ex-l{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--v3-ink-3);}
.v3-btn{background:var(--v3-pink);color:#fff;border:none;height:46px;border-radius:var(--v3-pill);font-weight:750;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 10px 24px -10px color-mix(in srgb,var(--v3-pink) 70%,transparent);}
.v3-btn:hover{background:var(--v3-pink-press);} .v3-btn:disabled{opacity:.6;cursor:default;}
.v3-copy-err{font-size:12.5px;color:var(--v3-ink-2);background:var(--v3-sand);border-radius:var(--v3-r-sm);padding:11px 13px;line-height:1.45;}
.v3-copy{border:1px dashed var(--v3-pink-soft);border-radius:var(--v3-r-sm);padding:16px;background:var(--v3-pink-tint);}
.v3-copy-h{font-size:18px;font-weight:800;letter-spacing:-.01em;}
.v3-copy-p{font-size:14px;color:var(--v3-ink);margin-top:8px;line-height:1.5;}
.v3-copy-cta{margin-top:12px;display:inline-block;background:var(--v3-ink);color:var(--v3-paper);font-weight:700;font-size:13px;padding:8px 15px;border-radius:10px;}

.v3-block{padding:30px 0 8px;}
.v3-recgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:20px;}
.v3-rec{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r-sm);box-shadow:var(--v3-shadow);padding:18px;}
.v3-rec-dim{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--v3-ink-3);margin-bottom:10px;}
.v3-rec-pick{display:flex;flex-direction:column;gap:6px;}
.v3-rec-meta{font-size:12px;color:var(--v3-ink-3);font-weight:600;font-variant-numeric:tabular-nums;}
.v3-rec-alts{font-size:12px;color:var(--v3-ink-3);margin-top:10px;text-transform:capitalize;}
.v3-rec-edge{font-size:12px;color:var(--v3-pink-press);margin-top:10px;background:var(--v3-pink-tint);padding:8px 11px;border-radius:10px;line-height:1.4;text-transform:capitalize;}
.v3-foot{border-top:1px solid var(--v3-line);margin-top:40px;padding:28px 0 60px;color:var(--v3-ink-3);font-size:13px;}
.v3-foot b{color:var(--v3-ink);}
`;
