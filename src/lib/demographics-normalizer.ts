// Demographics JSON normalizer utility
// Handles schema drift between old (object-based) and new (array-based) formats

export interface NormalizedDemographics {
  ageBreakdown: { age: string; percentage: number }[];
  genderBreakdown: { gender: string; percentage: number }[];
  regionBreakdown: { region: string; percentage: number }[];
}

/**
 * Convert object-based age breakdown to array format
 * Example: { "18-24": 20, "25-34": 30 } -> [{ age: '18-24', percentage: 20 }, ...]
 */
function convertAgeObject(obj: unknown): { age: string; percentage: number }[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return [];
  }

  const record = obj as Record<string, unknown>;
  const result: { age: string; percentage: number }[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number') {
      result.push({ age: key, percentage: value });
    }
  }

  return result;
}

/**
 * Convert object-based gender breakdown to array format
 * Example: { male: 45, female: 55 } -> [{ gender: 'male', percentage: 45 }, ...]
 */
function convertGenderObject(obj: unknown): { gender: string; percentage: number }[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return [];
  }

  const record = obj as Record<string, unknown>;
  const result: { gender: string; percentage: number }[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number') {
      result.push({ gender: key, percentage: value });
    }
  }

  return result;
}

/**
 * Convert object-based region/country breakdown to array format
 * Example: { DE: 30, FR: 25 } -> [{ region: 'DE', percentage: 30 }, ...]
 */
function convertRegionObject(obj: unknown): { region: string; percentage: number }[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return [];
  }

  const record = obj as Record<string, unknown>;
  const result: { region: string; percentage: number }[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number') {
      result.push({ region: key, percentage: value });
    }
  }

  return result;
}

/**
 * Sort age brackets by leading number
 * Example: ["25-34", "18-24", "65+"] -> ["18-24", "25-34", "65+"]
 */
function sortAgeBreakdown(breakdown: { age: string; percentage: number }[]): { age: string; percentage: number }[] {
  return [...breakdown].sort((a, b) => {
    const aNum = parseInt(a.age.split('-')[0]) || 0;
    const bNum = parseInt(b.age.split('-')[0]) || 0;
    return aNum - bNum;
  });
}

/**
 * Sort region breakdown by percentage descending
 */
function sortRegionBreakdown(breakdown: { region: string; percentage: number }[]): { region: string; percentage: number }[] {
  return [...breakdown].sort((a, b) => b.percentage - a.percentage);
}

/**
 * Normalize demographicsJson from BrandSnapshot into a consistent shape.
 *
 * Handles two formats:
 * 1. Old format (object-based): { gender: { male: 45, female: 55 }, age: { "18-24": 20, ... }, country: { DE: 30, ... } }
 * 2. New format (array-based): { genderBreakdown: [{gender, percentage}], ageBreakdown: [{age, percentage}], regionBreakdown: [{region, percentage}] }
 *
 * Returns null if raw is falsy or not an object.
 */
export function normalizeDemographicsJson(raw: unknown): NormalizedDemographics | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Handle age breakdown - check array first (new format), then object (old format)
  let ageBreakdown: { age: string; percentage: number }[] = [];
  if (Array.isArray(obj.ageBreakdown)) {
    ageBreakdown = obj.ageBreakdown.filter(
      (item): item is { age: string; percentage: number } =>
        typeof item === 'object' &&
        item !== null &&
        'age' in item &&
        'percentage' in item &&
        typeof item.age === 'string' &&
        typeof item.percentage === 'number'
    );
  } else if (obj.age && typeof obj.age === 'object') {
    ageBreakdown = convertAgeObject(obj.age);
  }

  // Handle gender breakdown - check array first (new format), then object (old format)
  let genderBreakdown: { gender: string; percentage: number }[] = [];
  if (Array.isArray(obj.genderBreakdown)) {
    genderBreakdown = obj.genderBreakdown.filter(
      (item): item is { gender: string; percentage: number } =>
        typeof item === 'object' &&
        item !== null &&
        'gender' in item &&
        'percentage' in item &&
        typeof item.gender === 'string' &&
        typeof item.percentage === 'number'
    );
  } else if (obj.gender && typeof obj.gender === 'object') {
    genderBreakdown = convertGenderObject(obj.gender);
  }

  // Handle region breakdown - check array first (new format), then object (old format)
  // Note: Field names vary - regionBreakdown, country, or region
  let regionBreakdown: { region: string; percentage: number }[] = [];
  if (Array.isArray(obj.regionBreakdown)) {
    regionBreakdown = obj.regionBreakdown.filter(
      (item): item is { region: string; percentage: number } =>
        typeof item === 'object' &&
        item !== null &&
        'region' in item &&
        'percentage' in item &&
        typeof item.region === 'string' &&
        typeof item.percentage === 'number'
    );
  } else {
    // Check for object-based formats: country or region field
    const regionSource = obj.country || obj.region;
    if (regionSource && typeof regionSource === 'object' && !Array.isArray(regionSource)) {
      regionBreakdown = convertRegionObject(regionSource);
    }
  }

  return {
    ageBreakdown: sortAgeBreakdown(ageBreakdown),
    genderBreakdown,
    regionBreakdown: sortRegionBreakdown(regionBreakdown),
  };
}
