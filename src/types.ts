export interface Accommodation {
  name: string;
  lat: number;
  lng: number;
  url?: string;
}

export interface GoogleMapsPlace {
  name: string;
  url: string;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  images: string[];
  show_previous_route?: boolean;
  time?: string;
  description?: string;
  is_accommodation?: boolean;
  google_maps_place?: GoogleMapsPlace;
  waypoints?: [number, number][];
  driving_route?: [number, number][]; // [lat, lng] array along roads
  driving_distance_km?: number;
  driving_duration_min?: number;
}

export interface ItineraryDay {
  date: string;
  title?: string;
  color?: string; // hex color for day's route line
  start_accommodation?: Accommodation;
  end_accommodation?: Accommodation;
  spots: Spot[];
  driving_route?: [number, number][]; // complete day driving path
  driving_distance_km?: number;
  driving_duration_min?: number;
}

export interface TripRaw {
  trip: string;
  slug?: string;
  title?: string;
  description?: string;
  cover_image?: string;
  itinerary: ItineraryDay[] | {
    date: string;
    title?: string;
    spots: Spot[];
  };
}

export interface NormalizedTrip {
  trip: string;
  slug: string;
  title: string;
  description: string;
  cover_image?: string;
  total_distance_km?: number;
  days: ItineraryDay[];
}

export type ViewMode = 'trip-overview' | 'day-overview' | 'spot-detail';
export type MapProvider = 'leaflet' | 'google';
export type MapStyle = 'dark' | 'satellite' | 'streets';
