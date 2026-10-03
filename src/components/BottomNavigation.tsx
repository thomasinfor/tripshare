import React, { useState } from 'react';
import { Spot, ItineraryDay, ViewMode } from '../types';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MapIcon from '@mui/icons-material/Map';
import PublicIcon from '@mui/icons-material/Public';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

interface BottomNavigationProps {
  days: ItineraryDay[];
  currentDayIndex: number;
  currentSpotIndex: number;
  viewMode: ViewMode;
  onOpenTripOverview: () => void;
  onSelectDay: (dayIndex: number) => void;
  onSelectSpot: (spotIndex: number) => void;
  onToggleDayOverview: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  days,
  currentDayIndex,
  currentSpotIndex,
  viewMode,
  onOpenTripOverview,
  onSelectDay,
  onSelectSpot,
  onToggleDayOverview,
  onPrev,
  onNext,
}) => {
  const currentDay = days[currentDayIndex];
  const spots = currentDay?.spots || [];
  const currentSpot = spots[currentSpotIndex];

  // Tooltip hover state
  const [hoveredSpotIdx, setHoveredSpotIdx] = useState<number | null>(null);

  // Auto-play slideshow tour
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        onNext();
      }, 4500);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, onNext]);

  return (
    <Box
      component="footer"
      className="bottom-navigation-bar"
      sx={{
        height: 'var(--bottom-bar-height)',
        bgcolor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(18px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        px: { xs: 2, sm: 3 },
        py: 1,
        zIndex: 100,
      }}
    >
      {/* Top Controls Row: Day Tabs & Overview Buttons */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* Day Tabs */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', overflowX: 'auto', minWidth: 0 }}>
          {/* Entire Trip Overview Button */}
          <Chip
            icon={<PublicIcon sx={{ fontSize: '15px !important' }} />}
            label="Entire Trip Map"
            size="small"
            clickable
            onClick={onOpenTripOverview}
            variant={viewMode === 'trip-overview' ? 'filled' : 'outlined'}
            sx={{
              bgcolor: viewMode === 'trip-overview' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: viewMode === 'trip-overview' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
              color: viewMode === 'trip-overview' ? '#38bdf8' : 'text.secondary',
              fontWeight: 700,
              fontSize: '12px'
            }}
          />

          <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'inline' } }}>
            |
          </Typography>

          {/* Individual Day Tabs */}
          {days.map((day, idx) => {
            const isActive = viewMode !== 'trip-overview' && idx === currentDayIndex;
            const dayColor = day.color || '#38bdf8';
            return (
              <Chip
                key={day.date || idx}
                label={`Day ${idx + 1}: ${day.spots.length} spots`}
                size="small"
                clickable
                onClick={() => onSelectDay(idx)}
                variant={isActive ? 'filled' : 'outlined'}
                avatar={
                  <Box
                    sx={{
                      width: '8px !important',
                      height: '8px !important',
                      borderRadius: '50% !important',
                      bgcolor: dayColor,
                      boxShadow: `0 0 6px ${dayColor}`
                    }}
                  />
                }
                sx={{
                  bgcolor: isActive ? `${dayColor}25` : 'rgba(255, 255, 255, 0.04)',
                  borderColor: isActive ? dayColor : 'rgba(255, 255, 255, 0.1)',
                  color: isActive ? '#ffffff' : 'text.secondary',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              />
            );
          })}
        </Stack>

        {/* Action Controls: Day Route Toggle & Autoplay */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Button
            size="small"
            variant={viewMode === 'day-overview' ? 'contained' : 'outlined'}
            onClick={onToggleDayOverview}
            startIcon={<MapIcon sx={{ fontSize: 15 }} />}
            sx={{
              fontSize: '12px',
              py: 0.4,
              px: 1.2,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              display: { xs: 'none', sm: 'inline-flex' }
            }}
          >
            {viewMode === 'day-overview' ? 'Spot Detail' : 'Day Route'}
          </Button>

          <Button
            size="small"
            onClick={() => setIsPlaying(!isPlaying)}
            startIcon={isPlaying ? <PauseIcon sx={{ fontSize: 15 }} /> : <PlayArrowIcon sx={{ fontSize: 15 }} />}
            sx={{
              fontSize: '12px',
              py: 0.4,
              px: 1.2,
              bgcolor: isPlaying ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              color: isPlaying ? '#34d399' : 'text.secondary',
              border: isPlaying ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {isPlaying ? 'Pause' : 'Tour'}
          </Button>
        </Stack>
      </Stack>

      {/* Main Scrubber Row */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 0.5 }}>
        {/* Previous Button */}
        <Button
          size="small"
          onClick={onPrev}
          startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />}
          sx={{
            minWidth: { xs: 36, sm: 80 },
            px: { xs: 1, sm: 2 },
            py: 0.8,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            fontSize: '12.5px'
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {viewMode === 'trip-overview'
              ? 'Prev'
              : viewMode === 'day-overview'
              ? (currentDayIndex === 0 ? 'Trip Map' : 'Prev Day')
              : (currentSpotIndex === 0 ? 'Day Route' : 'Prev')}
          </Box>
        </Button>

        {/* Timeline Slider Track */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box className="timeline-track-container" sx={{ position: 'relative', height: 30, display: 'flex', alignItems: 'center' }}>
            {/* Background line */}
            <Box className="timeline-base-line" />

            {/* Filled progress line */}
            <Box
              className="timeline-progress-line"
              sx={{
                width:
                  viewMode !== 'spot-detail'
                    ? '0%'
                    : spots.length > 1
                    ? `${(currentSpotIndex / (spots.length - 1)) * 100}%`
                    : '100%',
              }}
            />

            {/* Stepped Spot Nodes */}
            <Box className="timeline-nodes-container">
              {/* Day Route Map Node */}
              <Tooltip title="Day Route Map Overview" arrow>
                <Box
                  className={`timeline-node overview-node ${viewMode === 'day-overview' ? 'active' : ''}`}
                  onClick={onToggleDayOverview}
                >
                  <Box className="node-dot">
                    <MapIcon sx={{ fontSize: 11 }} />
                  </Box>
                </Box>
              </Tooltip>

              {/* Spot Nodes */}
              {spots.map((spot, idx) => {
                const isActive = viewMode === 'spot-detail' && idx === currentSpotIndex;
                const isPassed = viewMode === 'spot-detail' && idx < currentSpotIndex;
                const isHovered = hoveredSpotIdx === idx;

                return (
                  <Box
                    key={spot.id || idx}
                    className={`timeline-node ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
                    onClick={() => onSelectSpot(idx)}
                    onMouseEnter={() => setHoveredSpotIdx(idx)}
                    onMouseLeave={() => setHoveredSpotIdx(null)}
                  >
                    <Box className="node-dot">
                      <span className="node-num">{idx + 1}</span>
                    </Box>

                    {/* Popover Preview on hover */}
                    {isHovered && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 34,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          bgcolor: 'rgba(15, 23, 42, 0.95)',
                          backdropFilter: 'blur(14px)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: 2,
                          p: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.2,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.5)',
                          pointerEvents: 'none',
                          zIndex: 1000,
                          animation: 'fade-in 0.15s ease-out',
                        }}
                      >
                        {spot.images?.[0] && (
                          <Box
                            component="img"
                            src={spot.images[0]}
                            alt={spot.name}
                            sx={{ width: 42, height: 42, borderRadius: 1, objectFit: 'cover', bgcolor: '#000' }}
                          />
                        )}
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>
                            #{idx + 1} {spot.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, display: 'block' }}>
                            {spot.time || ''} • {spot.images.length} photos
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Status text */}
          <Box sx={{ textAlign: 'center', fontSize: '12px', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {viewMode === 'trip-overview' ? (
              <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 600 }}>
                🌍 Entire Expedition Route Map (All 3 Days Color Coded)
              </Typography>
            ) : viewMode === 'day-overview' ? (
              <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 600 }}>
                📍 Full Day {currentDayIndex + 1} Route Overview ({spots.length} spots • {currentDay?.driving_distance_km || 0} km drive)
              </Typography>
            ) : currentSpot ? (
              <Typography variant="caption">
                <strong style={{ color: '#38bdf8' }}>Spot {currentSpotIndex + 1} of {spots.length}:</strong>{' '}
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{currentSpot.name}</span>
                {currentSpot.driving_distance_km ? (
                  <span style={{ color: '#34d399', marginLeft: 8 }}>
                    🚗 +{currentSpot.driving_distance_km} km
                  </span>
                ) : null}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {/* Next Button */}
        <Button
          size="small"
          onClick={onNext}
          endIcon={<ArrowForwardIcon sx={{ fontSize: 17 }} />}
          sx={{
            minWidth: { xs: 36, sm: 80 },
            px: { xs: 1, sm: 2 },
            py: 0.8,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            fontSize: '12.5px'
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {viewMode === 'trip-overview'
              ? 'Start Day 1'
              : viewMode === 'day-overview'
              ? 'Start Day'
              : currentSpotIndex >= spots.length - 1
              ? (currentDayIndex < days.length - 1 ? 'Next Day' : 'Finish')
              : 'Next'}
          </Box>
        </Button>
      </Stack>
    </Box>
  );
};
