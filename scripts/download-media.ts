/**
 * Download top ads media (images/videos) directly from Facebook CDN to R2
 * No Puppeteer - uses direct fetch of snapshot JSON
 * Run with: npx tsx scripts/download-media.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from '../src/lib/prisma';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ad-assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

const TOP_ADS_PER_BRAND = 10;
const CONCURRENT_DOWNLOADS = 5;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second

interface MediaUrl {
  url: string;
  type: 'image' | 'video';
}

interface ExtractionResult {
  mediaUrls: MediaUrl[];
  isVideoAd: boolean;
}

async function checkObjectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

async function extractMediaUrls(snapshotUrl: string): Promise<ExtractionResult> {
  const mediaUrls: MediaUrl[] = [];
  let isVideoAd = false;

  try {
    // Facebook snapshot URLs can be fetched directly to get JSON with media
    const response = await fetch(snapshotUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return { mediaUrls, isVideoAd };
    }

    const html = await response.text();

    // Detect if this is a video ad based on HTML indicators
    // These are Facebook video player modules that only appear for video ads
    const videoIndicators = [
      'VideoPlayer',
      'VideoPlayerHTML5',
      'oz_www_video_',
      'video_player',
      '"__typename":"Video"',
      'playable_url',
      'video_url',
      'OzVideoPlayer',
    ];

    isVideoAd = videoIndicators.some(indicator => html.includes(indicator));

    // Extract image URLs from the snapshot page
    // Facebook embeds media URLs in various formats

    // Pattern 1: Direct CDN image URLs
    const imagePatterns = [
      /https:\/\/scontent[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/external[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/[^"'\s]*fbcdn[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    ];

    for (const pattern of imagePatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const url of matches) {
          // Clean up escaped URLs
          const cleanUrl = url.replace(/\\u0026/g, '&').replace(/\\/g, '');
          if (!mediaUrls.some(m => m.url === cleanUrl)) {
            mediaUrls.push({ url: cleanUrl, type: 'image' });
          }
        }
      }
    }

    // Pattern 2: Video URLs - multiple patterns for different Facebook formats
    const videoPatterns = [
      // Direct video CDN URLs
      /https:\/\/video[^"'\s\\]+\.mp4[^"'\s\\]*/gi,
      /https:\/\/[^"'\s\\]*fbcdn[^"'\s\\]*\.mp4[^"'\s\\]*/gi,
      /https:\/\/[^"'\s\\]*fbcdn[^"'\s\\]*video[^"'\s\\]*/gi,
      // Video URLs in JSON
      /"video_hd_url"\s*:\s*"([^"]+)"/gi,
      /"video_sd_url"\s*:\s*"([^"]+)"/gi,
      /"playable_url"\s*:\s*"([^"]+)"/gi,
      /"playable_url_quality_hd"\s*:\s*"([^"]+)"/gi,
      /"browser_native_hd_url"\s*:\s*"([^"]+)"/gi,
      /"browser_native_sd_url"\s*:\s*"([^"]+)"/gi,
      // Encoded video URLs
      /src\\u003d\\u0022(https[^\\]+video[^\\]+)\\u0022/gi,
      /video_url['":\s]+['"]?(https[^'"\\]+\.mp4[^'"\\]*)/gi,
    ];

    for (const pattern of videoPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let url = match[1] || match[0];
        // Decode Unicode escapes
        url = url.replace(/\\u003d/g, '=')
                 .replace(/\\u0026/g, '&')
                 .replace(/\\u0022/g, '"')
                 .replace(/\\u002F/g, '/')
                 .replace(/\\\//g, '/')
                 .replace(/\\/g, '');
        if (url.includes('http') && !mediaUrls.some(m => m.url === url)) {
          mediaUrls.push({ url, type: 'video' });
        }
      }
    }

    // Also try to find video data in JSON blobs
    const jsonPatterns = [
      /\{"__typename":"Video"[^}]+}/g,
      /data-store=["']([^"']+video[^"']+)["']/gi,
    ];

    for (const pattern of jsonPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        try {
          const decoded = match[1] || match[0];
          const unescaped = decoded
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/\\u0026/g, '&');
          // Look for URLs in the decoded content
          const urlMatch = unescaped.match(/https:\/\/[^"'\s]+\.mp4[^"'\s]*/);
          if (urlMatch && !mediaUrls.some(m => m.url === urlMatch[0])) {
            mediaUrls.push({ url: urlMatch[0], type: 'video' });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Deduplicate and filter
    const uniqueUrls = new Map<string, MediaUrl>();

    // Separate videos and images
    const videos: MediaUrl[] = [];
    const images: MediaUrl[] = [];

    for (const media of mediaUrls) {
      // Skip duplicates
      if (uniqueUrls.has(media.url)) continue;

      if (media.type === 'video') {
        // Skip very short URLs (likely invalid)
        if (media.url.length > 50) {
          videos.push(media);
          uniqueUrls.set(media.url, media);
        }
      } else if (media.type === 'image') {
        // Skip tiny images (profile pics, icons)
        if (media.url.includes('/s32x32/') ||
            media.url.includes('/s64x64/') ||
            media.url.includes('/t51.2885-1/') ||
            media.url.includes('/p50x50/') ||
            media.url.includes('emoji')) {
          continue;
        }
        images.push(media);
        uniqueUrls.set(media.url, media);
      }
    }

    // Prioritize: videos first, then largest images
    // Sort images by likely size (prefer those without small dimension markers)
    const sortedImages = images.sort((a, b) => {
      const aHasSize = a.url.includes('/p') || a.url.includes('/s');
      const bHasSize = b.url.includes('/p') || b.url.includes('/s');
      if (aHasSize && !bHasSize) return 1;
      if (!aHasSize && bHasSize) return -1;
      return b.url.length - a.url.length; // Longer URLs often have more params = higher quality
    });

    // Return videos first (max 2), then images (up to 5 total)
    const result = [...videos.slice(0, 2), ...sortedImages].slice(0, 5);

    if (videos.length > 0 || isVideoAd) {
      console.log(`    Video ad detected: ${isVideoAd}, found ${videos.length} video URL(s), ${images.length} image(s)`);
    }

    return { mediaUrls: result, isVideoAd };

  } catch (error) {
    console.error(`  Failed to extract media from snapshot:`, error instanceof Error ? error.message : error);
    return { mediaUrls, isVideoAd };
  }
}

async function downloadMedia(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  } catch {
    return null;
  }
}

async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<boolean> {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return true;
  } catch (error) {
    console.error(`  Failed to upload ${key}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

function getExtension(contentType: string, url: string): string {
  if (contentType.includes('video')) return 'mp4';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (url.includes('.png')) return 'png';
  if (url.includes('.webp')) return 'webp';
  if (url.includes('.mp4')) return 'mp4';
  return 'jpg';
}

async function processAd(ad: {
  id: string;
  adId: string;
  snapshotUrl: string;
  brandId: string;
  currentFormat: string | null;
}): Promise<{ downloaded: number; failed: number; isVideo: boolean }> {
  let downloaded = 0;
  let failed = 0;

  // Extract media URLs from snapshot
  const { mediaUrls, isVideoAd } = await extractMediaUrls(ad.snapshotUrl);

  // Update the ad's display format if it's detected as a video but currently marked as image
  if (isVideoAd && ad.currentFormat === 'image') {
    await prisma.adLibraryAd.update({
      where: { id: ad.id },
      data: { displayFormat: 'video' },
    });
    console.log(`    ✓ Updated display format to 'video' for ad ${ad.adId}`);
  }

  if (mediaUrls.length === 0) {
    return { downloaded: 0, failed: 1, isVideo: isVideoAd };
  }

  for (let i = 0; i < mediaUrls.length; i++) {
    const media = mediaUrls[i];
    const ext = media.type === 'video' ? 'mp4' : 'jpg';
    const storedKey = `ads/${ad.brandId}/${ad.adId}-${i}.${ext}`;

    // Check if already exists
    if (await checkObjectExists(storedKey)) {
      downloaded++;
      continue;
    }

    // Download media
    const result = await downloadMedia(media.url);
    if (!result) {
      failed++;
      continue;
    }

    // Upload to R2
    const actualExt = getExtension(result.contentType, media.url);
    const finalKey = `ads/${ad.brandId}/${ad.adId}-${i}.${actualExt}`;

    if (await uploadToR2(result.buffer, finalKey, result.contentType)) {
      // Update database
      const storedUrl = `${R2_PUBLIC_URL}/${finalKey}`;
      await prisma.adAsset.upsert({
        where: { id: `${ad.id}-${i}` },
        update: {
          storedKey: finalKey,
          storedUrl: storedUrl,
          downloadStatus: 'completed',
        },
        create: {
          id: `${ad.id}-${i}`,
          adId: ad.id,
          assetType: media.type,
          position: i,
          originalUrl: media.url,
          storedKey: finalKey,
          storedUrl: storedUrl,
          downloadStatus: 'completed',
        },
      });
      downloaded++;
    } else {
      failed++;
    }
  }

  return { downloaded, failed, isVideo: isVideoAd };
}

async function main() {
  console.log('Starting media download (no Puppeteer)...\n');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('R2 credentials not configured');
    process.exit(1);
  }

  // Get all brands that have ads (regardless of status)
  const brands = await prisma.adLibraryBrand.findMany({
    where: {
      ads: { some: {} } // Only brands with at least one ad
    },
    select: { id: true, pageName: true },
    orderBy: { pageName: 'asc' },
  });

  console.log(`Found ${brands.length} active brands\n`);

  let totalDownloaded = 0;
  let totalFailed = 0;
  let totalVideosDetected = 0;
  let brandsProcessed = 0;

  for (const brand of brands) {
    brandsProcessed++;
    console.log(`\n[${brandsProcessed}/${brands.length}] ${brand.pageName}`);

    // Get top 10 ads by reach
    const topAds = await prisma.adLibraryAd.findMany({
      where: {
        brandId: brand.id,
        snapshotUrl: { not: null },
      },
      orderBy: [
        { isActive: 'desc' },
        { reachEstimate: 'desc' },
      ],
      take: TOP_ADS_PER_BRAND,
      select: {
        id: true,
        adId: true,
        snapshotUrl: true,
        displayFormat: true,
      },
    });

    if (topAds.length === 0) {
      console.log('  No ads with snapshot URLs');
      continue;
    }

    console.log(`  Processing ${topAds.length} top ads...`);

    // Process ads in batches
    for (let i = 0; i < topAds.length; i += CONCURRENT_DOWNLOADS) {
      const batch = topAds.slice(i, i + CONCURRENT_DOWNLOADS);
      const results = await Promise.all(
        batch.map(ad => processAd({
          id: ad.id,
          adId: ad.adId,
          snapshotUrl: ad.snapshotUrl!,
          brandId: brand.id,
          currentFormat: ad.displayFormat,
        }))
      );

      for (const result of results) {
        totalDownloaded += result.downloaded;
        totalFailed += result.failed;
        if (result.isVideo) totalVideosDetected++;
      }

      // Rate limiting
      if (i + CONCURRENT_DOWNLOADS < topAds.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }

    console.log(`  Done: ${totalDownloaded} downloaded, ${totalFailed} failed`);
  }

  console.log(`\n✅ Complete!`);
  console.log(`Total downloaded: ${totalDownloaded}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Videos detected: ${totalVideosDetected}`);
  console.log(`R2 URL: ${R2_PUBLIC_URL}/ads/`);

  await prisma.$disconnect();
}

main().catch(console.error);
