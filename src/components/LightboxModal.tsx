import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import {
  getMediaUrl,
  getOriginalDownloadUrl,
  scheduleMediaPrefetch,
  isMediaDecoded,
  markMediaDecoded,
  isVideoAsset,
  useMediaMetaVersion,
} from '../utils/media';

interface LightboxModalProps {
  images: string[];
  currentImage: string;
  spotName: string;
  isEditMode?: boolean;
  isPhotoRemoved?: (assetId: string) => boolean;
  isPhotoAdded?: (assetId: string) => boolean;
  onToggleRemovePhoto?: (assetId: string) => void;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  images,
  currentImage,
  spotName,
  isEditMode = false,
  isPhotoRemoved,
  isPhotoAdded,
  onToggleRemovePhoto,
  onClose,
  onSelectImage,
}) => {
  useMediaMetaVersion();
  const currentIndex = images.indexOf(currentImage);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < images.length - 1;
  const isVideo = isVideoAsset(currentImage);
  const gridUrl = getMediaUrl(currentImage, 'grid');
  const previewUrl = getMediaUrl(currentImage, 'preview');
  const originalUrl = getOriginalDownloadUrl(currentImage);

  const initialFullReady = isMediaDecoded(previewUrl);
  const instantRef = useRef(initialFullReady);
  const [isFullLoaded, setIsFullLoaded] = useState(initialFullReady);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const already = isMediaDecoded(previewUrl);
    instantRef.current = already;
    setIsFullLoaded(already);
  }, [previewUrl]);

  const selectAtIndex = (targetIdx: number) => {
    const targetAsset = images[targetIdx];
    if (!targetAsset) return;
    const already = isMediaDecoded(getMediaUrl(targetAsset, 'preview'));
    instantRef.current = already;
    setIsFullLoaded(already);
    onSelectImage(targetAsset);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasPrev) return;
    selectAtIndex(currentIndex - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasNext) return;
    selectAtIndex(currentIndex + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images, onClose, onSelectImage]);

  useEffect(() => {
    if (images.length <= 1 || currentIndex < 0) return;
    const prefetchUrls: string[] = [];
    if (hasNext) prefetchUrls.push(getMediaUrl(images[currentIndex + 1], 'preview'));
    if (hasPrev) prefetchUrls.push(getMediaUrl(images[currentIndex - 1], 'preview'));
    if (prefetchUrls.length > 0) scheduleMediaPrefetch(prefetchUrls);
  }, [currentIndex, images, hasPrev, hasNext]);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'rgba(245, 242, 235, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: { xs: 0, sm: '14px' },
            m: { xs: 0, sm: 2 },
            width: { xs: '100%', sm: 'calc(100% - 32px)' },
            maxWidth: { xs: '100%', sm: '1400px' },
            overflow: 'hidden',
            border: { xs: 'none', sm: '1px solid rgba(22, 22, 21, 0.12)' },
            boxShadow: '0 25px 60px rgba(22, 22, 21, 0.25)',
            height: { xs: '100dvh', sm: '88dvh' },
            maxHeight: { xs: '100dvh', sm: '90dvh' },
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Top Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: { xs: 1.75, sm: 3 },
            py: { xs: 1.1, sm: 1.4 },
            borderBottom: '1px solid rgba(22, 22, 21, 0.09)',
            bgcolor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontWeight: 400,
                fontSize: { xs: '17px', sm: '22px' },
                color: '#161615',
                lineHeight: 1.1,
                minWidth: 0,
              }}
            >
              {spotName}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                color: '#161615',
                bgcolor: 'rgba(22, 22, 21, 0.06)',
                px: 1.1,
                py: 0.35,
                borderRadius: '999px',
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {currentIndex + 1} of {images.length}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {import.meta.env.DEV && isEditMode && onToggleRemovePhoto && (
              <>
                {isPhotoAdded?.(currentImage) && (
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
                      display: { xs: 'none', sm: 'inline-flex' },
                    }}
                  />
                )}
                <Button
                  size="small"
                  variant={isPhotoRemoved?.(currentImage) ? 'contained' : 'outlined'}
                  onClick={() => onToggleRemovePhoto(currentImage)}
                  startIcon={
                    isPhotoRemoved?.(currentImage) ? (
                      <UndoIcon sx={{ fontSize: '15px !important' }} />
                    ) : (
                      <DeleteOutlineIcon sx={{ fontSize: '15px !important' }} />
                    )
                  }
                  sx={{
                    borderRadius: '999px',
                    py: 0.35,
                    px: { xs: 1, sm: 1.4 },
                    fontSize: '11.5px',
                    fontWeight: 600,
                    ...(isPhotoRemoved?.(currentImage)
                      ? { bgcolor: '#161615', color: '#f5f2eb', '&:hover': { bgcolor: '#2c2c2a' } }
                      : {
                          borderColor: 'rgba(185, 28, 28, 0.45)',
                          color: '#b91c1c',
                          '&:hover': { bgcolor: 'rgba(185, 28, 28, 0.08)', borderColor: '#b91c1c' },
                        }),
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {isPhotoRemoved?.(currentImage) ? 'Undo Remove' : 'Remove from Spot'}
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    {isPhotoRemoved?.(currentImage) ? 'Undo' : 'Remove'}
                  </Box>
                </Button>
              </>
            )}
            <Tooltip title={isVideo ? 'Download original video' : 'Download original photo'}>
              <IconButton
                component="a"
                href={originalUrl}
                download={isVideo ? `${currentImage}.mp4` : `${currentImage}.jpg`}
                target="_blank"
                size="small"
                sx={{ color: '#6b6860', '&:hover': { color: '#161615', bgcolor: 'rgba(22, 22, 21, 0.06)' } }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close (Esc)">
              <IconButton
                onClick={onClose}
                size="small"
                sx={{ color: '#6b6860', '&:hover': { color: '#161615', bgcolor: 'rgba(22, 22, 21, 0.06)' } }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Center Media Viewport (Warm Matboard) with Touch Swipe */}
        <Box
          onTouchStart={(e) => {
            if (e.target instanceof HTMLVideoElement) return;
            if (e.touches.length === 1) {
              touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            if (!start || images.length <= 1 || e.changedTouches.length === 0) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              if (dx < 0) handleNext();
              else handlePrev();
            }
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            bgcolor: '#ebe6dc',
            overflow: 'hidden',
            touchAction: 'pan-y',
          }}
        >
          {hasPrev && (
            <IconButton
              size="small"
              aria-label="Previous photo"
              onClick={(e) => handlePrev(e)}
              sx={{
                position: 'absolute',
                left: { xs: 8, sm: 16 },
                zIndex: 10,
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(22, 22, 21, 0.12)',
                color: '#161615',
                '&:hover': { bgcolor: '#161615', color: '#f5f2eb' },
              }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
          )}

          {isVideo ? (
            <Box
              component="video"
              key={`lb-video-${currentImage}`}
              src={getMediaUrl(currentImage, 'video')}
              poster={previewUrl}
              controls
              autoPlay
              playsInline
              sx={{
                position: 'relative',
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                bgcolor: '#0f0f0e',
                outline: 'none',
              }}
            />
          ) : (
            <>
              {/* Instant cached 660px grid image — stays opaque underneath until 1360px preview finishes fading in */}
              <Box
                component="img"
                key={`lb-grid-${currentImage}`}
                src={gridUrl}
                alt=""
                decoding="async"
                sx={{
                  position: 'absolute',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  opacity: isFullLoaded ? 0 : 1,
                  transition:
                    isFullLoaded && !instantRef.current
                      ? 'opacity 0.05s linear 0.22s'
                      : 'none',
                  pointerEvents: 'none',
                }}
              />

              {/* High-res 1360px WebP photo */}
              <Box
                component="img"
                key={`lb-preview-${currentImage}`}
                src={previewUrl}
                alt={`${spotName} fullscreen`}
                onLoad={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  const finish = () => {
                    markMediaDecoded(previewUrl);
                    setIsFullLoaded(true);
                  };
                  if (typeof imgEl.decode === 'function') {
                    imgEl.decode().then(finish).catch(finish);
                  } else {
                    finish();
                  }
                }}
                sx={{
                  position: 'relative',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  userSelect: 'none',
                  opacity: isFullLoaded ? 1 : 0,
                  willChange: isFullLoaded ? 'auto' : 'opacity',
                  transition: instantRef.current ? 'none' : 'opacity 0.2s ease-out',
                }}
              />
            </>
          )}

          {hasNext && (
            <IconButton
              size="small"
              aria-label="Next photo"
              onClick={(e) => handleNext(e)}
              sx={{
                position: 'absolute',
                right: { xs: 8, sm: 16 },
                zIndex: 10,
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(22, 22, 21, 0.12)',
                color: '#161615',
                '&:hover': { bgcolor: '#161615', color: '#f5f2eb' },
              }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Bottom Filename Bar */}
        <Box
          sx={{
            px: { xs: 1.75, sm: 3 },
            pt: 1.1,
            pb: { xs: 'calc(10px + env(safe-area-inset-bottom, 0px))', sm: 1.2 },
            borderTop: '1px solid rgba(22, 22, 21, 0.09)',
            bgcolor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{ color: '#6b6860', fontFamily: "'JetBrains Mono', monospace", minWidth: 0 }}
          >
            Asset ID: {currentImage}{isVideo ? ' · Video' : ''}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#6b6860',
              fontFamily: "'JetBrains Mono', monospace",
              display: { xs: 'none', sm: 'inline' },
              whiteSpace: 'nowrap',
            }}
          >
            Use ← and → arrows to browse media
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#6b6860',
              fontFamily: "'JetBrains Mono', monospace",
              display: { xs: 'inline', sm: 'none' },
              whiteSpace: 'nowrap',
            }}
          >
            Swipe to browse
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
