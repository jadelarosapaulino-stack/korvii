import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth.service';
import { FeatureFlagsService } from '../../core/feature-flags.service';
import { RolePermissionsService } from '../../core/role-permissions.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatIconModule],
  template: `
    <section class="admin-panel-page">
      <header class="admin-header">
        <div>
          <span class="rs-eyebrow">Administracion</span>
          <h1>Panel de administracion</h1>
          <p>Centraliza la gestion operativa, educativa y de parametros del sistema.</p>
        </div>
      </header>

      <section class="admin-grid">
        @if (canShow('admin-reports', true)) {
        <a mat-card class="admin-tile" routerLink="/admin/reportes">
          <div class="tile-icon-row">
            <mat-icon>admin_panel_settings</mat-icon>
          </div>
          <div class="tile-detail-row">
            <strong>Gestion institucional</strong>
            <span>Validacion, asignacion, estados y seguimiento de reportes.</span>
          </div>
        </a>
        }

        @if (canShow('admin-education', true)) {
        <a mat-card class="admin-tile" routerLink="/admin/educacion">
          <div class="tile-icon-row">
            <mat-icon>video_library</mat-icon>
          </div>
          <div class="tile-detail-row">
            <strong>Gestion educativa</strong>
            <span>Cursos, videos, puntos y contenido de capacitacion vial.</span>
          </div>
        </a>
        }

        @if (canShow('admin-traffic-lights', true)) {
        <a mat-card class="admin-tile" routerLink="/admin/semaforos">
          <div class="tile-icon-row">
            <mat-icon>traffic</mat-icon>
          </div>
          <div class="tile-detail-row">
            <strong>Catalogo de semaforos</strong>
            <span>Importacion OSM, estado operativo y administracion de intersecciones.</span>
          </div>
        </a>
        }

        @if (auth.canManageSystem()) {
          @if (canShowAny(['admin-users', 'admin-roles'], true)) {
          <a mat-card class="admin-tile" routerLink="/admin/usuarios">
            <div class="tile-icon-row">
              <mat-icon>group</mat-icon>
            </div>
            <div class="tile-detail-row">
              <strong>Usuarios, roles y permisos</strong>
              <span>Gestiona cuentas, roles configurables y permisos de acceso.</span>
            </div>
          </a>
          }

          @if (canShow('admin-system', true)) {
          <a mat-card class="admin-tile" routerLink="/admin/sistema">
            <div class="tile-icon-row">
              <mat-icon>tune</mat-icon>
            </div>
            <div class="tile-detail-row">
              <strong>Parametros del sistema</strong>
              <span>Reglas de riesgo, gamificacion, integraciones y configuracion.</span>
            </div>
          </a>
          }
        }
      </section>
    </section>
  `,
  styleUrls: ['./admin-panel.component.css'],
})
export class AdminPanelComponent {
  constructor(
    public readonly auth: AuthService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly permissions: RolePermissionsService,
  ) {}

  canShow(key: string, fallback: boolean): boolean {
    if (this.featureFlags.flags().length && !this.featureFlags.isEnabled(key)) return false;
    if (!this.permissions.permissions().length) return fallback;
    return this.permissions.isEnabled(this.auth.user()?.role, key);
  }

  canShowAny(keys: string[], fallback: boolean): boolean {
    return keys.some((key) => this.canShow(key, fallback));
  }
}
