import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from './api.config';

export type ReportStatus = 'PENDING' | 'VALIDATED' | 'DUPLICATE' | 'REJECTED' | 'IN_PROGRESS' | 'RESOLVED';
export type ReportSource = 'web' | 'mobile' | 'system';
export type ReportCategory =
  | 'ACCIDENT'
  | 'TRAFFIC_LIGHT_DAMAGED'
  | 'ROAD_DAMAGE'
  | 'ROAD_OBSTRUCTION'
  | 'POOR_LIGHTING'
  | 'MISSING_SIGNAGE'
  | 'RECKLESS_DRIVING'
  | 'DANGEROUS_CROSSING'
  | 'FLOOD_ZONE'
  | 'OTHER';

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  ACCIDENT: 'Accidente',
  TRAFFIC_LIGHT_DAMAGED: 'Semáforo dañado',
  ROAD_DAMAGE: 'Vía en mal estado',
  ROAD_OBSTRUCTION: 'Obstrucción en la vía',
  POOR_LIGHTING: 'Falta de iluminación',
  MISSING_SIGNAGE: 'Falta de señalización',
  RECKLESS_DRIVING: 'Conducción imprudente',
  DANGEROUS_CROSSING: 'Cruce peligroso',
  FLOOD_ZONE: 'Zona de posible inundacion',
  OTHER: 'Otro riesgo',
};

export const REPORT_CATEGORY_ICONS: Record<ReportCategory, string> = {
  ACCIDENT: 'car_crash',
  TRAFFIC_LIGHT_DAMAGED: 'traffic',
  ROAD_DAMAGE: 'construction',
  ROAD_OBSTRUCTION: 'deployed_code_alert',
  POOR_LIGHTING: 'lightbulb',
  MISSING_SIGNAGE: 'signpost',
  RECKLESS_DRIVING: 'speed',
  DANGEROUS_CROSSING: 'directions_walk',
  FLOOD_ZONE: 'flood',
  OTHER: 'warning',
};

export function reportCategoryLabel(category: string | null | undefined): string {
  return REPORT_CATEGORY_LABELS[category as ReportCategory] ?? category ?? 'Sin categoría';
}

export function reportCategoryIcon(category: string | null | undefined): string {
  return REPORT_CATEGORY_ICONS[category as ReportCategory] ?? REPORT_CATEGORY_ICONS.OTHER;
}

export function reportSourceLabel(source: string | null | undefined): string {
  if (source === 'mobile') return 'App movil';
  if (source === 'system') return 'Sistema';
  return 'Web';
}

export interface ReportItem {
  id: string;
  title: string;
  category: ReportCategory;
  description: string;
  latitude: number;
  longitude: number;
  province?: string;
  municipality?: string;
  address?: string;
  riskLevel: number;
  confirmationCount?: number;
  confirmers?: ReportConfirmer[];
  assignedTo?: {
    id: string;
    fullName: string;
    role?: string;
  } | null;
  assignedInstitution?: {
    id: string;
    name: string;
    type?: string;
    province?: string;
    municipality?: string;
  } | null;
  assignmentNote?: string | null;
  assignedAt?: string | null;
  history?: ReportHistoryItem[];
  aiAnalysisStatus?: 'pending' | 'completed' | 'failed' | null;
  aiSummary?: string | null;
  aiSuggestedCategory?: ReportCategory | string | null;
  aiRiskScore?: number | null;
  aiPriority?: 'low' | 'medium' | 'high' | 'critical' | string | null;
  aiSuggestedInstitution?: string | null;
  aiConfidence?: number | null;
  aiRationale?: string | null;
  aiAnalysisError?: string | null;
  aiProcessedAt?: string | null;
  source?: ReportSource;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportConfirmer {
  id: string;
  fullName: string;
  source?: ReportSource | string;
  createdAt?: string;
  originalReporter?: boolean;
}

export interface ReportHistoryItem {
  id: string;
  fromStatus?: ReportStatus | null;
  toStatus: ReportStatus;
  comment?: string | null;
  changedBy?: { id: string; fullName: string } | null;
  createdAt: string;
}

export interface InstitutionOption {
  id: string;
  name: string;
  type: string;
  province?: string;
  municipality?: string;
  coverageArea?: string;
}

export interface ReportMapPoint extends ReportItem {
  photoUrls?: string[];
}

export interface ReportPage {
  data: ReportItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportAdminMetrics {
  total: number;
  pending: number;
  validated: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  duplicate: number;
  stages: Array<{ status: ReportStatus; label: string; count: number }>;
}

export interface CreateReportResult {
  report: ReportItem;
  reused: boolean;
  confirmationAdded: boolean;
}

export interface EmergencyCallLogPayload {
  category?: ReportCategory;
  title?: string;
  latitude?: number | null;
  longitude?: number | null;
  province?: string | null;
  municipality?: string | null;
  address?: string | null;
  phoneNumber?: string;
  source?: string;
}

export interface WeatherStatus {
  enabled: boolean;
  provider?: 'google-forecast' | 'open-meteo';
  locationName?: string;
  province?: string;
  weatherText?: string;
  temperatureCelsius?: number;
  weatherCode?: number;
  weatherIcon?: string;
  isDayTime?: boolean;
  hasPrecipitation?: boolean;
  precipitationType?: string;
  relativeHumidity?: number;
  rainLastHoursMm?: number;
  floodRisk: boolean;
  reason: string;
}

export interface WeatherFloodScanResult {
  source: 'manual' | 'scheduled' | 'startup';
  skipped: boolean;
  reason?: string;
  total: number;
  activated: number;
  reused: number;
  inactive: number;
  failed: number;
  results: Array<{
    name: string;
    latitude: number;
    longitude: number;
    activated: boolean;
    reused?: boolean;
    reason?: string;
    error?: string;
  }>;
}

export interface OptimizedRiskRoute {
  provider: 'google-routes' | 'openrouteservice' | 'osrm';
  summary: {
    distance: number;
    duration: number;
    distanceKm: number;
    durationMinutes: number;
  };
  geometry: {
    type: 'LineString';
    coordinates: Array<[number, number]>;
  };
  risk: {
    floodZones: number;
    highRiskReports: number;
    total: number;
    unsafe: boolean;
  };
  alternativesEvaluated: number;
  via?: { latitude: number; longitude: number } | null;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private readonly http: HttpClient) {}

  list(filters: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ReportPage>(`${API_URL}/reports`, { params });
  }

  adminMetrics(filters: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ReportAdminMetrics>(`${API_URL}/reports/admin/metrics`, { params });
  }

  create(payload: Record<string, unknown> | FormData) {
    return this.http.post<CreateReportResult>(`${API_URL}/reports`, payload);
  }

  mapPoints(filters: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ReportMapPoint[]>(`${API_URL}/reports/map`, { params });
  }

  updateStatus(id: string, toStatus: ReportStatus, comment: string) {
    return this.http.patch<ReportItem>(`${API_URL}/reports/${id}/status`, { toStatus, comment });
  }

  assignToMe(id: string, note?: string) {
    return this.http.patch<ReportItem>(`${API_URL}/reports/${id}/assignment`, { note });
  }

  logEmergencyCall(payload: EmergencyCallLogPayload) {
    return this.http.post(`${API_URL}/reports/emergency-call-logs`, payload);
  }

  activateWeatherFloodZones(latitude: number, longitude: number) {
    return this.http.post<{ activated: boolean }>(`${API_URL}/reports/weather/flood-zones/activate`, { latitude, longitude });
  }

  weatherStatus(latitude: number, longitude: number) {
    return this.http.post<WeatherStatus>(`${API_URL}/reports/weather/status`, { latitude, longitude });
  }

  scanWeatherFloodZones() {
    return this.http.post<WeatherFloodScanResult>(`${API_URL}/reports/weather/flood-zones/scan`, {});
  }

  optimizeRiskRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    options: {
      provider?: string;
      endpoint?: string;
      openRouteServiceApiKey?: string;
      googleMapsApiKey?: string;
    } = {},
  ) {
    return this.http.post<OptimizedRiskRoute>(`${API_URL}/reports/routes/optimize-risk`, { origin, destination, ...options });
  }

  institutions(filters: Record<string, string | undefined> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, value);
    });
    return this.http.get<InstitutionOption[]>(`${API_URL}/institutions`, { params });
  }
}
