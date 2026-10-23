// TikTok Commercial Content API (EU ad library).
//
// TikTok business and ad ids live in the same unique columns as Meta's
// (AdLibraryBrand.pageId, AdLibraryAd.adId). Both are numeric, so TikTok's carry a
// prefix: the columns stay unique without a compound key, and the 88 files that
// look brands up by pageId keep working unchanged.
export const TIKTOK_ID_PREFIX = 'tiktok-';

export const toTikTokId = (id: string | number) => `${TIKTOK_ID_PREFIX}${id}`;

export const isTikTokId = (id: string) => id.startsWith(TIKTOK_ID_PREFIX);
