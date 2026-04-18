import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic();

// ---------------------------------------------------------------------------
// SSRF protection: block private/reserved IP ranges and localhost
// ---------------------------------------------------------------------------
const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0'];

function isPrivateIP(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.includes(hostname)) return true;

  // Check IPv4 private ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 127.x.x.x
    if (a === 127) return true;
    // 10.x.x.x
    if (a === 10) return true;
    // 172.16.x.x - 172.31.x.x
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.x.x
    if (a === 192 && b === 168) return true;
    // 0.x.x.x
    if (a === 0) return true;
  }

  return false;
}

const requestSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((u) => u.startsWith('https://'), 'URL must use HTTPS'),
});

const nullResult = { voice: null, audience: null, differentiators: null };

// ---------------------------------------------------------------------------
// POST /api/creative-lab/scrape-brand
// Scrapes a brand's website and uses Claude to extract voice/audience/differentiators.
// Auto-fill convenience endpoint — never returns errors to the client.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(nullResult);
    }

    const { url } = parsed.data;

    // ----------------------------------------------------------------
    // 1. SSRF protection: validate hostname before fetching
    // ----------------------------------------------------------------
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json(nullResult);
    }

    if (isPrivateIP(parsedUrl.hostname)) {
      return Response.json(nullResult);
    }

    // ----------------------------------------------------------------
    // 2. Fetch the URL server-side with 5s timeout
    // ----------------------------------------------------------------
    let html: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; BrandScraper/1.0; +https://facebookadexplorer.kirimedia.co)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return Response.json(nullResult);
      }

      html = await res.text();
    } catch {
      return Response.json(nullResult);
    }

    // ----------------------------------------------------------------
    // 3. Extract Open Graph tags + meta description from HTML
    // ----------------------------------------------------------------
    const ogTitle = extractMeta(html, 'og:title');
    const ogDescription = extractMeta(html, 'og:description');
    const metaDescription = extractMetaName(html, 'description');

    // ----------------------------------------------------------------
    // 4. Use Claude Haiku to extract brand attributes from HTML
    // ----------------------------------------------------------------
    const trimmedHtml = html.slice(0, 10000);

    const prompt = `You are a brand analyst. Given this website's HTML, extract three things about this brand:

1. **Voice/Tone**: How does this brand communicate? (e.g., "Professional and authoritative", "Playful and casual", "Luxurious and aspirational"). 1-2 sentences max.
2. **Target Audience**: Who is this brand targeting? Be specific about demographics, interests, and psychographics. 1-2 sentences max.
3. **Key Differentiators**: What makes this brand unique vs competitors? What do they emphasize? 1-2 sentences max.

**Extracted metadata:**
- OG Title: ${ogTitle || 'Not found'}
- OG Description: ${ogDescription || 'Not found'}
- Meta Description: ${metaDescription || 'Not found'}

**HTML (first 10,000 chars):**
${trimmedHtml}

Respond with ONLY valid JSON in this exact format:
{
  "voice": "string or null if unclear",
  "audience": "string or null if unclear",
  "differentiators": "string or null if unclear"
}

No markdown, no explanation, ONLY JSON.`;

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const result = JSON.parse(cleanJson) as {
        voice: string | null;
        audience: string | null;
        differentiators: string | null;
      };

      return Response.json({
        voice: result.voice || null,
        audience: result.audience || null,
        differentiators: result.differentiators || null,
      });
    } catch {
      return Response.json(nullResult);
    }
  } catch {
    return Response.json(nullResult);
  }
}

// ---------------------------------------------------------------------------
// HTML meta tag extraction helpers
// ---------------------------------------------------------------------------

function extractMeta(html: string, property: string): string | null {
  // Match <meta property="og:..." content="...">
  const regex = new RegExp(
    `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];

  // Also try content before property (some sites reverse attribute order)
  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
    'i'
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

function extractMetaName(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
    'i'
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}
