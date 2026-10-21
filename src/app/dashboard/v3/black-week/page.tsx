import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Ghost, Monogram, Shell } from '../ui';
import { BW, Brand, DailyBars, Method, Shape, bwHref, date, daysBefore, lift, pct } from './shared';

// =============================================================================
// /dashboard/v3/black-week — Black Week 2025 on Meta, per industry, with a deep
// dive per brand. Static: everything comes from src/data/black-week-2025.json.
// =============================================================================

export const metadata = { title: 'Black Week 2025 on Meta | Genome' };

const { meta, industries, brands } = BW;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const sum = (f: (b: Brand) => number[]) => meta.days.map((_, i) => brands.reduce((s, b) => s + f(b)[i], 0));

export default function BlackWeekPage() {
  const withCampaign = brands.filter((b) => b.bwAds > 0);
  const typicalStart = [...withCampaign.map((b) => b.medianBwStart!)].sort()[withCampaign.length >> 1];
  const ownName = withCampaign.filter((b) => (b.namedShare ?? 0) < 0.5);
  const lifts = brands.filter((b) => b.lift != null);
  const topLift = [...lifts].sort((a, b) => b.lift! - a.lift!)[0];
  const fewer = lifts.filter((b) => b.lift! < 1);
  const deepest = [...brands].filter((b) => b.maxDiscount != null).sort((a, b) => b.maxDiscount! - a.maxDiscount!);
  const medDeepest = median(deepest.map((b) => b.maxDiscount!));
  const firstMover = [...withCampaign].sort((a, b) => a.medianBwStart!.localeCompare(b.medianBwStart!))[0];

  const findings = [
    `The typical brand had its median Black Week ad live on ${date(typicalStart)}, ${daysBefore(typicalStart, meta.blackFriday)} days before Black Friday. ${firstMover.name} was earliest (${date(firstMover.medianBwStart)}).`,
    `${ownName.length} of ${withCampaign.length} brands with a campaign mostly didn't say "Black Week": ${ownName.map((b) => b.name).join(', ')} ran offers under their own name or kept their standing offer.`,
    `Biggest step-up in new ads per day: ${topLift.name}, at ${lift(topLift.lift)} its late-October pace. ${fewer.length} brands launched fewer new ads per day during Black Week than before it.`,
    `Deepest discount in Black Week copy: ${deepest[0].maxDiscount}% (${deepest.filter((b) => b.maxDiscount === deepest[0].maxDiscount).map((b) => b.name).join(', ')}). Across brands that stated one, the median deepest was ${medDeepest}%.`,
  ];

  return (
    <Shell>
      <section className="bg-stone-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.4fr_1fr] md:px-6 md:pb-20">
          <div>
            <Link href="/dashboard/v3" className="inline-flex items-center gap-1.5 text-sm text-stone-400 transition hover:text-white">
              <ArrowLeft size={15} strokeWidth={1.75} /> Genome
            </Link>
            <div className="mt-10 text-xs font-medium uppercase tracking-[0.14em] text-rose-400">Black Week 2025 · Meta ads</div>
            <h1 className="mt-4 text-balance text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[60px]">Who went early, who went deep.</h1>
            <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-stone-400 md:text-base">
              {meta.totals.brands} brands across {industries.length} industries. Every ad they delivered in {meta.markets.join(', ')} between {date(meta.window[0])} and {date(meta.window[1])} 2025, read ad by ad.
            </p>
          </div>
          <div className="flex items-end justify-center md:justify-end">
            <Ghost eyes="#0c0a09" className="h-40 w-36 text-white/90 animate-[ghost-float_4s_ease-in-out_infinite] motion-reduce:animate-none md:h-56 md:w-48" />
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-2 border-t border-white/10 px-4 md:grid-cols-4 md:px-6">
          <Stat label="Ads analysed" value={meta.totals.ads.toLocaleString('en-US')} />
          <Stat label="Black Week ads" value={meta.totals.bwAds.toLocaleString('en-US')} />
          <Stat label="Typical campaign start" value={date(typicalStart)} />
          <Stat label="Deepest discount" value={`${deepest[0].maxDiscount}%`} />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <section className="mt-12 grid gap-4 md:grid-cols-2">
          {findings.map((f, i) => (
            <div key={i} className="flex gap-4 rounded-[28px] bg-white p-6 ring-1 ring-stone-200/70">
              <span className="text-sm font-semibold tabular-nums text-rose-600">0{i + 1}</span>
              <p className="text-[15px] leading-relaxed text-stone-700">{f}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[32px] bg-white p-6 pt-10 ring-1 ring-stone-200/70 md:p-8 md:pt-12">
          <h2 className="text-lg font-semibold tracking-tight">New ads per day, all {meta.totals.brands} brands</h2>
          <p className="mb-8 mt-1 text-[13px] text-stone-500">Ads by start date. Black Week ads name it or carry an offer and started in the Black Week period.</p>
          <DailyBars all={sum((b) => b.series.all)} bw={sum((b) => b.series.bw)} height={200} />
        </section>

        <section className="mt-14">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-600">By industry</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">How each category played it</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {industries.map((ind) => {
              const bs = ind.brands.map((s) => brands.find((b) => b.slug === s)!);
              return (
                <div key={ind.key} className="rounded-[32px] bg-white p-6 ring-1 ring-stone-200/70 md:p-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight">{ind.label}</h3>
                    <span className="text-xs text-stone-400">{ind.ads.toLocaleString('en-US')} ads</span>
                  </div>
                  <div className="mt-4"><Shape values={ind.bwShape} /></div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <Mini k="Typical start" v={date(ind.medianBwStart)} />
                    <Mini k="Median lift" v={lift(ind.medianLift)} />
                    <Mini k="Median deepest" v={ind.medianMaxDiscount == null ? 'n/a' : `${ind.medianMaxDiscount}%`} />
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {bs.map((b) => (
                      <Link key={b.slug} href={bwHref(b.slug)} className="flex items-center gap-2 rounded-full bg-stone-50 py-1 pl-1 pr-3 text-[13px] font-medium ring-1 ring-stone-200/70 transition hover:bg-white hover:ring-stone-400">
                        <Monogram name={b.name} pageId={b.livePageId ?? b.pages[0]} size={24} />
                        {b.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">All brands</h2>
          <p className="mt-1 text-[15px] text-stone-500">Lift = new ads per day in the Black Week period ÷ late October ({date(meta.baseline[0])} to {date(meta.baseline[1])}).</p>
          <div className="mt-6 overflow-x-auto rounded-[28px] bg-white ring-1 ring-stone-200/70">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="text-[12px] text-stone-500">
                <tr className="border-b border-stone-200/70">
                  <th className="px-5 py-3 font-medium">Brand</th><th className="py-3 font-medium">Industry</th>
                  <th className="py-3 text-right font-medium">Ads</th><th className="py-3 text-right font-medium">Black Week ads</th>
                  <th className="py-3 text-right font-medium">Say &ldquo;Black Week&rdquo;</th><th className="py-3 text-right font-medium">Lift</th>
                  <th className="py-3 text-right font-medium">Typical start</th><th className="px-5 py-3 text-right font-medium">Deepest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {brands.map((b) => (
                  <tr key={b.slug} className="transition hover:bg-stone-50">
                    <td className="px-5 py-2.5"><Link href={bwHref(b.slug)} className="flex items-center gap-2.5 font-medium"><Monogram name={b.name} pageId={b.livePageId ?? b.pages[0]} size={26} />{b.name}</Link></td>
                    <td className="py-2.5 text-stone-500">{industries.find((i) => i.key === b.industry)!.label}</td>
                    <td className="py-2.5 text-right tabular-nums">{b.ads.toLocaleString('en-US')}</td>
                    <td className="py-2.5 text-right tabular-nums">{b.bwAds.toLocaleString('en-US')}</td>
                    <td className="py-2.5 text-right tabular-nums">{pct(b.namedShare)}</td>
                    <td className="py-2.5 text-right tabular-nums">{lift(b.lift)}</td>
                    <td className="py-2.5 text-right tabular-nums">{date(b.medianBwStart)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{b.maxDiscount == null ? 'n/a' : `${b.maxDiscount}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Method />
      </main>
    </Shell>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="py-6 pr-4">
    <div className="text-[12px] text-stone-400">{label}</div>
    <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">{value}</div>
  </div>
);

const Mini = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-2xl bg-stone-50 px-2 py-3">
    <dd className="text-[15px] font-semibold tabular-nums">{v}</dd>
    <dt className="mt-0.5 text-[11px] text-stone-500">{k}</dt>
  </div>
);
