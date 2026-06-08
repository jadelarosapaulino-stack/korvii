import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { API_URL } from './api.config';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  province?: string;
  municipality?: string;
  vehicleType?: string;
  institution?: {
    id: string;
    name: string;
    type: string;
    province?: string;
    municipality?: string;
  } | null;
  institutionRole?: string;
  phone?: string;
  occupation?: string;
  mobilityMode?: string;
  drivingFrequency?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  preferredContactChannel?: string;
  avatarUrl?: string;
  avatarPreset?: string;
  notificationsEnabled?: boolean;
  decisionInsightsConsent?: boolean;
  createdAt?: string;
  updatedAt?: string;
  contributions?: {
    totalReports: number;
    pendingReports: number;
    validatedReports: number;
    inProgressReports: number;
    resolvedReports: number;
    rejectedReports: number;
    duplicateReports: number;
    highRiskReports: number;
    recentReports: Array<{
      id: string;
      title: string;
      category: string;
      status: string;
      riskLevel: number;
      createdAt: string;
    }>;
  };
  education?: {
    points: number;
    completedLessons: number;
    lessonsInProgress: number;
    averageScore: number;
    recentProgress: Array<{
      id: string;
      lessonId: string;
      lessonTitle: string;
      completed: boolean;
      progressPercent: number;
      score: number;
      points: number;
      updatedAt: string;
    }>;
  };
}

export type AuthorizedReportManagerRole = 'MODERATOR' | 'INSTITUTION_ADMIN' | 'INSURANCE_ADMIN' | 'SUPER_ADMIN';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface PendingActivationResponse {
  requiresActivation: true;
  email: string;
  message: string;
}

export interface SocialAuthConfig {
  google: boolean;
  googleClientId?: string;
  googleConfigured?: boolean;
  facebook: boolean;
  facebookAppId?: string;
  facebookConfigured?: boolean;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  province?: string;
  municipality?: string;
  vehicleType?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'ruta_segura_token';
  private readonly userKey = 'ruta_segura_user';
  readonly user = signal<AuthUser | null>(this.readUser());

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { email: email.trim(), password }).pipe(
      tap((response) => this.persist(response)),
    );
  }

  socialAuthConfig() {
    return this.http.get<SocialAuthConfig>(`${API_URL}/auth/social/config`);
  }

  socialLogin(provider: 'google' | 'facebook', token: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/social`, { provider, token }).pipe(
      tap((response) => this.persist(response)),
    );
  }

  register(payload: RegisterPayload) {
    return this.http.post<PendingActivationResponse>(`${API_URL}/auth/register`, payload);
  }

  activateAccount(email: string, code: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/activate`, { email: email.trim(), code: code.trim() }).pipe(
      tap((response) => this.persist(response)),
    );
  }

  resendActivationCode(email: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/activation-code`, { email: email.trim() });
  }

  requestPasswordReset(email: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/password/forgot`, { email: email.trim() });
  }

  resetPassword(email: string, code: string, password: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/password/reset`, { email: email.trim(), code: code.trim(), password });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/password/change`, { currentPassword, newPassword });
  }

  refreshUser() {
    return this.http.get<AuthUser>(`${API_URL}/auth/me`).pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.user.set(user);
      }),
      catchError(() => {
        this.logout();
        return of(null);
      }),
    );
  }

  updateProfile(payload: Partial<AuthUser>) {
    return this.http.patch<AuthUser>(`${API_URL}/auth/me`, payload).pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.user.set(user);
      }),
    );
  }

  uploadAvatar(file: File) {
    const data = new FormData();
    data.append('avatar', file);
    return this.http.post<AuthUser>(`${API_URL}/auth/me/avatar`, data).pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.user.set(user);
      }),
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.user.set(null);
  }

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(this.tokenKey));
  }

  canManageReports(): boolean {
    return ['MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN'].includes(this.user()?.role ?? '');
  }

  canViewExecutivePanel(): boolean {
    return this.canManageReports();
  }

  canManageSystem(): boolean {
    return this.user()?.role === 'SUPER_ADMIN';
  }

  private persist(response: AuthResponse) {
    localStorage.setItem(this.tokenKey, response.accessToken);
    localStorage.setItem(this.userKey, JSON.stringify(response.user));
    this.user.set(response.user);
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(this.userKey);
      return null;
    }
  }
}
