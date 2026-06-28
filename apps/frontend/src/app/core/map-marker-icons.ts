import { ReportCategory } from './reports.service';
import { buildEnv } from './build-env';

type KorviMarkerKind =
  | 'low'
  | 'medium'
  | 'high'
  | 'report'
  | 'location'
  | 'traffic-light'
  | 'user-location'
  | 'route-origin'
  | 'route-destination';

type KorviMarkerOptions = {
  kind: KorviMarkerKind;
  icon: string;
  title?: string;
  selected?: boolean;
  draggable?: boolean;
  small?: boolean;
};

const GEOAPIFY_ICON_API_URL = 'https://api.geoapify.com/v1/icon/';

export const KORVI_MARKER_OFFSET: [number, number] = [0, -6];

export const KORVI_MARKER_COLORS: Record<KorviMarkerKind, string> = {
  low: '#3B8A8A',
  medium: '#B9852C',
  high: '#A84D4F',
  report: '#A84D4F',
  location: '#A84D4F',
  'traffic-light': '#B9852C',
  'user-location': '#1677FF',
  'route-origin': '#3B8A8A',
  'route-destination': '#2F7D73',
};

export function createKorviMapMarkerElement(options: KorviMarkerOptions): HTMLElement {
  const marker = document.createElement('span');
  marker.className = [
    'korvi-map-pin',
    'has-geoapify-icon',
    options.kind,
    options.selected ? 'is-selected' : '',
    options.small ? 'is-small' : '',
  ].filter(Boolean).join(' ');
  marker.style.setProperty('--pin-color', KORVI_MARKER_COLORS[options.kind]);
  if (options.title) marker.title = options.title;
  if (options.draggable) marker.draggable = true;

  const fallbackIcon = document.createElement('span');
  fallbackIcon.className = 'material-icons';
  fallbackIcon.setAttribute('aria-hidden', 'true');
  fallbackIcon.textContent = options.icon;

  const iconUrl = geoapifyMarkerIconUrl(options.kind, options.icon);
  if (iconUrl) {
    const img = document.createElement('img');
    img.className = 'korvi-map-pin-image';
    img.src = iconUrl;
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => marker.classList.add('icon-failed'), { once: true });
    marker.append(img, fallbackIcon);
  } else {
    marker.classList.add('icon-failed');
    marker.append(fallbackIcon);
  }
  return marker;
}

export function reportRiskMarkerKind(riskLevel: number): KorviMarkerKind {
  if (riskLevel >= 4) return 'high';
  if (riskLevel === 3) return 'medium';
  return 'low';
}

export function reportCategoryIcon(category: ReportCategory | string | null | undefined): string {
  const icons: Record<ReportCategory, string> = {
    ACCIDENT: 'car_crash',
    TRAFFIC_LIGHT_DAMAGED: 'traffic',
    ROAD_DAMAGE: 'construction',
    ROAD_OBSTRUCTION: 'do_not_disturb_on',
    POOR_LIGHTING: 'lightbulb',
    MISSING_SIGNAGE: 'signpost',
    RECKLESS_DRIVING: 'speed',
    DANGEROUS_CROSSING: 'directions_walk',
    FLOOD_ZONE: 'water_drop',
    POLICE_ON_ROAD: 'local_police',
    OTHER: 'warning',
  };
  return icons[category as ReportCategory] ?? 'warning';
}

function geoapifyMarkerIconUrl(kind: KorviMarkerKind, icon: string): string {
  const apiKey = buildEnv.geoapifyKey.trim();
  if (!apiKey) return '';

  const params = new URLSearchParams({
    type: kind === 'user-location' ? 'circle' : 'awesome',
    color: KORVI_MARKER_COLORS[kind],
    icon,
    iconType: 'material',
    size: kind === 'user-location' ? 'x-large' : 'large',
    scaleFactor: '2',
    apiKey,
  });

  return `${GEOAPIFY_ICON_API_URL}?${params.toString()}`;
}
