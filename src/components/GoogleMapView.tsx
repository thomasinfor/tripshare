import React, { useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { Box, Typography, Button } from '@mui/material';
import { Spot, ItineraryDay, MapStyle, ViewMode } from '../types';
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
        const line = new google.maps.Polyline({
          path: drivingPts,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.95,
          strokeWeight: 4.5,
          map,
        });
        polylines.push(line);
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
          strokeColor: '#64748b',
          strokeOpacity: 0.45,
          strokeWeight: 2.5,
          map,
        });
        polylines.push(bgLine);
      }

      // Real driving route for this spot
      if (currentSpot.driving_route && currentSpot.driving_route.length > 1) {
        const segPts = currentSpot.driving_route.map(p => ({ lat: p[0], lng: p[1] }));

        const segLine = new google.maps.Polyline({
          path: segPts,
          geodesic: true,
          strokeColor: '#06b6d4',
          strokeOpacity: 1.0,
          strokeWeight: 5,
          map,
        });
        polylines.push(segLine);

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
        return 'roadmap';
      case 'dark':
      default:
        return 'roadmap';
    }
  }, [mapStyle]);

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
          bgcolor: '#090d16',
        }}
      >
        <Box
          sx={{
            maxWidth: 440,
            p: 4,
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
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
              bgcolor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KeyRound size={28} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
            Google Maps API Key Required
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
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
              sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
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
                const dayColor = day.color || '#38bdf8';
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
                          background: 'rgba(15, 23, 42, 0.92)',
                          border: `2px solid ${dayColor}`,
                          borderRadius: '12px',
                          padding: '2px 7px',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
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
                            boxShadow: `0 0 6px ${dayColor}`,
                          }}
                        />
                        D{dIdx + 1}
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: dayColor,
                          border: '1.5px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
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
              return (
                <AdvancedMarker
                  key={spot.id || idx}
                  position={{ lat: spot.lat, lng: spot.lng }}
                  onClick={() => onSelectSpot(currentDayIndex, idx)}
                >
                  <Pin
                    background={isCurrent ? '#06b6d4' : (currentDay.color || '#1e293b')}
                    borderColor={isCurrent ? '#ffffff' : '#64748b'}
                    glyphColor={isCurrent ? '#000000' : '#ffffff'}
                    glyph={`${idx + 1}`}
                    scale={isCurrent ? 1.3 : 1.0}
                  />
                </AdvancedMarker>
              );
            })
          )}
        </Map>
      </APIProvider>
    </div>
  );
};
