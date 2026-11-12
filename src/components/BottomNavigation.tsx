import React, { useState, useEffect, useRef } from 'react';
import { Spot, ItineraryDay, ViewMode } from '../types';
import { getMediaUrl } from '../utils/media';
import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MapIcon from '@mui/icons-material/Map';
import PublicIcon from '@mui/icons-material/Public';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

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

const TOUR_SLIDE_DURATION_MS = 5000;
const TICK_MS = 100;

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

  // Auto-play slideshow tour with visual countdown
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingMs, setRemainingMs] = useState(TOUR_SLIDE_DURATION_MS);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const activeDayChipRef = useRef<HTMLDivElement | null>(null);

  // Ensure active day chip is visible on narrow viewports
  useEffect(() => {
    if (viewMode !== 'trip-overview' && activeDayChipRef.current) {
      activeDayChipRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest',
      });
    }
  }, [currentDayIndex, viewMode]);

  // Reset countdown whenever slide position or mode changes
  useEffect(() => {
    setRemainingMs(TOUR_SLIDE_DURATION_MS);
  }, [currentDayIndex, currentSpotIndex, viewMode]);

  useEffect(() => {
    if (!isPlaying) {
      setRemainingMs(TOUR_SLIDE_DURATION_MS);
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= TICK_MS) {
          onNextRef.current();
          return TOUR_SLIDE_DURATION_MS;
        }
        return prev - TICK_MS;
      });
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [isPlaying]);

  // Tour countdown progress calculation
  const tourProgressPercent = isPlaying
    ? Math.min(100, Math.max(0, ((TOUR_SLIDE_DURATION_MS - remainingMs) / TOUR_SLIDE_DURATION_MS) * 100))
    : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  // Step calculations for timeline scrubber:
  // Step 0: Day Route Map Overview (the Map icon)
  // Steps 1..N: Spot 0 to Spot N-1
  const maxStepIndex = spots.length; // e.g. 5 spots => 6 total nodes (0 to 5)
  const currentStep =
    viewMode === 'day-overview' || viewMode === 'trip-overview'
      ? 0
      : currentSpotIndex + 1;
  const scrubberProgressPercent =
    maxStepIndex > 0 ? Math.min(100, Math.max(0, (currentStep / maxStepIndex) * 100)) : 0;

  return (
    <Box
      component="footer"
      className="bottom-navigation-bar"
      sx={{
        position: 'relative',
        height: 'var(--bottom-bar-height)',
        bgcolor: 'rgba(15, 23, 42, 0.90)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        px: { xs: 1.5, sm: 2.5 },
        py: 0.8,
        zIndex: 100,
      }}
    >
      {/* Top Controls Row: Day Tabs & Overview Buttons */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* Day Tabs - active chip expanded, inactive chips compact so all fit */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            overflowX: 'auto',
            minWidth: 0,
            py: 0.2,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {/* Entire Trip Overview Button */}
          <Tooltip title={`View Entire ${days.length}-Day Route Map`} arrow>
            <Chip
              icon={<PublicIcon sx={{ fontSize: '13px !important' }} />}
              label="All Map"
              size="small"
              clickable
              onClick={onOpenTripOverview}
              variant={viewMode === 'trip-overview' ? 'filled' : 'outlined'}
              sx={{
                height: 24,
                px: 0.5,
                bgcolor: viewMode === 'trip-overview' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: viewMode === 'trip-overview' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                color: viewMode === 'trip-overview' ? '#38bdf8' : 'text.secondary',
                fontWeight: 700,
                fontSize: '11px',
                flexShrink: 0,
              }}
            />
          </Tooltip>

          <Box sx={{ width: '1px', height: 16, bgcolor: 'rgba(255, 255, 255, 0.12)', mx: 0.2, flexShrink: 0 }} />

          {/* Individual Day Tabs */}
          {days.map((day, idx) => {
            const isActive = viewMode !== 'trip-overview' && idx === currentDayIndex;
            const dayColor = day.color || '#38bdf8';
            return (
              <Tooltip
                key={day.date || idx}
                title={`Day ${idx + 1}: ${day.spots.length} spots • ${day.title || day.date}`}
                arrow
              >
                <Chip
                  ref={isActive ? activeDayChipRef : undefined}
                  label={isActive ? `Day ${idx + 1}: ${day.spots.length} spots` : `D${idx + 1}`}
                  size="small"
                  clickable
                  onClick={() => onSelectDay(idx)}
                  variant={isActive ? 'filled' : 'outlined'}
                  avatar={
                    <Box
                      sx={{
                        width: isActive ? '8px !important' : '6px !important',
                        height: isActive ? '8px !important' : '6px !important',
                        borderRadius: '50% !important',
                        bgcolor: dayColor,
                        boxShadow: isActive ? `0 0 6px ${dayColor}` : 'none',
                      }}
                    />
                  }
                  sx={{
                    height: 24,
                    minWidth: isActive ? 'auto' : 38,
                    px: isActive ? 0.6 : 0.2,
                    bgcolor: isActive ? `${dayColor}28` : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isActive ? dayColor : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#ffffff' : 'text.secondary',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: `${dayColor}20`,
                      borderColor: dayColor,
                      color: '#ffffff',
                    },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        {/* Action Controls: Day Route Toggle & Autoplay Tour */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Button
            size="small"
            variant={viewMode === 'day-overview' ? 'contained' : 'outlined'}
            onClick={onToggleDayOverview}
            startIcon={<MapIcon sx={{ fontSize: 14 }} />}
            sx={{
              fontSize: '11.5px',
              py: 0.35,
              px: 1,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            {viewMode === 'day-overview' ? 'Spot Detail' : 'Day Route'}
          </Button>

          {/* Tour Button with circular countdown indicator */}
          <Button
            size="small"
            onClick={() => setIsPlaying(!isPlaying)}
            startIcon={
              isPlaying ? (
                <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress
                    variant="determinate"
                    value={tourProgressPercent}
                    size={16}
                    thickness={6}
                    sx={{ color: '#10b981' }}
                  />
                  <PauseIcon sx={{ position: 'absolute', fontSize: 10, color: '#34d399' }} />
                </Box>
              ) : (
                <PlayArrowIcon sx={{ fontSize: 15 }} />
              )
            }
            sx={{
              fontSize: '11.5px',
              fontWeight: 600,
              py: 0.35,
              px: 1.2,
              bgcolor: isPlaying ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              color: isPlaying ? '#34d399' : 'text.secondary',
              border: isPlaying ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.2s',
            }}
          >
            {isPlaying ? `Pause (${remainingSeconds}s)` : 'Tour'}
          </Button>
        </Stack>
      </Stack>

      {/* Main Scrubber Row */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.3 }}>
        {/* Previous Button */}
        <Button
          size="small"
          onClick={onPrev}
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          sx={{
            minWidth: { xs: 34, sm: 76 },
            px: { xs: 0.8, sm: 1.5 },
            py: 0.6,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            fontSize: '12px',
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
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.3, minWidth: 0 }}>
          <Box className="timeline-track-container" sx={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
            {/* Base Rail and Active Progress Fill - exactly aligned to dot centers (11px left and right) */}
            <Box className="timeline-track-rail">
              <Box
                className="timeline-progress-fill"
                sx={{
                  width: `${scrubberProgressPercent}%`,
                }}
              />
            </Box>

            {/* Stepped Spot Nodes */}
            <Box className="timeline-nodes-container">
              {/* Day Route Map Node */}
              <Tooltip title="Day Route Map Overview" arrow>
                <Box
                  className={`timeline-node overview-node ${currentStep === 0 ? 'active' : 'passed'}`}
                  onClick={onToggleDayOverview}
                >
                  <Box className="node-dot">
                    <MapIcon sx={{ fontSize: 11 }} />
                  </Box>
                </Box>
              </Tooltip>

              {/* Spot Nodes */}
              {spots.map((spot, idx) => {
                const stepNum = idx + 1;
                const isActive = viewMode === 'spot-detail' && currentStep === stepNum;
                const isPassed = currentStep > stepNum;
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
                            src={getMediaUrl(spot.images[0], 'thumbnail')}
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
          <Box sx={{ textAlign: 'center', fontSize: '11.5px', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {viewMode === 'trip-overview' ? (
              <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 600, fontSize: '11.5px' }}>
                🌍 Entire Expedition Route Map (All {days.length} Days Color Coded)
              </Typography>
            ) : viewMode === 'day-overview' ? (
              <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 600, fontSize: '11.5px' }}>
                📍 Full Day {currentDayIndex + 1} Route Overview ({spots.length} spots • {currentDay?.driving_distance_km || 0} km drive)
              </Typography>
            ) : currentSpot ? (
              <Typography variant="caption" sx={{ fontSize: '11.5px' }}>
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
          endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
          sx={{
            minWidth: { xs: 34, sm: 76 },
            px: { xs: 0.8, sm: 1.5 },
            py: 0.6,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            fontSize: '12px',
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
