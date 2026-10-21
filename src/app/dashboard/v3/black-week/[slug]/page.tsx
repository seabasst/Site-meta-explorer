import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, ImageOff } from 'lucide-react';
import { formatNumber } from '@/lib/spend-estimator';
import { brandHref } from '../../format';
import { Monogram, Shell } from '../../ui';
import { BW, DailyBars, Method, brandBySlug, bwHref, date, daysBefore, industryOf, lift, pct } from '../shared';

// =============================================================================
// /dashboard/v3/black-week/[slug] — one brand's Black Week 2025 on Meta: timing,
// volume, offer, its biggest Black Week ads, and how it compares to its industry.
// =============================================================================

export const dynamicParams = false;
export const generateStaticParams = () => BW.brands.map((b) => ({ slug: b.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = brandBySlug((await params).slug);
  return { title: b ? `${b.name}, Black Week 2025 | Genome` : 'Black Week 2025 | Genome' };
}

export default async function BlackWeekBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = brandBySlug((await params).slug);
  if (!b) notFound();
  const ind = industryOf(b);
  const peers = ind.brands.filter((s) => s !== b.slug).map((s) => brandBySlug(s)!);
  const { meta } = BW;

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-6">
        <Link href={bwHref()} className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900">
          <ArrowLeft size={15} strokeWidth={1.75} /> Black Week 2025
        </Link>

        <header className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <Monogram name={b.name} pageId={b.livePageId ?? b.pages[0]} size={64} />
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-600">Black Week 2025 · {ind.label}</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] md:text-[44px] md:leading-[1.05]">{b.name}</h1>
            </div>
          </div>
          {b.livePageId && (
            <Link href={brandHref(b.livePageId)} className="inline-flex items-center gap-1 self-start rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-stone-200/80 transition hover:ring-stone-400 md:self-auto">
              Live report today <ArrowUpRight size={14} strokeWidth={1.75} />
            </Link>
          )}
        </header>

        <section className="mt-8 grid grid-cols-2 divide-stone-200/70 rounded-[32px] bg-white ring-1 ring-stone-200/70 md:grid-cols-5 md:divide-x">
          <Kpi label="Ads delivered" value={b.ads.toLocaleString('en-US')} sub={`${date(meta.window[0])} to ${date(meta.window[1])}`} />
          <Kpi label="Black Week ads" value={b.bwAds.toLocaleString('en-US')} sub={`${pct(b.namedShare)} say "Black Week"`} />
          <Kpi label="Lift in new ads/day" value={lift(b.lift)} sub={`${b.baselineRate ?? 0}/day late Oct → ${b.bwRate ?? 0}/day`} />
          <Kpi label="Typical start" value={date(b.medianBwStart)} sub={b.medianBwStart ? `${daysBefore(b.medianBwStart, meta.blackFriday)} days before Black Friday` : 'No campaign found'} />
          <Kpi label="Deepest discount" value={b.maxDiscount == null ? 'n/a' : `${b.maxDiscount}%`} sub={b.medianDiscount == null ? 'None stated as %' : `median ${b.medianDiscount}%`} />
        </section>

        <section className="mt-4 rounded-[32px] bg-white p-6 pt-10 ring-1 ring-stone-200/70 md:p-8 md:pt-12">
          <h2 className="text-lg font-semibold tracking-tight">New ads per day</h2>
          <p className="mb-8 mt-1 text-[13px] text-stone-500">
            {b.firstBw ? <>First Black Week ad {date(b.firstBw)}. Half of them were live by {date(b.medianBwStart)}; the median one ran {b.medianBwDays} days, and {pct(b.afterCyberMonday)} kept running past Cyber Monday.</> : 'No ad in the window named Black Week or carried an offer in the Black Week period.'}
          </p>
          <DailyBars all={b.series.all} bw={b.series.bw} />
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
          <section className="rounded-[32px] bg-white p-6 ring-1 ring-stone-200/70 md:p-7">
            <h2 className="text-lg font-semibold tracking-tight">The offer</h2>
            <p className="mt-1 text-[13px] text-stone-500">Share of new ads with an offer in the copy</p>
            <div className="mt-6 space-y-4">
              <Bar label={`Late October (${date(meta.baseline[0])} to ${date(meta.baseline[1])})`} value={b.promoShareBaseline} tone="bg-stone-400" />
              <Bar label={`Black Week period (${date(meta.bwPeriod[0])} to ${date(meta.bwPeriod[1])})`} value={b.promoShareBw} tone="bg-rose-500" />
            </div>
            <h3 className="mt-8 text-sm font-semibold">In Black Week ads</h3>
            <div className="mt-4 space-y-4">
              <Bar label="State a discount as %" value={b.discountShare} tone="bg-stone-800" />
              <Bar label='"Up to" pricing' value={b.mech.upTo} tone="bg-stone-800" />
              <Bar label="Discount code" value={b.mech.code} tone="bg-stone-800" />
              <Bar label="Early access" value={b.mech.early} tone="bg-stone-800" />
            </div>
          </section>

          <section className="rounded-[32px] bg-white p-6 ring-1 ring-stone-200/70 md:p-7">
            <h2 className="text-lg font-semibold tracking-tight">Against {ind.label.toLowerCase()}</h2>
            <p className="mt-1 text-[13px] text-stone-500">{b.name} vs the industry median of {ind.brands.length} brands</p>
            <table className="mt-6 w-full text-[14px]">
              <thead className="text-[12px] text-stone-500">
                <tr><th className="pb-2 text-left font-medium" /><th className="pb-2 text-right font-medium">{b.name}</th><th className="pb-2 text-right font-medium">Industry</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <Row k="Typical start" a={date(b.medianBwStart)} b={date(ind.medianBwStart)} />
                <Row k="Lift in new ads/day" a={lift(b.lift)} b={lift(ind.medianLift)} />
                <Row k="Deepest discount" a={b.maxDiscount == null ? 'n/a' : `${b.maxDiscount}%`} b={ind.medianMaxDiscount == null ? 'n/a' : `${ind.medianMaxDiscount}%`} />
              </tbody>
            </table>
            {peers.length > 0 && (
              <>
                <h3 className="mt-8 text-sm font-semibold">Same industry</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {peers.map((p) => (
                    <Link key={p.slug} href={bwHref(p.slug)} className="flex items-center gap-2 rounded-full bg-stone-50 py-1 pl-1 pr-3 text-[13px] font-medium ring-1 ring-stone-200/70 transition hover:bg-white hover:ring-stone-400">
                      <Monogram name={p.name} pageId={p.livePageId ?? p.pages[0]} size={24} />{p.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Biggest Black Week ads</h2>
          <p className="mt-1 text-[15px] text-stone-500">Ranked by EU reach.</p>
          {b.topAds.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {b.topAds.map((ad, i) => (
                <a key={ad.adId} href={`https://www.facebook.com/ads/library/?id=${ad.adId}`} target="_blank" rel="noreferrer" className="group flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-stone-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(28,25,23,0.2)]">
                  <div className="relative aspect-square bg-stone-100">
                    {ad.media?.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.media.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    {ad.media?.type === 'video' && <video src={ad.media.url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />}
                    {!ad.media && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400">
                        <ImageOff size={22} strokeWidth={1.5} /><span className="text-[11px]">Preview not available</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">#{i + 1}</span>
                    <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${ad.named ? 'bg-stone-900/85 text-white' : 'bg-white/90 text-stone-700'}`}>
                      {ad.named ? 'Says Black Week' : 'Offer ad'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">{ad.reach != null ? formatNumber(ad.reach) : 'n/a'}</span>
                      <span className="text-xs text-stone-400">EU reach</span>
                    </div>
                    {ad.title && <p className="mt-2 line-clamp-2 text-[15px] font-medium">{ad.title}</p>}
                    {ad.body && <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-stone-500">{ad.body}</p>}
                    <div className="mt-auto flex items-center justify-between pt-4 text-xs text-stone-400">
                      <span>{date(ad.start)} to {ad.stop ? date(ad.stop) : 'still running'}</span>
                      <ArrowUpRight size={15} strokeWidth={1.75} className="transition group-hover:text-stone-900" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : <p className="mt-6 text-sm text-stone-500">No Black Week ads found for {b.name}.</p>}
        </section>

        <Method />
      </main>
    </Shell>
  );
}

const Kpi = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="p-5 md:p-6">
    <div className="text-[12px] text-stone-500">{label}</div>
    <div className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">{value}</div>
    <div className="mt-1 text-[11px] leading-snug text-stone-400">{sub}</div>
  </div>
);

const Bar = ({ label, value, tone }: { label: string; value: number | null; tone: string }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-stone-600">{label}</span>
      <b className="font-medium tabular-nums">{pct(value)}</b>
    </div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${(value ?? 0) * 100}%` }} />
    </div>
  </div>
);

const Row = ({ k, a, b }: { k: string; a: string; b: string }) => (
  <tr><td className="py-2.5 text-stone-600">{k}</td><td className="py-2.5 text-right font-medium tabular-nums">{a}</td><td className="py-2.5 text-right tabular-nums text-stone-500">{b}</td></tr>
);
