import React from 'react';
import { ItineraryDay } from '../types';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Stack,
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface DayOverviewOverlayProps {
  day: ItineraryDay;
  dayIndex: number;
  totalDays: number;
  onStartJourney: (spotIndex?: number) => void;
}

export const DayOverviewOverlay: React.FC<DayOverviewOverlayProps> = ({
  day,
  dayIndex,
  totalDays,
  onStartJourney,
}) => {
  const totalPhotos = day.spots.reduce((acc, s) => acc + s.images.length, 0);
  const totalKm = day.driving_distance_km || 0;
  const dayColor = day.color || '#38bdf8';

  return (
    <Card
      className="day-overview-floating-panel"
      sx={{
        position: 'absolute',
        top: 24,
        left: 24,
        maxWidth: 440,
        width: 'calc(100% - 48px)',
        zIndex: 1000,
        p: 0.5,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        animation: 'fade-slide-up 0.4s ease-out'
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Chip
            icon={<CalendarMonthIcon sx={{ fontSize: '14px !important', color: `${dayColor} !important` }} />}
            label={`Day ${dayIndex + 1} of ${totalDays} Route`}
            size="small"
            sx={{
              backgroundColor: `${dayColor}20`,
              color: dayColor,
              borderColor: `${dayColor}40`,
              fontWeight: 700
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {day.date}
          </Typography>
        </Stack>

        <Typography variant="h5" component="h2" sx={{ color: '#ffffff', mb: 2, fontWeight: 700 }}>
          {day.title || `Day ${dayIndex + 1}`}
        </Typography>

        {/* Stats Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2.5 }}>
          <Box sx={{
            p: 1.2,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <PlaceIcon sx={{ fontSize: 18, color: dayColor, mb: 0.5 }} />
            <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {day.spots.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase' }}>
              Spots
            </Typography>
          </Box>

          <Box sx={{
            p: 1.2,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <PhotoCameraIcon sx={{ fontSize: 18, color: dayColor, mb: 0.5 }} />
            <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {totalPhotos}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase' }}>
              Photos
            </Typography>
          </Box>

          <Box sx={{
            p: 1.2,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <DirectionsCarIcon sx={{ fontSize: 18, color: dayColor, mb: 0.5 }} />
            <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {Math.round(totalKm)} km
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase' }}>
              Drive
            </Typography>
          </Box>
        </Box>

        {/* Spot quick list strip */}
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, fontSize: 12, fontWeight: 600 }}>
            Day Itinerary (Numbered along driving route):
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              maxHeight: 200,
              overflowY: 'auto',
              pr: 0.5,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 2,
              },
            }}
          >
            {day.spots.map((spot, idx) => (
              <Box
                key={spot.id || idx}
                onClick={() => onStartJourney(idx)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: dayColor,
                    transform: 'translateX(3px)'
                  }
                }}
              >
                <Typography variant="caption" sx={{ color: dayColor, fontWeight: 700, minWidth: 22 }}>
                  #{idx + 1}
                </Typography>
                {spot.images?.[0] ? (
                  <Box
                    component="img"
                    src={spot.images[0]}
                    alt={spot.name}
                    sx={{ width: 36, height: 36, borderRadius: 1, objectFit: 'cover', bgcolor: '#000' }}
                  />
                ) : (
                  <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)' }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                    {spot.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    {spot.time || ''} • {spot.images.length} photos {spot.driving_distance_km ? `• +${spot.driving_distance_km} km` : ''}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => onStartJourney(0)}
          startIcon={<PlayArrowIcon />}
          endIcon={<ChevronRightIcon />}
          sx={{
            py: 1.4,
            fontSize: '14px',
            bgcolor: dayColor,
            '&:hover': { bgcolor: `${dayColor}cc` }
          }}
        >
          Start Day Tour (Spot 1)
        </Button>
      </CardContent>
    </Card>
  );
};
