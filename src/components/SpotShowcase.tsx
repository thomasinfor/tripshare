import React, { useState, useEffect, useRef } from 'react';
import { Spot } from '../types';
import { formatCoords } from '../utils/geo';
import { getMediaUrl, isMediaDecoded, markMediaDecoded } from '../utils/media';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

function decodeAndRun(img: HTMLImageElement, cb: () => void) {
  if (typeof img.decode === 'function') {
    img.decode().then(cb).catch(cb);
  } else {
    cb();
  }
}

interface SpotShowcaseProps {
  spot: Spot;
  spotNumber: number;
  totalSpots: number;
  dayTitle: string;
  dayNumber?: number;
  totalDays?: number;
  dayDate?: string;
  dayColor?: string;
  distanceFromPrev?: number;
  onOpenLightbox: (imageUrl: string) => void;
}

interface StackPhotoItemProps {
  assetId: string;
  index: number;
  spotName: string;
  scrollRoot: HTMLDivElement | null;
  onOpenLightbox: (assetId: string) => void;
}

const StackPhotoItem: React.FC<StackPhotoItemProps> = ({
  assetId,
  index,
  spotName,
  scrollRoot,
  onOpenLightbox,
}) => {
  const thumbUrl = getMediaUrl(assetId, 'thumbnail');
  const gridUrl = getMediaUrl(assetId, 'grid');
  const alreadyDecoded = isMediaDecoded(gridUrl);
  const instantRef = useRef(alreadyDecoded);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(alreadyDecoded || index < 6);
  const [thumbReady, setThumbReady] = useState(alreadyDecoded);
  const [gridLoaded, setGridLoaded] = useState(alreadyDecoded);

  useEffect(() => {
    if (inView) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        root: scrollRoot,
        rootMargin: '350px 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, scrollRoot]);

  return (
    <Box
      ref={cardRef}
      onClick={() => onOpenLightbox(assetId)}
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: '2px',
        overflow: 'hidden',
        bgcolor: '#ebe6dc',
        cursor: 'zoom-in',
        border: 'none',
        boxShadow: '0 2px 10px rgba(22, 22, 21, 0.06)',
        transition: 'box-shadow 0.22s ease',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(22, 22, 21, 0.14)',
        },
        '&:hover .photo-zoom-img': {
          transform: 'scale(1.02)',
        },
        '&:hover .photo-hover-overlay': {
          opacity: 1,
        },
      }}
    >
      {/* Phase 1: Instant ~25KB WebP thumbnail establishes intrinsic aspect ratio immediately */}
      <Box
        component="img"
        src={thumbUrl}
        alt={`${spotName} - Photo ${index + 1}`}
        loading={index < 8 ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={index < 6 ? 'high' : 'auto'}
        onLoad={() => setThumbReady(true)}
        onError={() => setThumbReady(true)}
        sx={{
          display: 'block',
          width: '100%',
          height: 'auto',
          minHeight: 80,
          filter: 'blur(1px)',
          transform: 'scale(1.005)',
          opacity: gridLoaded ? 0 : 1,
          transition: gridLoaded && !instantRef.current ? 'opacity 0.05s linear 0.22s' : 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Phase 2: Crisp WebP upgrades after decode, keeping thumbnail opaque underneath until fade completes */}
      {inView && thumbReady && (
        <Box
          component="img"
          className="photo-zoom-img"
          src={gridUrl}
          alt={`${spotName} - Photo ${index + 1}`}
          onLoad={(e) => {
            const imgEl = e.currentTarget as HTMLImageElement;
            decodeAndRun(imgEl, () => {
              markMediaDecoded(gridUrl);
              setGridLoaded(true);
            });
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: gridLoaded ? 1 : 0,
            willChange: gridLoaded ? 'auto' : 'opacity',
            transition: instantRef.current
              ? 'transform 0.35s ease'
              : 'opacity 0.2s ease-out, transform 0.35s ease',
          }}
        />
      )}

      {/* Subtle gallery hover controls */}
      <Box
        className="photo-hover-overlay"
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(22,22,21,0.18) 0%, transparent 32%, transparent 68%, rgba(22,22,21,0.28) 100%)',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          p: 1,
        }}
      >
        <Chip
          label={`#${index + 1}`}
          size="small"
          sx={{
            height: 20,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5,
            fontWeight: 600,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            color: '#161615',
            borderColor: 'rgba(22, 22, 21, 0.10)',
            backdropFilter: 'blur(6px)',
          }}
        />
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(6px)',
            color: '#161615',
            border: '1px solid rgba(22, 22, 21, 0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FullscreenIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
    </Box>
  );
};

export const SpotShowcase: React.FC<SpotShowcaseProps> = ({
  spot,
  spotNumber,
  totalSpots,
  dayNumber,
  dayDate,
  dayColor = '#b91c1c',
  distanceFromPrev,
  onOpenLightbox,
}) => {
  const images = spot.images && spot.images.length > 0 ? spot.images : [];
  const isSingleImage = images.length === 1;
  const singleAssetId = images[0] || '';
  const singleThumbUrl = singleAssetId ? getMediaUrl(singleAssetId, 'thumbnail') : '';
  const singlePreviewUrl = singleAssetId ? getMediaUrl(singleAssetId, 'preview') : '';

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const initialSingleReady = isSingleImage && isMediaDecoded(singlePreviewUrl);
  const singleInstantRef = useRef(initialSingleReady);
  const [singleThumbReady, setSingleThumbReady] = useState(initialSingleReady);
  const [singleLoaded, setSingleLoaded] = useState(initialSingleReady);

  useEffect(() => {
    const already = isSingleImage && isMediaDecoded(singlePreviewUrl);
    singleInstantRef.current = already;
    setSingleThumbReady(already);
    setSingleLoaded(already);
  }, [spot.id, spot.name, isSingleImage, singlePreviewUrl]);

  useEffect(() => {
    if (scrollEl) {
      scrollEl.scrollTop = 0;
    }
  }, [spot.id, spot.name, scrollEl]);

  // Split images into 2 top-to-bottom column stacks (even indices left, odd indices right)
  const leftStack = images
    .map((assetId, index) => ({ assetId, index }))
    .filter((_, idx) => idx % 2 === 0);
  const rightStack = images
    .map((assetId, index) => ({ assetId, index }))
    .filter((_, idx) => idx % 2 === 1);

  const eyebrowLabel = [
    dayNumber ? `DAY ${String(dayNumber).padStart(2, '0')}` : null,
    `STOP ${String(spotNumber).padStart(2, '0')} OF ${String(totalSpots).padStart(2, '0')}`,
    dayDate || null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Box
      ref={setScrollEl}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, sm: 2.75 },
        gap: 2,
        overflowY: isSingleImage ? 'hidden' : 'auto',
        overflowX: 'hidden',
        bgcolor: '#f5f2eb',
        '&::-webkit-scrollbar': { width: 5 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(22, 22, 21, 0.18)',
          borderRadius: 99,
        },
      }}
    >
      {/* Editorial Header */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, flexShrink: 0 }}>
        {/* Monospace Eyebrow */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: '#6b6860',
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: dayColor || '#b91c1c',
              flexShrink: 0,
            }}
          />
          <span>{eyebrowLabel}</span>
        </Box>

        {/* Instrument Serif Title */}
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontWeight: 400,
            fontSize: { xs: '1.85rem', sm: '2.35rem' },
            letterSpacing: '-0.015em',
            color: '#161615',
            lineHeight: 1.06,
          }}
        >
          {spot.name}
        </Typography>

        {/* Monospace Metadata Hairline Strip */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 1.75,
            rowGap: 0.5,
            pb: 1.5,
            borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11.5px',
            color: '#6b6860',
          }}
        >
          {spot.time && <span>{spot.time}</span>}
          {distanceFromPrev !== undefined && distanceFromPrev > 0 && (
            <span>+{distanceFromPrev} km drive</span>
          )}
          <span>{formatCoords(spot.lat, spot.lng)}</span>
          <span>
            {images.length} {images.length === 1 ? 'photo' : 'photos'}
          </span>
          {spot.google_maps_place?.url && (
            <Box
              component="a"
              href={spot.google_maps_place.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: '#b91c1c',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Google Maps ↗
            </Box>
          )}
        </Box>

        {spot.description && (
          <Typography
            variant="body2"
            sx={{
              color: '#4a4842',
              fontSize: '14px',
              lineHeight: 1.65,
              maxWidth: '66ch',
              pt: 0.25,
              ...(isSingleImage
                ? {
                    display: '-webkit-box',
                    WebkitLineClamp: { xs: 2, sm: 3 },
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }
                : {}),
            }}
          >
            {spot.description}
          </Typography>
        )}
      </Box>

      {/* Gallery Body */}
      {images.length === 0 ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 6,
            color: '#6b6860',
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: 44, mb: 1, opacity: 0.45 }} />
          <Typography variant="body2">No photos recorded for this spot</Typography>
        </Box>
      ) : isSingleImage ? (
        /* Single Image Mode: Full width, bounded height so it never overflows vertically */
        <Box
          onClick={() => onOpenLightbox(singleAssetId)}
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            position: 'relative',
            borderRadius: '3px',
            overflow: 'hidden',
            bgcolor: '#ebe6dc',
            cursor: 'zoom-in',
            border: '1px solid rgba(22, 22, 21, 0.09)',
            boxShadow: '0 4px 18px rgba(22, 22, 21, 0.07)',
          }}
        >
          {/* Soft warm matboard ambient backdrop for portrait or ultra-wide aspect ratios */}
          <Box
            component="img"
            src={singleThumbUrl}
            alt=""
            decoding="async"
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(32px) brightness(1.04) saturate(0.85)',
              opacity: 0.38,
              transform: 'scale(1.1)',
              pointerEvents: 'none',
            }}
          />

          {/* Fast thumbnail placeholder — stays opaque underneath until foreground reveal finishes */}
          <Box
            component="img"
            key={`single-thumb-${singleAssetId}`}
            src={singleThumbUrl}
            alt=""
            fetchPriority="high"
            decoding="async"
            onLoad={() => setSingleThumbReady(true)}
            onError={() => setSingleThumbReady(true)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'blur(1.5px)',
              opacity: singleLoaded ? 0 : 1,
              transition:
                singleLoaded && !singleInstantRef.current
                  ? 'opacity 0.05s linear 0.22s'
                  : 'none',
              pointerEvents: 'none',
            }}
          />

          {singleThumbReady && (
            <Box
              component="img"
              key={`single-preview-${singleAssetId}`}
              src={singlePreviewUrl}
              alt={`${spot.name} - Photo 1`}
              onLoad={(e) => {
                const imgEl = e.currentTarget as HTMLImageElement;
                decodeAndRun(imgEl, () => {
                  markMediaDecoded(singlePreviewUrl);
                  setSingleLoaded(true);
                });
              }}
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                opacity: singleLoaded ? 1 : 0,
                willChange: singleLoaded ? 'auto' : 'opacity',
                transition: singleInstantRef.current
                  ? 'transform 0.35s ease'
                  : 'opacity 0.2s ease-out, transform 0.35s ease',
                '&:hover': {
                  transform: 'scale(1.015)',
                },
              }}
            />
          )}

          <Tooltip title="View Fullscreen" arrow>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox(singleAssetId);
              }}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(8px)',
                color: '#161615',
                border: '1px solid rgba(22, 22, 21, 0.12)',
                '&:hover': { bgcolor: '#161615', color: '#f5f2eb' },
              }}
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        /* Multi-Image Mode: 2-Column Top-to-Bottom Image Stacks */
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 1.25,
            width: '100%',
            pb: 1,
          }}
        >
          {/* Column 1 Stack */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
            }}
          >
            {leftStack.map(({ assetId, index }) => (
              <StackPhotoItem
                key={`${assetId}-${index}`}
                assetId={assetId}
                index={index}
                spotName={spot.name}
                scrollRoot={scrollEl}
                onOpenLightbox={onOpenLightbox}
              />
            ))}
          </Box>

          {/* Column 2 Stack */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
            }}
          >
            {rightStack.map(({ assetId, index }) => (
              <StackPhotoItem
                key={`${assetId}-${index}`}
                assetId={assetId}
                index={index}
                spotName={spot.name}
                scrollRoot={scrollEl}
                onOpenLightbox={onOpenLightbox}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
