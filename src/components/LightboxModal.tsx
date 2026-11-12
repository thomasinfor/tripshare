import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DownloadIcon from '@mui/icons-material/Download';
import { getMediaUrl } from '../utils/media';

interface LightboxModalProps {
  images: string[];
  currentImage: string;
  spotName: string;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  images,
  currentImage,
  spotName,
  onClose,
  onSelectImage,
}) => {
  const currentIndex = images.indexOf(currentImage);
  const [isFullLoaded, setIsFullLoaded] = useState(false);

  useEffect(() => {
    setIsFullLoaded(false);
  }, [currentImage]);

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFullLoaded(false);
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onSelectImage(images[prevIdx]);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFullLoaded(false);
    const nextIdx = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onSelectImage(images[nextIdx]);
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

  const thumbUrl = getMediaUrl(currentImage, 'thumbnail');
  const previewUrl = getMediaUrl(currentImage, 'preview');
  const originalUrl = getMediaUrl(currentImage, 'original');

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'rgba(5, 8, 15, 0.96)',
            backdropFilter: 'blur(20px)',
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            height: '88vh',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
              {spotName}
            </Typography>
            <Typography variant="caption" sx={{ color: '#38bdf8', bgcolor: 'rgba(56, 189, 248, 0.12)', px: 1, py: 0.3, borderRadius: 1, fontWeight: 700 }}>
              {currentIndex + 1} of {images.length}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Download original photo">
              <IconButton
                component="a"
                href={originalUrl}
                download={`${currentImage}.jpg`}
                target="_blank"
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close (Esc)">
              <IconButton
                onClick={onClose}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Center Image Viewport */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            bgcolor: '#000000',
            overflow: 'hidden',
          }}
        >
          {images.length > 1 && (
            <IconButton
              onClick={(e) => handlePrev(e)}
              sx={{
                position: 'absolute',
                left: 16,
                zIndex: 10,
                bgcolor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                '&:hover': { bgcolor: '#0284c7' },
              }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
          )}

          {/* Instant blurred thumbnail */}
          <Box
            component="img"
            key={`lb-thumb-${currentImage}`}
            src={thumbUrl}
            alt=""
            sx={{
              position: 'absolute',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              filter: isFullLoaded ? 'none' : 'blur(16px)',
              opacity: isFullLoaded ? 0 : 0.9,
              transition: 'opacity 0.35s ease',
              pointerEvents: 'none',
            }}
          />

          {/* High-res photo */}
          <Box
            component="img"
            key={`lb-preview-${currentImage}`}
            src={previewUrl}
            alt={`${spotName} fullscreen`}
            onLoad={() => setIsFullLoaded(true)}
            sx={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              opacity: isFullLoaded ? 1 : 0.3,
              transition: 'opacity 0.3s ease',
            }}
          />

          {images.length > 1 && (
            <IconButton
              onClick={(e) => handleNext(e)}
              sx={{
                position: 'absolute',
                right: 16,
                zIndex: 10,
                bgcolor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                '&:hover': { bgcolor: '#0284c7' },
              }}
            >
              <ArrowForwardIosIcon />
            </IconButton>
          )}
        </Box>

        {/* Bottom Filename Bar */}
        <Box
          sx={{
            px: 3,
            py: 1.2,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            Asset ID: {currentImage}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Use ← and → arrows to browse photos
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
