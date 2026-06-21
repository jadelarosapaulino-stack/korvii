import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Map as MapTilerMap, Marker } from '@maptiler/sdk';
import Chart from 'chart.js/auto';
import { ToastrService } from 'ngx-toastr';
import { auditTime, merge, Subscription } from 'rxjs';
import { createKorviMap, observeMapResize, scheduleMapResize, toLngLat, toggleKorviMapMode } from '../../core/map.config';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { ReportAdminMetrics, ReportCategory, ReportItem, ReportStatus, ReportsService, reportCategoryIcon, reportCategoryLabel, reportSourceLabel } from '../../core/reports.service';
import { RiskChipComponent } from '../../shared/ui/risk-chip/risk-chip.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule, MatSelectModule, RiskChipComponent, StatusChipComponent],
  template: `
    <section class="admin-page">
      <header class="admin-header">
        <div>
          <span class="rs-eyebrow">Bandeja institucional</span>
          <h1>Revision y gestion de reportes</h1>
          <p>Priorizacion operativa para validar evidencia, activar intervencion y cerrar incidentes con trazabilidad.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/admin">
            <mat-icon>arrow_back</mat-icon>
            Volver al panel
          </a>
          <button mat-stroked-button type="button" (click)="load()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
        </div>
      </header>

      <section class="metrics-chart-layout">
        <mat-card class="status-chart-card">
          <div class="chart-heading">
            <div>
              <span>Estado operativo</span>
              <strong>Reportes por etapa</strong>
            </div>
            <mat-chip>{{ totalReportCount() }} reportes</mat-chip>
          </div>
          <div class="chart-frame">
            <canvas #statusChartCanvas aria-label="Grafico de reportes por estado"></canvas>
          </div>
        </mat-card>

        <mat-card class="status-summary-card">
          <article>
            <span>Pendientes</span>
            <strong>{{ pendingCount() }}</strong>
            <small>Por verificar</small>
          </article>
          <article>
            <span>Validados</span>
            <strong>{{ validatedCount() }}</strong>
            <small>Listos para accion</small>
          </article>
          <article>
            <span>Intervencion</span>
            <strong>{{ inProgressCount() }}</strong>
            <small>En curso</small>
          </article>
          <article>
            <span>Resueltos</span>
            <strong>{{ resolvedCount() }}</strong>
            <small>Cerrados</small>
          </article>
        </mat-card>
      </section>

      <mat-card class="filter-card">
        <div class="filter-heading">
          <div>
            <strong>Filtros de revision</strong>
            <span>Filtra por estado, tipo, fuente, territorio, riesgo y fecha.</span>
          </div>
          <button mat-stroked-button type="button" (click)="clearFilters()" [disabled]="!filtersActive()">
            <mat-icon>filter_alt_off</mat-icon>
            Limpiar
          </button>
        </div>

        <div class="filter-grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Buscar</mat-label>
            <input matInput [ngModel]="searchFilter()" (ngModelChange)="searchFilter.set($event)" placeholder="Titulo, descripcion o direccion" />
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Estado</mat-label>
            <mat-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
              <mat-option value="ALL">Todos</mat-option>
              @for (status of statusOptions; track status.value) {
                <mat-option [value]="status.value">{{ status.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tipo</mat-label>
            <mat-select [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)">
              <mat-option value="ALL">Todos</mat-option>
              @for (category of categoryOptions; track category) {
                <mat-option [value]="category">
                  <mat-icon>{{ categoryIcon(category) }}</mat-icon>
                  {{ categoryLabel(category) }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Fuente</mat-label>
            <mat-select [ngModel]="sourceFilter()" (ngModelChange)="sourceFilter.set($event)">
              <mat-option value="ALL">Todas</mat-option>
              @for (source of sourceOptions; track source.value) {
                <mat-option [value]="source.value">{{ source.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Provincia</mat-label>
            <input matInput [ngModel]="provinceFilter()" (ngModelChange)="provinceFilter.set($event)" />
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Municipio</mat-label>
            <input matInput [ngModel]="municipalityFilter()" (ngModelChange)="municipalityFilter.set($event)" />
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Riesgo minimo</mat-label>
            <mat-select [ngModel]="minRiskFilter()" (ngModelChange)="minRiskFilter.set($event)">
              <mat-option value="ALL">Todos</mat-option>
              @for (risk of riskOptions; track risk) {
                <mat-option [value]="risk">{{ risk }}/5 o mayor</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-range-field">
            <mat-label>Rango de fecha</mat-label>
            <mat-date-range-input [rangePicker]="adminReportRangePicker">
              <input matStartDate [ngModel]="reportDateStart()" (ngModelChange)="reportDateStart.set($event)" placeholder="Desde" />
              <input matEndDate [ngModel]="reportDateEnd()" (ngModelChange)="reportDateEnd.set($event)" placeholder="Hasta" />
            </mat-date-range-input>
            <mat-datepicker-toggle matIconSuffix [for]="adminReportRangePicker"></mat-datepicker-toggle>
            <mat-date-range-picker #adminReportRangePicker></mat-date-range-picker>
          </mat-form-field>

          <button mat-flat-button color="primary" type="button" (click)="applyFilters()">
            <mat-icon>filter_alt</mat-icon>
            Aplicar filtros
          </button>
        </div>
      </mat-card>

      <section class="review-list">
        @for (report of reports(); track report.id) {
          <mat-card class="review-card" [class.high-risk]="report.riskLevel >= 4">
            <div class="status-rail"></div>

            <div class="report-content">
              <div class="report-topline">
                <mat-chip>{{ categoryLabel(report.category) }}</mat-chip>
                <mat-chip>{{ sourceLabel(report.source) }}</mat-chip>
                <app-risk-chip [level]="report.riskLevel" />
                <app-status-chip [status]="report.status" />
              </div>

              <h2>{{ report.title }}</h2>
              <p>{{ report.description }}</p>

              <div class="meta-line">
                <span><mat-icon>location_on</mat-icon>{{ report.province || 'Sin provincia' }} - {{ report.municipality || 'Sin municipio' }}</span>
                <span>{{ report.latitude }}, {{ report.longitude }}</span>
                <span><mat-icon>assignment_ind</mat-icon>{{ report.assignedTo?.fullName || 'Sin asignar' }}</span>
                <span><mat-icon>apartment</mat-icon>{{ report.assignedInstitution?.name || 'Sin institucion' }}</span>
              </div>

              @if (report.history?.length) {
                <div class="timeline">
                  @for (item of report.history?.slice(0, 3); track item.id) {
                    <span>{{ item.toStatus }} · {{ item.changedBy?.fullName || 'Sistema' }}</span>
                  }
                </div>
              }

              @if (report.aiAnalysisStatus) {
                <section class="ai-insight" [class.pending]="report.aiAnalysisStatus === 'pending'" [class.failed]="report.aiAnalysisStatus === 'failed'">
                  <div class="ai-heading">
                    <span><mat-icon>auto_awesome</mat-icon> IA operativa</span>
                    <strong>{{ aiStatusLabel(report) }}</strong>
                  </div>
                  @if (report.aiAnalysisStatus === 'completed') {
                    <p>{{ report.aiSummary }}</p>
                    <div class="ai-tags">
                      <span>{{ categoryLabel(report.aiSuggestedCategory || report.category) }}</span>
                      <span>Riesgo {{ report.aiRiskScore || report.riskLevel }}/5</span>
                      <span>{{ aiPriorityLabel(report.aiPriority) }}</span>
                      <span>{{ report.aiSuggestedInstitution || 'Autoridad competente' }}</span>
                    </div>
                  } @else if (report.aiAnalysisStatus === 'failed') {
                    <p>No se pudo completar el analisis IA.</p>
                  } @else {
                    <p>Analisis en proceso.</p>
                  }
                </section>
              }
            </div>

            <div class="workflow" aria-label="Progreso del reporte">
              <span class="stage done"><i></i>Recepcion</span>
              <span class="stage" [class.done]="report.status !== 'PENDING'"><i></i>Validacion</span>
              <span class="stage" [class.done]="report.status === 'IN_PROGRESS' || report.status === 'RESOLVED'"><i></i>Intervencion</span>
              <span class="stage" [class.done]="report.status === 'RESOLVED'"><i></i>Cierre</span>
            </div>

            <div class="actions">
              <button mat-icon-button class="map-button" type="button" aria-label="Ver reporte en mapa" (click)="openReportMap(report)">
                <mat-icon>map</mat-icon>
              </button>
              <button mat-icon-button class="options-button" type="button" [matMenuTriggerFor]="reportActions" aria-label="Opciones del reporte">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #reportActions="matMenu" xPosition="before" panelClass="report-actions-menu">
                <button mat-menu-item class="report-action-item" type="button" (click)="change(report, 'VALIDATED')">
                  <mat-icon>verified</mat-icon>
                  <span>Validar</span>
                </button>
                <button mat-menu-item class="report-action-item" type="button" (click)="assignToMe(report)">
                  <mat-icon>assignment_ind</mat-icon>
                  <span>Asignarme</span>
                </button>
                <button mat-menu-item class="report-action-item" type="button" (click)="change(report, 'IN_PROGRESS')">
                  <mat-icon>engineering</mat-icon>
                  <span>Intervenir</span>
                </button>
                <button mat-menu-item class="report-action-item" type="button" (click)="change(report, 'RESOLVED')">
                  <mat-icon>task_alt</mat-icon>
                  <span>Cerrar</span>
                </button>
                <button mat-menu-item type="button" class="report-action-item danger-menu-item" (click)="change(report, 'REJECTED')">
                  <mat-icon>block</mat-icon>
                  <span>Rechazar</span>
                </button>
              </mat-menu>
            </div>
          </mat-card>
        } @empty {
          <mat-card class="empty-state">
            <mat-icon>inventory_2</mat-icon>
            <strong>No hay reportes para gestionar</strong>
            <span>Cuando existan reportes ciudadanos apareceran en esta bandeja.</span>
          </mat-card>
        }
      </section>

      <mat-paginator
        [length]="totalReportCount()"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 20, 50]"
        showFirstLastButtons
        (page)="onPage($event)">
      </mat-paginator>

      @if (selectedReport(); as report) {
        <div class="report-map-modal-backdrop" (click)="closeReportMap()">
          <section class="report-map-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Reporte en mapa">
            <header>
              <div>
                <span>Ubicacion del reporte</span>
                <strong>{{ report.title }}</strong>
              </div>
              <button mat-icon-button type="button" aria-label="Cerrar mapa del reporte" (click)="closeReportMap()">
                <mat-icon>close</mat-icon>
              </button>
            </header>

            <div #reportMapContainer class="report-modal-map" aria-label="Mapa con ubicacion del reporte"></div>
            <div class="korvi-map-controls" aria-label="Controles de zoom del mapa">
              <button
                mat-icon-button
                type="button"
                [class.active]="reportMapHybridMode()"
                [title]="reportMapHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                [attr.aria-label]="reportMapHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                (click)="toggleReportMapHybridMode()">
                <mat-icon>{{ reportMapHybridMode() ? 'map' : 'satellite' }}</mat-icon>
              </button>
              <button mat-icon-button type="button" title="Acercar mapa" aria-label="Acercar mapa" (click)="zoomReportMapIn()">
                <mat-icon>add</mat-icon>
              </button>
              <button mat-icon-button type="button" title="Alejar mapa" aria-label="Alejar mapa" (click)="zoomReportMapOut()">
                <mat-icon>remove</mat-icon>
              </button>
            </div>

            <footer>
              <div class="report-modal-details">
                <div>
                  <span>Tipo</span>
                  <strong>{{ categoryLabel(report.category) }}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <app-status-chip [status]="report.status" />
                </div>
                <div>
                  <span>Riesgo</span>
                  <strong>{{ report.riskLevel }}/5</strong>
                </div>
                <div>
                  <span>Ubicacion</span>
                  <strong>{{ report.province || 'Sin provincia' }} - {{ report.municipality || 'Sin municipio' }}</strong>
                </div>
              </div>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./admin-reports.component.css'],
})
export class AdminReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('statusChartCanvas') private readonly statusChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('reportMapContainer') private readonly reportMapContainer?: ElementRef<HTMLElement>;

  reports = signal<ReportItem[]>([]);
  metrics = signal<ReportAdminMetrics | null>(null);
  selectedReport = signal<ReportItem | null>(null);
  reportMapHybridMode = signal(false);
  totalReportCount = signal(0);
  pageIndex = signal(0);
  pageSize = signal(10);
  searchFilter = signal('');
  statusFilter = signal<ReportStatus | 'ALL'>('ALL');
  categoryFilter = signal<ReportCategory | 'ALL'>('ALL');
  sourceFilter = signal<'web' | 'mobile' | 'system' | 'ALL'>('ALL');
  provinceFilter = signal('');
  municipalityFilter = signal('');
  minRiskFilter = signal<number | 'ALL'>('ALL');
  reportDateStart = signal<Date | null>(null);
  reportDateEnd = signal<Date | null>(null);
  pendingCount = computed(() => this.metrics()?.pending ?? 0);
  validatedCount = computed(() => this.metrics()?.validated ?? 0);
  inProgressCount = computed(() => this.metrics()?.inProgress ?? 0);
  resolvedCount = computed(() => this.metrics()?.resolved ?? 0);
  filtersActive = computed(() => Boolean(
    this.searchFilter().trim() ||
    this.statusFilter() !== 'ALL' ||
    this.categoryFilter() !== 'ALL' ||
    this.sourceFilter() !== 'ALL' ||
    this.provinceFilter().trim() ||
    this.municipalityFilter().trim() ||
    this.minRiskFilter() !== 'ALL' ||
    this.reportDateStart() ||
    this.reportDateEnd(),
  ));
  readonly statusOptions: Array<{ value: ReportStatus; label: string }> = [
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'VALIDATED', label: 'Validado' },
    { value: 'IN_PROGRESS', label: 'En intervencion' },
    { value: 'RESOLVED', label: 'Resuelto' },
    { value: 'REJECTED', label: 'Rechazado' },
    { value: 'DUPLICATE', label: 'Duplicado' },
  ];
  readonly categoryOptions: ReportCategory[] = [
    'ACCIDENT',
    'TRAFFIC_LIGHT_DAMAGED',
    'ROAD_DAMAGE',
    'ROAD_OBSTRUCTION',
    'POOR_LIGHTING',
    'MISSING_SIGNAGE',
    'RECKLESS_DRIVING',
    'DANGEROUS_CROSSING',
    'FLOOD_ZONE',
    'POLICE_ON_ROAD',
    'OTHER',
  ];
  readonly sourceOptions: Array<{ value: 'web' | 'mobile' | 'system'; label: string }> = [
    { value: 'web', label: 'Web' },
    { value: 'mobile', label: 'App movil' },
    { value: 'system', label: 'Sistema' },
  ];
  readonly riskOptions = [1, 2, 3, 4, 5];
  private statusChart?: Chart;
  private reportMap?: MapTilerMap;
  private reportMapMarker?: Marker;
  private reportMapResizeObserver?: ResizeObserver;
  private realtimeSubscription?: Subscription;
  private readonly themeChangeHandler = () => this.renderStatusChart();

  constructor(
    private readonly reportsService: ReportsService,
    private readonly realtime: RealtimeService,
    private readonly toastr: ToastrService,
    private readonly i18n: I18nService,
  ) {
    effect(() => {
      this.i18n.language();
      this.renderStatusChart();
    });
  }

  categoryLabel(category: string): string {
    return reportCategoryLabel(category);
  }

  sourceLabel(source: string | null | undefined): string {
    return reportSourceLabel(source);
  }

  categoryIcon(category: string): string {
    return reportCategoryIcon(category);
  }

  aiStatusLabel(report: ReportItem): string {
    if (report.aiAnalysisStatus === 'completed') {
      const confidence = report.aiConfidence === null || report.aiConfidence === undefined ? null : Math.round(Number(report.aiConfidence) * 100);
      return confidence === null ? 'Analizado' : `${confidence}% confianza`;
    }
    if (report.aiAnalysisStatus === 'failed') return 'Fallido';
    return 'Pendiente';
  }

  aiPriorityLabel(priority: string | null | undefined): string {
    const labels: Record<string, string> = {
      low: 'Prioridad baja',
      medium: 'Prioridad media',
      high: 'Prioridad alta',
      critical: 'Prioridad critica',
    };
    return labels[priority ?? ''] ?? 'Prioridad media';
  }

  ngOnInit(): void {
    this.load();
    this.subscribeToRealtime();
    window.addEventListener('rs-theme-change', this.themeChangeHandler);
  }

  ngAfterViewInit(): void {
    this.renderStatusChart();
  }

  ngOnDestroy(): void {
    window.removeEventListener('rs-theme-change', this.themeChangeHandler);
    this.realtimeSubscription?.unsubscribe();
    this.statusChart?.destroy();
    this.destroyReportMap();
  }

  private subscribeToRealtime() {
    this.realtimeSubscription = merge(
      this.realtime.on('report.created'),
      this.realtime.on('report.updated'),
      this.realtime.on('report.status_changed'),
      this.realtime.on('report.assigned'),
      this.realtime.on('report.metrics_changed'),
      this.realtime.on('weather.flood_zone_created'),
      this.realtime.on('traffic_light.report_created'),
    )
      .pipe(auditTime(500))
      .subscribe(() => this.load());
  }

  load() {
    const filters = this.currentReportFilters();
    this.reportsService.list({
      ...filters,
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
    }).subscribe({
      next: (page) => {
        this.reports.set(page.data);
        this.totalReportCount.set(page.total);
      },
      error: () => {
        this.reports.set([]);
        this.totalReportCount.set(0);
      },
    });

    this.reportsService.adminMetrics(filters).subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
        this.totalReportCount.set(metrics.total);
        this.renderStatusChart();
      },
      error: () => {
        this.metrics.set(null);
        this.renderStatusChart();
      },
    });
  }

  private currentReportFilters(): Record<string, string | number | undefined> {
    return {
      q: this.searchFilter().trim() || undefined,
      status: this.statusFilter() === 'ALL' ? undefined : this.statusFilter(),
      category: this.categoryFilter() === 'ALL' ? undefined : this.categoryFilter(),
      source: this.sourceFilter() === 'ALL' ? undefined : this.sourceFilter(),
      province: this.provinceFilter().trim() || undefined,
      municipality: this.municipalityFilter().trim() || undefined,
      minRisk: this.minRiskFilter() === 'ALL' ? undefined : this.minRiskFilter(),
      from: this.dateStartToIso(this.reportDateStart()),
      to: this.dateEndToIso(this.reportDateEnd()),
    };
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.load();
  }

  clearFilters() {
    this.searchFilter.set('');
    this.statusFilter.set('ALL');
    this.categoryFilter.set('ALL');
    this.sourceFilter.set('ALL');
    this.provinceFilter.set('');
    this.municipalityFilter.set('');
    this.minRiskFilter.set('ALL');
    this.reportDateStart.set(null);
    this.reportDateEnd.set(null);
    this.pageIndex.set(0);
    this.load();
  }

  openReportMap(report: ReportItem): void {
    this.selectedReport.set(report);
    window.setTimeout(() => this.renderSelectedReportMap(), 0);
  }

  closeReportMap(): void {
    this.selectedReport.set(null);
    this.destroyReportMap();
  }

  change(report: ReportItem, status: ReportStatus) {
    this.reportsService.updateStatus(report.id, status, `Cambio de estado a ${status} desde panel MVP.`).subscribe({
      next: () => {
        this.toastr.success(this.statusMessage(status), 'Reporte actualizado');
        this.load();
      },
      error: (error) => {
        const message = error?.status === 403
          ? 'Tu usuario no tiene permisos para cambiar estados. Usa una cuenta institucional o admin.'
          : 'No se pudo actualizar el estado del reporte.';
        this.toastr.error(message, 'Operacion fallida');
      },
    });
  }

  assignToMe(report: ReportItem) {
    this.reportsService.assignToMe(report.id, 'Asignado desde bandeja institucional.').subscribe({
      next: () => {
        this.toastr.success('El reporte fue asignado y paso a intervencion.', 'Reporte asignado');
        this.load();
      },
      error: () => {
        this.toastr.error('No se pudo asignar el reporte.', 'Operacion fallida');
      },
    });
  }

  private statusMessage(status: ReportStatus): string {
    const messages: Record<ReportStatus, string> = {
      PENDING: 'El reporte volvio a estado pendiente.',
      VALIDATED: 'El reporte fue validado.',
      DUPLICATE: 'El reporte fue marcado como duplicado.',
      IN_PROGRESS: 'El reporte paso a intervencion.',
      RESOLVED: 'El reporte fue aprobado y cerrado.',
      REJECTED: 'El reporte fue rechazado.',
    };
    return messages[status];
  }

  private dateStartToIso(value: Date | null): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private dateEndToIso(value: Date | null): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private renderSelectedReportMap(): void {
    const report = this.selectedReport();
    const container = this.reportMapContainer?.nativeElement;
    if (!report || !container) return;

    this.destroyReportMap();

    const center = { latitude: Number(report.latitude), longitude: Number(report.longitude) };
    this.reportMap = createKorviMap(container, {
      center,
      zoom: 16,
      navigationControl: false,
      scrollZoom: true,
    });

    this.reportMapMarker = new Marker({ element: this.createReportMapPin(report), anchor: 'bottom' })
      .setLngLat(toLngLat(center))
      .addTo(this.reportMap);

    this.reportMapResizeObserver = observeMapResize(this.reportMap, container);
    scheduleMapResize(this.reportMap, container);
  }

  toggleReportMapHybridMode(): void {
    if (!this.reportMap) return;
    const mode = toggleKorviMapMode(this.reportMap, () => {
      if (this.reportMap && this.reportMapContainer?.nativeElement) {
        scheduleMapResize(this.reportMap, this.reportMapContainer.nativeElement);
      }
    });
    this.reportMapHybridMode.set(mode === 'hybrid');
  }

  zoomReportMapIn(): void {
    this.reportMap?.zoomIn();
  }

  zoomReportMapOut(): void {
    this.reportMap?.zoomOut();
  }

  private destroyReportMap(): void {
    this.reportMapResizeObserver?.disconnect();
    this.reportMapResizeObserver = undefined;
    this.reportMapMarker?.remove();
    this.reportMapMarker = undefined;
    this.reportMap?.remove();
    this.reportMap = undefined;
    this.reportMapHybridMode.set(false);
  }

  private createReportMapPin(report: ReportItem): HTMLElement {
    const marker = document.createElement('span');
    marker.className = 'korvi-map-pin report';

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = this.categoryIcon(report.category);

    marker.appendChild(icon);
    return marker;
  }

  private renderStatusChart() {
    const canvas = this.statusChartCanvas?.nativeElement;
    if (!canvas) return;

    const styles = getComputedStyle(document.body);
    const textColor = styles.getPropertyValue('--rs-text').trim() || '#1D3345';
    const mutedColor = styles.getPropertyValue('--rs-text-muted').trim() || '#6B7785';
    const borderColor = styles.getPropertyValue('--rs-border').trim() || '#DDE4EA';
    const colors = [
      styles.getPropertyValue('--rs-warning').trim() || '#B9852C',
      styles.getPropertyValue('--rs-secondary').trim() || '#3B8A8A',
      styles.getPropertyValue('--rs-primary').trim() || '#2F7D73',
      styles.getPropertyValue('--rs-success').trim() || '#4F8F64',
    ];

    this.statusChart?.destroy();
    this.statusChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Pendientes', 'Validados', 'Intervencion', 'Resueltos'].map((label) => this.t(label)),
        datasets: [
          {
            label: this.t('Reportes'),
            data: [this.pendingCount(), this.validatedCount(), this.inProgressCount(), this.resolvedCount()],
            backgroundColor: colors,
            borderColor: colors,
            borderRadius: 8,
            maxBarThickness: 54,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.parsed.y} ${this.t('reporte(s)')}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { weight: 800 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: mutedColor, font: { weight: 700 } },
            grid: { color: borderColor },
          },
        },
      },
    });
  }

  private t(value: string): string {
    return this.i18n.translate(value);
  }
}

