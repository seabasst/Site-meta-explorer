// P1 — Neon → BigQuery raw sync.
//
// Full-refresh each configured table into BigQuery `raw_*` tables nightly.
// ponytail: full reload (WRITE_TRUNCATE) is the simplest correct v1 — idempotent,
// no watermark/MERGE bugs. At ~1M ads (a few hundred MB NDJSON) it's fine. Switch
// the big tables (ads, assets) to updatedAt-watermark + MERGE only once the reload
// gets slow; the small dims can stay full-refresh forever.
//
// Schemas are EXPLICIT (autodetect off): autodetect infers types from a sample and
// mis-types columns whose early rows look integer (e.g. estSpend 0 → INTEGER, then
// 2037.5 fails). Explicit schemas make every nightly load deterministic.
//
// Auth: GOOGLE_APPLICATION_CREDENTIALS_JSON (inline SA key) or
// GOOGLE_APPLICATION_CREDENTIALS (file path). No-op unless BQ_DATASET is set.

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from './prisma';

const PAGE = 5000; // rows per DB page (memory-safe streaming to disk)

type Field = { name: string; type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP'; mode?: 'REPEATED' };
const S = (name: string): Field => ({ name, type: 'STRING' });
const I = (name: string): Field => ({ name, type: 'INTEGER' });
const F = (name: string): Field => ({ name, type: 'FLOAT' });
const B = (name: string): Field => ({ name, type: 'BOOLEAN' });
const T = (name: string): Field => ({ name, type: 'TIMESTAMP' });
const REP = (name: string): Field => ({ name, type: 'STRING', mode: 'REPEATED' });

// Cursor pagination (id > afterId) instead of skip/take — offset scans get O(n)
// slow at the tail; a keyset walk on the PK index stays flat as the corpus grows.
// mode 'incremental' (needs watermark + key): pull only rows changed since the max
// watermark already in BigQuery, load to a staging table, MERGE into the target.
// Slashes Neon egress (the full-refresh of raw_ads was ~1GB/night). mode 'full'
// (default) re-reads the whole table — fine for the small ones without an updatedAt.
type TableSpec = {
  raw: string;
  schema: Field[];
  fetch: (afterId: string | undefined, take: number, since?: Date) => Promise<Record<string, unknown>[]>;
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
  mode?: 'full' | 'incremental';
  watermarkCol?: string; // BQ column holding the change timestamp (e.g. updatedAt)
  key?: string;          // MERGE key (e.g. id)
};

const after = (afterId: string | undefined) => (afterId ? { id: { gt: afterId } } : undefined);
// Combine the keyset cursor with an optional "changed since" watermark filter.
const whereFor = (afterId: string | undefined, since: Date | undefined, col: string) => {
  const clauses: Record<string, unknown>[] = [];
  const a = after(afterId); if (a) clauses.push(a);
  if (since) clauses.push({ [col]: { gt: since } });
  return clauses.length ? { AND: clauses } : undefined;
};

const TABLES: TableSpec[] = [
  {
    raw: 'raw_ads',
    mode: 'incremental',
    watermarkCol: 'updatedAt',
    key: 'id',
    schema: [
      S('id'), S('adId'), S('brandId'), S('displayFormat'), REP('publisherPlatforms'),
      S('body'), S('title'), S('caption'), S('linkDescription'), S('linkUrl'), S('ctaText'), S('ctaType'), S('bylines'),
      T('startDate'), T('endDate'), I('adDurationDays'), B('isActive'),
      I('reachEstimate'), I('impressionsLower'), I('impressionsUpper'), F('spendLower'), F('spendUpper'), S('currency'),
      S('targetingJson'), T('createdAt'), T('updatedAt'),
    ],
    fetch: (afterId, take, since) => prisma.adLibraryAd.findMany({
      take, orderBy: { id: "asc" }, where: whereFor(afterId, since, 'updatedAt'),
      select: {
        id: true, adId: true, brandId: true, displayFormat: true, publisherPlatforms: true,
        body: true, title: true, caption: true, linkDescription: true, linkUrl: true,
        ctaText: true, ctaType: true, bylines: true,
        startDate: true, endDate: true, adDurationDays: true, isActive: true,
        reachEstimate: true, impressionsLower: true, impressionsUpper: true,
        spendLower: true, spendUpper: true, currency: true,
        targetingJson: true, createdAt: true, updatedAt: true,
      },
    }),
    transform: (row) => ({ ...row, targetingJson: row.targetingJson != null ? JSON.stringify(row.targetingJson) : null }),
  },
  {
    raw: 'raw_brands',
    schema: [
      S('id'), S('pageId'), S('pageName'), S('category'), S('country'), S('website'),
      I('totalReach'), S('ingestionStatus'), I('priority'), T('lastCheckedAt'), I('failCount'), T('createdAt'),
    ],
    fetch: (afterId, take) => prisma.adLibraryBrand.findMany({
      take, orderBy: { id: "asc" }, where: after(afterId),
      select: {
        id: true, pageId: true, pageName: true, category: true, country: true, website: true,
        totalReach: true, ingestionStatus: true, priority: true, lastCheckedAt: true,
        failCount: true, createdAt: true,
      },
    }),
  },
  {
    raw: 'raw_assets',
    schema: [
      S('id'), S('adId'), S('originalUrl'), S('storedUrl'), S('storedKey'), S('thumbnailUrl'),
      I('width'), I('height'), S('downloadStatus'), T('createdAt'),
    ],
    fetch: (afterId, take) => prisma.adAsset.findMany({
      take, orderBy: { id: "asc" }, where: after(afterId),
      select: {
        id: true, adId: true, originalUrl: true, storedUrl: true, storedKey: true,
        thumbnailUrl: true, width: true, height: true, downloadStatus: true, createdAt: true,
      },
    }),
  },
  {
    raw: 'raw_sov_weekly',
    schema: [
      S('id'), S('brandId'), T('weekStart'), I('activeAds'), I('totalReach'), F('estSpend'),
      I('videoCount'), I('imageCount'), I('carouselCount'), I('newAdsCount'), T('createdAt'),
    ],
    fetch: (afterId, take) => prisma.sovSnapshot.findMany({
      take, orderBy: { id: "asc" }, where: after(afterId),
      select: {
        id: true, brandId: true, weekStart: true, activeAds: true, totalReach: true,
        estSpend: true, videoCount: true, imageCount: true, carouselCount: true,
        newAdsCount: true, createdAt: true,
      },
    }),
  },
  {
    raw: 'raw_classifications',
    schema: [
      S('id'), S('adId'), S('assetType'), S('visualFormat'), S('hookTactic'), S('messagingAngle'),
      S('awarenessStage'), S('creativeMechanic'), S('offerType'), S('intendedAudience'), I('hookScore'),
      S('conceptCluster'), F('confidence'), S('classifiedBy'), S('classificationSource'),
      I('schemaVersion'), T('classifiedAt'),
    ],
    fetch: (afterId, take) => prisma.adClassification.findMany({ take, orderBy: { id: 'asc' }, where: after(afterId) }),
  },
];

// BigInt (totalReach etc.) and Date need JSON coercion for NDJSON.
function ndjsonLine(row: Record<string, unknown>): string {
  return JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
}

function credentials(): Record<string, unknown> | undefined {
  const inline = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (inline) return JSON.parse(inline);
  return undefined; // else ADC via GOOGLE_APPLICATION_CREDENTIALS file
}

export interface SyncResult { table: string; rows: number }

export async function syncToBigQuery(): Promise<{ synced: boolean; reason?: string; results?: SyncResult[] }> {
  const dataset = process.env.BQ_DATASET;
  if (!dataset) return { synced: false, reason: 'BQ_DATASET not set' };

  const { BigQuery } = await import('@google-cloud/bigquery');
  const bq = new BigQuery({
    projectId: process.env.BQ_PROJECT,
    location: process.env.BQ_LOCATION || 'EU',
    credentials: credentials(),
  });
  const ds = bq.dataset(dataset);
  const project = process.env.BQ_PROJECT;
  const q = (query: string) => bq.query({ query, location: process.env.BQ_LOCATION || 'EU' });
  const ref = (t: string) => `\`${project}.${dataset}.${t}\``;
  const results: SyncResult[] = [];

  for (const spec of TABLES) {
    const incremental = spec.mode === 'incremental' && spec.watermarkCol && spec.key;

    // For incremental, only pull rows changed since the newest watermark already in BQ.
    let since: Date | undefined;
    if (incremental) {
      const [rows] = await q(`SELECT MAX(${spec.watermarkCol}) AS m FROM ${ref(spec.raw)}`);
      const m = (rows?.[0] as { m?: { value?: string } | string } | undefined)?.m;
      const v = typeof m === 'object' && m ? m.value : (m as string | undefined);
      if (v) since = new Date(v);
    }

    const tmp = path.join(os.tmpdir(), `${spec.raw}.ndjson`);
    const fh = await fs.open(tmp, 'w');
    let total = 0;
    try {
      let afterId: string | undefined;
      for (;;) {
        const rows = await spec.fetch(afterId, PAGE, since);
        if (rows.length === 0) break;
        const out = spec.transform ? rows.map(spec.transform) : rows;
        await fh.write(out.map(ndjsonLine).join('\n') + '\n');
        total += rows.length;
        afterId = rows[rows.length - 1].id as string;
        if (rows.length < PAGE) break;
      }
    } finally {
      await fh.close();
    }

    if (incremental) {
      // Load changed rows into a staging table, then MERGE into the target on key.
      if (total > 0) {
        const stg = `_stg_${spec.raw}`;
        await ds.table(stg).load(tmp, {
          sourceFormat: 'NEWLINE_DELIMITED_JSON',
          writeDisposition: 'WRITE_TRUNCATE',
          schema: { fields: spec.schema },
          autodetect: false,
        });
        const cols = spec.schema.map((f) => f.name);
        const setClause = cols.filter((c) => c !== spec.key).map((c) => `T.${c}=S.${c}`).join(', ');
        await q(
          `MERGE ${ref(spec.raw)} T USING ${ref(stg)} S ON T.${spec.key}=S.${spec.key}\n` +
          `WHEN MATCHED THEN UPDATE SET ${setClause}\n` +
          `WHEN NOT MATCHED THEN INSERT (${cols.join(', ')}) VALUES (${cols.map((c) => `S.${c}`).join(', ')})`
        );
      }
    } else if (total > 0) {
      // Full refresh — replace the whole table.
      await ds.table(spec.raw).load(tmp, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema: { fields: spec.schema },
        autodetect: false,
      });
    }
    await fs.unlink(tmp).catch(() => {});
    results.push({ table: spec.raw, rows: total });
  }

  return { synced: true, results };
}
