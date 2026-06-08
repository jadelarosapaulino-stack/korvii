export type ReportStatusKey = 'PENDING' | 'VALIDATED' | 'DUPLICATE' | 'REJECTED' | 'IN_PROGRESS' | 'RESOLVED';

export interface StatusStyle {
  label: string;
  tone: 'warning' | 'secondary' | 'primary' | 'primary-dark' | 'success' | 'muted';
}

export const REPORT_STATUS_STYLES: Record<ReportStatusKey, StatusStyle> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  VALIDATED: { label: 'Validado', tone: 'secondary' },
  DUPLICATE: { label: 'Duplicado', tone: 'muted' },
  REJECTED: { label: 'Rechazado', tone: 'muted' },
  IN_PROGRESS: { label: 'En intervención', tone: 'primary-dark' },
  RESOLVED: { label: 'Resuelto', tone: 'success' },
};

export function reportStatusStyle(status: string): StatusStyle {
  return REPORT_STATUS_STYLES[status as ReportStatusKey] ?? { label: status, tone: 'muted' };
}
