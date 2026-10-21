import raw from '@/data/black-week-2025.json';
import { shortDate } from '../format';

// Data and charts shared by the Black Week overview and the brand deep dives.
// The dataset is built by scripts/black-week-2025.ts (method in its header).

export type Brand = {
  slug: string; name: string; industry: string; pages: string[]; livePageId: string | null;
  ads: number; bwAds: number; namedAds: number; namedShare: number | null;
  promoShareBaseline: number | null; promoShareBw: number | null;
  baselineRate: number | null; bwRate: number | null; lift: number | null;
  firstBw: string | null; medianBwStart: string | null;
  maxDiscount: number | null; medianDiscount: number | null; discountShare: number | null;
  mech: { upTo: number | null; freeShip: number | null; code: number | null; early: number | null };
  medianBwDays: number | null; afterCyberMonday: number | null; bwReach: number;
  series: { all: number[]; bw: number[] };
  topAds: { adId: string; reach: number | null; named: boolean; title: string | null; body: string | null; start: string; stop: string | null; media: { url: string; type: 'image' | 'video' } | null }[];
};
export type Industry = {
  key: string; label: string; brands: string[]; ads: number; bwAds: number;
  medianLift: number | null; medianBwStart: string | null; medianMaxDiscount: number | null; bwShape: number[];
};

export const BW = raw as unknown as {
  meta: {
    window: [string, string]; markets: string[]; baseline: [string, string]; bwPeriod: [string, string];
    blackFriday: string; cyberMonday: string; pulledAt: string; days: string[];
    totals: { brands: number; ads: number; bwAds: number };
  };
  industries: Industry[];
  brands: Brand[];
};

export const brandBySlug = (slug: string) => BW.brands.find((b) => b.slug === slug);
export const industryOf = (b: Brand) => BW.industries.find((i) => i.key === b.industry)!;
export const bwHref = (slug?: string) => `/dashboard/v3/black-week${slug ? `/${slug}` : ''}`;
export const pct = (x: number | null) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
export const lift = (x: number | null) => (x == null ? 'n/a' : `${x.toLocaleString('en-US')}×`);
export const date = (d: string | null) => (d ? shortDate(d) : 'n/a');
export const daysBefore = (d: string, ref: string) => Math.round((Date.parse(ref) - Date.parse(d)) / 864e5);

const { days, bwPeriod, blackFriday, cyberMonday } = BW.meta;
const idx = (d: string) => days.indexOf(d);

// New ads per day, Black Week ads on top. Shaded band = the Black Week period.
export function DailyBars({ all, bw, height = 180 }: { all: number[]; bw: number[]; height?: number }) {
  const max = Math.max(1, ...all);
  const [p0, p1] = [idx(bwPeriod[0]), idx(bwPeriod[1])];
  // Three days apart, so the labels sit on opposite sides of their lines.
  const markers = [[idx(blackFriday), 'Black Friday', 'right-1.5'], [idx(cyberMonday), 'Cyber Monday', 'left-1.5']] as const;
  const months = days.map((d, i) => [d, i] as const).filter(([d]) => d.endsWith('-01'));
  return (
    <div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-y-0 rounded-lg bg-rose-50" style={{ left: `${(p0 / days.length) * 100}%`, width: `${((p1 - p0 + 1) / days.length) * 100}%` }} />
        {markers.map(([i, label, side]) => (
          <div key={label} className="absolute inset-y-0 border-l border-dashed border-stone-400" style={{ left: `${((i + 0.5) / days.length) * 100}%` }}>
            <span className={`absolute -top-5 ${side} whitespace-nowrap text-[10px] font-medium text-stone-500`}>{label}</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-px">
          {all.map((n, i) => (
            <div key={days[i]} title={`${shortDate(days[i])}: ${n} new ads, ${bw[i]} Black Week`} className="flex flex-1 flex-col justify-end">
              <div className="w-full rounded-t-[2px] bg-rose-500" style={{ height: `${(bw[i] / max) * height}px` }} />
              <div className="w-full bg-stone-300" style={{ height: `${((n - bw[i]) / max) * height}px` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-stone-400">
        {months.map(([d, i]) => <span key={d} className="absolute" style={{ left: `${(i / days.length) * 100}%` }}>{shortDate(d)}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-stone-500">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />Black Week ads</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-stone-300" />Other new ads</span>
        <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-sm bg-rose-50 ring-1 ring-rose-100" />Black Week period, {shortDate(bwPeriod[0])} to {shortDate(bwPeriod[1])}</span>
      </div>
    </div>
  );
}

// Shape of an industry's Black Week launches (peak = top), Black Friday marked.
export function Shape({ values }: { values: number[] }) {
  const w = 220, h = 44, step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - v * (h - 2)).toFixed(1)}`).join(' ');
  const bf = idx(blackFriday) * step;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden>
      <line x1={bf} x2={bf} y1={0} y2={h} stroke="#a8a29e" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="#fff1f2" />
      <polyline points={pts} fill="none" stroke="#e11d48" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Method() {
  return (
    <section className="mt-14 max-w-3xl text-[13px] leading-relaxed text-stone-500">
      <h2 className="text-sm font-semibold text-stone-700">Method and limits</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>Source: Meta Ad Library API (ads_archive, all statuses). Every ad the brands&apos; pages delivered in {BW.meta.markets.join(', ')} between {date(BW.meta.window[0])} and {date(BW.meta.window[1])} 2025, pulled {date(BW.meta.pulledAt)} 2026. Ads that left the Library before then (about a year after they last ran) are missing.</li>
        <li>Black Week ads: copy that names Black Week, Black Friday or Cyber Monday (six languages), plus ads with an offer (discount, sale wording) that started in the Black Week period, {date(BW.meta.bwPeriod[0])} to {date(BW.meta.bwPeriod[1])}. Catalogue ads with product-only copy read as neither.</li>
        <li>Lift compares new ads per day, not budget. The Library has no spend, daily impressions or results for commercial ads, so nothing here says what was profitable.</li>
        <li>Discounts count only percentages in discount context (&ldquo;-30%&rdquo;, &ldquo;30% off&rdquo;, &ldquo;up to 50%&rdquo;). Reach is Meta&apos;s EU reach estimate.</li>
        <li>Retailers are measured on their Swedish pages. Outside the EU and UK the API returns no commercial ads, so US programmes (Gymshark, AG1, Hismile, Oura) aren&apos;t here.</li>
      </ul>
    </section>
  );
}
