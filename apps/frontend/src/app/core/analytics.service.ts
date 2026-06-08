import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from './api.config';

export interface AnalyticsSummary {
  total: number;
  pending: number;
  validated: number;
  inProgress: number;
  resolved: number;
  averageRisk: number;
  byCategory: Array<{ category: string; count: string }>;
  byProvince: Array<{ province: string; count: string }>;
}

export interface IntelligenceRow {
  label: string;
  count: number;
  averageRisk: number;
  highRiskCount: number;
  score: number;
}

export interface IntelligenceSummary {
  product: string;
  generatedAt: string;
  kpis: {
    totalReports: number;
    highRiskReports: number;
    floodZones: number;
    openReports: number;
    resolvedReports: number;
    exposureScore: number;
    preventionIndex: number;
  };
  trends: {
    byProvince: IntelligenceRow[];
    byMunicipality: IntelligenceRow[];
    byCategory: IntelligenceRow[];
    byRoadType: IntelligenceRow[];
    byHour: Array<{ hour: number; count: number; averageRisk: number }>;
  };
  preventionSignals: string[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private readonly http: HttpClient) {}

  summary() {
    return this.http.get<AnalyticsSummary>(`${API_URL}/analytics/summary`);
  }

  intelligence() {
    return this.http.get<IntelligenceSummary>(`${API_URL}/analytics/intelligence`);
  }
}
