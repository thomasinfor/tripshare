import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import rawTripData from './data/trips.json';
import { TripCatalog } from './components/TripCatalog';
import { TripRaw, NormalizedTrip, MapProvider, MapStyle, ViewMode } from './types';
import { normalizeTrips } from './utils/geo';
import { getMediaUrl, scheduleMediaPrefetch } from './utils/media';
import { Header } from './components/Header';
import { LeafletMap } from './components/LeafletMap';
import { GoogleMapView } from './components/GoogleMapView';
import { SpotShowcase } from './components/SpotShowcase';
import { DayOverviewOverlay } from './components/DayOverviewOverlay';
import { TripOverviewOverlay } from './components/TripOverviewOverlay';
import { BottomNavigation } from './components/BottomNavigation';
import { LightboxModal } from './components/LightboxModal';
import { MapConfigModal } from './components/MapConfigModal';

const DEFAULT_GOOGLE_MAPS_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBUIiyAlQcrDC8hK9ho_Oep3u81_bSvSQ8';

const extraTripModules = import.meta.glob('./data/trips/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, TripRaw | TripRaw[]>;

const ALL_TRIPS: NormalizedTrip[] = normalizeTrips([
  rawTripData as unknown as TripRaw | TripRaw[],
  ...Object.values(extraTripModules),
]);

function parseUrlNavigationState(trip: NormalizedTrip): {
  viewMode: ViewMode;
  dayIndex: number;
  spotIndex: number;
} {
  if (typeof window === 'undefined' || trip.days.length === 0) {
    return { viewMode: 'trip-overview', dayIndex: 0, spotIndex: 0 };
  }

  // Prefer query parameters (?day=2&spot=4); also accept legacy hash (#day=2&spot=4)
  const rawQuery =
    window.location.search ||
    (window.location.hash.includes('day=') ? window.location.hash.slice(1) : '');
  const params = new URLSearchParams(rawQuery);
  const dayParam = params.get('day');

  if (dayParam !== null) {
    const parsedDay = parseInt(dayParam, 10);
    if (!Number.isNaN(parsedDay)) {
      const dayIndex = Math.max(0, Math.min(trip.days.length - 1, parsedDay - 1));
      const spotParam = params.get('spot');
      if (spotParam !== null) {
        const parsedSpot = parseInt(spotParam, 10);
        if (!Number.isNaN(parsedSpot)) {
          const maxSpot = Math.max(0, (trip.days[dayIndex]?.spots.length || 1) - 1);
          const spotIndex = Math.max(0, Math.min(maxSpot, parsedSpot - 1));
          return { viewMode: 'spot-detail', dayIndex, spotIndex };
        }
      }
      return { viewMode: 'day-overview', dayIndex, spotIndex: 0 };
    }
  }

  return { viewMode: 'trip-overview', dayIndex: 0, spotIndex: 0 };
}

function parseAppLocation(trips: NormalizedTrip[]): {
  activeTripSlug: string | null;
  unknownSlug: string | null;
} {
  if (typeof window === 'undefined') {
    return { activeTripSlug: null, unknownSlug: null };
  }

  const trimmedPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmedPath || trimmedPath === 'index.html') {
    const rawQuery =
      window.location.search ||
      (window.location.hash.includes('day=') ? window.location.hash.slice(1) : '');
    const params = new URLSearchParams(rawQuery);
    if (params.has('day') && trips.length > 0) {
      return { activeTripSlug: trips[0].slug, unknownSlug: null };
    }
    return { activeTripSlug: null, unknownSlug: null };
  }

  const candidateSlug = decodeURIComponent(trimmedPath.split('/')[0]).toLowerCase();
  const matched = trips.find((t) => t.slug === candidateSlug);
  if (matched) {
    return { activeTripSlug: matched.slug, unknownSlug: null };
  }
  return { activeTripSlug: null, unknownSlug: candidateSlug };
}

interface TripViewerProps {
  trip: NormalizedTrip;
  onBackToCatalog: () => void;
}

const TripViewer: React.FC<TripViewerProps> = ({ trip, onBackToCatalog }) => {
  // Initialize state from URL query parameters (?day=X&spot=Y), defaulting to 'trip-overview'
  const initialNav = useMemo(() => parseUrlNavigationState(trip), [trip]);
  const [viewMode, setViewMode] = useState<ViewMode>(initialNav.viewMode);
  const [currentDayIndex, setCurrentDayIndex] = useState(initialNav.dayIndex);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(initialNav.spotIndex);

  useEffect(() => {
    document.title = `${trip.title} — TripShare`;
  }, [trip.title]);

  // Sync navigation state -> URL query parameters (/slug?day=X&spot=Y)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('day');
    params.delete('spot');

    if (viewMode === 'day-overview') {
      params.set('day', String(currentDayIndex + 1));
    } else if (viewMode === 'spot-detail') {
      params.set('day', String(currentDayIndex + 1));
      params.set('spot', String(currentSpotIndex + 1));
    }

    const queryStr = params.toString();
    const basePath = `/${trip.slug}`;
    const nextUrl = `${basePath}${queryStr ? `?${queryStr}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [trip.slug, viewMode, currentDayIndex, currentSpotIndex]);

  // Sync browser Back/Forward (popstate) -> React state
  useEffect(() => {
    const handlePopState = () => {
      const next = parseUrlNavigationState(trip);
      setViewMode(next.viewMode);
      setCurrentDayIndex(next.dayIndex);
      setCurrentSpotIndex(next.spotIndex);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [trip]);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapProvider, setMapProvider] = useState<MapProvider>(() => {
    return (localStorage.getItem('tripshare_provider') as MapProvider) || 'google';
  });
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    return (localStorage.getItem('tripshare_style_paper') as MapStyle) || 'streets';
  });
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => {
    return (
      localStorage.getItem('tripshare_google_key') ||
      DEFAULT_GOOGLE_MAPS_KEY
    );
  });

  const currentDay = trip.days[currentDayIndex] || trip.days[0];
  const spots = currentDay?.spots || [];
  const currentSpot = spots[currentSpotIndex];

  // Idle-prefetch upcoming spot/day images so Next / Tour navigation feels instant
  useEffect(() => {
    const urlsToPrefetch: string[] = [];
    const appendSpotMedia = (spotImages: string[] | undefined, includeHighRes: boolean) => {
      if (!spotImages || spotImages.length === 0) return;
      for (const id of spotImages.slice(0, 10)) {
        urlsToPrefetch.push(getMediaUrl(id, 'thumbnail'));
      }
      if (includeHighRes) {
        if (spotImages.length === 1) {
          urlsToPrefetch.push(getMediaUrl(spotImages[0], 'preview'));
        } else {
          for (const id of spotImages.slice(0, 6)) {
            urlsToPrefetch.push(getMediaUrl(id, 'grid'));
          }
        }
      }
    };

    if (viewMode === 'trip-overview') {
      const day0 = trip.days[0];
      if (day0) {
        for (const s of day0.spots) {
          if (s.images?.[0]) urlsToPrefetch.push(getMediaUrl(s.images[0], 'thumbnail'));
        }
        appendSpotMedia(day0.spots[0]?.images, true);
      }
    } else if (viewMode === 'day-overview') {
      appendSpotMedia(spots[0]?.images, true);
      appendSpotMedia(spots[1]?.images, false);
    } else if (viewMode === 'spot-detail') {
      if (currentSpotIndex + 1 < spots.length) {
        appendSpotMedia(spots[currentSpotIndex + 1]?.images, true);
      } else if (currentDayIndex + 1 < trip.days.length) {
        const nextDay = trip.days[currentDayIndex + 1];
        for (const s of nextDay.spots) {
          if (s.images?.[0]) urlsToPrefetch.push(getMediaUrl(s.images[0], 'thumbnail'));
        }
        appendSpotMedia(nextDay.spots[0]?.images, true);
      }
      if (currentSpotIndex > 0) {
        appendSpotMedia(spots[currentSpotIndex - 1]?.images, false);
      }
    }

    scheduleMediaPrefetch(urlsToPrefetch);
  }, [viewMode, currentDayIndex, currentSpotIndex, spots, trip.days]);

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
    localStorage.setItem('tripshare_style_paper', config.mapStyle);
    localStorage.setItem('tripshare_google_key', config.googleApiKey);
  };

  const handleCycleMapStyle = () => {
    const styles: MapStyle[] = ['streets', 'satellite', 'dark'];
    const nextStyle = styles[(styles.indexOf(mapStyle) + 1) % styles.length];
    setMapStyle(nextStyle);
    localStorage.setItem('tripshare_style_paper', nextStyle);
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
        bgcolor: '#f5f2eb',
        color: '#161615',
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
        onBackToCatalog={onBackToCatalog}
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
        {/* Left Split: Spot Showcase — 58% width on desktop */}
        {isSplitView && (
          <Box
            sx={{
              width: { xs: '100%', md: '58%' },
              maxWidth: { xs: '100%', md: '58%' },
              height: { xs: '50%', md: '100%' },
              bgcolor: '#f5f2eb',
              borderRight: { xs: 'none', md: '1px solid rgba(22, 22, 21, 0.10)' },
              borderBottom: { xs: '1px solid rgba(22, 22, 21, 0.10)', md: 'none' },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <SpotShowcase
              spot={currentSpot}
              spotNumber={currentSpotIndex + 1}
              totalSpots={spots.length}
              dayTitle={currentDay?.title || `Day ${currentDayIndex + 1}`}
              dayNumber={currentDayIndex + 1}
              totalDays={trip.days.length}
              dayDate={currentDay?.date}
              dayColor={currentDay?.color}
              distanceFromPrev={currentSpotIndex > 0 ? currentSpot.driving_distance_km : undefined}
              onOpenLightbox={(img) => setLightboxImage(img)}
            />
          </Box>
        )}

        {/* Right Split / Full Map */}
        <Box
          sx={{
            flex: 1,
            width: isMapFullscreen ? '100%' : { xs: '100%', md: '42%' },
            height: isSplitView ? { xs: '50%', md: '100%' } : '100%',
            position: 'relative',
            overflow: 'hidden',
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

export const App: React.FC = () => {
  const initialLocation = useMemo(() => parseAppLocation(ALL_TRIPS), []);
  const [activeTripSlug, setActiveTripSlug] = useState<string | null>(
    initialLocation.activeTripSlug
  );
  const [unknownSlug, setUnknownSlug] = useState<string | null>(initialLocation.unknownSlug);

  const activeTrip = useMemo(
    () => (activeTripSlug ? ALL_TRIPS.find((t) => t.slug === activeTripSlug) ?? null : null),
    [activeTripSlug]
  );

  useEffect(() => {
    if (!activeTrip) {
      document.title = 'TripShare — Expedition Archive';
    }
  }, [activeTrip]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseAppLocation(ALL_TRIPS);
      setActiveTripSlug(next.activeTripSlug);
      setUnknownSlug(next.unknownSlug);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectTrip = (slug: string) => {
    const nextUrl = `/${slug}`;
    if (window.location.pathname !== nextUrl || window.location.search) {
      window.history.pushState(null, '', nextUrl);
    }
    setUnknownSlug(null);
    setActiveTripSlug(slug);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleBackToCatalog = () => {
    if (window.location.pathname !== '/' || window.location.search) {
      window.history.pushState(null, '', '/');
    }
    setUnknownSlug(null);
    setActiveTripSlug(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleDismissUnknownSlug = () => {
    setUnknownSlug(null);
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  };

  if (!activeTrip) {
    return (
      <TripCatalog
        trips={ALL_TRIPS}
        unknownSlug={unknownSlug}
        onSelectTrip={handleSelectTrip}
        onDismissUnknownSlug={handleDismissUnknownSlug}
      />
    );
  }

  return (
    <TripViewer
      key={activeTrip.slug}
      trip={activeTrip}
      onBackToCatalog={handleBackToCatalog}
    />
  );
};

export default App;
