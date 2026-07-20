'use client';

import Link from 'next/link';
import { Play, Layers, ImageIcon, ExternalLink, Inbox } from 'lucide-react';
import type { RankedAdView, BestCopyEntry, CreatorPartnershipView } from './types';

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return '—';
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      {hint && <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{value}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Inbox className="h-6 w-6 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </Card>
  );
}

function FormatIcon({ format }: { format: string | null }) {
  const cls = 'h-3 w-3';
  if (format === 'video') return <Play className={cls} />;
  if (format === 'carousel') return <Layers className={cls} />;
  return <ImageIcon className={cls} />;
}

function primaryAsset(assets: RankedAdView['assets']) {
  return (
    assets.find((a) => a.downloadStatus === 'completed' && a.storedUrl && a.position === 0) ??
    assets.find((a) => a.downloadStatus === 'completed' && a.storedUrl)
  );
}

export function AdTile({ ad }: { ad: RankedAdView }) {
  const asset = primaryAsset(ad.assets);
  const snapshotUrl = ad.snapshotUrl ?? `https://www.facebook.com/ads/library/?id=${ad.adId}`;

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[0_12px_30px_-15px_rgba(18,53,226,0.25)]">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100 dark:bg-white/[0.04]">
        {asset?.assetType === 'video' && asset.storedUrl ? (
          <video
            src={asset.storedUrl}
            poster={asset.thumbnailUrl || undefined}
            className="h-full w-full object-cover"
            controls
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : asset?.storedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailUrl || asset.storedUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          <FormatIcon format={ad.displayFormat} />
          {ad.isActive ? `${ad.longevityDays}d running` : ad.longevityDays > 0 ? `ran ${ad.longevityDays}d` : 'ended'}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {ad.body && (
          <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{ad.body}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-[#1235e2] tabular-nums">
            ~{formatNumber(ad.reachEstimate)} reach
          </span>
          <Link
            href={snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1235e2] dark:text-slate-500 dark:hover:text-[#1235e2]"
          >
            View <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function CopyCard({ entry, showBrand }: { entry: BestCopyEntry; showBrand?: boolean }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-3">
        {showBrand ? (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{entry.brand.pageName}</span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {entry.displayFormat ?? 'ad'}
          </span>
        )}
        <span className="text-xs font-semibold text-[#1235e2] tabular-nums">~{formatNumber(entry.reachEstimate)}</span>
      </div>
      {entry.title && <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.title}</p>}
      {entry.body && <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{entry.body}</p>}
      {entry.ctaText && (
        <span className="inline-flex w-fit items-center rounded-full bg-[#1235e2]/10 px-2.5 py-1 text-xs font-semibold text-[#1235e2]">
          {entry.ctaText}
        </span>
      )}
    </Card>
  );
}

export function CreatorRow({ item }: { item: CreatorPartnershipView }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          item.creator.pageName.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="flex-1 truncate">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.creator.pageName}</p>
        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
          {item.brandName ? `with ${item.brandName} · ` : ''}
          {item.adCount} ad{item.adCount === 1 ? '' : 's'}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-[#1235e2] tabular-nums">
        ~{formatNumber(item.totalReach)}
      </span>
    </Card>
  );
}
