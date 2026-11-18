import { useSyncExternalStore } from 'react';

/**
 * Helper to build CDN-cacheable media URLs for Immich assets relayed through our backend,
 * plus a non-blocking idle prefetcher for adjacent spots/days and video metadata registry.
 *
 * Tiers:
 * - thumbnail: ~25 KB 250px WebP for instant placeholders, map/day lists, and hover cards
 * - grid:      ~50–70 KB 720px WebP for crisp 2x Retina display in the 2-column gallery
 * - preview:   ~150–190 KB 1440px WebP for full-width single-photo spots & Lightbox preview
 * - original:  full-resolution original file from Immich for Lightbox download
 * - video:     Range-streamed MP4 playback from Immich for inline & Lightbox video players
 */
export type MediaSize = 'thumbnail' | 'grid' | 'preview' | 'original' | 'video';

export interface VideoMeta {
  durationMs?: number;
  mime?: string;
}

export function getMediaUrl(assetId: string, size: MediaSize = 'preview'): string {
  if (!assetId) return '';
  if (assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.startsWith('/')) {
    return assetId;
  }
  if (size === 'video') {
    return `/media/video/${assetId}.mp4`;
  }
  const ext = size === 'original' ? 'jpg' : 'webp';
  return `/media/${size}/${assetId}.${ext}`;
}

export function getOriginalDownloadUrl(assetId: string): string {
  if (!assetId) return '';
  if (assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.startsWith('/')) {
    return assetId;
  }
  return `/api/media?id=${encodeURIComponent(assetId)}&size=original`;
}

const videoMetaMap = new Map<string, VideoMeta>();
const checkedIds = new Set<string>();
let initialMetaPromise: Promise<void> | null = null;
let metaVersion = 0;
const metaListeners = new Set<() => void>();

function notifyMediaMetaListeners(): void {
  metaVersion++;
  metaListeners.forEach((listener) => listener());
}

function applyVideoMetaPayload(
  videos: Record<string, VideoMeta> | undefined,
  queriedIds?: string[]
): boolean {
  let changed = false;
  if (queriedIds) {
    for (const id of queriedIds) {
      checkedIds.add(id);
    }
  }
  if (videos && typeof videos === 'object') {
    for (const [id, info] of Object.entries(videos)) {
      const existing = videoMetaMap.get(id);
      if (!existing || existing.durationMs !== info?.durationMs || existing.mime !== info?.mime) {
        videoMetaMap.set(id, {
          ...(info?.durationMs !== undefined ? { durationMs: info.durationMs } : {}),
          ...(info?.mime ? { mime: info.mime } : {}),
        });
        changed = true;
      }
      checkedIds.add(id);
    }
  }
  return changed;
}

export function fetchInitialMediaMeta(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!initialMetaPromise) {
    initialMetaPromise = (async () => {
      try {
        const res = await fetch('/api/media-meta');
        if (!res.ok) {
          initialMetaPromise = null;
          return;
        }
        const data = (await res.json()) as { videos?: Record<string, VideoMeta> };
        if (applyVideoMetaPayload(data?.videos)) {
          notifyMediaMetaListeners();
        }
      } catch {
        initialMetaPromise = null;
      }
    })();
  }
  return initialMetaPromise;
}

export async function ensureMediaMetaForIds(assetIds: string[]): Promise<void> {
  if (typeof window === 'undefined' || assetIds.length === 0) return;
  await fetchInitialMediaMeta();
  const unknown = Array.from(new Set(assetIds)).filter(
    (id) => id && !videoMetaMap.has(id) && !checkedIds.has(id) && !id.includes('/')
  );
  if (unknown.length === 0) return;

  try {
    const res = await fetch(`/api/media-meta?ids=${encodeURIComponent(unknown.join(','))}`);
    if (!res.ok) return;
    const data = (await res.json()) as { videos?: Record<string, VideoMeta> };
    if (applyVideoMetaPayload(data?.videos, unknown)) {
      notifyMediaMetaListeners();
    }
  } catch {
    // Ignore metadata lookup errors
  }
}

export function isVideoAsset(assetId: string): boolean {
  if (!assetId) return false;
  return videoMetaMap.has(assetId) || /\.(mp4|mov|webm)(\?|$)/i.test(assetId);
}

export function getVideoMeta(assetId: string): VideoMeta | undefined {
  return assetId ? videoMetaMap.get(assetId) : undefined;
}

export function formatVideoDuration(durationMs?: number): string {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) return '';
  const totalSec = Math.max(1, Math.round(durationMs / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function subscribeMediaMeta(listener: () => void): () => void {
  metaListeners.add(listener);
  return () => {
    metaListeners.delete(listener);
  };
}

export function useMediaMetaVersion(): number {
  return useSyncExternalStore(
    subscribeMediaMeta,
    () => metaVersion,
    () => metaVersion
  );
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
