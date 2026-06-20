import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastrService } from 'ngx-toastr';
import { API_URL } from '../../core/api.config';
import { ReportCategory, ReportsService } from '../../core/reports.service';
import { FeatureFlag, FeatureFlagsService } from '../../core/feature-flags.service';
import { GamificationService } from '../../core/gamification.service';
import { ExternalApiLogEntry, SystemApiKeysConfig, SystemConfigService, SystemIntegrationConfig, SystemMapThemeConfig, SystemSocialAuthConfig } from '../../core/system-config.service';

type AdminSettingsSection = 'categories' | 'auth' | 'features' | 'gamification' | 'storage' | 'maps' | 'libraries' | 'integrations' | 'weather' | 'external-logs';

@Component({
  selector: 'app-system-admin',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSliderModule,
    MatSlideToggleModule,
  ],
  template: `
    <section class="system-page">
      <header class="system-header">
        <div>
          <span class="rs-eyebrow">Super administracion</span>
          <h1>Configuracion del sistema</h1>
          <p>Centro de control para catalogos, categorias, roles, suscripciones, almacenamiento y librerias.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/admin">
            <mat-icon>arrow_back</mat-icon>
            Volver al panel
          </a>
          <button mat-stroked-button type="button" (click)="resetDefaults()">
            <mat-icon>restart_alt</mat-icon>
            Restaurar valores
          </button>
          <button mat-flat-button type="button" (click)="saveSettings()" [disabled]="savingMapSettings">
            <mat-icon>{{ savingMapSettings ? 'sync' : 'save' }}</mat-icon>
            {{ savingMapSettings ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </header>

      <section class="settings-layout">
        <aside class="settings-sidebar" aria-label="Menu de configuracion administrativa">
          @for (section of sections; track section.id) {
            <a
              routerLink="/admin/system"
              [queryParams]="{ section: section.id }"
              class="settings-nav-item"
              [class.active]="activeSection === section.id">
              <mat-icon>{{ section.icon }}</mat-icon>
              <span>
                <strong>{{ section.label }}</strong>
                <small>{{ section.description }}</small>
              </span>
            </a>
          }
        </aside>

        <mat-card class="settings-panel">
          @switch (activeSection) {
            @case ('categories') {
              <div class="section-title">
                <div>
                  <h2>Categorias de riesgo</h2>
                  <p>Configura catalogos, riesgo base y si una categoria debe sugerir llamada a organismos de emergencia.</p>
                </div>
              </div>

              <div class="category-list">
                @for (category of config.config().categories; track category.id) {
                  <article class="category-card" [class.disabled]="!category.enabled" [class.emergency]="category.requiresEmergencyCall">
                    <div class="category-card-header">
                      <div class="category-photo-preview">
                        <mat-icon>image</mat-icon>
                        <img
                          [src]="categoryPhotoUrl(category.defaultPhotoUrl)"
                          alt=""
                          loading="lazy"
                          (error)="hideBrokenImage($event)" />
                      </div>

                      <div class="category-main">
                        <span class="category-icon">
                          <mat-icon>{{ categoryIcon(category.id) }}</mat-icon>
                        </span>
                        <div>
                          <strong>{{ category.label }}</strong>
                          <span>{{ category.id }}</span>
                        </div>
                      </div>

                      <div class="category-state">
                        <span class="category-status" [class.enabled]="category.enabled">
                          {{ category.enabled ? 'Activa' : 'Inactiva' }}
                        </span>
                        <input
                          #categoryPhotoInput
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          (change)="uploadCategoryDefaultPhoto(category.id, $event)" />
                        <button
                          mat-icon-button
                          type="button"
                          class="category-icon-button"
                          (click)="categoryPhotoInput.click()"
                          [disabled]="uploadingCategoryPhoto === category.id"
                          aria-label="Cargar imagen por defecto">
                          <mat-icon>{{ uploadingCategoryPhoto === category.id ? 'sync' : 'upload' }}</mat-icon>
                        </button>
                        <mat-slide-toggle
                          [checked]="category.enabled"
                          (change)="updateCategory(category.id, { enabled: $event.checked })"
                          aria-label="Activar categoria">
                        </mat-slide-toggle>
                      </div>
                    </div>

                    <div class="category-controls">
                      <div class="risk-control">
                        <div class="control-label">
                          <span>Riesgo base</span>
                          <strong>{{ riskLabel(category.defaultRiskLevel) }}</strong>
                        </div>
                        <div class="risk-options" role="group" aria-label="Riesgo base">
                          @for (level of riskLevels; track level) {
                            <button
                              type="button"
                              [class.active]="category.defaultRiskLevel === level"
                              [class.high]="level >= 4"
                              (click)="updateCategory(category.id, { defaultRiskLevel: level })"
                              [attr.aria-label]="'Riesgo ' + level">
                              {{ level }}
                            </button>
                          }
                        </div>
                      </div>

                      <button
                        type="button"
                        class="emergency-action"
                        [class.active]="category.requiresEmergencyCall"
                        (click)="updateCategory(category.id, { requiresEmergencyCall: !category.requiresEmergencyCall })">
                        <mat-icon>{{ category.requiresEmergencyCall ? 'emergency' : 'notifications_none' }}</mat-icon>
                        <span>
                          <strong>{{ category.requiresEmergencyCall ? 'Emergencia activa' : 'Sin emergencia' }}</strong>
                          <small>{{ category.requiresEmergencyCall ? 'Sugiere llamada inmediata' : 'No sugiere llamada' }}</small>
                        </span>
                      </button>

                      <div class="instructions-wrap">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="instructions-field">
                          <mat-label>Mensaje de emergencia</mat-label>
                          <input
                            matInput
                            [disabled]="!category.requiresEmergencyCall"
                            [ngModel]="category.emergencyInstructions"
                            (ngModelChange)="updateCategory(category.id, { emergencyInstructions: $event })" />
                        </mat-form-field>
                      </div>
                    </div>
                  </article>
                }
              </div>
            }

            @case ('storage') {
              <div class="section-title">
                <div>
                  <h2>Almacenamiento</h2>
                  <p>Configura proveedor, limites de evidencias, retencion, seguridad y rutas de publicacion.</p>
                </div>
                <mat-chip>{{ config.config().storage.provider }}</mat-chip>
              </div>

              <section class="storage-layout">
                <div class="storage-provider-list">
                  @for (provider of storageProviders; track provider.id) {
                    <button
                      type="button"
                      class="provider-option"
                      [class.active]="config.config().storage.provider === provider.id"
                      (click)="config.updateStorage({ provider: provider.id })">
                      <mat-icon>{{ provider.icon }}</mat-icon>
                      <span>
                        <strong>{{ provider.label }}</strong>
                        <small>{{ provider.description }}</small>
                      </span>
                    </button>
                  }
                </div>

                <div class="storage-forms">
                  <mat-card class="storage-section">
                    <h3>Politica de evidencias</h3>
                    <div class="field-grid">
                      <mat-form-field appearance="outline">
                        <mat-label>Retencion dias</mat-label>
                        <input matInput type="number" min="1" [ngModel]="config.config().storage.retentionDays" (ngModelChange)="config.updateStorage({ retentionDays: numberValue($event, 365) })" />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Max. evidencias</mat-label>
                        <input matInput type="number" min="1" max="20" [ngModel]="config.config().storage.evidenceMaxFiles" (ngModelChange)="config.updateStorage({ evidenceMaxFiles: numberValue($event, 5) })" />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Max. MB por archivo</mat-label>
                        <input matInput type="number" min="1" max="100" [ngModel]="config.config().storage.evidenceMaxMb" (ngModelChange)="config.updateStorage({ evidenceMaxMb: numberValue($event, 5) })" />
                      </mat-form-field>
                    </div>
                    <mat-form-field appearance="outline">
                      <mat-label>Tipos MIME permitidos</mat-label>
                      <input matInput [ngModel]="fileTypesText()" (ngModelChange)="updateAllowedFileTypes($event)" />
                    </mat-form-field>
                  </mat-card>

                  <mat-card class="storage-section">
                    <h3>Seguridad y acceso</h3>
                    <div class="toggle-grid">
                      <mat-slide-toggle [checked]="config.config().storage.antivirusScanEnabled" (change)="config.updateStorage({ antivirusScanEnabled: $event.checked })">
                        Escaneo antivirus
                      </mat-slide-toggle>
                      <mat-slide-toggle [checked]="config.config().storage.encryptAtRest" (change)="config.updateStorage({ encryptAtRest: $event.checked })">
                        Cifrado en reposo
                      </mat-slide-toggle>
                      <mat-slide-toggle [checked]="config.config().storage.publicAccess" (change)="config.updateStorage({ publicAccess: $event.checked })">
                        Acceso publico directo
                      </mat-slide-toggle>
                    </div>
                  </mat-card>

                  @switch (config.config().storage.provider) {
                    @case ('Local uploads') {
                      <mat-card class="storage-section">
                        <h3>Local uploads</h3>
                        <div class="field-grid two">
                          <mat-form-field appearance="outline">
                            <mat-label>Ruta local</mat-label>
                            <input matInput [ngModel]="config.config().storage.localPath" (ngModelChange)="config.updateStorage({ localPath: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>URL publica base</mat-label>
                            <input matInput [ngModel]="config.config().storage.localPublicBaseUrl" (ngModelChange)="config.updateStorage({ localPublicBaseUrl: $event })" />
                          </mat-form-field>
                        </div>
                      </mat-card>
                    }

                    @case ('S3 compatible') {
                      <mat-card class="storage-section">
                        <h3>S3 compatible</h3>
                        <div class="field-grid two">
                          <mat-form-field appearance="outline">
                            <mat-label>Endpoint</mat-label>
                            <input matInput placeholder="https://s3.amazonaws.com" [ngModel]="config.config().storage.s3Endpoint" (ngModelChange)="config.updateStorage({ s3Endpoint: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Region</mat-label>
                            <input matInput [ngModel]="config.config().storage.s3Region" (ngModelChange)="config.updateStorage({ s3Region: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Bucket</mat-label>
                            <input matInput [ngModel]="config.config().storage.s3Bucket" (ngModelChange)="config.updateStorage({ s3Bucket: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Access key</mat-label>
                            <input matInput [ngModel]="config.config().storage.s3AccessKeyId" (ngModelChange)="config.updateStorage({ s3AccessKeyId: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Secret key</mat-label>
                            <input matInput type="password" [ngModel]="config.config().storage.s3SecretAccessKey" (ngModelChange)="config.updateStorage({ s3SecretAccessKey: $event })" />
                          </mat-form-field>
                          <mat-slide-toggle [checked]="config.config().storage.s3ForcePathStyle" (change)="config.updateStorage({ s3ForcePathStyle: $event.checked })">
                            Force path style
                          </mat-slide-toggle>
                        </div>
                      </mat-card>
                    }

                    @case ('Azure Blob') {
                      <mat-card class="storage-section">
                        <h3>Azure Blob</h3>
                        <div class="field-grid two">
                          <mat-form-field appearance="outline">
                            <mat-label>Cuenta</mat-label>
                            <input matInput [ngModel]="config.config().storage.azureAccountName" (ngModelChange)="config.updateStorage({ azureAccountName: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Contenedor</mat-label>
                            <input matInput [ngModel]="config.config().storage.azureContainer" (ngModelChange)="config.updateStorage({ azureContainer: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline" class="wide-field">
                            <mat-label>Connection string</mat-label>
                            <input matInput type="password" [ngModel]="config.config().storage.azureConnectionString" (ngModelChange)="config.updateStorage({ azureConnectionString: $event })" />
                          </mat-form-field>
                          <mat-form-field appearance="outline" class="wide-field">
                            <mat-label>CDN o URL publica base</mat-label>
                            <input matInput [ngModel]="config.config().storage.azureCdnBaseUrl" (ngModelChange)="config.updateStorage({ azureCdnBaseUrl: $event })" />
                          </mat-form-field>
                        </div>
                      </mat-card>
                    }
                  }
                </div>
              </section>
            }

            @case ('features') {
              <div class="section-title">
                <div>
                  <h2>Feature flags</h2>
                  <p>Activa o desactiva funciones completas del sistema sin cambiar codigo ni permisos por rol.</p>
                </div>
                <button mat-stroked-button type="button" (click)="resetFeatureFlags()">
                  <mat-icon>restart_alt</mat-icon>
                  Restaurar flags
                </button>
              </div>

              <div class="feature-group-list">
                @for (group of featureGroups(); track group) {
                  <mat-card class="feature-group">
                    <h3>{{ group }}</h3>
                    <div class="feature-list">
                      @for (flag of featureFlagsByGroup(group); track flag.key) {
                        <button
                          type="button"
                          class="feature-flag"
                          [class.enabled]="flag.enabled"
                          [class.critical]="flag.critical"
                          [disabled]="flag.critical"
                          (click)="toggleFeatureFlag(flag)">
                          <span class="feature-flag-icon">
                            <mat-icon>{{ flag.enabled ? 'toggle_on' : 'toggle_off' }}</mat-icon>
                          </span>
                          <span class="feature-flag-copy">
                            <strong>{{ flag.label }}</strong>
                            <small>{{ flag.description }}</small>
                          </span>
                          <span class="feature-flag-state">{{ flag.critical ? 'Critico' : flag.enabled ? 'Activo' : 'Inactivo' }}</span>
                        </button>
                      }
                    </div>
                  </mat-card>
                }
              </div>
            }

            @case ('auth') {
              <div class="section-title">
                <div>
                  <h2>Login y registro social</h2>
                  <p>Controla si KORVI permite crear cuenta o iniciar sesion mediante Google y Facebook en web y app movil.</p>
                </div>
                <mat-chip>{{ socialAuthEnabledCount() }}/2 activos</mat-chip>
              </div>

              <div class="social-auth-grid">
                @for (provider of socialAuthProviders; track provider.key) {
                  <mat-card class="social-auth-card" [class.enabled]="socialAuthEnabled(provider.key)">
                    <div class="social-auth-heading">
                      <mat-icon>{{ provider.icon }}</mat-icon>
                      <span>
                        <strong>{{ provider.label }}</strong>
                        <small>{{ provider.description }}</small>
                      </span>
                    </div>

                    <mat-slide-toggle
                      [checked]="socialAuthEnabled(provider.key)"
                      (change)="toggleSocialAuthProvider(provider.key, $event.checked)">
                      {{ socialAuthEnabled(provider.key) ? 'Activo' : 'Inactivo' }}
                    </mat-slide-toggle>

                    <span class="provider-config-state" [class.ready]="socialProviderConfigured(provider.key)">
                      {{ socialProviderConfigured(provider.key) ? 'Credenciales completas' : 'Credenciales pendientes' }}
                    </span>
                    <p class="hint">{{ provider.hint }}</p>
                  </mat-card>
                }
              </div>

              <mat-card class="library-section social-settings-card">
                <h3>Credenciales de proveedores</h3>
                <div class="field-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>GOOGLE_CLIENT_ID</mat-label>
                    <input
                      matInput
                      autocomplete="off"
                      [type]="socialCredentialVisible('googleClientId') ? 'text' : 'password'"
                      [ngModel]="config.config().socialAuth.googleClientId"
                      (ngModelChange)="config.updateSocialAuth({ googleClientId: $event })" />
                    <button mat-icon-button matSuffix type="button" [attr.aria-label]="socialCredentialVisible('googleClientId') ? 'Ocultar GOOGLE_CLIENT_ID' : 'Mostrar GOOGLE_CLIENT_ID'" (click)="toggleSocialCredentialVisibility('googleClientId')">
                      <mat-icon>{{ socialCredentialVisible('googleClientId') ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>FACEBOOK_APP_ID</mat-label>
                    <input
                      matInput
                      autocomplete="off"
                      [type]="socialCredentialVisible('facebookAppId') ? 'text' : 'password'"
                      [ngModel]="config.config().socialAuth.facebookAppId"
                      (ngModelChange)="config.updateSocialAuth({ facebookAppId: $event })" />
                    <button mat-icon-button matSuffix type="button" [attr.aria-label]="socialCredentialVisible('facebookAppId') ? 'Ocultar FACEBOOK_APP_ID' : 'Mostrar FACEBOOK_APP_ID'" (click)="toggleSocialCredentialVisibility('facebookAppId')">
                      <mat-icon>{{ socialCredentialVisible('facebookAppId') ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </mat-form-field>
                  <article class="secret-env-state" [class.ready]="config.config().socialAuth.facebookAppSecretConfigured">
                    <mat-icon>{{ config.config().socialAuth.facebookAppSecretConfigured ? 'lock' : 'lock_open' }}</mat-icon>
                    <div>
                      <strong>FACEBOOK_APP_SECRET</strong>
                      <span>{{ config.config().socialAuth.facebookAppSecretConfigured ? 'Configurado en .env' : 'Pendiente en .env' }}</span>
                    </div>
                  </article>
                </div>
                <p class="hint">Google y Facebook App ID pueden ajustarse aqui. FACEBOOK_APP_SECRET queda solo en el backend mediante .env.</p>
              </mat-card>

              <div class="recommendation-list">
                <article>
                  <strong>Credenciales requeridas</strong>
                  <span>Google requiere GOOGLE_CLIENT_ID. Facebook usa FACEBOOK_APP_ID en panel y FACEBOOK_APP_SECRET en .env.</span>
                </article>
                <article>
                  <strong>Alcance del cambio</strong>
                  <span>Al desactivar un proveedor se oculta en el app movil y el backend rechaza cualquier intento contra /auth/social.</span>
                </article>
              </div>
            }

            @case ('gamification') {
              <div class="section-title compact">
                <h2>Insignias y puntos</h2>
                <p>Ajusta los puntos otorgados por actividad y los umbrales para desbloquear insignias en el perfil ciudadano.</p>
              </div>

              <div class="library-grid">
                <mat-card class="library-section">
                  <h3>Puntos por actividad</h3>
                  <div class="field-grid three">
                    @for (item of pointSettings; track item.key) {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ item.label }}</mat-label>
                        <input
                          matInput
                          type="number"
                          min="0"
                          [ngModel]="gamification.settings()[item.key]"
                          (ngModelChange)="gamification.update(item.key, numberValue($event, item.fallback))" />
                      </mat-form-field>
                    }
                  </div>
                </mat-card>

                <mat-card class="library-section">
                  <h3>Umbrales de insignias</h3>
                  <div class="field-grid three">
                    @for (item of badgeSettings; track item.key) {
                      <mat-form-field appearance="outline">
                        <mat-label>{{ item.label }}</mat-label>
                        <input
                          matInput
                          type="number"
                          min="0"
                          [ngModel]="gamification.settings()[item.key]"
                          (ngModelChange)="gamification.update(item.key, numberValue($event, item.fallback))" />
                      </mat-form-field>
                    }
                  </div>
                </mat-card>
              </div>
            }

            @case ('maps') {
              <div class="section-title">
                <div>
                  <h2>Mapas</h2>
                  <p>Configura proveedor base, geocodificacion, rutas, render y credenciales cartograficas.</p>
                </div>
                <div class="section-actions">
                  <mat-chip>{{ config.config().integrations.mapProvider }} · {{ config.config().integrations.routingProvider }}</mat-chip>
                </div>
              </div>

              <div class="library-grid">
                <mat-card class="library-section">
                  <h3>Proveedores</h3>
                  <div class="field-grid three">
                    <mat-form-field appearance="outline">
                      <mat-label>Mapa base</mat-label>
                      <mat-select [ngModel]="config.config().integrations.mapProvider" (ngModelChange)="selectIntegrationProvider('mapProvider', $event)">
                        @for (provider of mapProviders; track provider.value) {
                          <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Geocodificacion</mat-label>
                      <mat-select [ngModel]="config.config().integrations.geocodingProvider" (ngModelChange)="selectIntegrationProvider('geocodingProvider', $event)">
                        @for (provider of geocodingProviders; track provider.value) {
                          <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Rutas</mat-label>
                      <mat-select [ngModel]="config.config().integrations.routingProvider" (ngModelChange)="selectIntegrationProvider('routingProvider', $event)">
                        @for (provider of routingProviders; track provider.value) {
                          <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                </mat-card>

                <mat-card class="library-section">
                  <h3>Credenciales</h3>
                  <p class="hint">Las claves de MapTiler, Google Maps y OpenRouteService deben vivir en variables de entorno del backend. El frontend no las guarda ni las envia.</p>
                </mat-card>

                <mat-card class="library-section">
                  <h3>Render y posicion inicial</h3>
                  <div class="field-grid three">
                    <mat-form-field appearance="outline">
                      <mat-label>Render</mat-label>
                      <mat-select [ngModel]="config.config().libraries.mapRenderer" (ngModelChange)="selectMapRenderer($event)">
                        <mat-option value="MapLibre GL">MapLibre GL</mat-option>
                        <mat-option value="Leaflet">Leaflet</mat-option>
                        <mat-option value="Google Maps">Google Maps</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Latitud inicial</mat-label>
                      <input matInput type="number" step="0.0001" [ngModel]="config.config().libraries.defaultLatitude" (ngModelChange)="config.updateLibraries({ defaultLatitude: numberValue($event, 18.4861) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Longitud inicial</mat-label>
                      <input matInput type="number" step="0.0001" [ngModel]="config.config().libraries.defaultLongitude" (ngModelChange)="config.updateLibraries({ defaultLongitude: numberValue($event, -69.9312) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Zoom inicial</mat-label>
                      <input matInput type="number" min="1" max="22" [ngModel]="config.config().libraries.defaultZoom" (ngModelChange)="config.updateLibraries({ defaultZoom: numberValue($event, 12) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Estilo claro</mat-label>
                      <input matInput [ngModel]="config.config().libraries.mapStyleLight" (ngModelChange)="config.updateLibraries({ mapStyleLight: $event })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Estilo oscuro</mat-label>
                      <input matInput [ngModel]="config.config().libraries.mapStyleDark" (ngModelChange)="config.updateLibraries({ mapStyleDark: $event })" />
                    </mat-form-field>
                  </div>
                </mat-card>

                <mat-card class="library-section">
                  <div class="section-row">
                    <h3>Tema visual del mapa</h3>
                    <div class="preset-actions">
                      <button mat-stroked-button type="button" (click)="applyMapThemePreset('korvi')">
                        <mat-icon>palette</mat-icon>
                        Korvi
                      </button>
                      <button mat-stroked-button type="button" (click)="applyMapThemePreset('cool')">
                        <mat-icon>water_drop</mat-icon>
                        Fresco
                      </button>
                      <button mat-stroked-button type="button" (click)="applyMapThemePreset('mono')">
                        <mat-icon>contrast</mat-icon>
                        Minimal
                      </button>
                    </div>
                  </div>

                  <div class="map-theme-grid">
                    <section>
                      <strong>Modo claro</strong>
                      <div class="color-grid">
                        @for (field of mapThemeColorFields; track field.key) {
                          <label class="color-swatch-control" [style.--swatch-color]="config.config().libraries.mapThemeLight[field.key]">
                            <span class="swatch-preview" aria-hidden="true"></span>
                            <span class="swatch-copy">
                              <strong>{{ field.label }}</strong>
                              <small>{{ config.config().libraries.mapThemeLight[field.key] }}</small>
                            </span>
                            <input type="color" [attr.aria-label]="'Color claro ' + field.label" [ngModel]="config.config().libraries.mapThemeLight[field.key]" (ngModelChange)="updateMapThemeColor('light', field.key, $event)" />
                          </label>
                        }
                      </div>
                    </section>

                    <section>
                      <strong>Modo oscuro</strong>
                      <div class="color-grid">
                        @for (field of mapThemeColorFields; track field.key) {
                          <label class="color-swatch-control" [style.--swatch-color]="config.config().libraries.mapThemeDark[field.key]">
                            <span class="swatch-preview" aria-hidden="true"></span>
                            <span class="swatch-copy">
                              <strong>{{ field.label }}</strong>
                              <small>{{ config.config().libraries.mapThemeDark[field.key] }}</small>
                            </span>
                            <input type="color" [attr.aria-label]="'Color oscuro ' + field.label" [ngModel]="config.config().libraries.mapThemeDark[field.key]" (ngModelChange)="updateMapThemeColor('dark', field.key, $event)" />
                          </label>
                        }
                      </div>
                    </section>
                  </div>

                  <div class="filter-slider-grid">
                    @for (field of googleMapFilterFields; track field.key) {
                      <article class="filter-slider">
                        <div class="filter-slider-header">
                          <span>
                            <strong>{{ field.label }}</strong>
                            <small>Modo claro</small>
                          </span>
                          <b>{{ formatMapSliderValue(field, config.config().libraries.mapThemeLight[field.key]) }}</b>
                        </div>
                        <mat-slider [min]="field.min" [max]="field.max" [step]="field.step" discrete>
                          <input matSliderThumb [ngModel]="config.config().libraries.mapThemeLight[field.key]" (ngModelChange)="updateMapThemeNumber('light', field.key, $event)" />
                        </mat-slider>
                        <div class="slider-scale" aria-hidden="true">
                          <span>{{ formatMapSliderTick(field, field.min) }}</span>
                          @if (field.min < 0 && field.max > 0) {
                            <span>0</span>
                          }
                          <span>{{ formatMapSliderTick(field, field.max) }}</span>
                        </div>
                      </article>
                      <article class="filter-slider">
                        <div class="filter-slider-header">
                          <span>
                            <strong>{{ field.label }}</strong>
                            <small>Modo oscuro</small>
                          </span>
                          <b>{{ formatMapSliderValue(field, config.config().libraries.mapThemeDark[field.key]) }}</b>
                        </div>
                        <mat-slider [min]="field.min" [max]="field.max" [step]="field.step" discrete>
                          <input matSliderThumb [ngModel]="config.config().libraries.mapThemeDark[field.key]" (ngModelChange)="updateMapThemeNumber('dark', field.key, $event)" />
                        </mat-slider>
                        <div class="slider-scale" aria-hidden="true">
                          <span>{{ formatMapSliderTick(field, field.min) }}</span>
                          @if (field.min < 0 && field.max > 0) {
                            <span>0</span>
                          }
                          <span>{{ formatMapSliderTick(field, field.max) }}</span>
                        </div>
                      </article>
                    }
                  </div>
                  <p class="hint">MapTiler aplica colores por capas. Google Maps usa filtros raster globales, por eso los controles de Google afectan el tono general del tile.</p>
                </mat-card>

                <mat-card class="library-section">
                  <h3>Capas y rutas</h3>
                  <div class="field-grid three">
                    <mat-form-field appearance="outline">
                      <mat-label>Endpoint rutas</mat-label>
                      <input matInput [ngModel]="config.config().libraries.routingEndpoint" (ngModelChange)="config.updateLibraries({ routingEndpoint: $event })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Radio riesgo metros</mat-label>
                      <input matInput type="number" min="20" [ngModel]="config.config().libraries.routeRiskRadiusMeters" (ngModelChange)="config.updateLibraries({ routeRiskRadiusMeters: numberValue($event, 180) })" />
                    </mat-form-field>
                    <mat-slide-toggle [checked]="config.config().libraries.avoidHighRiskReports" (change)="config.updateLibraries({ avoidHighRiskReports: $event.checked })">Evitar reportes de alto riesgo</mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().libraries.enableMapClustering" (change)="config.updateLibraries({ enableMapClustering: $event.checked })">Clustering</mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().libraries.enableHeatmapLayer" (change)="config.updateLibraries({ enableHeatmapLayer: $event.checked })">Heatmap</mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().libraries.enableGeolocationControl" (change)="config.updateLibraries({ enableGeolocationControl: $event.checked })">Geolocalizacion</mat-slide-toggle>
                  </div>
                </mat-card>
              </div>
            }

            @case ('libraries') {
              <div class="section-title">
                <div>
                  <h2>Librerias</h2>
                  <p>Configura librerias visuales no cartograficas y comportamiento de graficos.</p>
                </div>
                <mat-chip>{{ config.config().libraries.chartLibrary }}</mat-chip>
              </div>

              <div class="library-grid">
                <mat-card class="library-section">
                  <h3>Graficos</h3>
                  <div class="field-grid three">
                    <mat-form-field appearance="outline">
                      <mat-label>Libreria</mat-label>
                      <mat-select [ngModel]="config.config().libraries.chartLibrary" (ngModelChange)="config.updateLibraries({ chartLibrary: $event })">
                        <mat-option value="Chart.js">Chart.js</mat-option>
                        <mat-option value="ECharts">ECharts</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Tema</mat-label>
                      <mat-select [ngModel]="config.config().libraries.chartTheme" (ngModelChange)="config.updateLibraries({ chartTheme: $event })">
                        <mat-option value="Sistema">Sistema</mat-option>
                        <mat-option value="Claro">Claro</mat-option>
                        <mat-option value="Oscuro">Oscuro</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Refresco segundos</mat-label>
                      <input matInput type="number" min="10" [ngModel]="config.config().libraries.chartRefreshSeconds" (ngModelChange)="config.updateLibraries({ chartRefreshSeconds: numberValue($event, 60) })" />
                    </mat-form-field>
                    <mat-slide-toggle [checked]="config.config().libraries.chartAnimationEnabled" (change)="config.updateLibraries({ chartAnimationEnabled: $event.checked })">Animaciones</mat-slide-toggle>
                  </div>
                </mat-card>

              </div>
            }

            @case ('integrations') {
              <div class="section-title">
                <div>
                  <h2>Integraciones</h2>
                  <p>Selecciona el proveedor activo por servicio. Las credenciales se administran solo en el backend.</p>
                </div>
                <mat-chip>Backend</mat-chip>
              </div>

              <mat-card class="library-section">
                <h3>Proveedor activo por servicio</h3>
                <div class="active-provider-grid" aria-label="Proveedores activos">
                  @for (item of activeIntegrationSummary(); track item.key) {
                    <article>
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </article>
                  }
                </div>
                <div class="field-grid three">
                  <mat-form-field appearance="outline">
                    <mat-label>Mapa base</mat-label>
                    <mat-select [ngModel]="config.config().integrations.mapProvider" (ngModelChange)="selectIntegrationProvider('mapProvider', $event)">
                      @for (provider of mapProviders; track provider.value) {
                        <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Geocodificacion</mat-label>
                    <mat-select [ngModel]="config.config().integrations.geocodingProvider" (ngModelChange)="selectIntegrationProvider('geocodingProvider', $event)">
                      @for (provider of geocodingProviders; track provider.value) {
                        <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Rutas</mat-label>
                    <mat-select [ngModel]="config.config().integrations.routingProvider" (ngModelChange)="selectIntegrationProvider('routingProvider', $event)">
                      @for (provider of routingProviders; track provider.value) {
                        <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>IA</mat-label>
                    <mat-select [ngModel]="config.config().integrations.aiProvider" (ngModelChange)="selectIntegrationProvider('aiProvider', $event)">
                      @for (provider of aiProviders; track provider.value) {
                        <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Clima</mat-label>
                    <mat-select [ngModel]="config.config().integrations.weatherProvider" (ngModelChange)="selectIntegrationProvider('weatherProvider', $event)">
                      @for (provider of forecastProviders; track provider.value) {
                        <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Inundaciones</mat-label>
                    <mat-select [ngModel]="config.config().integrations.floodProvider" (ngModelChange)="selectIntegrationProvider('floodProvider', $event)">
                      @for (provider of floodProviders; track provider.value) {
                        <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </mat-card>

              <div class="integration-grid with-margin">
                @for (service of apiKeyServices; track service.key) {
                  <mat-card class="integration-card" [class.active]="apiKeyServiceActive(service.key)">
                    <div class="integration-heading">
                      <mat-icon>{{ service.icon }}</mat-icon>
                      <div>
                        <strong>{{ service.label }}</strong>
                        <span>{{ service.description }}</span>
                      </div>
                      <div class="integration-states">
                        @if (apiKeyServiceActive(service.key)) {
                          <small class="active">Activo</small>
                        }
                        <small>Backend</small>
                      </div>
                    </div>
                    <p class="hint">Configurar solo en backend.</p>
                  </mat-card>
                }
              </div>
            }

            @case ('weather') {
              <div class="section-title">
                <div>
                  <h2>Clima e inundaciones</h2>
                  <p>Configura proveedores, umbrales y reglas para activar reportes automaticos por posible inundacion.</p>
                </div>
                <mat-chip>{{ config.config().weather.floodProvider }}</mat-chip>
              </div>

              <div class="library-grid">
                <mat-card class="library-section">
                  <h3>Proveedores recomendados</h3>
                  <div class="field-grid three">
                    <mat-form-field appearance="outline">
                      <mat-label>Pronostico lluvia</mat-label>
                      <mat-select [ngModel]="config.config().integrations.weatherProvider" (ngModelChange)="selectIntegrationProvider('weatherProvider', $event)">
                        @for (provider of forecastProviders; track provider.value) {
                          <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Caudal / inundacion</mat-label>
                      <mat-select [ngModel]="config.config().integrations.floodProvider" (ngModelChange)="selectIntegrationProvider('floodProvider', $event)">
                        @for (provider of floodProviders; track provider.value) {
                          <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Proveedor premium</mat-label>
                      <mat-select [ngModel]="config.config().weather.premiumProvider" (ngModelChange)="config.updateWeather({ premiumProvider: $event })">
                        @for (provider of premiumWeatherProviders; track provider.value) {
                          <mat-option [value]="provider.value">{{ provider.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    @if (config.config().weather.premiumProvider !== 'Ninguno') {
                    <p class="hint wide-field">La API key del proveedor premium se configura en el backend; Angular solo guarda el proveedor seleccionado.</p>
                    }
                  </div>
                  <div class="recommendation-list">
                    <article>
                      <strong>Open-Meteo Forecast</strong>
                      <span>Lluvia horaria e intensidad. Base recomendada para MVP.</span>
                    </article>
                    <article>
                      <strong>Open-Meteo Flood / GloFAS</strong>
                      <span>Caudal fluvial global. Complementa la lluvia para reducir falsos positivos.</span>
                    </article>
                    <article>
                      <strong>Tomorrow.io o Meteomatics</strong>
                      <span>Proveedor premium para nowcasting hiperlocal, radar y capas avanzadas.</span>
                    </article>
                    <article>
                      <strong>AccuWeather, WeatherAPI, OpenWeather o Visual Crossing</strong>
                      <span>Alternativas comerciales para pronostico, clima actual e historico por ciudad o coordenadas.</span>
                    </article>
                    <article>
                      <strong>Windy, Weatherbit o IBM Weather</strong>
                      <span>Opciones avanzadas para capas meteorologicas, modelos y datos operativos.</span>
                    </article>
                    <article>
                      <strong>INDOMET / ONAMET, COE, INDRHI</strong>
                      <span>Validacion oficial local cuando haya datos o boletines integrables.</span>
                    </article>
                  </div>
                </mat-card>

                <mat-card class="library-section">
                  <div class="section-row">
                    <h3>Fuentes activas</h3>
                    <button mat-stroked-button type="button" (click)="runWeatherFloodScan()" [disabled]="weatherFloodScanRunning">
                      <mat-icon>{{ weatherFloodScanRunning ? 'sync' : 'task_alt' }}</mat-icon>
                      {{ weatherFloodScanRunning ? 'Verificando...' : 'Verificar clima ahora' }}
                    </button>
                  </div>
                  <div class="toggle-grid">
                    <mat-slide-toggle [checked]="config.config().weather.useOpenMeteoForecast" (change)="config.updateWeather({ useOpenMeteoForecast: $event.checked })">
                      Open-Meteo Forecast
                    </mat-slide-toggle>
                    <mat-slide-toggle [checked]="googleForecastEnabled()" (change)="toggleGoogleForecast($event.checked)">
                      Google Forecast
                    </mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().weather.useOpenMeteoFlood" (change)="config.updateWeather({ useOpenMeteoFlood: $event.checked })">
                      Open-Meteo Flood / GloFAS
                    </mat-slide-toggle>
                    <mat-slide-toggle [checked]="googleFloodEnabled()" (change)="toggleGoogleFlood($event.checked)">
                      Google Flood Forecasting
                    </mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().weather.usePremiumNowcasting" (change)="config.updateWeather({ usePremiumNowcasting: $event.checked })">
                      Nowcasting premium
                    </mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().weather.useOfficialAlerts" (change)="config.updateWeather({ useOfficialAlerts: $event.checked })">
                      Alertas oficiales
                    </mat-slide-toggle>
                    <mat-slide-toggle [checked]="config.config().weather.floodMonitorEnabled" (change)="config.updateWeather({ floodMonitorEnabled: $event.checked })">
                      Monitoreo automatico
                    </mat-slide-toggle>
                  </div>
                </mat-card>

                <mat-card class="library-section">
                  <h3>Reglas de activacion</h3>
                  <div class="weather-rules-grid">
                    <mat-form-field appearance="outline" class="countries-field">
                      <mat-label>Paises monitoreados</mat-label>
                      <mat-select
                        multiple
                        [ngModel]="selectedFloodMonitorCountries()"
                        (ngModelChange)="updateFloodMonitorCountries($event)">
                        <mat-select-trigger>
                          {{ selectedFloodMonitorCountriesLabel() }}
                        </mat-select-trigger>
                        @for (country of floodMonitorCountries; track country.code) {
                          <mat-option [value]="country.code">
                            <span class="country-option">
                              <strong>{{ country.name }}</strong>
                              <small>{{ country.coverage }}</small>
                            </span>
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="points-field">
                      <mat-label>Puntos monitoreados JSON</mat-label>
                      <textarea matInput rows="4" [ngModel]="config.config().weather.floodMonitorPoints" (ngModelChange)="config.updateWeather({ floodMonitorPoints: $event })"></textarea>
                    </mat-form-field>
                  </div>
                  <div class="weather-threshold-grid">
                    <mat-form-field appearance="outline">
                      <mat-label>Intervalo monitoreo min</mat-label>
                      <input matInput type="number" min="5" [ngModel]="config.config().weather.monitorIntervalMinutes" (ngModelChange)="config.updateWeather({ monitorIntervalMinutes: numberValue($event, 30) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Anticipacion min</mat-label>
                      <input matInput type="number" min="0" [ngModel]="config.config().weather.activationLeadMinutes" (ngModelChange)="config.updateWeather({ activationLeadMinutes: numberValue($event, 30) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>TTL mapa horas</mat-label>
                      <input matInput type="number" min="1" [ngModel]="config.config().weather.automaticFloodReportTtlHours" (ngModelChange)="config.updateWeather({ automaticFloodReportTtlHours: numberValue($event, 4) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Lluvia intensa mm/h</mat-label>
                      <input matInput type="number" min="1" [ngModel]="config.config().weather.intenseRainHourlyThresholdMm" (ngModelChange)="config.updateWeather({ intenseRainHourlyThresholdMm: numberValue($event, 10) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Acumulado 3h mm</mat-label>
                      <input matInput type="number" min="1" [ngModel]="config.config().weather.intenseRainThreeHourThresholdMm" (ngModelChange)="config.updateWeather({ intenseRainThreeHourThresholdMm: numberValue($event, 20) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Probabilidad minima %</mat-label>
                      <input matInput type="number" min="0" max="100" [ngModel]="config.config().weather.intenseRainProbabilityThreshold" (ngModelChange)="config.updateWeather({ intenseRainProbabilityThreshold: numberValue($event, 60) })" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Multiplicador caudal p75</mat-label>
                      <input matInput type="number" min="1" step="0.05" [ngModel]="config.config().weather.riverDischargeMultiplier" (ngModelChange)="config.updateWeather({ riverDischargeMultiplier: numberValue($event, 1.25) })" />
                    </mat-form-field>
                  </div>
                  <p class="hint">Si defines puntos JSON, el monitor revisa solo esos puntos. Si el campo queda vacio, se usa cobertura nacional para todos los paises seleccionados.</p>
                </mat-card>
              </div>
            }

            @case ('external-logs') {
              <div class="section-title">
                <div>
                  <h2>Logs de APIs externas</h2>
                  <p>Errores tecnicos de proveedores externos. Estos detalles no se muestran al usuario final.</p>
                </div>
                <div class="section-actions">
                  <button mat-stroked-button type="button" (click)="loadExternalApiLogs()" [disabled]="externalApiLogsLoading">
                    <mat-icon>{{ externalApiLogsLoading ? 'sync' : 'refresh' }}</mat-icon>
                    Actualizar
                  </button>
                  <button mat-stroked-button type="button" (click)="clearExternalApiLogs()" [disabled]="externalApiLogsLoading || !externalApiLogsTotal">
                    <mat-icon>delete_sweep</mat-icon>
                    Limpiar
                  </button>
                </div>
              </div>

              @if (!externalApiLogs.length && !externalApiLogsLoading) {
                <div class="empty-state">
                  <mat-icon>task_alt</mat-icon>
                  <strong>Sin errores registrados</strong>
                  <p>Cuando una API externa falle, el detalle tecnico aparecera aqui para diagnostico.</p>
                </div>
              } @else {
                <div class="external-log-list">
                  @for (log of externalApiLogs; track log.id) {
                    <article class="external-log-card">
                      <div class="external-log-head">
                        <span class="external-log-provider">{{ log.provider }}</span>
                        <strong>{{ log.service }}</strong>
                        <small>{{ log.createdAt | date:'short' }}</small>
                      </div>
                      <div class="external-log-body">
                        <span class="external-log-status" [class.warning]="(log.status ?? 0) >= 400">{{ log.status || 'Sin status' }}</span>
                        <div>
                          <strong>{{ log.operation }}</strong>
                          <p>{{ log.message }}</p>
                          @if (log.details) {
                            <pre>{{ log.details }}</pre>
                          }
                        </div>
                      </div>
                    </article>
                  }
                </div>
                <mat-paginator
                  class="external-log-paginator"
                  [length]="externalApiLogsTotal"
                  [pageIndex]="externalApiLogsPageIndex"
                  [pageSize]="externalApiLogsPageSize"
                  [pageSizeOptions]="[10, 20, 50]"
                  (page)="onExternalApiLogsPage($event)">
                </mat-paginator>
              }
            }

          }
        </mat-card>
      </section>
    </section>
  `,
  styleUrls: ['./system-admin.component.css'],
})
export class SystemAdminComponent implements OnInit {
  activeSection: AdminSettingsSection = 'categories';
  weatherFloodScanRunning = false;
  savingMapSettings = false;
  uploadingCategoryPhoto: ReportCategory | null = null;
  externalApiLogs: ExternalApiLogEntry[] = [];
  externalApiLogsLoading = false;
  externalApiLogsTotal = 0;
  externalApiLogsPageIndex = 0;
  externalApiLogsPageSize = 10;
  visibleSocialCredentials: Partial<Record<keyof SystemSocialAuthConfig, boolean>> = {};
  readonly storageProviders = [
    { id: 'Local uploads', label: 'Local uploads', description: 'Archivos en disco del servidor', icon: 'folder' },
    { id: 'S3 compatible', label: 'S3 compatible', description: 'AWS S3, MinIO o DigitalOcean Spaces', icon: 'cloud' },
    { id: 'Azure Blob', label: 'Azure Blob', description: 'Contenedores de Azure Storage', icon: 'cloud_queue' },
  ];
  readonly sections: Array<{ id: AdminSettingsSection; label: string; description: string; icon: string }> = [
    { id: 'categories', label: 'Categorias', description: 'Riesgos y emergencias', icon: 'category' },
    { id: 'auth', label: 'Login social', description: 'Google y Facebook', icon: 'admin_panel_settings' },
    { id: 'features', label: 'Feature flags', description: 'Activar funciones', icon: 'flag' },
    { id: 'gamification', label: 'Insignias', description: 'Puntos y logros', icon: 'emoji_events' },
    { id: 'storage', label: 'Almacenamiento', description: 'Evidencias y retencion', icon: 'folder_managed' },
    { id: 'maps', label: 'Mapas', description: 'Proveedores y rutas', icon: 'map' },
    { id: 'libraries', label: 'Librerias', description: 'Graficos y UI', icon: 'extension' },
    { id: 'integrations', label: 'Integraciones', description: 'Proveedores y estado', icon: 'key' },
    { id: 'weather', label: 'Clima', description: 'Inundaciones y pronosticos', icon: 'waves' },
    { id: 'external-logs', label: 'Logs externos', description: 'Errores de APIs', icon: 'bug_report' },
  ];
  readonly riskLevels = [1, 2, 3, 4, 5];
  readonly apiKeyServices: Array<{ key: keyof SystemApiKeysConfig; label: string; description: string; icon: string }> = [
    { key: 'maptiler', label: 'MapTiler', description: 'Mapas base, geocodificacion y modo hibrido.', icon: 'map' },
    { key: 'googleMaps', label: 'Google Maps', description: 'Map Tiles, Routes API y Geocoding de Google Maps Platform.', icon: 'satellite_alt' },
    { key: 'openRouteService', label: 'OpenRouteService', description: 'Optimizacion de rutas y calculo de trayectos.', icon: 'alt_route' },
    { key: 'openAi', label: 'OpenAI', description: 'Clasificacion, resumen e inteligencia asistida.', icon: 'auto_awesome' },
    { key: 'accuWeather', label: 'AccuWeather', description: 'Clima actual, pronostico y alertas comerciales.', icon: 'wb_sunny' },
    { key: 'openWeatherMap', label: 'OpenWeatherMap', description: 'Clima actual, pronostico y datos historicos.', icon: 'partly_cloudy_day' },
    { key: 'weatherApi', label: 'WeatherAPI.com', description: 'Pronostico, historico, alertas y calidad de aire.', icon: 'cloud_sync' },
    { key: 'visualCrossing', label: 'Visual Crossing', description: 'Pronostico e historico meteorologico por coordenadas.', icon: 'query_stats' },
    { key: 'weatherbit', label: 'Weatherbit', description: 'Pronostico, clima actual y alertas por ubicacion.', icon: 'rainy' },
    { key: 'windy', label: 'Windy API', description: 'Capas meteorologicas, radar y visualizacion avanzada.', icon: 'air' },
    { key: 'ibmWeather', label: 'IBM Weather', description: 'Datos empresariales de The Weather Company.', icon: 'business' },
    { key: 'googleForecast', label: 'Google Forecast', description: 'Pronostico meteorologico de Google por coordenadas.', icon: 'partly_cloudy_day' },
    { key: 'tomorrowIo', label: 'Tomorrow.io', description: 'Nowcasting y datos meteorologicos premium.', icon: 'cloud_queue' },
    { key: 'meteomatics', label: 'Meteomatics', description: 'Pronostico meteorologico premium alternativo.', icon: 'cloud' },
    { key: 'googleFloodForecasting', label: 'Google Flood Forecasting', description: 'Proveedor de prediccion de inundaciones.', icon: 'waves' },
    { key: 'localWeatherAuthority', label: 'Autoridad local', description: 'Token o credencial para INDOMET/ONAMET, COE, INDRHI u otra entidad.', icon: 'account_balance' },
  ];
  readonly socialAuthProviders: Array<{ key: 'google' | 'facebook'; label: string; description: string; hint: string; icon: string }> = [
    {
      key: 'google',
      label: 'Google',
      description: 'Registro e inicio de sesion con cuenta Google.',
      hint: 'Recomendado para usuarios ciudadanos y equipos internos con correo corporativo.',
      icon: 'account_circle',
    },
    {
      key: 'facebook',
      label: 'Facebook',
      description: 'Registro e inicio de sesion con perfil Facebook.',
      hint: 'Util para adopcion ciudadana, siempre que la app tenga permiso email aprobado.',
      icon: 'public',
    },
  ];
  readonly mapProviders = [
    { value: 'MapTiler', label: 'MapTiler' },
    { value: 'OpenStreetMap', label: 'OpenStreetMap' },
    { value: 'Google Maps', label: 'Google Maps' },
  ];
  readonly geocodingProviders = [
    { value: 'MapTiler Geocoding', label: 'MapTiler Geocoding' },
    { value: 'OpenStreetMap Nominatim', label: 'OpenStreetMap Nominatim' },
    { value: 'Google Geocoding', label: 'Google Geocoding' },
    { value: 'Proveedor local', label: 'Proveedor local' },
  ];
  readonly routingProviders = [
    { value: 'OSRM publico', label: 'OSRM publico' },
    { value: 'OSRM privado', label: 'OSRM privado' },
    { value: 'OpenRouteService', label: 'OpenRouteService' },
    { value: 'Google Routes', label: 'Google Routes' },
    { value: 'MapTiler routing', label: 'MapTiler routing' },
    { value: 'GraphHopper', label: 'GraphHopper' },
    { value: 'Valhalla', label: 'Valhalla' },
  ];
  readonly mapThemeColorFields: Array<{ key: keyof Pick<SystemMapThemeConfig, 'background' | 'land' | 'park' | 'water' | 'building' | 'buildingOutline' | 'road' | 'roadPrimary' | 'roadSecondary' | 'roadCasing' | 'label' | 'labelMuted' | 'poi' | 'boundary'>; label: string }> = [
    { key: 'background', label: 'Fondo' },
    { key: 'land', label: 'Terreno' },
    { key: 'park', label: 'Verde' },
    { key: 'water', label: 'Agua' },
    { key: 'building', label: 'Edificios' },
    { key: 'buildingOutline', label: 'Borde edif.' },
    { key: 'road', label: 'Calles' },
    { key: 'roadPrimary', label: 'Vias principales' },
    { key: 'roadSecondary', label: 'Vias secundarias' },
    { key: 'roadCasing', label: 'Borde vias' },
    { key: 'label', label: 'Texto' },
    { key: 'labelMuted', label: 'Texto vias' },
    { key: 'poi', label: 'POI' },
    { key: 'boundary', label: 'Limites' },
  ];
  readonly googleMapFilterFields: Array<{ key: keyof Pick<SystemMapThemeConfig, 'googleBrightnessMin' | 'googleBrightnessMax' | 'googleContrast' | 'googleSaturation' | 'googleHueRotate'>; label: string; min: number; max: number; step: number }> = [
    { key: 'googleBrightnessMin', label: 'Brillo min.', min: 0, max: 1, step: 0.01 },
    { key: 'googleBrightnessMax', label: 'Brillo max.', min: 0, max: 1, step: 0.01 },
    { key: 'googleContrast', label: 'Contraste', min: -1, max: 1, step: 0.01 },
    { key: 'googleSaturation', label: 'Saturacion', min: -1, max: 1, step: 0.01 },
    { key: 'googleHueRotate', label: 'Tono', min: -180, max: 180, step: 1 },
  ];
  readonly aiProviders = [
    { value: 'OpenAI', label: 'OpenAI' },
    { value: 'Azure OpenAI', label: 'Azure OpenAI' },
    { value: 'Proveedor local', label: 'Proveedor local' },
    { value: 'Desactivado', label: 'Desactivado' },
  ];
  readonly forecastProviders = [
    { value: 'Open-Meteo Forecast', label: 'Open-Meteo Forecast' },
    { value: 'AccuWeather Forecast API', label: 'AccuWeather Forecast API' },
    { value: 'OpenWeatherMap One Call', label: 'OpenWeatherMap One Call' },
    { value: 'WeatherAPI.com Forecast', label: 'WeatherAPI.com Forecast' },
    { value: 'Visual Crossing Weather', label: 'Visual Crossing Weather' },
    { value: 'Weatherbit Forecast', label: 'Weatherbit Forecast' },
    { value: 'Google Weather Forecast API', label: 'Google Weather Forecast API' },
    { value: 'Tomorrow.io Weather Forecast', label: 'Tomorrow.io Weather Forecast' },
    { value: 'Meteomatics Weather API', label: 'Meteomatics Weather API' },
    { value: 'IBM Environmental Intelligence', label: 'IBM Environmental Intelligence' },
    { value: 'Proveedor local / INDOMET', label: 'Proveedor local / INDOMET' },
  ];
  readonly floodProviders = [
    { value: 'Open-Meteo Flood / GloFAS', label: 'Open-Meteo Flood / GloFAS' },
    { value: 'Google Flood Forecasting API', label: 'Google Flood Forecasting API' },
    { value: 'INDOMET / INDRHI / COE local', label: 'INDOMET / INDRHI / COE local' },
    { value: 'NOAA / NHC Alerts', label: 'NOAA / NHC Alerts' },
    { value: 'Tomorrow.io Flood Insights', label: 'Tomorrow.io Flood Insights' },
    { value: 'Meteomatics Hydrology', label: 'Meteomatics Hydrology' },
    { value: 'Proveedor local', label: 'Proveedor local' },
  ];
  readonly premiumWeatherProviders = [
    { value: 'Ninguno', label: 'Ninguno' },
    { value: 'AccuWeather', label: 'AccuWeather' },
    { value: 'OpenWeatherMap', label: 'OpenWeatherMap' },
    { value: 'WeatherAPI.com', label: 'WeatherAPI.com' },
    { value: 'Visual Crossing', label: 'Visual Crossing' },
    { value: 'Weatherbit', label: 'Weatherbit' },
    { value: 'Windy API', label: 'Windy API' },
    { value: 'IBM Weather', label: 'IBM Weather' },
    { value: 'Google Forecast', label: 'Google Forecast' },
    { value: 'Tomorrow.io', label: 'Tomorrow.io' },
    { value: 'Meteomatics', label: 'Meteomatics' },
    { value: 'Google Flood Forecasting API', label: 'Google Flood Forecasting API' },
    { value: 'Autoridad local', label: 'Autoridad local' },
  ];
  readonly floodMonitorCountries = [
    { code: 'DO', name: 'Republica Dominicana', coverage: 'Cobertura nacional integrada' },
    { code: 'HT', name: 'Haiti', coverage: 'Cobertura nacional integrada' },
    { code: 'PR', name: 'Puerto Rico', coverage: 'Cobertura nacional integrada' },
    { code: 'JM', name: 'Jamaica', coverage: 'Cobertura nacional integrada' },
    { code: 'CU', name: 'Cuba', coverage: 'Cobertura nacional integrada' },
    { code: 'BS', name: 'Bahamas', coverage: 'Cobertura nacional integrada' },
    { code: 'TC', name: 'Turcas y Caicos', coverage: 'Cobertura nacional integrada' },
    { code: 'CO', name: 'Colombia', coverage: 'Cobertura nacional integrada' },
    { code: 'VE', name: 'Venezuela', coverage: 'Cobertura nacional integrada' },
    { code: 'PA', name: 'Panama', coverage: 'Cobertura nacional integrada' },
  ];
  visibleApiKeys: Partial<Record<keyof SystemApiKeysConfig, boolean>> = {};
  readonly pointSettings = [
    { key: 'pointsReportCreated', label: 'Reporte creado', fallback: 10 },
    { key: 'pointsValidatedReport', label: 'Reporte validado', fallback: 30 },
    { key: 'pointsResolvedReport', label: 'Reporte resuelto', fallback: 20 },
    { key: 'pointsHighRiskReport', label: 'Riesgo alto', fallback: 10 },
    { key: 'pointsLessonCompleted', label: 'Leccion completada', fallback: 25 },
    { key: 'pointsHighEducationScore', label: 'Bono educativo', fallback: 10 },
    { key: 'pointsProfileComplete', label: 'Perfil completo', fallback: 40 },
  ];
  readonly badgeSettings = [
    { key: 'firstReportThreshold', label: 'Primer aviso', fallback: 1 },
    { key: 'activeReporterThreshold', label: 'Reportero activo', fallback: 5 },
    { key: 'trustedReporterThreshold', label: 'Fuente confiable', fallback: 3 },
    { key: 'highRiskWatcherThreshold', label: 'Guardian vial', fallback: 3 },
    { key: 'roadScholarThreshold', label: 'Aprendiz vial', fallback: 3 },
    { key: 'profileCompleteThreshold', label: 'Perfil completo %', fallback: 80 },
    { key: 'pointsBronzeThreshold', label: 'Bronce puntos', fallback: 100 },
    { key: 'pointsSilverThreshold', label: 'Plata puntos', fallback: 300 },
    { key: 'pointsGoldThreshold', label: 'Oro puntos', fallback: 700 },
  ];

  constructor(
    public readonly config: SystemConfigService,
    public readonly featureFlags: FeatureFlagsService,
    public readonly gamification: GamificationService,
    private readonly reportsService: ReportsService,
    private readonly route: ActivatedRoute,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.gamification.load();
    this.featureFlags.load().subscribe();
    this.config.loadWeatherConfig();
    this.config.loadSocialAuthConfig();
    this.route.queryParamMap.subscribe((params) => {
      const section = params.get('section');
      this.activeSection = this.isValidSection(section) ? section : 'categories';
      if (this.activeSection === 'external-logs') this.loadExternalApiLogs();
    });
  }

  loadExternalApiLogs() {
    this.externalApiLogsLoading = true;
    this.config.externalApiLogs({
      page: this.externalApiLogsPageIndex + 1,
      limit: this.externalApiLogsPageSize,
    }).subscribe({
      next: (page) => {
        this.externalApiLogs = page.data;
        this.externalApiLogsTotal = page.total;
        this.externalApiLogsLoading = false;
      },
      error: () => {
        this.externalApiLogsLoading = false;
        this.toastr.error('No se pudieron cargar los logs externos.', 'Sistema');
      },
    });
  }

  clearExternalApiLogs() {
    this.externalApiLogsLoading = true;
    this.config.clearExternalApiLogs().subscribe({
      next: () => {
        this.externalApiLogs = [];
        this.externalApiLogsTotal = 0;
        this.externalApiLogsPageIndex = 0;
        this.externalApiLogsLoading = false;
        this.toastr.success('Logs externos limpiados.', 'Sistema');
      },
      error: () => {
        this.externalApiLogsLoading = false;
        this.toastr.error('No se pudieron limpiar los logs externos.', 'Sistema');
      },
    });
  }

  onExternalApiLogsPage(event: PageEvent) {
    this.externalApiLogsPageIndex = event.pageIndex;
    this.externalApiLogsPageSize = event.pageSize;
    this.loadExternalApiLogs();
  }

  updateCategory(category: ReportCategory, patch: Parameters<SystemConfigService['updateCategory']>[1]) {
    this.config.updateCategory(category, patch);
    this.toastr.success('Configuracion de categoria actualizada.', 'Sistema');
  }

  uploadCategoryDefaultPhoto(category: ReportCategory, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadingCategoryPhoto = category;
    this.config.uploadCategoryDefaultPhoto(category, file).subscribe({
      next: () => {
        this.uploadingCategoryPhoto = null;
        this.toastr.success('Imagen por defecto actualizada.', 'Categorias');
      },
      error: (error) => {
        this.uploadingCategoryPhoto = null;
        this.toastr.error(error?.error?.message || 'No se pudo cargar la imagen.', 'Categorias');
      },
    });
  }

  categoryPhotoUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return url.startsWith('/uploads') ? `${API_URL.replace(/\/api\/?$/, '')}${url}` : url;
  }

  hideBrokenImage(event: Event) {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
  }

  clampRisk(value: string | number): number {
    return Math.min(5, Math.max(1, this.numberValue(value, 3)));
  }

  riskLabel(value: number): string {
    if (value >= 5) return 'Critico';
    if (value >= 4) return 'Alto';
    if (value >= 3) return 'Medio';
    if (value >= 2) return 'Bajo';
    return 'Minimo';
  }

  categoryIcon(categoryId: string): string {
    const normalized = categoryId.toLowerCase();
    const icons: Array<[string, string]> = [
      ['inund', 'water_damage'],
      ['flood', 'water_damage'],
      ['semaforo', 'traffic'],
      ['traffic', 'traffic'],
      ['via', 'construction'],
      ['road', 'construction'],
      ['cruce', 'signpost'],
      ['cross', 'signpost'],
      ['ilumin', 'lightbulb'],
      ['light', 'lightbulb'],
      ['senal', 'wrong_location'],
      ['signal', 'wrong_location'],
      ['policia', 'local_police'],
      ['police', 'local_police'],
    ];
    return icons.find(([key]) => normalized.includes(key))?.[1] ?? 'report_problem';
  }

  numberValue(value: string | number, fallback: number): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  fileTypesText(): string {
    return this.config.config().storage.allowedFileTypes.join(', ');
  }

  updateAllowedFileTypes(value: string) {
    const allowedFileTypes = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    this.config.updateStorage({ allowedFileTypes });
  }

  resetDefaults() {
    this.config.resetDefaults();
    this.toastr.info('Se restauro la configuracion base.', 'Sistema');
  }

  updateApiKey(key: keyof SystemApiKeysConfig, value: string) {
    this.config.updateApiKeys({ [key]: value } as Partial<SystemApiKeysConfig>);
  }

  saveSettings() {
    if (this.savingMapSettings) return;

    this.savingMapSettings = true;
    this.config.saveConfig().subscribe({
      next: () => {
        this.savingMapSettings = false;
        this.toastr.success('Configuracion guardada en la base de datos.', 'Sistema');
      },
      error: (error) => {
        this.savingMapSettings = false;
        this.toastr.error(error?.error?.message || 'No se pudo guardar la configuracion en la base de datos.', 'Sistema');
      },
    });
  }

  activeIntegrationSummary() {
    const integrations = this.config.config().integrations;
    return [
      { key: 'mapProvider', label: 'Mapa', value: integrations.mapProvider },
      { key: 'geocodingProvider', label: 'Geocodificacion', value: integrations.geocodingProvider },
      { key: 'routingProvider', label: 'Rutas', value: integrations.routingProvider },
      { key: 'aiProvider', label: 'IA', value: integrations.aiProvider },
      { key: 'weatherProvider', label: 'Clima', value: integrations.weatherProvider },
      { key: 'floodProvider', label: 'Inundaciones', value: integrations.floodProvider },
    ];
  }

  selectIntegrationProvider(key: keyof SystemIntegrationConfig, value: string) {
    this.config.updateIntegrations({ [key]: value } as Partial<SystemIntegrationConfig>);
    if (key === 'mapProvider') {
      this.config.updateLibraries({ mapRenderer: value === 'Google Maps' ? 'Google Maps' : this.config.config().libraries.mapRenderer === 'Google Maps' ? 'MapLibre GL' : this.config.config().libraries.mapRenderer });
    }
    if (key === 'weatherProvider') this.config.updateWeather({ weatherProvider: value });
    if (key === 'floodProvider') this.config.updateWeather({ floodProvider: value });
    this.toastr.success('Proveedor activo actualizado.', 'Integraciones');
  }

  selectMapRenderer(value: string) {
    this.config.updateLibraries({ mapRenderer: value });
    if (value === 'Google Maps') {
      this.config.updateIntegrations({ mapProvider: 'Google Maps' });
    }
    this.toastr.success('Render del mapa actualizado.', 'Librerias');
  }

  updateMapThemeColor(mode: 'light' | 'dark', key: keyof SystemMapThemeConfig, value: string) {
    const libraries = this.config.config().libraries;
    const property = mode === 'light' ? 'mapThemeLight' : 'mapThemeDark';
    this.config.updateLibraries({
      [property]: {
        ...libraries[property],
        [key]: value,
      },
    } as Partial<typeof libraries>);
  }

  updateMapThemeNumber(mode: 'light' | 'dark', key: keyof SystemMapThemeConfig, value: number | string) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const libraries = this.config.config().libraries;
    const property = mode === 'light' ? 'mapThemeLight' : 'mapThemeDark';
    this.config.updateLibraries({
      [property]: {
        ...libraries[property],
        [key]: numericValue,
      },
    } as Partial<typeof libraries>);
  }

  formatMapSliderValue(field: (typeof this.googleMapFilterFields)[number], value: number | string): string {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '0';
    if (field.key === 'googleHueRotate') return `${Math.round(numericValue)}deg`;
    if (field.key === 'googleBrightnessMin' || field.key === 'googleBrightnessMax') return `${Math.round(numericValue * 100)}%`;
    return numericValue.toFixed(2);
  }

  formatMapSliderTick(field: (typeof this.googleMapFilterFields)[number], value: number): string {
    if (field.key === 'googleHueRotate') return `${value}deg`;
    if (field.key === 'googleBrightnessMin' || field.key === 'googleBrightnessMax') return `${Math.round(value * 100)}%`;
    return value.toString();
  }

  applyMapThemePreset(preset: 'korvi' | 'cool' | 'mono') {
    const themes = {
      korvi: {
        light: {
          background: '#EEF7F6', land: '#F7FBF9', park: '#DDF3E6', water: '#B9E7EF', building: '#E2EBF0', buildingOutline: '#CFDDE4',
          road: '#FFFFFF', roadPrimary: '#A7DCD7', roadSecondary: '#D5E7EF', roadCasing: '#8FBFCA', label: '#163548', labelMuted: '#657A86',
          poi: '#4F8F8B', boundary: '#9ABFC3', googleBrightnessMin: 0.06, googleBrightnessMax: 0.98, googleContrast: 0.1, googleSaturation: -0.28, googleHueRotate: 22,
        },
        dark: {
          background: '#0D1B24', land: '#12242A', park: '#153B32', water: '#123F51', building: '#1B3039', buildingOutline: '#284652',
          road: '#38525D', roadPrimary: '#4FA3A0', roadSecondary: '#53778A', roadCasing: '#0A1821', label: '#E5F3F1', labelMuted: '#A8BDC2',
          poi: '#98D6CF', boundary: '#4F737A', googleBrightnessMin: 0.04, googleBrightnessMax: 0.74, googleContrast: 0.14, googleSaturation: -0.32, googleHueRotate: 16,
        },
      },
      cool: {
        light: {
          background: '#EEF6FA', land: '#F8FBFC', park: '#E4F2EE', water: '#B7DEF1', building: '#E4EBF3', buildingOutline: '#D0DBE8',
          road: '#FFFFFF', roadPrimary: '#9CC7E6', roadSecondary: '#D8E8F4', roadCasing: '#A8C5D8', label: '#17354A', labelMuted: '#60788A',
          poi: '#4E86A6', boundary: '#A7C2D3', googleBrightnessMin: 0.07, googleBrightnessMax: 0.98, googleContrast: 0.08, googleSaturation: -0.34, googleHueRotate: 8,
        },
        dark: {
          background: '#0B1824', land: '#111F2C', park: '#17312F', water: '#10354A', building: '#1B2B38', buildingOutline: '#2B4354',
          road: '#334E61', roadPrimary: '#5AA5C7', roadSecondary: '#4F7185', roadCasing: '#08131E', label: '#E2F0F7', labelMuted: '#A6BBC7',
          poi: '#91D5E8', boundary: '#4B6D80', googleBrightnessMin: 0.04, googleBrightnessMax: 0.72, googleContrast: 0.16, googleSaturation: -0.38, googleHueRotate: 6,
        },
      },
      mono: {
        light: {
          background: '#F3F6F8', land: '#FAFBFC', park: '#E9F1ED', water: '#D4E6ED', building: '#E8EDF1', buildingOutline: '#D4DDE5',
          road: '#FFFFFF', roadPrimary: '#CAD9E1', roadSecondary: '#E1E9EE', roadCasing: '#B8C8D2', label: '#1E3442', labelMuted: '#697987',
          poi: '#607A85', boundary: '#B2C0C8', googleBrightnessMin: 0.08, googleBrightnessMax: 0.98, googleContrast: 0.06, googleSaturation: -0.55, googleHueRotate: 0,
        },
        dark: {
          background: '#101820', land: '#151F27', park: '#1D2A2C', water: '#182D38', building: '#202B34', buildingOutline: '#34424D',
          road: '#3A4A55', roadPrimary: '#60717B', roadSecondary: '#4B5C66', roadCasing: '#0C1218', label: '#EDF2F5', labelMuted: '#B4C0C7',
          poi: '#B8C8CC', boundary: '#5D707A', googleBrightnessMin: 0.04, googleBrightnessMax: 0.7, googleContrast: 0.12, googleSaturation: -0.6, googleHueRotate: 0,
        },
      },
    }[preset];

    this.config.updateLibraries({ mapThemeLight: themes.light, mapThemeDark: themes.dark });
    this.toastr.success('Tema del mapa actualizado.', 'Mapas');
  }

  weatherPremiumApiKeyName(): keyof SystemApiKeysConfig {
    const provider = this.config.config().weather.premiumProvider;
    const keys: Record<string, keyof SystemApiKeysConfig> = {
      AccuWeather: 'accuWeather',
      OpenWeatherMap: 'openWeatherMap',
      'WeatherAPI.com': 'weatherApi',
      'Visual Crossing': 'visualCrossing',
      Weatherbit: 'weatherbit',
      'Windy API': 'windy',
      'IBM Weather': 'ibmWeather',
      'Google Forecast': 'googleForecast',
      'Tomorrow.io': 'tomorrowIo',
      Meteomatics: 'meteomatics',
      'Google Flood Forecasting API': 'googleFloodForecasting',
      'Autoridad local': 'localWeatherAuthority',
    };
    return keys[provider] ?? 'tomorrowIo';
  }

  weatherPremiumApiKeyValue(): string {
    return this.config.config().apiKeys[this.weatherPremiumApiKeyName()];
  }

  updateWeatherPremiumApiKey(value: string) {
    const key = this.weatherPremiumApiKeyName();
    this.config.updateApiKeys({ [key]: value } as Partial<SystemApiKeysConfig>);
    this.config.updateWeather({ premiumApiKey: value });
  }

  googleForecastEnabled(): boolean {
    const weather = this.config.config().weather;
    return weather.weatherProvider === 'Google Weather Forecast API' || weather.premiumProvider === 'Google Forecast';
  }

  toggleGoogleForecast(enabled: boolean) {
    if (enabled) {
      const apiKey =
        this.config.config().apiKeys.googleForecast ||
        this.config.config().apiKeys.googleMaps ||
        this.config.config().weather.premiumApiKey;
      this.config.updateIntegrations({ weatherProvider: 'Google Weather Forecast API' });
      this.config.updateWeather({
        weatherProvider: 'Google Weather Forecast API',
        premiumProvider: 'Google Forecast',
        premiumApiKey: apiKey,
      });
      this.toastr.success('Google Forecast activado.', 'Clima');
      return;
    }

    this.config.updateIntegrations({ weatherProvider: 'Open-Meteo Forecast' });
    this.config.updateWeather({
      weatherProvider: 'Open-Meteo Forecast',
      premiumProvider: 'Ninguno',
      premiumApiKey: '',
    });
    this.toastr.info('Google Forecast desactivado.', 'Clima');
  }

  googleFloodEnabled(): boolean {
    return this.config.config().weather.floodProvider === 'Google Flood Forecasting API';
  }

  toggleGoogleFlood(enabled: boolean) {
    if (enabled) {
      const apiKey =
        this.config.config().apiKeys.googleFloodForecasting ||
        this.config.config().apiKeys.googleForecast ||
        this.config.config().apiKeys.googleMaps ||
        this.config.config().weather.premiumApiKey;
      this.config.updateIntegrations({ floodProvider: 'Google Flood Forecasting API' });
      this.config.updateWeather({
        floodProvider: 'Google Flood Forecasting API',
        premiumApiKey: apiKey,
      });
      this.toastr.success('Google Flood Forecasting activado.', 'Clima');
      return;
    }

    this.config.updateIntegrations({ floodProvider: 'Open-Meteo Flood / GloFAS' });
    this.config.updateWeather({ floodProvider: 'Open-Meteo Flood / GloFAS' });
    this.toastr.info('Google Flood Forecasting desactivado.', 'Clima');
  }

  selectedFloodMonitorCountries(): string[] {
    const weather = this.config.config().weather;
    return weather.floodMonitorCountries?.length ? weather.floodMonitorCountries : [weather.floodMonitorCountry || 'DO'];
  }

  selectedFloodMonitorCountriesLabel(): string {
    const selected = this.selectedFloodMonitorCountries();
    const names = selected
      .map((code) => this.floodMonitorCountries.find((country) => country.code === code)?.name ?? code)
      .filter(Boolean);
    if (!names.length) return 'Selecciona paises';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  updateFloodMonitorCountries(countries: string[]) {
    const selected = Array.from(new Set((countries ?? []).filter(Boolean)));
    const floodMonitorCountries = selected.length ? selected : ['DO'];
    this.config.updateWeather({
      floodMonitorCountries,
      floodMonitorCountry: floodMonitorCountries[0],
    });
  }

  toggleSocialCredentialVisibility(key: keyof SystemSocialAuthConfig) {
    this.visibleSocialCredentials[key] = !this.visibleSocialCredentials[key];
  }

  socialCredentialVisible(key: keyof SystemSocialAuthConfig): boolean {
    return Boolean(this.visibleSocialCredentials[key]);
  }

  runWeatherFloodScan() {
    if (this.weatherFloodScanRunning) return;

    this.weatherFloodScanRunning = true;
    this.reportsService.scanWeatherFloodZones().subscribe({
      next: (result) => {
        this.weatherFloodScanRunning = false;
        if (result.skipped) {
          this.toastr.info(result.reason || 'Ya hay una verificacion de clima en curso.', 'Clima');
          return;
        }

        this.toastr.success(
          `Verificados ${result.total} puntos. Activados: ${result.activated}. Reusados: ${result.reused}. Fallidos: ${result.failed}.`,
          'Clima',
        );
      },
      error: (error) => {
        this.weatherFloodScanRunning = false;
        this.toastr.error(error?.error?.message || 'No se pudo verificar el clima manualmente.', 'Clima');
      },
    });
  }

  toggleApiKeyVisibility(key: keyof SystemApiKeysConfig) {
    this.visibleApiKeys[key] = !this.visibleApiKeys[key];
  }

  apiKeyVisible(key: keyof SystemApiKeysConfig): boolean {
    return Boolean(this.visibleApiKeys[key]);
  }

  apiKeyInputType(key: keyof SystemApiKeysConfig): 'text' | 'password' {
    return this.apiKeyVisible(key) ? 'text' : 'password';
  }

  apiKeyConfigured(key: keyof SystemApiKeysConfig): boolean {
    return Boolean(this.config.config().apiKeys[key]?.trim());
  }

  apiKeyServiceActive(key: keyof SystemApiKeysConfig): boolean {
    const integrations = this.config.config().integrations;
    const weather = this.config.config().weather;
    const activeProviders = [
      integrations.mapProvider,
      integrations.geocodingProvider,
      integrations.routingProvider,
      integrations.aiProvider,
      integrations.weatherProvider,
      integrations.floodProvider,
      weather.premiumProvider,
    ].map((item) => item.toLowerCase());
    const aliases: Record<keyof SystemApiKeysConfig, string[]> = {
      maptiler: ['maptiler', 'maptiler geocoding', 'maptiler routing'],
      googleMaps: ['google maps', 'google geocoding', 'google routes'],
      openRouteService: ['openrouteservice'],
      openAi: ['openai'],
      accuWeather: ['accuweather', 'accuweather forecast api'],
      openWeatherMap: ['openweathermap', 'openweathermap one call'],
      weatherApi: ['weatherapi.com', 'weatherapi.com forecast'],
      visualCrossing: ['visual crossing', 'visual crossing weather'],
      weatherbit: ['weatherbit', 'weatherbit forecast'],
      windy: ['windy api'],
      ibmWeather: ['ibm weather', 'ibm environmental intelligence'],
      googleForecast: ['google forecast', 'google weather forecast api'],
      tomorrowIo: ['tomorrow.io', 'tomorrow.io weather forecast', 'tomorrow.io flood insights'],
      meteomatics: ['meteomatics', 'meteomatics weather api', 'meteomatics hydrology'],
      googleFloodForecasting: ['google flood forecasting api'],
      localWeatherAuthority: ['autoridad local', 'proveedor local', 'proveedor local / indomet', 'indomet / indrhi / coe local'],
    };
    return aliases[key].some((alias) => activeProviders.includes(alias));
  }

  configuredApiKeyCount(): number {
    return this.apiKeyServices.filter((service) => this.apiKeyConfigured(service.key)).length;
  }

  featureGroups(): string[] {
    return Array.from(new Set(this.featureFlags.flags().map((flag) => flag.group)));
  }

  featureFlagsByGroup(group: string): FeatureFlag[] {
    return this.featureFlags.flags().filter((flag) => flag.group === group);
  }

  toggleFeatureFlag(flag: FeatureFlag) {
    if (flag.critical) return;
    const flags = this.featureFlags.flags().map((item) => (item.key === flag.key ? { ...item, enabled: !item.enabled } : item));
    this.featureFlags.save(flags).subscribe({
      next: () => this.toastr.success(`${flag.label} ${flag.enabled ? 'desactivado' : 'activado'}.`, 'Feature flags'),
      error: () => this.toastr.error('No se pudo actualizar el feature flag.', 'Feature flags'),
    });
  }

  resetFeatureFlags() {
    this.featureFlags.reset().subscribe({
      next: () => this.toastr.info('Feature flags restaurados.', 'Feature flags'),
      error: () => this.toastr.error('No se pudieron restaurar los feature flags.', 'Feature flags'),
    });
  }

  socialAuthEnabled(provider: 'google' | 'facebook'): boolean {
    return this.featureFlags.flags().find((flag) => flag.key === `auth-${provider}`)?.enabled ?? false;
  }

  socialAuthEnabledCount(): number {
    return this.socialAuthProviders.filter((provider) => this.socialAuthEnabled(provider.key)).length;
  }

  socialProviderConfigured(provider: 'google' | 'facebook'): boolean {
    const socialAuth = this.config.config().socialAuth;
    if (provider === 'google') return Boolean(socialAuth.googleClientId.trim());
    return Boolean(socialAuth.facebookAppId.trim() && socialAuth.facebookAppSecretConfigured);
  }

  toggleSocialAuthProvider(provider: 'google' | 'facebook', enabled: boolean) {
    const key = `auth-${provider}`;
    const flag = this.featureFlags.flags().find((item) => item.key === key);
    if (!flag) {
      this.toastr.error('El flag de autenticacion aun no esta cargado.', 'Login social');
      return;
    }

    const flags = this.featureFlags.flags().map((item) => (item.key === key ? { ...item, enabled } : item));
    this.featureFlags.save(flags).subscribe({
      next: () => this.toastr.success(`${flag.label} ${enabled ? 'activado' : 'desactivado'}.`, 'Login social'),
      error: () => this.toastr.error('No se pudo actualizar el login social.', 'Login social'),
    });
  }

  private isValidSection(section: string | null): section is AdminSettingsSection {
    return this.sections.some((item) => item.id === section);
  }
}
