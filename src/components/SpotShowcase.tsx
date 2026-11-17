import React, { useState, useEffect, useRef } from 'react';
import { Spot } from '../types';
import { formatCoords } from '../utils/geo';
import { getMediaUrl, isMediaDecoded, markMediaDecoded } from '../utils/media';
import { SpotPhotoDraft, extractImmichAssetIds } from '../utils/photoDrafts';
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

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
  originAccommodationName?: string;
  originIsLastNight?: boolean;
  isEditMode?: boolean;
  baseImages?: string[];
  spotDraft?: SpotPhotoDraft;
  showRemovedPhotos?: boolean;
  pendingChangeCount?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleShowRemoved?: () => void;
  onAddPhotos?: (assetIds: string[]) => void;
  onToggleRemovePhoto?: (assetId: string) => void;
  onReorderPhotos?: (nextOrderedActiveIds: string[]) => void;
  onResetSpotDraft?: () => void;
  onOpenDraftReview?: () => void;
  onOpenLightbox: (imageUrl: string) => void;
}

interface StackPhotoItemProps {
  assetId: string;
  index: number;
  spotName: string;
  scrollRoot: HTMLDivElement | null;
  isEditMode?: boolean;
  isAdded?: boolean;
  isRemoved?: boolean;
  activePosition?: number;
  activeCount?: number;
  isDragSource?: boolean;
  isDragTarget?: boolean;
  onMoveToPosition?: (targetActiveIdx: number) => void;
  onDragStartAsset?: (assetId: string) => void;
  onDragOverAsset?: (assetId: string) => void;
  onDragEndAsset?: () => void;
  onDropOnAsset?: (targetAssetId: string) => void;
  onToggleRemove?: (assetId: string) => void;
  onOpenLightbox: (assetId: string) => void;
}

const StackPhotoItem: React.FC<StackPhotoItemProps> = ({
  assetId,
  index,
  spotName,
  scrollRoot,
  isEditMode = false,
  isAdded = false,
  isRemoved = false,
  activePosition,
  activeCount = 0,
  isDragSource = false,
  isDragTarget = false,
  onMoveToPosition,
  onDragStartAsset,
  onDragOverAsset,
  onDragEndAsset,
  onDropOnAsset,
  onToggleRemove,
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

  const canReorder = import.meta.env.DEV && isEditMode && !isRemoved && activeCount > 1;

  return (
    <Box
      ref={cardRef}
      onClick={() => onOpenLightbox(assetId)}
      draggable={canReorder}
      onDragStart={(e) => {
        if (!canReorder) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', assetId);
        onDragStartAsset?.(assetId);
      }}
      onDragOver={(e) => {
        if (!canReorder) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverAsset?.(assetId);
      }}
      onDragEnd={() => {
        if (canReorder) onDragEndAsset?.();
      }}
      onDrop={(e) => {
        if (!canReorder) return;
        e.preventDefault();
        e.stopPropagation();
        onDropOnAsset?.(assetId);
      }}
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: '2px',
        overflow: 'hidden',
        bgcolor: '#ebe6dc',
        cursor: canReorder ? 'grab' : 'zoom-in',
        border: isRemoved
          ? '1.5px dashed #b91c1c'
          : isAdded
          ? '2px solid #15803d'
          : 'none',
        outline: isDragTarget ? '2.5px solid #b91c1c' : 'none',
        outlineOffset: isDragTarget ? '2px' : 0,
        opacity: isRemoved ? 0.44 : isDragSource ? 0.55 : 1,
        boxShadow: '0 2px 10px rgba(22, 22, 21, 0.06)',
        transition: 'box-shadow 0.22s ease, opacity 0.2s ease',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(22, 22, 21, 0.14)',
        },
        '&:hover .photo-zoom-img': {
          transform: 'scale(1.02)',
        },
        '&:hover .photo-hover-overlay': {
          opacity: 1,
        },
        '@media (hover: none)': {
          '& .photo-hover-overlay': {
            opacity: 1,
            background: 'linear-gradient(180deg, transparent 68%, rgba(22,22,21,0.28) 100%)',
          },
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
          display: isEditMode ? 'none' : 'flex',
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

      {/* Dev-only Staging Status & Remove/Undo Controls */}
      {import.meta.env.DEV && isEditMode && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isAdded && (
              <Chip
                label="ADDED"
                size="small"
                sx={{
                  height: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: '#15803d',
                  color: '#ffffff',
                }}
              />
            )}
            {isRemoved && (
              <Chip
                label="REMOVED"
                size="small"
                sx={{
                  height: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: '#b91c1c',
                  color: '#ffffff',
                }}
              />
            )}
          </Box>

          {onToggleRemove && (
            <Tooltip title={isRemoved ? 'Keep photo (undo remove)' : 'Mark photo for removal'} arrow>
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRemove(assetId);
                }}
                startIcon={
                  isRemoved ? (
                    <UndoIcon sx={{ fontSize: '14px !important' }} />
                  ) : (
                    <DeleteOutlineIcon sx={{ fontSize: '15px !important' }} />
                  )
                }
                sx={{
                  pointerEvents: 'auto',
                  minWidth: 0,
                  py: 0.25,
                  px: 1,
                  borderRadius: '999px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10.5px',
                  fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(22, 22, 21, 0.22)',
                  ...(isRemoved
                    ? {
                        bgcolor: '#161615',
                        color: '#f5f2eb',
                        '&:hover': { bgcolor: '#2c2c2a' },
                      }
                    : {
                        bgcolor: 'rgba(255, 255, 255, 0.94)',
                        color: '#b91c1c',
                        border: '1px solid rgba(185, 28, 28, 0.35)',
                        '&:hover': { bgcolor: '#b91c1c', color: '#ffffff' },
                      }),
                }}
              >
                {isRemoved ? 'Undo' : 'Remove'}
              </Button>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Dev-only Bottom Position & Reorder Strip */}
      {import.meta.env.DEV && isEditMode && !isRemoved && activePosition !== undefined && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            gap: 0.75,
          }}
        >
          <Chip
            label={activePosition === 0 ? '#1 · Cover' : `#${activePosition + 1}`}
            size="small"
            sx={{
              height: 22,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10.5px',
              fontWeight: 700,
              bgcolor: activePosition === 0 ? '#161615' : 'rgba(255, 255, 255, 0.94)',
              color: activePosition === 0 ? '#f5f2eb' : '#161615',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(22, 22, 21, 0.20)',
            }}
          />

          {activeCount > 1 && onMoveToPosition && (
            <Box
              sx={{
                pointerEvents: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.35,
                p: 0.3,
                borderRadius: '999px',
                bgcolor: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(22, 22, 21, 0.14)',
                boxShadow: '0 2px 8px rgba(22, 22, 21, 0.20)',
              }}
            >
              {activePosition > 1 && (
                <Tooltip title="Move to #1 (Cover)" arrow>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToPosition(0);
                    }}
                    sx={{
                      minWidth: 0,
                      px: 0.75,
                      py: 0.15,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '999px',
                      color: '#b91c1c',
                      '&:hover': { bgcolor: 'rgba(185, 28, 28, 0.10)' },
                    }}
                  >
                    #1
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Move earlier" arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Move photo earlier"
                    disabled={activePosition === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToPosition(activePosition - 1);
                    }}
                    sx={{
                      p: 0.35,
                      color: '#161615',
                      '&.Mui-disabled': { opacity: 0.3 },
                    }}
                  >
                    <ArrowBackIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Move later" arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Move photo later"
                    disabled={activePosition >= activeCount - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToPosition(activePosition + 1);
                    }}
                    sx={{
                      p: 0.35,
                      color: '#161615',
                      '&.Mui-disabled': { opacity: 0.3 },
                    }}
                  >
                    <ArrowForwardIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>
      )}
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
  originAccommodationName,
  originIsLastNight = false,
  isEditMode = false,
  baseImages,
  spotDraft,
  showRemovedPhotos = true,
  pendingChangeCount = 0,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onToggleShowRemoved,
  onAddPhotos,
  onToggleRemovePhoto,
  onReorderPhotos,
  onResetSpotDraft,
  onOpenDraftReview,
  onOpenLightbox,
}) => {
  const images = spot.images && spot.images.length > 0 ? spot.images : [];
  const isSingleImage = images.length === 1;
  const singleAssetId = images[0] || '';
  const singleThumbUrl = singleAssetId ? getMediaUrl(singleAssetId, 'thumbnail') : '';
  const singlePreviewUrl = singleAssetId ? getMediaUrl(singleAssetId, 'preview') : '';

  const isMobileScreen = useMediaQuery('(max-width:599.95px)');
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const initialSingleReady = isSingleImage && isMediaDecoded(singlePreviewUrl);
  const singleInstantRef = useRef(initialSingleReady);
  const [singleThumbReady, setSingleThumbReady] = useState(initialSingleReady);
  const [singleLoaded, setSingleLoaded] = useState(initialSingleReady);
  const [urlInput, setUrlInput] = useState('');
  const [inputFeedback, setInputFeedback] = useState<{ severity: 'ok' | 'err'; text: string } | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [dragOverAssetId, setDragOverAssetId] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput('');
    setInputFeedback(null);
    setDraggingAssetId(null);
    setDragOverAssetId(null);
  }, [spot.id]);

  const baseSet = new Set(baseImages ?? images);
  const addedSet = new Set(spotDraft?.addedIds ?? []);
  const removedSet = new Set(spotDraft?.removedIds ?? []);
  const spotAddedCount = spotDraft?.addedIds.length ?? 0;
  const spotRemovedCount = spotDraft?.removedIds.length ?? 0;
  const spotIsReordered = Boolean(spotDraft?.orderedIds && spotDraft.orderedIds.length > 0);
  const hasSpotChanges = spotAddedCount > 0 || spotRemovedCount > 0 || spotIsReordered;

  const activeImages = images.filter((id) => !removedSet.has(id));
  const activeIndexMap = new Map(activeImages.map((id, i) => [id, i]));

  const moveActivePhoto = (fromAssetId: string, toActiveIdx: number) => {
    if (!onReorderPhotos) return;
    const fromIdx = activeIndexMap.get(fromAssetId);
    if (fromIdx === undefined) return;
    const clampedTo = Math.max(0, Math.min(activeImages.length - 1, toActiveIdx));
    if (fromIdx === clampedTo) return;
    const next = [...activeImages];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(clampedTo, 0, moved);
    onReorderPhotos(next);
  };

  const handleDropOnAsset = (targetAssetId: string) => {
    if (!draggingAssetId || draggingAssetId === targetAssetId) {
      setDraggingAssetId(null);
      setDragOverAssetId(null);
      return;
    }
    const targetIdx = activeIndexMap.get(targetAssetId);
    if (targetIdx !== undefined) {
      moveActivePhoto(draggingAssetId, targetIdx);
    }
    setDraggingAssetId(null);
    setDragOverAssetId(null);
  };

  const handleStageAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onAddPhotos) return;
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const { ids, invalidTokens } = extractImmichAssetIds(trimmed);
    if (ids.length === 0) {
      setInputFeedback({
        severity: 'err',
        text: 'No valid Immich photo URL or asset UUID found.',
      });
      return;
    }

    onAddPhotos(ids);
    setUrlInput('');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setInputFeedback({
      severity: 'ok',
      text:
        invalidTokens.length > 0
          ? `Processed ${ids.length} photo${ids.length === 1 ? '' : 's'} (${invalidTokens.length} invalid skipped).`
          : `Staged ${ids.length} photo${ids.length === 1 ? '' : 's'} on this spot.`,
    });
  };

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
        p: { xs: 1.75, sm: 2.75 },
        gap: { xs: 1.5, sm: 2 },
        overflowY: { xs: 'auto', sm: isSingleImage ? 'hidden' : 'auto' },
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.75, sm: 0.9 }, flexShrink: 0 }}>
        {/* Monospace Eyebrow */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: { xs: '10.5px', sm: '11px' },
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
            fontSize: { xs: '1.5rem', sm: '2.1rem', md: '2.35rem' },
            letterSpacing: '-0.015em',
            color: '#161615',
            lineHeight: 1.08,
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
            columnGap: { xs: 1.25, sm: 1.75 },
            rowGap: 0.5,
            pb: { xs: 1.15, sm: 1.5 },
            borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: { xs: '11px', sm: '11.5px' },
            color: '#6b6860',
          }}
        >
          {spot.time && <span>{spot.time}</span>}
          {distanceFromPrev !== undefined && distanceFromPrev > 0 && (
            <span>
              +{distanceFromPrev} km drive
              {originAccommodationName
                ? ` from ${originIsLastNight ? 'last night (' : ''}${originAccommodationName}${originIsLastNight ? ')' : ''}`
                : ''}
            </span>
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
              fontSize: { xs: '13.5px', sm: '14px' },
              lineHeight: 1.65,
              maxWidth: '66ch',
              pt: 0.25,
              ...(isSingleImage
                ? {
                    display: { xs: 'block', sm: '-webkit-box' },
                    WebkitLineClamp: { sm: 3 },
                    WebkitBoxOrient: 'vertical',
                    overflow: { xs: 'visible', sm: 'hidden' },
                  }
                : {}),
            }}
          >
            {spot.description}
          </Typography>
        )}
      </Box>

      {/* Dev-only Photo Staging Toolbar */}
      {import.meta.env.DEV && isEditMode && (
        <Box
          component="form"
          onSubmit={handleStageAdd}
          sx={{
            flexShrink: 0,
            bgcolor: '#ffffff',
            border: '1px solid rgba(185, 28, 28, 0.24)',
            borderLeft: '3px solid #b91c1c',
            borderRadius: '6px',
            p: { xs: 1.25, sm: 1.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
            <TextField
              size="small"
              fullWidth
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (inputFeedback) setInputFeedback(null);
              }}
              placeholder="Paste Immich photo URL(s) or UUID(s)..."
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  bgcolor: '#f5f2eb',
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={!urlInput.trim()}
              startIcon={<AddPhotoAlternateOutlinedIcon sx={{ fontSize: '16px !important' }} />}
              sx={{
                flexShrink: 0,
                bgcolor: '#161615',
                color: '#f5f2eb',
                borderRadius: '6px',
                px: 1.75,
                fontSize: '12px',
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#2c2c2a' },
              }}
            >
              Add Photo
            </Button>
          </Box>

          {inputFeedback && (
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: inputFeedback.severity === 'err' ? '#b91c1c' : '#15803d',
              }}
            >
              {inputFeedback.text}
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#6b6860',
              }}
            >
              Spot draft: +{spotAddedCount} added · −{spotRemovedCount} removed
              {spotIsReordered ? ' · reordered' : ''}
              {activeImages.length > 1 ? ' — Drag cards or use ← / → to reorder' : ''}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              {(onUndo || onRedo) && (
                <>
                  {onUndo && (
                    <Tooltip title="Undo photo edit (Ctrl+Z)" arrow>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canUndo}
                          onClick={onUndo}
                          startIcon={<UndoIcon sx={{ fontSize: '14px !important' }} />}
                          sx={{
                            py: 0.2,
                            px: 1,
                            minWidth: 'auto',
                            fontSize: '11px',
                            fontFamily: "'JetBrains Mono', monospace",
                            borderColor: 'rgba(22, 22, 21, 0.16)',
                            color: '#161615',
                            borderRadius: '999px',
                            '&.Mui-disabled': {
                              borderColor: 'rgba(22, 22, 21, 0.08)',
                              color: 'rgba(22, 22, 21, 0.35)',
                            },
                          }}
                        >
                          Undo
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                  {onRedo && (
                    <Tooltip title="Redo photo edit (Ctrl+Shift+Z)" arrow>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canRedo}
                          onClick={onRedo}
                          startIcon={<RedoIcon sx={{ fontSize: '14px !important' }} />}
                          sx={{
                            py: 0.2,
                            px: 1,
                            minWidth: 'auto',
                            fontSize: '11px',
                            fontFamily: "'JetBrains Mono', monospace",
                            borderColor: 'rgba(22, 22, 21, 0.16)',
                            color: '#161615',
                            borderRadius: '999px',
                            '&.Mui-disabled': {
                              borderColor: 'rgba(22, 22, 21, 0.08)',
                              color: 'rgba(22, 22, 21, 0.35)',
                            },
                          }}
                        >
                          Redo
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                </>
              )}

              {spotRemovedCount > 0 && onToggleShowRemoved && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onToggleShowRemoved}
                  startIcon={
                    showRemovedPhotos ? (
                      <VisibilityOffOutlinedIcon sx={{ fontSize: '14px !important' }} />
                    ) : (
                      <VisibilityOutlinedIcon sx={{ fontSize: '14px !important' }} />
                    )
                  }
                  sx={{
                    py: 0.2,
                    px: 1,
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    borderColor: 'rgba(22, 22, 21, 0.16)',
                    color: '#161615',
                    borderRadius: '999px',
                  }}
                >
                  {showRemovedPhotos ? `Hide Removed (${spotRemovedCount})` : `Show Removed (${spotRemovedCount})`}
                </Button>
              )}

              {hasSpotChanges && onResetSpotDraft && (
                <Button
                  size="small"
                  onClick={onResetSpotDraft}
                  sx={{
                    py: 0.2,
                    px: 1,
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#6b6860',
                  }}
                >
                  Reset Spot
                </Button>
              )}

              {pendingChangeCount > 0 && onOpenDraftReview && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={onOpenDraftReview}
                  startIcon={<SmartToyOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                  sx={{
                    py: 0.25,
                    px: 1.25,
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    bgcolor: '#b91c1c',
                    color: '#ffffff',
                    borderRadius: '999px',
                    '&:hover': { bgcolor: '#991b1b' },
                  }}
                >
                  Review &amp; Copy Prompt ({pendingChangeCount})
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Gallery Body */}
      {images.length === 0 ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 4, sm: 6 },
            color: '#6b6860',
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: 44, mb: 1, opacity: 0.45 }} />
          <Typography variant="body2">
            {spotRemovedCount > 0 && !showRemovedPhotos
              ? 'All photos for this spot are marked for removal (click Show Removed to undo)'
              : 'No photos recorded for this spot'}
          </Typography>
        </Box>
      ) : isSingleImage ? (
        /* Single Image Mode: Full width, bounded height on desktop, scrollable min-height on mobile */
        <Box
          onClick={() => onOpenLightbox(singleAssetId)}
          sx={{
            flex: 1,
            minHeight: { xs: 240, sm: 0 },
            width: '100%',
            position: 'relative',
            borderRadius: '3px',
            overflow: 'hidden',
            bgcolor: '#ebe6dc',
            cursor: 'zoom-in',
            border: removedSet.has(singleAssetId)
              ? '1.5px dashed #b91c1c'
              : addedSet.has(singleAssetId) && !baseSet.has(singleAssetId)
              ? '2px solid #15803d'
              : '1px solid rgba(22, 22, 21, 0.09)',
            opacity: removedSet.has(singleAssetId) ? 0.44 : 1,
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

          {import.meta.env.DEV && isEditMode && (
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pointerEvents: 'none',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {addedSet.has(singleAssetId) && !baseSet.has(singleAssetId) && (
                  <Chip
                    label="ADDED"
                    size="small"
                    sx={{
                      height: 20,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 700,
                      bgcolor: '#15803d',
                      color: '#ffffff',
                    }}
                  />
                )}
                {removedSet.has(singleAssetId) && (
                  <Chip
                    label="REMOVED"
                    size="small"
                    sx={{
                      height: 20,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 700,
                      bgcolor: '#b91c1c',
                      color: '#ffffff',
                    }}
                  />
                )}
              </Box>
              {onToggleRemovePhoto && (
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleRemovePhoto(singleAssetId);
                  }}
                  startIcon={
                    removedSet.has(singleAssetId) ? (
                      <UndoIcon sx={{ fontSize: '14px !important' }} />
                    ) : (
                      <DeleteOutlineIcon sx={{ fontSize: '15px !important' }} />
                    )
                  }
                  sx={{
                    pointerEvents: 'auto',
                    minWidth: 0,
                    py: 0.25,
                    px: 1.1,
                    borderRadius: '999px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 700,
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 8px rgba(22, 22, 21, 0.22)',
                    ...(removedSet.has(singleAssetId)
                      ? {
                          bgcolor: '#161615',
                          color: '#f5f2eb',
                          '&:hover': { bgcolor: '#2c2c2a' },
                        }
                      : {
                          bgcolor: 'rgba(255, 255, 255, 0.94)',
                          color: '#b91c1c',
                          border: '1px solid rgba(185, 28, 28, 0.35)',
                          '&:hover': { bgcolor: '#b91c1c', color: '#ffffff' },
                        }),
                  }}
                >
                  {removedSet.has(singleAssetId) ? 'Undo' : 'Remove'}
                </Button>
              )}
            </Box>
          )}
        </Box>
      ) : isMobileScreen ? (
        /* Mobile Multi-Image Mode: Full-width single-column stack */
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            width: '100%',
            pb: 1,
          }}
        >
          {images.map((assetId, index) => (
            <StackPhotoItem
              key={`${assetId}-${index}`}
              assetId={assetId}
              index={index}
              spotName={spot.name}
              scrollRoot={scrollEl}
              isEditMode={isEditMode}
              isAdded={addedSet.has(assetId) && !baseSet.has(assetId)}
              isRemoved={removedSet.has(assetId)}
              activePosition={activeIndexMap.get(assetId)}
              activeCount={activeImages.length}
              isDragSource={draggingAssetId === assetId}
              isDragTarget={dragOverAssetId === assetId && draggingAssetId !== assetId}
              onMoveToPosition={(targetIdx) => moveActivePhoto(assetId, targetIdx)}
              onDragStartAsset={(id) => setDraggingAssetId(id)}
              onDragOverAsset={(id) => {
                if (dragOverAssetId !== id) setDragOverAssetId(id);
              }}
              onDragEndAsset={() => {
                setDraggingAssetId(null);
                setDragOverAssetId(null);
              }}
              onDropOnAsset={handleDropOnAsset}
              onToggleRemove={onToggleRemovePhoto}
              onOpenLightbox={onOpenLightbox}
            />
          ))}
        </Box>
      ) : (
        /* Tablet/Desktop Multi-Image Mode: 2-Column Top-to-Bottom Image Stacks */
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
                isEditMode={isEditMode}
                isAdded={addedSet.has(assetId) && !baseSet.has(assetId)}
                isRemoved={removedSet.has(assetId)}
                activePosition={activeIndexMap.get(assetId)}
                activeCount={activeImages.length}
                isDragSource={draggingAssetId === assetId}
                isDragTarget={dragOverAssetId === assetId && draggingAssetId !== assetId}
                onMoveToPosition={(targetIdx) => moveActivePhoto(assetId, targetIdx)}
                onDragStartAsset={(id) => setDraggingAssetId(id)}
                onDragOverAsset={(id) => {
                  if (dragOverAssetId !== id) setDragOverAssetId(id);
                }}
                onDragEndAsset={() => {
                  setDraggingAssetId(null);
                  setDragOverAssetId(null);
                }}
                onDropOnAsset={handleDropOnAsset}
                onToggleRemove={onToggleRemovePhoto}
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
                isEditMode={isEditMode}
                isAdded={addedSet.has(assetId) && !baseSet.has(assetId)}
                isRemoved={removedSet.has(assetId)}
                activePosition={activeIndexMap.get(assetId)}
                activeCount={activeImages.length}
                isDragSource={draggingAssetId === assetId}
                isDragTarget={dragOverAssetId === assetId && draggingAssetId !== assetId}
                onMoveToPosition={(targetIdx) => moveActivePhoto(assetId, targetIdx)}
                onDragStartAsset={(id) => setDraggingAssetId(id)}
                onDragOverAsset={(id) => {
                  if (dragOverAssetId !== id) setDragOverAssetId(id);
                }}
                onDragEndAsset={() => {
                  setDraggingAssetId(null);
                  setDragOverAssetId(null);
                }}
                onDropOnAsset={handleDropOnAsset}
                onToggleRemove={onToggleRemovePhoto}
                onOpenLightbox={onOpenLightbox}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
