import React, { useState, useEffect } from 'react';
import { Spot } from '../types';
import { formatCoords } from '../utils/geo';
import {
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
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

export const SpotShowcase: React.FC<SpotShowcaseProps> = ({
  spot,
  spotNumber,
  totalSpots,
  dayTitle,
  dayColor = '#38bdf8',
  distanceFromPrev,
  onOpenLightbox,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [spot.id, spot.name]);

  const images = spot.images && spot.images.length > 0 ? spot.images : [];
  const currentImage = images[activeImageIndex] || '';

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const getTagFromFilename = (filename: string) => {
    if (filename.includes('LONG_EXPOSURE')) return 'Long Exposure';
    if (filename.includes('NIGHT')) return 'Night Sky / Aurora';
    if (filename.includes('MACRO')) return 'Macro Focus';
    return null;
  };

  const currentTag = currentImage ? getTagFromFilename(currentImage) : null;
  const driveDist = spot.driving_distance_km || distanceFromPrev;
  const driveTime = spot.driving_duration_min;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        p: { xs: 2, sm: 3 },
        gap: 2,
        overflowY: 'auto',
      }}
    >
      {/* Spot Header */}
      <Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1, alignItems: 'center' }}>
          <Chip
            icon={<ExploreIcon sx={{ fontSize: '14px !important', color: `${dayColor} !important` }} />}
            label={`Spot ${spotNumber} of ${totalSpots}`}
            size="small"
            sx={{
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              fontWeight: 700,
            }}
          />
          <Chip
            label={dayTitle}
            size="small"
            sx={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }}
          />
          {driveDist !== undefined && driveDist > 0 && (
            <Chip
              icon={<DirectionsCarIcon sx={{ fontSize: '14px !important', color: '#34d399 !important' }} />}
              label={`+${driveDist} km drive${driveTime ? ` (~${driveTime} min)` : ''}`}
              size="small"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                color: '#34d399',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                fontWeight: 600,
              }}
            />
          )}
        </Box>

        <Typography variant="h4" component="h1" sx={{ color: '#ffffff', mb: 1.2, lineHeight: 1.25 }}>
          {spot.name}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
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
        </Box>

        {spot.description && (
          <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.6 }}>
            {spot.description}
          </Typography>
        )}
      </Box>

      {/* Image Gallery */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 1.5 }}>
        {images.length > 0 ? (
          <Box
            onClick={() => onOpenLightbox(currentImage)}
            sx={{
              flex: 1,
              position: 'relative',
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: '#000',
              cursor: 'zoom-in',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              minHeight: 200,
            }}
          >
            <Box
              component="img"
              key={currentImage}
              src={currentImage}
              alt={`${spot.name} - Photo ${activeImageIndex + 1}`}
              loading="eager"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transition: 'transform 0.4s ease',
                bgcolor: '#000',
                '&:hover': {
                  transform: 'scale(1.02)',
                },
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* Top badges */}
            <Box
              sx={{
                position: 'absolute',
                top: 14,
                left: 14,
                right: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {currentTag ? (
                <Chip
                  label={currentTag}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(15,23,42,0.85)',
                    color: '#38bdf8',
                    backdropFilter: 'blur(8px)',
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
              ) : <Box />}
              <Chip
                label={`${activeImageIndex + 1} / ${images.length}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(0,0,0,0.75)',
                  color: '#ffffff',
                  backdropFilter: 'blur(8px)',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              />
            </Box>

            {/* Fullscreen button */}
            <Tooltip title="View Fullscreen" arrow>
              <IconButton
                onClick={(e) => { e.stopPropagation(); onOpenLightbox(currentImage); }}
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: 14,
                  right: 14,
                  bgcolor: 'rgba(15,23,42,0.8)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#0284c7' },
                }}
              >
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Prev / Next photo buttons */}
            {images.length > 1 && (
              <>
                <IconButton
                  onClick={handlePrevImage}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: 12,
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(15,23,42,0.75)',
                    backdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    '&:hover': { bgcolor: '#0284c7' },
                  }}
                >
                  <ArrowBackIosNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton
                  onClick={handleNextImage}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    right: 12,
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(15,23,42,0.75)',
                    backdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    '&:hover': { bgcolor: '#0284c7' },
                  }}
                >
                  <ArrowForwardIosIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </>
            )}
          </Box>
        ) : (
          <Box
            sx={{
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
        )}

        {/* Thumbnail Filmstrip */}
        {images.length > 1 && (
          <Box sx={{ height: 72, minHeight: 72 }}>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                height: '100%',
                overflowX: 'auto',
                pb: 0.5,
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'rgba(255,255,255,0.15)',
                  borderRadius: 2,
                },
              }}
            >
              {images.map((img, idx) => (
                <Box
                  component="button"
                  key={img}
                  onClick={() => setActiveImageIndex(idx)}
                  sx={{
                    height: '100%',
                    aspectRatio: '4/3',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    p: 0,
                    border: '2px solid',
                    borderColor: idx === activeImageIndex ? '#06b6d4' : 'transparent',
                    boxShadow: idx === activeImageIndex ? '0 0 12px rgba(6, 182, 212, 0.5)' : 'none',
                    bgcolor: '#000',
                    cursor: 'pointer',
                    flexShrink: 0,
                    opacity: idx === activeImageIndex ? 1 : 0.6,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      opacity: 0.9,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
