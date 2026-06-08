import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from './api.config';

export type UserRole = string;

export interface AdminUserItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  province?: string | null;
  municipality?: string | null;
  phone?: string | null;
  institution?: {
    id: string;
    name: string;
    type: string;
  } | null;
  reportCount: number;
  activatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersPage {
  data: AdminUserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  list(filters: { q?: string; role?: UserRole; isActive?: boolean; page?: number; limit?: number } = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<AdminUsersPage>(`${API_URL}/users`, { params });
  }

  updateAdmin(id: string, patch: { role?: UserRole; isActive?: boolean }) {
    return this.http.patch<AdminUserItem>(`${API_URL}/users/${id}/admin`, patch);
  }
}
