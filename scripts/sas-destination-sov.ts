/**
 * Destination-level share of voice for the airline set.
 *
 *   npx tsx --env-file=.env.local scripts/sas-destination-sov.ts [monthsBack]
 *
 * Tags every airline ad with the destinations named in its copy, headline or
 * link URL, then rolls reach up by destination x airline x origin market.
 * Writes JSON to stdout-adjacent file for the artifact build.
 *
 * ponytail: dictionary matching, not NER. It only sees destinations the ad
 * actually names in text — generic brand/price creative is invisible here, and
 * closing that gap needs vision classification of the stored assets.
 */
import { prisma } from '../src/lib/prisma';
import fs from 'node:fs';

// destination -> surface forms (sv / da / no / en / de), as they are written in ad
// copy. Matched case-sensitively on word boundaries: place names are capitalised,
// and a lowercase substring match false-positives hard (Danish "rom" = rum,
// English "split"/"nice"). Costs us the odd lowercase URL slug; worth it.
const DESTINATIONS: Record<string, string[]> = {
  'Bangkok': ['Bangkok'],
  'Phuket': ['Phuket'],
  'Krabi': ['Krabi'],
  'Thailand': ['Thailand'],
  'Tokyo': ['Tokyo', 'Tokio'],
  'Shanghai': ['Shanghai'],
  'Mumbai': ['Mumbai'],
  'Delhi': ['Delhi'],
  'Dubai': ['Dubai'],
  'Doha': ['Doha'],
  'Singapore': ['Singapore', 'Singapur'],
  'New York': ['New York', 'Newark', 'JFK'],
  'Boston': ['Boston'],
  'Chicago': ['Chicago'],
  'Miami': ['Miami'],
  'Los Angeles': ['Los Angeles'],
  'San Francisco': ['San Francisco'],
  'Washington DC': ['Washington'],
  'Toronto': ['Toronto'],
  'Alicante': ['Alicante'],
  'Malaga': ['Malaga', 'Málaga'],
  'Mallorca': ['Mallorca'],
  'Barcelona': ['Barcelona'],
  'Madrid': ['Madrid'],
  'Gran Canaria': ['Gran Canaria', 'Las Palmas'],
  'Tenerife': ['Tenerife', 'Teneriffa'],
  'Lisbon': ['Lisbon', 'Lissabon', 'Lisboa'],
  'Athens': ['Athens', 'Aten', 'Athen'],
  'Rhodes': ['Rhodes', 'Rhodos'],
  'Crete': ['Crete', 'Kreta'],
  'Split': ['Split'],
  'Dubrovnik': ['Dubrovnik'],
  'Rome': ['Rome', 'Rom', 'Roma'],
  'Milan': ['Milan', 'Milano'],
  'Venice': ['Venice', 'Venedig', 'Venezia'],
  'Nice': ['Nice'],
  'Paris': ['Paris'],
  'London': ['London'],
  'Amsterdam': ['Amsterdam'],
  'Berlin': ['Berlin'],
  'Munich': ['Munich', 'München', 'Munchen'],
  'Vienna': ['Vienna', 'Wien'],
  'Prague': ['Prague', 'Prag'],
  'Istanbul': ['Istanbul'],
  'Reykjavik': ['Reykjavik', 'Reykjavík'],
  'Tromsø': ['Tromsø', 'Tromso'],
  'Kirkenes': ['Kirkenes'],
  'Svalbard': ['Longyearbyen', 'Svalbard'],
  'Copenhagen': ['Copenhagen', 'Köpenhamn', 'Kopenhamn', 'København', 'Kopenhagen'],
  'Stockholm': ['Stockholm'],
  'Oslo': ['Oslo'],
};

const SAS = 'SAS - Scandinavian Airlines';

async function main() {
  const monthsBack = Number(process.argv[2] ?? 12);
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceStr = since.toISOString().slice(0, 10);

  // Filter in Postgres, not in Node. Pulling every airline ad in the window across
  // the wire is ~40k rows of copy + targeting JSON and times out on Neon; a single
  // case-insensitive regex over the concatenated text fields returns only the ads
  // that actually name a destination (a few thousand).
  const esc = (f: string) => f.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Postgres word boundary is \y. Case-sensitive (~), matching the JS pass below.
  const rx = `\\y(${Object.values(DESTINATIONS).flat().map(esc).join('|')})\\y`;
  const matchers: [string, RegExp][] = Object.entries(DESTINATIONS)
    .map(([dest, forms]) => [dest, new RegExp(`\\b(${forms.map(esc).join('|')})\\b`)]);

  type Row = {
    brand: string; reach: number | null; origin: string | null;
    hay: string; isActive: boolean;
  };
  const matched = await prisma.$queryRaw<Row[]>`
    SELECT b."pageName" AS brand,
           a."reachEstimate" AS reach,
           a."targetingJson"->'targetLocations'->0->>'name' AS origin,
           concat_ws(' ', a.body, a.title, a.caption, a."linkDescription", a."linkUrl") AS hay,
           a."isActive" AS "isActive"
    FROM "AdLibraryAd" a
    JOIN "AdLibraryBrand" b ON b.id = a."brandId"
    WHERE b.category = 'airline'
      AND a."startDate" >= ${since}
      AND concat_ws(' ', a.body, a.title, a.caption, a."linkDescription", a."linkUrl") ~ ${rx}
  `;

  // Denominators (all airline ads in the window, tagged or not) as a cheap aggregate.
  const totals = await prisma.$queryRaw<{ brand: string; ads: bigint; reach: bigint | null }[]>`
    SELECT b."pageName" AS brand, count(*) AS ads, sum(a."reachEstimate") AS reach
    FROM "AdLibraryAd" a
    JOIN "AdLibraryBrand" b ON b.id = a."brandId"
    WHERE b.category = 'airline' AND a."startDate" >= ${since}
    GROUP BY 1
  `;

  type Cell = { ads: number; reach: number; origins: Record<string, number> };
  const grid: Record<string, Record<string, Cell>> = {};
  const taggedPerBrand: Record<string, number> = {};
  let tagged = 0;
  let multiDest = 0;

  for (const ad of matched) {
    const origin = ad.origin ?? 'unspecified';
    const hits = matchers.filter(([, re]) => re.test(ad.hay)).map(([dest]) => dest);
    if (hits.length === 0) continue; // SQL prefilter is looser than the per-destination pass
    tagged++;
    taggedPerBrand[ad.brand] = (taggedPerBrand[ad.brand] ?? 0) + 1;
    if (hits.length > 1) multiDest++;

    // Split reach evenly across the destinations one ad names. A route-list ad that
    // names eight cities is not eight full-reach ads, and counting it that way was
    // inflating every city Norwegian lists in a single creative.
    const share = (ad.reach ?? 0) / hits.length;
    for (const dest of hits) {
      grid[dest] ??= {};
      const cell = (grid[dest][ad.brand] ??= { ads: 0, reach: 0, origins: {} });
      cell.ads++;
      cell.reach += share;
      cell.origins[origin] = (cell.origins[origin] ?? 0) + share;
    }
  }

  const brandTotals = totals
    .map((t) => ({
      brand: t.brand,
      ads: Number(t.ads),
      reach: Number(t.reach ?? 0),
      tagged: taggedPerBrand[t.brand] ?? 0,
    }))
    .sort((a, b) => b.reach - a.reach);
  const adsInWindow = brandTotals.reduce((s, b) => s + b.ads, 0);

  const destinations = Object.entries(grid).map(([dest, brands]) => {
    const rows = Object.entries(brands)
      .map(([brand, c]) => ({
        brand, ads: c.ads, reach: c.reach,
        origins: Object.entries(c.origins).sort((a, b) => b[1] - a[1]).slice(0, 4)
          .map(([name, reach]) => ({ name, reach })),
      }))
      .sort((a, b) => b.reach - a.reach);
    const total = rows.reduce((s, r) => s + r.reach, 0);
    const sas = rows.find((r) => r.brand === SAS);
    return {
      destination: dest,
      totalReach: total,
      sasReach: sas?.reach ?? 0,
      sasAds: sas?.ads ?? 0,
      sasShare: total ? (sas?.reach ?? 0) / total : 0,
      rivals: rows.filter((r) => r.brand !== SAS),
      sasOrigins: sas?.origins ?? [],
    };
  }).sort((a, b) => b.totalReach - a.totalReach);

  const out = {
    generatedAt: new Date().toISOString(),
    window: { monthsBack, since: sinceStr },
    source: 'Meta Ad Library API (ads_archive), EU DSA disclosure. Reach = eu_total_reach, cumulative per ad at last poll.',
    coverage: {
      airlineAdsInWindow: adsInWindow,
      adsWithDestinationNamed: tagged,
      adsNamingMoreThanOne: multiDest,
      attribution: 'Reach is split evenly across every destination an ad names, so destination totals sum to the tagged reach rather than multiplying it.',
    },
    brandTotals,
    destinations,
  };

  fs.writeFileSync('data/sas-destination-sov.json', JSON.stringify(out, null, 2));
  console.log(`airline ads in window: ${adsInWindow}, destination-tagged: ${tagged} (${(100 * tagged / adsInWindow).toFixed(1)}%), multi-destination: ${multiDest}`);
  console.log(`destinations: ${destinations.length} -> data/sas-destination-sov.json`);
  await prisma.$disconnect();
}
main();
