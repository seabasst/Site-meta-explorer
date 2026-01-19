export interface SitemapURL {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export interface SitemapResult {
  urls: SitemapURL[];
  sitemapUrl: string;
  childSitemaps?: string[];
}

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemap/sitemap.xml',
  '/sitemaps/sitemap.xml',
];

export async function fetchSitemap(baseUrl: string): Promise<SitemapResult> {
  // Normalize the base URL
  const url = new URL(baseUrl);
  const origin = url.origin;

  // Try common sitemap paths
  for (const path of SITEMAP_PATHS) {
    const sitemapUrl = `${origin}${path}`;
    try {
      const result = await fetchAndParseSitemap(sitemapUrl);
      if (result.urls.length > 0 || (result.childSitemaps && result.childSitemaps.length > 0)) {
        return result;
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error(`No sitemap found for ${origin}. Tried: ${SITEMAP_PATHS.join(', ')}`);
}

async function fetchAndParseSitemap(sitemapUrl: string): Promise<SitemapResult> {
  const response = await fetch(sitemapUrl, {
    headers: {
      'User-Agent': 'SitemapAnalyzer/1.0',
      'Accept': 'application/xml, text/xml, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  return parseSitemapXML(xml, sitemapUrl);
}

function parseSitemapXML(xml: string, sitemapUrl: string): SitemapResult {
  const urls: SitemapURL[] = [];
  const childSitemaps: string[] = [];

  // Check if this is a sitemap index
  if (xml.includes('<sitemapindex') || xml.includes('<sitemap>')) {
    // Extract child sitemap URLs
    const sitemapMatches = xml.matchAll(/<sitemap[^>]*>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi);
    for (const match of sitemapMatches) {
      const loc = match[1].trim();
      if (loc) {
        childSitemaps.push(loc);
      }
    }
  }

  // Extract URL entries
  const urlMatches = xml.matchAll(/<url[^>]*>([\s\S]*?)<\/url>/gi);
  for (const match of urlMatches) {
    const urlContent = match[1];
    const url = extractSitemapURL(urlContent);
    if (url) {
      urls.push(url);
    }
  }

  return {
    urls,
    sitemapUrl,
    childSitemaps: childSitemaps.length > 0 ? childSitemaps : undefined,
  };
}

function extractSitemapURL(urlContent: string): SitemapURL | null {
  const locMatch = urlContent.match(/<loc>([^<]+)<\/loc>/i);
  if (!locMatch) return null;

  const url: SitemapURL = {
    loc: locMatch[1].trim(),
  };

  const lastmodMatch = urlContent.match(/<lastmod>([^<]+)<\/lastmod>/i);
  if (lastmodMatch) {
    url.lastmod = lastmodMatch[1].trim();
  }

  const changefreqMatch = urlContent.match(/<changefreq>([^<]+)<\/changefreq>/i);
  if (changefreqMatch) {
    url.changefreq = changefreqMatch[1].trim();
  }

  const priorityMatch = urlContent.match(/<priority>([^<]+)<\/priority>/i);
  if (priorityMatch) {
    url.priority = priorityMatch[1].trim();
  }

  return url;
}

export async function fetchAllSitemapURLs(baseUrl: string): Promise<SitemapURL[]> {
  const result = await fetchSitemap(baseUrl);
  const allUrls: SitemapURL[] = [...result.urls];

  // If there are child sitemaps, fetch them too
  if (result.childSitemaps && result.childSitemaps.length > 0) {
    const childResults = await Promise.allSettled(
      result.childSitemaps.map(async (childUrl) => {
        try {
          const childResult = await fetchAndParseSitemap(childUrl);
          return childResult.urls;
        } catch {
          return [];
        }
      })
    );

    for (const childResult of childResults) {
      if (childResult.status === 'fulfilled') {
        allUrls.push(...childResult.value);
      }
    }
  }

  return allUrls;
}
