import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Map as MapTilerMap, Marker } from '@maptiler/sdk';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { createKorviMap, observeMapResize, scheduleMapResize, toLngLat, toggleKorviMapMode } from '../../core/map.config';
import { ReportCategory, ReportItem, ReportsService, reportCategoryIcon, reportCategoryLabel, reportSourceLabel } from '../../core/reports.service';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatNativeDateModule, MatPaginatorModule, MatSelectModule, MatTooltipModule, StatusChipComponent],
  template: `
    <section class="reports-page">
      <header class="reports-hero">
        <div class="hero-copy">
          <span class="rs-eyebrow">Inventario operacional</span>
          <h1>Reportes georreferenciados</h1>
          <p>Registro consolidado para priorizar riesgos, coordinar instituciones y dar seguimiento territorial.</p>
        </div>
        <div class="hero-actions">
          <a mat-stroked-button routerLink="/mapa">
            <mat-icon>travel_explore</mat-icon>
            Ver mapa
          </a>
          <a mat-flat-button color="primary" routerLink="/reportes/nuevo">
            <mat-icon>add_location_alt</mat-icon>
            Nuevo reporte
          </a>
        </div>
      </header>

      <section class="kpi-strip" aria-label="Resumen de reportes">
        <article>
          <span>Total</span>
          <strong>{{ totalReports() }}</strong>
          <small>incidentes registrados</small>
        </article>
        <article class="danger">
          <span>Riesgo alto</span>
          <strong>{{ highRiskReports() }}</strong>
          <small>requieren prioridad</small>
        </article>
        <article class="warning">
          <span>Pendientes</span>
          <strong>{{ pendingReports() }}</strong>
          <small>por verificar</small>
        </article>
        <article class="success">
          <span>Resueltos</span>
          <strong>{{ resolvedReports() }}</strong>
          <small>cerrados</small>
        </article>
      </section>

      <section class="reports-layout">
        <aside class="summary-panel rs-panel">
          <div class="summary-heading">
            <mat-icon>insights</mat-icon>
            <div>
              <strong>Vista territorial</strong>
              <span>Distribucion de reportes activos</span>
            </div>
          </div>

          <div class="mini-map">
            @for (report of reports(); track report.id) {
              <span class="mini-marker" [style.left.%]="toX(report.longitude)" [style.top.%]="toY(report.latitude)"></span>
            }
          </div>

          <div class="risk-legend" aria-label="Leyenda de nivel de riesgo">
            <strong>Leyenda de riesgo</strong>
            <span><i class="low"></i>Bajo · 1-2</span>
            <span><i class="medium"></i>Medio · 3</span>
            <span><i class="high"></i>Alto · 4</span>
            <span><i class="critical"></i>Crítico · 5</span>
          </div>
        </aside>

        <div class="reports-panel rs-panel">
          <div class="panel-toolbar">
            <div>
              <strong>Bandeja de incidentes</strong>
              <span>{{ reports().length }} visibles en esta pagina</span>
            </div>
            <mat-chip>{{ highRiskReports() }} criticos</mat-chip>
          </div>

          <div class="date-filter-bar" aria-label="Filtro por fecha y hora">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Tipo</mat-label>
              <mat-select [value]="categoryFilter()" (selectionChange)="categoryFilter.set($event.value)">
                <mat-option value="ALL">Todos</mat-option>
                @for (category of categoryOptions; track category) {
                  <mat-option [value]="category">{{ categoryLabel(category) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-range-field">
              <mat-label>Rango de fecha</mat-label>
              <mat-date-range-input [rangePicker]="reportRangePicker">
                <input matStartDate [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" placeholder="Desde" />
                <input matEndDate [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" placeholder="Hasta" />
              </mat-date-range-input>
              <mat-datepicker-toggle matIconSuffix [for]="reportRangePicker"></mat-datepicker-toggle>
              <mat-date-range-picker #reportRangePicker></mat-date-range-picker>
            </mat-form-field>
            <button mat-flat-button color="primary" type="button" (click)="applyDateFilters()">
              <mat-icon>filter_alt</mat-icon>
              Filtrar
            </button>
            <button mat-stroked-button type="button" (click)="clearDateFilters()" [disabled]="!dateFrom() && !dateTo()">
              <mat-icon>filter_alt_off</mat-icon>
              Limpiar
            </button>
          </div>

          <div class="table-head">
            <span>Incidente</span>
            <span>Ubicacion</span>
            <span>Estado</span>
            <span>Riesgo</span>
          </div>

          @for (report of reports(); track report.id) {
            <article class="report-row">
              <div class="incident-cell">
                <div class="category-actions">
                  <span class="category-icon" [class.high-risk]="report.riskLevel >= 4">
                    <mat-icon>{{ categoryIcon(report.category) }}</mat-icon>
                  </span>
                  <button
                    class="map-report-button"
                    mat-icon-button
                    type="button"
                    aria-label="Ver en el mapa"
                    matTooltip="Ver en el mapa"
                    matTooltipPosition="right"
                    (click)="openReportMap(report)">
                    <mat-icon>map</mat-icon>
                  </button>
                </div>
                <div>
                  <div class="incident-title-row">
                    <strong>{{ report.title }}</strong>
                    <span>#{{ report.id.slice(0, 8) }}</span>
                  </div>
                  <p>{{ report.description }}</p>
                  <div class="incident-chips">
                    <mat-chip>{{ categoryLabel(report.category) }}</mat-chip>
                    <mat-chip>{{ sourceLabel(report.source) }}</mat-chip>
                    <mat-chip>{{ report.confirmationCount || 1 }} confirmaciones</mat-chip>
                    @if (report.assignedInstitution) {
                      <mat-chip>{{ report.assignedInstitution.name }}</mat-chip>
                    }
                  </div>
                  <small class="confirmers-line">Confirmado por: {{ confirmersLabel(report) }}</small>
                </div>
              </div>

              <div class="location-cell">
                <strong>{{ report.province || 'Sin provincia' }}</strong>
                <span>{{ report.municipality || 'Sin municipio' }}</span>
                <small>{{ report.latitude }}, {{ report.longitude }}</small>
              </div>

              <div class="status-cell">
                <app-status-chip [status]="report.status" />
              </div>
            <div class="risk-cell">
              <span class="risk-score" [class.high]="report.riskLevel >= 4" [class.medium]="report.riskLevel === 3">
                {{ report.riskLevel }}/5
              </span>
            </div>
            </article>
          } @empty {
            <div class="empty-state">
              <mat-icon>add_location_alt</mat-icon>
              <strong>No hay reportes registrados</strong>
              <span>Crea el primer incidente para iniciar el mapa operativo.</span>
            </div>
          }

          <mat-paginator
            [length]="totalReportCount()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[10, 20, 50]"
            showFirstLastButtons
            (page)="onPage($event)">
          </mat-paginator>
        </div>
      </section>

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
            <button
              class="map-mode-button"
              mat-icon-button
              type="button"
              [class.active]="reportMapHybridMode()"
              [title]="reportMapHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
              [attr.aria-label]="reportMapHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
              (click)="toggleReportMapHybridMode()">
              <mat-icon>{{ reportMapHybridMode() ? 'map' : 'satellite' }}</mat-icon>
            </button>

            <footer>
              <div class="report-modal-details">
                <div>
                  <span>Categoria</span>
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
                  <span>Fuente</span>
                  <strong>{{ sourceLabel(report.source) }}</strong>
                </div>
                <div>
                  <span>Ubicacion</span>
                  <strong>{{ report.province || 'Sin provincia' }} · {{ report.municipality || 'Sin municipio' }}</strong>
                </div>
                <div>
                  <span>Coordenadas</span>
                  <strong>{{ report.latitude }}, {{ report.longitude }}</strong>
                </div>
                <div>
                  <span>Confirmaciones</span>
                  <strong>{{ report.confirmationCount || 1 }} · {{ confirmersLabel(report) }}</strong>
                </div>
                <div>
                  <span>Autoridad</span>
                  <strong>{{ report.assignedInstitution?.name || 'Sin mencionar' }}</strong>
                </div>
                <p>{{ report.description }}</p>
              </div>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./report-list.component.css'],
})
export class ReportListComponent implements OnInit, OnDestroy {
  @ViewChild('reportMapContainer') private readonly reportMapContainer?: ElementRef<HTMLElement>;

  reports = signal<ReportItem[]>([]);
  selectedReport = signal<ReportItem | null>(null);
  reportMapHybridMode = signal(false);
  totalReportCount = signal(0);
  pageIndex = signal(0);
  pageSize = signal(10);
  categoryFilter = signal<ReportCategory | 'ALL'>('ALL');
  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
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
    'OTHER',
  ];
  totalReports = computed(() => this.totalReportCount());
  highRiskReports = computed(() => this.reports().filter((report) => report.riskLevel >= 4).length);
  pendingReports = computed(() => this.reports().filter((report) => report.status === 'PENDING').length);
  resolvedReports = computed(() => this.reports().filter((report) => report.status === 'RESOLVED').length);
  private reportMap?: MapTilerMap;
  private reportMapMarker?: Marker;
  private reportMapResizeObserver?: ResizeObserver;

  constructor(private readonly reportsService: ReportsService) {}

  categoryLabel(category: string): string {
    return reportCategoryLabel(category);
  }

  sourceLabel(source: string | null | undefined): string {
    return reportSourceLabel(source);
  }

  categoryIcon(category: string): string {
    return reportCategoryIcon(category);
  }

  confirmersLabel(report: ReportItem): string {
    return report.confirmers?.map((user) => user.fullName).filter(Boolean).join(', ') || 'Sin confirmar';
  }

  ngOnInit(): void {
    this.loadPage();
  }

  ngOnDestroy(): void {
    this.destroyReportMap();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadPage();
  }

  applyDateFilters() {
    this.pageIndex.set(0);
    this.loadPage();
  }

  clearDateFilters() {
    this.categoryFilter.set('ALL');
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.pageIndex.set(0);
    this.loadPage();
  }

  openReportMap(report: ReportItem): void {
    this.selectedReport.set(report);
    window.setTimeout(() => this.renderSelectedReportMap(), 0);
  }

  closeReportMap(): void {
    this.selectedReport.set(null);
    this.destroyReportMap();
  }

  private loadPage() {
    this.reportsService.list({
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      category: this.categoryFilter() === 'ALL' ? undefined : this.categoryFilter(),
      from: this.dateStartToIso(this.dateFrom()),
      to: this.dateEndToIso(this.dateTo()),
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

  toX(longitude: number): number {
    const min = -70.05;
    const max = -69.75;
    return Math.min(92, Math.max(5, ((Number(longitude) - min) / (max - min)) * 100));
  }

  toY(latitude: number): number {
    const min = 18.35;
    const max = 18.6;
    return 100 - Math.min(92, Math.max(6, ((Number(latitude) - min) / (max - min)) * 100));
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
      navigationControl: true,
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
    marker.className = 'report-map-pin';

    const icon = document.createElement('mat-icon');
    icon.className = 'mat-icon material-icons';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = this.categoryIcon(report.category);

    marker.appendChild(icon);
    return marker;
  }
}

