import React, { useState, useEffect, useRef } from 'react';
import { ItineraryDay, ViewMode } from '../types';
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
  const maxStepIndex = spots.length;
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
        bgcolor: 'rgba(245, 242, 235, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(22, 22, 21, 0.10)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        px: { xs: 1.5, sm: 2.5 },
        py: 0.75,
        zIndex: 100,
      }}
    >
      {/* Top Controls Row: Day Tabs & Overview Buttons */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* Day Tabs - active chip expanded, inactive chips compact */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            overflowX: 'auto',
            minWidth: 0,
            py: 0.15,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {/* Entire Trip Overview Button */}
          <Tooltip title={`View Entire ${days.length}-Day Route Map`} arrow>
            <Chip
              icon={<PublicIcon sx={{ fontSize: '13px !important', color: 'inherit !important' }} />}
              label="All Map"
              size="small"
              clickable
              onClick={onOpenTripOverview}
              variant={viewMode === 'trip-overview' ? 'filled' : 'outlined'}
              sx={{
                height: 24,
                px: 0.5,
                borderRadius: '999px',
                fontFamily: "'JetBrains Mono', monospace",
                bgcolor: viewMode === 'trip-overview' ? '#161615' : 'rgba(22, 22, 21, 0.035)',
                borderColor: viewMode === 'trip-overview' ? '#161615' : 'rgba(22, 22, 21, 0.10)',
                color: viewMode === 'trip-overview' ? '#f5f2eb' : '#6b6860',
                fontWeight: 600,
                fontSize: '11px',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: viewMode === 'trip-overview' ? '#2c2c2a' : 'rgba(22, 22, 21, 0.08)',
                  color: viewMode === 'trip-overview' ? '#f5f2eb' : '#161615',
                },
              }}
            />
          </Tooltip>

          <Box sx={{ width: '1px', height: 15, bgcolor: 'rgba(22, 22, 21, 0.12)', mx: 0.2, flexShrink: 0 }} />

          {/* Individual Day Tabs */}
          {days.map((day, idx) => {
            const isActive = viewMode !== 'trip-overview' && idx === currentDayIndex;
            const dayColor = day.color || '#b91c1c';
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
                        width: isActive ? '7px !important' : '6px !important',
                        height: isActive ? '7px !important' : '6px !important',
                        borderRadius: '50% !important',
                        bgcolor: dayColor,
                      }}
                    />
                  }
                  sx={{
                    height: 24,
                    minWidth: isActive ? 'auto' : 38,
                    px: isActive ? 0.65 : 0.2,
                    borderRadius: '999px',
                    fontFamily: "'JetBrains Mono', monospace",
                    bgcolor: isActive ? '#161615' : 'rgba(22, 22, 21, 0.035)',
                    borderColor: isActive ? '#161615' : 'rgba(22, 22, 21, 0.10)',
                    color: isActive ? '#f5f2eb' : '#6b6860',
                    fontWeight: 600,
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.18s ease',
                    '&:hover': {
                      bgcolor: isActive ? '#2c2c2a' : 'rgba(22, 22, 21, 0.08)',
                      borderColor: isActive ? '#161615' : 'rgba(22, 22, 21, 0.25)',
                      color: isActive ? '#f5f2eb' : '#161615',
                    },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        {/* Action Controls: Day Route Toggle & Autoplay Tour */}
        <Stack direction="row" spacing={0.9} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Button
            size="small"
            variant={viewMode === 'day-overview' ? 'contained' : 'outlined'}
            onClick={onToggleDayOverview}
            startIcon={<MapIcon sx={{ fontSize: 14 }} />}
            sx={{
              fontSize: '11.5px',
              py: 0.3,
              px: 1.2,
              borderRadius: '999px',
              display: { xs: 'none', sm: 'inline-flex' },
              ...(viewMode === 'day-overview'
                ? { bgcolor: '#161615', color: '#f5f2eb', borderColor: '#161615' }
                : { borderColor: 'rgba(22, 22, 21, 0.14)', color: '#161615' }),
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
                    sx={{ color: '#b91c1c' }}
                  />
                  <PauseIcon sx={{ position: 'absolute', fontSize: 10, color: '#b91c1c' }} />
                </Box>
              ) : (
                <PlayArrowIcon sx={{ fontSize: 15 }} />
              )
            }
            sx={{
              fontSize: '11.5px',
              fontWeight: 600,
              py: 0.3,
              px: 1.25,
              borderRadius: '999px',
              bgcolor: isPlaying ? 'rgba(185, 28, 28, 0.08)' : 'rgba(22, 22, 21, 0.04)',
              color: isPlaying ? '#b91c1c' : '#161615',
              border: isPlaying ? '1px solid rgba(185, 28, 28, 0.45)' : '1px solid rgba(22, 22, 21, 0.12)',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: isPlaying ? 'rgba(185, 28, 28, 0.14)' : 'rgba(22, 22, 21, 0.09)',
              },
            }}
          >
            {isPlaying ? `Pause (${remainingSeconds}s)` : 'Tour'}
          </Button>
        </Stack>
      </Stack>

      {/* Main Scrubber Row (Minimalist Track Beads) */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {/* Previous Button */}
        <Button
          size="small"
          onClick={onPrev}
          startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
          sx={{
            minWidth: { xs: 34, sm: 76 },
            px: { xs: 0.8, sm: 1.4 },
            py: 0.35,
            borderRadius: '999px',
            bgcolor: 'rgba(22, 22, 21, 0.04)',
            border: '1px solid rgba(22, 22, 21, 0.12)',
            color: '#161615',
            fontSize: '11.5px',
            '&:hover': { bgcolor: 'rgba(22, 22, 21, 0.09)' },
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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box className="timeline-track-container" sx={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
            {/* Base Rail and Active Progress Fill - aligned to node centers */}
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
                          bottom: 30,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          bgcolor: '#ffffff',
                          border: '1px solid rgba(22, 22, 21, 0.12)',
                          borderRadius: '10px',
                          p: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.2,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 12px 28px rgba(22, 22, 21, 0.14)',
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
                            sx={{ width: 42, height: 42, borderRadius: '4px', objectFit: 'cover', bgcolor: '#ebe6dc' }}
                          />
                        )}
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, color: '#161615' }}>
                            #{idx + 1} {spot.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "'JetBrains Mono', monospace",
                              color: '#6b6860',
                              fontSize: 11,
                              display: 'block',
                            }}
                          >
                            {spot.time || '—'} · {spot.images.length} photos
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Next Button */}
        <Button
          size="small"
          onClick={onNext}
          endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
          sx={{
            minWidth: { xs: 34, sm: 76 },
            px: { xs: 0.8, sm: 1.4 },
            py: 0.35,
            borderRadius: '999px',
            bgcolor: 'rgba(22, 22, 21, 0.04)',
            border: '1px solid rgba(22, 22, 21, 0.12)',
            color: '#161615',
            fontSize: '11.5px',
            '&:hover': { bgcolor: 'rgba(22, 22, 21, 0.09)' },
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
