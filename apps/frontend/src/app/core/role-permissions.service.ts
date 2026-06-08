import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { API_URL } from './api.config';
import { UserRole } from './users.service';

export interface RolePermissionItem {
  key: string;
  label: string;
  enabled: boolean;
}

export interface RolePermissionSection {
  key: string;
  title: string;
  icon: string;
  items: RolePermissionItem[];
}

export interface RolePermissionView {
  role: UserRole;
  baseRole: UserRole;
  label: string;
  description: string;
  level: string;
  options: RolePermissionSection[];
  actions: RolePermissionSection[];
}

@Injectable({ providedIn: 'root' })
export class RolePermissionsService {
  private readonly storageKey = 'ruta_segura_role_permissions';
  readonly permissions = signal<RolePermissionView[]>(this.readStored());

  constructor(private readonly http: HttpClient) {}

  load() {
    return this.http.get<RolePermissionView[]>(`${API_URL}/role-permissions`).pipe(
      tap((permissions) => this.persist(permissions)),
      catchError(() => of(this.permissions())),
    );
  }

  save(permissions: RolePermissionView[]) {
    return this.http.patch<RolePermissionView[]>(`${API_URL}/role-permissions`, permissions).pipe(
      tap((saved) => this.persist(saved)),
    );
  }

  reset() {
    return this.http.post<RolePermissionView[]>(`${API_URL}/role-permissions/reset`, {}).pipe(
      tap((permissions) => this.persist(permissions)),
    );
  }

  isEnabled(role: string | null | undefined, key: string): boolean {
    const permissions = this.permissions().find((item) => item.role === role);
    if (!permissions) return false;
    return [...permissions.options, ...permissions.actions].some((section) => section.items.some((item) => item.key === key && item.enabled));
  }

  baseRoleFor(role: string | null | undefined): string {
    const configured = this.permissions().find((item) => item.role === role);
    return configured?.baseRole || role || 'CITIZEN';
  }

  private persist(permissions: RolePermissionView[]) {
    this.permissions.set(permissions);
    localStorage.setItem(this.storageKey, JSON.stringify(permissions));
  }

  private readStored(): RolePermissionView[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as RolePermissionView[];
    } catch {
      localStorage.removeItem(this.storageKey);
      return [];
    }
  }
}
