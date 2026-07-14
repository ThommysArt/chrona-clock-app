/** Brand primary — red */
export const ACCENT = "#E11D48";
export const ACCENT_SOFT = "rgba(225, 29, 72, 0.12)";

export const PAGE_BG = {
  light: "#f2f2f7",
  dark: "#0c0c0e",
} as const;

/** Time travel range: ±12 hours in milliseconds */
export const TIME_TRAVEL_RANGE_MS = 12 * 60 * 60 * 1000;

/** Tick interval for live clock updates */
export const TICK_MS = 1000;

/** Default saved cities matching product screenshots */
export const DEFAULT_CITIES = [
  {
    id: "cupertino",
    label: "Cupertino",
    region: "CA, United States",
    timezone: "America/Los_Angeles",
    latitude: 37.323,
    longitude: -122.0322,
  },
  {
    id: "new-york",
    label: "New York",
    region: "NY, United States",
    timezone: "America/New_York",
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    id: "london",
    label: "London",
    region: "United Kingdom",
    timezone: "Europe/London",
    latitude: 51.5074,
    longitude: -0.1278,
  },
] as const;

/** Extra popular cities for search (with coords for globe) */
export const POPULAR_CITIES = [
  ...DEFAULT_CITIES,
  {
    id: "tokyo",
    label: "Tokyo",
    region: "Japan",
    timezone: "Asia/Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    id: "sydney",
    label: "Sydney",
    region: "Australia",
    timezone: "Australia/Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
  },
  {
    id: "paris",
    label: "Paris",
    region: "France",
    timezone: "Europe/Paris",
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    id: "dubai",
    label: "Dubai",
    region: "United Arab Emirates",
    timezone: "Asia/Dubai",
    latitude: 25.2048,
    longitude: 55.2708,
  },
  {
    id: "singapore",
    label: "Singapore",
    region: "Singapore",
    timezone: "Asia/Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
  },
  {
    id: "hong-kong",
    label: "Hong Kong",
    region: "Hong Kong",
    timezone: "Asia/Hong_Kong",
    latitude: 22.3193,
    longitude: 114.1694,
  },
  {
    id: "berlin",
    label: "Berlin",
    region: "Germany",
    timezone: "Europe/Berlin",
    latitude: 52.52,
    longitude: 13.405,
  },
  {
    id: "mumbai",
    label: "Mumbai",
    region: "India",
    timezone: "Asia/Kolkata",
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    id: "sao-paulo",
    label: "São Paulo",
    region: "Brazil",
    timezone: "America/Sao_Paulo",
    latitude: -23.5505,
    longitude: -46.6333,
  },
  {
    id: "los-angeles",
    label: "Los Angeles",
    region: "CA, United States",
    timezone: "America/Los_Angeles",
    latitude: 34.0522,
    longitude: -118.2437,
  },
  {
    id: "chicago",
    label: "Chicago",
    region: "IL, United States",
    timezone: "America/Chicago",
    latitude: 41.8781,
    longitude: -87.6298,
  },
  {
    id: "toronto",
    label: "Toronto",
    region: "Canada",
    timezone: "America/Toronto",
    latitude: 43.6532,
    longitude: -79.3832,
  },
  {
    id: "mexico-city",
    label: "Mexico City",
    region: "Mexico",
    timezone: "America/Mexico_City",
    latitude: 19.4326,
    longitude: -99.1332,
  },
  {
    id: "seoul",
    label: "Seoul",
    region: "South Korea",
    timezone: "Asia/Seoul",
    latitude: 37.5665,
    longitude: 126.978,
  },
  {
    id: "auckland",
    label: "Auckland",
    region: "New Zealand",
    timezone: "Pacific/Auckland",
    latitude: -36.8509,
    longitude: 174.7645,
  },
  {
    id: "cairo",
    label: "Cairo",
    region: "Egypt",
    timezone: "Africa/Cairo",
    latitude: 30.0444,
    longitude: 31.2357,
  },
  {
    id: "johannesburg",
    label: "Johannesburg",
    region: "South Africa",
    timezone: "Africa/Johannesburg",
    latitude: -26.2041,
    longitude: 28.0473,
  },
  {
    id: "istanbul",
    label: "Istanbul",
    region: "Türkiye",
    timezone: "Europe/Istanbul",
    latitude: 41.0082,
    longitude: 28.9784,
  },
  {
    id: "moscow",
    label: "Moscow",
    region: "Russia",
    timezone: "Europe/Moscow",
    latitude: 55.7558,
    longitude: 37.6173,
  },
  {
    id: "bangkok",
    label: "Bangkok",
    region: "Thailand",
    timezone: "Asia/Bangkok",
    latitude: 13.7563,
    longitude: 100.5018,
  },
] as const;

export type CityDefinition = {
  id: string;
  label: string;
  region: string;
  timezone: string;
  latitude: number;
  longitude: number;
};
