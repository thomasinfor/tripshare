import { Accommodation, ItineraryDay, NormalizedTrip, Spot, TripRaw } from '../types';

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

function resolveDayAccommodations(days: ItineraryDay[]): Array<{
  startAcc?: Accommodation;
  endAcc?: Accommodation;
}> {
  const resolvedEnds: Array<Accommodation | undefined> = days.map((day) => {
    if (day.end_accommodation) return day.end_accommodation;
    const spots = day.spots || [];
    for (let i = spots.length - 1; i >= 0; i--) {
      const s = spots[i];
      if (s.is_accommodation) {
        return {
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          url: s.google_maps_place?.url,
        };
      }
    }
    return undefined;
  });

  return days.map((day, dIdx) => ({
    startAcc: dIdx > 0 ? (resolvedEnds[dIdx - 1] ?? day.start_accommodation) : day.start_accommodation,
    endAcc: resolvedEnds[dIdx],
  }));
}

function extractFirstSpotRoute(
  day: ItineraryDay,
  rawSpots: Spot[],
  startAcc?: Accommodation,
  endAcc?: Accommodation
): {
  dayDrivingRoute?: [number, number][];
  firstSpotRoute?: [number, number][];
  firstSpotDistanceKm?: number;
  firstSpotDurationMin?: number;
  showPreviousRoute?: boolean;
} {
  const firstSpot = rawSpots[0];
  if (!firstSpot) {
    return { dayDrivingRoute: day.driving_route };
  }

  let dayDrivingRoute = day.driving_route;

  // Preserve explicitly populated spot[0].driving_route if present
  if (firstSpot.driving_route && firstSpot.driving_route.length > 1) {
    const existingFirst = firstSpot.driving_route;
    if (
      dayDrivingRoute &&
      dayDrivingRoute.length > 1 &&
      rawDistanceKm(
        dayDrivingRoute[0][0],
        dayDrivingRoute[0][1],
        existingFirst[0][0],
        existingFirst[0][1]
      ) > 0.2
    ) {
      dayDrivingRoute = [...existingFirst, ...dayDrivingRoute];
    }
    return {
      dayDrivingRoute,
      firstSpotRoute: existingFirst,
      firstSpotDistanceKm: firstSpot.driving_distance_km,
      firstSpotDurationMin: firstSpot.driving_duration_min,
      showPreviousRoute: firstSpot.show_previous_route ?? true,
    };
  }

  if (!startAcc || !dayDrivingRoute || dayDrivingRoute.length <= 1) {
    return {
      dayDrivingRoute,
      firstSpotRoute: firstSpot.driving_route,
      firstSpotDistanceKm: firstSpot.driving_distance_km,
      firstSpotDurationMin: firstSpot.driving_duration_min,
      showPreviousRoute: firstSpot.show_previous_route ?? false,
    };
  }

  // Only slice from day.driving_route when it genuinely starts near start_accommodation
  if (rawDistanceKm(dayDrivingRoute[0][0], dayDrivingRoute[0][1], startAcc.lat, startAcc.lng) > 1.0) {
    return {
      dayDrivingRoute,
      firstSpotRoute: firstSpot.driving_route,
      firstSpotDistanceKm: firstSpot.driving_distance_km,
      firstSpotDurationMin: firstSpot.driving_duration_min,
      showPreviousRoute: firstSpot.show_previous_route ?? false,
    };
  }

  let splitIdx = -1;
  if (rawSpots.length > 1 && rawSpots[1].driving_route && rawSpots[1].driving_route.length >= 2) {
    const s1Route = rawSpots[1].driving_route;
    for (let j = 0; j < dayDrivingRoute.length - 1; j++) {
      if (
        dayDrivingRoute[j][0] === s1Route[0][0] &&
        dayDrivingRoute[j][1] === s1Route[0][1] &&
        dayDrivingRoute[j + 1][0] === s1Route[1][0] &&
        dayDrivingRoute[j + 1][1] === s1Route[1][1]
      ) {
        splitIdx = j;
        break;
      }
    }

    // Parking turnaround fallback: match single vertex closest to firstSpot
    if (splitIdx === -1) {
      let bestCandidateDist = Infinity;
      for (let j = 0; j < dayDrivingRoute.length; j++) {
        if (dayDrivingRoute[j][0] === s1Route[0][0] && dayDrivingRoute[j][1] === s1Route[0][1]) {
          const dist = rawDistanceKm(dayDrivingRoute[j][0], dayDrivingRoute[j][1], firstSpot.lat, firstSpot.lng);
          if (dist < bestCandidateDist) {
            bestCandidateDist = dist;
            splitIdx = j;
          }
        }
      }
    }
  }

  // Fallback (also handles single-spot days): closest point on dayDrivingRoute to firstSpot
  if (splitIdx === -1) {
    let bestDist = Infinity;
    for (let j = 0; j < dayDrivingRoute.length; j++) {
      const dist = rawDistanceKm(dayDrivingRoute[j][0], dayDrivingRoute[j][1], firstSpot.lat, firstSpot.lng);
      if (dist < bestDist) {
        bestDist = dist;
        splitIdx = j;
      }
    }
  }

  const firstLegRoute = dayDrivingRoute.slice(0, splitIdx + 1);
  if (firstLegRoute.length <= 1) {
    return {
      dayDrivingRoute,
      firstSpotRoute: firstSpot.driving_route,
      firstSpotDistanceKm: firstSpot.driving_distance_km,
      firstSpotDurationMin: firstSpot.driving_duration_min,
      showPreviousRoute: firstSpot.show_previous_route ?? false,
    };
  }

  const polyKm = computePolylineDistanceKm(firstLegRoute);
  const polyKmRounded = Math.round(polyKm * 10) / 10;
  let firstSpotDistanceKm = polyKmRounded;
  if (day.driving_distance_km !== undefined) {
    if (rawSpots.length > 1) {
      const otherSpotsKm = rawSpots.slice(1).reduce((acc, s) => acc + (s.driving_distance_km || 0), 0);
      const remKm = Math.round((day.driving_distance_km - otherSpotsKm) * 10) / 10;
      firstSpotDistanceKm = remKm > 0 ? remKm : polyKmRounded;
    } else if (endAcc && rawDistanceKm(firstSpot.lat, firstSpot.lng, endAcc.lat, endAcc.lng) > 0.5) {
      firstSpotDistanceKm = polyKmRounded;
    } else {
      firstSpotDistanceKm = day.driving_distance_km || polyKmRounded;
    }
  }

  let firstSpotDurationMin = firstSpot.driving_duration_min;
  if (day.driving_duration_min !== undefined) {
    const otherMin = rawSpots.slice(1).reduce((acc, s) => acc + (s.driving_duration_min || 0), 0);
    const remMin = Math.round(day.driving_duration_min - otherMin);
    if (remMin > 0) {
      firstSpotDurationMin = remMin;
    }
  }

  return {
    dayDrivingRoute,
    firstSpotRoute: firstLegRoute,
    firstSpotDistanceKm,
    firstSpotDurationMin,
    showPreviousRoute: true,
  };
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
  const accommodations = resolveDayAccommodations(days);

  return {
    trip: tripName,
    slug,
    title: raw.title || tripName || 'Trip Adventure',
    description: raw.description || '',
    cover_image: raw.cover_image,
    days: days.map((day, dIdx) => {
      const { startAcc, endAcc } = accommodations[dIdx];
      const rawSpots = day.spots || [];
      const firstLeg = extractFirstSpotRoute(day, rawSpots, startAcc, endAcc);

      return {
        date: day.date || `Day ${dIdx + 1}`,
        title: day.title || `Day ${dIdx + 1}`,
        color: day.color || getDistinctDayColor(dIdx),
        start_accommodation: startAcc,
        end_accommodation: endAcc,
        driving_route: firstLeg.dayDrivingRoute,
        driving_distance_km: day.driving_distance_km,
        driving_duration_min: day.driving_duration_min,
        spots: rawSpots.map((spot, sIdx) => ({
          ...spot,
          id: spot.id || `spot-${dIdx}-${sIdx}`,
          show_previous_route:
            sIdx === 0
              ? (firstLeg.showPreviousRoute ?? spot.show_previous_route ?? false)
              : (spot.show_previous_route ?? true),
          driving_route: sIdx === 0 ? firstLeg.firstSpotRoute : spot.driving_route,
          driving_distance_km: sIdx === 0 ? firstLeg.firstSpotDistanceKm : spot.driving_distance_km,
          driving_duration_min: sIdx === 0 ? firstLeg.firstSpotDurationMin : spot.driving_duration_min,
        })),
      };
    }),
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

function rawDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

function computePolylineDistanceKm(pts: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += rawDistanceKm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return total;
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(rawDistanceKm(lat1, lon1, lat2, lon2) * 10) / 10;
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
