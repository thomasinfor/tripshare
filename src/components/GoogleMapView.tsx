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
        } else {
          day.spots.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
        }
      });

      map.fitBounds(bounds, 60);
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
      } else {
        currentSpots.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
      }

      map.fitBounds(bounds, 70);
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
        map.fitBounds(bounds, 70);
      } else {
        map.panTo({ lat: currentSpot.lat, lng: currentSpot.lng });
        map.setZoom(13);
      }
    }

    return () => {
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
              day.spots.map((spot, sIdx) => (
                <AdvancedMarker
                  key={`${dIdx}-${sIdx}`}
                  position={{ lat: spot.lat, lng: spot.lng }}
                  onClick={() => onSelectSpot(dIdx, sIdx)}
                >
                  <Pin
                    background={day.color || '#38bdf8'}
                    borderColor="#ffffff"
                    glyphColor="#000000"
                    glyph={`D${dIdx + 1}.${sIdx + 1}`}
                    scale={1.0}
                  />
                </AdvancedMarker>
              ))
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
