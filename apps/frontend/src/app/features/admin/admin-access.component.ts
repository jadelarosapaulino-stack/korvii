import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../core/auth.service';
import { FeatureFlagsService } from '../../core/feature-flags.service';
import { RolePermissionsService } from '../../core/role-permissions.service';
import { AdminRolePermissionsComponent } from './admin-role-permissions.component';
import { AdminUsersComponent } from './admin-users.component';

@Component({
  selector: 'app-admin-access',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTabsModule, AdminUsersComponent, AdminRolePermissionsComponent],
  template: `
    <section class="access-page">
      <header class="access-header">
        <div>
          <span class="rs-eyebrow">Administracion</span>
          <h1>Usuarios, roles y permisos</h1>
          <p>Administra usuarios registrados, roles configurables y permisos de acceso desde una sola vista.</p>
        </div>
        <a mat-stroked-button routerLink="/admin">
          <mat-icon>arrow_back</mat-icon>
          Volver al panel
        </a>
      </header>

      <mat-tab-group animationDuration="180ms" class="access-tabs">
        @if (canShow('admin-users')) {
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>group</mat-icon>
              Usuarios
            </ng-template>
            <app-admin-users />
          </mat-tab>
        }

        @if (canShow('admin-roles')) {
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>security</mat-icon>
              Roles y permisos
            </ng-template>
            <app-admin-role-permissions />
          </mat-tab>
        }
      </mat-tab-group>
    </section>
  `,
  styleUrls: ['./admin-access.component.css'],
})
export class AdminAccessComponent implements OnInit {
  constructor(
    private readonly auth: AuthService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly permissions: RolePermissionsService,
  ) {}

  ngOnInit(): void {
    this.featureFlags.load().subscribe();
    this.permissions.load().subscribe();
  }

  canShow(key: string): boolean {
    if (this.featureFlags.flags().length && !this.featureFlags.isEnabled(key)) return false;
    if (!this.permissions.permissions().length) return true;
    return this.permissions.isEnabled(this.auth.user()?.role, key);
  }
}
