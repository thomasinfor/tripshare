import { TripRaw, NormalizedTrip, ItineraryDay } from '../types';

export const DAY_COLOR_PALETTE = [
  '#dc2626', // Day 1  — Crimson Red (0°)
  '#0284c7', // Day 2  — Cerulean Blue (200°)
  '#d97706', // Day 3  — Rich Amber (32°)
  '#7c3aed', // Day 4  — Royal Violet (262°)
  '#16a34a', // Day 5  — Emerald Green (142°)
  '#db2777', // Day 6  — Magenta Rose (333°)
  '#2563eb', // Day 7  — Sapphire Blue (221°)
  '#ea580c', // Day 8  — Burnt Tangerine (21°)
  '#0d9488', // Day 9  — Deep Teal (175°)
  '#c026d3', // Day 10 — Orchid Fuchsia (293°)
  '#65a30d', // Day 11 — Moss Olive (84°)
  '#4f46e5', // Day 12 — Indigo Cobalt (243°)
  '#ca8a04', // Day 13 — Golden Ochre (45°)
  '#9333ea', // Day 14 — Amethyst Purple (271°)
  '#15803d', // Day 15 — Pine Forest (142°)
  '#0891b2', // Day 16 — Glacier Cyan (192°)
] as const;

export function getDistinctDayColor(dayIndex: number): string {
  const safeIdx = ((Math.trunc(dayIndex) % DAY_COLOR_PALETTE.length) + DAY_COLOR_PALETTE.length) % DAY_COLOR_PALETTE.length;
  return DAY_COLOR_PALETTE[safeIdx];
}

export function slugifyTripName(value: string, fallback = 'trip'): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function getTripMonogram(tripName: string): string {
  const cleaned = tripName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!cleaned) return 'TR';

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const letters = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  return (letters.slice(0, 2) || 'TR').toUpperCase();
}

export function normalizeTrip(raw: TripRaw, fallbackIndex = 0): NormalizedTrip {
  let days: ItineraryDay[] = [];

  if (Array.isArray(raw.itinerary)) {
    days = raw.itinerary;
  } else if (raw.itinerary && typeof raw.itinerary === 'object') {
    days = [raw.itinerary as ItineraryDay];
  }

  const tripName = raw.trip || `Trip ${fallbackIndex + 1}`;
  const slug = slugifyTripName(raw.slug || tripName, `trip-${fallbackIndex + 1}`);

  return {
    trip: tripName,
    slug,
    title: raw.title || tripName || 'Trip Adventure',
    description: raw.description || '',
    cover_image: raw.cover_image,
    days: days.map((day, dIdx) => ({
      date: day.date || `Day ${dIdx + 1}`,
      title: day.title || `Day ${dIdx + 1}`,
      color: day.color || getDistinctDayColor(dIdx),
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

export function normalizeTrips(rawSources: Array<TripRaw | TripRaw[]>): NormalizedTrip[] {
  const flattened: TripRaw[] = [];
  for (const source of rawSources) {
    if (Array.isArray(source)) {
      flattened.push(...source);
    } else if (source && typeof source === 'object') {
      flattened.push(source);
    }
  }

  const usedSlugs = new Set<string>();
  return flattened.map((raw, idx) => {
    const normalized = normalizeTrip(raw, idx);
    let candidate = normalized.slug;
    let suffix = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${normalized.slug}-${suffix++}`;
    }
    usedSlugs.add(candidate);
    return candidate === normalized.slug
      ? normalized
      : { ...normalized, slug: candidate };
  });
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
