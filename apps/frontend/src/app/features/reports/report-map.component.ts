import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Map as MapTilerMap, Marker, Popup, type MapMouseEvent } from '@maptiler/sdk';
import { auditTime, merge, Subscription } from 'rxjs';
import { API_URL } from '../../core/api.config';
import { LatLngPoint, applyKorviMapTheme, circlePolygon, createKorviMap, mapReady, metersBetween, observeMapResize, scheduleMapResize, toLngLat, toggleKorviMapMode } from '../../core/map.config';
import { RealtimeService } from '../../core/realtime.service';
import { ReportCategory, ReportMapPoint, ReportsService, reportCategoryLabel } from '../../core/reports.service';
import { SystemConfigService } from '../../core/system-config.service';
import { RiskChipComponent } from '../../shared/ui/risk-chip/risk-chip.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';

interface OsrmRouteResponse {
  routes?: Array<{
    geometry: {
      coordinates: Array<[number, number]>;
    };
    distance: number;
    duration: number;
  }>;
}

interface RouteRiskScore {
  total: number;
  floodZones: number;
  highRiskReports: number;
  unsafe?: boolean;
}

type ScoredRoute = NonNullable<OsrmRouteResponse['routes']>[number] & {
  score?: RouteRiskScore;
};

@Component({
  selector: 'app-report-map',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatSelectModule, RiskChipComponent, StatusChipComponent],
  template: `
    <section class="map-workspace" [class.detail-open]="selected()">
      <div class="map-canvas">
        <div #mapContainer class="maptiler-map" aria-label="Mapa real de reportes de riesgo"></div>

        <div class="map-toolbar">
          <div class="map-toolbar-main">
            <div>
              <strong>Mapa de riesgo</strong>
              <span>{{ reports().length }} de {{ allReports().length }} reportes{{ activeCategoryLabel() }}{{ routeSummary() ? ' - ' + routeSummary() : '' }}</span>
            </div>
            <mat-form-field class="category-select" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Categoría</mat-label>
              <mat-select [value]="activeCategory()" (selectionChange)="setCategoryFilter($event.value)">
                <mat-option value="ALL">Todas</mat-option>
                @for (category of categoryOptions; track category) {
                  <mat-option [value]="category">
                    <span class="category-option">
                      <i [style.background]="categoryColor(category)"></i>
                      {{ categoryLabel(category) }}
                    </span>
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="loadMapReports()" [disabled]="loading()">
              <mat-icon>refresh</mat-icon>
              Actualizar
            </button>
            <a mat-stroked-button routerLink="/reportes/nuevo">
              <mat-icon>add_location_alt</mat-icon>
              Nuevo reporte
            </a>
            <button mat-flat-button color="primary" type="button" (click)="startAvoidRoute()" [disabled]="routing()">
              <mat-icon>alt_route</mat-icon>
              Evitar riesgos
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="map-state">
            <mat-icon>sync</mat-icon>
            <span>Cargando reportes del API...</span>
          </div>
        } @else if (error()) {
          <div class="map-state error">
            <mat-icon>warning</mat-icon>
            <span>{{ error() }}</span>
          </div>
        } @else if (routeMode()) {
          <div class="map-state route-mode">
            <mat-icon>touch_app</mat-icon>
            <span>Haz clic en el mapa para marcar el destino.</span>
          </div>
        } @else if (routeWarning()) {
          <div class="map-state route-feedback" [class.safe]="routeSummary()">
            <mat-icon>{{ routeSummary() ? 'alt_route' : 'warning' }}</mat-icon>
            <span>{{ routeWarning() }}</span>
          </div>
        }

        <div class="heat-legend" aria-label="Intensidad del mapa de calor">
          <span>Bajo</span>
          <i><b class="low"></b><b class="medium"></b><b class="high"></b></i>
          <strong>Alto</strong>
        </div>

        <div class="zoom-controls" aria-label="Controles de zoom del mapa">
          <button
            mat-icon-button
            type="button"
            [class.active]="hybridMode()"
            [title]="hybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
            [attr.aria-label]="hybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
            (click)="toggleHybridMode()">
            <mat-icon>{{ hybridMode() ? 'map' : 'satellite' }}</mat-icon>
          </button>
          <button mat-icon-button type="button" title="Acercar mapa" aria-label="Acercar mapa" (click)="zoomIn()">
            <mat-icon>add</mat-icon>
          </button>
          <button mat-icon-button type="button" title="Alejar mapa" aria-label="Alejar mapa" (click)="zoomOut()">
            <mat-icon>remove</mat-icon>
          </button>
        </div>
      </div>

      @if (selected()) {
        <aside class="detail-panel">
          <div class="detail-visual">
            @if (selected()?.photoUrls?.length) {
              <img [src]="photoUrl(selected()?.photoUrls?.[0] ?? '')" [alt]="selected()?.title ?? 'Evidencia del reporte'" />
            }
            <div class="risk-tile">
              <span>Nivel de riesgo</span>
              <strong>{{ selected()?.riskLevel }}/5</strong>
            </div>
          </div>

          <div class="detail-body">
            <mat-chip-set aria-label="Categoría del reporte">
              <mat-chip>{{ categoryLabel(selected()?.category) }}</mat-chip>
            </mat-chip-set>
            <div class="chip-row">
              <app-status-chip [status]="selected()?.status ?? ''" />
              <app-risk-chip [level]="selected()?.riskLevel ?? 0" />
            </div>

            <h1>{{ selected()?.title }}</h1>
            <p>{{ selected()?.description }}</p>

            <div class="panel-actions">
              <button mat-stroked-button type="button" (click)="centerSelected()">
                <mat-icon>my_location</mat-icon>
                Centrar
              </button>
              <button mat-flat-button color="primary" type="button" (click)="startAvoidRoute()" [disabled]="routing()">
                <mat-icon>alt_route</mat-icon>
                Evitar
              </button>
            </div>

            @if (routeWarning()) {
              <div class="route-warning">
                <mat-icon>warning</mat-icon>
                <span>{{ routeWarning() }}</span>
              </div>
            }

            <section class="data-section">
              <div class="row">
                <span>Provincia</span>
                <strong>{{ selected()?.province || 'Sin definir' }}</strong>
              </div>
              <div class="row">
                <span>Municipio</span>
                <strong>{{ selected()?.municipality || 'Sin definir' }}</strong>
              </div>
              <div class="row">
                <span>Coordenadas</span>
                <strong>{{ selected()?.latitude }}, {{ selected()?.longitude }}</strong>
              </div>
              <div class="row">
                <span>Estado operativo</span>
                <strong>{{ selected()?.status }}</strong>
              </div>
              <div class="row">
                <span>Fuente</span>
                <strong>Reporte ciudadano</strong>
              </div>
              <div class="row">
                <span>Confirmaciones</span>
                <strong>{{ selected()?.confirmationCount || 1 }}</strong>
              </div>
              <div class="row stacked">
                <span>Confirmado por</span>
                <strong>{{ confirmersLabel(selected()) }}</strong>
              </div>
            </section>
          </div>
        </aside>
      }
    </section>
  `,
  styleUrls: ['./report-map.component.css'],
})
export class ReportMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer?: ElementRef<HTMLElement>;

  private readonly defaultCenter: LatLngPoint = { latitude: 18.4861, longitude: -69.9312 };
  private readonly currentLocationRadiusMeters = 50;
  private readonly currentLocationMaxZoom = 17;
  private readonly selectedReportZoom = 16;
  private readonly routeSourceId = 'ruta-segura-avoid-route';
  private readonly routeLayerId = 'ruta-segura-avoid-route-line';
  private readonly userRadiusSourceId = 'ruta-segura-user-radius';
  private readonly userRadiusFillLayerId = 'ruta-segura-user-radius-fill';
  private readonly userRadiusLineLayerId = 'ruta-segura-user-radius-line';
  private readonly dbReportsSourceId = 'ruta-segura-db-reports';
  private readonly dbReportsHeatLayerId = 'ruta-segura-db-reports-heat';
  private readonly dbReportsSelectionLayerId = 'ruta-segura-db-reports-selection';
  private readonly dbReportsIconLayerId = 'ruta-segura-db-reports-icon';
  private readonly dbReportsLevelLayerId = 'ruta-segura-db-reports-level';
  private readonly dbReportIconPrefix = 'ruta-segura-report-icon';
  private readonly dominicanRepublicBounds = {
    minLatitude: 17.4,
    maxLatitude: 20.1,
    minLongitude: -72.2,
    maxLongitude: -68,
  };

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

  allReports = signal<ReportMapPoint[]>([]);
  activeCategory = signal<ReportCategory | 'ALL'>('ALL');
  filteredReports = computed(() => {
    const category = this.activeCategory();
    const reports = this.allReports();
    return category === 'ALL' ? reports : reports.filter((report) => report.category === category);
  });
  reports = signal<ReportMapPoint[]>([]);
  selected = signal<ReportMapPoint | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  routeMode = signal(false);
  routing = signal(false);
  routeSummary = signal<string | null>(null);
  routeWarning = signal<string | null>(null);
  hybridMode = signal(false);

  private map?: MapTilerMap;
  private reportMarkers = new globalThis.Map<string, Marker>();
  private routeMarkers: Marker[] = [];
  private realtimeSubscription?: Subscription;
  private userLocationMarker?: Marker;
  private activeReportPopup?: Popup;
  private mapResizeObserver?: ResizeObserver;
  private dbReportLayerEventsRegistered = false;
  private readonly mapStyleReadyHandler = () => this.renderMapOverlaysAfterStyleChange();
  private initialLocationPending = false;
  private userLocation?: LatLngPoint;
  private origin?: LatLngPoint;
  private destination?: LatLngPoint;
  private readonly themeChangeHandler = () => this.applyMapTheme();
  private readonly mapProviderErrorHandler = (event: Event) => {
    const detail = event instanceof CustomEvent ? String(event.detail || '') : '';
    this.error.set(detail || 'No se pudo cargar el proveedor de mapas configurado.');
  };

  constructor(
    private readonly reportsService: ReportsService,
    private readonly realtime: RealtimeService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  ngOnInit(): void {
    this.initMap();
    this.locateUserForInitialCenter();
    this.loadMapReports();
    this.subscribeToRealtime();
    window.addEventListener('rs-theme-change', this.themeChangeHandler);
    window.addEventListener('rs-map-config-change', this.themeChangeHandler);
    window.addEventListener('rs-map-provider-error', this.mapProviderErrorHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('rs-theme-change', this.themeChangeHandler);
    window.removeEventListener('rs-map-config-change', this.themeChangeHandler);
    window.removeEventListener('rs-map-provider-error', this.mapProviderErrorHandler);
    this.realtimeSubscription?.unsubscribe();
    this.clearReportDomMarkers();
    this.routeMarkers.forEach((marker) => marker.remove());
    this.userLocationMarker?.remove();
    this.activeReportPopup?.remove();
    this.mapResizeObserver?.disconnect();
    this.map?.remove();
  }

  private applyMapTheme() {
    if (!this.map) return;
    this.dbReportLayerEventsRegistered = false;
    applyKorviMapTheme(this.map, () => {
      this.renderMarkers(this.reports());
      if (this.userLocation) this.drawUserLocation(this.userLocation);
      if (this.origin && this.destination) this.calculateAvoidingRoute();
      this.resizeMap();
    });
  }

  loadMapReports() {
    this.loading.set(true);
    this.error.set(null);
    this.reportsService.mapPoints({ limit: 100 }).subscribe({
      next: (reports) => {
        const validReports = reports.filter((report) => this.isValidReportCoordinate(report));
        this.allReports.set(validReports);
        this.applyReportFilter();
        this.loading.set(false);
      },
      error: () => {
        this.allReports.set([]);
        this.reports.set([]);
        this.selected.set(null);
        this.renderMarkers([]);
        this.error.set('No se pudieron cargar los reportes del API.');
        this.loading.set(false);
      },
    });
  }

  private subscribeToRealtime() {
    this.realtimeSubscription = merge(
      this.realtime.on('report.created'),
      this.realtime.on('report.updated'),
      this.realtime.on('report.status_changed'),
      this.realtime.on('report.assigned'),
      this.realtime.on('weather.flood_zone_created'),
    )
      .pipe(auditTime(500))
      .subscribe(() => this.loadMapReports());
  }

  setCategoryFilter(category: ReportCategory | 'ALL') {
    if (this.activeCategory() === category) return;
    this.activeCategory.set(category);
    this.applyReportFilter();
  }

  activeCategoryLabel(): string {
    const category = this.activeCategory();
    return category === 'ALL' ? '' : ` - ${this.categoryLabel(category)}`;
  }

  private applyReportFilter() {
    const filteredReports = this.filteredReports();
    const currentSelected = this.selected();
    const nextSelected =
      currentSelected && filteredReports.some((report) => report.id === currentSelected.id)
        ? currentSelected
        : null;

    this.reports.set(filteredReports);
    this.selected.set(nextSelected);
    this.renderMarkers(filteredReports);

    if (this.userLocation) {
      this.drawUserLocation(this.userLocation);
      return;
    }

    if (this.initialLocationPending) return;

    this.fitToReports(filteredReports);
  }

  select(report: ReportMapPoint) {
    this.selected.set(report);
    this.updateDbReportLayerSelection();
    this.resizeMap();
    requestAnimationFrame(() => this.centerReport(report));
  }

  centerSelected() {
    const report = this.selected();
    if (report) this.centerReport(report);
  }

  zoomIn() {
    this.map?.zoomIn();
  }

  zoomOut() {
    this.map?.zoomOut();
  }

  toggleHybridMode() {
    if (!this.map) return;
    this.dbReportLayerEventsRegistered = false;
    const mode = toggleKorviMapMode(this.map, () => {
      this.renderMarkers(this.reports());
      if (this.userLocation) this.drawUserLocation(this.userLocation);
      if (this.origin && this.destination) this.calculateAvoidingRoute();
      this.resizeMap();
    });
    this.hybridMode.set(mode === 'hybrid');
  }

  photoUrl(url: string): string {
    if (!url || url.startsWith('http')) return url;
    return `${API_URL.replace(/\/api$/, '')}${url}`;
  }

  confirmersLabel(report: ReportMapPoint | null): string {
    return report?.confirmers?.map((user) => user.fullName).filter(Boolean).join(', ') || 'Sin confirmar';
  }

  private initMap() {
    if (!this.mapContainer?.nativeElement) return;

    this.map = createKorviMap(this.mapContainer.nativeElement, {
      center: this.defaultCenter,
      zoom: 12,
      navigationControl: false,
    });

    this.map.on('click', (event: MapMouseEvent) => this.handleMapClick(event));
    this.map.on('style.load', this.mapStyleReadyHandler);
    this.mapResizeObserver = observeMapResize(this.map, this.mapContainer.nativeElement);
  }

  private renderMapOverlaysAfterStyleChange() {
    this.dbReportLayerEventsRegistered = false;
    this.renderMarkers(this.reports());
    if (this.userLocation) this.drawUserLocation(this.userLocation);
    if (this.origin && this.destination) this.calculateAvoidingRoute();
    this.resizeMap();
  }

  private locateUserForInitialCenter() {
    if (!navigator.geolocation) return;

    this.initialLocationPending = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.initialLocationPending = false;
        this.userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        this.drawUserLocation(this.userLocation);
        this.fitToCurrentLocationRadius(this.userLocation);
      },
      () => {
        this.initialLocationPending = false;
        this.fitToReports(this.reports());
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  startAvoidRoute() {
    if (!navigator.geolocation) {
      this.routeWarning.set('Este navegador no soporta geolocalizacion para calcular rutas.');
      return;
    }

    this.routing.set(true);
    this.routeWarning.set(null);
    this.routeSummary.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.origin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        this.destination = undefined;
        this.clearRoute();
        this.routeMode.set(true);
        this.routing.set(false);
      },
      () => {
        this.routing.set(false);
        this.routeWarning.set('Permite la ubicación del dispositivo para calcular una ruta desde tu posición actual.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  private handleMapClick(event: MapMouseEvent) {
    if (!this.routeMode() || !this.origin) return;

    this.destination = {
      latitude: event.lngLat.lat,
      longitude: event.lngLat.lng,
    };
    this.routeMode.set(false);
    this.calculateAvoidingRoute();
  }

  private calculateAvoidingRoute() {
    if (!this.origin || !this.destination) return;

    this.routing.set(true);
    const config = this.systemConfig.config();
    this.reportsService.optimizeRiskRoute(this.origin, this.destination, {
      provider: config.integrations.routingProvider,
      endpoint: config.libraries.routingEndpoint,
      openRouteServiceApiKey: config.apiKeys.openRouteService,
      googleMapsApiKey: config.apiKeys.googleMaps,
    })
      .subscribe({
        next: (route) => {
          this.drawRoute(route.geometry.coordinates, route.risk);
          this.routeSummary.set(`${route.summary.distanceKm.toFixed(1)} km - ${route.summary.durationMinutes} min`);
          const provider = this.routeProviderLabel(route.provider);
          this.routeWarning.set(route.risk.unsafe
            ? `${provider}: ruta optimizada con riesgo residual cerca de ${route.risk.floodZones} zona(s) inundadas y ${route.risk.highRiskReports} reporte(s) de alto riesgo.`
            : `${provider}: ruta optimizada sin cruces cercanos a zonas inundadas ni reportes de alto riesgo.`);
          this.routing.set(false);
        },
        error: (error) => {
          this.routeWarning.set(error?.error?.message || 'No se pudo calcular la ruta optimizada. Intenta de nuevo.');
          this.routing.set(false);
        },
      });
  }

  private routeProviderLabel(provider: string): string {
    if (provider === 'google-routes') return 'Google Routes';
    if (provider === 'openrouteservice') return 'OpenRouteService';
    return 'OSRM';
  }

  private async chooseRiskAvoidingShortestRoute(routes: NonNullable<OsrmRouteResponse['routes']>): Promise<ScoredRoute | null> {
    const scoredRoutes = routes.map((route) => ({
      ...route,
      score: this.routeRiskScore(route.geometry.coordinates),
    }));
    const shortestDirect = [...scoredRoutes].sort((a, b) => a.distance - b.distance || a.duration - b.duration)[0];
    const shortestDistance = shortestDirect?.distance ?? Math.min(...scoredRoutes.map((route) => route.distance));
    const maxReasonableDistance = Math.min(shortestDistance * 1.35, shortestDistance + 1200);

    const detourRoutes = await this.calculateDetourRoutes(scoredRoutes[0]?.geometry.coordinates ?? []);
    const candidateRoutes = [...scoredRoutes, ...detourRoutes]
      .map((route) => ({
        ...route,
        score: route.score ?? this.routeRiskScore(route.geometry.coordinates),
      }))
      .filter((route) => route.distance <= maxReasonableDistance);
    const allRoutes = (candidateRoutes.length ? candidateRoutes : scoredRoutes).sort((a, b) => {
      const scoreA = a.score ?? this.routeRiskScore(a.geometry.coordinates);
      const scoreB = b.score ?? this.routeRiskScore(b.geometry.coordinates);
      return scoreA.total - scoreB.total || a.distance - b.distance || a.duration - b.duration;
    });
    const best = allRoutes[0];
    if (!best) {
      this.clearRoute();
      this.drawRouteEndpoints();
      this.routeSummary.set(null);
      this.routeWarning.set('No se encontraron rutas alternativas disponibles para ese trayecto.');
      return null;
    }

    const score = best.score ?? this.routeRiskScore(best.geometry.coordinates);
    best.score = { ...score, unsafe: score.total > 0 };
    return best;
  }

  private async calculateDetourRoutes(referenceCoordinates: Array<[number, number]>): Promise<ScoredRoute[]> {
    if (!this.origin || !this.destination || !referenceCoordinates.length) return [];

    const blockingReports = this.blockingReportsNearRoute(referenceCoordinates).slice(0, 4);
    const waypoints = blockingReports.flatMap((report) => this.detourWaypointsAround(report)).slice(0, 32);
    const origin = `${this.origin.longitude},${this.origin.latitude}`;
    const destination = `${this.destination.longitude},${this.destination.latitude}`;

    const responses = await Promise.allSettled(
      waypoints.map(async (waypoint) => {
        const via = `${waypoint.longitude},${waypoint.latitude}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${origin};${via};${destination}?overview=full&geometries=geojson&alternatives=false`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Detour route failed');
        const data = await response.json() as OsrmRouteResponse;
        const route = data.routes?.[0];
        if (!route) throw new Error('No detour route');
        return {
          ...route,
          score: this.routeRiskScore(route.geometry.coordinates),
        };
      }),
    );

    return responses.flatMap((response) => response.status === 'fulfilled' ? [response.value] : []);
  }

  private drawRoute(coordinates: Array<[number, number]>, riskScore: RouteRiskScore) {
    if (!this.map) return;

    mapReady(this.map, () => {
      this.clearRoute();
      const routeFeature = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates,
        },
      };

      this.map?.addSource(this.routeSourceId, {
        type: 'geojson',
        data: routeFeature,
      });
      this.map?.addLayer({
        id: this.routeLayerId,
        type: 'line',
        source: this.routeSourceId,
        paint: {
          'line-color': riskScore.unsafe || riskScore.floodZones > 0 ? '#A84D4F' : riskScore.highRiskReports > 0 ? '#B9852C' : '#2F7D73',
          'line-width': 6,
          'line-opacity': 0.88,
          'line-dasharray': riskScore.unsafe ? [1.2, 1.2] : [1, 0],
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      if (this.origin) this.routeMarkers.push(this.simpleMarker(this.origin, '#2F7D73', 'Origen'));
      if (this.destination) this.routeMarkers.push(this.simpleMarker(this.destination, '#3B8A8A', 'Destino'));
      this.fitToCoordinates(coordinates, 16, 48);
    });
  }

  private drawRouteEndpoints() {
    this.routeMarkers.forEach((marker) => marker.remove());
    this.routeMarkers = [];
    if (this.origin) this.routeMarkers.push(this.simpleMarker(this.origin, '#2F7D73', 'Origen'));
    if (this.destination) this.routeMarkers.push(this.simpleMarker(this.destination, '#A84D4F', 'Destino sin ruta optimizada'));
    const coordinates = [this.origin, this.destination]
      .filter((point): point is LatLngPoint => Boolean(point))
      .map((point) => toLngLat(point));
    this.fitToCoordinates(coordinates, 16, 48);
  }

  private routeRiskScore(coordinates: Array<[number, number]>): RouteRiskScore {
    const activeReports = this.routeBlockingReports();
    const floodZones = this.countReportsNearRoute(activeReports.filter((report) => report.category === 'FLOOD_ZONE'), coordinates, 260);
    const highRiskReports = this.countReportsNearRoute(activeReports.filter((report) => report.category !== 'FLOOD_ZONE' && report.riskLevel >= 4), coordinates, 180);

    return {
      floodZones,
      highRiskReports,
      total: floodZones * 100 + highRiskReports,
    };
  }

  private routeBlockingReports(): ReportMapPoint[] {
    return this.allReports().filter((report) => (
      report.status !== 'RESOLVED' &&
      report.status !== 'REJECTED' &&
      (report.category === 'FLOOD_ZONE' || report.riskLevel >= 4)
    ));
  }

  private blockingReportsNearRoute(coordinates: Array<[number, number]>): ReportMapPoint[] {
    return this.routeBlockingReports().filter((report) => {
      const thresholdMeters = report.category === 'FLOOD_ZONE' ? 260 : 180;
      return this.isReportNearRoute(report, coordinates, thresholdMeters);
    });
  }

  private countReportsNearRoute(reports: ReportMapPoint[], coordinates: Array<[number, number]>, thresholdMeters: number): number {
    return reports.filter((report) => this.isReportNearRoute(report, coordinates, thresholdMeters)).length;
  }

  private isReportNearRoute(report: ReportMapPoint, coordinates: Array<[number, number]>, thresholdMeters: number): boolean {
    const reportPoint = { latitude: Number(report.latitude), longitude: Number(report.longitude) };
    return coordinates.some(([longitude, latitude], index) => {
      if (index % 8 !== 0) return false;
      return metersBetween(reportPoint, { latitude, longitude }) <= thresholdMeters;
    });
  }

  private detourWaypointsAround(report: ReportMapPoint): LatLngPoint[] {
    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);
    const offsets = report.category === 'FLOOD_ZONE' ? [0.01, 0.018] : [0.008, 0.014];

    return offsets.flatMap((offset) => [
      { latitude: latitude + offset, longitude },
      { latitude: latitude - offset, longitude },
      { latitude, longitude: longitude + offset },
      { latitude, longitude: longitude - offset },
      { latitude: latitude + offset, longitude: longitude + offset },
      { latitude: latitude + offset, longitude: longitude - offset },
      { latitude: latitude - offset, longitude: longitude + offset },
      { latitude: latitude - offset, longitude: longitude - offset },
    ]).filter((point) => this.isInsideDominicanRepublicBounds(point));
  }

  private renderMarkers(reports: ReportMapPoint[]) {
    if (!this.map) return;

    this.resizeMap();
    this.renderDbReportLayer(reports);
  }

  private renderReportDomMarkers(reports: ReportMapPoint[]) {
    if (!this.map) return;

    this.clearReportDomMarkers();
    const selectedId = this.selected()?.id;

    reports.filter((report) => this.isValidReportCoordinate(report)).forEach((report) => {
      const element = this.markerElement(report, report.id === selectedId);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        this.select(report);
      });

      const marker = new Marker({ element, anchor: 'bottom' })
        .setLngLat([Number(report.longitude), Number(report.latitude)])
        .addTo(this.map as MapTilerMap);

      this.reportMarkers.set(report.id, marker);
    });
  }

  private clearReportDomMarkers() {
    this.reportMarkers.forEach((marker) => marker.remove());
    this.reportMarkers.clear();
  }

  private renderDbReportLayer(reports: ReportMapPoint[]) {
    if (!this.map) return;

    mapReady(this.map, () => {
      if (!this.map) return;
      const data = this.dbReportFeatureCollection(reports);
      const source = this.map.getSource(this.dbReportsSourceId) as { setData?: (nextData: typeof data) => void } | undefined;

      this.ensureDbReportIconImages();

      if (source?.setData) {
        source.setData(data);
        this.addDbReportLayers();
        this.registerDbReportLayerEvents();
        return;
      }

      this.map.addSource(this.dbReportsSourceId, {
        type: 'geojson',
        data,
      });

      this.addDbReportLayers();

      this.registerDbReportLayerEvents();
    });
  }

  private addDbReportLayers() {
    if (!this.map) return;

    if (!this.map.getLayer(this.dbReportsHeatLayerId)) {
      this.map.addLayer({
        id: this.dbReportsHeatLayerId,
        type: 'heatmap',
        source: this.dbReportsSourceId,
        maxzoom: 17,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'riskLevel'],
            1,
            0.25,
            3,
            0.55,
            5,
            1,
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.75,
            15,
            1.85,
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            24,
            13,
            42,
            16,
            72,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.72,
            16,
            0.44,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(59, 138, 138, 0)',
            0.2,
            'rgba(59, 138, 138, 0.32)',
            0.45,
            'rgba(185, 133, 44, 0.58)',
            0.72,
            'rgba(216, 95, 59, 0.78)',
            1,
            'rgba(168, 77, 79, 0.92)',
          ],
        },
      });
    }

    if (!this.map.getLayer(this.dbReportsIconLayerId)) {
      this.map.addLayer({
        id: this.dbReportsIconLayerId,
        type: 'symbol',
        source: this.dbReportsSourceId,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['case', ['get', 'selected'], 0.78, 0.68],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-anchor': 'bottom',
        },
      });
    }
  }

  private registerDbReportLayerEvents() {
    if (!this.map || this.dbReportLayerEventsRegistered) return;
    this.dbReportLayerEventsRegistered = true;

    [this.dbReportsIconLayerId].forEach((layerId) => {
      this.map?.on('mouseenter', layerId, () => {
        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map?.on('mouseleave', layerId, () => {
        if (this.map) this.map.getCanvas().style.cursor = '';
      });
      this.map?.on('click', layerId, (event) => {
        const reportId = event.features?.[0]?.properties?.['id'];
        const report = this.reports().find((item) => item.id === reportId);
        if (report) this.select(report);
      });
    });
  }

  private dbReportFeatureCollection(reports: ReportMapPoint[]) {
    return {
      type: 'FeatureCollection' as const,
      features: reports.map((report) => ({
        type: 'Feature' as const,
        properties: {
          id: report.id,
          title: report.title,
          category: report.category,
          icon: this.categoryIconImageId(report.category, this.selected()?.id === report.id),
          riskLevel: Number(report.riskLevel),
          status: report.status,
          selected: this.selected()?.id === report.id,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(report.longitude), Number(report.latitude)],
        },
      })),
    };
  }

  private updateDbReportLayerSelection() {
    if (!this.map) return;
    const source = this.map.getSource(this.dbReportsSourceId) as { setData?: (nextData: ReturnType<ReportMapComponent['dbReportFeatureCollection']>) => void } | undefined;
    source?.setData?.(this.dbReportFeatureCollection(this.reports()));
  }

  private ensureDbReportIconImages() {
    if (!this.map) return;

    const categories = [
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
    ] as const;

    categories.forEach((category) => {
      const imageId = this.categoryIconImageId(category);
      if (!this.map?.hasImage(imageId)) {
        this.map?.addImage(imageId, this.createCategoryIconImage(category), { pixelRatio: 2 });
      }

      const selectedImageId = this.categoryIconImageId(category, true);
      if (!this.map?.hasImage(selectedImageId)) {
        this.map?.addImage(selectedImageId, this.createCategoryIconImage(category, true), { pixelRatio: 2 });
      }
    });
  }

  private categoryIconImageId(category: ReportMapPoint['category'], selected = false): string {
    const suffix = selected ? '-selected' : '';
    return `${this.dbReportIconPrefix}-${category.toLowerCase().replaceAll('_', '-')}${suffix}`;
  }

  private createCategoryIconImage(category: ReportMapPoint['category'], selected = false): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return new ImageData(96, 96);

    const color = selected ? '#0F2F45' : this.categoryColor(category);
    context.clearRect(0, 0, 96, 96);

    context.beginPath();
    context.ellipse(48, 88, 15, 4, 0, 0, Math.PI * 2);
    context.fillStyle = 'rgba(15, 47, 69, 0.2)';
    context.fill();

    context.save();
    context.shadowColor = selected ? 'rgba(15, 47, 69, 0.35)' : 'rgba(15, 47, 69, 0.2)';
    context.shadowBlur = selected ? 12 : 8;
    context.shadowOffsetY = selected ? 5 : 4;
    this.drawPinShape(context, 48, 9, 54, color);
    context.restore();

    context.lineWidth = selected ? 7 : 5;
    context.strokeStyle = selected ? '#F5B84B' : '#FFFFFF';
    this.drawPinShape(context, 48, 9, 54);
    context.stroke();

    context.beginPath();
    context.arc(48, 36, 23, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    context.fill();

    context.beginPath();
    context.arc(48, 36, 18, 0, Math.PI * 2);
    context.fillStyle = 'rgba(15, 47, 69, 0.1)';
    context.fill();

    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#FFFFFF';
    context.fillStyle = '#FFFFFF';
    this.drawCategoryGlyph(context, category);

    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  private drawPinShape(context: CanvasRenderingContext2D, centerX: number, topY: number, size: number, fill?: string) {
    const radius = size / 2;
    const centerY = topY + radius;
    const tipY = topY + size + 22;

    context.beginPath();
    context.arc(centerX, centerY, radius, Math.PI * 0.78, Math.PI * 2.22);
    context.quadraticCurveTo(centerX + 18, topY + size + 4, centerX, tipY);
    context.quadraticCurveTo(centerX - 18, topY + size + 4, centerX - radius * 0.72, centerY + radius * 0.7);
    context.closePath();

    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
  }

  categoryColor(category: ReportMapPoint['category']): string {
    const colors: Record<ReportMapPoint['category'], string> = {
      ACCIDENT: '#A84D4F',
      TRAFFIC_LIGHT_DAMAGED: '#A84D4F',
      ROAD_DAMAGE: '#B9852C',
      ROAD_OBSTRUCTION: '#8A6B3B',
      POOR_LIGHTING: '#C09A2E',
      MISSING_SIGNAGE: '#2F7D73',
      RECKLESS_DRIVING: '#7B4BA0',
      DANGEROUS_CROSSING: '#3B8A8A',
      FLOOD_ZONE: '#1D6F93',
      OTHER: '#66788A',
    };
    return colors[category] ?? colors.OTHER;
  }

  private drawCategoryGlyph(context: CanvasRenderingContext2D, category: ReportMapPoint['category']) {
    switch (category) {
      case 'ACCIDENT':
        this.drawCarCrashIcon(context);
        break;
      case 'TRAFFIC_LIGHT_DAMAGED':
        this.drawTrafficLightIcon(context);
        break;
      case 'ROAD_DAMAGE':
        this.drawRoadDamageIcon(context);
        break;
      case 'ROAD_OBSTRUCTION':
        this.drawWarningIcon(context);
        break;
      case 'POOR_LIGHTING':
        this.drawLightIcon(context);
        break;
      case 'MISSING_SIGNAGE':
        this.drawSignIcon(context);
        break;
      case 'RECKLESS_DRIVING':
        this.drawSpeedIcon(context);
        break;
      case 'DANGEROUS_CROSSING':
        this.drawPedestrianIcon(context);
        break;
      case 'FLOOD_ZONE':
        this.drawFloodIcon(context);
        break;
      default:
        this.drawWarningIcon(context);
        break;
    }
  }

  private roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  }

  private drawTrafficLightIcon(context: CanvasRenderingContext2D) {
    this.roundedRect(context, 35, 21, 22, 42, 8, '#FFFFFF');
    context.fillStyle = '#0F2F45';
    [31, 42, 53].forEach((y) => {
      context.beginPath();
      context.arc(46, y, 5, 0, Math.PI * 2);
      context.fill();
    });
    context.strokeStyle = '#FFFFFF';
    context.beginPath();
    context.moveTo(30, 42);
    context.lineTo(62, 42);
    context.stroke();
  }

  private drawRoadDamageIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.beginPath();
    context.moveTo(34, 22);
    context.lineTo(58, 22);
    context.lineTo(64, 60);
    context.lineTo(28, 60);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(46, 28);
    context.lineTo(42, 38);
    context.lineTo(49, 43);
    context.lineTo(43, 56);
    context.stroke();
  }

  private drawLightIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.beginPath();
    context.arc(46, 36, 14, Math.PI * 0.15, Math.PI * 0.85, true);
    context.stroke();
    context.beginPath();
    context.moveTo(37, 47);
    context.lineTo(55, 47);
    context.lineTo(51, 59);
    context.lineTo(41, 59);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(28, 25);
    context.lineTo(22, 19);
    context.moveTo(64, 25);
    context.lineTo(70, 19);
    context.moveTo(46, 18);
    context.lineTo(46, 12);
    context.stroke();
  }

  private drawSignIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.strokeRect(30, 23, 32, 22);
    context.beginPath();
    context.moveTo(46, 45);
    context.lineTo(46, 64);
    context.moveTo(36, 64);
    context.lineTo(56, 64);
    context.moveTo(36, 34);
    context.lineTo(56, 34);
    context.stroke();
  }

  private drawSpeedIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.beginPath();
    context.arc(46, 48, 22, Math.PI, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(46, 48);
    context.lineTo(61, 35);
    context.stroke();
    context.fillStyle = '#FFFFFF';
    context.beginPath();
    context.arc(46, 48, 4, 0, Math.PI * 2);
    context.fill();
  }

  private drawPedestrianIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.beginPath();
    context.arc(46, 25, 6, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(46, 32);
    context.lineTo(43, 45);
    context.lineTo(34, 60);
    context.moveTo(44, 43);
    context.lineTo(56, 60);
    context.moveTo(44, 36);
    context.lineTo(32, 42);
    context.moveTo(45, 36);
    context.lineTo(58, 39);
    context.stroke();
  }

  private drawCarCrashIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.strokeRect(25, 39, 24, 14);
    context.strokeRect(52, 31, 18, 14);
    context.beginPath();
    context.arc(31, 56, 4, 0, Math.PI * 2);
    context.arc(44, 56, 4, 0, Math.PI * 2);
    context.moveTo(50, 34);
    context.lineTo(43, 27);
    context.moveTo(50, 38);
    context.lineTo(39, 38);
    context.moveTo(50, 42);
    context.lineTo(43, 49);
    context.stroke();
  }

  private drawFloodIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(28, 49);
    context.quadraticCurveTo(36, 42, 44, 49);
    context.quadraticCurveTo(52, 56, 64, 49);
    context.moveTo(26, 60);
    context.quadraticCurveTo(36, 53, 46, 60);
    context.quadraticCurveTo(56, 67, 68, 60);
    context.stroke();
    context.beginPath();
    context.moveTo(46, 20);
    context.quadraticCurveTo(34, 34, 34, 42);
    context.arc(46, 42, 12, Math.PI, 0, true);
    context.quadraticCurveTo(58, 34, 46, 20);
    context.closePath();
    context.stroke();
  }

  private drawWarningIcon(context: CanvasRenderingContext2D) {
    context.strokeStyle = '#FFFFFF';
    context.beginPath();
    context.moveTo(46, 21);
    context.lineTo(66, 60);
    context.lineTo(26, 60);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(46, 34);
    context.lineTo(46, 47);
    context.moveTo(46, 55);
    context.lineTo(46, 55);
    context.stroke();
  }

  private fitToReports(reports: ReportMapPoint[]) {
    if (!this.map) return;
    this.resizeMap();
    if (this.userLocation) this.drawUserLocation(this.userLocation);

    if (!reports.length) {
      this.resizeMapNow();
      this.map.easeTo({ center: toLngLat(this.defaultCenter), zoom: 12, bearing: 0, pitch: 0, duration: 450, essential: true });
      this.refreshMapAfterCameraMove();
      return;
    }

    this.fitToCoordinates(reports.map((report) => [Number(report.longitude), Number(report.latitude)]), 16, 48);
  }

  private centerAroundCurrentLocation(reports: ReportMapPoint[]): boolean {
    if (!this.map || !this.userLocation) return false;

    this.drawUserLocation(this.userLocation);

    const nearestReports = reports
      .filter((report) => Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude)))
      .map((report) => ({
        report,
        distance: metersBetween(this.userLocation as LatLngPoint, {
          latitude: Number(report.latitude),
          longitude: Number(report.longitude),
        }),
      }))
      .filter(({ distance }) => distance <= this.currentLocationRadiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .map(({ report }) => report);

    if (!nearestReports.length) {
      return false;
    }

    this.fitToCurrentLocationRadius(this.userLocation);
    return true;
  }

  private drawUserLocation(position: LatLngPoint) {
    if (!this.map) return;

    this.userLocationMarker?.remove();
    this.userLocationMarker = new Marker({
      element: this.htmlElement('<span class="user-location-shell"><span class="user-location-marker"><span class="material-icons">person_pin_circle</span></span></span>'),
      anchor: 'center',
    })
      .setLngLat(toLngLat(position))
      .setPopup(new Popup({ offset: 20 }).setText('Mi ubicación'))
      .addTo(this.map);

    mapReady(this.map, () => {
      this.removeLayerIfExists(this.userRadiusFillLayerId);
      this.removeLayerIfExists(this.userRadiusLineLayerId);
      this.removeSourceIfExists(this.userRadiusSourceId);
      this.map?.addSource(this.userRadiusSourceId, {
        type: 'geojson',
        data: circlePolygon(position, this.currentLocationRadiusMeters),
      });
      this.map?.addLayer({
        id: this.userRadiusFillLayerId,
        type: 'fill',
        source: this.userRadiusSourceId,
        paint: {
          'fill-color': '#2F7D73',
          'fill-opacity': 0.08,
        },
      });
      this.map?.addLayer({
        id: this.userRadiusLineLayerId,
        type: 'line',
        source: this.userRadiusSourceId,
        paint: {
          'line-color': '#2F7D73',
          'line-opacity': 0.24,
          'line-width': 2,
        },
      });
    });
  }

  private fitToCurrentLocationRadius(position: LatLngPoint) {
    if (!this.map) return;

    const latitudeDelta = this.currentLocationRadiusMeters / 111320;
    const longitudeDelta = this.currentLocationRadiusMeters / (111320 * Math.cos((position.latitude * Math.PI) / 180));

    this.resizeMapNow();
    this.map.fitBounds(
      [
        [position.longitude - longitudeDelta, position.latitude - latitudeDelta],
        [position.longitude + longitudeDelta, position.latitude + latitudeDelta],
      ],
      {
        padding: 52,
        maxZoom: this.currentLocationMaxZoom,
        duration: 500,
      },
    );
    this.refreshMapAfterCameraMove();
  }

  private centerReport(report: ReportMapPoint) {
    if (!this.map) return;

    if (!this.isValidReportCoordinate(report)) return;

    const center: [number, number] = [Number(report.longitude), Number(report.latitude)];
    this.resizeMapNow();

    mapReady(this.map, () => {
      this.resizeMapNow();
      this.map?.stop();
      this.map?.easeTo({
        center,
        zoom: this.selectedReportZoom,
        bearing: 0,
        pitch: 0,
        duration: 450,
        essential: true,
      });

      this.refreshMapAfterCameraMove();
      this.openReportPopup(report.id);
    });
  }

  private syncSelectedMarker() {
    this.updateDbReportLayerSelection();
    this.renderReportDomMarkers(this.reports());
  }

  private markerElement(report: ReportMapPoint, selected = false): HTMLElement {
    const levelClass = report.riskLevel >= 4 ? 'high' : report.riskLevel === 3 ? 'medium' : 'low';
    const icon = this.categoryIcon(report.category);
    return this.htmlElement(`<span class="risk-marker-shell"><span class="risk-marker ${levelClass}${selected ? ' selected' : ''}" title="${this.escapeHtml(reportCategoryLabel(report.category))}"><span class="material-icons">${icon}</span></span></span>`);
  }

  private categoryIcon(category: ReportMapPoint['category']): string {
    const icons: Record<ReportMapPoint['category'], string> = {
      ACCIDENT: 'car_crash',
      TRAFFIC_LIGHT_DAMAGED: 'traffic',
      ROAD_DAMAGE: 'construction',
      ROAD_OBSTRUCTION: 'deployed_code_alert',
      POOR_LIGHTING: 'lightbulb',
      MISSING_SIGNAGE: 'signpost',
      RECKLESS_DRIVING: 'speed',
      DANGEROUS_CROSSING: 'directions_walk',
      FLOOD_ZONE: 'flood',
      OTHER: 'warning',
    };
    return icons[category] ?? 'warning';
  }

  private popupHtml(report: ReportMapPoint): string {
    return `
      <strong>${this.escapeHtml(report.title)}</strong><br>
      <span>${this.escapeHtml(reportCategoryLabel(report.category))}</span><br>
      ${report.address ? `<span>${this.escapeHtml(report.address)}</span><br>` : ''}
      <span>${this.escapeHtml(report.municipality || report.province || 'Sin ubicación administrativa')}</span><br>
      <span>Riesgo ${report.riskLevel}/5 - ${this.escapeHtml(report.status)}</span>
    `;
  }

  categoryLabel(category: string | null | undefined): string {
    return reportCategoryLabel(category);
  }

  private simpleMarker(position: LatLngPoint, color: string, label: string): Marker {
    return new Marker({ color })
      .setLngLat(toLngLat(position))
      .setPopup(new Popup({ offset: 18 }).setText(label))
      .addTo(this.map as MapTilerMap);
  }

  private clearRoute() {
    this.routeMarkers.forEach((marker) => marker.remove());
    this.routeMarkers = [];
    this.removeLayerIfExists(this.routeLayerId);
    this.removeSourceIfExists(this.routeSourceId);
  }

  private fitToCoordinates(coordinates: Array<[number, number]>, maxZoom: number, padding: number) {
    if (!this.map || !coordinates.length) return;

    const validCoordinates = coordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
    if (!validCoordinates.length) return;

    const longitudes = validCoordinates.map(([longitude]) => longitude);
    const latitudes = validCoordinates.map(([, latitude]) => latitude);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);

    if (minLongitude === maxLongitude && minLatitude === maxLatitude) {
      this.resizeMapNow();
      this.map.easeTo({
        center: [minLongitude, minLatitude],
        zoom: maxZoom,
        bearing: 0,
        pitch: 0,
        duration: 450,
        essential: true,
      });
      this.refreshMapAfterCameraMove();
      return;
    }

    this.resizeMapNow();
    this.map.fitBounds(
      [
        [minLongitude, minLatitude],
        [maxLongitude, maxLatitude],
      ],
      { padding, maxZoom, duration: 500 },
    );
    this.refreshMapAfterCameraMove();
  }

  private isValidReportCoordinate(report: ReportMapPoint): boolean {
    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);
    return this.isInsideDominicanRepublicBounds({ latitude, longitude });
  }

  private isInsideDominicanRepublicBounds(point: LatLngPoint): boolean {
    const bounds = this.dominicanRepublicBounds;
    return (
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= bounds.minLatitude &&
      point.latitude <= bounds.maxLatitude &&
      point.longitude >= bounds.minLongitude &&
      point.longitude <= bounds.maxLongitude
    );
  }

  private removeLayerIfExists(id: string) {
    if (this.map?.getLayer(id)) this.map.removeLayer(id);
  }

  private removeSourceIfExists(id: string) {
    if (this.map?.getSource(id)) this.map.removeSource(id);
  }

  private htmlElement(html: string): HTMLElement {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild as HTMLElement;
  }

  private resizeMap() {
    if (!this.map || !this.mapContainer?.nativeElement) return;
    scheduleMapResize(this.map, this.mapContainer.nativeElement);
  }

  private resizeMapNow() {
    if (!this.map || !this.mapContainer?.nativeElement) return;
    const container = this.mapContainer.nativeElement;
    if (!container.offsetWidth || !container.offsetHeight) return;
    this.map.resize();
  }

  private refreshMapAfterCameraMove() {
    if (!this.map) return;

    const refresh = () => {
      this.resizeMapNow();
      (this.map as (MapTilerMap & { triggerRepaint?: () => void }) | undefined)?.triggerRepaint?.();
    };

    this.map.once('moveend', refresh);
    this.map.once('idle', refresh);
    window.setTimeout(refresh, 120);
    window.setTimeout(refresh, 420);
    window.setTimeout(refresh, 900);
  }

  private openReportPopup(reportId: string) {
    const report = this.reports().find((item) => item.id === reportId);
    if (!report || !this.map) return;

    window.setTimeout(() => {
      if (!this.map) return;
      this.activeReportPopup?.remove();
      this.activeReportPopup = new Popup({ offset: 24 })
        .setLngLat([Number(report.longitude), Number(report.latitude)])
        .setHTML(this.popupHtml(report))
        .addTo(this.map);
    }, 480);
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

}

