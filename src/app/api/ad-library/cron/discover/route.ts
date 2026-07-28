import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMetaToken } from '@/lib/meta-token';
import { searchAdvertisers, priorityForReach, type Advertiser } from '@/lib/discovery';

// =============================================================================
// GET /api/ad-library/cron/discover
//
// Daily automatic brand discovery. Rotates through a list of category search
// terms (a few per run), finds advertisers in Meta's Ad Library, and inserts
// new ones as ingestionStatus='pending'. The ingest cron then backfills their
// ads. Free (Meta Ad Library API); grows the tracked-brand set hands-off.
// =============================================================================

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;
const TERMS_PER_RUN = Math.min(8, Math.max(1, Number(process.env.DISCOVER_TERMS_PER_RUN ?? 4)));

// Broad DTC / e-commerce categories (EU + Nordic focus). Extend freely.
const SEARCH_TERMS = [
  'activewear', 'gym leggings', 'running shoes', 'sportswear', 'yoga wear',
  'skincare', 'serum', 'makeup', 'haircare', 'perfume', 'natural cosmetics',
  'supplements', 'protein powder', 'vitamins', 'collagen', 'greens powder',
  'coffee subscription', 'specialty tea', 'craft snacks', 'meal kit', 'organic food',
  'sustainable fashion', 'linen clothing', 'sneakers', 'denim', 'swimwear', 'lingerie',
  'jewelry', 'watches', 'sunglasses', 'leather bags', 'backpacks',
  'home decor', 'wall art', 'furniture', 'bedding', 'candles', 'kitchenware', 'rugs',
  'pet food', 'dog accessories', 'baby products', 'kids clothing', 'toys',
  'headphones', 'smart home', 'phone accessories', 'gaming gear',
  'outdoor gear', 'cycling', 'hiking equipment', 'camping',
  'mattress', 'skincare devices', 'electric toothbrush', 'eyewear',
  // Nordic-language terms
  'träningskläder', 'hudvård', 'kosttillskott', 'barnkläder', 'möbler', 'smycken',
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = getMetaToken();
  if (!token) return NextResponse.json({ error: 'No Facebook token configured' }, { status: 503 });

  // Rotate through the term list so the whole set is covered over several days.
  const day = Math.floor(Date.now() / 86_400_000);
  const start = (day * TERMS_PER_RUN) % SEARCH_TERMS.length;
  const terms = Array.from({ length: TERMS_PER_RUN }, (_, i) => SEARCH_TERMS[(start + i) % SEARCH_TERMS.length]);

  // Search + merge advertisers, tracking which term found each (→ category).
  const advertisers = new Map<string, Advertiser & { term: string }>();
  for (const term of terms) {
    try {
      const found = await searchAdvertisers(term, token, 3);
      for (const [id, a] of found) {
        const prev = advertisers.get(id);
        if (prev) { prev.ads += a.ads; prev.maxReach = Math.max(prev.maxReach, a.maxReach); }
        else advertisers.set(id, { ...a, term });
      }
    } catch {
      // transient — skip this term, next run retries
    }
  }

  const ids = [...advertisers.keys()];
  if (ids.length === 0) return NextResponse.json({ terms, discovered: 0, added: 0 });

  const existing = new Set(
    (await prisma.adLibraryBrand.findMany({ where: { pageId: { in: ids } }, select: { pageId: true } })).map((b) => b.pageId)
  );
  // Highest-reach new advertisers first, capped per run to keep the ingest queue sane.
  const cap = Math.min(400, Math.max(10, Number(process.env.DISCOVER_MAX_PER_RUN ?? 150)));
  const fresh = [...advertisers.values()].filter((a) => !existing.has(a.pageId)).sort((a, b) => b.maxReach - a.maxReach).slice(0, cap);

  let added = 0;
  if (fresh.length) {
    const result = await prisma.adLibraryBrand.createMany({
      data: fresh.map((a) => ({
        pageId: a.pageId,
        pageName: a.pageName,
        category: a.term,
        ingestionStatus: 'pending',
        priority: priorityForReach(a.maxReach),
        totalReach: BigInt(Math.round(a.maxReach)),
        requestedAt: new Date(),
        requestNote: `Auto-discovered via search: ${a.term}`,
      })),
      skipDuplicates: true,
    });
    added = result.count;
  }

  return NextResponse.json({ terms, discovered: advertisers.size, alreadyTracked: existing.size, added });
}
