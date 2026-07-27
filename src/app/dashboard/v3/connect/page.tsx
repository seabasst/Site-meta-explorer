'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// =============================================================================
// /dashboard/v3/connect — "Decode my account" (agency model).
// Lists the ad accounts the app's system token manages (auth-gated) → pick one
// → decode: real performance + creative genome + gap vs the ad library.
// =============================================================================

const pretty = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const money = (n: number | null, cur: string) => (n == null ? '—' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} ${cur}`);
const compact = (n: number | null) => (n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${n}`);

type Account = { id: string; name: string; status: string; active: boolean; currency: string; lifetimeSpend: number; business: string | null };
type Decode = {
  account: { id: string; name: string };
  performance: { windowDays: number; currency: string; spend: number | null; impressions: number | null; reach: number | null; clicks: number | null; ctr: number | null; cpc: number | null; frequency: number | null; roas: number | null; purchases: number | null; topAds: { name: string; spend: number | null; roas: number | null; ctr: number | null; reach: number | null }[] };
  creativeGenome: { classifiedAds: number; top: Record<string, string>; mix: Record<string, { gene: string; count: number }[]> } | null;
  creativeNote: string | null;
  benchmark: Record<string, { best: string; medianDays: number }>;
  verdict: { tone: 'good' | 'warn' | 'note'; text: string }[];
};

export default function ConnectPage() {
  const [state, setState] = useState<'loading' | 'signin' | 'forbidden' | 'error' | 'ready'>('loading');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [decode, setDecode] = useState<Decode | null>(null);
  const [decoding, setDecoding] = useState(false);

  useEffect(() => {
    fetch('/api/connect/meta/accounts').then(async (r) => {
      if (r.status === 401) { setState('signin'); return; }
      if (r.status === 403) { setState('forbidden'); return; }
      if (!r.ok) { setError((await r.json()).error || 'Failed'); setState('error'); return; }
      const d = await r.json(); setAccounts(d.accounts ?? []); setState('ready');
    }).catch(() => { setError('Network error'); setState('error'); });
  }, []);

  const runDecode = useCallback(async (acc: Account) => {
    setSelected(acc); setDecode(null); setDecoding(true); setError(null);
    try {
      const r = await fetch(`/api/connect/meta/decode?accountId=${encodeURIComponent(acc.id)}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Decode failed');
      setDecode(await r.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Decode failed'); }
    finally { setDecoding(false); }
  }, []);

  return (
    <div className="v3root">
      <style>{CSS}</style>
      <header className="v3-top"><div className="v3-wrap v3-top-in">
        <div className="v3-brand"><span className="v3-dot">🧬</span>Genome <small>· decode my account</small></div>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/v3" className="v3-ghost">← Dashboard</Link>
      </div></header>

      <main className="v3-wrap">
        <section className="v3-hero">
          <div className="v3-kicker">Decode my account</div>
          <h1 className="v3-h1">Point the genome at <em>your own</em> ads.</h1>
          <p className="v3-lead">Pick a connected ad account. Genome pulls its real performance (spend, ROAS, CTR, reach), decodes its creative DNA, and shows the gap between what you run and what wins in the library.</p>
        </section>

        {state === 'loading' && <div className="v3-loading">Connecting to Meta…</div>}

        {state === 'signin' && (
          <div className="v3-card v3-signin">
            <div className="v3-signin-h">Sign in to connect your accounts</div>
            <p>Your Facebook ad accounts are private — sign in to list and decode them.</p>
            <a className="v3-btn" href="/auth/signin?callbackUrl=/dashboard/v3/connect">Sign in</a>
          </div>
        )}

        {state === 'forbidden' && (
          <div className="v3-card v3-signin">
            <div className="v3-signin-h">Not authorized</div>
            <p>This feature is limited to your team&apos;s admins. Ask an admin to add your email to the allowlist.</p>
            <Link className="v3-btn" href="/dashboard/v3">Back to dashboard</Link>
          </div>
        )}

        {state === 'error' && <div className="v3-err">{error}</div>}

        {state === 'ready' && (
          <section className="v3-block">
            <div className="v3-kicker">Your accounts</div>
            <h2 className="v3-h2">Choose an account to decode</h2>
            <div className="v3-acc-grid">
              {accounts.map((a) => (
                <button key={a.id} className={`v3-acc ${selected?.id === a.id ? 'on' : ''} ${a.active ? '' : 'dim'}`} onClick={() => runDecode(a)}>
                  <div className="v3-acc-top"><span className="v3-acc-name">{a.name}</span><span className={`v3-acc-st ${a.active ? 'live' : ''}`}>{a.status}</span></div>
                  {a.business && <div className="v3-acc-biz">{a.business}</div>}
                  <div className="v3-acc-spend">{money(a.lifetimeSpend, a.currency)} <span>lifetime</span></div>
                </button>
              ))}
            </div>
          </section>
        )}

        {decoding && <div className="v3-loading">Decoding {selected?.name}… pulling insights &amp; classifying creatives</div>}
        {error && state === 'ready' && !decoding && <div className="v3-err">{error}</div>}
        {decode && !decoding && <DecodeView d={decode} />}
      </main>
    </div>
  );
}

function DecodeView({ d }: { d: Decode }) {
  const p = d.performance;
  return (
    <section className="v3-block">
      <div className="v3-decode-head">
        <h2 className="v3-h2">{d.account.name} — decoded</h2>
        <span className="v3-decode-sub">last {p.windowDays} days</span>
      </div>

      <section className="v3-verdict">
        {d.verdict.length === 0 && <div className="v3-vrow v3-v-note"><span className="v3-vdot" />Not enough recent data for a verdict — try an account with active spend.</div>}
        {d.verdict.map((v, i) => <div className={`v3-vrow v3-v-${v.tone}`} key={i}><span className="v3-vdot" />{v.text}</div>)}
      </section>

      <div className="v3-tiles">
        <Tile n={p.roas != null ? `${p.roas.toFixed(2)}×` : '—'} l="ROAS" tone={p.roas == null ? '' : p.roas >= 2 ? 'good' : p.roas < 1 ? 'warn' : ''} />
        <Tile n={money(p.spend, p.currency)} l="spend" />
        <Tile n={p.ctr != null ? `${p.ctr.toFixed(2)}%` : '—'} l="CTR" tone={p.ctr != null && p.ctr < 1 ? 'warn' : ''} />
        <Tile n={compact(p.reach)} l="reach" />
        <Tile n={p.frequency != null ? p.frequency.toFixed(1) : '—'} l="frequency" tone={p.frequency != null && p.frequency >= 3 ? 'warn' : ''} />
        <Tile n={p.purchases != null ? compact(p.purchases) : '—'} l="purchases" />
      </div>

      <div className="v3-cols">
        <div className="v3-card">
          <h3 className="v3-h3">Top ads by spend</h3>
          <div className="v3-desc">Where the budget went, last {p.windowDays} days</div>
          <div className="v3-topads">
            {p.topAds.length === 0 && <div className="v3-desc" style={{ padding: '14px 0' }}>No ad-level spend in this window.</div>}
            {p.topAds.map((a, i) => (
              <div className="v3-topad" key={i}>
                <span className="v3-topad-n">{a.name}</span>
                <span className="v3-topad-m">{money(a.spend, p.currency)} · {a.roas != null ? `${a.roas.toFixed(2)}× ` : ''}{a.ctr != null ? `${a.ctr.toFixed(2)}% CTR` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="v3-card">
          <h3 className="v3-h3">Your creative genome vs the library</h3>
          {!d.creativeGenome && <div className="v3-desc" style={{ marginTop: 10 }}>{d.creativeNote ?? 'No creative classification available.'}</div>}
          {d.creativeGenome && (
            <div className="v3-gap">
              {['hookTactic', 'messagingAngle', 'creativeMechanic', 'visualFormat'].filter((dim) => d.creativeGenome!.top[dim] || d.benchmark[dim]).map((dim) => {
                const yours = d.creativeGenome!.top[dim];
                const best = d.benchmark[dim];
                const match = yours && best && yours === best.best;
                return (
                  <div className="v3-gap-row" key={dim}>
                    <span className="v3-gap-dim">{pretty(dim.replace(/([A-Z])/g, ' $1'))}</span>
                    <span className="v3-gap-you">{yours ? pretty(yours) : '—'}</span>
                    <span className="v3-gap-arrow">{match ? '✓' : '→'}</span>
                    <span className={`v3-gap-best ${match ? 'match' : ''}`}>{best ? pretty(best.best) : '—'}{best && !match ? ` (${best.medianDays}d)` : ''}</span>
                  </div>
                );
              })}
              <div className="v3-gap-legend">Your top choice → the library's best-performing choice. ✓ = you're already on the winner.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Tile({ n, l, tone = '' }: { n: string; l: string; tone?: string }) {
  return <div className={`v3-tile ${tone}`}><div className="v3-tile-n">{n}</div><div className="v3-tile-l">{l}</div></div>;
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
.v3-loading{padding:60px 0;text-align:center;color:var(--v3-ink-3);font-size:15px;font-weight:600;}
.v3-err{background:var(--v3-pink-tint);color:var(--v3-pink-press);border-radius:var(--v3-r-sm);padding:14px 16px;font-weight:600;margin-top:16px;}

.v3-hero{padding:44px 0 8px;}
.v3-kicker{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--v3-pink);}
.v3-h1{font-size:clamp(32px,5vw,54px);font-weight:800;letter-spacing:-.035em;line-height:1.02;margin:12px 0 0;max-width:16ch;}
.v3-h1 em{font-style:normal;color:var(--v3-pink);}
.v3-h2{font-size:clamp(22px,3vw,30px);font-weight:800;letter-spacing:-.03em;margin:0;}
.v3-lead{color:var(--v3-ink-2);font-size:16px;max-width:64ch;margin:16px 0 0;}
.v3-card{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r);box-shadow:var(--v3-shadow);padding:24px;}
.v3-h3{font-size:16.5px;font-weight:750;margin:0;}
.v3-desc{color:var(--v3-ink-3);font-size:13px;margin-top:5px;}

.v3-signin{margin-top:26px;text-align:center;max-width:440px;}
.v3-signin-h{font-size:20px;font-weight:800;letter-spacing:-.02em;}
.v3-signin p{color:var(--v3-ink-2);font-size:14px;margin:10px 0 18px;}
.v3-btn{display:inline-block;background:var(--v3-pink);color:#fff;border:none;padding:12px 24px;border-radius:var(--v3-pill);font-weight:750;font-size:14.5px;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:0 10px 24px -10px color-mix(in srgb,var(--v3-pink) 70%,transparent);}
.v3-btn:hover{background:var(--v3-pink-press);}

.v3-block{padding:30px 0 8px;}
.v3-acc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-top:20px;}
.v3-acc{text-align:left;background:var(--v3-card);border:1.5px solid var(--v3-line-2);border-radius:var(--v3-r-sm);box-shadow:var(--v3-shadow);padding:18px;cursor:pointer;font-family:inherit;transition:transform .13s,border-color .13s;display:flex;flex-direction:column;gap:8px;}
.v3-acc:hover{transform:translateY(-2px);border-color:var(--v3-pink);}
.v3-acc.on{border-color:var(--v3-pink);background:var(--v3-pink-tint);}
.v3-acc.dim{opacity:.6;}
.v3-acc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.v3-acc-name{font-weight:750;font-size:15px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.v3-acc-st{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--v3-ink-3);background:var(--v3-sand);padding:3px 8px;border-radius:99px;white-space:nowrap;}
.v3-acc-st.live{color:var(--v3-green);background:#E5F5EC;}
.v3-acc-biz{font-size:11.5px;color:var(--v3-ink-3);font-weight:600;}
.v3-acc-spend{font-size:14px;font-weight:750;font-variant-numeric:tabular-nums;}
.v3-acc-spend span{font-size:11px;color:var(--v3-ink-3);font-weight:600;}

.v3-decode-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;}
.v3-decode-sub{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--v3-ink-3);}
.v3-verdict{display:flex;flex-direction:column;gap:8px;margin:18px 0;}
.v3-vrow{display:flex;align-items:flex-start;gap:11px;background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r-sm);padding:14px 16px;font-size:14px;line-height:1.5;font-weight:500;box-shadow:var(--v3-shadow);}
.v3-vdot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex:0 0 auto;}
.v3-v-good .v3-vdot{background:var(--v3-green);} .v3-v-warn .v3-vdot{background:var(--v3-amber);} .v3-v-note .v3-vdot{background:var(--v3-ink-3);}
.v3-tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:8px 0 4px;}
@media (max-width:820px){.v3-tiles{grid-template-columns:repeat(3,1fr);}}
@media (max-width:520px){.v3-tiles{grid-template-columns:repeat(2,1fr);}}
.v3-tile{background:var(--v3-card);border:1px solid var(--v3-line);border-radius:var(--v3-r-sm);padding:16px;box-shadow:var(--v3-shadow);}
.v3-tile.good{border-color:var(--v3-teal-soft);} .v3-tile.warn{border-color:#F3DFC0;}
.v3-tile-n{font-size:23px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.v3-tile.good .v3-tile-n{color:var(--v3-green);} .v3-tile.warn .v3-tile-n{color:var(--v3-amber);}
.v3-tile-l{font-size:11.5px;color:var(--v3-ink-3);font-weight:650;margin-top:3px;text-transform:capitalize;}

.v3-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;}
@media (max-width:820px){.v3-cols{grid-template-columns:1fr;}}
.v3-topads{margin-top:12px;display:flex;flex-direction:column;}
.v3-topad{display:flex;flex-direction:column;gap:2px;padding:11px 0;border-top:1px solid var(--v3-line);}
.v3-topad:first-child{border-top:none;}
.v3-topad-n{font-weight:650;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.v3-topad-m{font-size:12px;color:var(--v3-ink-3);font-weight:600;font-variant-numeric:tabular-nums;}
.v3-gap{margin-top:14px;display:flex;flex-direction:column;gap:9px;}
.v3-gap-row{display:grid;grid-template-columns:110px 1fr 22px 1fr;align-items:center;gap:8px;font-size:13px;}
.v3-gap-dim{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--v3-ink-3);}
.v3-gap-you{font-weight:700;text-transform:capitalize;}
.v3-gap-arrow{text-align:center;color:var(--v3-ink-3);font-weight:800;}
.v3-gap-best{font-weight:700;color:var(--v3-pink-press);text-transform:capitalize;}
.v3-gap-best.match{color:var(--v3-green);}
.v3-gap-legend{font-size:11.5px;color:var(--v3-ink-3);margin-top:8px;line-height:1.4;}
`;
