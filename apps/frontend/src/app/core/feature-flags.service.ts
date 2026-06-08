import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { API_URL } from './api.config';

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
  critical?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private readonly storageKey = 'ruta_segura_feature_flags';
  readonly flags = signal<FeatureFlag[]>(this.readStored());

  constructor(private readonly http: HttpClient) {}

  load() {
    return this.http.get<FeatureFlag[]>(`${API_URL}/feature-flags`).pipe(
      tap((flags) => this.persist(flags)),
      catchError(() => of(this.flags())),
    );
  }

  save(flags: FeatureFlag[]) {
    return this.http.patch<FeatureFlag[]>(`${API_URL}/feature-flags`, flags).pipe(
      tap((saved) => this.persist(saved)),
    );
  }

  reset() {
    return this.http.post<FeatureFlag[]>(`${API_URL}/feature-flags/reset`, {}).pipe(
      tap((flags) => this.persist(flags)),
    );
  }

  isEnabled(key: string | null | undefined): boolean {
    if (!key) return true;
    return this.flags().find((flag) => flag.key === key)?.enabled ?? true;
  }

  private persist(flags: FeatureFlag[]) {
    this.flags.set(flags);
    localStorage.setItem(this.storageKey, JSON.stringify(flags));
  }

  private readStored(): FeatureFlag[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as FeatureFlag[];
    } catch {
      localStorage.removeItem(this.storageKey);
      return [];
    }
  }
}
