import React, { useState, useEffect, useRef } from 'react';
import { Spot } from '../types';
import { formatCoords } from '../utils/geo';
import { getMediaUrl, isMediaDecoded, markMediaDecoded } from '../utils/media';

function decodeAndRun(img: HTMLImageElement, cb: () => void) {
  if (typeof img.decode === 'function') {
    img.decode().then(cb).catch(cb);
  } else {
    cb();
  }
}
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ExploreIcon from '@mui/icons-material/Explore';

interface SpotShowcaseProps {
  spot: Spot;
  spotNumber: number;
  totalSpots: number;
  dayTitle: string;
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
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: '#050811',
        cursor: 'zoom-in',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(56, 189, 248, 0.5)',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.6)',
        },
        '&:hover .photo-zoom-img': {
          transform: 'scale(1.025)',
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

      {/* Phase 2: Crisp ~55KB WebP upgrades after decode, keeping thumbnail opaque underneath until fade completes */}
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

      {/* Subtle hover controls */}
      <Box
        className="photo-hover-overlay"
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.45) 100%)',
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
            fontSize: 10.5,
            fontWeight: 700,
            bgcolor: 'rgba(15, 23, 42, 0.8)',
            color: '#f8fafc',
            backdropFilter: 'blur(6px)',
          }}
        />
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            bgcolor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(6px)',
            color: '#ffffff',
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
  dayTitle,
  dayColor = '#38bdf8',
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

  return (
    <Box
      ref={setScrollEl}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, sm: 2.5 },
        gap: 2,
        overflowY: isSingleImage ? 'hidden' : 'auto',
        overflowX: 'hidden',
        bgcolor: '#0a0f1d',
        background: 'linear-gradient(180deg, #0f172a 0%, #070b14 100%)',
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(255, 255, 255, 0.18)',
          borderRadius: 3,
        },
      }}
    >
      {/* Top Header / Meta */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={dayTitle}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              color: dayColor,
              fontWeight: 700,
              fontSize: 12,
              border: `1px solid ${dayColor}40`,
            }}
          />
          <Chip
            size="small"
            icon={<ExploreIcon sx={{ fontSize: 14, color: '#38bdf8 !important' }} />}
            label={`Stop ${spotNumber} of ${totalSpots}`}
            sx={{
              bgcolor: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: 12,
            }}
          />
          {distanceFromPrev !== undefined && distanceFromPrev > 0 && (
            <Chip
              size="small"
              icon={<DirectionsCarIcon sx={{ fontSize: 14, color: '#94a3b8 !important' }} />}
              label={`${distanceFromPrev} km`}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: 'text.secondary',
                fontSize: 12,
              }}
            />
          )}
        </Box>

        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.35rem', sm: '1.75rem' },
            letterSpacing: '-0.02em',
            color: '#f8fafc',
            mt: 0.25,
            lineHeight: 1.25,
          }}
        >
          {spot.name}
        </Typography>

        {/* Location & Time Subbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {spot.time && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: 13 }}>
              <AccessTimeIcon sx={{ fontSize: 15 }} />
              <span>{spot.time}</span>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: 13 }}>
            <LocationOnIcon sx={{ fontSize: 15 }} />
            <span>{formatCoords(spot.lat, spot.lng)}</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: 13 }}>
            <PhotoCameraIcon sx={{ fontSize: 15 }} />
            <span>{images.length} {images.length === 1 ? 'Photo' : 'Photos'}</span>
          </Box>
          {spot.google_maps_place?.url && (
            <Box
              component="a"
              href={spot.google_maps_place.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: '#38bdf8',
                fontSize: 13,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              <span>View on Google Maps ↗</span>
            </Box>
          )}
        </Box>

        {spot.description && (
          <Typography
            variant="body2"
            sx={{
              color: '#cbd5e1',
              lineHeight: 1.55,
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
            color: 'text.secondary',
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
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
            borderRadius: 2.5,
            overflow: 'hidden',
            bgcolor: '#050811',
            cursor: 'zoom-in',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Ambient full-width backdrop for portrait or ultra-wide aspect ratios */}
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
              filter: 'blur(28px) brightness(0.42)',
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
                bgcolor: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                '&:hover': { bgcolor: '#0284c7' },
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
            gap: 1.5,
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
              gap: 1.5,
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
              gap: 1.5,
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
