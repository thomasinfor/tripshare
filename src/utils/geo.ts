import { TripRaw, NormalizedTrip, ItineraryDay } from '../types';

export function normalizeTrip(raw: TripRaw): NormalizedTrip {
  let days: ItineraryDay[] = [];

  if (Array.isArray(raw.itinerary)) {
    days = raw.itinerary;
  } else if (raw.itinerary && typeof raw.itinerary === 'object') {
    days = [raw.itinerary as ItineraryDay];
  }

  return {
    trip: raw.trip || 'Trip',
    title: raw.title || raw.trip || 'Trip Adventure',
    description: raw.description || '',
    cover_image: raw.cover_image,
    days: days.map((day, dIdx) => ({
      date: day.date || `Day ${dIdx + 1}`,
      title: day.title || `Day ${dIdx + 1}`,
      color: day.color,
      driving_route: day.driving_route,
      driving_distance_km: day.driving_distance_km,
      driving_duration_min: day.driving_duration_min,
      spots: (day.spots || []).map((spot, sIdx) => ({
        ...spot,
        id: spot.id || `spot-${dIdx}-${sIdx}`,
        show_previous_route: spot.show_previous_route ?? (sIdx > 0),
        driving_route: spot.driving_route,
        driving_distance_km: spot.driving_distance_km,
        driving_duration_min: spot.driving_duration_min,
      }))
    }))
  };
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function calculateDayDistance(spots: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < spots.length; i++) {
    total += calculateDistanceKm(spots[i - 1].lat, spots[i - 1].lng, spots[i].lat, spots[i].lng);
  }
  return Math.round(total * 10) / 10;
}

export function formatCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}
