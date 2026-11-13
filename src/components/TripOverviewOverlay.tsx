import React from 'react';
import { NormalizedTrip } from '../types';
import { getMediaUrl } from '../utils/media';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
} from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

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
  const coverAssetId = trip.cover_image || trip.days[0]?.spots[0]?.images?.[0] || '';

  return (
    <Card
      sx={{
        position: 'absolute',
        top: { xs: 'auto', md: 20 },
        bottom: { xs: 12, md: 'auto' },
        left: { xs: 12, md: 20 },
        width: { xs: 'calc(100% - 24px)', md: 400 },
        maxWidth: { xs: 'calc(100% - 24px)', md: 400 },
        maxHeight: { xs: '45%', md: 'calc(100% - 40px)' },
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        p: 0,
        overflow: 'hidden',
        bgcolor: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(22, 22, 21, 0.10)',
        boxShadow: '0 18px 46px rgba(22, 22, 21, 0.14)',
        animation: 'fade-slide-up 0.4s ease-out',
      }}
    >
      {/* Full-bleed Cover Photo Hero Banner */}
      {coverAssetId && (
        <Box sx={{ position: 'relative', height: 112, flexShrink: 0, overflow: 'hidden', bgcolor: '#ebe6dc' }}>
          <Box
            component="img"
            src={getMediaUrl(coverAssetId, 'grid')}
            alt={trip.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(255,255,255,0) 20%, #ffffff 100%)',
            }}
          />
        </Box>
      )}

      <CardContent
        sx={{
          p: 2.5,
          pt: coverAssetId ? 1.25 : 2.5,
          '&:last-child': { pb: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          gap: 1.5,
        }}
      >
        {/* Eyebrow */}
        <Box sx={{ flexShrink: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.9,
              mb: 0.65,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#6b6860',
            }}
          >
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#b91c1c', flexShrink: 0 }} />
            <span>COMPLETE EXPEDITION  ·  {trip.days.length} DAYS</span>
          </Box>

          <Typography
            variant="h5"
            component="h2"
            sx={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: '#161615',
              mb: 0.6,
              fontWeight: 400,
              fontSize: '26px',
              lineHeight: 1.1,
            }}
          >
            {trip.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#57544d',
              lineHeight: 1.55,
              fontSize: 12.5,
              display: { xs: 'none', sm: '-webkit-box' },
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {trip.description}
          </Typography>
        </Box>

        {/* Hairline 4-Column Stat Strip */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            borderTop: '1px solid rgba(22, 22, 21, 0.10)',
            borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
            py: 1,
            flexShrink: 0,
          }}
        >
          {[
            { value: trip.days.length, label: 'Days' },
            { value: totalSpots, label: 'Stops' },
            { value: totalPhotos, label: 'Photos' },
            { value: `${Math.round(totalKm)}`, label: 'Km' },
          ].map(({ value, label }, idx) => (
            <Box
              key={label}
              sx={{
                px: idx === 0 ? 0 : 1,
                pr: 1,
                borderRight: idx < 3 ? '1px solid rgba(22, 22, 21, 0.10)' : 'none',
              }}
            >
              <Typography
                sx={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: '19px',
                  fontWeight: 400,
                  color: '#161615',
                  lineHeight: 1.1,
                }}
              >
                {value}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#6b6860',
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Connected 15-Day Route Timeline */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            pr: 0.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'rgba(22, 22, 21, 0.18)',
              borderRadius: 2,
            },
          }}
        >
          {trip.days.map((day, idx) => {
            const dayColor = day.color || '#b91c1c';
            return (
              <Box
                key={day.date || idx}
                onClick={() => onSelectDay(idx)}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  pl: 2.5,
                  pr: 1,
                  py: 0.85,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.16s ease',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 7,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    bgcolor: 'rgba(22, 22, 21, 0.12)',
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 3.5,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: dayColor,
                    border: '1.5px solid #ffffff',
                    boxShadow: '0 0 0 1px rgba(22, 22, 21, 0.10)',
                  },
                  '&:hover': { bgcolor: 'rgba(22, 22, 21, 0.04)' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: '#161615', fontWeight: 600, fontSize: 12.5 }}>
                    Day {idx + 1}: {day.title || day.date}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#6b6860',
                      fontSize: '11px',
                    }}
                  >
                    {day.date} · {day.spots.length} spots
                    {day.driving_distance_km ? ` · ${day.driving_distance_km} km` : ''}
                  </Typography>
                </Box>
                <ArrowForwardIcon sx={{ fontSize: 14, color: '#6b6860', flexShrink: 0 }} />
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
          sx={{
            py: 1.1,
            fontSize: '13.5px',
            flexShrink: 0,
            bgcolor: '#161615',
            color: '#f5f2eb',
            borderRadius: '999px',
            '&:hover': { bgcolor: '#2c2c2a' },
          }}
        >
          Start Day 1 Tour
        </Button>
      </CardContent>
    </Card>
  );
};
