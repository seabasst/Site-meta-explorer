/**
 * Organic Facebook post scraper for Swedish party pages.
 *
 * There is no official transparency API for organic (non-ad) content — unlike
 * ads, the EU DSA doesn't mandate a public repository for regular posts, so
 * there's no equivalent of Meta's ads_archive to call here. This uses the
 * Apify actor `thedoor/facebook-page-scraper`, which reads public page
 * timelines without login (no cookies/session risk to an authenticated
 * account), chosen after comparing several Facebook-scraping actors on the
 * Apify Store for output quality, price, and bulk-URL support.
 *
 * Usage:
 *   APIFY_TOKEN=... npx tsx scripts/scrape-organic-posts.ts
 *   APIFY_TOKEN=... npx tsx scripts/scrape-organic-posts.ts --limit 100   # cap pages processed this run
 *   APIFY_TOKEN=... npx tsx scripts/scrape-organic-posts.ts --force       # re-scrape pages already in the output file
 *
 * Resumable and idempotent: pages already present in the output file are
 * skipped (unless --force), and each batch is merged + written immediately,
 * so a run that dies partway (including hitting an Apify account spend cap —
 * confirmed to happen mid-run, see below) loses nothing already fetched.
 *
 * Cost: $0.0025 per post returned (thedoor/facebook-page-scraper's FREE-tier
 * price). Batches are capped at BATCH_SIZE pages × POSTS_PER_PAGE posts so a
 * single batch can't exceed ~$4.50 — Apify accounts carry their own monthly
 * spend ceiling (independent of any per-call cost cap this script sets) and
 * a batch that hits it aborts mid-run; this script treats that as a stop
 * signal, not a crash, and reports how far it got.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const PAGES_FILE = path.join(DATA_DIR, 'swedish-party-pages.json');
const OUT_FILE = path.join(DATA_DIR, 'swedish-party-organic-posts.json');

const ACTOR = 'thedoor~facebook-page-scraper'; // Apify REST API form of thedoor/facebook-page-scraper
const APIFY_API = 'https://api.apify.com/v2';
const STRICT_LEVELS = new Set(['national', 'youth', 'branch', 'affiliate']);

const BATCH_SIZE = 45;       // pages per Apify run — keeps a full-cap batch under ~$4.50
const POSTS_PER_PAGE = 40;   // per-page cap. A deliberate scope cut, not full history:
                             // ponytail — 40 posts/page/12mo covers typical cadence (the
                             // validated batch averaged ~33/page) but will truncate a
                             // handful of unusually prolific pages. Raise if completeness
                             // matters more than cost.
const POLL_INTERVAL_MS = 8000;
const MAX_POLL_MS = 10 * 60 * 1000;

const token = process.env.APIFY_TOKEN;

interface OrganicPost {
  pageId: string | null;
  pageName: string | null;
  postId: string | null;
  postUrl: string | null;
  postType: string | null;
  text: string | null;
  createdAt: string | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function windowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}

function readOutput(): OrganicPost[] {
  if (!fs.existsSync(OUT_FILE)) return [];
  return JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')).posts ?? [];
}

function writeOutput(posts: OrganicPost[]) {
  const byPage = new Map<string, number>();
  for (const p of posts) byPage.set(p.pageId, (byPage.get(p.pageId) ?? 0) + 1);
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    scrapedAt: new Date().toISOString(),
    source: 'apify:thedoor/facebook-page-scraper',
    pagesCovered: byPage.size,
    totalPosts: posts.length,
    posts,
  }, null, 1));
}

// The actor's own `page.id` does NOT reliably match the pageId we requested by
// (facebook.com/<pageId>) — Facebook page-ID migrations mean a page can have an
// old and new numeric ID both resolving to it, and the actor returns whichever
// one its own lookup surfaces. Verified live: joining 60 pages by `page.id`
// silently misattributed every post to the wrong party. `metadata.page_index`
// (1-indexed position in the request array) is what's reliable — join through
// that back to our own pageUrls array instead, never through page.id.
async function runBatch(pageIds: string[], postsNewerThan: string): Promise<{ posts: OrganicPost[]; hitAccountLimit: boolean }> {
  const pageUrls = pageIds.map((id) => `https://www.facebook.com/${id}`);
  const startRes = await fetch(`${APIFY_API}/acts/${ACTOR}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pageUrls, postsToScrape: POSTS_PER_PAGE, postsNewerThan }),
  });
  const startBody = await startRes.json();
  if (!startRes.ok) {
    const msg = startBody?.error?.message ?? JSON.stringify(startBody);
    if (/usage|limit/i.test(msg)) return { posts: [], hitAccountLimit: true };
    throw new Error(`Apify run start failed: ${msg}`);
  }
  const runId = startBody.data.id;
  const t0 = Date.now();
  let status = startBody.data.status;
  let datasetId = startBody.data.defaultDatasetId;

  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
    if (Date.now() - t0 > MAX_POLL_MS) break;
    await sleep(POLL_INTERVAL_MS);
    const r = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${token}`);
    const body = await r.json();
    status = body.data.status;
    datasetId = body.data.defaultDatasetId;
    if (status === 'ABORTED' && /cost|usage/i.test(body.data.statusMessage ?? '')) {
      console.log(`    ⚠️ run aborted: ${body.data.statusMessage}`);
    }
  }

  interface RawItem {
    page?: { name?: string };
    post?: { id?: string; url?: string; type?: string; text?: string };
    created?: { time?: string };
    engagement?: { reactions?: number; comments?: number; shares?: number };
    metadata?: { page_index?: number };
  }
  const itemsRes = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${token}&clean=true&fields=page.name,post.id,post.url,post.type,post.text,created.time,engagement.reactions,engagement.comments,engagement.shares,metadata.page_index`);
  const items: RawItem[] = await itemsRes.json();
  const posts: OrganicPost[] = items.map((it) => {
    const idx = it.metadata?.page_index;
    return {
      pageId: idx && idx - 1 >= 0 && idx - 1 < pageIds.length ? pageIds[idx - 1] : null,
      pageName: it.page?.name ?? null,
      postId: it.post?.id ?? null,
      postUrl: it.post?.url ?? null,
      postType: it.post?.type ?? null,
      text: it.post?.text ?? null,
      createdAt: it.created?.time ?? null,
      reactions: it.engagement?.reactions ?? null,
      comments: it.engagement?.comments ?? null,
      shares: it.engagement?.shares ?? null,
    };
  });

  const hitAccountLimit = status === 'ABORTED';
  return { posts, hitAccountLimit };
}

async function main() {
  if (!token) {
    console.error('No APIFY_TOKEN in env. Get one from https://console.apify.com/settings/integrations and run:');
    console.error('  APIFY_TOKEN=apify_api_xxx npx tsx scripts/scrape-organic-posts.ts');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Number(limitArg) : undefined;

  const pages: Array<{ pageId: string; level: string }> = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8')).pages;
  const strictPages = pages.filter((p) => STRICT_LEVELS.has(p.level));

  const existing = readOutput();
  const doneIds = force ? new Set<string>() : new Set(existing.map((p) => p.pageId));
  const todo = strictPages.filter((p) => !doneIds.has(p.pageId));
  const batch = limit ? todo.slice(0, limit) : todo;

  console.log(`${strictPages.length} strict party pages · ${existing.length ? new Set(existing.map((p) => p.pageId)).size : 0} already scraped · ${batch.length} to do this run`);
  if (batch.length === 0) { console.log('Nothing to do.'); return; }

  const dateMin = windowStart();
  let all = existing;
  let processed = 0;

  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    console.log(`\n[batch ${Math.floor(i / BATCH_SIZE) + 1}] ${chunk.length} pages...`);

    const { posts, hitAccountLimit } = await runBatch(chunk.map((p) => p.pageId), dateMin);
    all = all.concat(posts);
    writeOutput(all); // persist after every batch — a later failure loses nothing fetched so far
    processed += chunk.length;

    const coveredThisBatch = new Set(posts.map((p) => p.pageId)).size;
    console.log(`  → ${posts.length} posts across ${coveredThisBatch}/${chunk.length} pages (${all.length} posts total, ${new Set(all.map((p) => p.pageId)).size} pages so far)`);

    if (hitAccountLimit) {
      console.log(`\n⚠️ Apify account spend/usage limit reached. Stopped after ${processed}/${batch.length} pages this run.`);
      console.log('Re-run this script (same command) once the limit resets or is raised — already-covered pages are skipped automatically.');
      break;
    }
  }

  console.log(`\n✓ ${all.length} organic posts across ${new Set(all.map((p) => p.pageId)).size} pages → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
