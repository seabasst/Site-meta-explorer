import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const EU_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const DEMO_FIELDS = 'id,ad_delivery_start_time,eu_total_reach,age_country_gender_reach_breakdown';

// Token rotation
const tokens = [
  process.env.FACEBOOK_ACCESS_TOKEN1,
  process.env.FACEBOOK_ACCESS_TOKEN2,
  process.env.FACEBOOK_ACCESS_TOKEN3,
].filter(Boolean) as string[];

let tokenIndex = 0;
function getNextToken(): string {
  const token = tokens[tokenIndex % tokens.length];
  tokenIndex++;
  return token;
}

interface DemoAd {
  id: string;
  eu_total_reach?: number;
  age_country_gender_reach_breakdown?: Array<{
    age_range: string;
    female: number;
    male: number;
    unknown: number;
    country: string;
  }>;
}

async function fetchDemographics(pageId: string): Promise<DemoAd[]> {
  const token = getNextToken();
  const url = new URL('https://graph.facebook.com/v21.0/ads_archive');
  url.searchParams.set('access_token', token);
  url.searchParams.set('ad_reached_countries', JSON.stringify(EU_COUNTRIES));
  url.searchParams.set('search_page_ids', pageId);
  url.searchParams.set('ad_active_status', 'ACTIVE');
  url.searchParams.set('fields', DEMO_FIELDS);
  url.searchParams.set('limit', '50');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Facebook API error: ${error}`);
  }

  const data = await res.json();
  return data.data || [];
}

function aggregateDemographics(ads: DemoAd[]) {
  const ageBreakdown: Record<string, number> = {};
  const genderBreakdown: Record<string, number> = {};
  const regionBreakdown: Record<string, number> = {};
  const ageGenderBreakdown: Record<string, number> = {};

  let totalReach = 0;
  let adsWithDemographics = 0;
  let adsWithoutReach = 0;

  for (const ad of ads) {
    const reach = ad.eu_total_reach || 0;
    if (reach === 0) {
      adsWithoutReach++;
      continue;
    }

    const breakdown = ad.age_country_gender_reach_breakdown;
    if (!breakdown || breakdown.length === 0) continue;

    adsWithDemographics++;
    totalReach += reach;

    for (const entry of breakdown) {
      const { age_range, female, male, unknown, country } = entry;
      const total = female + male + unknown;

      ageBreakdown[age_range] = (ageBreakdown[age_range] || 0) + total;
      genderBreakdown['female'] = (genderBreakdown['female'] || 0) + female;
      genderBreakdown['male'] = (genderBreakdown['male'] || 0) + male;
      genderBreakdown['unknown'] = (genderBreakdown['unknown'] || 0) + unknown;
      regionBreakdown[country] = (regionBreakdown[country] || 0) + total;

      const femaleKey = `${age_range}_female`;
      const maleKey = `${age_range}_male`;
      ageGenderBreakdown[femaleKey] = (ageGenderBreakdown[femaleKey] || 0) + female;
      ageGenderBreakdown[maleKey] = (ageGenderBreakdown[maleKey] || 0) + male;
    }
  }

  if (adsWithDemographics === 0) return null;

  const toPercentageArray = (obj: Record<string, number>, key: string) =>
    Object.entries(obj)
      .map(([k, v]) => ({ [key]: k, percentage: (v / totalReach) * 100 }))
      .sort((a, b) => b.percentage - a.percentage);

  return {
    adsWithDemographics,
    adsWithoutReach,
    totalReachAnalyzed: totalReach,
    ageBreakdown: toPercentageArray(ageBreakdown, 'age'),
    genderBreakdown: toPercentageArray(genderBreakdown, 'gender'),
    regionBreakdown: toPercentageArray(regionBreakdown, 'region'),
    ageGenderBreakdown: Object.entries(ageGenderBreakdown)
      .map(([k, v]) => {
        const [age, gender] = k.split('_');
        return { age, gender, percentage: (v / totalReach) * 100 };
      })
      .sort((a, b) => b.percentage - a.percentage),
  };
}

async function main() {
  console.log('Fetching brands without demographics...');

  const brands = await prisma.adLibraryBrand.findMany({
    where: { demographicsJson: { equals: Prisma.DbNull } },
    orderBy: { priority: 'desc' },
    take: 100, // Process 100 at a time
  });

  console.log(`Found ${brands.length} brands without demographics\n`);

  let success = 0;
  let failed = 0;

  for (const brand of brands) {
    try {
      process.stdout.write(`${brand.pageName}... `);

      const ads = await fetchDemographics(brand.pageId);
      const demographics = aggregateDemographics(ads);

      if (demographics) {
        await prisma.adLibraryBrand.update({
          where: { id: brand.id },
          data: {
            demographicsJson: demographics,
            demographicsUpdatedAt: new Date(),
          },
        });
        console.log(`✓ (${demographics.adsWithDemographics} ads)`);
        success++;
      } else {
        console.log('✗ (no data)');
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.log(`✗ (${error instanceof Error ? error.message : 'error'})`);
      failed++;
    }
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(console.error);
