import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth.service';
import { EducationService } from '../../core/education.service';
import { FeatureFlagsService } from '../../core/feature-flags.service';
import { RolePermissionsService } from '../../core/role-permissions.service';
import { ReportsService } from '../../core/reports.service';
import { SystemConfigService } from '../../core/system-config.service';
import { TrafficLightsService } from '../../core/traffic-lights.service';
import { UsersService } from '../../core/users.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <section class="admin-panel-page">
      <header class="admin-header">
        <div>
          <span class="rs-eyebrow">Administracion</span>
          <h1>Panel de administracion</h1>
          <p>Resumen operativo para priorizar incidentes, revisar servicios y entrar rapido a cada modulo.</p>
        </div>
        <div class="admin-header-actions">
          @if (canShow('admin-reports', true)) {
            <a mat-flat-button routerLink="/admin/reports">
              <mat-icon>fact_check</mat-icon>
              Revisar reportes
            </a>
          }
          @if (auth.canManageSystem() && canShow('admin-system', true)) {
            <a mat-stroked-button routerLink="/admin/system">
              <mat-icon>tune</mat-icon>
              Configuracion
            </a>
          }
        </div>
      </header>

      <section class="admin-overview" aria-label="Resumen administrativo">
        <article class="overview-card urgent">
          <span>Atencion operativa</span>
          <strong>{{ openReports() }}</strong>
          <small>Reportes abiertos</small>
        </article>
        <article class="overview-card">
          <span>Pendientes</span>
          <strong>{{ pendingReports() }}</strong>
          <small>Requieren validacion</small>
        </article>
        <article class="overview-card">
          <span>Usuarios</span>
          <strong>{{ totalUsers() }}</strong>
          <small>Cuentas registradas</small>
        </article>
        <article class="overview-card">
          <span>Semaforos</span>
          <strong>{{ totalTrafficLights() }}</strong>
          <small>Intersecciones catalogadas</small>
        </article>
      </section>

      <section class="admin-workspace">
        <mat-card class="admin-section module-section">
          <div class="section-heading">
            <div>
              <span class="rs-eyebrow">Modulos</span>
              <h2>Areas administrativas</h2>
            </div>
          </div>

          <div class="module-list">
        @if (canShow('admin-reports', true)) {
        <a class="admin-module" routerLink="/admin/reports">
          <div class="module-icon">
            <mat-icon>admin_panel_settings</mat-icon>
          </div>
          <div>
            <strong>Gestion institucional</strong>
            <span>Validacion, asignacion, estados y seguimiento de reportes.</span>
          </div>
          <small>{{ openReports() }} abiertos</small>
        </a>
        }

        @if (canShow('admin-education', true)) {
        <a class="admin-module" routerLink="/admin/education">
          <div class="module-icon">
            <mat-icon>video_library</mat-icon>
          </div>
          <div>
            <strong>Gestion educativa</strong>
            <span>Cursos, videos, puntos y contenido de capacitacion vial.</span>
          </div>
          <small>{{ totalLessons() }} contenidos</small>
        </a>
        }

        @if (canShow('admin-traffic-lights', true)) {
        <a class="admin-module" routerLink="/admin/traffic-lights">
          <div class="module-icon">
            <mat-icon>traffic</mat-icon>
          </div>
          <div>
            <strong>Catalogo de semaforos</strong>
            <span>Importacion OSM, estado operativo y administracion de intersecciones.</span>
          </div>
          <small>{{ totalTrafficLights() }} registros</small>
        </a>
        }

        @if (auth.canManageSystem()) {
          @if (canShowAny(['admin-users', 'admin-roles'], true)) {
          <a class="admin-module" routerLink="/admin/users">
            <div class="module-icon">
              <mat-icon>group</mat-icon>
            </div>
            <div>
              <strong>Usuarios, roles y permisos</strong>
              <span>Gestiona cuentas, roles configurables y permisos de acceso.</span>
            </div>
            <small>{{ totalUsers() }} usuarios</small>
          </a>
          }

          @if (canShow('admin-system', true)) {
          <a class="admin-module" routerLink="/admin/system">
            <div class="module-icon">
              <mat-icon>tune</mat-icon>
            </div>
            <div>
              <strong>Parametros del sistema</strong>
              <span>Reglas de riesgo, gamificacion, integraciones y configuracion.</span>
            </div>
            <small>{{ configuredIntegrations() }}/4 listas</small>
          </a>
          }
        }
          </div>
        </mat-card>

        <aside class="admin-side">
          <mat-card class="admin-section">
            <div class="section-heading">
              <div>
                <span class="rs-eyebrow">Sistema</span>
                <h2>Estado de servicios</h2>
              </div>
            </div>
            <div class="service-list">
              @for (service of serviceStates(); track service.label) {
                <article [class.ready]="service.ready">
                  <mat-icon>{{ service.icon }}</mat-icon>
                  <div>
                    <strong>{{ service.label }}</strong>
                    <span>{{ service.value }}</span>
                  </div>
                  <small>{{ service.ready ? 'Listo' : 'Pendiente' }}</small>
                </article>
              }
            </div>
          </mat-card>

          <mat-card class="admin-section">
            <div class="section-heading">
              <div>
                <span class="rs-eyebrow">Acciones</span>
                <h2>Atajos frecuentes</h2>
              </div>
            </div>
            <div class="quick-actions">
              <a routerLink="/reports/new">
                <mat-icon>add_location_alt</mat-icon>
                Nuevo reporte
              </a>
              @if (canShow('admin-reports', true)) {
                <a routerLink="/admin/reports">
                  <mat-icon>assignment_late</mat-icon>
                  Pendientes
                </a>
              }
              @if (auth.canManageSystem() && canShow('admin-system', true)) {
                <a routerLink="/admin/system" [queryParams]="{ section: 'maps' }">
                  <mat-icon>map</mat-icon>
                  Mapas
                </a>
              }
              @if (auth.canManageSystem() && canShowAny(['admin-users', 'admin-roles'], true)) {
                <a routerLink="/admin/users">
                  <mat-icon>manage_accounts</mat-icon>
                  Accesos
                </a>
              }
            </div>
          </mat-card>
        </aside>
      </section>
    </section>
  `,
  styleUrls: ['./admin-panel.component.css'],
})
export class AdminPanelComponent implements OnInit {
  private readonly metrics = signal<{ pending: number; validated: number; inProgress: number; total: number } | null>(null);
  private readonly usersTotal = signal(0);
  private readonly trafficLightsTotal = signal(0);
  private readonly lessonsTotal = signal(0);

  pendingReports = computed(() => this.metrics()?.pending ?? 0);
  openReports = computed(() => {
    const metrics = this.metrics();
    return metrics ? metrics.pending + metrics.validated + metrics.inProgress : 0;
  });
  totalUsers = computed(() => this.usersTotal());
  totalTrafficLights = computed(() => this.trafficLightsTotal());
  totalLessons = computed(() => this.lessonsTotal());
  configuredIntegrations = computed(() => this.serviceStates().filter((service) => service.ready).length);
  serviceStates = computed(() => {
    const config = this.systemConfig.config();
    return [
      {
        label: 'Mapa',
        value: config.integrations.mapProvider,
        icon: 'map',
        ready: config.integrations.mapProvider !== 'MapTiler' || Boolean(config.apiKeys.maptiler || config.libraries.maptilerApiKey),
      },
      {
        label: 'Clima',
        value: config.integrations.weatherProvider,
        icon: 'cloud_queue',
        ready: Boolean(config.integrations.weatherProvider),
      },
      {
        label: 'Almacenamiento',
        value: config.storage.provider,
        icon: 'storage',
        ready: Boolean(config.storage.provider),
      },
      {
        label: 'Autenticacion social',
        value: this.socialAuthReady() ? 'Configurada' : 'Sin credenciales',
        icon: 'vpn_key',
        ready: this.socialAuthReady(),
      },
    ];
  });

  constructor(
    public readonly auth: AuthService,
    private readonly reports: ReportsService,
    private readonly users: UsersService,
    private readonly trafficLights: TrafficLightsService,
    private readonly education: EducationService,
    private readonly systemConfig: SystemConfigService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly permissions: RolePermissionsService,
  ) {}

  ngOnInit() {
    if (this.canShow('admin-reports', true)) {
      this.reports.adminMetrics().subscribe({
        next: (metrics) => this.metrics.set(metrics),
        error: () => undefined,
      });
    }
    if (this.auth.canManageSystem() && this.canShowAny(['admin-users', 'admin-roles'], true)) {
      this.users.list({ limit: 1 }).subscribe({
        next: (page) => this.usersTotal.set(page.total),
        error: () => undefined,
      });
    }
    if (this.canShow('admin-traffic-lights', true)) {
      this.trafficLights.list({ limit: 1 }).subscribe({
        next: (page) => this.trafficLightsTotal.set(page.total),
        error: () => undefined,
      });
    }
    if (this.canShow('admin-education', true)) {
      this.education.lessons().subscribe({
        next: (lessons) => this.lessonsTotal.set(lessons.length),
        error: () => undefined,
      });
    }
  }

  canShow(key: string, fallback: boolean): boolean {
    if (this.featureFlags.flags().length && !this.featureFlags.isEnabled(key)) return false;
    if (!this.permissions.permissions().length) return fallback;
    return this.permissions.isEnabled(this.auth.user()?.role, key);
  }

  canShowAny(keys: string[], fallback: boolean): boolean {
    return keys.some((key) => this.canShow(key, fallback));
  }

  private socialAuthReady(): boolean {
    const socialAuth = this.systemConfig.config().socialAuth;
    return Boolean(socialAuth.googleClientId || (socialAuth.facebookAppId && socialAuth.facebookAppSecretConfigured));
  }
}
