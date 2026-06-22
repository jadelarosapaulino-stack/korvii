import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { Map as MapTilerMap, Popup, type GeoJSONSource, type MapLayerMouseEvent } from '@maptiler/sdk';
import Chart from 'chart.js/auto';
import { AnalyticsService, AnalyticsSummary } from '../../core/analytics.service';
import { I18nService } from '../../core/i18n.service';
import { applyKorviMapTheme, createKorviMap, mapReady, observeMapResize, scheduleMapResize, toggleKorviMapMode } from '../../core/map.config';
import { ReportMapPoint, ReportsService, reportCategoryLabel } from '../../core/reports.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
  template: `
    <section class="executive-dashboard">
      <header class="dashboard-header">
        <div>
          <span class="rs-eyebrow">Panel ejecutivo</span>
          <h1>KORVI Insight</h1>
          <p>Vista ejecutiva para priorizar riesgos, medir carga operativa y sustentar decisiones comerciales y operativas.</p>
        </div>
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
      </header>

      <section class="kpi-row">
        <mat-card class="metric-card">
          <span class="metric-icon"><mat-icon>insights</mat-icon></span>
          <div>
            <span>Total reportes</span>
            <strong>{{ summary()?.total ?? reports().length }}</strong>
          </div>
          <small>Base ciudadana activa</small>
        </mat-card>

        <mat-card class="metric-card accent-warning">
          <span class="metric-icon"><mat-icon>pending_actions</mat-icon></span>
          <div>
            <span>Pendientes</span>
            <strong>{{ summary()?.pending ?? countByStatus('PENDING') }}</strong>
          </div>
          <small>Requieren verificación</small>
        </mat-card>

        <mat-card class="metric-card accent-primary">
          <span class="metric-icon"><mat-icon>route</mat-icon></span>
          <div>
            <span>En intervención</span>
            <strong>{{ summary()?.inProgress ?? countByStatus('IN_PROGRESS') }}</strong>
          </div>
          <small>Gestión operativa</small>
        </mat-card>

        <mat-card class="metric-card accent-danger">
          <span class="metric-icon"><mat-icon>monitoring</mat-icon></span>
          <div>
            <span>Riesgo promedio</span>
            <strong>{{ averageRisk() }}/5</strong>
          </div>
          <small>Índice territorial</small>
        </mat-card>
      </section>

      <section class="main-grid">
        <mat-card class="heat-card">
          <div class="card-heading">
            <div>
              <span>Mapa de calor</span>
              <strong>Concentración de reportes</strong>
            </div>
            <mat-chip>{{ highRiskCount() }} alto riesgo</mat-chip>
          </div>

          <div class="heat-map">
            <div #heatMapContainer class="heat-maptiler" aria-label="Mapa real de calor de reportes"></div>
            <div class="korvi-map-controls" aria-label="Controles de zoom del mapa">
              <button
                mat-icon-button
                type="button"
                [class.active]="heatHybridMode()"
                [title]="heatHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                [attr.aria-label]="heatHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                (click)="toggleHeatHybridMode()">
                <mat-icon>{{ heatHybridMode() ? 'map' : 'satellite' }}</mat-icon>
              </button>
              <button mat-icon-button type="button" title="Acercar mapa" aria-label="Acercar mapa" (click)="zoomHeatIn()">
                <mat-icon>add</mat-icon>
              </button>
              <button mat-icon-button type="button" title="Alejar mapa" aria-label="Alejar mapa" (click)="zoomHeatOut()">
                <mat-icon>remove</mat-icon>
              </button>
            </div>
          </div>

          <div class="heat-legend">
            <span><i class="low"></i>Bajo</span>
            <span><i class="medium"></i>Medio</span>
            <span><i class="high"></i>Alto</span>
          </div>
        </mat-card>

        <mat-card class="insight-card">
          <div class="card-heading">
            <div>
              <span>Prioridad comercial</span>
              <strong>Lectura ejecutiva</strong>
            </div>
          </div>

          <div class="insight-list">
            <article>
              <mat-icon>shield</mat-icon>
              <div>
                <strong>Exposición territorial</strong>
                <span>{{ highRiskCount() }} puntos de alto riesgo impactan prevencion, cobertura y priorizacion.</span>
              </div>
            </article>
            <article>
              <mat-icon>engineering</mat-icon>
              <div>
                <strong>Gestión institucional</strong>
                <span>{{ openWorkload() }} reportes abiertos requieren validación, intervención o cierre.</span>
              </div>
            </article>
            <article>
              <mat-icon>trending_up</mat-icon>
              <div>
                <strong>Señal de demanda</strong>
                <span>{{ topProvinceLabel() }} concentra la mayor actividad reportada.</span>
              </div>
            </article>
          </div>
        </mat-card>
      </section>

      <section class="chart-grid">
        <mat-card class="chart-card">
          <div class="card-heading">
            <div>
              <span>Distribución visual</span>
              <strong>Reportes por categoría</strong>
            </div>
          </div>
          <div class="chart-frame">
            <canvas #categoryChartCanvas aria-label="Gráfico de reportes por categoría"></canvas>
          </div>
        </mat-card>

        <mat-card class="chart-card">
          <div class="card-heading">
            <div>
              <span>Estado operativo</span>
              <strong>Flujo de atención</strong>
            </div>
          </div>
          <div class="chart-frame">
            <canvas #statusChartCanvas aria-label="Gráfico de reportes por estado"></canvas>
          </div>
        </mat-card>
      </section>

      <section class="lower-grid">
        <mat-card class="ranking-card">
          <div class="card-heading">
            <div>
              <span>Categorías</span>
              <strong>Mix de incidentes</strong>
            </div>
          </div>
          <div class="bars">
            @for (item of categoryRows(); track item.label) {
              <div class="bar-row">
                <span>{{ item.label }}</span>
                <div class="bar-track"><i [style.width.%]="item.percent"></i></div>
                <strong>{{ item.count }}</strong>
              </div>
            }
          </div>
        </mat-card>

        <mat-card class="ranking-card">
          <div class="card-heading">
            <div>
              <span>Territorio</span>
              <strong>Top provincias</strong>
            </div>
          </div>
          <div class="bars">
            @for (item of provinceRows(); track item.label) {
              <div class="bar-row">
                <span>{{ item.label }}</span>
                <div class="bar-track territory"><i [style.width.%]="item.percent"></i></div>
                <strong>{{ item.count }}</strong>
              </div>
            }
          </div>
        </mat-card>
      </section>
    </section>
  `,
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heatMapContainer', { static: true }) private readonly heatMapContainer?: ElementRef<HTMLElement>;
  @ViewChild('categoryChartCanvas') private readonly categoryChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChartCanvas') private readonly statusChartCanvas?: ElementRef<HTMLCanvasElement>;

  summary = signal<AnalyticsSummary | null>(null);
  reports = signal<ReportMapPoint[]>([]);

  highRiskCount = computed(() => this.reports().filter((report) => report.riskLevel >= 4).length);
  openWorkload = computed(() => this.reports().filter((report) => !['RESOLVED', 'REJECTED', 'DUPLICATE'].includes(report.status)).length);
  averageRisk = computed(() => {
    const summaryRisk = this.summary()?.averageRisk;
    if (summaryRisk) return summaryRisk;
    const reports = this.reports();
    if (!reports.length) return 0;
    return Number((reports.reduce((total, report) => total + report.riskLevel, 0) / reports.length).toFixed(2));
  });

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly reportsService: ReportsService,
    private readonly i18n: I18nService,
  ) {
    effect(() => {
      this.i18n.language();
      this.renderCharts();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    this.initHeatMap();
    this.renderHeatMap();
    this.renderCharts();
    window.addEventListener('rs-theme-change', this.themeChangeHandler);
    window.addEventListener('rs-map-config-change', this.themeChangeHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('rs-theme-change', this.themeChangeHandler);
    window.removeEventListener('rs-map-config-change', this.themeChangeHandler);
    this.heatResizeObserver?.disconnect();
    this.heatMap?.remove();
    this.categoryChart?.destroy();
    this.statusChart?.destroy();
  }

  load() {
    this.analytics.summary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.renderCharts();
      },
      error: () => {
        this.summary.set(null);
        this.renderCharts();
      },
    });
    this.reportsService.mapPoints({ limit: 100 }).subscribe({
      next: (data) => {
        this.reports.set(data);
        this.renderHeatMap();
        this.renderCharts();
      },
      error: () => {
        this.reports.set([]);
        this.renderHeatMap();
        this.renderCharts();
      },
    });
  }

  countByStatus(status: string): number {
    return this.reports().filter((report) => report.status === status).length;
  }

  topProvinceLabel(): string {
    return this.t(this.provinceRows()[0]?.label ?? 'Sin actividad territorial');
  }

  categoryRows() {
    const rows = this.summary()?.byCategory?.map((item) => ({ label: reportCategoryLabel(item.category), count: Number(item.count) })) ?? this.groupReports('category');
    return this.withPercent(rows).slice(0, 6).map((row) => ({ ...row, label: this.t(row.label) }));
  }

  provinceRows() {
    const rows = this.summary()?.byProvince?.map((item) => ({ label: item.province, count: Number(item.count) })) ?? this.groupReports('province');
    return this.withPercent(rows).slice(0, 6).map((row) => ({ ...row, label: this.t(row.label) }));
  }

  toX(longitude: number): number {
    const bounds = this.bounds();
    if (bounds.maxLongitude === bounds.minLongitude) return 50;
    return Math.min(92, Math.max(8, ((Number(longitude) - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude)) * 100));
  }

  toY(latitude: number): number {
    const bounds = this.bounds();
    if (bounds.maxLatitude === bounds.minLatitude) return 50;
    return 100 - Math.min(92, Math.max(8, ((Number(latitude) - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude)) * 100));
  }

  private groupReports(key: 'category' | 'province') {
    const counts = new Map<string, number>();
    this.reports().forEach((report) => {
      const label = key === 'category' ? reportCategoryLabel(report.category) : report.province || 'Sin provincia';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }

  private withPercent(rows: Array<{ label: string; count: number }>) {
    const max = Math.max(...rows.map((row) => row.count), 1);
    return rows.map((row) => ({ ...row, percent: Math.max(8, (row.count / max) * 100) }));
  }

  private bounds() {
    const reports = this.reports();
    if (!reports.length) {
      return { minLatitude: 18.35, maxLatitude: 18.6, minLongitude: -70.05, maxLongitude: -69.75 };
    }

    const latitudes = reports.map((report) => Number(report.latitude));
    const longitudes = reports.map((report) => Number(report.longitude));
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.18, 0.01);
    const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.18, 0.01);

    return {
      minLatitude: minLatitude - latitudePadding,
      maxLatitude: maxLatitude + latitudePadding,
      minLongitude: minLongitude - longitudePadding,
      maxLongitude: maxLongitude + longitudePadding,
    };
  }

  private heatMap?: MapTilerMap;
  heatHybridMode = signal(false);
  private readonly heatSourceId = 'ruta-segura-dashboard-heat';
  private readonly heatLayerId = 'ruta-segura-dashboard-heat-circles';
  private heatClickBound = false;
  private heatResizeObserver?: ResizeObserver;
  private categoryChart?: Chart;
  private statusChart?: Chart;
  private readonly themeChangeHandler = () => this.applyMapTheme();

  private readonly chartColors = ['#66B7B0', '#9CB8D8', '#F0B981', '#A8D8A5', '#D8B7E8', '#F2A6A0', '#8CC7E8'];

  private applyMapTheme() {
    if (!this.heatMap) return;
    this.heatClickBound = false;
    applyKorviMapTheme(this.heatMap, () => {
      this.renderHeatMap();
      this.resizeHeatMap();
    });
  }

  toggleHeatHybridMode() {
    if (!this.heatMap) return;
    this.heatClickBound = false;
    const mode = toggleKorviMapMode(this.heatMap, () => {
      this.renderHeatMap();
      this.resizeHeatMap();
    });
    this.heatHybridMode.set(mode === 'hybrid');
  }

  zoomHeatIn() {
    this.heatMap?.zoomIn();
  }

  zoomHeatOut() {
    this.heatMap?.zoomOut();
  }

  private initHeatMap() {
    if (!this.heatMapContainer?.nativeElement || this.heatMap) return;

    this.heatMap = createKorviMap(this.heatMapContainer.nativeElement, {
      center: { latitude: 18.4861, longitude: -69.9312 },
      zoom: 12,
      navigationControl: false,
      scrollZoom: false,
    });

    this.heatResizeObserver = observeMapResize(this.heatMap, this.heatMapContainer.nativeElement);
  }

  private renderHeatMap() {
    if (!this.heatMap) return;
    this.resizeHeatMap();

    const reports = this.reports();

    if (!reports.length) {
      this.resizeHeatMapNow();
      this.heatMap.easeTo({ center: [-69.9312, 18.4861], zoom: 12, bearing: 0, pitch: 0, duration: 450, essential: true });
      this.refreshHeatMapAfterCameraMove();
      return;
    }

    mapReady(this.heatMap, () => {
      this.resizeHeatMapNow();
      const data = {
        type: 'FeatureCollection' as const,
        features: reports.map((report) => ({
          type: 'Feature' as const,
          properties: {
            id: report.id,
            title: report.title,
            riskLevel: report.riskLevel,
            color: report.riskLevel >= 4 ? '#E58F8A' : report.riskLevel === 3 ? '#F0B981' : '#66B7B0',
            radius: 14 + report.riskLevel * 6,
            opacity: report.riskLevel >= 4 ? 0.34 : 0.22,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [Number(report.longitude), Number(report.latitude)],
          },
        })),
      };

      const existingSource = this.heatMap?.getSource(this.heatSourceId) as GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(data);
      } else {
        this.heatMap?.addSource(this.heatSourceId, { type: 'geojson', data });
        this.heatMap?.addLayer({
          id: this.heatLayerId,
          type: 'circle',
          source: this.heatSourceId,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['get', 'radius'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.8,
          },
        });
      }

      if (!this.heatClickBound) {
        this.heatMap?.on('click', this.heatLayerId, (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const coordinates = (feature.geometry as { coordinates?: [number, number] }).coordinates;
          if (!coordinates) return;
          this.resizeHeatMapNow();
          new Popup({ offset: 14 })
            .setLngLat(coordinates)
            .setHTML(`<strong>${this.escapeHtml(this.t(String(feature.properties?.['title'] ?? 'Reporte')))}</strong><br>${this.escapeHtml(this.t('Riesgo'))} ${String(feature.properties?.['riskLevel'] ?? '-')}/5`)
            .addTo(this.heatMap as MapTilerMap);
          this.refreshHeatMapAfterCameraMove();
        });
        this.heatMap?.on('mouseenter', this.heatLayerId, () => {
          if (this.heatMap) this.heatMap.getCanvas().style.cursor = 'pointer';
        });
        this.heatMap?.on('mouseleave', this.heatLayerId, () => {
          if (this.heatMap) this.heatMap.getCanvas().style.cursor = '';
        });
        this.heatClickBound = true;
      }

      this.fitHeatBounds(reports);
    });
  }

  private fitHeatBounds(reports: ReportMapPoint[]) {
    if (!this.heatMap || !reports.length) return;

    const longitudes = reports.map((report) => Number(report.longitude));
    const latitudes = reports.map((report) => Number(report.latitude));
    this.resizeHeatMapNow();
    this.heatMap.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 32, maxZoom: 15, duration: 500 },
    );
    this.refreshHeatMapAfterCameraMove();
  }

  private resizeHeatMap() {
    if (!this.heatMap || !this.heatMapContainer?.nativeElement) return;
    scheduleMapResize(this.heatMap, this.heatMapContainer.nativeElement);
  }

  private resizeHeatMapNow() {
    if (!this.heatMap || !this.heatMapContainer?.nativeElement) return;
    const container = this.heatMapContainer.nativeElement;
    if (!container.offsetWidth || !container.offsetHeight) return;
    this.heatMap.resize();
  }

  private refreshHeatMapAfterCameraMove() {
    if (!this.heatMap) return;

    const refresh = () => {
      this.resizeHeatMapNow();
      (this.heatMap as (MapTilerMap & { triggerRepaint?: () => void }) | undefined)?.triggerRepaint?.();
    };

    this.heatMap.once('moveend', refresh);
    this.heatMap.once('idle', refresh);
    window.setTimeout(refresh, 120);
    window.setTimeout(refresh, 420);
    window.setTimeout(refresh, 900);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[char] ?? char);
  }

  private renderCharts() {
    this.renderCategoryChart();
    this.renderStatusChart();
  }

  private renderCategoryChart() {
    const canvas = this.categoryChartCanvas?.nativeElement;
    if (!canvas) return;

    const rows = this.categoryRows();
    const chartRows = rows.length ? rows : [{ label: this.t('Sin reportes'), count: 1, percent: 100 }];
    const colors = rows.length ? this.chartColors : ['#D8E4E8'];

    this.categoryChart?.destroy();
    this.categoryChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chartRows.map((row) => row.label),
        datasets: [{
          data: chartRows.map((row) => row.count),
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 4,
          hoverOffset: 8,
          spacing: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            position: 'right',
            align: 'center',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: '#526678',
              font: { weight: 700 },
              padding: 14,
              usePointStyle: true,
            },
          },
          tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed} ${this.t('reportes')}` } },
        },
      },
    });
  }

  private renderStatusChart() {
    const canvas = this.statusChartCanvas?.nativeElement;
    if (!canvas) return;

    const rows = this.statusRows();
    const chartRows = rows.some((row) => row.count > 0) ? rows : [{ label: this.t('Sin reportes'), count: 0, color: '#D8E4E8' }];

    this.statusChart?.destroy();
    this.statusChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chartRows.map((row) => row.label),
        datasets: [{
          label: this.t('Reportes'),
          data: chartRows.map((row) => row.count),
          backgroundColor: chartRows.map((row) => row.color),
          borderRadius: 8,
          maxBarThickness: 42,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 850,
          easing: 'easeOutCubic',
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#526678', font: { weight: 750 } },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            ticks: { precision: 0, color: '#7B8997' },
            grid: { color: 'rgba(123, 137, 151, .14)' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (context) => `${context.parsed.y} ${this.t('reportes')}` } },
        },
      },
    });
  }

  private statusRows() {
    const summary = this.summary();
    return [
      { label: 'Pendientes', count: summary?.pending ?? this.countByStatus('PENDING'), color: '#F0B981' },
      { label: 'Validados', count: summary?.validated ?? this.countByStatus('VALIDATED'), color: '#66B7B0' },
      { label: 'En proceso', count: summary?.inProgress ?? this.countByStatus('IN_PROGRESS'), color: '#9CB8D8' },
      { label: 'Resueltos', count: summary?.resolved ?? this.countByStatus('RESOLVED'), color: '#A8D8A5' },
      { label: 'Descartados', count: this.countByStatus('REJECTED') + this.countByStatus('DUPLICATE'), color: '#E58F8A' },
    ].map((row) => ({ ...row, label: this.t(row.label) }));
  }

  private t(value: string): string {
    return this.i18n.translate(value);
  }
}

