export interface RiskStyle {
  label: string;
  tone: 'low' | 'medium' | 'high' | 'critical';
}

export function riskLevelStyle(level: number): RiskStyle {
  if (level >= 5) return { label: 'Riesgo crítico', tone: 'critical' };
  if (level >= 4) return { label: 'Riesgo alto', tone: 'high' };
  if (level >= 3) return { label: 'Riesgo medio', tone: 'medium' };
  return { label: 'Riesgo bajo', tone: 'low' };
}
