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
import ExploreIcon from '@mui/icons-material/Explore';
import PublicIcon from '@mui/icons-material/Public';
import MapIcon from '@mui/icons-material/Map';
import LayersIcon from '@mui/icons-material/Layers';
import SettingsIcon from '@mui/icons-material/Settings';

interface HeaderProps {
  trip: NormalizedTrip;
  currentDayTitle: string;
  viewMode: ViewMode;
  mapProvider: MapProvider;
  mapStyle: MapStyle;
  onOpenTripOverview: () => void;
  onToggleDayOverview: () => void;
  onOpenSettings: () => void;
  onCycleMapStyle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  trip,
  currentDayTitle,
  viewMode,
  mapProvider,
  mapStyle,
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

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        height: 'var(--header-height)',
        bgcolor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 100,
        justifyContent: 'center',
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 }, justifyContent: 'space-between', gap: 2 }}>
        {/* Brand & Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 2.5,
              background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 16px rgba(14, 165, 233, 0.45)',
            }}
          >
            <ExploreIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                lineHeight: 1,
              }}
            >
              TripShare Expedition
            </Typography>
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: 700, color: '#ffffff', fontSize: { xs: '14px', sm: '17px' }, lineHeight: 1.3 }}
            >
              {trip.title}
            </Typography>
          </Box>
        </Box>

        {/* Center: Mode pill */}
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
            sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#ffffff', fontWeight: 600, fontSize: '12.5px' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '13px' }}>
            {totalSpots} spots • {totalPhotos} photos
          </Typography>
        </Box>

        {/* Action Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Button
            size="small"
            variant={viewMode === 'trip-overview' ? 'contained' : 'outlined'}
            onClick={onOpenTripOverview}
            startIcon={<PublicIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.12)',
              color: viewMode === 'trip-overview' ? '#fff' : 'text.primary',
              fontSize: '12.5px',
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            Trip Overview
          </Button>

          <Button
            size="small"
            variant={viewMode === 'day-overview' ? 'contained' : 'outlined'}
            onClick={onToggleDayOverview}
            startIcon={<MapIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.12)',
              color: viewMode === 'day-overview' ? '#fff' : 'text.primary',
              fontSize: '12.5px',
            }}
          >
            {viewMode === 'spot-detail' ? 'Day Route' : viewMode === 'day-overview' ? 'Spot View' : 'Day Route'}
          </Button>

          <Tooltip title={`Map Style: ${mapStyle.toUpperCase()} — Click to cycle`} arrow>
            <Button
              size="small"
              onClick={onCycleMapStyle}
              startIcon={<LayersIcon sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'text.secondary',
                fontSize: '12px',
                display: { xs: 'none', sm: 'inline-flex' },
                '&:hover': { color: '#ffffff' },
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
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'text.secondary',
                '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
