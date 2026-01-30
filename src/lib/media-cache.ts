import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { extractMediaFromSnapshot } from './media-extractor';

const CACHE_DIR = path.join(process.cwd(), '.media-cache');
const INDEX_FILE = path.join(CACHE_DIR, '_index.json');

interface CacheEntry {
  uuid: string;
  filePath: string;
  contentType: string;
  mediaType: 'image' | 'video';
  adId: string;
}

// In-memory index, loaded once from disk
let memoryIndex: Map<string, CacheEntry> | null = null;
// Dedup in-flight resolutions
const inflightResolves = new Map<string, Promise<CacheEntry | null>>();

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function loadIndex(): Promise<Map<string, CacheEntry>> {
  if (memoryIndex) return memoryIndex;

  await ensureCacheDir();

  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf-8');
    const entries: Record<string, CacheEntry> = JSON.parse(raw);
    memoryIndex = new Map(Object.entries(entries));
  } catch {
    memoryIndex = new Map();
  }

  return memoryIndex;
}

async function saveIndex(): Promise<void> {
  if (!memoryIndex) return;
  const obj: Record<string, CacheEntry> = {};
  for (const [key, val] of memoryIndex) {
    obj[key] = val;
  }
  await fs.writeFile(INDEX_FILE, JSON.stringify(obj, null, 2));
}

function extensionFromContentType(ct: string): string {
  if (ct.includes('video/mp4')) return '.mp4';
  if (ct.includes('video/webm')) return '.webm';
  if (ct.includes('video')) return '.mp4';
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/gif')) return '.gif';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/svg')) return '.svg';
  return '.jpg';
}

async function downloadMedia(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuf = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuf), contentType };
  } catch {
    return null;
  }
}

export async function getOrCacheMedia(
  adId: string,
  snapshotUrl: string,
): Promise<CacheEntry | null> {
  const index = await loadIndex();

  // Already cached
  const existing = index.get(adId);
  if (existing) {
    try {
      await fs.access(existing.filePath);
      return existing;
    } catch {
      index.delete(adId);
    }
  }

  // Dedup concurrent requests for same adId
  if (inflightResolves.has(adId)) {
    return inflightResolves.get(adId)!;
  }

  const promise = (async (): Promise<CacheEntry | null> => {
    try {
      const extracted = await extractMediaFromSnapshot(snapshotUrl);
      if (!extracted) return null;

      const downloaded = await downloadMedia(extracted.url);
      if (!downloaded) return null;

      const uuid = randomUUID();
      const ext = extensionFromContentType(downloaded.contentType);
      const filePath = path.join(CACHE_DIR, `${uuid}${ext}`);

      await ensureCacheDir();
      await fs.writeFile(filePath, downloaded.buffer);

      const entry: CacheEntry = {
        uuid,
        filePath,
        contentType: downloaded.contentType,
        mediaType: extracted.type,
        adId,
      };

      index.set(adId, entry);
      await saveIndex();

      return entry;
    } catch {
      return null;
    } finally {
      inflightResolves.delete(adId);
    }
  })();

  inflightResolves.set(adId, promise);
  return promise;
}

export async function getMediaByUuid(
  uuid: string,
): Promise<{ filePath: string; contentType: string } | null> {
  const index = await loadIndex();

  for (const entry of index.values()) {
    if (entry.uuid === uuid) {
      try {
        await fs.access(entry.filePath);
        return { filePath: entry.filePath, contentType: entry.contentType };
      } catch {
        return null;
      }
    }
  }

  return null;
}
