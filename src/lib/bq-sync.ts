// P1 — Neon → BigQuery raw sync.
//
// Full-refresh each configured table into BigQuery `raw_*` tables nightly.
// ponytail: full reload (WRITE_TRUNCATE) is the simplest correct v1 — idempotent,
// no watermark/MERGE bugs. At ~1M ads (a few hundred MB NDJSON) it's fine. Switch
// the big tables (ads, assets) to updatedAt-watermark + MERGE only once the reload
// gets slow; the small dims can stay full-refresh forever.
//
// Auth: GOOGLE_APPLICATION_CREDENTIALS_JSON (inline SA key) or
// GOOGLE_APPLICATION_CREDENTIALS (file path). No-op unless BQ_DATASET is set, so
// it's safe to ship dark and light up later — same pattern as SLACK_WEBHOOK_URL.

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from './prisma';

const PAGE = 5000; // rows per DB page (memory-safe streaming to disk)

type TableSpec = {
  raw: string;                                   // BigQuery table name
  fetch: (skip: number, take: number) => Promise<Record<string, unknown>[]>;
};

// Explicit scalar columns → an intentional warehouse schema, not a blob dump.
// Heavy JSON (targetingJson) is deliberately excluded from v1.
const TABLES: TableSpec[] = [
  {
    raw: 'raw_ads',
    fetch: (skip, take) => prisma.adLibraryAd.findMany({
      skip, take, orderBy: { id: 'asc' },
      select: {
        id: true, adId: true, brandId: true, displayFormat: true, publisherPlatforms: true,
        title: true, ctaType: true, linkUrl: true, startDate: true, endDate: true,
        adDurationDays: true, isActive: true, reachEstimate: true, spendLower: true,
        spendUpper: true, impressionsLower: true, impressionsUpper: true, currency: true,
        bylines: true, createdAt: true, updatedAt: true,
      },
    }),
  },
  {
    raw: 'raw_brands',
    fetch: (skip, take) => prisma.adLibraryBrand.findMany({
      skip, take, orderBy: { id: 'asc' },
      select: {
        id: true, pageId: true, pageName: true, category: true, totalReach: true,
        ingestionStatus: true, priority: true, lastCheckedAt: true, failCount: true,
        createdAt: true,
      },
    }),
  },
  {
    raw: 'raw_assets',
    fetch: (skip, take) => prisma.adAsset.findMany({
      skip, take, orderBy: { id: 'asc' },
      select: { id: true, adId: true, downloadStatus: true, createdAt: true },
    }),
  },
  {
    raw: 'raw_sov_weekly',
    fetch: (skip, take) => prisma.sovSnapshot.findMany({
      skip, take, orderBy: { id: 'asc' },
      select: {
        id: true, brandId: true, weekStart: true, activeAds: true, totalReach: true,
        estSpend: true, videoCount: true, imageCount: true, carouselCount: true,
        newAdsCount: true, createdAt: true,
      },
    }),
  },
  {
    raw: 'raw_classifications',
    fetch: (skip, take) => prisma.adClassification.findMany({
      skip, take, orderBy: { id: 'asc' },
    }),
  },
];

// BigInt (totalReach etc.) and Date need JSON coercion for NDJSON.
function ndjsonLine(row: Record<string, unknown>): string {
  return JSON.stringify(row, (_k, v) => {
    if (typeof v === 'bigint') return Number(v);
    return v;
  });
}

function credentials(): Record<string, unknown> | undefined {
  const inline = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (inline) return JSON.parse(inline);
  return undefined; // else falls back to GOOGLE_APPLICATION_CREDENTIALS file via ADC
}

export interface SyncResult { table: string; rows: number }

export async function syncToBigQuery(): Promise<{ synced: boolean; reason?: string; results?: SyncResult[] }> {
  const dataset = process.env.BQ_DATASET;
  if (!dataset) return { synced: false, reason: 'BQ_DATASET not set' };

  // Lazy import so the worker doesn't need @google-cloud/bigquery unless BQ is configured.
  const { BigQuery } = await import('@google-cloud/bigquery');
  const bq = new BigQuery({
    projectId: process.env.BQ_PROJECT,
    location: process.env.BQ_LOCATION || 'EU',
    credentials: credentials(),
  });
  const ds = bq.dataset(dataset);
  const results: SyncResult[] = [];

  for (const spec of TABLES) {
    const tmp = path.join(os.tmpdir(), `${spec.raw}.ndjson`);
    const fh = await fs.open(tmp, 'w');
    let total = 0;
    try {
      for (let skip = 0; ; skip += PAGE) {
        const rows = await spec.fetch(skip, PAGE);
        if (rows.length === 0) break;
        await fh.write(rows.map(ndjsonLine).join('\n') + '\n');
        total += rows.length;
        if (rows.length < PAGE) break;
      }
    } finally {
      await fh.close();
    }

    if (total > 0) {
      await ds.table(spec.raw).load(tmp, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        autodetect: true,
      });
    }
    await fs.unlink(tmp).catch(() => {});
    results.push({ table: spec.raw, rows: total });
  }

  return { synced: true, results };
}
