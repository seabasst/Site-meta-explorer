/**
 * Facebook Page ID Fetcher
 *
 * This script fetches Facebook Page IDs for brands/organizations and updates
 * the database with precise Ad Library URLs.
 *
 * Two approaches available:
 * 1. Graph API (recommended) - requires Facebook Developer account
 * 2. Scraping fallback - no auth needed but slower and less reliable
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// ============================================================================
// CONFIGURATION
// ============================================================================

// Facebook Graph API token (loaded from .env or .env.local)
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || '';

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second between requests
const MAX_RETRIES = 3;

// ============================================================================
// GRAPH API APPROACH (Recommended)
// ============================================================================

/**
 * Search for a Facebook Page using the Graph API
 * @param {string} query - Brand/organization name
 * @param {string} website - Website URL for verification
 * @returns {Promise<{pageId: string, pageName: string} | null>}
 */
async function searchPageViaGraphAPI(query, website) {
  if (!FACEBOOK_ACCESS_TOKEN) {
    console.warn('No Facebook access token provided. Set FACEBOOK_ACCESS_TOKEN env var.');
    return null;
  }

  const searchUrl = new URL('https://graph.facebook.com/v18.0/pages/search');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('fields', 'id,name,website,link,verification_status');
  searchUrl.searchParams.set('access_token', FACEBOOK_ACCESS_TOKEN);

  try {
    const response = await fetch(searchUrl.toString());
    const data = await response.json();

    if (data.error) {
      console.error(`Graph API error for "${query}":`, data.error.message);
      return null;
    }

    if (!data.data || data.data.length === 0) {
      console.log(`No pages found for "${query}"`);
      return null;
    }

    // Try to match by website domain
    const websiteDomain = extractDomain(website);

    for (const page of data.data) {
      // Check if website matches
      if (page.website && extractDomain(page.website) === websiteDomain) {
        return { pageId: page.id, pageName: page.name };
      }

      // Check if name is close match
      if (page.name.toLowerCase().includes(query.toLowerCase()) ||
          query.toLowerCase().includes(page.name.toLowerCase())) {
        return { pageId: page.id, pageName: page.name };
      }
    }

    // Return first result as fallback
    return { pageId: data.data[0].id, pageName: data.data[0].name };

  } catch (error) {
    console.error(`Error searching for "${query}":`, error.message);
    return null;
  }
}

// ============================================================================
// AD LIBRARY SCRAPING APPROACH (Fallback - no auth needed)
// ============================================================================

/**
 * Search Ad Library and extract Page ID from results
 * This is a fallback method that doesn't require API access
 * @param {string} query - Brand/organization name
 * @returns {Promise<{pageId: string, pageName: string} | null>}
 */
async function searchPageViaAdLibrary(query) {
  const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(query)}&search_type=keyword_unordered`;

  console.log(`  Searching Ad Library for: ${query}`);

  // Note: This would require a headless browser (Puppeteer/Playwright)
  // because the Ad Library uses client-side rendering

  // Example with Puppeteer:
  /*
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(searchUrl, { waitUntil: 'networkidle2' });

  // Wait for results to load
  await page.waitForSelector('[data-testid="ad_library_advertiser_card"]', { timeout: 10000 });

  // Extract the first advertiser's page ID
  const pageId = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="ad_library_advertiser_card"]');
    if (!card) return null;

    // The page ID is often in the "See ads" link
    const link = card.querySelector('a[href*="view_all_page_id"]');
    if (link) {
      const match = link.href.match(/view_all_page_id=(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  });

  await browser.close();
  return pageId ? { pageId, pageName: query } : null;
  */

  return null; // Placeholder - implement with Puppeteer if needed
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Build precise Ad Library URL with page ID
 */
function buildAdLibraryUrl(pageId) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${pageId}&search_type=page&media_type=all`;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/**
 * Process a database file and update with Facebook Page IDs
 * @param {string} inputFile - Path to JSON database
 * @param {string} outputFile - Path for updated database
 */
async function processDatabase(inputFile, outputFile) {
  console.log(`\nProcessing: ${inputFile}`);

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const items = data.brands || data.universities || [];

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] ${item.name}`);

    // Try Graph API first
    let result = await searchPageViaGraphAPI(item.name, item.website);

    // Fallback to Ad Library scraping if needed
    if (!result) {
      result = await searchPageViaAdLibrary(item.name);
    }

    if (result) {
      item.facebook_page_id = result.pageId;
      item.facebook_page_name = result.pageName;
      item.facebook_ad_library = buildAdLibraryUrl(result.pageId);
      console.log(`  ✓ Found: ${result.pageName} (ID: ${result.pageId})`);
      updated++;
    } else {
      console.log(`  ✗ Not found, keeping keyword search URL`);
      failed++;
    }

    // Rate limiting
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  // Save updated database
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${updated} updated, ${failed} failed`);
  console.log(`Output saved to: ${outputFile}`);
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Facebook Page ID Fetcher
========================

Usage:
  node fetch-facebook-page-ids.js <input.json> [output.json]

Token:
  Automatically loads FACEBOOK_ACCESS_TOKEN from .env or .env.local

Examples:
  # Process D2C brands database
  node fetch-facebook-page-ids.js ../european-d2c-brands.json

  # Process universities database
  node fetch-facebook-page-ids.js ../european-universities.json

  # Custom output file
  node fetch-facebook-page-ids.js ../european-d2c-brands.json ../output.json
    `);

    // Show token status
    if (FACEBOOK_ACCESS_TOKEN) {
      console.log(`✓ Facebook token loaded (${FACEBOOK_ACCESS_TOKEN.slice(0, 10)}...)\n`);
    } else {
      console.log(`✗ No Facebook token found. Add FACEBOOK_ACCESS_TOKEN to .env\n`);
    }
    return;
  }

  const inputFile = path.resolve(args[0]);
  const outputFile = args[1] ? path.resolve(args[1]) : inputFile.replace('.json', '-with-page-ids.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  await processDatabase(inputFile, outputFile);
}

main().catch(console.error);
