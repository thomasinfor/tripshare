import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { AdvancedMarker, ColorScheme, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { Box, Typography } from '@mui/material';
import { NormalizedTrip } from '../types';
import { getDistinctDayColor, getTripMonogram } from '../utils/geo';

interface TripCoverMapProps {
  trip: NormalizedTrip;
  googleEnabled: boolean;
}

interface CoverPin {
  lat: number;
  lng: number;
  color: string;
  isDayStart: boolean;
}

interface CoverRoute {
  color: string;
  path: Array<[number, number]>;
}

interface CoverCamera {
  center: { lat: number; lng: number };
  zoom: number;
}

const PIN_WIDTH = 13;
const PIN_HEIGHT = 17;
const PIN_VIEWBOX = '0 0 24 32';
const PIN_PATH =
  'M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 7.4 10.5 18.2 10.5 18.2S22.5 19.4 22.5 12C22.5 6.2 17.8 1.5 12 1.5Z';
const PIN_FILTER = 'drop-shadow(0 1.5px 2.5px rgba(22, 22, 21, 0.28))';
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function sanitizeColor(value: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#b91c1c';
}

function latToMercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  const sinLat = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
}

function mercatorYToLat(y: number): number {
  const clamped = Math.max(0.001, Math.min(0.999, y));
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * clamped))) * 180) / Math.PI;
}

function collectTripCoverGeometry(trip: NormalizedTrip): {
  pins: CoverPin[];
  routes: CoverRoute[];
  allPoints: Array<[number, number]>;
} {
  const pins: CoverPin[] = [];
  const routes: CoverRoute[] = [];
  const allPoints: Array<[number, number]> = [];

  trip.days.forEach((day, dIdx) => {
    const dayColor = sanitizeColor(day.color || getDistinctDayColor(dIdx));
    if (day.driving_route && day.driving_route.length > 1) {
      routes.push({ color: dayColor, path: day.driving_route });
      for (const pt of day.driving_route) {
        if (Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
          allPoints.push([pt[0], pt[1]]);
        }
      }
    }

    (day.spots || []).forEach((spot, sIdx) => {
      if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) return;
      pins.push({
        lat: spot.lat,
        lng: spot.lng,
        color: dayColor,
        isDayStart: sIdx === 0,
      });
      allPoints.push([spot.lat, spot.lng]);
    });
  });

  return { pins, routes, allPoints };
}

/**
 * Compute fractional Web Mercator center & zoom so the expedition's routes and pins
 * fill the cover card cleanly without clipping under the top-left volume badge.
 */
function computeCoverCamera(
  points: Array<[number, number]>,
  width: number,
  height: number
): CoverCamera {
  if (points.length === 0) {
    return { center: { lat: 64.8, lng: -18.8 }, zoom: 5.5 };
  }

  const w = width > 0 ? width : 580;
  const h = height > 0 ? height : 360;
  const padX = w < 440 ? 18 : 28;
  const padTop = w < 440 ? 34 : 42;
  const padBottom = w < 440 ? 18 : 24;
  const availW = Math.max(40, w - padX * 2);
  const availH = Math.max(40, h - padTop - padBottom);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [lat, lng] of points) {
    const x = (lng + 180) / 360;
    const y = latToMercatorY(lat);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const zoom =
    spanX < 1e-5 && spanY < 1e-5
      ? 11
      : Math.max(
          1.5,
          Math.min(
            12.5,
            Math.min(
              spanX > 1e-9 ? Math.log2(availW / (spanX * 256)) : 12.5,
              spanY > 1e-9 ? Math.log2(availH / (spanY * 256)) : 12.5
            )
          )
        );

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2 - (padTop - padBottom) / (2 * 256 * Math.pow(2, zoom));

  return {
    center: {
      lat: mercatorYToLat(centerY),
      lng: centerX * 360 - 180,
    },
    zoom,
  };
}

function buildPinSvgHtml(color: string): string {
  const safeColor = sanitizeColor(color);
  return `<svg width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="${PIN_VIEWBOX}" style="display:block;filter:${PIN_FILTER}" aria-hidden="true"><path d="${PIN_PATH}" fill="${safeColor}" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round"/><circle cx="12" cy="11.5" r="4" fill="#ffffff"/></svg>`;
}

const CoverPinMarkerIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width={PIN_WIDTH}
    height={PIN_HEIGHT}
    viewBox={PIN_VIEWBOX}
    style={{ display: 'block', filter: PIN_FILTER }}
    aria-hidden="true"
  >
    <path
      d={PIN_PATH}
      fill={sanitizeColor(color)}
      stroke="#ffffff"
      strokeWidth={2.6}
      strokeLinejoin="round"
    />
    <circle cx="12" cy="11.5" r="4" fill="#ffffff" />
  </svg>
);

const GoogleCoverController: React.FC<{
  routes: CoverRoute[];
  allPoints: Array<[number, number]>;
}> = ({ routes, allPoints }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    const polylines: google.maps.Polyline[] = [];
    for (const route of routes) {
      const path = route.path.map((p) => ({ lat: p[0], lng: p[1] }));
      const casing = new google.maps.Polyline({
        path,
        geodesic: true,
        clickable: false,
        strokeColor: '#ffffff',
        strokeOpacity: 0.8,
        strokeWeight: 5,
        map,
      });
      const line = new google.maps.Polyline({
        path,
        geodesic: true,
        clickable: false,
        strokeColor: route.color,
        strokeOpacity: 0.94,
        strokeWeight: 3,
        map,
      });
      polylines.push(casing, line);
    }

    const mapDiv = map.getDiv();
    const applyCamera = () => {
      if (!mapDiv || mapDiv.clientWidth === 0 || mapDiv.clientHeight === 0) return;
      map.moveCamera(computeCoverCamera(allPoints, mapDiv.clientWidth, mapDiv.clientHeight));
    };

    applyCamera();

    let lastW = mapDiv?.clientWidth || 0;
    let lastH = mapDiv?.clientHeight || 0;
    const resizeObserver = mapDiv
      ? new ResizeObserver(() => {
          const nw = mapDiv.clientWidth;
          const nh = mapDiv.clientHeight;
          if (Math.abs(nw - lastW) > 1 || Math.abs(nh - lastH) > 1) {
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
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, routes, allPoints]);

  return null;
};

const LeafletCoverMap: React.FC<{
  pins: CoverPin[];
  routes: CoverRoute[];
  allPoints: Array<[number, number]>;
}> = ({ pins, routes, allPoints }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const initialCamera = computeCoverCamera(allPoints, el.clientWidth, el.clientHeight);
    const map = L.map(el, {
      center: [initialCamera.center.lat, initialCamera.center.lng],
      zoom: initialCamera.zoom,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.05,
    });

    L.tileLayer(OSM_TILE_URL, { maxZoom: 18 }).addTo(map);

    const routeGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    for (const route of routes) {
      L.polyline(route.path, {
        color: '#ffffff',
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);
      L.polyline(route.path, {
        color: route.color,
        weight: 3,
        opacity: 0.94,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);
    }

    for (const pin of pins) {
      const icon = L.divIcon({
        className: 'custom-leaflet-marker-wrap',
        html: buildPinSvgHtml(pin.color),
        iconSize: [PIN_WIDTH, PIN_HEIGHT],
        iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
      });
      L.marker([pin.lat, pin.lng], {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: pin.isDayStart ? 30 : 10,
      }).addTo(markersGroup);
    }

    const syncView = () => {
      if (el.clientWidth === 0 || el.clientHeight === 0) return;
      map.invalidateSize();
      const cam = computeCoverCamera(allPoints, el.clientWidth, el.clientHeight);
      map.setView([cam.center.lat, cam.center.lng], cam.zoom, { animate: false });
    };

    syncView();

    const resizeObserver = new ResizeObserver(syncView);
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, [pins, routes, allPoints]);

  return <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />;
};

/**
 * Static non-interactive expedition map cover showing the full route and spot pins.
 */
export const TripCoverMap: React.FC<TripCoverMapProps> = ({ trip, googleEnabled }) => {
  const { pins, routes, allPoints } = useMemo(() => collectTripCoverGeometry(trip), [trip]);
  const initialCamera = useMemo(() => computeCoverCamera(allPoints, 580, 360), [allPoints]);

  if (allPoints.length === 0) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: '#ebe6dc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          color: '#6b6860',
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: '42px',
            lineHeight: 1,
            color: 'rgba(22, 22, 21, 0.35)',
          }}
        >
          {getTripMonogram(trip.trip)}
        </Typography>
        <Typography
          sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Map Expedition
        </Typography>
      </Box>
    );
  }

  if (!googleEnabled) {
    return <LeafletCoverMap pins={pins} routes={routes} allPoints={allPoints} />;
  }

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <GoogleMap
        defaultCenter={initialCamera.center}
        defaultZoom={initialCamera.zoom}
        mapId="DEMO_MAP_ID"
        mapTypeId="roadmap"
        colorScheme={ColorScheme.LIGHT}
        disableDefaultUI
        gestureHandling="none"
        keyboardShortcuts={false}
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <GoogleCoverController routes={routes} allPoints={allPoints} />
        {pins.map((pin, idx) => (
          <AdvancedMarker
            key={`${pin.lat}-${pin.lng}-${idx}`}
            position={{ lat: pin.lat, lng: pin.lng }}
            zIndex={pin.isDayStart ? 30 : 10}
          >
            <CoverPinMarkerIcon color={pin.color} />
          </AdvancedMarker>
        ))}
      </GoogleMap>
    </Box>
  );
};
