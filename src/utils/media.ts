/**
 * Helper to build CDN-cacheable media URLs for Immich assets relayed through our backend,
 * plus a non-blocking idle prefetcher for adjacent spots/days.
 *
 * Tiers:
 * - thumbnail: ~25 KB 250px WebP for instant placeholders, map/day lists, and hover cards
 * - grid:      ~50–70 KB 720px WebP for crisp 2x Retina display in the 2-column gallery
 * - preview:   ~150–190 KB 1440px WebP for full-width single-photo spots & Lightbox preview
 * - original:  full-resolution original file from Immich for Lightbox zoom / download
 */
export type MediaSize = 'thumbnail' | 'grid' | 'preview' | 'original';

export function getMediaUrl(assetId: string, size: MediaSize = 'preview'): string {
  if (!assetId) return '';
  if (assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.startsWith('/')) {
    return assetId;
  }
  const ext = size === 'original' ? 'jpg' : 'webp';
  return `/media/${size}/${assetId}.${ext}`;
}

const prefetchedUrls = new Set<string>();
const decodedUrls = new Set<string>();
const pendingQueue: string[] = [];
let activePrefetches = 0;
let idleTimer: number | null = null;
const MAX_CONCURRENT_PREFETCH = 2;

export function isMediaDecoded(url: string): boolean {
  return !!url && decodedUrls.has(url);
}

export function markMediaDecoded(url: string): void {
  if (url) decodedUrls.add(url);
}

function pumpPrefetchQueue() {
  while (activePrefetches < MAX_CONCURRENT_PREFETCH && pendingQueue.length > 0) {
    const nextUrl = pendingQueue.shift();
    if (!nextUrl || prefetchedUrls.has(nextUrl)) continue;

    prefetchedUrls.add(nextUrl);
    activePrefetches++;

    const img = new Image();
    img.decoding = 'async';
    const done = () => {
      activePrefetches--;
      pumpPrefetchQueue();
    };
    img.onload = () => {
      const finish = () => {
        markMediaDecoded(nextUrl);
        done();
      };
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = done;
    img.src = nextUrl;
  }
}

/**
 * Replaces the current pending prefetch queue with prioritized URLs for upcoming spots,
 * waiting briefly so active viewport images finish first.
 */
export function scheduleMediaPrefetch(urls: string[]): void {
  if (typeof window === 'undefined') return;

  pendingQueue.length = 0;
  for (const url of urls) {
    if (url && !prefetchedUrls.has(url)) {
      pendingQueue.push(url);
    }
  }

  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
  }

  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(() => pumpPrefetchQueue(), { timeout: 600 });
    } else {
      pumpPrefetchQueue();
    }
  }, 280);
}
