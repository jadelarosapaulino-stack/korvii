import { NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Map as MapTilerMap, Marker, Popup, type MapMouseEvent } from '@maptiler/sdk';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { LatLngPoint, ReverseGeocodeDetails, applyKorviMapTheme, circlePolygon, createKorviMap, mapReady, metersBetween, observeMapResize, reverseGeocodeKorviLocation, scheduleMapResize, toLngLat, toggleKorviMapMode } from '../../core/map.config';
import { InstitutionOption, ReportCategory, ReportMapPoint, ReportsService, reportCategoryLabel } from '../../core/reports.service';
import { ReportCategoryConfig, SystemConfigService } from '../../core/system-config.service';
import { RiskChipComponent } from '../../shared/ui/risk-chip/risk-chip.component';

interface PhotoPreview {
  file: File;
  url: string;
}

interface CategoryDraftSuggestion {
  title: string;
  description: string;
}

type LocationDetails = ReverseGeocodeDetails;

const MUNICIPALITIES_BY_PROVINCE: Record<string, string[]> = {
  'Azua': ['Azua de Compostela', 'Estebania', 'Guayabal', 'Las Charcas', 'Las Yayas de Viajama', 'Padre Las Casas', 'Peralta', 'Pueblo Viejo', 'Sabana Yegua', 'Tabara Arriba'],
  'Baoruco': ['Neiba', 'Galvan', 'Los Rios', 'Tamayo', 'Villa Jaragua'],
  'Barahona': ['Santa Cruz de Barahona', 'Cabral', 'El Penon', 'Enriquillo', 'Fundacion', 'Jaquimeyes', 'La Cienaga', 'Las Salinas', 'Paraiso', 'Polo', 'Vicente Noble'],
  'Dajabon': ['Dajabon', 'El Pino', 'Loma de Cabrera', 'Partido', 'Restauracion'],
  'Distrito Nacional': ['Santo Domingo de Guzman'],
  'Duarte': ['San Francisco de Macoris', 'Arenoso', 'Castillo', 'Eugenio Maria de Hostos', 'Las Guaranas', 'Pimentel', 'Villa Riva'],
  'El Seibo': ['Santa Cruz de El Seibo', 'Miches'],
  'Elias Pina': ['Comendador', 'Banica', 'El Llano', 'Hondo Valle', 'Juan Santiago', 'Pedro Santana'],
  'Espaillat': ['Moca', 'Cayetano Germosen', 'Gaspar Hernandez', 'Jamao al Norte'],
  'Hato Mayor': ['Hato Mayor del Rey', 'El Valle', 'Sabana de la Mar'],
  'Hermanas Mirabal': ['Salcedo', 'Tenares', 'Villa Tapia'],
  'Independencia': ['Jimani', 'Cristobal', 'Duverge', 'La Descubierta', 'Mella', 'Postrer Rio'],
  'La Altagracia': ['Higuey', 'San Rafael del Yuma'],
  'La Romana': ['La Romana', 'Guaymate', 'Villa Hermosa'],
  'La Vega': ['La Vega', 'Constanza', 'Jarabacoa', 'Jima Abajo'],
  'Maria Trinidad Sanchez': ['Nagua', 'Cabrera', 'El Factor', 'Rio San Juan'],
  'Monsenor Nouel': ['Bonao', 'Maimon', 'Piedra Blanca'],
  'Monte Cristi': ['Monte Cristi', 'Castanuelas', 'Guayubin', 'Las Matas de Santa Cruz', 'Pepillo Salcedo', 'Villa Vasquez'],
  'Monte Plata': ['Monte Plata', 'Bayaguana', 'Peralvillo', 'Sabana Grande de Boya', 'Yamasa'],
  'Pedernales': ['Pedernales', 'Oviedo'],
  'Peravia': ['Bani', 'Nizao'],
  'Puerto Plata': ['Puerto Plata', 'Altamira', 'Guananico', 'Imbert', 'Los Hidalgos', 'Luperon', 'Sosua', 'Villa Isabela', 'Villa Montellano'],
  'Samana': ['Santa Barbara de Samana', 'Las Terrenas', 'Sanchez'],
  'San Cristobal': ['San Cristobal', 'Bajos de Haina', 'Cambita Garabitos', 'Los Cacaos', 'Sabana Grande de Palenque', 'San Gregorio de Nigua', 'Villa Altagracia', 'Yaguate'],
  'San Jose de Ocoa': ['San Jose de Ocoa', 'Rancho Arriba', 'Sabana Larga'],
  'San Juan': ['San Juan de la Maguana', 'Bohechio', 'El Cercado', 'Juan de Herrera', 'Las Matas de Farfan', 'Vallejuelo'],
  'San Pedro de Macoris': ['San Pedro de Macoris', 'Consuelo', 'Guayacanes', 'Quisqueya', 'Ramon Santana', 'San Jose de Los Llanos'],
  'Sanchez Ramirez': ['Cotui', 'Cevicos', 'Fantino', 'La Mata'],
  'Santiago': ['Santiago de los Caballeros', 'Bisono', 'Janico', 'Licey al Medio', 'Punal', 'Sabana Iglesia', 'San Jose de las Matas', 'Tamboril', 'Villa Gonzalez'],
  'Santiago Rodriguez': ['San Ignacio de Sabaneta', 'Los Almacigos', 'Moncion'],
  'Santo Domingo': ['Santo Domingo Este', 'Santo Domingo Norte', 'Santo Domingo Oeste', 'Boca Chica', 'Los Alcarrizos', 'Pedro Brand', 'San Antonio de Guerra'],
  'Valverde': ['Mao', 'Esperanza', 'Laguna Salada'],
};

@Component({
  selector: 'app-report-create',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    RiskChipComponent,
  ],
  template: `
    <section class="incident-page">
      <header class="incident-header">
        <div>
          <span class="rs-eyebrow">Registro operativo</span>
          <h1>Nuevo incidente vial</h1>
          <p>Captura estructurada para activar validación institucional, mapa de riesgo y evidencia ciudadana.</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="requestUserLocation()" [disabled]="locating()">
          <mat-icon>my_location</mat-icon>
          {{ locating() ? 'Ubicando' : 'Usar mi ubicación' }}
        </button>
      </header>

      <section class="incident-layout">
        <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()">
          <mat-card class="form-panel">
            <div class="panel-heading">
              <span>01</span>
              <div>
                <strong>Incidente</strong>
                <small>Clasificación, título y contexto operativo.</small>
              </div>
            </div>

            <div class="field-grid two">
              <mat-form-field appearance="outline">
                <mat-label>Título</mat-label>
                <input matInput formControlName="title" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Categoría</mat-label>
                <mat-select formControlName="category">
                  <mat-option value="ACCIDENT">Accidente</mat-option>
                  <mat-option value="TRAFFIC_LIGHT_DAMAGED">Semáforo dañado</mat-option>
                  <mat-option value="ROAD_DAMAGE">Vía en mal estado</mat-option>
                  <mat-option value="ROAD_OBSTRUCTION">Obstrucción en la vía</mat-option>
                  <mat-option value="POOR_LIGHTING">Falta de iluminación</mat-option>
                  <mat-option value="MISSING_SIGNAGE">Falta de señalización</mat-option>
                  <mat-option value="RECKLESS_DRIVING">Conducción imprudente</mat-option>
                  <mat-option value="DANGEROUS_CROSSING">Cruce peligroso</mat-option>
                  <mat-option value="FLOOD_ZONE">Zona de posible inundacion</mat-option>
                  <mat-option value="OTHER">Otro</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Descripción</mat-label>
              <textarea matInput formControlName="description" rows="4"></textarea>
            </mat-form-field>
          </mat-card>

          <mat-card class="form-panel">
            <div class="panel-heading">
              <span>02</span>
              <div>
                <strong>Ubicación y severidad</strong>
                <small>La ubicación del dispositivo es obligatoria.</small>
              </div>
            </div>

            <div class="location-card" [class.ready]="hasUserLocation()">
              <mat-icon>{{ hasUserLocation() ? 'gps_fixed' : 'gps_not_fixed' }}</mat-icon>
              <div>
                <strong>{{ hasUserLocation() ? 'Ubicación confirmada' : 'Ubicación requerida' }}</strong>
                <span>{{ locationMessage() }}</span>
              </div>
              <button mat-stroked-button type="button" (click)="requestUserLocation()" [disabled]="locating()">
                Usar GPS
              </button>
            </div>

            <div class="field-grid three">
              <mat-form-field appearance="outline">
                <mat-label>Latitud</mat-label>
                <input matInput type="number" step="0.0000001" formControlName="latitude" readonly />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Longitud</mat-label>
                <input matInput type="number" step="0.0000001" formControlName="longitude" readonly />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Riesgo sugerido 1-5</mat-label>
                <input matInput type="number" min="1" max="5" formControlName="riskLevel" (input)="markRiskAsManuallyAdjusted()" />
              </mat-form-field>
            </div>

            <div class="risk-auto-card">
              <mat-icon>auto_awesome</mat-icon>
              <div>
                <strong>Clasificacion sugerida</strong>
                <span>{{ autoRiskReason() }}</span>
              </div>
            </div>

            <div class="field-grid two">
              <mat-form-field appearance="outline">
                <mat-label>Provincia</mat-label>
                <mat-select formControlName="province" (selectionChange)="onProvinceChange($event.value)">
                  @for (province of provinceOptions; track province) {
                    <mat-option [value]="province">{{ province }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Municipio</mat-label>
                <mat-select formControlName="municipality">
                  @for (municipality of municipalityOptions(); track municipality) {
                    <mat-option [value]="municipality">{{ municipality }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Calle o referencia</mat-label>
              <input matInput formControlName="address" />
            </mat-form-field>
          </mat-card>

          <mat-card class="form-panel">
            <div class="panel-heading">
              <span>03</span>
              <div>
                <strong>Autoridad responsable</strong>
                <small>Menciona la institucion que podria atender la solucion.</small>
              </div>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Autoridad a mencionar</mat-label>
              <mat-select formControlName="assignedInstitutionId">
                <mat-option value="">Sin mencionar autoridad</mat-option>
                @for (institution of institutions(); track institution.id) {
                  <mat-option [value]="institution.id">
                    {{ institution.name }}{{ institution.municipality ? ' · ' + institution.municipality : '' }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="authority-hint">
              <mat-icon>alternate_email</mat-icon>
              <span>{{ selectedInstitutionLabel() }}</span>
            </div>
          </mat-card>

          <mat-card class="form-panel">
            <div class="panel-heading">
              <span>04</span>
              <div>
                <strong>Evidencia</strong>
                <small>Imágenes de cámara o archivos locales, hasta 5 evidencias.</small>
              </div>
            </div>

            <input #cameraInput class="file-input" type="file" accept="image/*" capture="environment" (change)="addPhotos($event)" />
            <input #fileInput class="file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple (change)="addPhotos($event)" />

            <div class="evidence-toolbar">
              <button mat-stroked-button type="button" (click)="cameraInput.click()">
                <mat-icon>photo_camera</mat-icon>
                Cámara
              </button>
              <button mat-stroked-button type="button" (click)="fileInput.click()">
                <mat-icon>upload_file</mat-icon>
                Cargar imágenes
              </button>
              <span>{{ selectedPhotos().length }}/5 adjuntas</span>
            </div>

            <div class="photo-grid" *ngIf="selectedPhotos().length">
              <figure class="photo-preview" *ngFor="let photo of selectedPhotos(); let index = index">
                <img [src]="photo.url" [alt]="'Evidencia ' + (index + 1)" />
                <button mat-icon-button type="button" [attr.aria-label]="'Quitar evidencia ' + (index + 1)" (click)="removePhoto(index)">
                  <mat-icon>close</mat-icon>
                </button>
              </figure>
            </div>
          </mat-card>

          <div class="submit-bar">
            <div class="image-verification-status" *ngIf="imageVerificationStatus()">
              <mat-icon>{{ loading() ? 'policy' : 'verified' }}</mat-icon>
              <span>{{ imageVerificationStatus() }}</span>
            </div>
            <button mat-button type="button" (click)="requestUserLocation()" [disabled]="locating()">Actualizar ubicación</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || !hasUserLocation() || loading()">
              <mat-icon>send</mat-icon>
              {{ loading() ? 'Verificando...' : 'Crear reporte' }}
            </button>
          </div>
        </form>

        <aside class="summary-panel">
          <mat-card class="summary-card">
            <div class="summary-map">
              <div #previewMapContainer class="summary-maptiler" aria-label="Ubicación marcada del incidente"></div>
              <button
                class="map-mode-button"
                mat-icon-button
                type="button"
                [class.active]="previewHybridMode()"
                [title]="previewHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                [attr.aria-label]="previewHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                (click)="togglePreviewHybridMode()">
                <mat-icon>{{ previewHybridMode() ? 'map' : 'satellite' }}</mat-icon>
              </button>
              <button class="expand-map-button" mat-stroked-button type="button" (click)="openLocationMapModal()">
                <mat-icon>open_in_full</mat-icon>
                Ampliar mapa
              </button>
              <div class="map-hint">
                <mat-icon>touch_app</mat-icon>
                <span>{{ nearbyReports().length }} reportes a 500 m - Haz clic o arrastra el marcador</span>
              </div>
            </div>

            <div class="summary-body">
              <span class="rs-eyebrow">Vista previa</span>
              <h2>{{ form.controls.title.value }}</h2>
              <p>{{ form.controls.province.value }} · {{ form.controls.municipality.value }}</p>

              <div class="summary-chips">
                <mat-chip>{{ categoryLabel(form.controls.category.value) }}</mat-chip>
                <app-risk-chip [level]="riskLevel()" />
              </div>

              <div class="summary-metrics">
                <div>
                  <span>Ubicación</span>
                  <strong>{{ hasUserLocation() ? 'Confirmada' : 'Pendiente' }}</strong>
                </div>
                <div>
                  <span>Precisión</span>
                  <strong>{{ locationAccuracy() ? (locationAccuracy() + ' m') : (hasUserLocation() ? 'Manual' : 'Pendiente') }}</strong>
                </div>
                <div>
                  <span>Autoridad</span>
                  <strong>{{ selectedInstitutionName() }}</strong>
                </div>
                <div>
                  <span>Evidencias</span>
                  <strong>{{ selectedPhotos().length }}</strong>
                </div>
                <div>
                  <span>Reportes cercanos</span>
                  <strong>{{ nearbyReports().length }}</strong>
                </div>
              </div>

              @if (nearbyReports().length) {
                <div class="nearby-reports">
                  <strong>Reportes a 500 m</strong>
                  @for (report of nearbyReports().slice(0, 4); track report.id) {
                    <button type="button" (click)="focusNearbyReport(report)">
                      <span>{{ report.title }}</span>
                      <small>{{ categoryLabel(report.category) }} - Riesgo {{ report.riskLevel }}/5</small>
                    </button>
                  }
                </div>
              }
            </div>
          </mat-card>
        </aside>
      </section>

      @if (emergencyPromptOpen()) {
        <div class="emergency-modal-backdrop" (click)="closeEmergencyPrompt()">
          <section class="emergency-modal" (click)="$event.stopPropagation()">
            <header>
              <mat-icon>emergency</mat-icon>
              <div>
                <span>Atención inmediata</span>
                <strong>Esta categoría puede requerir organismos de emergencia</strong>
              </div>
            </header>

            <div class="emergency-body">
              <p>{{ emergencyCategoryConfig()?.emergencyInstructions }}</p>
              <div class="emergency-location">
                <strong>Dirección y ubicación actual</strong>
                <span>{{ emergencyLocationDetails() }}</span>
              </div>
              <div class="emergency-report">
                <span>{{ form.controls.title.value }}</span>
                <small>{{ categoryLabel(form.controls.category.value) }} · Riesgo {{ riskLevel() }}/5</small>
              </div>
            </div>

            <footer>
              <button mat-stroked-button type="button" (click)="closeEmergencyPrompt()">Continuar sin llamar</button>
              <a mat-flat-button color="primary" href="tel:911" (click)="recordEmergencyCall()">
                <mat-icon>call</mat-icon>
                Llamar 911
              </a>
            </footer>
          </section>
        </div>
      }

      @if (locationMapModalOpen()) {
        <div class="location-modal-backdrop" (click)="closeLocationMapModal()">
          <section class="location-modal" (click)="$event.stopPropagation()">
            <header>
              <div>
              <span>Selección de ubicación</span>
                <strong>Marca el punto exacto del incidente</strong>
              </div>
              <button mat-icon-button type="button" aria-label="Cerrar mapa ampliado" (click)="closeLocationMapModal()">
                <mat-icon>close</mat-icon>
              </button>
            </header>

            <div #modalMapContainer class="location-modal-map" aria-label="Mapa ampliado para seleccionar ubicación"></div>

            <footer>
              <button
                class="map-mode-button modal-mode-button"
                mat-icon-button
                type="button"
                [class.active]="modalHybridMode()"
                [title]="modalHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                [attr.aria-label]="modalHybridMode() ? 'Ver mapa estandar' : 'Ver mapa hibrido'"
                (click)="toggleModalHybridMode()">
                <mat-icon>{{ modalHybridMode() ? 'map' : 'satellite' }}</mat-icon>
              </button>
              <div class="location-modal-details">
                <div>
                  <span>Coordenadas</span>
                  <strong>{{ modalLocationLabel() }}</strong>
                </div>
                <div>
                  <span>Origen</span>
                  <strong>{{ modalLocationSource() }}</strong>
                </div>
                <div>
                  <span>Precision</span>
                  <strong>{{ locationAccuracy() ? (locationAccuracy() + ' m') : 'Manual' }}</strong>
                </div>
                <div>
                  <span>Zona</span>
                  <strong>{{ form.controls.province.value || 'Sin provincia' }} · {{ form.controls.municipality.value || 'Sin municipio' }}</strong>
                </div>
                <div>
                  <span>Reportes cercanos</span>
                  <strong>{{ nearbyReports().length }} en 500 m</strong>
                </div>
                <p>Haz clic en el mapa o arrastra el marcador para ajustar el punto.</p>
              </div>
              <button mat-stroked-button type="button" (click)="requestUserLocation()" [disabled]="locating()">
                <mat-icon>my_location</mat-icon>
                Usar GPS
              </button>
              <button mat-flat-button color="primary" type="button" (click)="confirmLocationMapModal()">
                <mat-icon>check</mat-icon>
                Confirmar ubicación
              </button>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./report-create.component.css'],
})
export class ReportCreateComponent implements OnInit, OnDestroy {
  @ViewChild('previewMapContainer', { static: true }) private readonly previewMapContainer?: ElementRef<HTMLElement>;
  @ViewChild('modalMapContainer') private readonly modalMapContainer?: ElementRef<HTMLElement>;

  loading = signal(false);
  locating = signal(false);
  hasUserLocation = signal(false);
  locationAccuracy = signal<number | null>(null);
  locationMessage = signal('Permite el acceso a tu ubicación para completar el reporte.');
  autoRiskReason = signal('Calculado según la categoría y la descripción del incidente.');
  locationMapModalOpen = signal(false);
  modalLocationLabel = signal('Ubicacion pendiente');
  modalLocationSource = signal('Pendiente');
  imageVerificationStatus = signal<string | null>(null);
  previewHybridMode = signal(false);
  modalHybridMode = signal(false);
  selectedPhotos = signal<PhotoPreview[]>([]);
  institutions = signal<InstitutionOption[]>([]);
  nearbyReports = signal<ReportMapPoint[]>([]);
  emergencyPromptOpen = signal(false);
  emergencyCategoryConfig = signal<ReportCategoryConfig | null>(null);
  private previewMap?: MapTilerMap;
  private previewMarker?: Marker;
  private modalMap?: MapTilerMap;
  private modalMarker?: Marker;
  private previewResizeObserver?: ResizeObserver;
  private modalResizeObserver?: ResizeObserver;
  private readonly themeChangeHandler = () => this.applyMapTheme();
  private riskSubscription?: Subscription;
  private institutionLookupSubscription?: Subscription;
  private existingReports: ReportMapPoint[] = [];
  private readonly nearbyRadiusMeters = 500;
  private readonly nearbyRadiusSourceId = 'nearby-reports-radius';
  private readonly nearbyRadiusFillLayerId = 'nearby-reports-radius-fill';
  private readonly nearbyRadiusLineLayerId = 'nearby-reports-radius-line';
  private readonly nearbyReportsSourceId = 'nearby-reports-points';
  private readonly nearbyReportsCircleLayerId = 'nearby-reports-points-circle';
  private readonly nearbyReportsLabelLayerId = 'nearby-reports-points-label';
  private previewNearbyLayerEventsRegistered = false;
  private modalNearbyLayerEventsRegistered = false;
  private riskManuallyAdjusted = false;
  private lastSuggestedRiskLevel = 4;
  private categorySuggestionSubscription?: Subscription;
  private titleManuallyAdjusted = false;
  private descriptionManuallyAdjusted = false;
  private applyingCategorySuggestion = false;

  readonly provinceOptions = Object.keys(MUNICIPALITIES_BY_PROVINCE);
  private readonly defaultReportCategory: ReportCategory = 'TRAFFIC_LIGHT_DAMAGED';
  private readonly categoryDraftSuggestions: Record<ReportCategory, CategoryDraftSuggestion> = {
    ACCIDENT: {
      title: 'Accidente de tránsito reportado',
      description: 'Se reporta un accidente de tránsito que puede afectar la circulación y representar riesgo para conductores, motociclistas o peatones.',
    },
    TRAFFIC_LIGHT_DAMAGED: {
      title: 'Semáforo dañado en intersección principal',
      description: 'El semáforo no funciona correctamente y genera riesgo para conductores, motociclistas y peatones en la intersección.',
    },
    ROAD_DAMAGE: {
      title: 'Vía en mal estado',
      description: 'La vía presenta hoyos, grietas o deterioro que puede provocar maniobras peligrosas, daños a vehículos o accidentes.',
    },
    ROAD_OBSTRUCTION: {
      title: 'Obstrucción en la vía',
      description: 'Hay escombros, basura, objetos caídos u otro elemento inusual que bloquea o reduce la movilidad en la ruta.',
    },
    POOR_LIGHTING: {
      title: 'Zona con poca iluminación',
      description: 'El tramo tiene iluminación insuficiente durante la noche, reduciendo la visibilidad y aumentando el riesgo para usuarios de la vía.',
    },
    MISSING_SIGNAGE: {
      title: 'Señalización ausente o deteriorada',
      description: 'Falta señalización vial o la existente está deteriorada, lo que puede generar confusión y maniobras inseguras.',
    },
    RECKLESS_DRIVING: {
      title: 'Conducción imprudente frecuente',
      description: 'Se observa conducción imprudente en la zona, como exceso de velocidad, rebases peligrosos o irrespeto a señales de tránsito.',
    },
    DANGEROUS_CROSSING: {
      title: 'Cruce peligroso para peatones',
      description: 'El cruce representa riesgo para peatones y conductores por falta de control, visibilidad limitada o alto flujo vehicular.',
    },
    FLOOD_ZONE: {
      title: 'Zona de posible inundacion',
      description: 'Se reporta acumulacion de agua o posible inundacion en la via. Evita transitar por este tramo hasta que sea validado o resuelto.',
    },
    OTHER: {
      title: 'Riesgo vial reportado',
      description: 'Describe el riesgo vial observado, indicando cómo afecta la seguridad de peatones, conductores o motociclistas.',
    },
  };

  form = this.fb.group({
    title: ['Semáforo dañado en intersección principal', Validators.required],
    category: [this.defaultReportCategory, Validators.required],
    description: ['El semáforo no funciona y genera riesgo para motociclistas y peatones.', Validators.required],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
    province: [''],
    municipality: [''],
    address: [''],
    riskLevel: [4, [Validators.required, Validators.min(1), Validators.max(5)]],
    assignedInstitutionId: [''],
  });
  private reverseGeocodeRequestId = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly reports: ReportsService,
    private readonly router: Router,
    private readonly toastr: ToastrService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  ngOnInit() {
    this.applyCategoryDraftSuggestion(this.defaultReportCategory);
    this.configureCategoryDraftSuggestions();
    this.configureAutomaticRisk();
    this.configureInstitutionLookup();
    this.initPreviewMap();
    this.loadExistingReportsForValidation();
    this.requestUserLocation();
    window.addEventListener('rs-theme-change', this.themeChangeHandler);
    window.addEventListener('rs-map-config-change', this.themeChangeHandler);
  }

  ngOnDestroy() {
    window.removeEventListener('rs-theme-change', this.themeChangeHandler);
    window.removeEventListener('rs-map-config-change', this.themeChangeHandler);
    this.categorySuggestionSubscription?.unsubscribe();
    this.riskSubscription?.unsubscribe();
    this.institutionLookupSubscription?.unsubscribe();
    this.selectedPhotos().forEach((photo) => URL.revokeObjectURL(photo.url));
    this.previewResizeObserver?.disconnect();
    this.modalResizeObserver?.disconnect();
    this.previewMap?.remove();
    this.modalMap?.remove();
  }

  private applyMapTheme() {
    this.previewNearbyLayerEventsRegistered = false;
    this.modalNearbyLayerEventsRegistered = false;

    applyKorviMapTheme(this.previewMap, () => {
      this.renderNearbyValidationOnMap(this.previewMap);
      this.resizeMap(this.previewMap);
    });
    applyKorviMapTheme(this.modalMap, () => {
      this.renderNearbyValidationOnMap(this.modalMap);
      this.resizeMap(this.modalMap);
    });
  }

  requestUserLocation() {
    if (!navigator.geolocation) {
      this.hasUserLocation.set(false);
      this.locationMessage.set('Este navegador no soporta geolocalización.');
      this.toastr.error('Este navegador no soporta geolocalización.', 'Ubicación requerida');
      return;
    }

    this.locating.set(true);
    this.locationMessage.set('Solicitando ubicación del dispositivo...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(7));
        const longitude = Number(position.coords.longitude.toFixed(7));
        const accuracy = Math.round(position.coords.accuracy);

        this.setReportLocation(latitude, longitude, accuracy, 'device');
        this.locating.set(false);
      },
      () => {
        this.hasUserLocation.set(false);
        this.locationAccuracy.set(null);
        this.locationMessage.set('Activa el permiso de ubicación del navegador para poder enviar el reporte.');
        this.locating.set(false);
        this.toastr.error('La ubicación es obligatoria para crear un reporte.', 'Ubicación requerida');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  togglePreviewHybridMode() {
    this.previewNearbyLayerEventsRegistered = false;
    const mode = toggleKorviMapMode(this.previewMap, () => {
      this.renderNearbyValidationOnMap(this.previewMap);
      this.resizeMap(this.previewMap);
    });
    this.previewHybridMode.set(mode === 'hybrid');
  }

  toggleModalHybridMode() {
    this.modalNearbyLayerEventsRegistered = false;
    const mode = toggleKorviMapMode(this.modalMap, () => {
      this.renderNearbyValidationOnMap(this.modalMap);
      this.resizeMap(this.modalMap);
    });
    this.modalHybridMode.set(mode === 'hybrid');
  }

  submit() {
    if (this.form.invalid || !this.hasUserLocation()) {
      this.toastr.error('Debes seleccionar la ubicación del reporte antes de enviar.', 'Ubicación requerida');
      return;
    }

    this.loading.set(true);
    this.imageVerificationStatus.set(
      this.selectedPhotos().length
        ? 'Verificando imagenes antes de guardar el reporte...'
        : 'Sin imagenes adjuntas. Guardando el reporte...',
    );
    this.reports.create(this.buildPayload()).subscribe({
      next: (result) => {
        this.imageVerificationStatus.set(
          this.selectedPhotos().length
            ? 'Imagenes verificadas. Guardando reporte...'
            : 'Guardando reporte...',
        );
        if (result.reused) {
          const message = result.confirmationAdded
            ? 'Ya existia un reporte cercano. Se agrego tu confirmacion al riesgo.'
            : 'Ya habias confirmado este riesgo anteriormente.';
          this.toastr.success(message, 'Riesgo confirmado');
        } else {
          this.toastr.success('El incidente fue enviado para verificacion.', 'Reporte creado');
        }
        this.router.navigateByUrl('/reportes');
      },
      error: (error: unknown) => {
        const moderationMessage = this.moderationErrorMessage(error);
        this.imageVerificationStatus.set(moderationMessage ?? null);
        if (moderationMessage) {
          this.toastr.error(moderationMessage, 'Imagen no permitida');
          this.loading.set(false);
          return;
        }
        this.toastr.error('Verifica tu sesión y el estado del backend.', 'No se pudo crear el reporte');
        this.loading.set(false);
      },
    });
  }

  addPhotos(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    const current = this.selectedPhotos();
    const availableSlots = 5 - current.length;
    const validFiles = files
      .filter((file) => file.type.startsWith('image/'))
      .filter((file) => file.size <= 5 * 1024 * 1024)
      .slice(0, Math.max(availableSlots, 0));

    if (validFiles.length < files.length) {
      this.toastr.warning('Solo se agregaron imágenes válidas dentro del límite permitido.', 'Evidencia');
    }

    const next = validFiles.map((file) => ({ file, url: URL.createObjectURL(file) }));
    this.selectedPhotos.set([...current, ...next]);
  }

  removePhoto(index: number) {
    const current = this.selectedPhotos();
    URL.revokeObjectURL(current[index].url);
    this.selectedPhotos.set(current.filter((_photo, photoIndex) => photoIndex !== index));
  }

  toX(longitude: number | null | undefined): number {
    if (longitude === null || longitude === undefined) return 50;
    const min = -70.05;
    const max = -69.75;
    return Math.min(86, Math.max(8, ((Number(longitude) - min) / (max - min)) * 100));
  }

  toY(latitude: number | null | undefined): number {
    if (latitude === null || latitude === undefined) return 50;
    const min = 18.35;
    const max = 18.6;
    return 100 - Math.min(86, Math.max(8, ((Number(latitude) - min) / (max - min)) * 100));
  }

  riskLevel(): number {
    return Number(this.form.controls.riskLevel.value ?? 3);
  }

  categoryLabel(category: string | null | undefined): string {
    return reportCategoryLabel(category);
  }

  selectedInstitutionName(): string {
    const institutionId = this.form.controls.assignedInstitutionId.value;
    return this.institutions().find((institution) => institution.id === institutionId)?.name ?? 'Sin mencionar';
  }

  selectedInstitutionLabel(): string {
    const institutionId = this.form.controls.assignedInstitutionId.value;
    const institution = this.institutions().find((item) => item.id === institutionId);
    if (!institution) return 'El reporte quedara sin autoridad mencionada hasta que sea asignado por una cuenta institucional.';
    const location = [institution.province, institution.municipality].filter(Boolean).join(' · ');
    return `Se mencionara a ${institution.name}${location ? ` para ${location}` : ''}.`;
  }

  emergencyLocationDetails(): string {
    const latitude = this.form.controls.latitude.value;
    const longitude = this.form.controls.longitude.value;
    const province = this.form.controls.province.value || 'Sin provincia';
    const municipality = this.form.controls.municipality.value || 'Sin municipio';
    const accuracy = this.locationAccuracy() ? `${this.locationAccuracy()} m` : 'manual o no disponible';
    const coordinates = latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : 'coordenadas pendientes';
    return `${province} · ${municipality}. Coordenadas: ${coordinates}. Precisión: ${accuracy}. Reportes cercanos: ${this.nearbyReports().length} en 500 m.`;
  }

  closeEmergencyPrompt() {
    this.emergencyPromptOpen.set(false);
  }

  municipalityOptions(): string[] {
    return MUNICIPALITIES_BY_PROVINCE[this.form.controls.province.value ?? ''] ?? [];
  }

  onProvinceChange(province: string) {
    const municipalities = MUNICIPALITIES_BY_PROVINCE[province] ?? [];
    const current = this.form.controls.municipality.value ?? '';
    if (!municipalities.includes(current)) {
      this.form.controls.municipality.setValue(municipalities[0] ?? '');
    }
  }

  recordEmergencyCall() {
    const value = this.form.getRawValue();
    this.reports.logEmergencyCall({
      category: value.category ?? undefined,
      title: value.title ?? undefined,
      latitude: value.latitude,
      longitude: value.longitude,
      province: value.province,
      municipality: value.municipality,
      address: value.address,
      phoneNumber: '911',
      source: 'report-create-emergency-modal',
    }).subscribe({ error: () => undefined });
    this.closeEmergencyPrompt();
  }

  focusNearbyReport(report: ReportMapPoint) {
    const position: LatLngPoint = { latitude: Number(report.latitude), longitude: Number(report.longitude) };
    this.previewMap?.flyTo({ center: toLngLat(position), zoom: 17, essential: true });
    this.modalMap?.flyTo({ center: toLngLat(position), zoom: 17, essential: true });
  }

  openLocationMapModal() {
    this.locationMapModalOpen.set(true);
    setTimeout(() => this.initModalMap(), 0);
  }

  closeLocationMapModal() {
    this.locationMapModalOpen.set(false);
    this.modalResizeObserver?.disconnect();
    this.modalResizeObserver = undefined;
    this.modalMap?.remove();
    this.modalMap = undefined;
    this.modalMarker = undefined;
    this.modalNearbyLayerEventsRegistered = false;
  }

  confirmLocationMapModal() {
    this.closeLocationMapModal();
  }

  markRiskAsManuallyAdjusted() {
    const level = this.form.controls.riskLevel.value;
    this.riskManuallyAdjusted = Number(level) !== this.lastSuggestedRiskLevel;
    this.autoRiskReason.set(
      this.riskManuallyAdjusted
        ? `Nivel ajustado manualmente por el usuario. Sugerencia por categoría: ${this.lastSuggestedRiskLevel}/5.`
        : this.autoRiskReason(),
    );
  }

  private configureAutomaticRisk() {
    const updateRisk = () => {
      const risk = this.calculateRiskLevel();
      this.lastSuggestedRiskLevel = risk.level;

      if (!this.riskManuallyAdjusted) {
        this.form.controls.riskLevel.setValue(risk.level, { emitEvent: false });
        this.autoRiskReason.set(risk.reason);
      } else {
        this.autoRiskReason.set(`Nivel ajustado manualmente por el usuario. Sugerencia por categoría: ${risk.level}/5.`);
      }

      const latitude = this.form.controls.latitude.value;
      const longitude = this.form.controls.longitude.value;
      if (latitude !== null && longitude !== null) this.updatePreviewMap(Number(latitude), Number(longitude));
    };

    updateRisk();
    this.riskSubscription = this.form.valueChanges.subscribe(updateRisk);
  }

  private configureInstitutionLookup() {
    this.loadInstitutions();
    const subscription = new Subscription();
    subscription.add(this.form.controls.province.valueChanges.subscribe(() => this.loadInstitutions()));
    subscription.add(this.form.controls.municipality.valueChanges.subscribe(() => this.loadInstitutions()));
    this.institutionLookupSubscription = subscription;
  }

  private loadInstitutions() {
    this.reports.institutions({
      province: this.form.controls.province.value || undefined,
      municipality: this.form.controls.municipality.value || undefined,
    }).subscribe({
      next: (institutions) => {
        this.institutions.set(institutions);
        const selected = this.form.controls.assignedInstitutionId.value;
        if (selected && !institutions.some((institution) => institution.id === selected)) {
          this.form.controls.assignedInstitutionId.setValue('', { emitEvent: false });
        }
      },
      error: () => this.institutions.set([]),
    });
  }

  private configureCategoryDraftSuggestions() {
    const subscription = new Subscription();

    subscription.add(
      this.form.controls.title.valueChanges.subscribe((value) => {
        if (this.applyingCategorySuggestion) return;
        const category = (this.form.controls.category.value ?? this.defaultReportCategory) as ReportCategory;
        this.titleManuallyAdjusted = this.normalizeField(value) !== this.normalizeField(this.categoryDraftSuggestions[category]?.title);
      }),
    );

    subscription.add(
      this.form.controls.description.valueChanges.subscribe((value) => {
        if (this.applyingCategorySuggestion) return;
        const category = (this.form.controls.category.value ?? this.defaultReportCategory) as ReportCategory;
        this.descriptionManuallyAdjusted = this.normalizeField(value) !== this.normalizeField(this.categoryDraftSuggestions[category]?.description);
      }),
    );

    subscription.add(
      this.form.controls.category.valueChanges.subscribe((category) => {
        const selectedCategory = (category ?? this.defaultReportCategory) as ReportCategory;
        this.applyCategoryDraftSuggestion(selectedCategory);
        this.maybeOpenEmergencyPrompt(selectedCategory);
      }),
    );

    this.categorySuggestionSubscription = subscription;
  }

  private applyCategoryDraftSuggestion(category: ReportCategory) {
    const suggestion = this.categoryDraftSuggestions[category] ?? this.categoryDraftSuggestions.OTHER;
    this.applyingCategorySuggestion = true;

    if (!this.titleManuallyAdjusted) {
      this.form.controls.title.setValue(suggestion.title, { emitEvent: false });
    }

    if (!this.descriptionManuallyAdjusted) {
      this.form.controls.description.setValue(suggestion.description, { emitEvent: false });
    }

    this.applyingCategorySuggestion = false;
  }

  private normalizeField(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  private maybeOpenEmergencyPrompt(category: ReportCategory) {
    const config = this.systemConfig.getCategoryConfig(category);
    if (!config?.requiresEmergencyCall) {
      this.emergencyPromptOpen.set(false);
      this.emergencyCategoryConfig.set(null);
      return;
    }

    this.emergencyCategoryConfig.set(config);
    this.emergencyPromptOpen.set(true);
  }

  private calculateRiskLevel(): { level: number; reason: string } {
    const category = this.form.controls.category.value ?? 'OTHER';
    const text = this.normalizeText(`${this.form.controls.title.value ?? ''} ${this.form.controls.description.value ?? ''}`);
    const baseByCategory: Record<string, number> = {
      ACCIDENT: 5,
      RECKLESS_DRIVING: 5,
      DANGEROUS_CROSSING: 4,
      TRAFFIC_LIGHT_DAMAGED: 4,
      ROAD_DAMAGE: 4,
      ROAD_OBSTRUCTION: 4,
      FLOOD_ZONE: 5,
      POOR_LIGHTING: 3,
      MISSING_SIGNAGE: 3,
      OTHER: 2,
    };

    let level = this.systemConfig.getCategoryConfig(category)?.defaultRiskLevel ?? baseByCategory[category] ?? 3;
    const criticalKeywords = ['muerto', 'fallecido', 'herido', 'lesionado', 'sangre', 'incendio', 'fuego', 'explosion', 'derrumbe', 'choque', 'accidente', 'inundado', 'inundacion', 'agua alta', 'arrastre'];
    const highExposureKeywords = ['escuela', 'nino', 'nina', 'peaton', 'motociclista', 'autopista', 'puente', 'tunel', 'interseccion', 'curva', 'sin luz', 'bloqueado', 'cañada', 'canada', 'drenaje'];

    if (criticalKeywords.some((keyword) => text.includes(keyword))) level = Math.max(level, 5);
    else if (highExposureKeywords.some((keyword) => text.includes(keyword))) level = Math.max(level, 4);

    level = Math.min(5, Math.max(1, level));
    return {
      level,
      reason: `Nivel ${level}/5 calculado por la categoría seleccionada y las señales detectadas en el texto.`,
    };
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private loadExistingReportsForValidation() {
    this.reports.mapPoints({ limit: 500 }).subscribe({
      next: (reports) => {
        this.existingReports = reports.filter((report) => this.isValidReportCoordinate(report) && report.status !== 'RESOLVED' && report.status !== 'REJECTED');
        this.refreshNearbyReports();
      },
      error: () => {
        this.existingReports = [];
        this.nearbyReports.set([]);
      },
    });
  }

  private refreshNearbyReports() {
    const latitude = Number(this.form.controls.latitude.value);
    const longitude = Number(this.form.controls.longitude.value);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.nearbyReports.set([]);
      this.renderNearbyValidationOnMap(this.previewMap);
      this.renderNearbyValidationOnMap(this.modalMap);
      return;
    }

    const center: LatLngPoint = { latitude, longitude };
    const nearby = this.existingReports
      .map((report) => ({
        report,
        distance: metersBetween(center, { latitude: Number(report.latitude), longitude: Number(report.longitude) }),
      }))
      .filter(({ distance }) => distance <= this.nearbyRadiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .map(({ report }) => report);

    this.nearbyReports.set(nearby);
    this.renderNearbyValidationOnMap(this.previewMap);
    this.renderNearbyValidationOnMap(this.modalMap);
  }

  private renderNearbyValidationOnMap(map?: MapTilerMap) {
    if (!map) return;

    const latitude = Number(this.form.controls.latitude.value);
    const longitude = Number(this.form.controls.longitude.value);
    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
    const radiusData = hasLocation
      ? circlePolygon({ latitude, longitude }, this.nearbyRadiusMeters)
      : circlePolygon({ latitude: 18.4861, longitude: -69.9312 }, 0);
    const reportsData = this.nearbyReportsFeatureCollection();

    mapReady(map, () => {
      const radiusSource = map.getSource(this.nearbyRadiusSourceId) as { setData?: (nextData: typeof radiusData) => void } | undefined;
      if (radiusSource?.setData) {
        radiusSource.setData(radiusData);
      } else {
        map.addSource(this.nearbyRadiusSourceId, { type: 'geojson', data: radiusData });
        map.addLayer({
          id: this.nearbyRadiusFillLayerId,
          type: 'fill',
          source: this.nearbyRadiusSourceId,
          paint: {
            'fill-color': '#2F7D73',
            'fill-opacity': 0.08,
          },
        });
        map.addLayer({
          id: this.nearbyRadiusLineLayerId,
          type: 'line',
          source: this.nearbyRadiusSourceId,
          paint: {
            'line-color': '#2F7D73',
            'line-opacity': 0.38,
            'line-width': 2,
          },
        });
      }

      const reportsSource = map.getSource(this.nearbyReportsSourceId) as { setData?: (nextData: typeof reportsData) => void } | undefined;
      if (reportsSource?.setData) {
        reportsSource.setData(reportsData);
      } else {
        map.addSource(this.nearbyReportsSourceId, { type: 'geojson', data: reportsData });
        map.addLayer({
          id: this.nearbyReportsCircleLayerId,
          type: 'circle',
          source: this.nearbyReportsSourceId,
          paint: {
            'circle-radius': 13,
            'circle-color': [
              'case',
              ['>=', ['get', 'riskLevel'], 4],
              '#A84D4F',
              ['==', ['get', 'riskLevel'], 3],
              '#B9852C',
              '#3B8A8A',
            ],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          },
        });
        map.addLayer({
          id: this.nearbyReportsLabelLayerId,
          type: 'symbol',
          source: this.nearbyReportsSourceId,
          layout: {
            'text-field': ['to-string', ['get', 'riskLevel']],
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#FFFFFF',
          },
        });
        this.registerNearbyReportLayerEvents(map);
      }
    });
  }

  private registerNearbyReportLayerEvents(map: MapTilerMap) {
    const isPreviewMap = map === this.previewMap;
    if (isPreviewMap && this.previewNearbyLayerEventsRegistered) return;
    if (!isPreviewMap && this.modalNearbyLayerEventsRegistered) return;

    if (isPreviewMap) this.previewNearbyLayerEventsRegistered = true;
    else this.modalNearbyLayerEventsRegistered = true;

    [this.nearbyReportsCircleLayerId, this.nearbyReportsLabelLayerId].forEach((layerId) => {
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', layerId, (event) => {
        const reportId = event.features?.[0]?.properties?.['id'];
        const report = this.nearbyReports().find((item) => item.id === reportId);
        if (!report) return;
        new Popup({ offset: 18 })
          .setLngLat([Number(report.longitude), Number(report.latitude)])
          .setHTML(this.nearbyReportPopupHtml(report))
          .addTo(map);
      });
    });
  }

  private nearbyReportsFeatureCollection() {
    return {
      type: 'FeatureCollection' as const,
      features: this.nearbyReports().map((report) => ({
        type: 'Feature' as const,
        properties: {
          id: report.id,
          title: report.title,
          category: report.category,
          riskLevel: Number(report.riskLevel),
          status: report.status,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(report.longitude), Number(report.latitude)],
        },
      })),
    };
  }

  private initPreviewMap() {
    if (!this.previewMapContainer?.nativeElement || this.previewMap) return;

    this.previewMap = createKorviMap(this.previewMapContainer.nativeElement, {
      center: { latitude: 18.4861, longitude: -69.9312 },
      zoom: 13,
      scrollZoom: true,
    });

    this.previewMap.on('click', (event: MapMouseEvent) => {
      this.setReportLocation(
        Number(event.lngLat.lat.toFixed(7)),
        Number(event.lngLat.lng.toFixed(7)),
        null,
        'manual',
      );
    });

    this.previewResizeObserver = observeMapResize(this.previewMap, this.previewMapContainer.nativeElement);
    this.refreshNearbyReports();
  }

  private updatePreviewMap(latitude: number, longitude: number) {
    if (!this.previewMap) return;

    const position: LatLngPoint = { latitude, longitude };

    if (!this.previewMarker) {
      this.previewMarker = new Marker({ element: this.summaryMarkerElement(), draggable: true, anchor: 'center' })
        .setLngLat(toLngLat(position))
        .addTo(this.previewMap);
      this.previewMarker.on('dragend', () => {
        const next = this.previewMarker?.getLngLat();
        if (!next) return;
        this.setReportLocation(Number(next.lat.toFixed(7)), Number(next.lng.toFixed(7)), null, 'manual');
      });
    } else {
      this.previewMarker.setLngLat(toLngLat(position));
      this.previewMarker.getElement().replaceChildren(...Array.from(this.summaryMarkerElement().childNodes));
    }

    this.previewMap.flyTo({ center: toLngLat(position), zoom: 15, essential: true });
    this.resizeMap(this.previewMap);
  }

  private initModalMap() {
    if (!this.modalMapContainer?.nativeElement || this.modalMap) return;

    const latitude = Number(this.form.controls.latitude.value ?? 18.4861);
    const longitude = Number(this.form.controls.longitude.value ?? -69.9312);
    const position: LatLngPoint = { latitude, longitude };

    this.modalMap = createKorviMap(this.modalMapContainer.nativeElement, {
      center: position,
      zoom: this.hasUserLocation() ? 17 : 13,
    });

    this.modalMap.on('click', (event: MapMouseEvent) => {
      this.setReportLocation(
        Number(event.lngLat.lat.toFixed(7)),
        Number(event.lngLat.lng.toFixed(7)),
        null,
        'manual',
      );
    });

    this.updateModalMapMarker(latitude, longitude);
    this.modalResizeObserver = observeMapResize(this.modalMap, this.modalMapContainer.nativeElement);
    this.refreshNearbyReports();
  }

  private updateModalMapMarker(latitude: number, longitude: number) {
    if (!this.modalMap) return;

    const position: LatLngPoint = { latitude, longitude };

    if (!this.modalMarker) {
      this.modalMarker = new Marker({ element: this.summaryMarkerElement(), draggable: true, anchor: 'center' })
        .setLngLat(toLngLat(position))
        .addTo(this.modalMap);
      this.modalMarker.on('dragend', () => {
        const next = this.modalMarker?.getLngLat();
        if (!next) return;
        this.setReportLocation(Number(next.lat.toFixed(7)), Number(next.lng.toFixed(7)), null, 'manual');
      });
    } else {
      this.modalMarker.setLngLat(toLngLat(position));
      this.modalMarker.getElement().replaceChildren(...Array.from(this.summaryMarkerElement().childNodes));
    }

    this.modalLocationLabel.set(`${latitude.toFixed(7)}, ${longitude.toFixed(7)}`);
  }

  private summaryMarkerElement(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = `<span class="summary-risk-marker-shell"><span class="summary-risk-marker">${this.riskLevel()}</span></span>`;
    return wrapper.firstElementChild as HTMLElement;
  }

  private resizeMap(map?: MapTilerMap) {
    if (!map) return;
    const container = map === this.previewMap ? this.previewMapContainer?.nativeElement : this.modalMapContainer?.nativeElement;
    scheduleMapResize(map, container);
  }

  private setReportLocation(latitude: number, longitude: number, accuracy: number | null, source: 'device' | 'manual') {
    this.form.patchValue({ latitude, longitude });
    this.hasUserLocation.set(true);
    this.locationAccuracy.set(accuracy);
    this.modalLocationSource.set(source === 'device' ? 'GPS del dispositivo' : 'Selección manual');
    this.locationMessage.set(
      source === 'device'
        ? `Coordenadas capturadas con precisión aproximada de ${accuracy} metros.`
        : 'Ubicación seleccionada manualmente en el mapa.',
    );
    this.updatePreviewMap(latitude, longitude);
    this.updateModalMapMarker(latitude, longitude);
    this.refreshNearbyReports();
    void this.reverseGeocodeLocation(latitude, longitude, source);
  }

  private async reverseGeocodeLocation(latitude: number, longitude: number, source: 'device' | 'manual') {
    const requestId = ++this.reverseGeocodeRequestId;

    try {
      const details = await reverseGeocodeKorviLocation(latitude, longitude);
      if (requestId !== this.reverseGeocodeRequestId) return;

      const normalized = this.normalizeDominicanLocation(latitude, longitude, details);
      const province = this.matchProvinceOption(normalized.province) ?? this.form.controls.province.value ?? '';
      const municipality = this.matchMunicipalityOption(province, normalized.municipality) ?? MUNICIPALITIES_BY_PROVINCE[province]?.[0] ?? this.form.controls.municipality.value ?? '';
      this.form.patchValue({
        province,
        municipality,
        address: normalized.address ?? this.form.controls.address.value ?? '',
      });

      const administrative = [province, municipality].filter(Boolean).join(' · ');
      const address = normalized.address ? ` ${normalized.address}.` : '';
      const accuracyText = source === 'device' && this.locationAccuracy() ? ` Precision: ${this.locationAccuracy()} m.` : '';
      this.locationMessage.set(`${administrative || 'Ubicacion capturada'}.${address}${accuracyText}`.trim());
    } catch {
      if (requestId !== this.reverseGeocodeRequestId) return;
      this.locationMessage.set(
        source === 'device'
          ? `Coordenadas capturadas. No se pudo obtener provincia/municipio automaticamente.`
          : 'Ubicacion seleccionada manualmente. No se pudo obtener provincia/municipio automaticamente.',
      );
    }
  }

  private normalizeDominicanLocation(latitude: number, longitude: number, details: LocationDetails): LocationDetails {
    const municipality = this.cleanAdministrativeName(details.municipality);
    const province = this.cleanAdministrativeName(details.province);
    const isSantoDomingoEsteArea = latitude >= 18.43 && latitude <= 18.58 && longitude >= -69.91 && longitude <= -69.75;

    if (isSantoDomingoEsteArea && (!municipality || municipality === 'Distrito Nacional' || municipality === 'Santo Domingo')) {
      return {
        ...details,
        province: 'Santo Domingo',
        municipality: 'Santo Domingo Este',
      };
    }

    if (municipality === 'Santo Domingo Este') {
      return { ...details, province: 'Santo Domingo', municipality };
    }

    return { ...details, province, municipality };
  }

  private matchProvinceOption(value: string | undefined): string | undefined {
    const normalized = this.normalizeText(this.cleanAdministrativeName(value));
    if (!normalized) return undefined;
    return this.provinceOptions.find((province) => this.normalizeText(province) === normalized);
  }

  private matchMunicipalityOption(province: string, value: string | undefined): string | undefined {
    const normalized = this.normalizeText(this.cleanAdministrativeName(value));
    if (!province || !normalized) return undefined;
    return (MUNICIPALITIES_BY_PROVINCE[province] ?? []).find((municipality) => this.normalizeText(municipality) === normalized);
  }

  private cleanAddress(value: string | undefined): string {
    if (!value) return '';
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !['Republica Dominicana', 'República Dominicana'].includes(part))
      .slice(0, 3)
      .join(', ');
  }

  private cleanAdministrativeName(value: string | undefined): string {
    return (value ?? '')
      .replace(/^Provincia\s+/i, '')
      .replace(/^Municipio\s+/i, '')
      .trim();
  }

  private isValidReportCoordinate(report: ReportMapPoint): boolean {
    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 17.4 && latitude <= 20.1 && longitude >= -72.2 && longitude <= -68;
  }

  private nearbyReportPopupHtml(report: ReportMapPoint): string {
    return `
      <strong>${this.escapeHtml(report.title)}</strong><br>
      <span>${this.escapeHtml(reportCategoryLabel(report.category))} - Riesgo ${report.riskLevel}/5</span><br>
      <span>${this.escapeHtml(report.status)}</span>
    `;
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

  private buildPayload(): FormData {
    const value = this.form.getRawValue();
    const data = new FormData();

    Object.entries(value).forEach(([key, fieldValue]) => {
      if (key === 'assignedInstitutionId' && !fieldValue) return;
      data.append(key, String(fieldValue ?? ''));
    });
    data.append('source', 'web');

    this.selectedPhotos().forEach((photo) => {
      data.append('photos', photo.file, photo.file.name);
    });

    return data;
  }

  private moderationErrorMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const body = error.error;
    if (!body || typeof body !== 'object') return null;

    const message = 'message' in body ? body.message : null;
    const blockedCategories = 'blockedCategories' in body ? body.blockedCategories : null;
    if (!blockedCategories && typeof message !== 'string') return null;

    const categories = Array.isArray(blockedCategories) && blockedCategories.length
      ? ` Categorias detectadas: ${blockedCategories.join(', ')}.`
      : '';
    return `${typeof message === 'string' ? message : 'Una imagen adjunta no paso la verificacion de contenido.'}${categories}`;
  }
}

