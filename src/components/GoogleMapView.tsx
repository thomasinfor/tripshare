import React, { useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, ColorScheme, useMap } from '@vis.gl/react-google-maps';
import { Box, Typography, Button } from '@mui/material';
import { ItineraryDay, MapStyle, ViewMode } from '../types';
import { KeyRound, Sparkles } from 'lucide-react';

interface GoogleMapViewProps {
  apiKey: string;
  viewMode: ViewMode;
  allDays: ItineraryDay[];
  currentDayIndex: number;
  currentSpotIndex: number;
  mapStyle: MapStyle;
  onSelectSpot: (dayIndex: number, spotIndex: number) => void;
  onSwitchToLeaflet: () => void;
  onConfigureKey: () => void;
}

const DEFAULT_DAY_COLORS = ['#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6'];

function getMapBoundsPadding(
  mapDiv: HTMLElement | null,
  viewMode: ViewMode
): google.maps.Padding {
  const w = mapDiv?.clientWidth || window.innerWidth;
  const h = mapDiv?.clientHeight || window.innerHeight;

  if (viewMode === 'trip-overview' || viewMode === 'day-overview') {
    if (window.innerWidth >= 900) {
      const panelWidth = viewMode === 'trip-overview' ? 400 : 390;
      const panelRightEdge = 20 + panelWidth;
      const left = Math.min(panelRightEdge + 56, Math.floor(w * 0.56));
      return { top: 56, right: 56, bottom: 56, left };
    }
    const bottom = Math.min(Math.floor(h * 0.45) + 32, Math.floor(h * 0.58));
    return { top: 36, right: 36, bottom, left: 36 };
  }

  return { top: 64, right: 64, bottom: 64, left: 64 };
}

const GoogleMapRouteController: React.FC<{
  viewMode: ViewMode;
  allDays: ItineraryDay[];
  currentDayIndex: number;
  currentSpotIndex: number;
}> = ({ viewMode, allDays, currentDayIndex, currentSpotIndex }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || allDays.length === 0) return;

    const polylines: google.maps.Polyline[] = [];
    const currentDay = allDays[currentDayIndex] || allDays[0];
    const currentSpots = currentDay?.spots || [];
    const currentSpot = currentSpots[currentSpotIndex];
    let activeBounds: google.maps.LatLngBounds | null = null;

    if (viewMode === 'trip-overview') {
      const bounds = new google.maps.LatLngBounds();

      allDays.forEach((day, dIdx) => {
        const color = day.color || DEFAULT_DAY_COLORS[dIdx % DEFAULT_DAY_COLORS.length];
        const drivingPts = day.driving_route && day.driving_route.length > 1
          ? day.driving_route.map(p => ({ lat: p[0], lng: p[1] }))
          : null;

        if (drivingPts) {
          drivingPts.forEach(pt => bounds.extend(pt));
          const line = new google.maps.Polyline({
            path: drivingPts,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.95,
            strokeWeight: 4,
            map,
          });
          polylines.push(line);
        }
        day.spots.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
      });

      activeBounds = bounds;
    } else if (viewMode === 'day-overview') {
      const bounds = new google.maps.LatLngBounds();
      const color = currentDay.color || DEFAULT_DAY_COLORS[currentDayIndex % DEFAULT_DAY_COLORS.length];

      const drivingPts = currentDay.driving_route && currentDay.driving_route.length > 1
        ? currentDay.driving_route.map(p => ({ lat: p[0], lng: p[1] }))
        : null;

      if (drivingPts) {
        drivingPts.forEach(pt => bounds.extend(pt));
        const halo = new google.maps.Polyline({
          path: drivingPts,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.2,
          strokeWeight: 9,
          map,
        });
        const line = new google.maps.Polyline({
          path: drivingPts,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.95,
          strokeWeight: 4,
          map,
        });
        polylines.push(halo, line);
      }
      currentSpots.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));

      activeBounds = bounds;
    } else if (viewMode === 'spot-detail' && currentSpot) {
      // Background day route
      if (currentDay.driving_route && currentDay.driving_route.length > 1) {
        const fullPts = currentDay.driving_route.map(p => ({ lat: p[0], lng: p[1] }));
        const bgLine = new google.maps.Polyline({
          path: fullPts,
          geodesic: true,
          strokeColor: '#9ca3af',
          strokeOpacity: 0.55,
          strokeWeight: 2.5,
          map,
        });
        polylines.push(bgLine);
      }

      // Real driving route for this spot in crisp Gallery crimson
      if (currentSpot.driving_route && currentSpot.driving_route.length > 1) {
        const segPts = currentSpot.driving_route.map(p => ({ lat: p[0], lng: p[1] }));

        const haloLine = new google.maps.Polyline({
          path: segPts,
          geodesic: true,
          strokeColor: '#b91c1c',
          strokeOpacity: 0.18,
          strokeWeight: 9,
          map,
        });
        const segLine = new google.maps.Polyline({
          path: segPts,
          geodesic: true,
          strokeColor: '#b91c1c',
          strokeOpacity: 0.96,
          strokeWeight: 4.5,
          map,
        });
        polylines.push(haloLine, segLine);

        const bounds = new google.maps.LatLngBounds();
        segPts.forEach(pt => bounds.extend(pt));
        bounds.extend({ lat: currentSpot.lat, lng: currentSpot.lng });
        activeBounds = bounds;
      }
    }

    const mapDiv = map.getDiv();
    const applyCamera = () => {
      if (activeBounds && !activeBounds.isEmpty()) {
        map.fitBounds(activeBounds, getMapBoundsPadding(mapDiv, viewMode));
      } else if (viewMode === 'spot-detail' && currentSpot) {
        map.panTo({ lat: currentSpot.lat, lng: currentSpot.lng });
        map.setZoom(13);
      }
    };

    applyCamera();

    let lastW = mapDiv?.clientWidth || 0;
    let lastH = mapDiv?.clientHeight || 0;
    const resizeObserver = mapDiv
      ? new ResizeObserver(() => {
          const nw = mapDiv.clientWidth;
          const nh = mapDiv.clientHeight;
          if (Math.abs(nw - lastW) > 4 || Math.abs(nh - lastH) > 4) {
            lastW = nw;
            lastH = nh;
            applyCamera();
          }
        })
      : null;

    if (resizeObserver && mapDiv) {
      resizeObserver.observe(mapDiv);
    }

    return () => {
      resizeObserver?.disconnect();
      polylines.forEach(p => p.setMap(null));
    };
  }, [map, viewMode, allDays, currentDayIndex, currentSpotIndex]);

  return null;
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  apiKey,
  viewMode,
  allDays,
  currentDayIndex,
  currentSpotIndex,
  mapStyle,
  onSelectSpot,
  onSwitchToLeaflet,
  onConfigureKey,
}) => {
  const currentDay = allDays[currentDayIndex] || allDays[0];
  const currentSpots = currentDay?.spots || [];
  const currentSpot = currentSpots[currentSpotIndex] || currentSpots[0] || { lat: 64.14, lng: -21.93 };

  const mapTypeId = useMemo(() => {
    switch (mapStyle) {
      case 'satellite':
        return 'hybrid';
      case 'streets':
      case 'dark':
      default:
        return 'roadmap';
    }
  }, [mapStyle]);

  const colorScheme = mapStyle === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT;

  if (!apiKey || apiKey.trim() === '') {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          bgcolor: '#f5f2eb',
        }}
      >
        <Box
          sx={{
            maxWidth: 440,
            p: 4,
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px solid rgba(22, 22, 21, 0.10)',
            boxShadow: '0 20px 50px rgba(22, 22, 21, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              bgcolor: 'rgba(185, 28, 28, 0.1)',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KeyRound size={26} />
          </Box>
          <Typography variant="h5" sx={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, color: '#161615' }}>
            Google Maps API Key Required
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b6860', lineHeight: 1.6 }}>
            To view Google Maps, set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> or enter your key in settings.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 1.5, mt: 1 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={onConfigureKey}
              startIcon={<KeyRound size={16} />}
            >
              Enter Google Maps Key
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={onSwitchToLeaflet}
              startIcon={<Sparkles size={16} />}
            >
              Switch to OpenStreetMap (Free, No Key)
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <div className="google-map-wrapper" style={{ width: '100%', height: '100%' }}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: currentSpot.lat, lng: currentSpot.lng }}
          defaultZoom={11}
          mapTypeId={mapTypeId}
          mapId="DEMO_MAP_ID"
          colorScheme={colorScheme}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <GoogleMapRouteController
            viewMode={viewMode}
            allDays={allDays}
            currentDayIndex={currentDayIndex}
            currentSpotIndex={currentSpotIndex}
          />

          {viewMode === 'trip-overview' ? (
            allDays.map((day, dIdx) =>
              day.spots.map((spot, sIdx) => {
                const isDayStart = sIdx === 0;
                const dayColor = day.color || '#b91c1c';
                return (
                  <AdvancedMarker
                    key={`${dIdx}-${sIdx}`}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    onClick={() => onSelectSpot(dIdx, sIdx)}
                    title={`Day ${dIdx + 1}: ${spot.name}`}
                  >
                    {isDayStart ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(255, 255, 255, 0.96)',
                          border: `2px solid ${dayColor}`,
                          borderRadius: '12px',
                          padding: '2px 7px',
                          color: '#161615',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '11px',
                          fontWeight: 600,
                          boxShadow: '0 3px 10px rgba(22, 22, 21, 0.2)',
                          cursor: 'pointer',
                          transform: 'translateY(-50%)',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: dayColor,
                          }}
                        />
                        D{dIdx + 1}
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          backgroundColor: dayColor,
                          border: '1.5px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(22, 22, 21, 0.25)',
                          cursor: 'pointer',
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    )}
                  </AdvancedMarker>
                );
              })
            )
          ) : (
            currentSpots.map((spot, idx) => {
              const isCurrent = viewMode === 'spot-detail' && idx === currentSpotIndex;
              const inactiveBorder =
                viewMode === 'day-overview'
                  ? (currentDay.color || '#161615')
                  : '#b91c1c';
              const size = isCurrent ? 30 : 22;

              return (
                <AdvancedMarker
                  key={spot.id || idx}
                  position={{ lat: spot.lat, lng: spot.lng }}
                  onClick={() => onSelectSpot(currentDayIndex, idx)}
                  title={`${idx + 1}. ${spot.name}`}
                  zIndex={isCurrent ? 500 : 10}
                >
                  <div
                    style={{
                      width: size,
                      height: size,
                      borderRadius: '50%',
                      background: isCurrent ? '#b91c1c' : '#ffffff',
                      border: `2px solid ${isCurrent ? '#ffffff' : inactiveBorder}`,
                      color: isCurrent ? '#ffffff' : '#161615',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      fontSize: isCurrent ? '12px' : '10px',
                      lineHeight: 1,
                      boxShadow: isCurrent
                        ? '0 4px 12px rgba(22, 22, 21, 0.35)'
                        : '0 2px 8px rgba(22, 22, 21, 0.2)',
                      cursor: 'pointer',
                      transform: 'translateY(50%)',
                      userSelect: 'none',
                    }}
                  >
                    {idx + 1}
                  </div>
                </AdvancedMarker>
              );
            })
          )}
        </Map>
      </APIProvider>
    </div>
  );
};
