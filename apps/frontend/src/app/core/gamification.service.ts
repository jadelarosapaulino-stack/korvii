import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { API_URL } from './api.config';

export type GamificationSettings = Record<string, number>;

@Injectable({ providedIn: 'root' })
export class GamificationService {
  settings = signal<GamificationSettings>({});

  constructor(private readonly http: HttpClient) {}

  load() {
    this.http.get<GamificationSettings>(`${API_URL}/gamification/settings`).subscribe({
      next: (settings) => this.settings.set(settings),
    });
  }

  update(key: string, value: number) {
    this.http.patch<GamificationSettings>(`${API_URL}/gamification/settings`, { [key]: value }).subscribe({
      next: (settings) => this.settings.set(settings),
    });
  }
}
