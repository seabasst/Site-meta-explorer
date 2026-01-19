import { SitemapURL } from './sitemap-parser';

export type URLCategory =
  | 'landing'
  | 'product'
  | 'collection'
  | 'blog'
  | 'account'
  | 'cart'
  | 'other';

export interface ClassifiedURL extends SitemapURL {
  category: URLCategory;
  path: string;
}

export interface ClassificationResult {
  urls: ClassifiedURL[];
  summary: Record<URLCategory, number>;
  landingPages: ClassifiedURL[];
}

// Patterns that indicate landing pages
const LANDING_PATTERNS = [
  /^\/pages\//i,
  /^\/landing\//i,
  /^\/lp\//i,
  /^\/promo\//i,
  /^\/campaign\//i,
  /^\/offer\//i,
  /^\/special\//i,
];

// Patterns to exclude from landing pages
const EXCLUDE_PATTERNS = [
  /^\/products?\//i,
  /^\/collections?\//i,
  /^\/cart/i,
  /^\/checkout/i,
  /^\/account/i,
  /^\/blogs?\//i,
  /^\/articles?\//i,
  /^\/search/i,
  /^\/api\//i,
  /^\/admin/i,
  /^\/login/i,
  /^\/register/i,
  /^\/signup/i,
  /^\/signin/i,
  /^\/password/i,
  /^\/reset/i,
  /^\/orders?\//i,
  /^\/wishlist/i,
  /^\/favorites/i,
  /^\/compare/i,
  /^\/reviews?\//i,
  /^\/tags?\//i,
  /^\/categories?\//i,
  /^\/brands?\//i,
  /^\/vendors?\//i,
  /^\/sitemap/i,
  /^\/feed/i,
  /^\/rss/i,
];

// Root-level pages that are typically landing pages
const ROOT_LANDING_PAGES = [
  /^\/about/i,
  /^\/contact/i,
  /^\/faq/i,
  /^\/help/i,
  /^\/support/i,
  /^\/shipping/i,
  /^\/returns/i,
  /^\/privacy/i,
  /^\/terms/i,
  /^\/careers/i,
  /^\/jobs/i,
  /^\/press/i,
  /^\/media/i,
  /^\/partners/i,
  /^\/affiliate/i,
  /^\/wholesale/i,
  /^\/sustainability/i,
  /^\/story/i,
  /^\/our-story/i,
  /^\/mission/i,
  /^\/values/i,
  /^\/team/i,
  /^\/stores/i,
  /^\/locations/i,
  /^\/find-a-store/i,
  /^\/store-locator/i,
  /^\/gift-cards/i,
  /^\/rewards/i,
  /^\/loyalty/i,
  /^\/refer/i,
  /^\/referral/i,
  /^\/accessibility/i,
  /^\/size-guide/i,
  /^\/sizing/i,
  /^\/care/i,
  /^\/technology/i,
  /^\/materials/i,
  /^\/impact/i,
];

function getURLPath(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.pathname;
  } catch {
    // If URL parsing fails, try to extract path manually
    const match = urlString.match(/https?:\/\/[^\/]+(.*)$/);
    return match ? match[1] || '/' : '/';
  }
}

function hasQueryParams(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.search.length > 0;
  } catch {
    return urlString.includes('?');
  }
}

function classifyURL(sitemapUrl: SitemapURL): ClassifiedURL {
  const path = getURLPath(sitemapUrl.loc);

  // Check for product pages
  if (/^\/products?\//i.test(path)) {
    return { ...sitemapUrl, category: 'product', path };
  }

  // Check for collection/category pages
  if (/^\/collections?\//i.test(path) || /^\/categories?\//i.test(path)) {
    return { ...sitemapUrl, category: 'collection', path };
  }

  // Check for blog/article pages
  if (/^\/blogs?\//i.test(path) || /^\/articles?\//i.test(path)) {
    return { ...sitemapUrl, category: 'blog', path };
  }

  // Check for account-related pages
  if (/^\/account/i.test(path) || /^\/login/i.test(path) || /^\/register/i.test(path)) {
    return { ...sitemapUrl, category: 'account', path };
  }

  // Check for cart/checkout pages
  if (/^\/cart/i.test(path) || /^\/checkout/i.test(path)) {
    return { ...sitemapUrl, category: 'cart', path };
  }

  // Check if it's a landing page
  const isLandingPage = isLanding(path, sitemapUrl.loc);
  if (isLandingPage) {
    return { ...sitemapUrl, category: 'landing', path };
  }

  return { ...sitemapUrl, category: 'other', path };
}

function isLanding(path: string, fullUrl: string): boolean {
  // Exclude URLs with pagination query params
  if (hasQueryParams(fullUrl)) {
    return false;
  }

  // Check if matches any exclude pattern
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(path)) {
      return false;
    }
  }

  // Check if matches landing page patterns
  for (const pattern of LANDING_PATTERNS) {
    if (pattern.test(path)) {
      return true;
    }
  }

  // Check if it's a root-level landing page
  for (const pattern of ROOT_LANDING_PAGES) {
    if (pattern.test(path)) {
      return true;
    }
  }

  // Check for simple root-level paths (1-2 segments, no file extension)
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 2) {
    const lastSegment = segments[segments.length - 1] || '';
    // Exclude if it looks like a file
    if (!/\.(html?|php|aspx?|jsp)$/i.test(lastSegment)) {
      // Exclude if it looks like a product SKU or ID
      if (!/^[A-Z0-9]{5,}$/i.test(lastSegment) && !/^\d+$/.test(lastSegment)) {
        // This is likely a landing page
        return true;
      }
    }
  }

  return false;
}

export function classifyURLs(urls: SitemapURL[]): ClassificationResult {
  const classifiedUrls = urls.map(classifyURL);

  const summary: Record<URLCategory, number> = {
    landing: 0,
    product: 0,
    collection: 0,
    blog: 0,
    account: 0,
    cart: 0,
    other: 0,
  };

  for (const url of classifiedUrls) {
    summary[url.category]++;
  }

  const landingPages = classifiedUrls.filter((url) => url.category === 'landing');

  return {
    urls: classifiedUrls,
    summary,
    landingPages,
  };
}
