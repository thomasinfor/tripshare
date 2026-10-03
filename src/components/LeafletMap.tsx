import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Spot, ItineraryDay, MapStyle, ViewMode } from '../types';

interface LeafletMapProps {
  viewMode: ViewMode;
  allDays: ItineraryDay[];
  currentDayIndex: number;
  currentSpotIndex: number;
  mapStyle: MapStyle;
  onSelectSpot: (dayIndex: number, spotIndex: number) => void;
  onSelectDay: (dayIndex: number) => void;
}

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; maxZoom: number }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>',
    maxZoom: 19,
  }
};

const DEFAULT_DAY_COLORS = ['#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6'];

export const LeafletMap: React.FC<LeafletMapProps> = ({
  viewMode,
  allDays,
  currentDayIndex,
  currentSpotIndex,
  mapStyle,
  onSelectSpot,
  onSelectDay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialSpot = allDays[0]?.spots[0] || { lat: 64.14, lng: -21.93 };
    const map = L.map(containerRef.current, {
      center: [initialSpot.lat, initialSpot.lng],
      zoom: 10,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const layerConfig = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;
    const tileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    const routeGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    markersLayerRef.current = markersGroup;
    routeLayerRef.current = routeGroup;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer when style changes
  useEffect(() => {
    if (!mapRef.current) return;
    const layerConfig = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom,
    }).addTo(mapRef.current);
  }, [mapStyle]);

  // Update Markers & Real Driving Routes
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersLayerRef.current;
    const routeGroup = routeLayerRef.current;

    if (!map || !markersGroup || !routeGroup || allDays.length === 0) return;

    markersGroup.clearLayers();
    routeGroup.clearLayers();

    const currentDay = allDays[currentDayIndex] || allDays[0];
    const currentSpots = currentDay?.spots || [];
    const currentSpot = currentSpots[currentSpotIndex];

    // =========================================================================
    // 1. TRIP OVERVIEW MODE: Render all days with different colors
    // =========================================================================
    if (viewMode === 'trip-overview') {
      const allCoordsForBounds: [number, number][] = [];

      allDays.forEach((day, dIdx) => {
        const dayColor = day.color || DEFAULT_DAY_COLORS[dIdx % DEFAULT_DAY_COLORS.length];
        
        // Draw real driving road route for this day (only when road coordinates exist, no straight lines)
        const drivingPts = day.driving_route && day.driving_route.length > 1 
          ? day.driving_route 
          : null;

        if (drivingPts) {
          // Glow layer
          L.polyline(drivingPts, {
            color: dayColor,
            weight: 7,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(routeGroup);

          // Core driving line
          L.polyline(drivingPts, {
            color: dayColor,
            weight: 4,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(routeGroup);
        }

        // Add markers for all spots of this day
        day.spots.forEach((spot, sIdx) => {
          allCoordsForBounds.push([spot.lat, spot.lng]);

          const markerHtml = `
            <div class="custom-map-marker is-trip-overview" style="--day-color: ${dayColor}">
              <div class="marker-badge" style="background: ${dayColor}; border-color: #ffffff; color: #000000;">
                <span class="marker-num">D${dIdx + 1}.${sIdx + 1}</span>
              </div>
              <div class="marker-label">${spot.name}</div>
            </div>
          `;

          const customIcon = L.divIcon({
            className: 'custom-leaflet-marker-wrap',
            html: markerHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

          marker.on('click', () => {
            onSelectSpot(dIdx, sIdx);
          });

          marker.bindTooltip(`
            <div class="leaflet-tooltip-card">
              <div class="tooltip-num" style="color: ${dayColor}">Day ${dIdx + 1} • Spot ${sIdx + 1}</div>
              <div class="tooltip-title">${spot.name}</div>
              <div class="tooltip-meta">${spot.images.length} photos ${spot.time ? `• ${spot.time}` : ''}</div>
            </div>
          `, {
            direction: 'top',
            offset: [0, -18],
            opacity: 0.96,
            className: 'custom-tooltip-popup'
          });

          marker.addTo(markersGroup);
        });
      });

      // Fit bounds to show all spots in Iceland
      if (allCoordsForBounds.length > 0) {
        const bounds = L.latLngBounds(allCoordsForBounds);
        map.flyToBounds(bounds, {
          padding: [70, 70],
          maxZoom: 13,
          duration: 1.2
        });
      }
      return;
    }

    // =========================================================================
    // 2. DAY OVERVIEW MODE: Render current day's driving route
    // =========================================================================
    const dayColor = currentDay.color || DEFAULT_DAY_COLORS[currentDayIndex % DEFAULT_DAY_COLORS.length];

    if (viewMode === 'day-overview') {
      const drivingPts = currentDay.driving_route && currentDay.driving_route.length > 1
        ? currentDay.driving_route
        : null;

      if (drivingPts) {
        // Glow layer
        L.polyline(drivingPts, {
          color: dayColor,
          weight: 8,
          opacity: 0.4,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroup);

        // Core driving road line
        L.polyline(drivingPts, {
          color: dayColor,
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroup);
      }

      currentSpots.forEach((spot, sIdx) => {
        const markerHtml = `
          <div class="custom-map-marker is-overview">
            <div class="marker-badge" style="background: ${dayColor}; border-color: #ffffff; color: #000;">
              <span class="marker-num">${sIdx + 1}</span>
            </div>
            <div class="marker-label">${spot.name}</div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker-wrap',
          html: markerHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

        marker.on('click', () => {
          onSelectSpot(currentDayIndex, sIdx);
        });

        marker.bindTooltip(`
          <div class="leaflet-tooltip-card">
            <div class="tooltip-num" style="color: ${dayColor}">Spot ${sIdx + 1}</div>
            <div class="tooltip-title">${spot.name}</div>
            <div class="tooltip-meta">${spot.images.length} photos ${spot.time ? `• ${spot.time}` : ''}</div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.96,
          className: 'custom-tooltip-popup'
        });

        marker.addTo(markersGroup);
      });

      if (currentSpots.length > 0) {
        const bounds = L.latLngBounds(currentSpots.map(s => [s.lat, s.lng]));
        map.flyToBounds(bounds, {
          padding: [70, 70],
          maxZoom: 14,
          duration: 1.1
        });
      }
      return;
    }

    // =========================================================================
    // 3. SPOT DETAIL SPLIT VIEW: Real driving route from previous spot
    // =========================================================================
    if (viewMode === 'spot-detail' && currentSpot) {
      // 3A. Draw entire day road route faintly in background
      if (currentDay.driving_route && currentDay.driving_route.length > 1) {
        L.polyline(currentDay.driving_route, {
          color: '#475569',
          weight: 3,
          dashArray: '5, 8',
          opacity: 0.5,
          lineCap: 'round',
        }).addTo(routeGroup);
      }

      // 3B. Draw real driving road segment from previous spot to current spot
      if (currentSpot.driving_route && currentSpot.driving_route.length > 1) {
        const drivingSegment = currentSpot.driving_route;

        // Glow
        L.polyline(drivingSegment, {
          color: '#38bdf8',
          weight: 9,
          opacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroup);

        // Core driving line
        L.polyline(drivingSegment, {
          color: '#06b6d4',
          weight: 5,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroup);
      }

      // 3C. Add Markers for spots in the day
      currentSpots.forEach((spot, idx) => {
        const isCurrent = idx === currentSpotIndex;
        const spotNum = idx + 1;

        const markerHtml = `
          <div class="custom-map-marker ${isCurrent ? 'is-active' : ''}">
            ${isCurrent ? '<div class="marker-pulse"></div>' : ''}
            <div class="marker-badge">
              <span class="marker-num">${spotNum}</span>
            </div>
            ${isCurrent ? `<div class="marker-label">${spot.name}</div>` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker-wrap',
          html: markerHtml,
          iconSize: isCurrent ? [40, 40] : [28, 28],
          iconAnchor: isCurrent ? [20, 20] : [14, 14],
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

        marker.on('click', () => {
          onSelectSpot(currentDayIndex, idx);
        });

        marker.bindTooltip(`
          <div class="leaflet-tooltip-card">
            <div class="tooltip-num">Spot ${spotNum}</div>
            <div class="tooltip-title">${spot.name}</div>
            <div class="tooltip-meta">${spot.images.length} photos ${spot.time ? `• ${spot.time}` : ''}</div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.96,
          className: 'custom-tooltip-popup'
        });

        marker.addTo(markersGroup);
      });

      // Camera transition
      if (currentSpot.driving_route && currentSpot.driving_route.length > 1) {
        const segBounds = L.latLngBounds(currentSpot.driving_route);
        map.flyToBounds(segBounds, {
          padding: [80, 80],
          maxZoom: 14,
          duration: 0.9
        });
      } else {
        map.flyTo([currentSpot.lat, currentSpot.lng], 13, {
          duration: 0.9
        });
      }
    }
  }, [allDays, currentDayIndex, currentSpotIndex, viewMode, onSelectSpot, onSelectDay]);

  return (
    <div className="leaflet-map-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
