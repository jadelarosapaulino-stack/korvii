import { Component, OnInit, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { AnalyticsService, IntelligenceRow, IntelligenceSummary } from '../../core/analytics.service';
import { reportCategoryLabel } from '../../core/reports.service';
import { GreenLightInsight, GreenLightInsightsSummary, TrafficLightsService } from '../../core/traffic-lights.service';

@Component({
  selector: 'app-intelligence',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
  template: `
    <section class="intelligence-page">
      <header class="intel-header">
        <div>
          <span class="rs-eyebrow">Producto premium</span>
          <h1>KORVI AI</h1>
          <p>Inteligencia de riesgo vial para aseguradoras, gobierno y empresas con flotillas.</p>
        </div>
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
      </header>

      <section class="hero-band">
        <div>
          <span>Scoring territorial</span>
          <strong>{{ data()?.kpis?.exposureScore ?? 0 }}/100</strong>
          <p>Indice de exposicion combinado por volumen de reportes, severidad, inundaciones y carga abierta.</p>
        </div>
        <div>
          <span>Indice de prevencion</span>
          <strong>{{ data()?.kpis?.preventionIndex ?? 0 }}/100</strong>
          <p>Lectura ejecutiva para medir mitigacion, cierres y prioridad de accion.</p>
        </div>
      </section>

      <section class="kpi-grid">
        <mat-card>
          <mat-icon>stacked_bar_chart</mat-icon>
          <span>Total reportes</span>
          <strong>{{ data()?.kpis?.totalReports ?? 0 }}</strong>
        </mat-card>
        <mat-card>
          <mat-icon>warning</mat-icon>
          <span>Alto riesgo</span>
          <strong>{{ data()?.kpis?.highRiskReports ?? 0 }}</strong>
        </mat-card>
        <mat-card>
          <mat-icon>flood</mat-icon>
          <span>Zonas inundables</span>
          <strong>{{ data()?.kpis?.floodZones ?? 0 }}</strong>
        </mat-card>
        <mat-card>
          <mat-icon>pending_actions</mat-icon>
          <span>Carga abierta</span>
          <strong>{{ data()?.kpis?.openReports ?? 0 }}</strong>
        </mat-card>
      </section>

      <section class="green-light-panel">
        <div class="section-heading green-heading">
          <div>
            <span>Semaforos inteligentes</span>
            <strong>Green Light operativo</strong>
          </div>
          <button mat-stroked-button type="button" (click)="loadGreenLight()">
            <mat-icon>traffic</mat-icon>
            Recalcular
          </button>
        </div>

        <div class="green-kpis">
          <article>
            <span>Semaforos analizados</span>
            <strong>{{ greenLight()?.kpis?.analyzedTrafficLights ?? 0 }}</strong>
          </article>
          <article>
            <span>Criticos</span>
            <strong>{{ greenLight()?.kpis?.critical ?? 0 }}</strong>
          </article>
          <article>
            <span>Prioridad alta</span>
            <strong>{{ greenLight()?.kpis?.high ?? 0 }}</strong>
          </article>
          <article>
            <span>Reportes vinculados</span>
            <strong>{{ greenLight()?.kpis?.affectedReports ?? 0 }}</strong>
          </article>
        </div>

        <div class="green-list">
          @for (item of greenLightRows(); track item.trafficLight.id) {
            <article class="green-row" [class.critical]="item.priority === 'critical'" [class.high]="item.priority === 'high'">
              <div class="green-score">
                <strong>{{ item.score }}</strong>
                <span>{{ priorityLabel(item.priority) }}</span>
              </div>
              <div class="green-content">
                <div class="green-title">
                  <strong>{{ trafficLightTitle(item) }}</strong>
                  <mat-chip>{{ trafficStatusLabel(item.trafficLight.status) }}</mat-chip>
                </div>
                <small class="traffic-light-id">{{ item.trafficLight.name }}</small>
                <p>{{ item.recommendation }}</p>
                <div class="green-meta">
                  <span><mat-icon>location_on</mat-icon>{{ item.trafficLight.province || 'Sin provincia' }} - {{ item.trafficLight.municipality || 'Sin municipio' }}</span>
                  <span><mat-icon>report</mat-icon>{{ item.nearbyReports }} reportes</span>
                  <span><mat-icon>warning</mat-icon>{{ item.highRiskReports }} alto riesgo</span>
                  <span><mat-icon>car_crash</mat-icon>{{ item.accidents }} accidentes</span>
                  <span><mat-icon>traffic</mat-icon>{{ item.damagedSignalReports }} semaforo danado</span>
                </div>
                <div class="reason-line">
                  @for (reason of item.reasons.slice(0, 4); track reason) {
                    <span>{{ reason }}</span>
                  }
                </div>
              </div>
            </article>
          } @empty {
            <article class="green-empty">
              <mat-icon>traffic</mat-icon>
              <strong>Sin intersecciones criticas</strong>
              <span>No hay senales recientes alrededor de semaforos registrados.</span>
            </article>
          }
        </div>
      </section>

      <section class="content-grid">
        <mat-card class="ranking-panel">
          <div class="section-heading">
            <span>Territorio</span>
            <strong>Tendencias por municipio</strong>
          </div>
          @for (row of municipalityRows(); track row.label) {
            <article class="risk-row">
              <div>
                <strong>{{ row.label }}</strong>
                <span>{{ row.count }} reportes · riesgo {{ row.averageRisk }}/5 · {{ row.highRiskCount }} alto riesgo</span>
              </div>
              <meter min="0" max="100" [value]="row.score"></meter>
              <b>{{ row.score }}</b>
            </article>
          }
        </mat-card>

        <mat-card class="ranking-panel">
          <div class="section-heading">
            <span>Categorias</span>
            <strong>Mix de riesgo</strong>
          </div>
          @for (row of categoryRows(); track row.label) {
            <article class="risk-row">
              <div>
                <strong>{{ categoryLabel(row.label) }}</strong>
                <span>{{ row.count }} eventos · promedio {{ row.averageRisk }}/5</span>
              </div>
              <meter min="0" max="100" [value]="row.score"></meter>
              <b>{{ row.score }}</b>
            </article>
          }
        </mat-card>
      </section>

      <section class="content-grid">
        <mat-card class="signal-panel">
          <div class="section-heading">
            <span>Prevencion</span>
            <strong>Senales ejecutivas</strong>
          </div>
          @for (signal of data()?.preventionSignals ?? []; track signal) {
            <article>
              <mat-icon>campaign</mat-icon>
              <span>{{ signal }}</span>
            </article>
          }
        </mat-card>

        <mat-card class="api-panel">
          <div class="section-heading">
            <span>Integracion</span>
            <strong>API Intelligence</strong>
          </div>
          <p>Endpoint premium para alimentar data lakes, modelos de pricing, sistemas municipales y plataformas de flotillas.</p>
          <code>GET /analytics/intelligence</code>
          <div class="chip-line">
            <mat-chip>Bearer token</mat-chip>
            <mat-chip>JSON</mat-chip>
            <mat-chip>Scoring</mat-chip>
            <mat-chip>Tendencias</mat-chip>
          </div>
        </mat-card>
      </section>

      <mat-card class="documentation-panel">
        <div class="section-heading">
          <span>Documentacion</span>
          <strong>Contrato API Intelligence</strong>
        </div>

        <div class="doc-grid">
          <article>
            <span>Endpoint</span>
            <code>GET /api/analytics/intelligence</code>
          </article>
          <article>
            <span>Autenticacion</span>
            <code>Authorization: Bearer &lt;token&gt;</code>
          </article>
          <article>
            <span>Roles</span>
            <p>MODERATOR, INSTITUTION_ADMIN, INSURANCE_ADMIN, SUPER_ADMIN.</p>
          </article>
          <article>
            <span>Formato</span>
            <p>JSON con KPIs, tendencias, scoring territorial y senales preventivas.</p>
          </article>
        </div>

        <div class="doc-section">
          <h2>KPIs principales</h2>
          <div class="field-list">
            <span><strong>totalReports</strong> Total de reportes registrados.</span>
            <span><strong>highRiskReports</strong> Reportes con riesgo 4 o 5.</span>
            <span><strong>floodZones</strong> Zonas de posible inundacion.</span>
            <span><strong>openReports</strong> Reportes pendientes, validados o en intervencion.</span>
            <span><strong>exposureScore</strong> Score 0-100 de exposicion territorial.</span>
            <span><strong>preventionIndex</strong> Score 0-100 de mitigacion y respuesta.</span>
          </div>
        </div>

        <div class="doc-section">
          <h2>Tendencias incluidas</h2>
          <div class="field-list">
            <span><strong>byProvince</strong> Ranking por provincia.</span>
            <span><strong>byMunicipality</strong> Ranking por municipio.</span>
            <span><strong>byCategory</strong> Mix de riesgo por categoria.</span>
            <span><strong>byRoadType</strong> Clasificacion por autopista, puente, tunel, avenida o calle.</span>
            <span><strong>byHour</strong> Distribucion por hora del dia.</span>
          </div>
        </div>

        <pre><code>{{ responseExample }}</code></pre>
      </mat-card>
    </section>
  `,
  styleUrls: ['./intelligence.component.css'],
})
export class IntelligenceComponent implements OnInit {
  data = signal<IntelligenceSummary | null>(null);
  greenLight = signal<GreenLightInsightsSummary | null>(null);
  municipalityRows = computed(() => this.data()?.trends.byMunicipality ?? []);
  categoryRows = computed(() => this.data()?.trends.byCategory ?? []);
  greenLightRows = computed<GreenLightInsight[]>(() => this.greenLight()?.insights ?? []);
  readonly responseExample = `{
  "product": "KORVI AI",
  "generatedAt": "2026-05-21T01:20:00.000Z",
  "kpis": {
    "totalReports": 120,
    "highRiskReports": 34,
    "exposureScore": 87,
    "preventionIndex": 33
  },
  "trends": {
    "byMunicipality": [],
    "byCategory": [],
    "byHour": []
  },
  "preventionSignals": []
}`;

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly trafficLights: TrafficLightsService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.analytics.intelligence().subscribe({
      next: (data) => this.data.set(data),
      error: () => this.data.set(null),
    });
    this.loadGreenLight();
  }

  loadGreenLight() {
    this.trafficLights.greenLightInsights({ radiusMeters: 300, limit: 12 }).subscribe({
      next: (data) => this.greenLight.set(data),
      error: () => this.greenLight.set(null),
    });
  }

  categoryLabel(category: string): string {
    return reportCategoryLabel(category);
  }

  priorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      critical: 'Critico',
      high: 'Alto',
      medium: 'Medio',
      low: 'Bajo',
    };
    return labels[priority] ?? priority;
  }

  trafficStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Activo',
      unknown: 'Sin verificar',
      offline: 'Apagado',
    };
    return labels[status] ?? status;
  }

  trafficLightTitle(item: GreenLightInsight): string {
    const trafficLight = item.trafficLight;
    const intersection = trafficLight.intersection?.trim();
    if (intersection) return intersection;

    const location = [trafficLight.province, trafficLight.municipality].filter(Boolean).join(' - ');
    if (location) return location;

    return `${trafficLight.latitude.toFixed(6)}, ${trafficLight.longitude.toFixed(6)}`;
  }
}
