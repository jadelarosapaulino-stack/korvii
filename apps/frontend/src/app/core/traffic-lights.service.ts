import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from './api.config';

export type TrafficLightStatus = 'active' | 'unknown' | 'offline';
export type TrafficLightSource = 'osm' | 'manual' | 'institutional';

export interface TrafficLightItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  province?: string | null;
  municipality?: string | null;
  intersection?: string | null;
  osmId?: string | null;
  status: TrafficLightStatus;
  source: TrafficLightSource;
  lastObservedAt?: string | null;
  locationDetailsRefreshedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrafficLightsSettings {
  overpassEndpoint: string;
  defaultSouth: number;
  defaultWest: number;
  defaultNorth: number;
  defaultEast: number;
  defaultProvince: string;
  defaultMunicipality: string;
  importProvinces: string[];
  automaticReportsEnabled: boolean;
  automaticReportTtlHours: number;
  automaticReportRadiusMeters: number;
  automaticReportMonitorIntervalMinutes: number;
}

export interface TrafficLightsPage {
  data: TrafficLightItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportTrafficLightsPayload {
  south?: number;
  west?: number;
  north?: number;
  east?: number;
  province?: string;
  provinces?: string[];
  municipality?: string;
  replaceExisting?: boolean;
}

export interface RefreshLocationDetailsProgress {
  scanned: number;
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface RefreshLocationDetailsJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  source: 'osm' | 'all';
  limit: number;
  skipRecentlyUpdatedHours: number;
  progress: RefreshLocationDetailsProgress;
  error?: string;
}

export interface RefreshLocationDetailsStartResponse {
  accepted: boolean;
  job: RefreshLocationDetailsJob;
}

export interface GreenLightInsight {
  trafficLight: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    province?: string | null;
    municipality?: string | null;
    intersection?: string | null;
    status: string;
  };
  score: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  nearbyReports: number;
  highRiskReports: number;
  accidents: number;
  damagedSignalReports: number;
  averageRisk: number;
  openReports: number;
  lastReportAt?: string | null;
  recommendation: string;
  reasons: string[];
}

export interface GreenLightInsightsSummary {
  generatedAt: string;
  radiusMeters: number;
  windowDays: number;
  kpis: {
    analyzedTrafficLights: number;
    rankedTrafficLights: number;
    critical: number;
    high: number;
    affectedReports: number;
  };
  insights: GreenLightInsight[];
}

@Injectable({ providedIn: 'root' })
export class TrafficLightsService {
  constructor(private readonly http: HttpClient) {}

  list(filters: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<TrafficLightsPage>(`${API_URL}/traffic-lights`, { params });
  }

  settings() {
    return this.http.get<TrafficLightsSettings>(`${API_URL}/traffic-lights/settings`);
  }

  updateSettings(patch: Partial<TrafficLightsSettings>) {
    return this.http.patch<TrafficLightsSettings>(`${API_URL}/traffic-lights/settings`, patch);
  }

  importFromOpenStreetMap(payload: ImportTrafficLightsPayload) {
    return this.http.post<{ imported: number; created: number; updated: number }>(`${API_URL}/traffic-lights/import/osm`, payload);
  }

  refreshLocationDetails(payload: { source?: 'osm' | 'all'; limit?: number; skipRecentlyUpdatedHours?: number } = {}) {
    return this.http.post<RefreshLocationDetailsStartResponse>(
      `${API_URL}/traffic-lights/refresh-location-details`,
      payload,
    );
  }

  refreshLocationDetailsStatus() {
    return this.http.get<RefreshLocationDetailsJob | null>(`${API_URL}/traffic-lights/refresh-location-details/status`);
  }

  greenLightInsights(filters: { radiusMeters?: number; limit?: number } = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params = params.set(key, String(value));
    });
    return this.http.get<GreenLightInsightsSummary>(`${API_URL}/traffic-lights/green-light-insights`, { params });
  }

  create(payload: Partial<TrafficLightItem>) {
    return this.http.post<TrafficLightItem>(`${API_URL}/traffic-lights`, payload);
  }

  update(id: string, payload: Partial<TrafficLightItem>) {
    return this.http.patch<TrafficLightItem>(`${API_URL}/traffic-lights/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${API_URL}/traffic-lights/${id}`);
  }
}
