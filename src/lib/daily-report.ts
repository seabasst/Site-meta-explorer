// Shared daily ingestion report — used by both the always-on Fly worker
// (scripts/ingest-worker.ts) and the Vercel route (kept as a manual trigger).
// Builds the Slack mrkdwn summary and posts it to SLACK_WEBHOOK_URL.

import { prisma } from './prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyReport {
  text: string;
  totalAds: number;
  activeAds: number;
  new24hTotal: number;
  brandsWithNewAds: number;
  topVelocity: { brand: string; newAds7d: number } | null;
}

// Query the DB and format the Slack message (mrkdwn: *single-asterisk* bold, which
// is what Slack incoming webhooks render — not GitHub-style **double**).
export async function buildDailyReport(): Promise<DailyReport> {
  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  const [totalAds, activeAds, totalBrands, new24hByBrand, launched7dByBrand] = await Promise.all([
    prisma.adLibraryAd.count(),
    prisma.adLibraryAd.count({ where: { isActive: true } }),
    prisma.adLibraryBrand.count({ where: { ingestionStatus: 'active' } }),
    prisma.adLibraryAd.groupBy({ by: ['brandId'], where: { createdAt: { gte: since24h } }, _count: { _all: true } }),
    prisma.adLibraryAd.groupBy({ by: ['brandId'], where: { startDate: { gte: since7d } }, _count: { _all: true } }),
  ]);

  const new24hTotal = new24hByBrand.reduce((s, g) => s + g._count._all, 0);

  const ids = [...new Set([...new24hByBrand, ...launched7dByBrand].map((g) => g.brandId))];
  const brands = await prisma.adLibraryBrand.findMany({
    where: { id: { in: ids } },
    select: { id: true, pageName: true, totalReach: true },
  });
  const nameOf = new Map(brands.map((b) => [b.id, b.pageName] as const));
  const reachOf = new Map(brands.map((b) => [b.id, b.totalReach] as const));

  const topNew = [...new24hByBrand].sort((a, b) => b._count._all - a._count._all).slice(0, 8);
  const topVelocity = [...launched7dByBrand].sort((a, b) => b._count._all - a._count._all)[0];

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`*📊 Ad Ingestion — ${today}*`);
  lines.push(`Total: *${totalAds.toLocaleString()}* ads (${activeAds.toLocaleString()} active) across ${totalBrands.toLocaleString()} active brands`);
  lines.push(`Last 24h: *+${new24hTotal.toLocaleString()}* ads from *${new24hByBrand.length}* brands`);
  if (topNew.length) {
    lines.push('');
    lines.push('*Top brands by new ads (24h):*');
    topNew.forEach((g, i) => lines.push(`${i + 1}. ${nameOf.get(g.brandId) ?? g.brandId} — +${g._count._all.toLocaleString()}`));
  }
  if (topVelocity) {
    const reachM = Number(reachOf.get(topVelocity.brandId) ?? 0) / 1e6;
    lines.push('');
    lines.push('*🏎️ Highest ad velocity in Europe (7d launches):*');
    lines.push(`${nameOf.get(topVelocity.brandId) ?? topVelocity.brandId} — *${topVelocity._count._all.toLocaleString()}* new ads/week${reachM ? ` (reach ≈ ${reachM.toFixed(1)}M)` : ''}`);
  }

  return {
    text: lines.join('\n'),
    totalAds, activeAds, new24hTotal,
    brandsWithNewAds: new24hByBrand.length,
    topVelocity: topVelocity ? { brand: nameOf.get(topVelocity.brandId) ?? topVelocity.brandId, newAds7d: topVelocity._count._all } : null,
  };
}

// Build + POST to Slack. No-op (posted:false) when SLACK_WEBHOOK_URL is unset,
// so the worker runs harmlessly until the webhook secret is added.
export async function sendDailyReport(): Promise<{ posted: boolean; reason?: string; report?: DailyReport }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { posted: false, reason: 'SLACK_WEBHOOK_URL not set' };
  const report = await buildDailyReport();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: report.text }),
  });
  if (!res.ok) return { posted: false, reason: `Slack ${res.status} ${await res.text()}`, report };
  return { posted: true, report };
}

// ── Weekly summary ──────────────────────────────────────────────────────────
// Wider view than the daily: 7-day growth, new brands added, a per-day trend,
// top brands and top velocity over the week. Same webhook, same no-op behaviour.

export interface WeeklyReport {
  text: string;
  totalAds: number;
  added7d: number;
  newBrands7d: number;
  brandsContributing: number;
}

export async function buildWeeklyReport(): Promise<WeeklyReport> {
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS);

  const [totalAds, activeAds, added7d, newBrands7d, new7dByBrand, launched7dByBrand] = await Promise.all([
    prisma.adLibraryAd.count(),
    prisma.adLibraryAd.count({ where: { isActive: true } }),
    prisma.adLibraryAd.count({ where: { createdAt: { gte: since7d } } }),
    prisma.adLibraryBrand.count({ where: { createdAt: { gte: since7d } } }),
    prisma.adLibraryAd.groupBy({ by: ['brandId'], where: { createdAt: { gte: since7d } }, _count: { _all: true } }),
    prisma.adLibraryAd.groupBy({ by: ['brandId'], where: { startDate: { gte: since7d } }, _count: { _all: true } }),
  ]);

  // Per-day ingest trend, last 7 UTC days (index 0 = oldest for display).
  const dayCounts = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const end = new Date(now - i * DAY_MS);
      const start = new Date(now - (i + 1) * DAY_MS);
      return prisma.adLibraryAd
        .count({ where: { createdAt: { gte: start, lt: end } } })
        .then((c) => ({ label: start.toISOString().slice(5, 10), c }));
    })
  );
  dayCounts.reverse();

  const ids = [...new Set([...new7dByBrand, ...launched7dByBrand].map((g) => g.brandId))];
  const brands = await prisma.adLibraryBrand.findMany({
    where: { id: { in: ids } },
    select: { id: true, pageName: true },
  });
  const nameOf = new Map(brands.map((b) => [b.id, b.pageName] as const));

  const topNew = [...new7dByBrand].sort((a, b) => b._count._all - a._count._all).slice(0, 10);
  const topVel = [...launched7dByBrand].sort((a, b) => b._count._all - a._count._all).slice(0, 3);

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`*📅 Weekly Ad Ingestion — week ending ${today}*`);
  lines.push(`Total: *${totalAds.toLocaleString()}* ads (${activeAds.toLocaleString()} active)`);
  lines.push(`This week: *+${added7d.toLocaleString()}* ads · *+${newBrands7d.toLocaleString()}* new brands · ${new7dByBrand.length.toLocaleString()} brands contributing`);
  lines.push('');
  lines.push('*Daily new ads (last 7d):*');
  dayCounts.forEach((d) => lines.push(`${d.label}  +${d.c.toLocaleString()}`));
  if (topNew.length) {
    lines.push('');
    lines.push('*Top brands this week:*');
    topNew.forEach((g, i) => lines.push(`${i + 1}. ${nameOf.get(g.brandId) ?? g.brandId} — +${g._count._all.toLocaleString()}`));
  }
  if (topVel.length) {
    lines.push('');
    lines.push('*🏎️ Top ad velocity in Europe (7d launches):*');
    topVel.forEach((g, i) => lines.push(`${i + 1}. ${nameOf.get(g.brandId) ?? g.brandId} — ${g._count._all.toLocaleString()}/wk`));
  }

  return { text: lines.join('\n'), totalAds, added7d, newBrands7d, brandsContributing: new7dByBrand.length };
}

export async function sendWeeklyReport(): Promise<{ posted: boolean; reason?: string; report?: WeeklyReport }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { posted: false, reason: 'SLACK_WEBHOOK_URL not set' };
  const report = await buildWeeklyReport();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: report.text }),
  });
  if (!res.ok) return { posted: false, reason: `Slack ${res.status} ${await res.text()}`, report };
  return { posted: true, report };
}
