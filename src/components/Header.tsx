import React from 'react';
import { NormalizedTrip, MapProvider, MapStyle, ViewMode } from '../types';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import MapIcon from '@mui/icons-material/Map';
import LayersIcon from '@mui/icons-material/Layers';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getTripMonogram } from '../utils/geo';

interface HeaderProps {
  trip: NormalizedTrip;
  currentDayTitle: string;
  viewMode: ViewMode;
  mapProvider: MapProvider;
  mapStyle: MapStyle;
  onBackToCatalog: () => void;
  onOpenTripOverview: () => void;
  onToggleDayOverview: () => void;
  onOpenSettings: () => void;
  onCycleMapStyle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  trip,
  currentDayTitle,
  viewMode,
  mapStyle,
  onBackToCatalog,
  onOpenTripOverview,
  onToggleDayOverview,
  onOpenSettings,
  onCycleMapStyle,
}) => {
  const totalSpots = trip.days.reduce((acc, d) => acc + d.spots.length, 0);
  const totalPhotos = trip.days.reduce(
    (acc, d) => acc + d.spots.reduce((sAcc, s) => sAcc + s.images.length, 0),
    0
  );
  const monogram = getTripMonogram(trip.trip);

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        height: 'var(--header-height)',
        bgcolor: 'rgba(245, 242, 235, 0.94)',
        color: '#161615',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
        zIndex: 100,
        justifyContent: 'center',
      }}
    >
      <Toolbar
        variant="dense"
        sx={{
          minHeight: 'var(--header-height)',
          px: { xs: 1.75, sm: 2.75 },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {/* Back to Archive Pill + Gallery Brand & Serif Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Tooltip title="All expeditions">
            <Button
              component="a"
              href="/"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onBackToCatalog();
              }}
              size="small"
              startIcon={<ArrowBackIcon sx={{ fontSize: '14px !important' }} />}
              sx={{
                minWidth: 0,
                px: 1.1,
                py: 0.4,
                borderRadius: '4px',
                border: '1px solid rgba(22, 22, 21, 0.14)',
                bgcolor: 'rgba(255, 255, 255, 0.65)',
                color: '#161615',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: '#ffffff',
                  borderColor: 'rgba(22, 22, 21, 0.30)',
                },
              }}
            >
              Trips
            </Button>
          </Tooltip>
          <Box
            onClick={onOpenTripOverview}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 0,
              cursor: 'pointer',
              '&:hover .header-monogram': {
                borderColor: '#b91c1c',
                color: '#b91c1c',
              },
            }}
          >
            <Box
              className="header-monogram"
              sx={{
                width: 26,
                height: 26,
                flexShrink: 0,
                borderRadius: '4px',
                border: '1px solid rgba(22, 22, 21, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 600,
                color: '#161615',
                bgcolor: 'rgba(255, 255, 255, 0.65)',
                transition: 'border-color 0.15s ease, color 0.15s ease',
              }}
            >
              {monogram}
            </Box>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontWeight: 400,
                color: '#161615',
                fontSize: { xs: '17px', sm: '21px' },
                lineHeight: 1.1,
                letterSpacing: '0.01em',
              }}
            >
              {trip.title}
            </Typography>
          </Box>
        </Box>

        {/* Center: Mode Pill & Monospace Count */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.5 }}>
          <Chip
            size="small"
            label={
              viewMode === 'trip-overview'
                ? 'All Days Trip Route'
                : viewMode === 'day-overview'
                ? `${currentDayTitle} Route`
                : currentDayTitle
            }
            sx={{
              bgcolor: 'rgba(22, 22, 21, 0.045)',
              color: '#161615',
              borderColor: 'rgba(22, 22, 21, 0.10)',
              borderRadius: '999px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              fontSize: '11.5px',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontFamily: "'JetBrains Mono', monospace",
              color: '#6b6860',
              fontSize: '11.5px',
              whiteSpace: 'nowrap',
            }}
          >
            {totalSpots} spots · {totalPhotos} photos
          </Typography>
        </Box>

        {/* Action Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, flexShrink: 0 }}>
          <Button
            size="small"
            variant={viewMode === 'trip-overview' ? 'contained' : 'outlined'}
            onClick={onOpenTripOverview}
            startIcon={<PublicIcon sx={{ fontSize: 15 }} />}
            sx={{
              borderRadius: '999px',
              py: 0.45,
              px: 1.5,
              fontSize: '12px',
              display: { xs: 'none', sm: 'inline-flex' },
              ...(viewMode === 'trip-overview'
                ? { bgcolor: '#161615', color: '#f5f2eb', borderColor: '#161615' }
                : { borderColor: 'rgba(22, 22, 21, 0.15)', color: '#161615' }),
            }}
          >
            Trip Overview
          </Button>

          <Button
            size="small"
            variant={viewMode === 'day-overview' ? 'contained' : 'outlined'}
            onClick={onToggleDayOverview}
            startIcon={<MapIcon sx={{ fontSize: 15 }} />}
            sx={{
              borderRadius: '999px',
              py: 0.45,
              px: 1.5,
              fontSize: '12px',
              ...(viewMode === 'day-overview'
                ? { bgcolor: '#161615', color: '#f5f2eb', borderColor: '#161615' }
                : { borderColor: 'rgba(22, 22, 21, 0.15)', color: '#161615' }),
            }}
          >
            {viewMode === 'spot-detail' ? 'Day Route' : viewMode === 'day-overview' ? 'Spot View' : 'Day Route'}
          </Button>

          <Tooltip title={`Map Style: ${mapStyle.toUpperCase()} — Click to cycle`} arrow>
            <Button
              size="small"
              onClick={onCycleMapStyle}
              startIcon={<LayersIcon sx={{ fontSize: 15 }} />}
              sx={{
                borderRadius: '999px',
                py: 0.45,
                px: 1.3,
                bgcolor: 'rgba(22, 22, 21, 0.04)',
                border: '1px solid rgba(22, 22, 21, 0.10)',
                color: '#6b6860',
                fontSize: '11.5px',
                display: { xs: 'none', sm: 'inline-flex' },
                '&:hover': { color: '#161615', bgcolor: 'rgba(22, 22, 21, 0.08)' },
              }}
            >
              {mapStyle.charAt(0).toUpperCase() + mapStyle.slice(1)}
            </Button>
          </Tooltip>

          <Tooltip title="Map Engine & Settings" arrow>
            <IconButton
              size="small"
              onClick={onOpenSettings}
              sx={{
                bgcolor: 'rgba(22, 22, 21, 0.04)',
                border: '1px solid rgba(22, 22, 21, 0.10)',
                color: '#6b6860',
                '&:hover': { color: '#161615', bgcolor: 'rgba(22, 22, 21, 0.08)' },
              }}
            >
              <SettingsIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
