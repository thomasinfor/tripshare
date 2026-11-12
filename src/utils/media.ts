/**
 * Helper to build media URLs for Immich assets relayed through our backend.
 * 
 * Supports progressive image loading:
 * - thumbnail: tiny WebP for instant blurred/placeholder display and filmstrip strips
 * - preview: crisp compressed JPEG/WebP for the main showcase display
 * - original: full resolution photo / video for Lightbox or downloads
 */
export type MediaSize = 'thumbnail' | 'preview' | 'original';

export function getMediaUrl(assetId: string, size: MediaSize = 'preview'): string {
  if (!assetId) return '';
  // If it's already a full URL (legacy fallback), return as is
  if (assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.startsWith('/')) {
    return assetId;
  }
  return `/api/media?id=${assetId}&size=${size}`;
}
