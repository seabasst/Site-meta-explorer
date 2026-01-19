import puppeteer, { Browser, HTTPResponse, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { extractDemographicsFromApiResponse } from './demographic-extractor';
import { selectTopPerformers } from './top-performer-selector';
import { aggregateDemographics } from './demographic-aggregator';
import { AdDemographics, AdWithMetrics, AdDataWithDemographics, AdLibraryResultWithDemographics } from './demographic-types';

// URL to download chromium binary at runtime (required for serverless environments)
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar';

export interface AdData {
  adId: string;
  adArchiveId: string | null; // Facebook's archive ID for ad detail pages
  destinationUrl: string | null;
  linkText: string | null;
  startedRunning: string | null;
  adCount: number; // Number of active ads linking to this URL
  adLibraryLinks: string[]; // Links to view these ads in Facebook Ad Library
}

export interface AdLibraryResult {
  success: true;
  pageId: string;
  pageName: string | null;
  ads: AdData[];
  totalAdsFound: number;
  totalActiveAdsOnPage: number | null; // The actual total shown by Facebook
}

export interface AdLibraryError {
  success: false;
  error: string;
}

export type AdLibraryResponse = AdLibraryResult | AdLibraryResultWithDemographics | AdLibraryError;

function extractPageIdFromUrl(url: string): string | null {
  const match = url.match(/view_all_page_id=(\d+)/);
  return match ? match[1] : null;
}

function isExternalUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;

  const internalDomains = [
    'facebook.com',
    'fb.com',
    'instagram.com',
    'meta.com',
    'fbcdn.net',
    'fbsbx.com',
  ];

  try {
    const parsed = new URL(url);
    return !internalDomains.some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

interface ExtractedAd {
  url: string;
  adId: string | null;
}

// Extract URLs and ad IDs from Facebook API response data
function extractUrlsFromApiResponse(data: unknown): ExtractedAd[] {
  const results: ExtractedAd[] = [];

  function findAdId(obj: Record<string, unknown>): string | null {
    // Common ad ID field names in Facebook's API
    const idFields = ['ad_archive_id', 'adArchiveID', 'id', 'ad_id', 'adId', 'archive_id'];
    for (const field of idFields) {
      const val = obj[field];
      if (typeof val === 'string' && /^\d+$/.test(val)) {
        return val;
      }
      if (typeof val === 'number') {
        return String(val);
      }
    }
    return null;
  }

  function traverse(obj: unknown, parentAdId: string | null = null): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item, parentAdId));
      return;
    }

    const record = obj as Record<string, unknown>;

    // Check if this object has an ad ID
    const currentAdId = findAdId(record) || parentAdId;

    // Look for common URL field names in Facebook's API
    const urlFields = [
      'link_url',
      'destination_url',
      'website_url',
      'cta_url',
      'call_to_action_url',
      'display_url',
      'landing_page_url',
      'object_url',
      'link',
    ];

    for (const field of urlFields) {
      if (typeof record[field] === 'string' && record[field]) {
        const url = record[field] as string;
        if (url.startsWith('http') && isExternalUrl(url)) {
          results.push({ url, adId: currentAdId });
        }
      }
    }

    // Also check for nested objects, passing down the current ad ID
    Object.values(record).forEach(val => traverse(val, currentAdId));
  }

  traverse(data);
  return results;
}

/**
 * Scrape demographics from a single ad detail page.
 * Navigates to the ad's detail page and captures demographic data from API responses.
 * Returns null if demographics unavailable (graceful degradation).
 */
async function scrapeAdDemographics(
  page: Page,
  adArchiveId: string,
  debug: boolean = false
): Promise<AdDemographics | null> {
  try {
    const adDetailUrl = `https://www.facebook.com/ads/library/?id=${adArchiveId}`;

    if (debug) {
      console.log(`[demographics] Navigating to: ${adDetailUrl}`);
    }

    await page.goto(adDetailUrl, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    // Wait for page content to load
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Click "See ad details" to open the transparency modal
    try {
      const clicked = await page.evaluate(() => {
        const xpath = "//*[contains(text(), 'See ad details')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue as HTMLElement | null;
        if (el) {
          el.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        if (debug) {
          console.log(`[demographics] Clicked "See ad details", waiting for modal...`);
        }
        // Wait for modal to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Now click on "Transparency by location" tab to reveal the data
        const transparencyClicked = await page.evaluate(() => {
          // Try multiple ways to find and click the transparency section
          const selectors = [
            "//*[contains(text(), 'Transparency by location')]",
            "//*[contains(text(), 'Transparency')]",
            "//*[contains(text(), 'by location')]",
          ];

          for (const xpath of selectors) {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const el = result.singleNodeValue as HTMLElement | null;
            if (el) {
              el.click();
              return xpath;
            }
          }

          // Also try clicking any element that looks like an expandable section
          const allElements = document.querySelectorAll('[role="button"], [aria-expanded], button, div[tabindex]');
          for (const el of allElements) {
            const text = el.textContent?.toLowerCase() || '';
            if (text.includes('transparency') || text.includes('location') || text.includes('audience')) {
              (el as HTMLElement).click();
              return 'element-click';
            }
          }

          return null;
        });

        if (debug) {
          console.log(`[demographics] Clicked transparency section: ${transparencyClicked}`);
        }

        // Wait for transparency data to load
        await new Promise(resolve => setTimeout(resolve, 2000));

      } else {
        if (debug) {
          console.log(`[demographics] No "See ad details" link found`);
        }
        return null;
      }
    } catch (err) {
      if (debug) {
        console.log(`[demographics] Error clicking "See ad details": ${err}`);
      }
      return null;
    }

    // Save page text for debugging
    if (debug) {
      const pageText = await page.evaluate(() => document.body.innerText);
      const fs = require('fs');
      fs.writeFileSync(`/tmp/ad-page-text-${adArchiveId}.txt`, pageText);
      console.log(`[demographics] Page text saved to /tmp/ad-page-text-${adArchiveId}.txt`);
    }

    // Now extract demographic data from the DOM
    // Facebook shows data in a table format: Location | Age Range | Gender | Reach (as numbers, not percentages)
    const demographics = await page.evaluate((adId) => {
      const result: {
        adArchiveId: string;
        ageGenderBreakdown: { age: string; gender: string; percentage: number }[];
        regionBreakdown: { region: string; percentage: number }[];
        euTotalReach?: number;
        debugInfo?: string;
      } = {
        adArchiveId: adId,
        ageGenderBreakdown: [],
        regionBreakdown: [],
      };

      const pageText = document.body.innerText;
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // Look for total reach - format: "Reach\n2,993"
      const reachIndex = lines.findIndex(l => l === 'Reach');
      if (reachIndex !== -1 && reachIndex < lines.length - 1) {
        const reachValue = lines[reachIndex + 1];
        const reachNum = parseInt(reachValue.replace(/[,\.]/g, ''), 10);
        if (!isNaN(reachNum) && reachNum > 0) {
          result.euTotalReach = reachNum;
        }
      }

      // Find the demographic breakdown section
      // Look for "Reach by location, age and gender" header
      const breakdownStart = lines.findIndex(l =>
        l.toLowerCase().includes('reach by location') ||
        l.toLowerCase().includes('demographic breakdown')
      );

      if (breakdownStart !== -1) {
        // The table headers are: Location, Age Range, Gender, Reach
        // Data follows in groups of 4 lines per row
        const headerIdx = lines.findIndex((l, i) => i > breakdownStart && l === 'Location');
        if (headerIdx !== -1) {
          // Skip headers: Location, Age Range, Gender, Reach
          let dataStart = headerIdx + 4;

          // Collect raw data rows
          const rows: { location: string; age: string; gender: string; reach: number }[] = [];
          const countries = ['Sweden', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium',
            'Austria', 'Poland', 'Denmark', 'Norway', 'Finland', 'Portugal', 'Greece',
            'Ireland', 'Czech Republic', 'Romania', 'Hungary', 'United Kingdom'];
          const ageRanges = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
          const genders = ['Female', 'Male', 'Unknown'];

          while (dataStart < lines.length - 3) {
            const loc = lines[dataStart];
            const age = lines[dataStart + 1];
            const gender = lines[dataStart + 2];
            const reachStr = lines[dataStart + 3];

            // Validate this looks like a data row
            const isCountry = countries.some(c => loc.toLowerCase() === c.toLowerCase());
            const isAge = ageRanges.some(a => age === a);
            const isGender = genders.some(g => gender.toLowerCase() === g.toLowerCase());
            const reach = parseInt(reachStr.replace(/[,\.]/g, ''), 10);

            if (isCountry && isAge && isGender && !isNaN(reach)) {
              rows.push({ location: loc, age, gender: gender.toLowerCase(), reach });
              dataStart += 4;
            } else {
              // Check if we hit "About the advertiser" or similar end marker
              if (loc.includes('About') || loc.includes('Beneficiary') || loc.includes('Close')) {
                break;
              }
              dataStart++;
            }
          }

          // Calculate total reach from rows
          const totalReach = rows.reduce((sum, r) => sum + r.reach, 0) || result.euTotalReach || 1;

          // Aggregate by age+gender
          const ageGenderMap = new Map<string, number>();
          for (const row of rows) {
            const key = `${row.age}|${row.gender}`;
            ageGenderMap.set(key, (ageGenderMap.get(key) || 0) + row.reach);
          }
          for (const [key, reach] of ageGenderMap) {
            const [age, gender] = key.split('|');
            const percentage = Math.round((reach / totalReach) * 1000) / 10; // Round to 1 decimal
            result.ageGenderBreakdown.push({ age, gender, percentage });
          }

          // Aggregate by region
          const regionMap = new Map<string, number>();
          for (const row of rows) {
            regionMap.set(row.location, (regionMap.get(row.location) || 0) + row.reach);
          }
          for (const [region, reach] of regionMap) {
            const percentage = Math.round((reach / totalReach) * 1000) / 10;
            result.regionBreakdown.push({ region, percentage });
          }

          result.debugInfo = `Found ${rows.length} data rows, total reach: ${totalReach}`;
        }
      }

      // Fallback: If no structured data found, try regex patterns
      if (result.ageGenderBreakdown.length === 0) {
        result.debugInfo = 'No structured data found, using fallback patterns';

        // Look for gender targeting info
        if (pageText.includes('Gender\nWomen')) {
          result.ageGenderBreakdown.push({ age: 'all', gender: 'female', percentage: 100 });
        } else if (pageText.includes('Gender\nMen')) {
          result.ageGenderBreakdown.push({ age: 'all', gender: 'male', percentage: 100 });
        }
      }

      return result;
    }, adArchiveId);

    if (debug) {
      console.log(`[demographics] Extracted: ${demographics.ageGenderBreakdown.length} age/gender, ${demographics.regionBreakdown.length} regions`);
      console.log(`[demographics] Debug: ${demographics.debugInfo}`);
    }

    // Return null if no data found
    if (demographics.ageGenderBreakdown.length === 0 && demographics.regionBreakdown.length === 0) {
      if (debug) {
        console.log(`[demographics] No demographic data found in page content`);
      }
      return null;
    }

    // Clean up debugInfo before returning
    const { debugInfo, ...cleanDemographics } = demographics;
    return cleanDemographics;

  } catch (error) {
    console.warn(`[demographics] Failed to scrape ad ${adArchiveId}:`, error);
    return null;
  }
}

export async function scrapeAdLibrary(
  adLibraryUrl: string,
  debug = false,
  options?: {
    scrapeDemographics?: boolean;  // Default: false (backward compatible)
    maxDemographicAds?: number;    // Default: 10
  }
): Promise<AdLibraryResponse> {
  const pageId = extractPageIdFromUrl(adLibraryUrl);

  if (!pageId) {
    return {
      success: false,
      error: 'Invalid Ad Library URL. Please provide a URL with view_all_page_id parameter.',
    };
  }

  let browser: Browser | null = null;
  const urlCounts: Map<string, number> = new Map(); // Track count per URL
  const urlToAdIds: Map<string, Set<string>> = new Map(); // Track ad IDs per URL

  const addUrl = (url: string, adId?: string) => {
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
    if (adId) {
      if (!urlToAdIds.has(url)) {
        urlToAdIds.set(url, new Set());
      }
      urlToAdIds.get(url)!.add(adId);
    }
  };

  try {
    // Use local Chrome for development, serverless chromium for production
    const isProduction = process.env.NODE_ENV === 'production';

    let executablePath: string;
    let args: string[];

    if (isProduction) {
      // Serverless environment - use @sparticuz/chromium-min
      executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
      args = chromium.args;
    } else {
      // Local development - use installed Chrome
      executablePath = process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : '/usr/bin/google-chrome';
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    browser = await puppeteer.launch({
      args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });

    // Intercept network responses to capture API data
    page.on('response', async (response: HTTPResponse) => {
      const url = response.url();

      // Look for Facebook's GraphQL or API endpoints
      if (url.includes('/api/graphql') ||
          url.includes('/ads/library/async') ||
          url.includes('ads_archive')) {
        try {
          const text = await response.text();

          // Try to parse as JSON and extract URLs with ad IDs
          try {
            const json = JSON.parse(text);
            const extracted = extractUrlsFromApiResponse(json);
            extracted.forEach(({ url, adId }) => addUrl(url, adId ?? undefined));
          } catch {
            // Not JSON, try to find URLs with regex
            const urlMatches = text.matchAll(/https?:\/\/(?!(?:www\.)?(?:facebook|fb|instagram|meta)\.com)[^\s"'<>]+/g);
            for (const match of urlMatches) {
              const url = match[0].replace(/[\\",})\]]+$/, ''); // Clean trailing chars
              if (isExternalUrl(url)) {
                addUrl(url);
              }
            }
          }
        } catch {
          // Response body not available
        }
      }
    });

    // Navigate to the Ad Library page
    await page.goto(adLibraryUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for initial content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract page name
    const pageName = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1?.textContent?.trim() || null;
    });

    // Extract total active ads count from the page
    const totalActiveAdsOnPage = await page.evaluate(() => {
      // Look for text patterns like "770 ads", "About 770 results", etc.
      const pageText = document.body.innerText;

      // Common patterns Facebook uses
      const patterns = [
        /(\d{1,3}(?:,\d{3})*)\s+ads?\s+(?:use|using)/i,
        /(\d{1,3}(?:,\d{3})*)\s+active\s+ads?/i,
        /(\d{1,3}(?:,\d{3})*)\s+ads?\s+from/i,
        /showing\s+(\d{1,3}(?:,\d{3})*)\s+ads?/i,
        /(\d{1,3}(?:,\d{3})*)\s+results?/i,
        /(\d{1,3}(?:,\d{3})*)\s+ads?(?:\s|$)/i,
      ];

      for (const pattern of patterns) {
        const match = pageText.match(pattern);
        if (match) {
          const numStr = match[1].replace(/,/g, '');
          const num = parseInt(numStr, 10);
          if (num > 0 && num < 1000000) {
            return num;
          }
        }
      }

      return null;
    });

    // Scroll to load all ads - keep scrolling until no new content loads
    const maxScrolls = 300; // Higher limit for pages with many ads
    let previousUrlCount = 0;
    let noChangeCount = 0;
    const maxNoChange = 5; // Stop after 5 consecutive scrolls with no new URLs

    for (let i = 0; i < maxScrolls; i++) {
      // Check if we've stopped getting new URLs (more reliable than height)
      const currentUrlCount = urlCounts.size;
      if (currentUrlCount === previousUrlCount) {
        noChangeCount++;
        if (noChangeCount >= maxNoChange) {
          // No new URLs after multiple attempts, we've reached the end
          break;
        }
      } else {
        noChangeCount = 0;
        previousUrlCount = currentUrlCount;
      }

      // Scroll to bottom aggressively
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Shorter wait - Facebook loads content quickly
      await new Promise(resolve => setTimeout(resolve, 800));

      // Click "See more" buttons if they exist
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('div[role="button"], button');
        buttons.forEach(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('see more') || text.includes('show more') || text.includes('load more')) {
            (btn as HTMLElement).click();
          }
        });
      });

      // Every 10 scrolls, do an extra scroll burst to trigger more loading
      if (i % 10 === 0 && i > 0) {
        for (let j = 0; j < 3; j++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // Debug: save screenshot and HTML
    if (debug) {
      await page.screenshot({ path: '/tmp/ad-library-debug.png', fullPage: true });
      const html = await page.content();
      const fs = await import('fs');
      fs.writeFileSync('/tmp/ad-library-debug.html', html);
      console.log('Debug files saved to /tmp/ad-library-debug.png and /tmp/ad-library-debug.html');
    }

    // Also try to extract URLs directly from the DOM
    const domUrls = await page.evaluate(() => {
      const urls: string[] = [];
      const internalDomains = [
        'facebook.com', 'fb.com', 'instagram.com', 'meta.com',
        'fbcdn.net', 'fbsbx.com'
      ];

      // Look for all links
      document.querySelectorAll('a[href]').forEach(link => {
        let href = link.getAttribute('href') || '';

        // Decode Facebook redirect URLs
        if (href.includes('l.facebook.com/l.php') || href.includes('?u=')) {
          const match = href.match(/[?&]u=([^&]+)/);
          if (match) {
            href = decodeURIComponent(match[1]);
          }
        }

        if (!href.startsWith('http')) return;

        try {
          const parsed = new URL(href);
          const isInternal = internalDomains.some(d => parsed.hostname.includes(d));
          if (!isInternal) {
            urls.push(href);
          }
        } catch {
          // Invalid URL
        }
      });

      // Also look for URLs in data attributes
      document.querySelectorAll('[data-link-url], [data-href], [data-url]').forEach(el => {
        const url = el.getAttribute('data-link-url') ||
                    el.getAttribute('data-href') ||
                    el.getAttribute('data-url');
        if (url && url.startsWith('http')) {
          urls.push(url);
        }
      });

      return urls;
    });

    domUrls.forEach(url => {
      if (isExternalUrl(url)) {
        addUrl(url);
      }
    });

    // Convert collected URLs to AdData format with counts and ad library links
    const ads: AdData[] = Array.from(urlCounts.entries())
      .map(([url, count], index) => {
        const adIds = urlToAdIds.get(url);
        const adLibraryLinks = adIds
          ? Array.from(adIds).map(id => `https://www.facebook.com/ads/library/?id=${id}`)
          : [];

        return {
          adId: `ad-${index + 1}`,
          adArchiveId: adIds?.size ? Array.from(adIds)[0] : null,
          destinationUrl: url,
          linkText: null,
          startedRunning: null,
          adCount: count,
          adLibraryLinks,
        };
      })
      .sort((a, b) => b.adCount - a.adCount); // Sort by count descending

    // Scrape demographics if requested
    if (options?.scrapeDemographics) {
      const maxAds = options.maxDemographicAds || 3; // Default to 3 for faster execution on serverless

      // Convert ads to AdWithMetrics for selection
      const adsWithMetrics: AdWithMetrics[] = ads.map(ad => ({
        adArchiveId: ad.adArchiveId || '',
        destinationUrl: ad.destinationUrl,
        startedRunning: ad.startedRunning,
        adCount: ad.adCount,
        // Note: reach data would come from API responses if available
        // For now, we use adCount as a proxy (more ads = more reach typically)
      }));

      // Select top performers (RELY-04)
      const topPerformers = selectTopPerformers(adsWithMetrics, maxAds);

      if (debug) {
        console.log(`[demographics] Selected ${topPerformers.length} top performers for analysis`);
      }

      // Scrape demographics for top performers
      let demographicsScraped = 0;
      let demographicsFailed = 0;
      const adDemographicsMap: Map<string, AdDemographics> = new Map();

      for (const performer of topPerformers) {
        if (!performer.adArchiveId) continue;

        try {
          // Add short delay between requests (reduced for serverless timeout constraints)
          const delay = 500 + Math.random() * 500; // 0.5-1 second
          await new Promise(resolve => setTimeout(resolve, delay));

          const demographics = await scrapeAdDemographics(page, performer.adArchiveId, debug);

          if (demographics) {
            adDemographicsMap.set(performer.adArchiveId, demographics);
            demographicsScraped++;
            if (debug) {
              console.log(`[demographics] Extracted data for ad ${performer.adArchiveId}`);
            }
          } else {
            demographicsFailed++;
            if (debug) {
              console.log(`[demographics] No data for ad ${performer.adArchiveId}`);
            }
          }
        } catch (error) {
          demographicsFailed++;
          console.warn(`[demographics] Error scraping ad ${performer.adArchiveId}:`, error);
          // Continue with next ad (RELY-02)
        }
      }

      // Build extended result
      const extendedAds: AdDataWithDemographics[] = ads.map(ad => ({
        ...ad,
        demographics: ad.adArchiveId ? (adDemographicsMap.get(ad.adArchiveId) || null) : null,
      }));

      // Aggregate demographics (EXTR-04)
      const aggregatedDemographicsResult = aggregateDemographics(extendedAds);

      await browser.close();
      browser = null;

      return {
        success: true,
        pageId,
        pageName,
        ads: extendedAds,
        totalAdsFound: extendedAds.length,
        totalActiveAdsOnPage,
        demographicsScraped,
        demographicsFailed,
        topPerformersAnalyzed: topPerformers.length,
        aggregatedDemographics: aggregatedDemographicsResult,
      } as AdLibraryResultWithDemographics;
    }

    // Default: no demographics, return original format
    await browser.close();
    browser = null;

    return {
      success: true,
      pageId,
      pageName,
      ads,
      totalAdsFound: ads.length,
      totalActiveAdsOnPage,
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    const message = error instanceof Error ? error.message : 'Failed to scrape Ad Library';
    return {
      success: false,
      error: message,
    };
  }
}
