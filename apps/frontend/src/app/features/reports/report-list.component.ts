import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Map as MapTilerMap, Marker, type MapMouseEvent } from '@maptiler/sdk';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/auth.service';
import { createKorviMap, observeMapResize, reverseGeocodeKorviLocation, scheduleMapResize, toLngLat, toggleKorviMapMode } from '../../core/map.config';
import { KORVI_MARKER_OFFSET, createKorviMapMarkerElement } from '../../core/map-marker-icons';
import { ReportAdminMetrics, ReportCategory, ReportItem, ReportStatus, ReportsService, reportCategoryIcon, reportCategoryLabel, reportSourceLabel } from '../../core/reports.service';
import { reportStatusStyle } from '../../shared/utils/report-status-style';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';

interface ReportEditDraft {
  title: string;
  category: ReportCategory;
  description: string;
  latitude: number;
  longitude: number;
  province: string;
  municipality: string;
  address: string;
  riskLevel: number;
}

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule, MatSelectModule, MatTooltipModule, StatusChipComponent],
  template: `
    <section class="reports-page">
      <header class="reports-hero">
        <div class="hero-copy">
          <span class="rs-eyebrow">Inventario operacional</span>
          <h1>Reportes georreferenciados</h1>
          <p>Registro consolidado para priorizar riesgos, coordinar instituciones y dar seguimiento territorial.</p>
        </div>
        <div class="hero-actions">
          <a mat-stroked-button routerLink="/map">
            <mat-icon>travel_explore</mat-icon>
            Ver mapa
          </a>
          <a mat-flat-button color="primary" routerLink="/reports/new">
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

        <div class="reports-main">
          <div class="reports-panel rs-panel">
            <div class="panel-toolbar">
              <div>
                <strong>Bandeja de incidentes</strong>
                <span>{{ reports().length }} visibles en esta pagina</span>
              </div>
              <mat-chip>{{ highRiskReports() }} alto riesgo</mat-chip>
            </div>

            <div class="date-filter-bar" aria-label="Filtro por fecha y hora">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Tipo</mat-label>
              <mat-select [value]="categoryFilter()" (selectionChange)="categoryFilter.set($event.value)">
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
              <mat-label>Estado</mat-label>
              <mat-select [value]="statusFilter()" (selectionChange)="statusFilter.set($event.value)">
                <mat-option value="ALL">Todos</mat-option>
                @for (status of statusOptions; track status) {
                  <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
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
            <button mat-flat-button color="primary" type="button" (click)="applyFilters()">
              <mat-icon>filter_alt</mat-icon>
              Filtrar
            </button>
            <button mat-stroked-button type="button" (click)="clearFilters()" [disabled]="!hasActiveFilters()">
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
                  <button class="entity-menu-button" mat-icon-button type="button" [matMenuTriggerFor]="reportActions" aria-label="Opciones del reporte" matTooltip="Opciones">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #reportActions="matMenu" xPosition="after" panelClass="entity-actions-menu">
                    <button mat-menu-item type="button" (click)="openReportMap(report)">
                      <mat-icon>map</mat-icon>
                      <span>Ver en el mapa</span>
                    </button>
                    @if (canEdit(report)) {
                      <button mat-menu-item type="button" (click)="openEdit(report)">
                        <mat-icon>edit</mat-icon>
                        <span>Editar reporte</span>
                      </button>
                    }
                  </mat-menu>
                </div>
                <div>
                  <div class="incident-title-row">
                    <strong>{{ report.title }}</strong>
                    <span>#{{ report.id.slice(0, 8) }}</span>
                  </div>
                  <p>{{ report.description }}</p>
                  <div class="incident-meta">
                    <span><strong>Categoria:</strong> {{ categoryLabel(report.category) }}</span>
                    <span><strong>Fuente:</strong> {{ sourceLabel(report.source) }}</span>
                    <span><strong>Confirmaciones:</strong> {{ report.confirmationCount || 1 }}</span>
                    <span><strong>Confirmado por:</strong> {{ confirmersLabel(report) }}</span>
                    @if (report.assignedInstitution) {
                      <span><strong>Autoridad:</strong> {{ report.assignedInstitution.name }}</span>
                    }
                  </div>
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
              <span>Ajusta los filtros o crea un nuevo incidente para iniciar el seguimiento operativo.</span>
              <a mat-flat-button color="primary" routerLink="/reports/new">
                <mat-icon>add_location_alt</mat-icon>
                Nuevo reporte
              </a>
            </div>
          }

          </div>

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

      @if (editingReport(); as report) {
        <div class="report-map-modal-backdrop" (click)="closeEdit()">
          <section class="report-edit-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Editar reporte">
            <header>
              <div>
                <span>Edicion autorizada</span>
                <strong>Editar reporte #{{ report.id.slice(0, 8) }}</strong>
              </div>
              <button mat-icon-button type="button" aria-label="Cerrar edicion" (click)="closeEdit()">
                <mat-icon>close</mat-icon>
              </button>
            </header>

            <form #editForm="ngForm" (ngSubmit)="saveEdit()">
              <div class="report-edit-grid">
                <mat-form-field appearance="outline" class="wide">
                  <mat-label>Titulo</mat-label>
                  <input matInput name="editTitle" [(ngModel)]="editDraft.title" required />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Categoria</mat-label>
                  <mat-select name="editCategory" [(ngModel)]="editDraft.category" required>
                    @for (category of categoryOptions; track category) {
                      <mat-option [value]="category">{{ categoryLabel(category) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Nivel de riesgo</mat-label>
                  <mat-select name="editRiskLevel" [(ngModel)]="editDraft.riskLevel" required>
                    @for (risk of [1, 2, 3, 4, 5]; track risk) {
                      <mat-option [value]="risk">{{ risk }}/5</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="wide">
                  <mat-label>Descripcion</mat-label>
                  <textarea matInput name="editDescription" [(ngModel)]="editDraft.description" rows="4" required></textarea>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Provincia</mat-label>
                  <input matInput name="editProvince" [(ngModel)]="editDraft.province" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Municipio</mat-label>
                  <input matInput name="editMunicipality" [(ngModel)]="editDraft.municipality" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="wide">
                  <mat-label>Direccion</mat-label>
                  <input matInput name="editAddress" [(ngModel)]="editDraft.address" />
                </mat-form-field>

                <details class="edit-location-picker wide" (toggle)="onEditMapToggle($event)">
                  <summary class="edit-location-heading">
                    <div>
                      <strong>Seleccionar ubicacion en el mapa</strong>
                      <span>{{ editMapExpanded() ? 'Haz clic o arrastra el marcador.' : 'Expandir selector de ubicacion.' }}</span>
                    </div>
                    <mat-icon>{{ editMapExpanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </summary>
                  <div #editMapContainer class="edit-location-map" aria-label="Mapa para editar la ubicacion del reporte"></div>
                </details>

              </div>

              <footer>
                <button mat-stroked-button type="button" (click)="closeEdit()" [disabled]="savingEdit()">Cancelar</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="editForm.invalid || savingEdit()">
                  <mat-icon>save</mat-icon>
                  {{ savingEdit() ? 'Guardando...' : 'Guardar cambios' }}
                </button>
              </footer>
            </form>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./report-list.component.css'],
})
export class ReportListComponent implements OnInit, OnDestroy {
  @ViewChild('reportMapContainer') private readonly reportMapContainer?: ElementRef<HTMLElement>;
  @ViewChild('editMapContainer') private readonly editMapContainer?: ElementRef<HTMLElement>;

  reports = signal<ReportItem[]>([]);
  metrics = signal<ReportAdminMetrics | null>(null);
  selectedReport = signal<ReportItem | null>(null);
  editingReport = signal<ReportItem | null>(null);
  editMapExpanded = signal(false);
  savingEdit = signal(false);
  editDraft: ReportEditDraft = this.emptyEditDraft();
  reportMapHybridMode = signal(false);
  totalReportCount = signal(0);
  pageIndex = signal(0);
  pageSize = signal(10);
  categoryFilter = signal<ReportCategory | 'ALL'>('ALL');
  statusFilter = signal<ReportStatus | 'ALL'>('ALL');
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
    'POLICE_ON_ROAD',
    'OTHER',
  ];
  readonly statusOptions: ReportStatus[] = ['PENDING', 'VALIDATED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'DUPLICATE'];
  totalReports = computed(() => this.metrics()?.total ?? this.totalReportCount());
  highRiskReports = computed(() => this.metrics()?.highRisk ?? 0);
  pendingReports = computed(() => this.metrics()?.pending ?? 0);
  resolvedReports = computed(() => this.metrics()?.resolved ?? 0);
  private reportMap?: MapTilerMap;
  private reportMapMarker?: Marker;
  private reportMapResizeObserver?: ResizeObserver;
  private editMap?: MapTilerMap;
  private editMapMarker?: Marker;
  private editMapResizeObserver?: ResizeObserver;
  private editLocationRequestId = 0;

  constructor(
    private readonly reportsService: ReportsService,
    private readonly auth: AuthService,
    private readonly toastr: ToastrService,
  ) {}

  categoryLabel(category: string): string {
    return reportCategoryLabel(category);
  }

  sourceLabel(source: string | null | undefined): string {
    return reportSourceLabel(source);
  }

  categoryIcon(category: string): string {
    return reportCategoryIcon(category);
  }

  statusLabel(status: string): string {
    return reportStatusStyle(status).label;
  }

  confirmersLabel(report: ReportItem): string {
    return report.confirmers?.map((user) => user.fullName).filter(Boolean).join(', ') || 'Sin confirmar';
  }

  canEdit(report: ReportItem): boolean {
    const user = this.auth.user();
    return Boolean(user && (user.role === 'SUPER_ADMIN' || report.createdBy?.id === user.id));
  }

  openEdit(report: ReportItem): void {
    if (!this.canEdit(report)) return;
    this.editDraft = {
      title: report.title,
      category: report.category,
      description: report.description,
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
      province: report.province ?? '',
      municipality: report.municipality ?? '',
      address: report.address ?? '',
      riskLevel: Number(report.riskLevel),
    };
    this.editingReport.set(report);
  }

  closeEdit(): void {
    if (this.savingEdit()) return;
    this.editingReport.set(null);
    this.editMapExpanded.set(false);
    this.destroyEditMap();
  }

  onEditMapToggle(event: Event): void {
    const expanded = (event.currentTarget as HTMLDetailsElement).open;
    this.editMapExpanded.set(expanded);
    if (expanded) {
      window.setTimeout(() => {
        this.initEditMap();
        if (this.editMap && this.editMapContainer?.nativeElement) {
          scheduleMapResize(this.editMap, this.editMapContainer.nativeElement);
        }
      }, 0);
      return;
    }
    this.destroyEditMap();
  }

  saveEdit(): void {
    const report = this.editingReport();
    if (!report || !this.canEdit(report)) return;

    this.savingEdit.set(true);
    this.reportsService.update(report.id, { ...this.editDraft }).subscribe({
      next: (updated) => {
        this.reports.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.editingReport.set(null);
        this.editMapExpanded.set(false);
        this.destroyEditMap();
        this.savingEdit.set(false);
        this.toastr.success('El reporte fue actualizado.', 'Reporte editado');
      },
      error: (error) => {
        this.savingEdit.set(false);
        this.toastr.error(error?.error?.message || 'No fue posible actualizar el reporte.', 'Edicion rechazada');
      },
    });
  }

  ngOnInit(): void {
    this.loadPage();
  }

  ngOnDestroy(): void {
    this.destroyReportMap();
    this.destroyEditMap();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadPage();
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.loadPage();
  }

  clearFilters() {
    this.categoryFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.pageIndex.set(0);
    this.loadPage();
  }

  hasActiveFilters(): boolean {
    return this.categoryFilter() !== 'ALL' || this.statusFilter() !== 'ALL' || Boolean(this.dateFrom() || this.dateTo());
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
    const filters = {
      category: this.categoryFilter() === 'ALL' ? undefined : this.categoryFilter(),
      status: this.statusFilter() === 'ALL' ? undefined : this.statusFilter(),
      from: this.dateStartToIso(this.dateFrom()),
      to: this.dateEndToIso(this.dateTo()),
    };

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

    this.reportsService.metrics(filters).subscribe({
      next: (metrics) => this.metrics.set(metrics),
      error: () => this.metrics.set(null),
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
      navigationControl: false,
      scrollZoom: true,
    });

    this.reportMapMarker = new Marker({ element: this.createReportMapPin(report), anchor: 'bottom', offset: KORVI_MARKER_OFFSET })
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

  private initEditMap(): void {
    const container = this.editMapContainer?.nativeElement;
    if (!container || this.editMap) return;

    const center = {
      latitude: Number(this.editDraft.latitude),
      longitude: Number(this.editDraft.longitude),
    };
    this.editMap = createKorviMap(container, {
      center,
      zoom: 16,
      navigationControl: true,
      scrollZoom: true,
    });
    this.editMap.on('click', (event: MapMouseEvent) => {
      this.updateEditLocation(
        Number(event.lngLat.lat.toFixed(7)),
        Number(event.lngLat.lng.toFixed(7)),
        false,
      );
    });
    this.updateEditMarker(center.latitude, center.longitude);
    this.editMapResizeObserver = observeMapResize(this.editMap, container);
    scheduleMapResize(this.editMap, container);
  }

  private updateEditLocation(latitude: number, longitude: number, moveMap: boolean): void {
    this.editDraft.latitude = latitude;
    this.editDraft.longitude = longitude;
    this.updateEditMarker(latitude, longitude);
    if (moveMap) {
      this.editMap?.flyTo({ center: [longitude, latitude], zoom: 16, essential: true });
    }
    void this.resolveEditLocation(latitude, longitude);
  }

  private updateEditMarker(latitude: number, longitude: number): void {
    if (!this.editMap) return;
    if (!this.editMapMarker) {
      this.editMapMarker = new Marker({
        element: this.createLocationPin(),
        draggable: true,
        anchor: 'bottom',
        offset: KORVI_MARKER_OFFSET,
      })
        .setLngLat([longitude, latitude])
        .addTo(this.editMap);
      this.editMapMarker.on('dragend', () => {
        const position = this.editMapMarker?.getLngLat();
        if (!position) return;
        this.updateEditLocation(
          Number(position.lat.toFixed(7)),
          Number(position.lng.toFixed(7)),
          false,
        );
      });
      return;
    }
    this.editMapMarker.setLngLat([longitude, latitude]);
  }

  private async resolveEditLocation(latitude: number, longitude: number): Promise<void> {
    const requestId = ++this.editLocationRequestId;
    try {
      const location = await reverseGeocodeKorviLocation(latitude, longitude);
      if (requestId !== this.editLocationRequestId || !this.editingReport()) return;
      this.editDraft.province = location.province ?? this.editDraft.province;
      this.editDraft.municipality = location.municipality ?? this.editDraft.municipality;
      this.editDraft.address = location.address ?? this.editDraft.address;
    } catch {
      // El backend vuelve a resolver la ubicacion al guardar.
    }
  }

  private destroyEditMap(): void {
    this.editMapResizeObserver?.disconnect();
    this.editMapResizeObserver = undefined;
    this.editMapMarker?.remove();
    this.editMapMarker = undefined;
    this.editMap?.remove();
    this.editMap = undefined;
    this.editLocationRequestId += 1;
  }

  private createReportMapPin(report: ReportItem): HTMLElement {
    return createKorviMapMarkerElement({
      kind: 'report',
      icon: this.categoryIcon(report.category),
      title: reportCategoryLabel(report.category),
    });
  }

  private createLocationPin(): HTMLElement {
    return createKorviMapMarkerElement({ kind: 'location', icon: 'location_on', title: 'Ubicación seleccionada', draggable: true });
  }

  private emptyEditDraft(): ReportEditDraft {
    return {
      title: '',
      category: 'OTHER',
      description: '',
      latitude: 0,
      longitude: 0,
      province: '',
      municipality: '',
      address: '',
      riskLevel: 3,
    };
  }
}

