import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import rawTripData from './data/trips.json';
import { TripCatalog } from './components/TripCatalog';
import { TripRaw, NormalizedTrip, MapProvider, MapStyle, ViewMode } from './types';
import { normalizeTrips } from './utils/geo';
import {
  getMediaUrl,
  scheduleMediaPrefetch,
  fetchInitialMediaMeta,
  ensureMediaMetaForIds,
} from './utils/media';
import { Header } from './components/Header';
import { LeafletMap } from './components/LeafletMap';
import { GoogleMapView } from './components/GoogleMapView';
import { SpotShowcase } from './components/SpotShowcase';
import { DayOverviewOverlay } from './components/DayOverviewOverlay';
import { TripOverviewOverlay } from './components/TripOverviewOverlay';
import { BottomNavigation } from './components/BottomNavigation';
import { LightboxModal } from './components/LightboxModal';
import { MapConfigModal } from './components/MapConfigModal';
import { PhotoDraftReviewModal } from './components/PhotoDraftReviewModal';
import {
  SpotPhotoDraft,
  TripPhotoDraftMap,
  applySpotDraft,
  countTotalDraftChanges,
  loadPhotoDrafts,
  makeSpotDraftKey,
  normalizeSpotDraft,
  reconcileDraftsWithTrips,
  savePhotoDrafts,
} from './utils/photoDrafts';

const ENV_GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

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

interface JumpTarget {
  tripSlug: string;
  dayIndex: number;
  spotIndex: number;
  seq: number;
}

interface TripViewerProps {
  trip: NormalizedTrip;
  onBackToCatalog: () => void;
  isPhotoEditMode: boolean;
  onTogglePhotoEditMode: () => void;
  photoDrafts: TripPhotoDraftMap;
  pendingPhotoChangeCount: number;
  showRemovedPhotos: boolean;
  onToggleShowRemovedPhotos: () => void;
  canUndoDraft: boolean;
  canRedoDraft: boolean;
  onUndoDraft: () => void;
  onRedoDraft: () => void;
  onAddPhotosToSpot: (spotId: string, baseImages: string[], assetIds: string[]) => void;
  onToggleRemovePhotoOnSpot: (spotId: string, baseImages: string[], assetId: string) => void;
  onReorderPhotosOnSpot: (spotId: string, baseImages: string[], nextOrderedActiveIds: string[]) => void;
  onResetSpotDraft: (spotId: string) => void;
  onOpenDraftReview: () => void;
  jumpTarget: JumpTarget | null;
  isModalOverlayOpen: boolean;
}

const TripViewer: React.FC<TripViewerProps> = ({
  trip,
  onBackToCatalog,
  isPhotoEditMode,
  onTogglePhotoEditMode,
  photoDrafts,
  pendingPhotoChangeCount,
  showRemovedPhotos,
  onToggleShowRemovedPhotos,
  canUndoDraft,
  canRedoDraft,
  onUndoDraft,
  onRedoDraft,
  onAddPhotosToSpot,
  onToggleRemovePhotoOnSpot,
  onReorderPhotosOnSpot,
  onResetSpotDraft,
  onOpenDraftReview,
  jumpTarget,
  isModalOverlayOpen,
}) => {
  // Initialize state from URL query parameters (?day=X&spot=Y), defaulting to 'trip-overview'
  const initialNav = useMemo(() => parseUrlNavigationState(trip), [trip]);
  const [viewMode, setViewMode] = useState<ViewMode>(initialNav.viewMode);
  const [currentDayIndex, setCurrentDayIndex] = useState(initialNav.dayIndex);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(initialNav.spotIndex);

  useEffect(() => {
    if (jumpTarget && jumpTarget.tripSlug === trip.slug) {
      setCurrentDayIndex(jumpTarget.dayIndex);
      setCurrentSpotIndex(jumpTarget.spotIndex);
      setViewMode('spot-detail');
    }
  }, [jumpTarget, trip.slug]);

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

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [mobileSpotPane, setMobileSpotPane] = useState<'photos' | 'split' | 'map'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 600 ? 'photos' : 'split'
  );

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const mapProvider: MapProvider = ENV_GOOGLE_MAPS_KEY ? 'google' : 'leaflet';
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    return (localStorage.getItem('tripshare_style_paper') as MapStyle) || 'streets';
  });
  const [showAllDayRoute, setShowAllDayRoute] = useState<boolean>(() => {
    return localStorage.getItem('tripshare_show_day_route') !== 'false';
  });

  useEffect(() => {
    localStorage.removeItem('tripshare_google_key');
    localStorage.removeItem('tripshare_provider');
  }, []);

  const effectiveTrip = useMemo<NormalizedTrip>(() => {
    if (!import.meta.env.DEV || pendingPhotoChangeCount === 0) return trip;
    return {
      ...trip,
      days: trip.days.map((day) => ({
        ...day,
        spots: day.spots.map((spot) => {
          const draft = photoDrafts[makeSpotDraftKey(trip.slug, spot.id)];
          if (!draft) return spot;
          return {
            ...spot,
            images: applySpotDraft(spot.images, draft, false),
          };
        }),
      })),
    };
  }, [trip, photoDrafts, pendingPhotoChangeCount]);

  const baseDay = trip.days[currentDayIndex] || trip.days[0];
  const baseSpot = baseDay?.spots[currentSpotIndex];
  const currentDay = effectiveTrip.days[currentDayIndex] || effectiveTrip.days[0];
  const spots = currentDay?.spots || [];
  const currentSpot = spots[currentSpotIndex];
  const currentSpotDraft = baseSpot
    ? photoDrafts[makeSpotDraftKey(trip.slug, baseSpot.id)]
    : undefined;

  const displayImages = useMemo(() => {
    if (!baseSpot) return currentSpot?.images || [];
    const includeRemoved = import.meta.env.DEV && isPhotoEditMode && showRemovedPhotos;
    return applySpotDraft(baseSpot.images, currentSpotDraft, includeRemoved);
  }, [baseSpot, currentSpot?.images, currentSpotDraft, isPhotoEditMode, showRemovedPhotos]);

  const displaySpot = useMemo(
    () => (currentSpot ? { ...currentSpot, images: displayImages } : undefined),
    [currentSpot, displayImages]
  );

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
      const day0 = effectiveTrip.days[0];
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
      } else if (currentDayIndex + 1 < effectiveTrip.days.length) {
        const nextDay = effectiveTrip.days[currentDayIndex + 1];
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
  }, [viewMode, currentDayIndex, currentSpotIndex, spots, effectiveTrip.days]);

  // Save Settings
  const handleSaveSettings = (config: {
    mapStyle: MapStyle;
    showAllDayRoute: boolean;
  }) => {
    setMapStyle(config.mapStyle);
    setShowAllDayRoute(config.showAllDayRoute);
    localStorage.setItem('tripshare_style_paper', config.mapStyle);
    localStorage.setItem('tripshare_show_day_route', String(config.showAllDayRoute));
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
        const prevDayIdx = currentDayIndex - 1;
        const prevDaySpots = effectiveTrip.days[prevDayIdx]?.spots || [];
        setCurrentDayIndex(prevDayIdx);
        if (prevDaySpots.length > 0) {
          setCurrentSpotIndex(prevDaySpots.length - 1);
          setViewMode('spot-detail');
        } else {
          setCurrentSpotIndex(0);
          setViewMode('day-overview');
        }
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
  }, [viewMode, currentDayIndex, currentSpotIndex, effectiveTrip.days]);

  const handleNext = useCallback(() => {
    if (viewMode === 'trip-overview') {
      setCurrentDayIndex(0);
      setCurrentSpotIndex(0);
      setViewMode('day-overview');
    } else if (viewMode === 'day-overview') {
      if (spots.length > 0) {
        setCurrentSpotIndex(0);
        setViewMode('spot-detail');
      } else if (currentDayIndex < effectiveTrip.days.length - 1) {
        setCurrentDayIndex(prev => prev + 1);
        setCurrentSpotIndex(0);
        setViewMode('day-overview');
      }
    } else {
      // spot-detail
      if (currentSpotIndex < spots.length - 1) {
        setCurrentSpotIndex(prev => prev + 1);
      } else if (currentDayIndex < effectiveTrip.days.length - 1) {
        setCurrentDayIndex(prev => prev + 1);
        setCurrentSpotIndex(0);
        setViewMode('day-overview');
      }
    }
  }, [viewMode, currentSpotIndex, spots.length, currentDayIndex, effectiveTrip.days.length]);

  const handlePrevDate = useCallback(() => {
    if (viewMode === 'trip-overview') return;
    if (currentDayIndex > 0) {
      setCurrentDayIndex(prev => prev - 1);
      setCurrentSpotIndex(0);
      setViewMode('day-overview');
    } else {
      setViewMode('trip-overview');
    }
  }, [viewMode, currentDayIndex]);

  const handleNextDate = useCallback(() => {
    if (viewMode === 'trip-overview') {
      if (effectiveTrip.days.length > 0) {
        setCurrentDayIndex(0);
        setCurrentSpotIndex(0);
        setViewMode('day-overview');
      }
      return;
    }
    if (currentDayIndex < effectiveTrip.days.length - 1) {
      setCurrentDayIndex(prev => prev + 1);
      setCurrentSpotIndex(0);
      setViewMode('day-overview');
    }
  }, [viewMode, currentDayIndex, effectiveTrip.days.length]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      if (lightboxImage || isSettingsOpen || isModalOverlayOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevDate();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextDate();
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleDayOverview();
      } else if (e.key === 'Escape' && viewMode !== 'trip-overview') {
        handleOpenTripOverview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePrev,
    handleNext,
    handlePrevDate,
    handleNextDate,
    handleToggleDayOverview,
    handleOpenTripOverview,
    lightboxImage,
    isSettingsOpen,
    isModalOverlayOpen,
    viewMode,
  ]);

  const isSplitView = viewMode === 'spot-detail' && !!displaySpot;
  const isMapFullscreen = viewMode === 'trip-overview' || viewMode === 'day-overview';
  const baseImageSet = useMemo(() => new Set(baseSpot?.images || []), [baseSpot?.images]);
  const addedImageSet = useMemo(
    () => new Set(currentSpotDraft?.addedIds || []),
    [currentSpotDraft?.addedIds]
  );
  const removedImageSet = useMemo(
    () => new Set(currentSpotDraft?.removedIds || []),
    [currentSpotDraft?.removedIds]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        bgcolor: '#f5f2eb',
        color: '#161615',
        position: 'relative',
      }}
    >
      {/* Top Header */}
      <Header
        trip={effectiveTrip}
        currentDayTitle={currentDay?.title || `Day ${currentDayIndex + 1}`}
        viewMode={viewMode}
        mapProvider={mapProvider}
        mapStyle={mapStyle}
        isPhotoEditMode={isPhotoEditMode}
        pendingPhotoChangeCount={pendingPhotoChangeCount}
        onTogglePhotoEditMode={onTogglePhotoEditMode}
        onOpenPhotoDraftReview={onOpenDraftReview}
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
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Mobile/Tablet Spot View Switcher Bar */}
        {isSplitView && (
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.5,
              py: 0.65,
              bgcolor: '#f5f2eb',
              borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
              flexShrink: 0,
              zIndex: 20,
            }}
          >
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10.5px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#6b6860',
                whiteSpace: 'nowrap',
              }}
            >
              STOP {String(currentSpotIndex + 1).padStart(2, '0')} / {String(spots.length).padStart(2, '0')}
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                p: 0.3,
                borderRadius: '999px',
                bgcolor: 'rgba(22, 22, 21, 0.05)',
                border: '1px solid rgba(22, 22, 21, 0.09)',
              }}
            >
              {([
                { id: 'photos', label: `Photos (${currentSpot?.images.length ?? 0})` },
                { id: 'split', label: 'Split' },
                { id: 'map', label: 'Map' },
              ] as const).map((tab) => {
                const active = mobileSpotPane === tab.id;
                return (
                  <Box
                    key={tab.id}
                    component="button"
                    type="button"
                    onClick={() => setMobileSpotPane(tab.id)}
                    sx={{
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '999px',
                      px: 1.2,
                      py: 0.4,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10.5px',
                      fontWeight: 600,
                      bgcolor: active ? '#161615' : 'transparent',
                      color: active ? '#f5f2eb' : '#6b6860',
                      transition: 'background-color 0.15s ease, color 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Left Split: Spot Showcase — 58% width on desktop */}
          {isSplitView && (
            <Box
              sx={{
                display: { xs: mobileSpotPane === 'map' ? 'none' : 'flex', md: 'flex' },
                width: { xs: '100%', md: '58%' },
                maxWidth: { xs: '100%', md: '58%' },
                height: { xs: mobileSpotPane === 'photos' ? '100%' : '58%', md: '100%' },
                minHeight: 0,
                bgcolor: '#f5f2eb',
                borderRight: { xs: 'none', md: '1px solid rgba(22, 22, 21, 0.10)' },
                borderBottom: {
                  xs: mobileSpotPane === 'split' ? '1px solid rgba(22, 22, 21, 0.10)' : 'none',
                  md: 'none',
                },
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 10,
              }}
            >
              <SpotShowcase
                spot={displaySpot!}
                spotNumber={currentSpotIndex + 1}
                totalSpots={spots.length}
                dayTitle={currentDay?.title || `Day ${currentDayIndex + 1}`}
                dayNumber={currentDayIndex + 1}
                totalDays={effectiveTrip.days.length}
                dayDate={currentDay?.date}
                dayColor={currentDay?.color}
                distanceFromPrev={displaySpot?.driving_distance_km}
                originAccommodationName={
                  currentSpotIndex === 0 ? currentDay?.start_accommodation?.name : undefined
                }
                originIsLastNight={currentSpotIndex === 0 && currentDayIndex > 0}
                isEditMode={isPhotoEditMode}
                baseImages={baseSpot?.images || []}
                spotDraft={currentSpotDraft}
                showRemovedPhotos={showRemovedPhotos}
                pendingChangeCount={pendingPhotoChangeCount}
                canUndo={canUndoDraft}
                canRedo={canRedoDraft}
                onUndo={onUndoDraft}
                onRedo={onRedoDraft}
                onToggleShowRemoved={onToggleShowRemovedPhotos}
                onAddPhotos={(ids) => {
                  if (baseSpot) onAddPhotosToSpot(baseSpot.id, baseSpot.images, ids);
                }}
                onToggleRemovePhoto={(assetId) => {
                  if (baseSpot) onToggleRemovePhotoOnSpot(baseSpot.id, baseSpot.images, assetId);
                }}
                onReorderPhotos={(orderedIds) => {
                  if (baseSpot) onReorderPhotosOnSpot(baseSpot.id, baseSpot.images, orderedIds);
                }}
                onResetSpotDraft={() => {
                  if (baseSpot) onResetSpotDraft(baseSpot.id);
                }}
                onOpenDraftReview={onOpenDraftReview}
                onOpenLightbox={(img) => setLightboxImage(img)}
              />
            </Box>
          )}

          {/* Right Split / Full Map */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: isSplitView
                ? { xs: mobileSpotPane === 'photos' ? 'none' : 'block', md: 'block' }
                : 'block',
              width: isMapFullscreen ? '100%' : { xs: '100%', md: '42%' },
              height: isSplitView
                ? { xs: mobileSpotPane === 'map' ? '100%' : '42%', md: '100%' }
                : '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {mapProvider === 'google' ? (
              <GoogleMapView
                apiKey={ENV_GOOGLE_MAPS_KEY}
                viewMode={viewMode}
                allDays={trip.days}
                currentDayIndex={currentDayIndex}
                currentSpotIndex={currentSpotIndex}
                mapStyle={mapStyle}
                showAllDayRoute={showAllDayRoute}
                onSelectSpot={handleSelectSpot}
              />
            ) : (
              <LeafletMap
                viewMode={viewMode}
                allDays={trip.days}
                currentDayIndex={currentDayIndex}
                currentSpotIndex={currentSpotIndex}
                mapStyle={mapStyle}
                showAllDayRoute={showAllDayRoute}
                onSelectSpot={handleSelectSpot}
                onSelectDay={handleSelectDay}
              />
            )}

            {/* Trip Overview Overlay */}
            {viewMode === 'trip-overview' && (
              <TripOverviewOverlay
                trip={effectiveTrip}
                onStartExpedition={handleStartExpedition}
                onSelectDay={handleSelectDay}
              />
            )}

            {/* Day Overview Overlay */}
            {viewMode === 'day-overview' && currentDay && (
              <DayOverviewOverlay
                day={currentDay}
                dayIndex={currentDayIndex}
                totalDays={effectiveTrip.days.length}
                onStartJourney={handleStartDayJourney}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Navigation Bar */}
      <BottomNavigation
        days={effectiveTrip.days}
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
      {lightboxImage && displaySpot && (
        <LightboxModal
          images={
            displayImages.includes(lightboxImage)
              ? displayImages
              : [lightboxImage, ...displayImages]
          }
          currentImage={lightboxImage}
          spotName={displaySpot.name}
          isEditMode={isPhotoEditMode}
          isPhotoRemoved={(assetId) => removedImageSet.has(assetId)}
          isPhotoAdded={(assetId) => addedImageSet.has(assetId) && !baseImageSet.has(assetId)}
          onToggleRemovePhoto={(assetId) => {
            if (baseSpot) onToggleRemovePhotoOnSpot(baseSpot.id, baseSpot.images, assetId);
          }}
          onClose={() => setLightboxImage(null)}
          onSelectImage={(img) => setLightboxImage(img)}
        />
      )}

      {/* Map & App Configuration Modal */}
      {isSettingsOpen && (
        <MapConfigModal
          mapStyle={mapStyle}
          showAllDayRoute={showAllDayRoute}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </Box>
  );
};

const MAX_DRAFT_HISTORY = 100;

interface DraftHistoryState {
  past: TripPhotoDraftMap[];
  present: TripPhotoDraftMap;
  future: TripPhotoDraftMap[];
}

function areStringArraysEqual(a?: string[], b?: string[]): boolean {
  const listA = a ?? [];
  const listB = b ?? [];
  return listA.length === listB.length && listA.every((item, idx) => item === listB[idx]);
}

function withUpdatedSpotDraft(
  prev: TripPhotoDraftMap,
  key: string,
  normalized: SpotPhotoDraft | null | undefined
): TripPhotoDraftMap {
  const existing = prev[key];
  if (!normalized) {
    if (!existing) return prev;
    const copy = { ...prev };
    delete copy[key];
    return copy;
  }
  if (
    existing &&
    areStringArraysEqual(existing.addedIds, normalized.addedIds) &&
    areStringArraysEqual(existing.removedIds, normalized.removedIds) &&
    areStringArraysEqual(existing.orderedIds, normalized.orderedIds)
  ) {
    return prev;
  }
  return { ...prev, [key]: normalized };
}

export const App: React.FC = () => {
  const initialLocation = useMemo(() => parseAppLocation(ALL_TRIPS), []);
  const [activeTripSlug, setActiveTripSlug] = useState<string | null>(
    initialLocation.activeTripSlug
  );
  const [unknownSlug, setUnknownSlug] = useState<string | null>(initialLocation.unknownSlug);
  const [isPhotoEditMode, setIsPhotoEditMode] = useState(false);
  const [showRemovedPhotos, setShowRemovedPhotos] = useState(true);
  const [isDraftReviewOpen, setIsDraftReviewOpen] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<JumpTarget | null>(null);
  const [draftHistory, setDraftHistory] = useState<DraftHistoryState>(() => ({
    past: [],
    present: import.meta.env.DEV ? reconcileDraftsWithTrips(loadPhotoDrafts(), ALL_TRIPS) : {},
    future: [],
  }));
  const photoDrafts = draftHistory.present;
  const canUndoDraft = import.meta.env.DEV && draftHistory.past.length > 0;
  const canRedoDraft = import.meta.env.DEV && draftHistory.future.length > 0;
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const undoToastTimerRef = useRef<number | null>(null);

  const triggerUndoToast = useCallback((message: string) => {
    if (!import.meta.env.DEV) return;
    setUndoToast(message);
    if (undoToastTimerRef.current !== null) {
      window.clearTimeout(undoToastTimerRef.current);
    }
    undoToastTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
      undoToastTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (undoToastTimerRef.current !== null) {
        window.clearTimeout(undoToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void fetchInitialMediaMeta();
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setDraftHistory((hist) => ({
      ...hist,
      present: reconcileDraftsWithTrips(hist.present, ALL_TRIPS),
    }));
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    savePhotoDrafts(photoDrafts);
    const stagedAddedIds = Object.values(photoDrafts).flatMap((d) => d.addedIds || []);
    if (stagedAddedIds.length > 0) {
      void ensureMediaMetaForIds(stagedAddedIds);
    }
  }, [photoDrafts]);

  const commitDraftChange = useCallback(
    (updater: (prev: TripPhotoDraftMap) => TripPhotoDraftMap) => {
      if (!import.meta.env.DEV) return;
      setDraftHistory((hist) => {
        const nextPresent = updater(hist.present);
        if (nextPresent === hist.present) return hist;
        const nextPast = [...hist.past, hist.present];
        if (nextPast.length > MAX_DRAFT_HISTORY) {
          nextPast.shift();
        }
        return {
          past: nextPast,
          present: nextPresent,
          future: [],
        };
      });
    },
    []
  );

  const handleUndoPhotoEdit = useCallback(() => {
    if (!import.meta.env.DEV || draftHistory.past.length === 0) return;
    setDraftHistory((hist) => {
      if (hist.past.length === 0) return hist;
      const previous = hist.past[hist.past.length - 1];
      return {
        past: hist.past.slice(0, -1),
        present: previous,
        future: [hist.present, ...hist.future].slice(0, MAX_DRAFT_HISTORY),
      };
    });
    triggerUndoToast('Undid photo edit');
  }, [draftHistory.past.length, triggerUndoToast]);

  const handleRedoPhotoEdit = useCallback(() => {
    if (!import.meta.env.DEV || draftHistory.future.length === 0) return;
    setDraftHistory((hist) => {
      if (hist.future.length === 0) return hist;
      const next = hist.future[0];
      return {
        past: [...hist.past, hist.present].slice(-MAX_DRAFT_HISTORY),
        present: next,
        future: hist.future.slice(1),
      };
    });
    triggerUndoToast('Redid photo edit');
  }, [draftHistory.future.length, triggerUndoToast]);

  const draftCounts = useMemo(
    () => (import.meta.env.DEV ? countTotalDraftChanges(photoDrafts) : { totalChanges: 0 }),
    [photoDrafts]
  );

  const activeTrip = useMemo(
    () => (activeTripSlug ? ALL_TRIPS.find((t) => t.slug === activeTripSlug) ?? null : null),
    [activeTripSlug]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isPhotoEditMode && !isDraftReviewOpen) return;

    const handleUndoRedoKeyDown = (e: KeyboardEvent) => {
      const isMod = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey && e.ctrlKey);
      if (!isUndo && !isRedo) return;

      const target = e.target as HTMLElement | null;
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);
      if (isTextInput) {
        const hasTextValue =
          (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
          target.value.length > 0;
        if (hasTextValue) return;
      }

      e.preventDefault();
      if (isUndo) {
        handleUndoPhotoEdit();
      } else {
        handleRedoPhotoEdit();
      }
    };

    window.addEventListener('keydown', handleUndoRedoKeyDown);
    return () => window.removeEventListener('keydown', handleUndoRedoKeyDown);
  }, [isPhotoEditMode, isDraftReviewOpen, handleUndoPhotoEdit, handleRedoPhotoEdit]);

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

  const handleAddPhotosToSpot = useCallback(
    (tripSlug: string, spotId: string, baseImages: string[], incomingIds: string[]) => {
      if (!import.meta.env.DEV || incomingIds.length === 0) return;
      const baseSet = new Set(baseImages);
      const key = makeSpotDraftKey(tripSlug, spotId);

      commitDraftChange((prev) => {
        const cur = prev[key] || { addedIds: [], removedIds: [] };
        const nextAdded = [...cur.addedIds];
        let nextRemoved = [...cur.removedIds];

        for (const id of incomingIds) {
          if (baseSet.has(id)) {
            nextRemoved = nextRemoved.filter((r) => r !== id);
          } else if (!nextAdded.includes(id)) {
            nextAdded.push(id);
          }
        }

        const normalized = normalizeSpotDraft(baseImages, {
          ...cur,
          addedIds: nextAdded,
          removedIds: nextRemoved,
        });
        return withUpdatedSpotDraft(prev, key, normalized);
      });
    },
    [commitDraftChange]
  );

  const handleToggleRemovePhotoOnSpot = useCallback(
    (tripSlug: string, spotId: string, baseImages: string[], assetId: string) => {
      if (!import.meta.env.DEV) return;
      const baseSet = new Set(baseImages);
      const key = makeSpotDraftKey(tripSlug, spotId);

      commitDraftChange((prev) => {
        const cur = prev[key] || { addedIds: [], removedIds: [] };
        let nextAdded = [...cur.addedIds];
        let nextRemoved = [...cur.removedIds];

        if (!baseSet.has(assetId)) {
          nextAdded = nextAdded.filter((a) => a !== assetId);
        } else if (nextRemoved.includes(assetId)) {
          nextRemoved = nextRemoved.filter((r) => r !== assetId);
        } else {
          nextRemoved.push(assetId);
        }

        const normalized = normalizeSpotDraft(baseImages, {
          ...cur,
          addedIds: nextAdded,
          removedIds: nextRemoved,
        });
        return withUpdatedSpotDraft(prev, key, normalized);
      });
    },
    [commitDraftChange]
  );

  const handleReorderSpotPhotos = useCallback(
    (tripSlug: string, spotId: string, baseImages: string[], nextOrderedActiveIds: string[]) => {
      if (!import.meta.env.DEV) return;
      const key = makeSpotDraftKey(tripSlug, spotId);

      commitDraftChange((prev) => {
        const cur = prev[key] || { addedIds: [], removedIds: [] };
        const normalized = normalizeSpotDraft(baseImages, {
          ...cur,
          orderedIds: nextOrderedActiveIds,
        });
        return withUpdatedSpotDraft(prev, key, normalized);
      });
    },
    [commitDraftChange]
  );

  const handleUndoDraftItem = useCallback(
    (draftKey: string, kind: 'add' | 'remove', assetId: string) => {
      commitDraftChange((prev) => {
        const cur = prev[draftKey];
        if (!cur) return prev;
        const nextAdded =
          kind === 'add' ? cur.addedIds.filter((id) => id !== assetId) : cur.addedIds;
        const nextRemoved =
          kind === 'remove' ? cur.removedIds.filter((id) => id !== assetId) : cur.removedIds;

        const baseImages =
          ALL_TRIPS.flatMap((t) =>
            t.days.flatMap((d) =>
              d.spots
                .filter((s) => makeSpotDraftKey(t.slug, s.id) === draftKey)
                .map((s) => s.images)
            )
          )[0] || [];

        const normalized = normalizeSpotDraft(baseImages, {
          ...cur,
          addedIds: nextAdded,
          removedIds: nextRemoved,
        });
        return withUpdatedSpotDraft(prev, draftKey, normalized);
      });
    },
    [commitDraftChange]
  );

  const handleUndoReorder = useCallback(
    (draftKey: string) => {
      commitDraftChange((prev) => {
        const cur = prev[draftKey];
        if (!cur || !cur.orderedIds) return prev;
        if (cur.addedIds.length === 0 && cur.removedIds.length === 0) {
          const copy = { ...prev };
          delete copy[draftKey];
          return copy;
        }
        return {
          ...prev,
          [draftKey]: { addedIds: cur.addedIds, removedIds: cur.removedIds },
        };
      });
    },
    [commitDraftChange]
  );

  const handleResetDraftKey = useCallback(
    (draftKey: string) => {
      commitDraftChange((prev) => {
        if (!(draftKey in prev)) return prev;
        const copy = { ...prev };
        delete copy[draftKey];
        return copy;
      });
    },
    [commitDraftChange]
  );

  const handleClearAllDrafts = useCallback(() => {
    commitDraftChange((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [commitDraftChange]);

  const handleJumpToSpot = useCallback((tripSlug: string, dayIndex: number, spotIndex: number) => {
    const targetUrl = `/${tripSlug}?day=${dayIndex + 1}&spot=${spotIndex + 1}`;
    if (window.location.pathname !== `/${tripSlug}`) {
      window.history.pushState(null, '', targetUrl);
    } else {
      window.history.replaceState(null, '', targetUrl);
    }
    setUnknownSlug(null);
    setActiveTripSlug(tripSlug);
    setJumpTarget((prev) => ({
      tripSlug,
      dayIndex,
      spotIndex,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  if (!activeTrip) {
    return (
      <TripCatalog
        trips={ALL_TRIPS}
        googleApiKey={ENV_GOOGLE_MAPS_KEY}
        unknownSlug={unknownSlug}
        onSelectTrip={handleSelectTrip}
        onDismissUnknownSlug={handleDismissUnknownSlug}
      />
    );
  }

  return (
    <>
      <TripViewer
        key={activeTrip.slug}
        trip={activeTrip}
        onBackToCatalog={handleBackToCatalog}
        isPhotoEditMode={import.meta.env.DEV && isPhotoEditMode}
        onTogglePhotoEditMode={() => setIsPhotoEditMode((prev) => !prev)}
        photoDrafts={photoDrafts}
        pendingPhotoChangeCount={draftCounts.totalChanges}
        showRemovedPhotos={showRemovedPhotos}
        onToggleShowRemovedPhotos={() => setShowRemovedPhotos((prev) => !prev)}
        canUndoDraft={canUndoDraft}
        canRedoDraft={canRedoDraft}
        onUndoDraft={handleUndoPhotoEdit}
        onRedoDraft={handleRedoPhotoEdit}
        onAddPhotosToSpot={(spotId, baseImages, ids) =>
          handleAddPhotosToSpot(activeTrip.slug, spotId, baseImages, ids)
        }
        onToggleRemovePhotoOnSpot={(spotId, baseImages, assetId) =>
          handleToggleRemovePhotoOnSpot(activeTrip.slug, spotId, baseImages, assetId)
        }
        onReorderPhotosOnSpot={(spotId, baseImages, orderedIds) =>
          handleReorderSpotPhotos(activeTrip.slug, spotId, baseImages, orderedIds)
        }
        onResetSpotDraft={(spotId) =>
          handleResetDraftKey(makeSpotDraftKey(activeTrip.slug, spotId))
        }
        onOpenDraftReview={() => setIsDraftReviewOpen(true)}
        jumpTarget={jumpTarget}
        isModalOverlayOpen={isDraftReviewOpen}
      />

      {import.meta.env.DEV && isDraftReviewOpen && (
        <PhotoDraftReviewModal
          trips={ALL_TRIPS}
          drafts={photoDrafts}
          canUndo={canUndoDraft}
          canRedo={canRedoDraft}
          onUndo={handleUndoPhotoEdit}
          onRedo={handleRedoPhotoEdit}
          onClose={() => setIsDraftReviewOpen(false)}
          onUndoSingleItem={handleUndoDraftItem}
          onUndoReorder={handleUndoReorder}
          onResetSpot={handleResetDraftKey}
          onClearAll={handleClearAllDrafts}
          onJumpToSpot={handleJumpToSpot}
        />
      )}

      {import.meta.env.DEV && undoToast && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'fixed',
            bottom: { xs: 'calc(76px + env(safe-area-inset-bottom, 0px))', sm: 80 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1600,
            pointerEvents: 'none',
            bgcolor: '#ffffff',
            color: '#161615',
            border: '1px solid rgba(22, 22, 21, 0.16)',
            boxShadow: '0 8px 24px rgba(22, 22, 21, 0.16)',
            borderRadius: '999px',
            px: 2,
            py: 0.65,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: '#b91c1c',
              flexShrink: 0,
            }}
          />
          <Typography
            sx={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11.5px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {undoToast}
          </Typography>
        </Box>
      )}
    </>
  );
};

export default App;
