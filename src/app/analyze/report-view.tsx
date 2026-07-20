'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe2, Layers } from 'lucide-react';
import {
  formatNumber,
  SectionHeading,
  StatPill,
  EmptyState,
  AdTile,
  CopyCard,
  CreatorRow,
} from './components';
import type { BrandReport, CategoryReport } from './types';

type Target = { type: 'brand'; id: string } | { type: 'category'; id: string };

function ReportSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-24 rounded-2xl bg-slate-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-200/60 dark:bg-white/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-200/60 dark:bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

function BrandBenchmark({ report }: { report: BrandReport }) {
  const bench = report.categoryBenchmark;
  if (!bench) {
    return (
      <EmptyState message="This brand hasn't been through creative analysis yet, so there's no category benchmark score to show." />
    );
  }
  const peer = bench.categoryPeerAverage;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
          This brand
        </p>
        <p className="mt-1 text-3xl font-black text-[#1235e2] tabular-nums">{bench.andromedaScore}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Andromeda score · {bench.totalAdsAnalyzed} ads analyzed
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
          Category average
        </p>
        <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white tabular-nums">
          {peer !== null ? peer : '—'}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {peer !== null ? 'Peer brands with analysis in this category' : 'Not enough analyzed peers yet'}
        </p>
      </div>
    </div>
  );
}

function BrandReportBody({ report }: { report: BrandReport }) {
  const { brand } = report;
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-bold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
          {brand.profilePicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.profilePicUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            brand.pageName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {brand.pageName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            {brand.category && (
              <span className="rounded-full bg-[#1235e2]/10 px-2.5 py-1 font-semibold text-[#1235e2]">
                {brand.category}
              </span>
            )}
            {brand.country && (
              <span className="flex items-center gap-1">
                <Globe2 className="h-3.5 w-3.5" /> {brand.country}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Active ads" value={formatNumber(report.stats.activeAds)} />
        <StatPill label="Total ads seen" value={formatNumber(report.stats.totalAds)} />
        <StatPill label="Estimated total reach" value={formatNumber(report.stats.estimatedTotalReach)} />
        <StatPill
          label="Formats"
          value={report.stats.formatBreakdown.map((f) => f.format ?? 'unknown').join(' / ') || '—'}
        />
      </div>

      <section>
        <SectionHeading title="Top performing ads" hint="Ranked by estimated reach + days running" />
        {report.topAds.length === 0 ? (
          <EmptyState message="No ads with reach data yet for this brand." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {report.topAds.map((ad) => (
              <AdTile key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Best copy" hint="Deduplicated, ranked the same way" />
        {report.bestCopy.length === 0 ? (
          <EmptyState message="No standalone ad copy found for this brand yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {report.bestCopy.map((entry) => (
              <CopyCard key={entry.adId} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Creator partnerships" hint="Confirmed via rendered 'with' labels" />
        {report.creatorPartnerships.length === 0 ? (
          <EmptyState message="No creator/influencer partnerships have been found for this brand yet." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {report.creatorPartnerships.map((item) => (
              <CreatorRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Category benchmark" />
        <BrandBenchmark report={report} />
      </section>
    </div>
  );
}

function CategoryReportBody({ report }: { report: CategoryReport }) {
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1235e2]/10 text-[#1235e2]">
          <Layers className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {report.category.label}
          </h1>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {report.stats.totalBrands} brands tracked in this category
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Brands tracked" value={formatNumber(report.stats.totalBrands)} />
        <StatPill label="Active ads" value={formatNumber(report.stats.totalActiveAds)} />
        <StatPill label="Estimated total reach" value={formatNumber(report.stats.estimatedTotalReach)} />
        <StatPill
          label="Avg. Andromeda score"
          value={report.stats.avgAndromedaScore !== null ? String(report.stats.avgAndromedaScore) : '—'}
        />
      </div>

      <section>
        <SectionHeading
          title="Brands in this category"
          hint={
            report.stats.totalBrands > report.brands.length
              ? `Top ${report.brands.length} of ${report.stats.totalBrands}, by active ad volume`
              : 'Ranked by active ad volume'
          }
        />
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="px-4 py-3 font-semibold text-right">Active ads</th>
                <th className="px-4 py-3 font-semibold text-right">Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {report.brands.map((b) => (
                <tr key={b.pageId} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/analyze?brand=${b.pageId}`}
                      className="font-semibold text-slate-900 hover:text-[#1235e2] dark:text-white"
                    >
                      {b.pageName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500">{b.country ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(b.activeAdCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(b.estimatedReach)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading title="Top performing ads" hint="Across every brand in this category" />
        {report.topAds.length === 0 ? (
          <EmptyState message="No ads with reach data yet for this category." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {report.topAds.map((ad) => (
              <AdTile key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Best copy" hint="Deduplicated across the category" />
        {report.bestCopy.length === 0 ? (
          <EmptyState message="No standalone ad copy found for this category yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {report.bestCopy.map((entry) => (
              <CopyCard key={entry.adId} entry={entry} showBrand />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Creator partnerships" hint="Confirmed via rendered 'with' labels" />
        {report.creatorPartnerships.length === 0 ? (
          <EmptyState message="No creator/influencer partnerships have been found in this category yet." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {report.creatorPartnerships.map((item) => (
              <CreatorRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ReportView({ target }: { target: Target }) {
  const [data, setData] = useState<BrandReport | CategoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);

      const url =
        target.type === 'brand'
          ? `/api/discover/brand?pageId=${encodeURIComponent(target.id)}`
          : `/api/discover/category?slug=${encodeURIComponent(target.id)}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to load analysis');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [target.type, target.id]);

  if (loading) return <ReportSkeleton />;
  if (error) return <EmptyState message={error} />;
  if (!data) return null;

  return target.type === 'brand' ? (
    <BrandReportBody report={data as BrandReport} />
  ) : (
    <CategoryReportBody report={data as CategoryReport} />
  );
}
