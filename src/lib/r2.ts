import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g., https://assets.yourdomain.com

// Lazy initialization to avoid errors when env vars aren't set
let _r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!_r2Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
    }

    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _r2Client;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

/**
 * Upload a buffer to R2.
 * @param key - The object key (path in bucket)
 * @param buffer - The file contents
 * @param contentType - MIME type
 * @returns The stored URL and key
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable', // 1 year cache
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    size: buffer.length,
  };
}

/**
 * Download a file from R2.
 * @param key - The object key
 * @returns The file buffer and content type, or null if not found
 */
export async function downloadFromR2(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = getR2Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    if (!response.Body) return null;

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * Check if an object exists in R2.
 * @param key - The object key
 * @returns true if exists, false otherwise
 */
export async function existsInR2(key: string): Promise<boolean> {
  const client = getR2Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Delete an object from R2.
 * @param key - The object key
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Generate a storage key for an ad asset.
 * Format: ads/{brandId}/{adId}/{assetType}-{position}.{ext}
 */
export function generateAssetKey(
  brandId: string,
  adId: string,
  assetType: string,
  position: number,
  extension: string
): string {
  return `ads/${brandId}/${adId}/${assetType}-${position}${extension}`;
}

/**
 * Generate a storage key for an ad thumbnail.
 * Format: ads/{brandId}/{adId}/thumb-{position}.jpg
 */
export function generateThumbnailKey(
  brandId: string,
  adId: string,
  position: number
): string {
  return `ads/${brandId}/${adId}/thumb-${position}.jpg`;
}

/**
 * Get public URL for a key.
 */
export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Get file extension from content type.
 */
export function extensionFromContentType(contentType: string): string {
  if (contentType.includes('video/mp4')) return '.mp4';
  if (contentType.includes('video/webm')) return '.webm';
  if (contentType.includes('video/quicktime')) return '.mov';
  if (contentType.includes('video')) return '.mp4';
  if (contentType.includes('image/png')) return '.png';
  if (contentType.includes('image/gif')) return '.gif';
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('image/svg')) return '.svg';
  if (contentType.includes('image/jpeg')) return '.jpg';
  return '.jpg';
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}
