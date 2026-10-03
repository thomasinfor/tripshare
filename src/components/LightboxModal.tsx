import React, { useEffect } from 'react';
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

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onSelectImage(images[prevIdx]);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const filename = currentImage.split('/').pop() || '';

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'rgba(9, 13, 22, 0.96)',
            backdropFilter: 'blur(24px)',
            borderRadius: 3,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9)',
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', display: 'flex', flexDirection: 'column', height: '85vh' }}>
        {/* Top Header Bar */}
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
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
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
                href={currentImage}
                download={filename}
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

          <Box
            component="img"
            src={currentImage}
            alt={`${spotName} fullscreen`}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none',
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
            {filename}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Use ← and → arrows to browse photos
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
