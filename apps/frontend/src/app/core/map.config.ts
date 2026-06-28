import { Map, MapOptions, MapStyle, config as maptilerConfig } from '@maptiler/sdk';
import { API_URL } from './api.config';
import { buildEnv } from './build-env';

export const MAPTILER_KEY = buildEnv.maptilerKey.trim();
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
const languageStorageKey = 'korvi_language';

type StoredSystemConfig = {
  integrations?: { mapProvider?: string; geocodingProvider?: string };
  libraries?: {
    mapProvider?: string;
    maptilerApiKey?: string;
    mapThemeLight?: Partial<KorviStoredMapTheme>;
    mapThemeDark?: Partial<KorviStoredMapTheme>;
  };
  apiKeys?: { maptiler?: string; googleMaps?: string };
};

type KorviStoredMapTheme = {
  background: string;
  land: string;
  park: string;
  water: string;
  building: string;
  buildingOutline: string;
  road: string;
  roadPrimary: string;
  roadSecondary: string;
  roadCasing: string;
  label: string;
  labelMuted: string;
  poi: string;
  boundary: string;
  googleBrightnessMin: number;
  googleBrightnessMax: number;
  googleContrast: number;
  googleSaturation: number;
  googleHueRotate: number;
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
  expiresAt: number;
};

const googleMapsTileSessions = new globalThis.Map<string, GoogleMapsTileSession>();
const GOOGLE_MAPS_TILE_PROVIDER_ERROR_EVENT = 'rs-map-provider-error';
const KORVI_MAP_DESIGN_APPLIED_KEY = '__korviMapDesignApplied';

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
  map.on('style.load', () => applyKorviBaseMapDesign(map));
  map.once('load', () => applyKorviBaseMapDesign(map));
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
  return currentKorviMaptilerKey() ? 'MapTiler' : 'OpenStreetMap';
}

export function currentKorviMaptilerKey(): string {
  return MAPTILER_KEY;
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
    applyKorviBaseMapDesign(map);
    requestAnimationFrame(callback);
  };

  map.once('style.load', run);
  map.once('idle', run);
  window.setTimeout(run, 900);
}

export function applyKorviBaseMapDesign(map?: Map): void {
  if (!map) return;
  if (currentKorviMapProvider() !== 'MapTiler') return;
  if (getKorviMapMode(map) === 'hybrid') return;

  const style = map.getStyle();
  const stamp = `${isKorviDarkTheme() ? 'dark' : 'light'}:${style?.name ?? 'style'}:${style?.layers?.length ?? 0}`;
  const state = map as Map & Record<string, string | undefined>;
  if (state[KORVI_MAP_DESIGN_APPLIED_KEY] === stamp) return;

  try {
    const palette = currentKorviMapTheme();

    for (const layer of style.layers ?? []) {
      const id = layer.id.toLowerCase();
      if (layer.type === 'background') {
        setPaint(map, layer.id, 'background-color', palette.background);
      }
      if (layer.type === 'fill') {
        if (id.includes('water')) setPaint(map, layer.id, 'fill-color', palette.water);
        else if (id.includes('park') || id.includes('landcover') || id.includes('landuse') || id.includes('wood') || id.includes('grass')) {
          setPaint(map, layer.id, 'fill-color', palette.park);
        } else if (id.includes('building')) {
          setPaint(map, layer.id, 'fill-color', palette.building);
          setPaint(map, layer.id, 'fill-outline-color', palette.buildingOutline);
          setPaint(map, layer.id, 'fill-opacity', isKorviDarkTheme() ? 0.66 : 0.78);
        } else if (id.includes('land') || id.includes('earth')) {
          setPaint(map, layer.id, 'fill-color', palette.land);
        }
      }
      if (layer.type === 'line') {
        if (id.includes('road') || id.includes('street') || id.includes('transport')) {
          const isMajorRoad = id.includes('motorway') || id.includes('trunk') || id.includes('primary');
          const isSecondaryRoad = id.includes('secondary') || id.includes('tertiary');
          setPaint(map, layer.id, 'line-color', isMajorRoad ? palette.roadPrimary : isSecondaryRoad ? palette.roadSecondary : palette.road);
          setPaint(map, layer.id, 'line-opacity', isMajorRoad ? 0.96 : isSecondaryRoad ? 0.92 : 0.9);
          setPaint(
            map,
            layer.id,
            'line-width',
            isMajorRoad
              ? ['interpolate', ['linear'], ['zoom'], 9, 1.8, 12, 3.2, 15, 6.8, 18, 13]
              : isSecondaryRoad
                ? ['interpolate', ['linear'], ['zoom'], 9, 1.1, 12, 2.4, 15, 4.8, 18, 9]
                : ['interpolate', ['linear'], ['zoom'], 10, 0.7, 13, 1.8, 16, 4.2, 18, 7],
          );
        }
        if (id.includes('case') || id.includes('casing')) setPaint(map, layer.id, 'line-color', palette.roadCasing);
        if (id.includes('boundary') || id.includes('admin')) {
          setPaint(map, layer.id, 'line-color', palette.boundary);
          setPaint(map, layer.id, 'line-opacity', isKorviDarkTheme() ? 0.45 : 0.58);
        }
      }
      if (layer.type === 'symbol') {
        if (id.includes('label') || id.includes('place') || id.includes('poi') || id.includes('road')) {
          setPaint(map, layer.id, 'text-color', id.includes('poi') ? palette.poi : id.includes('road') ? palette.labelMuted : palette.label);
          setPaint(map, layer.id, 'text-halo-color', isKorviDarkTheme() ? '#0D1B24' : '#FFFFFF');
          setPaint(map, layer.id, 'text-halo-width', isKorviDarkTheme() ? 1.35 : 1.55);
          if (id.includes('poi')) setPaint(map, layer.id, 'icon-color', palette.poi);
        }
      }
    }

    state[KORVI_MAP_DESIGN_APPLIED_KEY] = stamp;
  } catch {
    state[KORVI_MAP_DESIGN_APPLIED_KEY] = stamp;
  }
}

function currentKorviMapTheme(): KorviStoredMapTheme {
  const defaults = defaultKorviMapTheme(isKorviDarkTheme());
  const stored = readStoredSystemConfig()?.libraries;
  const override = isKorviDarkTheme() ? stored?.mapThemeDark : stored?.mapThemeLight;
  if (isLegacyKorviMapTheme(override, isKorviDarkTheme())) return defaults;
  return { ...defaults, ...override };
}

function defaultKorviMapTheme(dark: boolean): KorviStoredMapTheme {
  return dark
    ? {
          background: '#101923',
          land: '#14212C',
          park: '#183C31',
          water: '#123D53',
          building: '#1E2D38',
          buildingOutline: '#304653',
          road: '#F8FBFF',
          roadPrimary: '#00C2A8',
          roadSecondary: '#D7E8F0',
          roadCasing: '#07111B',
          label: '#F4FAFC',
          labelMuted: '#B5C5CD',
          poi: '#76E0D0',
          boundary: '#506D7A',
          googleBrightnessMin: 0.05,
          googleBrightnessMax: 0.78,
          googleContrast: 0.18,
          googleSaturation: -0.18,
          googleHueRotate: 14,
        }
    : {
          background: '#F3F6F8',
          land: '#FAFBFC',
          park: '#DDF4E8',
          water: '#BDEAF2',
          building: '#E9EEF2',
          buildingOutline: '#D8E2EA',
          road: '#FFFFFF',
          roadPrimary: '#00C2A8',
          roadSecondary: '#E5EEF4',
          roadCasing: '#B7C7D2',
          label: '#132E3E',
          labelMuted: '#607382',
          poi: '#2F7D73',
          boundary: '#B0C3CC',
          googleBrightnessMin: 0.08,
          googleBrightnessMax: 1,
          googleContrast: 0.08,
          googleSaturation: -0.18,
          googleHueRotate: 10,
        };
}

function isLegacyKorviMapTheme(theme: Partial<KorviStoredMapTheme> | undefined, dark: boolean): boolean {
  if (!theme) return false;
  const legacy = dark
    ? { background: '#0D1B24', roadPrimary: '#4FA3A0', roadSecondary: '#53778A', water: '#123F51' }
    : { background: '#EEF7F6', roadPrimary: '#A7DCD7', roadSecondary: '#D5E7EF', water: '#B9E7EF' };
  return Object.entries(legacy).every(([key, value]) => theme[key as keyof KorviStoredMapTheme] === value);
}

function setPaint(map: Map, layerId: string, property: string, value: unknown): void {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Some provider styles expose layers with restricted or incompatible paint keys.
  }
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
  map.setStyle(googleMapsPendingStyle());
  try {
    const mapType = googleMapsMapType(mode);
    const session = await googleMapsTileSession(mapType);
    map.setStyle(googleMapsRasterStyle(session.session, mapType));
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
    language: currentKorviLanguage(),
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
    'accept-language': currentKorviLanguage(),
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

function currentKorviLanguage(): 'es' | 'en' {
  const stored = localStorage.getItem(languageStorageKey);
  if (stored === 'en' || stored === 'es') return stored;

  const deviceLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const preferredLanguage = deviceLanguages.find((language) => /^en|^es/i.test(language));
  return preferredLanguage?.toLowerCase().startsWith('en') ? 'en' : 'es';
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

async function googleMapsTileSession(mapType: string): Promise<GoogleMapsTileSession> {
  const cacheKey = mapType;
  const cached = googleMapsTileSessions.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached;

  const token = localStorage.getItem('ruta_segura_token');
  const response = await fetch(`${API_URL}/reports/maps/google/tile-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ruta-Platform': 'web',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ mapType }),
  });
  if (!response.ok) throw new Error('Google Maps Tile API session failed');

  const payload = await response.json() as { session?: string; expiry?: string };
  if (!payload.session) throw new Error('Google Maps Tile API session missing');

  const expiry = Number(payload.expiry);
  const session = {
    session: payload.session,
    expiresAt: Number.isFinite(expiry) ? expiry * 1000 : Date.now() + 13 * 24 * 60 * 60 * 1000,
  };
  googleMapsTileSessions.set(cacheKey, session);
  return session;
}

function googleMapsRasterStyle(session: string, mapType: string): KorviMapStyle {
  const attribution = '&copy; Google';
  const theme = currentKorviMapTheme();
  const rasterPaint =
    mapType === 'satellite'
      ? {
          'raster-brightness-min': Math.max(0, theme.googleBrightnessMin - 0.04),
          'raster-brightness-max': Math.min(1, theme.googleBrightnessMax - 0.08),
          'raster-contrast': Math.max(-1, theme.googleContrast - 0.02),
          'raster-saturation': Math.max(-1, theme.googleSaturation + 0.12),
          'raster-hue-rotate': theme.googleHueRotate - 8,
        }
      : {
          'raster-brightness-min': theme.googleBrightnessMin,
          'raster-brightness-max': theme.googleBrightnessMax,
          'raster-contrast': theme.googleContrast,
          'raster-saturation': theme.googleSaturation,
          'raster-hue-rotate': theme.googleHueRotate,
        };

  return {
    version: 8,
    sources: {
      google: {
        type: 'raster',
        tiles: [
          `${API_URL}/reports/maps/google/tiles/{z}/{x}/{y}?session=${encodeURIComponent(session)}`,
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
        paint: rasterPaint,
      },
    ],
  } as KorviMapStyle;
}

function googleMapsRasterStyleFromCachedSession(mode: KorviMapMode): KorviMapStyle | null {
  const mapType = googleMapsMapType(mode);
  const cached = googleMapsTileSessions.get(mapType);
  if (!cached || cached.expiresAt <= Date.now() + 60000) return null;
  return googleMapsRasterStyle(cached.session, mapType);
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
