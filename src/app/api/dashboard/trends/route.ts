import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { normalizeDemographicsJson } from '@/lib/demographics-normalizer';

// Type definitions for trend data points
interface DemographicTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  '13-17': number;
  '18-24': number;
  '25-34': number;
  '35-44': number;
  '45-54': number;
  '55-64': number;
  '65+': number;
}

interface GenderTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  male: number;
  female: number;
  unknown: number;
}

interface CountryTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  [countryCode: string]: number | string;
}

interface TrendsResponse {
  ageTrend: DemographicTrendPoint[];
  genderTrend: GenderTrendPoint[];
  countryTrend: CountryTrendPoint[];
  snapshotCount: number;
}

// Standard age brackets
const AGE_BRACKETS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

// Date formatter for display
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

/**
 * Build age data point from normalized breakdown
 * Maps age brackets to flat keys, defaults to 0 for missing brackets
 */
function buildAgeData(breakdown: { age: string; percentage: number }[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const bracket of AGE_BRACKETS) {
    const entry = breakdown.find(b => b.age === bracket);
    result[bracket] = entry?.percentage ?? 0;
  }

  return result;
}

/**
 * Build gender data point from normalized breakdown
 * Defaults to 0 for missing genders
 */
function buildGenderData(breakdown: { gender: string; percentage: number }[]): { male: number; female: number; unknown: number } {
  const genderMap: Record<string, number> = { male: 0, female: 0, unknown: 0 };

  for (const entry of breakdown) {
    const key = entry.gender.toLowerCase();
    if (key in genderMap) {
      genderMap[key] = entry.percentage;
    } else {
      // Treat any non-male/female as unknown
      genderMap.unknown += entry.percentage;
    }
  }

  return {
    male: genderMap.male,
    female: genderMap.female,
    unknown: genderMap.unknown,
  };
}

/**
 * GET /api/dashboard/trends
 * Returns demographic trend data for a tracked brand
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trackedBrandId = searchParams.get('trackedBrandId');
  const limit = parseInt(searchParams.get('limit') || '30', 10);

  if (!trackedBrandId) {
    return NextResponse.json({ error: 'Missing trackedBrandId' }, { status: 400 });
  }

  // Verify ownership (own brand or competitor)
  const brand = await prisma.trackedBrand.findFirst({
    where: {
      id: trackedBrandId,
      OR: [
        { ownerId: session.user.id },
        { trackerId: session.user.id },
      ],
    },
  });

  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  }

  // Fetch snapshots ordered by date ASC (oldest first for charts)
  const snapshots = await prisma.brandSnapshot.findMany({
    where: { trackedBrandId },
    orderBy: { snapshotDate: 'asc' },
    take: limit,
    select: {
      id: true,
      snapshotDate: true,
      demographicsJson: true,
    },
  });

  // First pass: collect all countries that appear in top-5 of any snapshot
  const allTopCountries = new Set<string>();
  const snapshotDemographics = snapshots.map(s => {
    const demo = normalizeDemographicsJson(s.demographicsJson);
    // Top 5 countries from this snapshot (already sorted by percentage desc)
    const top5 = demo?.regionBreakdown.slice(0, 5) ?? [];
    for (const entry of top5) {
      allTopCountries.add(entry.region);
    }
    return { snapshot: s, demographics: demo };
  });

  // Convert to array for consistent iteration
  const unionCountries = Array.from(allTopCountries);

  // Build trend arrays
  const ageTrend: DemographicTrendPoint[] = [];
  const genderTrend: GenderTrendPoint[] = [];
  const countryTrend: CountryTrendPoint[] = [];

  for (const { snapshot, demographics } of snapshotDemographics) {
    const timestamp = new Date(snapshot.snapshotDate).getTime();
    const date = dateFormatter.format(new Date(snapshot.snapshotDate));

    // Age trend point
    const ageData = demographics ? buildAgeData(demographics.ageBreakdown) : buildAgeData([]);
    ageTrend.push({
      timestamp,
      date,
      snapshotId: snapshot.id,
      '13-17': ageData['13-17'],
      '18-24': ageData['18-24'],
      '25-34': ageData['25-34'],
      '35-44': ageData['35-44'],
      '45-54': ageData['45-54'],
      '55-64': ageData['55-64'],
      '65+': ageData['65+'],
    });

    // Gender trend point
    const genderData = demographics ? buildGenderData(demographics.genderBreakdown) : { male: 0, female: 0, unknown: 0 };
    genderTrend.push({
      timestamp,
      date,
      snapshotId: snapshot.id,
      ...genderData,
    });

    // Country trend point - include all union countries, 0 for missing
    const countryPoint: CountryTrendPoint = {
      timestamp,
      date,
      snapshotId: snapshot.id,
    };

    for (const country of unionCountries) {
      const entry = demographics?.regionBreakdown.find(r => r.region === country);
      countryPoint[country] = entry?.percentage ?? 0;
    }

    countryTrend.push(countryPoint);
  }

  const response: TrendsResponse = {
    ageTrend,
    genderTrend,
    countryTrend,
    snapshotCount: snapshots.length,
  };

  return NextResponse.json(response);
}
