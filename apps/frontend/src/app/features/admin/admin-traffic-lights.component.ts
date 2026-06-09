import { Component, ElementRef, OnDestroy, OnInit, TemplateRef, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Map as MapTilerMap, Marker } from '@maptiler/sdk';
import { ToastrService } from 'ngx-toastr';
import { ReverseGeocodeDetails, createKorviMap, observeMapResize, reverseGeocodeKorviLocation, scheduleMapResize, toLngLat, toggleKorviMapMode } from '../../core/map.config';
import { RefreshLocationDetailsJob, TrafficLightItem, TrafficLightsService, TrafficLightsSettings, TrafficLightStatus } from '../../core/traffic-lights.service';

interface TrafficLightLocationDetails {
  province?: string;
  municipality?: string;
  intersection?: string;
}

@Component({
  selector: 'app-admin-traffic-lights',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatPaginatorModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <section class="traffic-page">
      <header class="traffic-header">
        <div>
          <span class="rs-eyebrow">Inventario vial</span>
          <h1>Catalogo de semaforos</h1>
          <p>Importa semaforos desde OpenStreetMap y administra su estado operativo para asociarlos a reportes.</p>
        </div>
          <div class="header-actions">
            <a mat-stroked-button routerLink="/admin">
              <mat-icon>arrow_back</mat-icon>
              Volver al panel
            </a>
            <button mat-flat-button color="primary" type="button" (click)="openManualDialog(manualDialog)">
              <mat-icon>add</mat-icon>
              Nuevo semaforo
            </button>
            <button mat-stroked-button type="button" (click)="load()">
              <mat-icon>refresh</mat-icon>
              Actualizar
            </button>
          </div>
      </header>

      <section class="summary-grid">
        <mat-card>
          <span>Total</span>
          <strong>{{ totalTrafficLights() }}</strong>
          <small>semaforos registrados</small>
        </mat-card>
        <mat-card class="success">
          <span>Activos</span>
          <strong>{{ activeCount() }}</strong>
          <small>operacion normal</small>
        </mat-card>
        <mat-card class="warning">
          <span>Sin verificar</span>
          <strong>{{ unknownCount() }}</strong>
          <small>requieren validacion</small>
        </mat-card>
        <mat-card class="danger">
          <span>Apagados</span>
          <strong>{{ offlineCount() }}</strong>
          <small>posible riesgo vial</small>
        </mat-card>
      </section>

      <section class="admin-layout">
        <mat-card class="config-card">
          <div class="section-heading">
            <div>
              <strong>Configuracion OpenStreetMap</strong>
              <span>Define la zona por caja geografica y el endpoint Overpass.</span>
            </div>
          </div>

          <div class="field-grid two">
            <mat-form-field appearance="outline">
              <mat-label>Endpoint Overpass</mat-label>
              <input matInput [ngModel]="settings().overpassEndpoint" (ngModelChange)="patchSettings({ overpassEndpoint: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Provincias a importar</mat-label>
              <mat-select multiple [ngModel]="settings().importProvinces" (ngModelChange)="patchSettings({ importProvinces: $event })">
                @for (province of provinceOptions; track province) {
                  <mat-option [value]="province">{{ province }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Municipio por defecto</mat-label>
              <input matInput [ngModel]="settings().defaultMunicipality" (ngModelChange)="patchSettings({ defaultMunicipality: $event })" />
            </mat-form-field>
          </div>

          <div class="field-grid four">
            <mat-form-field appearance="outline">
              <mat-label>Sur</mat-label>
              <input matInput type="number" step="0.0001" [ngModel]="settings().defaultSouth" (ngModelChange)="patchSettings({ defaultSouth: numberValue($event, settings().defaultSouth) })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Oeste</mat-label>
              <input matInput type="number" step="0.0001" [ngModel]="settings().defaultWest" (ngModelChange)="patchSettings({ defaultWest: numberValue($event, settings().defaultWest) })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Norte</mat-label>
              <input matInput type="number" step="0.0001" [ngModel]="settings().defaultNorth" (ngModelChange)="patchSettings({ defaultNorth: numberValue($event, settings().defaultNorth) })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Este</mat-label>
              <input matInput type="number" step="0.0001" [ngModel]="settings().defaultEast" (ngModelChange)="patchSettings({ defaultEast: numberValue($event, settings().defaultEast) })" />
            </mat-form-field>
          </div>

          <div class="config-actions">
            <mat-slide-toggle [checked]="replaceExisting()" (change)="replaceExisting.set($event.checked)">
              Reemplazar estado existente al importar
            </mat-slide-toggle>
            <button mat-flat-button color="primary" type="button" (click)="saveSettings()">
              <mat-icon>save</mat-icon>
              Guardar configuracion
            </button>
            <button mat-stroked-button type="button" (click)="importOsm()" [disabled]="importing()">
              <mat-icon>download</mat-icon>
              {{ importing() ? 'Importando...' : 'Importar OSM' }}
            </button>
            <button mat-stroked-button type="button" (click)="refreshImportedLocationDetails()" [disabled]="refreshingLocations()">
              <mat-icon>travel_explore</mat-icon>
              {{ refreshingLocations() ? 'Actualizando en background' : 'Actualizar ubicaciones' }}
            </button>
            @if (refreshLocationStatus()) {
              <span class="background-status">{{ refreshLocationStatus() }}</span>
            }
          </div>
        </mat-card>

      </section>

      <mat-card class="list-card">
        <div class="list-toolbar">
          <div>
            <strong>Administracion de informacion</strong>
            <span>{{ totalTrafficLights() }} resultados</span>
          </div>
          <div class="filters">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Buscar</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="search.set($event); applyFilters()" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Estado</mat-label>
              <mat-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); applyFilters()">
                <mat-option value="ALL">Todos</mat-option>
                <mat-option value="active">Activo</mat-option>
                <mat-option value="unknown">Sin verificar</mat-option>
                <mat-option value="offline">Apagado</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <div class="traffic-table-head">
          <span>Semaforo</span>
          <span>Ubicacion</span>
          <span>Origen</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        @for (group of groupedTrafficLights(); track group.province) {
          <section class="province-group">
            <header>
              <div>
                <mat-icon>location_city</mat-icon>
                <strong>{{ group.province }}</strong>
              </div>
              <span>{{ group.items.length }} semaforos</span>
            </header>

            @for (item of group.items; track item.id) {
              <article class="traffic-row">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.intersection || 'Sin interseccion registrada' }}</span>
                </div>
                <div>
                  <strong>{{ item.municipality || 'Sin municipio' }}</strong>
                  <span>{{ item.latitude }}, {{ item.longitude }}</span>
                </div>
                <mat-chip>{{ item.source === 'osm' ? 'OpenStreetMap' : item.source }}</mat-chip>
                <mat-chip>{{ trafficLightStatusLabel(item.status) }}</mat-chip>
                <div class="row-actions">
                  <button mat-icon-button class="options-button" type="button" aria-label="Opciones del semaforo" [matMenuTriggerFor]="trafficLightActions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #trafficLightActions="matMenu" xPosition="before" panelClass="traffic-actions-menu">
                    <button mat-menu-item class="traffic-action-item" type="button" (click)="openTrafficLightMap(item)">
                      <mat-icon>map</mat-icon>
                      <span>Ver en mapa</span>
                    </button>
                    <button mat-menu-item class="traffic-action-item" type="button" (click)="openEditDialog(editDialog, item)">
                      <mat-icon>edit</mat-icon>
                      <span>Editar</span>
                    </button>
                    <button mat-menu-item class="traffic-action-item danger-menu-item" type="button" (click)="confirmRemove(confirmDeleteDialog, item)">
                      <mat-icon>delete</mat-icon>
                      <span>Eliminar</span>
                    </button>
                  </mat-menu>
                </div>
              </article>
            }
          </section>
        } @empty {
          <div class="empty-state">
            <mat-icon>traffic</mat-icon>
            <strong>No hay semaforos registrados</strong>
            <span>Importa desde OpenStreetMap o crea un registro manual.</span>
          </div>
        }

        <mat-paginator
          [length]="totalTrafficLights()"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50]"
          showFirstLastButtons
          (page)="onPage($event)">
        </mat-paginator>
      </mat-card>

      <ng-template #manualDialog>
        <section class="manual-dialog">
          <header>
            <div>
              <span>Registro manual</span>
              <strong>Nuevo semaforo</strong>
            </div>
            <button mat-icon-button type="button" aria-label="Cerrar" (click)="closeManualDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </header>

          <div class="field-grid two">
            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput [ngModel]="draft().name" (ngModelChange)="updateDraft({ name: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Interseccion</mat-label>
              <input matInput [ngModel]="draft().intersection" (ngModelChange)="updateDraft({ intersection: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Provincia</mat-label>
              <input matInput [ngModel]="draft().province" (ngModelChange)="updateDraft({ province: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Municipio</mat-label>
              <input matInput [ngModel]="draft().municipality" (ngModelChange)="updateDraft({ municipality: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Latitud</mat-label>
              <input matInput type="number" step="0.0000001" [ngModel]="draft().latitude" (ngModelChange)="updateDraft({ latitude: numberValue($event, 0) })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Longitud</mat-label>
              <input matInput type="number" step="0.0000001" [ngModel]="draft().longitude" (ngModelChange)="updateDraft({ longitude: numberValue($event, 0) })" />
            </mat-form-field>
          </div>

          <div class="location-actions">
            <button mat-stroked-button class="gps-button" type="button" (click)="useCurrentLocation('create')" [disabled]="locating()">
              <mat-icon>{{ locating() ? 'sync' : 'my_location' }}</mat-icon>
              {{ locating() ? 'Obteniendo ubicacion...' : 'Usar GPS y detectar direccion' }}
            </button>
            <button mat-stroked-button class="gps-button" type="button" (click)="detectLocationFromCoordinates('create')" [disabled]="locating()">
              <mat-icon>travel_explore</mat-icon>
              Detectar con coordenadas
            </button>
          </div>

          <footer>
            <button mat-stroked-button type="button" (click)="closeManualDialog()">Cancelar</button>
            <button mat-flat-button color="primary" type="button" (click)="createManual()">
              <mat-icon>add_location_alt</mat-icon>
              Agregar semaforo
            </button>
          </footer>
        </section>
      </ng-template>

      <ng-template #editDialog>
        <section class="manual-dialog">
          <header>
            <div>
              <span>Administracion de semaforo</span>
              <strong>Editar informacion</strong>
            </div>
            <button mat-icon-button type="button" aria-label="Cerrar" (click)="closeManualDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </header>

          <div class="field-grid two">
            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput [ngModel]="editDraft().name" (ngModelChange)="updateEditDraft({ name: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select [ngModel]="editDraft().status" (ngModelChange)="updateEditDraft({ status: $event })">
                <mat-option value="active">Activo</mat-option>
                <mat-option value="unknown">Sin verificar</mat-option>
                <mat-option value="offline">Apagado</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Provincia</mat-label>
              <input matInput [ngModel]="editDraft().province" (ngModelChange)="updateEditDraft({ province: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Municipio</mat-label>
              <input matInput [ngModel]="editDraft().municipality" (ngModelChange)="updateEditDraft({ municipality: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="wide-field">
              <mat-label>Interseccion</mat-label>
              <input matInput [ngModel]="editDraft().intersection" (ngModelChange)="updateEditDraft({ intersection: $event })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Latitud</mat-label>
              <input matInput type="number" step="0.0000001" [ngModel]="editDraft().latitude" (ngModelChange)="updateEditDraft({ latitude: numberValue($event, 0) })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Longitud</mat-label>
              <input matInput type="number" step="0.0000001" [ngModel]="editDraft().longitude" (ngModelChange)="updateEditDraft({ longitude: numberValue($event, 0) })" />
            </mat-form-field>
          </div>

          <div class="location-actions">
            <button mat-stroked-button class="gps-button" type="button" (click)="useCurrentLocation('edit')" [disabled]="locating()">
              <mat-icon>{{ locating() ? 'sync' : 'my_location' }}</mat-icon>
              {{ locating() ? 'Obteniendo ubicacion...' : 'Usar GPS y detectar direccion' }}
            </button>
            <button mat-stroked-button class="gps-button" type="button" (click)="detectLocationFromCoordinates('edit')" [disabled]="locating()">
              <mat-icon>travel_explore</mat-icon>
              Detectar con coordenadas
            </button>
          </div>

          <footer>
            <button mat-stroked-button type="button" (click)="closeManualDialog()">Cancelar</button>
            <button mat-flat-button color="primary" type="button" (click)="saveEdit()">
              <mat-icon>save</mat-icon>
              Guardar cambios
            </button>
          </footer>
        </section>
      </ng-template>

      <ng-template #confirmDeleteDialog>
        <section class="confirm-dialog">
          <header>
            <mat-icon>delete</mat-icon>
            <div>
              <strong>Eliminar semaforo</strong>
              <span>{{ deletingTrafficLight()?.name }}</span>
            </div>
          </header>
          <p>Esta accion eliminara el semaforo del catalogo. No se eliminaran reportes existentes.</p>
          <footer>
            <button mat-stroked-button type="button" (click)="closeConfirmDelete()">Cancelar</button>
            <button mat-flat-button color="warn" type="button" (click)="removeConfirmed()">
              <mat-icon>delete</mat-icon>
              Eliminar
            </button>
          </footer>
        </section>
      </ng-template>

      @if (selectedTrafficLight(); as item) {
        <div class="traffic-map-modal-backdrop" (click)="closeTrafficLightMap()">
          <section class="traffic-map-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Semaforo en mapa">
            <header>
              <div>
                <span>Ubicacion del semaforo</span>
                <strong>{{ item.name }}</strong>
              </div>
              <button mat-icon-button type="button" aria-label="Cerrar mapa del semaforo" (click)="closeTrafficLightMap()">
                <mat-icon>close</mat-icon>
              </button>
            </header>

            <div #trafficLightMapContainer class="traffic-modal-map" aria-label="Mapa con ubicacion del semaforo"></div>
            <div class="korvi-map-controls" aria-label="Controles de zoom del mapa">
              <button
                mat-icon-button
                type="button"
                [class.active]="trafficLightMapHybridMode()"
                [title]="trafficLightMapHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                [attr.aria-label]="trafficLightMapHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                (click)="toggleTrafficLightMapHybridMode()">
                <mat-icon>{{ trafficLightMapHybridMode() ? 'map' : 'satellite' }}</mat-icon>
              </button>
              <button mat-icon-button type="button" title="Acercar mapa" aria-label="Acercar mapa" (click)="zoomTrafficLightMapIn()">
                <mat-icon>add</mat-icon>
              </button>
              <button mat-icon-button type="button" title="Alejar mapa" aria-label="Alejar mapa" (click)="zoomTrafficLightMapOut()">
                <mat-icon>remove</mat-icon>
              </button>
            </div>

            <footer>
              <div class="traffic-modal-details">
                <div>
                  <span>Estado</span>
                  <strong>{{ trafficLightStatusLabel(item.status) }}</strong>
                </div>
                <div>
                  <span>Origen</span>
                  <strong>{{ item.source === 'osm' ? 'OpenStreetMap' : item.source }}</strong>
                </div>
                <div>
                  <span>Ubicacion</span>
                  <strong>{{ item.province || 'Sin provincia' }} - {{ item.municipality || 'Sin municipio' }}</strong>
                </div>
                <div>
                  <span>Interseccion</span>
                  <strong>{{ item.intersection || 'Sin interseccion registrada' }}</strong>
                </div>
                <div>
                  <span>Coordenadas</span>
                  <strong>{{ item.latitude }}, {{ item.longitude }}</strong>
                </div>
              </div>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./admin-traffic-lights.component.css'],
})
export class AdminTrafficLightsComponent implements OnInit, OnDestroy {
  @ViewChild('trafficLightMapContainer') private readonly trafficLightMapContainer?: ElementRef<HTMLElement>;

  trafficLights = signal<TrafficLightItem[]>([]);
  selectedTrafficLight = signal<TrafficLightItem | null>(null);
  trafficLightMapHybridMode = signal(false);
  editingTrafficLight = signal<TrafficLightItem | null>(null);
  deletingTrafficLight = signal<TrafficLightItem | null>(null);
  totalTrafficLights = signal(0);
  settings = signal<TrafficLightsSettings>({
    overpassEndpoint: 'https://overpass-api.de/api/interpreter',
    defaultSouth: 18.35,
    defaultWest: -70.05,
    defaultNorth: 18.60,
    defaultEast: -69.75,
    defaultProvince: 'Santo Domingo',
    defaultMunicipality: 'Gran Santo Domingo',
    importProvinces: ['Santo Domingo'],
  });
  draft = signal<Partial<TrafficLightItem>>({
    name: '',
    latitude: 18.4861,
    longitude: -69.9312,
    province: 'Santo Domingo',
    municipality: 'Gran Santo Domingo',
    status: 'unknown',
  });
  editDraft = signal<Partial<TrafficLightItem>>({});
  replaceExisting = signal(false);
  importing = signal(false);
  locating = signal(false);
  refreshingLocations = signal(false);
  refreshLocationStatus = signal('');
  search = signal('');
  statusFilter = signal<TrafficLightStatus | 'ALL'>('ALL');
  pageIndex = signal(0);
  pageSize = signal(10);
  activeCount = computed(() => this.trafficLights().filter((item) => item.status === 'active').length);
  unknownCount = computed(() => this.trafficLights().filter((item) => item.status === 'unknown').length);
  offlineCount = computed(() => this.trafficLights().filter((item) => item.status === 'offline').length);
  groupedTrafficLights = computed(() => {
    const groups = new Map<string, TrafficLightItem[]>();
    this.trafficLights().forEach((item) => {
      const province = item.province?.trim() || 'Sin provincia';
      groups.set(province, [...(groups.get(province) ?? []), item]);
    });

    return Array.from(groups.entries()).map(([province, items]) => ({
      province,
      items,
    }));
  });
  private trafficLightMap?: MapTilerMap;
  private trafficLightMapMarker?: Marker;
  private trafficLightMapResizeObserver?: ResizeObserver;
  private refreshLocationsPollId?: ReturnType<typeof setInterval>;
  readonly provinceOptions = [
    'Azua',
    'Baoruco',
    'Barahona',
    'Dajabon',
    'Distrito Nacional',
    'Duarte',
    'El Seibo',
    'Elias Pina',
    'Espaillat',
    'Hato Mayor',
    'Hermanas Mirabal',
    'Independencia',
    'La Altagracia',
    'La Romana',
    'La Vega',
    'Maria Trinidad Sanchez',
    'Monsenor Nouel',
    'Monte Cristi',
    'Monte Plata',
    'Pedernales',
    'Peravia',
    'Puerto Plata',
    'Samana',
    'San Cristobal',
    'San Jose de Ocoa',
    'San Juan',
    'San Pedro de Macoris',
    'Sanchez Ramirez',
    'Santiago',
    'Santiago Rodriguez',
    'Santo Domingo',
    'Valverde',
  ];

  constructor(
    private readonly trafficLightsService: TrafficLightsService,
    private readonly toastr: ToastrService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.load();
    this.resumeRefreshLocationsJob();
  }

  ngOnDestroy(): void {
    this.destroyTrafficLightMap();
    this.stopRefreshLocationsPolling();
  }

  load() {
    this.trafficLightsService.settings().subscribe({
      next: (settings) => this.settings.set({ ...settings, importProvinces: this.normalizeProvinceSelection(settings.importProvinces ?? []) }),
    });
    this.trafficLightsService.list({
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      q: this.search().trim() || undefined,
      status: this.statusFilter() === 'ALL' ? undefined : this.statusFilter(),
    }).subscribe({
      next: (page) => {
        this.trafficLights.set(page.data);
        this.totalTrafficLights.set(page.total);
      },
      error: () => {
        this.trafficLights.set([]);
        this.totalTrafficLights.set(0);
      },
    });
  }

  openManualDialog(template: TemplateRef<unknown>) {
    this.dialog.open(template, {
      width: 'min(560px, calc(100vw - 2rem))',
      panelClass: 'traffic-light-dialog',
      autoFocus: false,
    });
  }

  closeManualDialog() {
    this.dialog.closeAll();
    this.editingTrafficLight.set(null);
  }

  confirmRemove(template: TemplateRef<unknown>, item: TrafficLightItem) {
    this.deletingTrafficLight.set(item);
    this.dialog.open(template, {
      width: 'min(420px, calc(100vw - 2rem))',
      panelClass: 'traffic-light-dialog',
      autoFocus: false,
    });
  }

  closeConfirmDelete() {
    this.deletingTrafficLight.set(null);
    this.dialog.closeAll();
  }

  openEditDialog(template: TemplateRef<unknown>, item: TrafficLightItem) {
    this.editingTrafficLight.set(item);
    this.editDraft.set({
      name: item.name,
      status: item.status,
      province: item.province ?? '',
      municipality: item.municipality ?? '',
      intersection: item.intersection ?? '',
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    });
    this.dialog.open(template, {
      width: 'min(640px, calc(100vw - 2rem))',
      panelClass: 'traffic-light-dialog',
      autoFocus: false,
    });
  }

  openTrafficLightMap(item: TrafficLightItem): void {
    this.selectedTrafficLight.set(item);
    window.setTimeout(() => this.renderSelectedTrafficLightMap(), 0);
  }

  closeTrafficLightMap(): void {
    this.selectedTrafficLight.set(null);
    this.destroyTrafficLightMap();
  }

  patchSettings(patch: Partial<TrafficLightsSettings>) {
    this.settings.set({
      ...this.settings(),
      ...patch,
      importProvinces: patch.importProvinces ? this.normalizeProvinceSelection(patch.importProvinces) : this.settings().importProvinces,
    });
  }

  saveSettings() {
    this.trafficLightsService.updateSettings(this.settings()).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.toastr.success('Configuracion de semaforos guardada.', 'Semaforos');
      },
      error: () => this.toastr.error('No se pudo guardar la configuracion.', 'Semaforos'),
    });
  }

  importOsm() {
    this.importing.set(true);
    const settings = this.settings();
    this.trafficLightsService.importFromOpenStreetMap({
      south: settings.defaultSouth,
      west: settings.defaultWest,
      north: settings.defaultNorth,
      east: settings.defaultEast,
      province: settings.defaultProvince,
      provinces: settings.importProvinces,
      municipality: settings.importProvinces.length ? undefined : settings.defaultMunicipality,
      replaceExisting: this.replaceExisting(),
    }).subscribe({
      next: (result) => {
        this.toastr.success(`${result.created} creados, ${result.updated} actualizados.`, 'Importacion OSM');
        this.importing.set(false);
        this.pageIndex.set(0);
        this.load();
      },
      error: (error) => {
        this.toastr.error(error?.error?.message || 'No se pudo importar desde OpenStreetMap.', 'Importacion OSM');
        this.importing.set(false);
      },
    });
  }

  refreshImportedLocationDetails() {
    this.refreshingLocations.set(true);
    this.refreshLocationStatus.set('Preparando actualizacion...');
    this.trafficLightsService.refreshLocationDetails({ source: 'osm', limit: 1000 }).subscribe({
      next: (response) => {
        this.applyRefreshLocationJob(response.job);
        this.toastr.info(
          response.accepted ? 'La actualizacion continuara en segundo plano.' : 'Ya hay una actualizacion en curso.',
          'Ubicaciones de semaforos',
        );
        this.startRefreshLocationsPolling();
      },
      error: (error) => {
        this.toastr.error(error?.error?.message || 'No se pudo actualizar la ubicacion de los semaforos.', 'Ubicaciones de semaforos');
        this.refreshingLocations.set(false);
        this.refreshLocationStatus.set('');
      },
    });
  }

  private startRefreshLocationsPolling() {
    this.stopRefreshLocationsPolling();
    this.refreshLocationsPollId = setInterval(() => {
      this.trafficLightsService.refreshLocationDetailsStatus().subscribe({
        next: (job) => {
          if (!job) {
            this.stopRefreshLocationsPolling();
            this.refreshingLocations.set(false);
            this.refreshLocationStatus.set('');
            return;
          }
          this.applyRefreshLocationJob(job);
        },
        error: () => {
          this.stopRefreshLocationsPolling();
          this.refreshingLocations.set(false);
          this.refreshLocationStatus.set('');
        },
      });
    }, 2500);
  }

  private stopRefreshLocationsPolling() {
    if (!this.refreshLocationsPollId) return;
    clearInterval(this.refreshLocationsPollId);
    this.refreshLocationsPollId = undefined;
  }

  private applyRefreshLocationJob(job: RefreshLocationDetailsJob) {
    const progress = job.progress;
    const total = progress.total || job.limit;
    this.refreshingLocations.set(job.status === 'queued' || job.status === 'running');

    if (job.status === 'completed') {
      this.refreshLocationStatus.set(`${progress.updated} actualizados, ${progress.skipped} sin cambios, ${progress.failed} fallidos.`);
      this.toastr.success(this.refreshLocationStatus(), 'Ubicaciones de semaforos');
      this.stopRefreshLocationsPolling();
      this.refreshingLocations.set(false);
      this.load();
      return;
    }

    if (job.status === 'failed') {
      this.refreshLocationStatus.set(job.error || 'La actualizacion fallo.');
      this.toastr.error(this.refreshLocationStatus(), 'Ubicaciones de semaforos');
      this.stopRefreshLocationsPolling();
      this.refreshingLocations.set(false);
      return;
    }

    this.refreshLocationStatus.set(`${progress.scanned}/${total} revisados - ${progress.updated} actualizados`);
  }

  private resumeRefreshLocationsJob() {
    this.trafficLightsService.refreshLocationDetailsStatus().subscribe({
      next: (job) => {
        if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
        this.applyRefreshLocationJob(job);
        this.startRefreshLocationsPolling();
      },
    });
  }

  updateDraft(patch: Partial<TrafficLightItem>) {
    this.draft.set({ ...this.draft(), ...patch });
  }

  updateEditDraft(patch: Partial<TrafficLightItem>) {
    this.editDraft.set({ ...this.editDraft(), ...patch });
  }

  useCurrentLocation(target: 'create' | 'edit') {
    if (!navigator.geolocation) {
      this.toastr.error('Este navegador no permite obtener la ubicacion actual.', 'GPS');
      return;
    }

    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(7));
        const longitude = Number(position.coords.longitude.toFixed(7));
        const basePatch: Partial<TrafficLightItem> = { latitude, longitude };

        try {
          const details = await this.fetchReverseGeocode(latitude, longitude);
          const patch = { ...basePatch, ...details };
          if (target === 'edit') {
            this.updateEditDraft(patch);
          } else {
            this.updateDraft(patch);
          }
          this.toastr.success('Ubicacion, provincia, municipio e interseccion actualizados.', 'GPS');
        } catch {
          if (target === 'edit') {
            this.updateEditDraft(basePatch);
          } else {
            this.updateDraft(basePatch);
          }
          this.toastr.warning('Coordenadas aplicadas. No se pudo detectar provincia, municipio e interseccion.', 'GPS');
        } finally {
          this.locating.set(false);
        }
      },
      () => {
        this.locating.set(false);
        this.toastr.error('No se pudo obtener la ubicacion. Verifica el permiso de GPS.', 'GPS');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async detectLocationFromCoordinates(target: 'create' | 'edit') {
    const draft = target === 'edit' ? this.editDraft() : this.draft();
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.toastr.error('Latitud y longitud validas son obligatorias.', 'Coordenadas');
      return;
    }

    this.locating.set(true);
    try {
      const details = await this.fetchReverseGeocode(latitude, longitude);
      if (target === 'edit') {
        this.updateEditDraft(details);
      } else {
        this.updateDraft(details);
      }
      this.toastr.success('Provincia, municipio e interseccion actualizados.', 'Coordenadas');
    } catch {
      this.toastr.error('No se pudo detectar la ubicacion con esas coordenadas.', 'Coordenadas');
    } finally {
      this.locating.set(false);
    }
  }

  createManual() {
    const draft = this.draft();
    if (!draft.name || !Number.isFinite(Number(draft.latitude)) || !Number.isFinite(Number(draft.longitude))) {
      this.toastr.error('Nombre, latitud y longitud son obligatorios.', 'Semaforos');
      return;
    }

    this.trafficLightsService.create({
      name: draft.name,
      latitude: Number(draft.latitude),
      longitude: Number(draft.longitude),
      province: draft.province || this.settings().defaultProvince,
      municipality: draft.municipality || this.settings().defaultMunicipality,
      intersection: draft.intersection,
      status: 'unknown',
    }).subscribe({
      next: () => {
        this.toastr.success('Semaforo creado.', 'Semaforos');
        this.draft.set({
          name: '',
          latitude: 18.4861,
          longitude: -69.9312,
          province: this.settings().defaultProvince,
          municipality: this.settings().defaultMunicipality,
          status: 'unknown',
        });
        this.closeManualDialog();
        this.pageIndex.set(0);
        this.load();
      },
      error: () => this.toastr.error('No se pudo crear el semaforo.', 'Semaforos'),
    });
  }

  updateStatus(item: TrafficLightItem, status: TrafficLightStatus) {
    this.trafficLightsService.update(item.id, { status }).subscribe({
      next: (updated) => {
        this.trafficLights.set(this.trafficLights().map((trafficLight) => (trafficLight.id === updated.id ? updated : trafficLight)));
        this.toastr.success('Estado actualizado.', 'Semaforos');
      },
      error: () => this.toastr.error('No se pudo actualizar el estado.', 'Semaforos'),
    });
  }

  saveEdit() {
    const item = this.editingTrafficLight();
    const draft = this.editDraft();
    if (!item || !draft.name || !Number.isFinite(Number(draft.latitude)) || !Number.isFinite(Number(draft.longitude))) {
      this.toastr.error('Nombre, latitud y longitud son obligatorios.', 'Semaforos');
      return;
    }

    this.trafficLightsService.update(item.id, {
      name: draft.name,
      status: draft.status,
      province: draft.province,
      municipality: draft.municipality,
      intersection: draft.intersection,
      latitude: Number(draft.latitude),
      longitude: Number(draft.longitude),
    }).subscribe({
      next: (updated) => {
        this.trafficLights.set(this.trafficLights().map((trafficLight) => (trafficLight.id === updated.id ? updated : trafficLight)));
        this.toastr.success('Semaforo actualizado.', 'Semaforos');
        this.closeManualDialog();
      },
      error: () => this.toastr.error('No se pudo actualizar el semaforo.', 'Semaforos'),
    });
  }

  removeConfirmed() {
    const item = this.deletingTrafficLight();
    if (!item) return;
    this.trafficLightsService.remove(item.id).subscribe({
      next: () => {
        this.trafficLights.set(this.trafficLights().filter((trafficLight) => trafficLight.id !== item.id));
        this.totalTrafficLights.update((total) => Math.max(0, total - 1));
        this.toastr.success('Semaforo eliminado.', 'Semaforos');
        this.closeConfirmDelete();
        if (!this.trafficLights().length && this.pageIndex() > 0) {
          this.pageIndex.update((page) => Math.max(0, page - 1));
          this.load();
        }
      },
      error: () => this.toastr.error('No se pudo eliminar el semaforo.', 'Semaforos'),
    });
  }

  numberValue(value: string | number, fallback: number): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
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

  trafficLightStatusLabel(status: TrafficLightStatus): string {
    const labels: Record<TrafficLightStatus, string> = {
      active: 'Activo',
      unknown: 'Sin verificar',
      offline: 'Apagado',
    };
    return labels[status] ?? status;
  }

  private renderSelectedTrafficLightMap(): void {
    const item = this.selectedTrafficLight();
    const container = this.trafficLightMapContainer?.nativeElement;
    if (!item || !container) return;

    this.destroyTrafficLightMap();

    const center = { latitude: Number(item.latitude), longitude: Number(item.longitude) };
    this.trafficLightMap = createKorviMap(container, {
      center,
      zoom: 17,
      navigationControl: false,
      scrollZoom: true,
    });

    this.trafficLightMapMarker = new Marker({ element: this.createTrafficLightMapPin(), anchor: 'bottom' })
      .setLngLat(toLngLat(center))
      .addTo(this.trafficLightMap);

    this.trafficLightMapResizeObserver = observeMapResize(this.trafficLightMap, container);
    scheduleMapResize(this.trafficLightMap, container);
  }

  toggleTrafficLightMapHybridMode(): void {
    if (!this.trafficLightMap) return;
    const mode = toggleKorviMapMode(this.trafficLightMap, () => {
      if (this.trafficLightMap && this.trafficLightMapContainer?.nativeElement) {
        scheduleMapResize(this.trafficLightMap, this.trafficLightMapContainer.nativeElement);
      }
    });
    this.trafficLightMapHybridMode.set(mode === 'hybrid');
  }

  zoomTrafficLightMapIn(): void {
    this.trafficLightMap?.zoomIn();
  }

  zoomTrafficLightMapOut(): void {
    this.trafficLightMap?.zoomOut();
  }

  private destroyTrafficLightMap(): void {
    this.trafficLightMapResizeObserver?.disconnect();
    this.trafficLightMapResizeObserver = undefined;
    this.trafficLightMapMarker?.remove();
    this.trafficLightMapMarker = undefined;
    this.trafficLightMap?.remove();
    this.trafficLightMap = undefined;
    this.trafficLightMapHybridMode.set(false);
  }

  private createTrafficLightMapPin(): HTMLElement {
    const marker = document.createElement('span');
    marker.className = 'traffic-light-map-pin';

    const icon = document.createElement('mat-icon');
    icon.className = 'mat-icon material-icons';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'traffic';

    marker.appendChild(icon);
    return marker;
  }

  private normalizeProvinceSelection(provinces: string[]): string[] {
    return Array.from(new Set((provinces ?? []).filter((province) => this.provinceOptions.includes(province))));
  }

  private async fetchReverseGeocode(latitude: number, longitude: number): Promise<TrafficLightLocationDetails> {
    const details = await reverseGeocodeKorviLocation(latitude, longitude);
    return this.extractLocationDetails(details, latitude, longitude);
  }

  private extractLocationDetails(details: ReverseGeocodeDetails, latitude: number, longitude: number): TrafficLightLocationDetails {
    const province = this.normalizeProvince(details.province);
    const municipality = this.cleanAdministrativeName(details.municipality);
    const normalized = this.normalizeDominicanLocation(latitude, longitude, { province, municipality });

    return {
      province: normalized.province,
      municipality: normalized.municipality,
      intersection: this.cleanIntersection(details.address),
    };
  }

  private normalizeDominicanLocation(latitude: number, longitude: number, details: TrafficLightLocationDetails): TrafficLightLocationDetails {
    const inferredMunicipality = this.inferMunicipalityFromCoordinates(latitude, longitude);
    if (inferredMunicipality) {
      return {
        ...details,
        province: inferredMunicipality === 'Santo Domingo de Guzman' ? 'Distrito Nacional' : 'Santo Domingo',
        municipality: inferredMunicipality,
      };
    }
    if (details.municipality === 'Santo Domingo Este') {
      return { ...details, province: 'Santo Domingo' };
    }
    return details;
  }

  private inferMunicipalityFromCoordinates(latitude: number, longitude: number): string | null {
    if (latitude >= 18.42 && latitude <= 18.60 && longitude >= -69.92 && longitude <= -69.72) return 'Santo Domingo Este';
    if (latitude >= 18.48 && latitude <= 18.66 && longitude >= -70.05 && longitude < -69.88) return 'Santo Domingo Norte';
    if (latitude >= 18.38 && latitude <= 18.56 && longitude >= -70.10 && longitude < -69.98) return 'Santo Domingo Oeste';
    if (latitude >= 18.40 && latitude <= 18.52 && longitude >= -69.99 && longitude <= -69.86) return 'Santo Domingo de Guzman';
    if (latitude >= 18.37 && latitude <= 18.56 && longitude >= -70.15 && longitude < -70.03) return 'Los Alcarrizos';
    if (latitude >= 18.35 && latitude <= 18.50 && longitude >= -69.72 && longitude <= -69.55) return 'Boca Chica';
    if (latitude >= 18.45 && latitude <= 18.68 && longitude >= -69.78 && longitude <= -69.55) return 'San Antonio de Guerra';
    return null;
  }

  private normalizeProvince(value: string | undefined): string {
    const clean = this.cleanAdministrativeName(value);
    const normalized = this.normalizeText(clean);
    return this.provinceOptions.find((province) => this.normalizeText(province) === normalized) ?? clean;
  }

  private cleanIntersection(value: string | undefined): string {
    if (!value) return '';
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !['Republica Dominicana', 'Republica Dominicana'].includes(this.removeDiacritics(part)))
      .slice(0, 3)
      .join(', ');
  }

  private cleanAdministrativeName(value: string | undefined): string {
    return (value ?? '')
      .replace(/^Provincia\s+/i, '')
      .replace(/^Municipio\s+/i, '')
      .trim();
  }

  private normalizeText(value: string | undefined): string {
    return this.removeDiacritics(value ?? '').toLowerCase().trim();
  }

  private removeDiacritics(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

