export const REALTIME_REPORTS_CHANNEL = "reports.events";

export type RealtimeEventType =
  | "report.created"
  | "report.updated"
  | "report.status_changed"
  | "report.assigned"
  | "report.metrics_changed"
  | "weather.flood_zone_created";

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  occurredAt: string;
  reportId?: string;
  status?: string;
  category?: string;
  riskLevel?: number;
  province?: string | null;
  municipality?: string | null;
  assignedToId?: string | null;
  institutionId?: string | null;
  rooms?: string[];
  data?: Record<string, unknown>;
}

export interface RealtimeJwtPayload {
  sub?: string;
  id?: string;
  role?: string;
  institutionId?: string;
  institution?: { id?: string };
}
