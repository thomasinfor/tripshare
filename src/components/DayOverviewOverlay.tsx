import React from 'react';
import { ItineraryDay } from '../types';
import { getMediaUrl } from '../utils/media';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
  const dayColor = day.color || '#b91c1c';
  const coverAssetId = day.spots.find((s) => s.images?.[0])?.images?.[0] || '';

  return (
    <Card
      className="day-overview-floating-panel"
      sx={{
        position: 'absolute',
        top: { xs: 'auto', md: 20 },
        bottom: { xs: 12, md: 'auto' },
        left: { xs: 12, md: 20 },
        width: { xs: 'calc(100% - 24px)', md: 390 },
        maxWidth: { xs: 'calc(100% - 24px)', md: 390 },
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
        <Box sx={{ position: 'relative', height: 124, flexShrink: 0, overflow: 'hidden', bgcolor: '#ebe6dc' }}>
          <Box
            component="img"
            src={getMediaUrl(coverAssetId, 'grid')}
            alt={day.title || `Day ${dayIndex + 1}`}
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
          gap: 1.75,
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.9,
              mb: 0.75,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#6b6860',
            }}
          >
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dayColor, flexShrink: 0 }} />
            <span>
              DAY {String(dayIndex + 1).padStart(2, '0')} OF {String(totalDays).padStart(2, '0')}
              {day.date ? `  ·  ${day.date}` : ''}
            </span>
          </Box>

          <Typography
            variant="h5"
            component="h2"
            sx={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: '#161615',
              fontWeight: 400,
              fontSize: '26px',
              lineHeight: 1.1,
            }}
          >
            {day.title || `Day ${dayIndex + 1}`}
          </Typography>
        </Box>

        {/* Hairline 3-Column Stat Strip */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            borderTop: '1px solid rgba(22, 22, 21, 0.10)',
            borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
            py: 1.1,
            flexShrink: 0,
          }}
        >
          {[
            { value: day.spots.length, label: 'Stops' },
            { value: totalPhotos, label: 'Photos' },
            { value: `${Math.round(totalKm)} km`, label: 'Drive' },
          ].map(({ value, label }, idx) => (
            <Box
              key={label}
              sx={{
                px: idx === 0 ? 0 : 1.25,
                pr: 1.25,
                borderRight: idx < 2 ? '1px solid rgba(22, 22, 21, 0.10)' : 'none',
              }}
            >
              <Typography
                sx={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: '20px',
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

        {/* Connected Vertical Route Timeline */}
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
          {day.spots.map((spot, idx) => (
            <Box
              key={spot.id || idx}
              onClick={() => onStartJourney(idx)}
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 1.4,
                pl: 2.5,
                pr: 1,
                py: 0.9,
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
                  left: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: '#ffffff',
                  border: `1.5px solid ${dayColor}`,
                },
                '&:hover': {
                  bgcolor: 'rgba(22, 22, 21, 0.04)',
                },
              }}
            >
              {spot.images?.[0] ? (
                <Box
                  component="img"
                  src={getMediaUrl(spot.images[0], 'thumbnail')}
                  alt={spot.name}
                  loading="lazy"
                  sx={{ width: 42, height: 42, borderRadius: '4px', objectFit: 'cover', bgcolor: '#ebe6dc', flexShrink: 0 }}
                />
              ) : (
                <Box sx={{ width: 42, height: 42, borderRadius: '4px', bgcolor: '#ebe6dc', flexShrink: 0 }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ color: '#161615', fontWeight: 600, fontSize: 13 }}>
                  {idx + 1}. {spot.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#6b6860',
                    fontSize: '11px',
                    display: 'block',
                  }}
                >
                  {spot.time || '—'} · {spot.images.length} photos
                  {spot.driving_distance_km ? ` · +${spot.driving_distance_km} km` : ''}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => onStartJourney(0)}
          startIcon={<PlayArrowIcon />}
          endIcon={<ChevronRightIcon />}
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
          Start Day Tour (Spot 1)
        </Button>
      </CardContent>
    </Card>
  );
};
