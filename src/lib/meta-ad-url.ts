// Public page for one ad in Meta's Ad Library. Safe to show anyone.
export const metaAdUrl = (adId: string) => `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adId)}`;

// Meta's ad_snapshot_url is a render_ad link that carries our access token, and that is what we store in
// AdLibraryAd.snapshotUrl. Never send one to a browser: swap it for the ad's public Ad Library page.
export function publicSnapshotUrl(url: string | null | undefined): string | null {
  const id = url?.match(/[?&]id=(\d+)/)?.[1];
  return id ? metaAdUrl(id) : null;
}
