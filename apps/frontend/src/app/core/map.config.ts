import { Map, MapOptions, MapStyle, config as maptilerConfig } from '@maptiler/sdk';
import { environment } from '../../environments/environment';
import { API_URL } from './api.config';

export const MAPTILER_KEY = environment.maptilerKey.trim();
export const MAPTILER_STYLE = MapStyle.STREETS;
export const MAPTILER_DARK_STYLE = MapStyle.STREETS.DARK;
export const MAPTILER_HYBRID_STYLE = MapStyle.HYBRID;

export type KorviMapMode = 'standard' | 'hybrid';

export type LatLngPoint = {
  latitude: number;
  longitude: number;
};

export type ReverseGeocodeDetails = {
  province?: string;
  municipality?: string;
  address?: string;
};

type KorviMapOptions = {
  center: LatLngPoint;
  zoom: number;
  navigationControl?: boolean;
  geolocateControl?: boolean;
  scrollZoom?: boolean;
  attributionControl?: MapOptions['attributionControl'];
};

type KorviMapStyle = NonNullable<MapOptions['style']>;

const mapModes = new WeakMap<Map, KorviMapMode>();
const systemConfigStorageKey = 'ruta_segura_system_config';

type StoredSystemConfig = {
  integrations?: { mapProvider?: string; geocodingProvider?: string };
  libraries?: { mapProvider?: string; maptilerApiKey?: string };
  apiKeys?: { maptiler?: string; googleMaps?: string };
};

type KorviMapProvider = 'MapTiler' | 'OpenStreetMap' | 'Google Maps';

type ReverseGeocodeFeature = {
  text?: string;
  place_name?: string;
  place_type?: string[];
  context?: Array<{ id?: string; text?: string }>;
};

type ReverseGeocodeResult = {
  features?: ReverseGeocodeFeature[];
};

type NominatimReverseGeocodeResult = {
  display_name?: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    province?: string;
  };
};

type GoogleMapsTileSession = {
  session: string;
  apiKey: string;
  expiresAt: number;
};

const googleMapsTileSessions = new globalThis.Map<string, GoogleMapsTileSession>();
const GOOGLE_MAPS_TILE_PROVIDER_ERROR_EVENT = 'rs-map-provider-error';

export function createKorviMap(container: HTMLElement, options: KorviMapOptions): Map {
  const apiKey = currentKorviMaptilerKey();
  maptilerConfig.apiKey = apiKey;

  const provider = currentKorviMapProvider();
  const map = new Map({
    container,
    style: currentKorviMapStyle('standard'),
    apiKey,
    center: toLngLat(options.center),
    zoom: options.zoom,
    navigationControl: options.navigationControl ?? false,
    geolocateControl: options.geolocateControl ?? false,
    attributionControl: options.attributionControl ?? { compact: 'auto' },
    maptilerLogo: provider === 'MapTiler',
    scrollZoom: options.scrollZoom ?? true,
  } satisfies MapOptions);

  mapModes.set(map, 'standard');
  if (provider === 'Google Maps') {
    applyGoogleMapsTileStyle(map, 'standard');
  }
  return map;
}

export function isKorviDarkTheme(): boolean {
  return document.body.classList.contains('rs-dark-theme');
}

export function currentKorviMapStyle(mode: KorviMapMode = 'standard'): KorviMapStyle {
  if (currentKorviMapProvider() === 'OpenStreetMap') return openStreetMapRasterStyle();
  if (currentKorviMapProvider() === 'Google Maps') {
    const googleStyle = googleMapsRasterStyleFromCachedSession(mode);
    return googleStyle ?? googleMapsPendingStyle();
  }
  if (mode === 'hybrid') return MAPTILER_HYBRID_STYLE as KorviMapStyle;
  return (isKorviDarkTheme() ? MAPTILER_DARK_STYLE : MAPTILER_STYLE) as KorviMapStyle;
}

export function currentKorviMapProvider(): KorviMapProvider {
  const provider = readStoredSystemConfig()?.integrations?.mapProvider ?? readStoredSystemConfig()?.libraries?.mapProvider;
  if (provider === 'Google Maps') return 'Google Maps';
  if (provider === 'OpenStreetMap') return 'OpenStreetMap';
  return 'MapTiler';
}

export function currentKorviMaptilerKey(): string {
  const stored = readStoredSystemConfig();
  return (stored?.apiKeys?.maptiler || stored?.libraries?.maptilerApiKey || MAPTILER_KEY).trim();
}

export function currentKorviGoogleMapsKey(): string {
  return (readStoredSystemConfig()?.apiKeys?.googleMaps ?? '').trim();
}

export function getKorviMapMode(map?: Map): KorviMapMode {
  if (!map) return 'standard';
  return mapModes.get(map) ?? 'standard';
}

export function setKorviMapMode(map: Map | undefined, mode: KorviMapMode, onStyleReady?: () => void): KorviMapMode {
  if (!map) return mode;
  mapModes.set(map, mode);
  if (onStyleReady) onKorviMapStyleReady(map, onStyleReady);
  if (currentKorviMapProvider() === 'Google Maps') {
    applyGoogleMapsTileStyle(map, mode);
    return mode;
  }
  map.setStyle(currentKorviMapStyle(mode));
  return mode;
}

export function toggleKorviMapMode(map?: Map, onStyleReady?: () => void): KorviMapMode {
  const nextMode: KorviMapMode = getKorviMapMode(map) === 'hybrid' ? 'standard' : 'hybrid';
  return setKorviMapMode(map, nextMode, onStyleReady);
}

export function applyKorviMapTheme(map?: Map, onStyleReady?: () => void): void {
  if (!map) return;
  if (onStyleReady) onKorviMapStyleReady(map, onStyleReady);
  if (currentKorviMapProvider() === 'Google Maps') {
    applyGoogleMapsTileStyle(map, getKorviMapMode(map));
    return;
  }
  map.setStyle(currentKorviMapStyle(getKorviMapMode(map)));
}

export function onKorviMapStyleReady(map: Map, callback: () => void): void {
  let completed = false;
  const run = () => {
    if (completed) return;
    completed = true;
    requestAnimationFrame(callback);
  };

  map.once('style.load', run);
  map.once('idle', run);
  window.setTimeout(run, 900);
}

export function toLngLat(point: LatLngPoint): [number, number] {
  return [point.longitude, point.latitude];
}

export async function reverseGeocodeKorviLocation(latitude: number, longitude: number): Promise<ReverseGeocodeDetails> {
  const provider = readStoredSystemConfig()?.integrations?.geocodingProvider;
  if (provider === 'OpenStreetMap Nominatim' || !currentKorviMaptilerKey()) {
    return reverseGeocodeWithNominatim(latitude, longitude);
  }

  try {
    return await reverseGeocodeWithMapTiler(latitude, longitude);
  } catch {
    return reverseGeocodeWithNominatim(latitude, longitude);
  }
}

export function metersBetween(a: LatLngPoint, b: LatLngPoint): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function circlePolygon(center: LatLngPoint, radiusMeters: number, steps = 96) {
  const earthRadiusMeters = 6371000;
  const coordinates: Array<[number, number]> = [];
  const latitude = (center.latitude * Math.PI) / 180;
  const longitude = (center.longitude * Math.PI) / 180;
  const angularDistance = radiusMeters / earthRadiusMeters;

  for (let index = 0; index <= steps; index += 1) {
    const bearing = (2 * Math.PI * index) / steps;
    const pointLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(pointLatitude),
      );

    coordinates.push([(pointLongitude * 180) / Math.PI, (pointLatitude * 180) / Math.PI]);
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coordinates],
    },
  };
}

export function mapReady(map: Map, callback: () => void): void {
  const styleLoaded = (map as Map & { isStyleLoaded?: () => boolean }).isStyleLoaded?.() ?? false;
  if (map.loaded() || styleLoaded) {
    callback();
    return;
  }

  let completed = false;
  const run = () => {
    if (completed) return;
    completed = true;
    callback();
  };

  map.once('load', run);
  map.once('style.load', run);
}

export function scheduleMapResize(map: Map, container?: HTMLElement): void {
  const resize = () => {
    if (container && (!container.offsetWidth || !container.offsetHeight)) return;
    map.resize();
  };

  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });

  window.setTimeout(resize, 80);
  window.setTimeout(resize, 240);
}

export function observeMapResize(map: Map, container: HTMLElement): ResizeObserver | undefined {
  const resize = () => scheduleMapResize(map, container);
  map.on('load', resize);
  resize();

  if (typeof ResizeObserver === 'undefined') return undefined;

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  return observer;
}

function readStoredSystemConfig(): StoredSystemConfig | null {
  try {
    const raw = localStorage.getItem(systemConfigStorageKey);
    return raw ? JSON.parse(raw) as StoredSystemConfig : null;
  } catch {
    return null;
  }
}

function openStreetMapRasterStyle(): KorviMapStyle {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  } as KorviMapStyle;
}

async function applyGoogleMapsTileStyle(map: Map, mode: KorviMapMode): Promise<void> {
  try {
    const key = currentKorviGoogleMapsKey();
    const mapType = googleMapsMapType(mode);
    const session = await googleMapsTileSession(mapType, key);
    map.setStyle(googleMapsRasterStyle(session.session, session.apiKey, mapType));
  } catch {
    dispatchGoogleMapsProviderError('No se pudo cargar Google Maps. Verifica GOOGLE_MAPS_API_KEY, billing, Map Tiles API y permisos para este origen.');
  }
}

function dispatchGoogleMapsProviderError(detail: string): void {
  window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_TILE_PROVIDER_ERROR_EVENT, { detail }));
}

async function reverseGeocodeWithMapTiler(latitude: number, longitude: number): Promise<ReverseGeocodeDetails> {
  const key = currentKorviMaptilerKey();
  if (!key) throw new Error('MAPTILER_KEY no configurado');

  const query = new URLSearchParams({
    key,
    language: 'es',
    country: 'do',
  });
  const response = await fetch(`https://api.maptiler.com/geocoding/${longitude},${latitude}.json?${query.toString()}`);
  if (!response.ok) throw new Error('Reverse geocoding failed');

  const result = (await response.json()) as ReverseGeocodeResult;
  return extractMapTilerLocationDetails(result.features ?? []);
}

async function reverseGeocodeWithNominatim(latitude: number, longitude: number): Promise<ReverseGeocodeDetails> {
  const query = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'es',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`);
  if (!response.ok) throw new Error('Nominatim reverse geocoding failed');

  const result = (await response.json()) as NominatimReverseGeocodeResult;
  const address = result.address ?? {};
  return {
    province: address.state ?? address.region ?? address.province,
    municipality: address.municipality ?? address.city ?? address.town ?? address.village ?? address.county,
    address: cleanReverseGeocodeAddress(
      [address.road, address.neighbourhood, address.suburb].filter(Boolean).join(', ') || result.display_name,
    ),
  };
}

function extractMapTilerLocationDetails(features: ReverseGeocodeFeature[]): ReverseGeocodeDetails {
  const allItems = features.flatMap((feature) => [feature, ...(feature.context ?? []).map((context) => ({ ...context, place_type: [context.id?.split('.')[0] ?? ''] }))]);
  const byType = (types: string[]) => allItems.find((item) => item.place_type?.some((type) => types.includes(type)))?.text;
  const firstFeature = features[0];

  return {
    province: byType(['region', 'state', 'province']),
    municipality: byType(['municipality', 'place', 'locality', 'district', 'city']),
    address: cleanReverseGeocodeAddress(firstFeature?.place_name ?? firstFeature?.text),
  };
}

function cleanReverseGeocodeAddress(value: string | undefined): string {
  if (!value) return '';
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !['Republica Dominicana', 'República Dominicana', 'Dominican Republic'].includes(part))
    .slice(0, 3)
    .join(', ');
}

async function googleMapsTileSession(mapType: string, key: string): Promise<GoogleMapsTileSession> {
  const cacheKey = `${mapType}:${key}`;
  const cached = googleMapsTileSessions.get(cacheKey) ?? (!key ? [...googleMapsTileSessions.entries()].find(([entryKey]) => entryKey.startsWith(`${mapType}:`))?.[1] : undefined);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached;

  const token = localStorage.getItem('ruta_segura_token');
  const response = await fetch(`${API_URL}/reports/maps/google/tile-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ruta-Platform': 'web',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ apiKey: key || undefined, mapType }),
  });
  if (!response.ok) throw new Error('Google Maps Tile API session failed');

  const payload = await response.json() as { session?: string; apiKey?: string; expiry?: string };
  if (!payload.session) throw new Error('Google Maps Tile API session missing');
  if (!payload.apiKey) throw new Error('Google Maps API key missing');

  const expiry = Number(payload.expiry);
  const session = {
    session: payload.session,
    apiKey: payload.apiKey,
    expiresAt: Number.isFinite(expiry) ? expiry * 1000 : Date.now() + 13 * 24 * 60 * 60 * 1000,
  };
  googleMapsTileSessions.set(`${mapType}:${key || payload.apiKey}`, session);
  return session;
}

function googleMapsRasterStyle(session: string, key: string, mapType: string): KorviMapStyle {
  const attribution = '&copy; Google';
  return {
    version: 8,
    sources: {
      google: {
        type: 'raster',
        tiles: [
          `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`,
        ],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: `google-${mapType}`,
        type: 'raster',
        source: 'google',
      },
    ],
  } as KorviMapStyle;
}

function googleMapsRasterStyleFromCachedSession(mode: KorviMapMode): KorviMapStyle | null {
  const key = currentKorviGoogleMapsKey();
  if (!key && !googleMapsTileSessions.size) return null;
  const mapType = googleMapsMapType(mode);
  const cached = googleMapsTileSessions.get(`${mapType}:${key}`) ?? [...googleMapsTileSessions.entries()].find(([cacheKey]) => cacheKey.startsWith(`${mapType}:`))?.[1];
  if (!cached || cached.expiresAt <= Date.now() + 60000) return null;
  return googleMapsRasterStyle(cached.session, cached.apiKey, mapType);
}

function googleMapsMapType(mode: KorviMapMode): 'roadmap' | 'satellite' {
  return mode === 'hybrid' ? 'satellite' : 'roadmap';
}

function googleMapsPendingStyle(): KorviMapStyle {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'google-pending-background',
        type: 'background',
        paint: {
          'background-color': isKorviDarkTheme() ? '#18201c' : '#eef4ef',
        },
      },
    ],
  } as KorviMapStyle;
}
