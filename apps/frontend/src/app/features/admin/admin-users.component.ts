import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastrService } from 'ngx-toastr';
import { RolePermissionsService } from '../../core/role-permissions.service';
import { AdminUserItem, UserRole, UsersService } from '../../core/users.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatPaginatorModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <section class="users-page">
      <header class="users-header">
        <div>
          <span class="rs-eyebrow">Administracion</span>
          <h1>Usuarios registrados</h1>
          <p>Gestiona acceso, roles operativos y estado de cuentas registradas.</p>
        </div>
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
      </header>

      <section class="summary-grid">
        <mat-card>
          <span>Total</span>
          <strong>{{ totalUsers() }}</strong>
          <small>usuarios registrados</small>
        </mat-card>
        <mat-card>
          <span>Activos</span>
          <strong>{{ activeCount() }}</strong>
          <small>en esta pagina</small>
        </mat-card>
        <mat-card>
          <span>Institucionales</span>
          <strong>{{ managerCount() }}</strong>
          <small>roles operativos</small>
        </mat-card>
      </section>

      <mat-card class="filter-card">
        <div class="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Buscar</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Nombre o correo" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Rol</mat-label>
            <mat-select [ngModel]="roleFilter()" (ngModelChange)="roleFilter.set($event)">
              <mat-option value="ALL">Todos</mat-option>
              @for (role of roles(); track role) {
                <mat-option [value]="role">{{ roleLabel(role) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Estado</mat-label>
            <mat-select [ngModel]="activeFilter()" (ngModelChange)="activeFilter.set($event)">
              <mat-option value="ALL">Todos</mat-option>
              <mat-option value="active">Activos</mat-option>
              <mat-option value="inactive">Inactivos</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" type="button" (click)="applyFilters()">
            <mat-icon>filter_alt</mat-icon>
            Aplicar
          </button>
        </div>
      </mat-card>

      <section class="users-list">
        @for (user of users(); track user.id) {
          <mat-card class="user-row" [class.inactive]="!user.isActive">
            <div class="avatar">
              <mat-icon>{{ user.isActive ? 'person' : 'person_off' }}</mat-icon>
            </div>
            <div class="user-main">
              <strong>{{ user.fullName }}</strong>
              <span>{{ user.email }}</span>
              <div class="meta-line">
                <span>{{ user.province || 'Sin provincia' }} - {{ user.municipality || 'Sin municipio' }}</span>
                <span>{{ user.institution?.name || 'Sin institucion' }}</span>
                <span>{{ user.reportCount }} reportes</span>
              </div>
            </div>
            <div class="role-control">
              <button mat-button type="button" class="role-picker" [matMenuTriggerFor]="roleMenu">
                <span class="role-dot" aria-hidden="true"></span>
                <span>
                  <small>Rol</small>
                  <strong>{{ roleLabel(user.role) }}</strong>
                </span>
                <mat-icon>expand_more</mat-icon>
              </button>
              <mat-menu #roleMenu="matMenu" class="role-menu">
                @for (role of roles(); track role) {
                  <button mat-menu-item type="button" (click)="updateRole(user, role)">
                    <mat-icon>{{ user.role === role ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                    <span>{{ roleLabel(role) }}</span>
                  </button>
                }
              </mat-menu>
            </div>
            <div class="status-control">
              <span class="status-badge" [class.active]="user.isActive">{{ user.isActive ? 'Activo' : 'Inactivo' }}</span>
              <mat-slide-toggle [checked]="user.isActive" (change)="toggleActive(user, $event.checked)" [aria-label]="user.isActive ? 'Desactivar usuario' : 'Activar usuario'"></mat-slide-toggle>
            </div>
          </mat-card>
        } @empty {
          <mat-card class="empty-state">
            <mat-icon>group_off</mat-icon>
            <strong>No hay usuarios</strong>
            <span>Ajusta los filtros o registra nuevos usuarios.</span>
          </mat-card>
        }
      </section>

      <mat-paginator
        [length]="totalUsers()"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 20, 50]"
        showFirstLastButtons
        (page)="onPage($event)">
      </mat-paginator>
    </section>
  `,
  styleUrls: ['./admin-users.component.css'],
})
export class AdminUsersComponent implements OnInit {
  users = signal<AdminUserItem[]>([]);
  totalUsers = signal(0);
  search = signal('');
  roleFilter = signal<UserRole | 'ALL'>('ALL');
  activeFilter = signal<'ALL' | 'active' | 'inactive'>('ALL');
  pageIndex = signal(0);
  pageSize = signal(10);
  activeCount = computed(() => this.users().filter((user) => user.isActive).length);
  managerCount = computed(() => this.users().filter((user) => user.role !== 'CITIZEN').length);
  roles = signal<UserRole[]>(['CITIZEN', 'MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN']);
  roleLabels = signal<Record<string, string>>({});

  constructor(
    private readonly usersService: UsersService,
    private readonly rolePermissions: RolePermissionsService,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.rolePermissions.load().subscribe({
      next: (roles) => {
        this.roles.set(roles.map((role) => role.role));
        this.roleLabels.set(Object.fromEntries(roles.map((role) => [role.role, role.label])));
      },
    });
    this.load();
  }

  load() {
    const selectedRole = this.roleFilter();
    const selectedStatus = this.activeFilter();

    this.usersService.list({
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      q: this.search().trim() || undefined,
      role: selectedRole === 'ALL' ? undefined : selectedRole,
      isActive: selectedStatus === 'ALL' ? undefined : selectedStatus === 'active',
    }).subscribe({
      next: (page) => {
        this.users.set(page.data);
        this.totalUsers.set(page.total);
      },
      error: () => {
        this.users.set([]);
        this.totalUsers.set(0);
      },
    });
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.load();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  updateRole(user: AdminUserItem, role: UserRole) {
    if (user.role === role) return;
    this.usersService.updateAdmin(user.id, { role }).subscribe({
      next: (updated) => this.replaceUser(updated, 'Rol actualizado.'),
      error: (error) => this.toastr.error(error?.error?.message || 'No se pudo actualizar el rol.', 'Usuarios'),
    });
  }

  toggleActive(user: AdminUserItem, isActive: boolean) {
    this.usersService.updateAdmin(user.id, { isActive }).subscribe({
      next: (updated) => this.replaceUser(updated, isActive ? 'Usuario activado.' : 'Usuario desactivado.'),
      error: (error) => this.toastr.error(error?.error?.message || 'No se pudo cambiar el estado.', 'Usuarios'),
    });
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      CITIZEN: 'Ciudadano',
      MODERATOR: 'Moderador',
      INSTITUTION_ADMIN: 'Admin institucional',
      INSURANCE_ADMIN: 'Admin aseguradora',
      SUPER_ADMIN: 'Super admin',
      ...this.roleLabels(),
    };
    return labels[role] ?? role;
  }

  private replaceUser(updated: AdminUserItem, message: string) {
    this.users.set(this.users().map((user) => (user.id === updated.id ? updated : user)));
    this.toastr.success(message, 'Usuarios');
  }
}
