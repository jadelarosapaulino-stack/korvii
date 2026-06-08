import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastrService } from 'ngx-toastr';
import { RolePermissionView, RolePermissionsService } from '../../core/role-permissions.service';
import { UserRole } from '../../core/users.service';

@Component({
  selector: 'app-admin-role-permissions',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <section class="permissions-page">
      <header class="permissions-header">
        <div>
          <span class="rs-eyebrow">Administracion</span>
          <h1>Opciones y acciones por rol</h1>
          <p>Configura que pantallas puede ver cada rol y que acciones operativas tiene habilitadas.</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button type="button" (click)="createRole()">
            <mat-icon>add</mat-icon>
            Nuevo rol
          </button>
          <button mat-stroked-button type="button" (click)="resetDefaults()">
            <mat-icon>restart_alt</mat-icon>
            Restaurar
          </button>
          <button mat-flat-button color="primary" type="button" (click)="save()">
            <mat-icon>save</mat-icon>
            Guardar
          </button>
        </div>
      </header>

      <mat-card class="role-selector">
        <div class="role-selector-copy">
          <mat-icon>admin_panel_settings</mat-icon>
          <div>
            <strong>Rol a configurar</strong>
            <span>{{ roles().length }} roles disponibles</span>
          </div>
        </div>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Seleccionar rol</mat-label>
          <mat-select [value]="selectedRole()" (selectionChange)="selectedRole.set($event.value)">
            @for (role of roles(); track role.role) {
              <mat-option [value]="role.role">
                {{ role.label }} - {{ role.level }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-card>

      @if (activeRole(); as role) {
        <section class="role-summary">
          <mat-card class="role-card">
            <div class="role-card-main">
              <span class="role-level">{{ role.level }}</span>
              <strong>{{ role.label }}</strong>
              <p>{{ role.description }}</p>
            </div>
            <div class="role-card-footer">
              <mat-chip>{{ role.role }}</mat-chip>
              <div class="role-card-actions">
                <button mat-stroked-button type="button" (click)="openEditRole(role)">
                  <mat-icon>edit</mat-icon>
                  Editar
                </button>
                <button mat-flat-button color="primary" type="button" (click)="save()">
                  <mat-icon>save</mat-icon>
                  Guardar cambios
                </button>
                @if (isCustomRole(role.role)) {
                  <button mat-stroked-button color="warn" type="button" (click)="deleteRole(role.role)">
                    <mat-icon>delete</mat-icon>
                    Eliminar
                  </button>
                }
              </div>
            </div>
          </mat-card>

          <mat-card class="note-card">
            <mat-icon>verified_user</mat-icon>
            <div>
              <strong>Politica vigente del sistema</strong>
              <span>Los cambios quedan guardados para la matriz de permisos. Las protecciones criticas del backend se mantienen como respaldo.</span>
            </div>
          </mat-card>
        </section>

        <section class="permissions-grid">
          <div>
            <h2>Opciones visibles</h2>
            <div class="section-list">
              @for (section of role.options; track section.title) {
                <mat-card class="permission-section">
                  <mat-icon>{{ section.icon }}</mat-icon>
                  <div>
                    <strong>{{ section.title }}</strong>
                    <div class="toggle-list">
                      @for (item of section.items; track item) {
                        <button
                          class="permission-toggle"
                          type="button"
                          [class.enabled]="item.enabled"
                          [attr.aria-pressed]="item.enabled"
                          (click)="setItem(section.key, item.key, !item.enabled)">
                          <span class="permission-toggle-icon">
                            <mat-icon>{{ item.enabled ? 'check' : 'close' }}</mat-icon>
                          </span>
                          <span class="permission-toggle-label">{{ item.label }}</span>
                          <span class="permission-toggle-state">{{ item.enabled ? 'Activo' : 'Inactivo' }}</span>
                        </button>
                      }
                    </div>
                  </div>
                </mat-card>
              }
            </div>
          </div>

          <div>
            <h2>Acciones permitidas</h2>
            <div class="section-list">
              @for (section of role.actions; track section.title) {
                <mat-card class="permission-section">
                  <mat-icon>{{ section.icon }}</mat-icon>
                  <div>
                    <strong>{{ section.title }}</strong>
                    <div class="toggle-list">
                      @for (item of section.items; track item) {
                        <button
                          class="permission-toggle"
                          type="button"
                          [class.enabled]="item.enabled"
                          [attr.aria-pressed]="item.enabled"
                          (click)="setItem(section.key, item.key, !item.enabled)">
                          <span class="permission-toggle-icon">
                            <mat-icon>{{ item.enabled ? 'check' : 'close' }}</mat-icon>
                          </span>
                          <span class="permission-toggle-label">{{ item.label }}</span>
                          <span class="permission-toggle-state">{{ item.enabled ? 'Activo' : 'Inactivo' }}</span>
                        </button>
                      }
                    </div>
                  </div>
                </mat-card>
              }
            </div>
          </div>
        </section>
      }

      @if (roleDraft(); as draft) {
        <div class="modal-backdrop" role="presentation" (click)="closeRoleModal()">
          <section class="role-modal" role="dialog" aria-modal="true" aria-labelledby="role-modal-title" (click)="$event.stopPropagation()">
            <header class="role-modal-header">
              <div>
                <span class="rs-eyebrow">{{ editingExistingRole() ? 'Editar rol' : 'Nuevo rol' }}</span>
                <h2 id="role-modal-title">{{ editingExistingRole() ? draft.role : 'Crear rol personalizado' }}</h2>
              </div>
              <button mat-icon-button type="button" aria-label="Cerrar" (click)="closeRoleModal()">
                <mat-icon>close</mat-icon>
              </button>
            </header>

            <div class="role-modal-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Nombre visible</mat-label>
                <input matInput [ngModel]="draft.label" (ngModelChange)="updateDraft('label', $event)" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Nivel</mat-label>
                <input matInput [ngModel]="draft.level" (ngModelChange)="updateDraft('level', $event)" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Rol base</mat-label>
                <mat-select [value]="draft.baseRole" (selectionChange)="updateDraft('baseRole', $event.value)">
                  @for (baseRole of baseRoles; track baseRole) {
                    <mat-option [value]="baseRole">{{ baseRole }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field class="description-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Descripcion</mat-label>
                <textarea matInput rows="3" [ngModel]="draft.description" (ngModelChange)="updateDraft('description', $event)"></textarea>
              </mat-form-field>
            </div>

            <footer class="role-modal-actions">
              <button mat-button type="button" (click)="closeRoleModal()">Cancelar</button>
              <button mat-flat-button color="primary" type="button" (click)="saveRoleDraft()">
                <mat-icon>check</mat-icon>
                Aplicar
              </button>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./admin-role-permissions.component.css'],
})
export class AdminRolePermissionsComponent implements OnInit {
  readonly roles = signal<RolePermissionView[]>([]);
  readonly selectedRole = signal<UserRole>('CITIZEN');
  readonly activeRole = computed(() => this.roles().find((role) => role.role === this.selectedRole()) ?? this.roles()[0]);
  readonly baseRoles: UserRole[] = ['CITIZEN', 'MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN'];
  readonly roleDraft = signal<RolePermissionView | null>(null);
  readonly editingExistingRole = signal(false);

  constructor(
    private readonly permissions: RolePermissionsService,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.permissions.load().subscribe({
      next: (permissions) => this.roles.set(permissions),
      error: () => this.toastr.error('No se pudieron cargar los permisos.', 'Permisos'),
    });
  }

  setItem(sectionKey: string, itemKey: string, enabled: boolean) {
    const selectedRole = this.selectedRole();
    this.roles.set(this.roles().map((role) => {
      if (role.role !== selectedRole) return role;
      return {
        ...role,
        options: this.updateSections(role.options, sectionKey, itemKey, enabled),
        actions: this.updateSections(role.actions, sectionKey, itemKey, enabled),
      };
    }));
  }

  openEditRole(role: RolePermissionView) {
    this.roleDraft.set(structuredClone(role));
    this.editingExistingRole.set(true);
  }

  createRole() {
    const source = this.activeRole() ?? this.roles()[0];
    if (!source) return;
    const nextNumber = this.roles().filter((role) => role.role.startsWith('CUSTOM_ROLE')).length + 1;
    const roleKey = this.uniqueRoleKey(`CUSTOM_ROLE_${nextNumber}`);
    this.roleDraft.set({
      ...structuredClone(source),
      role: roleKey,
      baseRole: source.baseRole || 'CITIZEN',
      label: `Nuevo rol ${nextNumber}`,
      level: 'Personalizado',
      description: 'Rol personalizado configurado por el super administrador.',
    });
    this.editingExistingRole.set(false);
  }

  updateDraft(field: 'label' | 'level' | 'description' | 'baseRole', value: string) {
    const draft = this.roleDraft();
    if (!draft) return;
    this.roleDraft.set({ ...draft, [field]: value });
  }

  saveRoleDraft() {
    const draft = this.roleDraft();
    if (!draft) return;
    const normalizedDraft = {
      ...draft,
      label: draft.label.trim() || draft.role,
      level: draft.level.trim() || 'Personalizado',
      description: draft.description.trim() || 'Rol configurado por el super administrador.',
    };
    this.roles.set(this.editingExistingRole()
      ? this.roles().map((role) => (role.role === normalizedDraft.role ? normalizedDraft : role))
      : [...this.roles(), normalizedDraft]);
    this.selectedRole.set(normalizedDraft.role);
    this.closeRoleModal();
  }

  closeRoleModal() {
    this.roleDraft.set(null);
    this.editingExistingRole.set(false);
  }

  deleteRole(roleKey: string) {
    if (!this.isCustomRole(roleKey)) return;
    this.roles.set(this.roles().filter((role) => role.role !== roleKey));
    this.selectedRole.set(this.roles()[0]?.role ?? 'CITIZEN');
  }

  save() {
    this.permissions.save(this.roles()).subscribe({
      next: (permissions) => {
        this.roles.set(permissions);
        this.toastr.success('Permisos guardados.', 'Permisos');
      },
      error: (error) => this.toastr.error(error?.error?.message || 'No se pudieron guardar los permisos.', 'Permisos'),
    });
  }

  resetDefaults() {
    this.permissions.reset().subscribe({
      next: (permissions) => {
        this.roles.set(permissions);
        this.toastr.success('Permisos restaurados.', 'Permisos');
      },
      error: (error) => this.toastr.error(error?.error?.message || 'No se pudieron restaurar los permisos.', 'Permisos'),
    });
  }

  private updateSections(sections: RolePermissionView['options'], sectionKey: string, itemKey: string, enabled: boolean) {
    return sections.map((section) => {
      if (section.key !== sectionKey) return section;
      return {
        ...section,
        items: section.items.map((item) => (item.key === itemKey ? { ...item, enabled } : item)),
      };
    });
  }

  isCustomRole(roleKey: string): boolean {
    return !this.baseRoles.includes(roleKey);
  }

  private uniqueRoleKey(base: string): string {
    const existing = new Set(this.roles().map((role) => role.role));
    let candidate = base;
    let index = 2;
    while (existing.has(candidate)) {
      candidate = `${base}_${index}`;
      index += 1;
    }
    return candidate;
  }
}
