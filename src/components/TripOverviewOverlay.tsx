import React from 'react';
import { NormalizedTrip } from '../types';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
} from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExploreIcon from '@mui/icons-material/Explore';

interface TripOverviewOverlayProps {
  trip: NormalizedTrip;
  onStartExpedition: () => void;
  onSelectDay: (dayIndex: number) => void;
}

export const TripOverviewOverlay: React.FC<TripOverviewOverlayProps> = ({
  trip,
  onStartExpedition,
  onSelectDay,
}) => {
  const totalSpots = trip.days.reduce((acc, d) => acc + d.spots.length, 0);
  const totalPhotos = trip.days.reduce(
    (acc, d) => acc + d.spots.reduce((sAcc, s) => sAcc + s.images.length, 0),
    0
  );
  const totalKm = trip.days.reduce((acc, d) => acc + (d.driving_distance_km || 0), 0);

  return (
    <Card
      sx={{
        position: 'absolute',
        top: 24,
        left: 24,
        maxWidth: 480,
        width: 'calc(100% - 48px)',
        zIndex: 1000,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        animation: 'fade-slide-up 0.4s ease-out',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Eyebrow */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Chip
            icon={<ExploreIcon sx={{ fontSize: '15px !important', color: '#38bdf8' }} />}
            label="Complete Expedition Route Map"
            size="small"
            sx={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
          />
          <Typography variant="caption" color="text.secondary">
            {trip.days.length} Days Itinerary
          </Typography>
        </Box>

        <Typography variant="h4" component="h2" sx={{ color: '#ffffff', mb: 1, lineHeight: 1.25 }}>
          {trip.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
          {trip.description}
        </Typography>

        {/* Stats Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 3 }}>
          {[
            { icon: <CalendarMonthIcon sx={{ fontSize: 18, color: '#38bdf8', mb: 0.5 }} />, value: trip.days.length, label: 'Days' },
            { icon: <PlaceIcon sx={{ fontSize: 18, color: '#38bdf8', mb: 0.5 }} />, value: totalSpots, label: 'Spots' },
            { icon: <PhotoCameraIcon sx={{ fontSize: 18, color: '#38bdf8', mb: 0.5 }} />, value: totalPhotos, label: 'Photos' },
            { icon: <DirectionsCarIcon sx={{ fontSize: 18, color: '#38bdf8', mb: 0.5 }} />, value: `${Math.round(totalKm)} km`, label: 'Drive' },
          ].map(({ icon, value, label }) => (
            <Box
              key={label}
              sx={{
                p: 1.2,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {icon}
              <Typography variant="h6" sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase' }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Day Color Legend */}
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: 12, fontWeight: 600 }}>
          Daily Routes (Color Coded on Map):
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          {trip.days.map((day, idx) => {
            const dayColor = day.color || '#38bdf8';
            return (
              <Box
                key={day.date || idx}
                onClick={() => onSelectDay(idx)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: dayColor, transform: 'translateX(4px)' },
                }}
              >
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: dayColor,
                    boxShadow: `0 0 10px ${dayColor}`,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                    Day {idx + 1}: {day.title || day.date}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    {day.date} • {day.spots.length} spots{day.driving_distance_km ? ` • ${day.driving_distance_km} km drive` : ''}
                  </Typography>
                </Box>
                <ArrowForwardIcon sx={{ fontSize: 16, color: dayColor, flexShrink: 0 }} />
              </Box>
            );
          })}
        </Box>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={onStartExpedition}
          startIcon={<NavigationIcon />}
          sx={{ py: 1.5, fontSize: '14.5px', boxShadow: '0 6px 20px rgba(14, 165, 233, 0.4)' }}
        >
          Start Day 1 Tour
        </Button>
      </CardContent>
    </Card>
  );
};
