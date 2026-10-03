import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import rawTripData from './data/trips.json';
import { TripRaw, NormalizedTrip, MapProvider, MapStyle, ViewMode } from './types';
import { normalizeTrip } from './utils/geo';
import { Header } from './components/Header';
import { LeafletMap } from './components/LeafletMap';
import { GoogleMapView } from './components/GoogleMapView';
import { SpotShowcase } from './components/SpotShowcase';
import { DayOverviewOverlay } from './components/DayOverviewOverlay';
import { TripOverviewOverlay } from './components/TripOverviewOverlay';
import { BottomNavigation } from './components/BottomNavigation';
import { LightboxModal } from './components/LightboxModal';
import { MapConfigModal } from './components/MapConfigModal';

export const App: React.FC = () => {
  // Normalize trip data
  const trip: NormalizedTrip = useMemo(() => {
    const raw = Array.isArray(rawTripData) ? rawTripData[0] : (rawTripData as TripRaw);
    return normalizeTrip(raw as TripRaw);
  }, []);

  // State — start with 'trip-overview' as first page
  const [viewMode, setViewMode] = useState<ViewMode>('trip-overview');
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapProvider, setMapProvider] = useState<MapProvider>(() => {
    return (localStorage.getItem('tripshare_provider') as MapProvider) || 'leaflet';
  });
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    return (localStorage.getItem('tripshare_style') as MapStyle) || 'dark';
  });
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => {
    return (
      localStorage.getItem('tripshare_google_key') ||
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    );
  });

  const currentDay = trip.days[currentDayIndex] || trip.days[0];
  const spots = currentDay?.spots || [];
  const currentSpot = spots[currentSpotIndex];

  // Save Settings
  const handleSaveSettings = (config: {
    provider: MapProvider;
    mapStyle: MapStyle;
    googleApiKey: string;
    showAllDayRoute: boolean;
  }) => {
    setMapProvider(config.provider);
    setMapStyle(config.mapStyle);
    setGoogleApiKey(config.googleApiKey);
    localStorage.setItem('tripshare_provider', config.provider);
    localStorage.setItem('tripshare_style', config.mapStyle);
    localStorage.setItem('tripshare_google_key', config.googleApiKey);
  };

  const handleCycleMapStyle = () => {
    const styles: MapStyle[] = ['dark', 'satellite', 'streets'];
    const nextStyle = styles[(styles.indexOf(mapStyle) + 1) % styles.length];
    setMapStyle(nextStyle);
    localStorage.setItem('tripshare_style', nextStyle);
  };

  // Navigation handlers
  const handleSelectDay = (dayIdx: number) => {
    if (dayIdx >= 0 && dayIdx < trip.days.length) {
      setCurrentDayIndex(dayIdx);
      setCurrentSpotIndex(0);
      setViewMode('day-overview');
    }
  };

  const handleSelectSpot = (dayIdx: number, spotIdx: number) => {
    setCurrentDayIndex(dayIdx);
    setCurrentSpotIndex(spotIdx);
    setViewMode('spot-detail');
  };

  const handleOpenTripOverview = () => {
    setViewMode('trip-overview');
  };

  const handleToggleDayOverview = () => {
    if (viewMode === 'spot-detail') {
      setViewMode('day-overview');
    } else if (viewMode === 'day-overview') {
      setViewMode('spot-detail');
    } else {
      // From trip-overview, go to day overview of day 0
      setViewMode('day-overview');
    }
  };

  const handleStartExpedition = () => {
    setCurrentDayIndex(0);
    setCurrentSpotIndex(0);
    setViewMode('day-overview');
  };

  const handleStartDayJourney = (spotIdx = 0) => {
    setCurrentSpotIndex(spotIdx);
    setViewMode('spot-detail');
  };

  const handlePrev = useCallback(() => {
    if (viewMode === 'trip-overview') {
      // nothing to go back to
    } else if (viewMode === 'day-overview') {
      if (currentDayIndex > 0) {
        setCurrentDayIndex(prev => prev - 1);
        setCurrentSpotIndex(0);
        setViewMode('day-overview');
      } else {
        setViewMode('trip-overview');
      }
    } else {
      // spot-detail
      if (currentSpotIndex > 0) {
        setCurrentSpotIndex(prev => prev - 1);
      } else {
        setViewMode('day-overview');
      }
    }
  }, [viewMode, currentDayIndex, currentSpotIndex]);

  const handleNext = useCallback(() => {
    if (viewMode === 'trip-overview') {
      setCurrentDayIndex(0);
      setCurrentSpotIndex(0);
      setViewMode('day-overview');
    } else if (viewMode === 'day-overview') {
      setCurrentSpotIndex(0);
      setViewMode('spot-detail');
    } else {
      // spot-detail
      if (currentSpotIndex < spots.length - 1) {
        setCurrentSpotIndex(prev => prev + 1);
      } else if (currentDayIndex < trip.days.length - 1) {
        setCurrentDayIndex(prev => prev + 1);
        setCurrentSpotIndex(0);
        setViewMode('day-overview');
      }
    }
  }, [viewMode, currentSpotIndex, spots.length, currentDayIndex, trip.days.length]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (lightboxImage) return;
      if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); handleNext(); }
      else if (e.key === 'm' || e.key === 'M') handleToggleDayOverview();
      else if (e.key === 'Escape' && viewMode !== 'trip-overview') handleOpenTripOverview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, lightboxImage, viewMode]);

  const isSplitView = viewMode === 'spot-detail' && !!currentSpot;
  const isMapFullscreen = viewMode === 'trip-overview' || viewMode === 'day-overview';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: '#090d16',
        color: '#f8fafc',
        position: 'relative',
      }}
    >
      {/* Top Header */}
      <Header
        trip={trip}
        currentDayTitle={currentDay?.title || `Day ${currentDayIndex + 1}`}
        viewMode={viewMode}
        mapProvider={mapProvider}
        mapStyle={mapStyle}
        onOpenTripOverview={handleOpenTripOverview}
        onToggleDayOverview={handleToggleDayOverview}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCycleMapStyle={handleCycleMapStyle}
      />

      {/* Main Workspace Body */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          height: 'calc(100vh - var(--header-height) - var(--bottom-bar-height))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left Half: Spot Showcase — only in split view */}
        {isSplitView && (
          <Box
            sx={{
              width: { xs: '100%', md: '50%' },
              maxWidth: { xs: '100%', md: '50%' },
              height: { xs: '50%', md: '100%' },
              bgcolor: '#0f172a',
              borderRight: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.08)' },
              borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.08)', md: 'none' },
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              position: 'relative',
              zIndex: 10,
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <SpotShowcase
              spot={currentSpot}
              spotNumber={currentSpotIndex + 1}
              totalSpots={spots.length}
              dayTitle={currentDay?.title || `Day ${currentDayIndex + 1}`}
              dayColor={currentDay?.color}
              distanceFromPrev={currentSpotIndex > 0 ? currentSpot.driving_distance_km : undefined}
              onOpenLightbox={(img) => setLightboxImage(img)}
            />
          </Box>
        )}

        {/* Right Half / Full Map */}
        <Box
          sx={{
            flex: 1,
            width: isMapFullscreen ? '100%' : { xs: '100%', md: '50%' },
            height: isSplitView ? { xs: '50%', md: '100%' } : '100%',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {mapProvider === 'google' ? (
            <GoogleMapView
              apiKey={googleApiKey}
              viewMode={viewMode}
              allDays={trip.days}
              currentDayIndex={currentDayIndex}
              currentSpotIndex={currentSpotIndex}
              mapStyle={mapStyle}
              onSelectSpot={handleSelectSpot}
              onSwitchToLeaflet={() => {
                setMapProvider('leaflet');
                localStorage.setItem('tripshare_provider', 'leaflet');
              }}
              onConfigureKey={() => setIsSettingsOpen(true)}
            />
          ) : (
            <LeafletMap
              viewMode={viewMode}
              allDays={trip.days}
              currentDayIndex={currentDayIndex}
              currentSpotIndex={currentSpotIndex}
              mapStyle={mapStyle}
              onSelectSpot={handleSelectSpot}
              onSelectDay={handleSelectDay}
            />
          )}

          {/* Trip Overview Overlay */}
          {viewMode === 'trip-overview' && (
            <TripOverviewOverlay
              trip={trip}
              onStartExpedition={handleStartExpedition}
              onSelectDay={handleSelectDay}
            />
          )}

          {/* Day Overview Overlay */}
          {viewMode === 'day-overview' && currentDay && (
            <DayOverviewOverlay
              day={currentDay}
              dayIndex={currentDayIndex}
              totalDays={trip.days.length}
              onStartJourney={handleStartDayJourney}
            />
          )}
        </Box>
      </Box>

      {/* Bottom Navigation Bar */}
      <BottomNavigation
        days={trip.days}
        currentDayIndex={currentDayIndex}
        currentSpotIndex={currentSpotIndex}
        viewMode={viewMode}
        onOpenTripOverview={handleOpenTripOverview}
        onSelectDay={handleSelectDay}
        onSelectSpot={(spotIdx) => handleSelectSpot(currentDayIndex, spotIdx)}
        onToggleDayOverview={handleToggleDayOverview}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Fullscreen Lightbox Modal */}
      {lightboxImage && currentSpot && (
        <LightboxModal
          images={currentSpot.images}
          currentImage={lightboxImage}
          spotName={currentSpot.name}
          onClose={() => setLightboxImage(null)}
          onSelectImage={(img) => setLightboxImage(img)}
        />
      )}

      {/* Map & App Configuration Modal */}
      {isSettingsOpen && (
        <MapConfigModal
          provider={mapProvider}
          mapStyle={mapStyle}
          googleApiKey={googleApiKey}
          showAllDayRoute={true}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </Box>
  );
};

export default App;
