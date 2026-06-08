import { Component, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { API_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth.service';
import { FeatureFlagsService } from '../../core/feature-flags.service';
import { RolePermissionsService } from '../../core/role-permissions.service';
import { ReportsService, WeatherStatus } from '../../core/reports.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatMenuModule, MatSlideToggleModule, NgClass],
  template: `
    <section class="workspace">
      <div class="app-shell" [class.collapsed]="collapsed()">
        <aside class="sidebar">
          <div class="brand">
            <div class="rail-logo" aria-label="KORVI">KV</div>
            <div class="brand-copy">
              <strong>KORVI <em>Insight</em></strong>
              <span>Mobility intelligence</span>
            </div>
          </div>

          <nav class="rail-nav" aria-label="Navegacion principal">
            @if (canShow('dashboard', auth.canViewExecutivePanel())) {
              <a routerLink="/dashboard" routerLinkActive="active" title="Dashboard">
                <mat-icon>space_dashboard</mat-icon>
                <span>Panel ejecutivo</span>
              </a>
            }
            @if (canShow('map', true)) {
              <a routerLink="/mapa" routerLinkActive="active" title="Mapa de riesgo">
              <mat-icon>travel_explore</mat-icon>
              <span>Mapa de riesgo</span>
              </a>
            }
            @if (canShow('reports', true)) {
              <a routerLink="/reportes" routerLinkActive="active" title="Reportes">
              <mat-icon>report_problem</mat-icon>
              <span>Reportes</span>
              </a>
            }
            @if (canShow('intelligence', auth.canManageReports())) {
              <a routerLink="/intelligence" routerLinkActive="active" title="KORVI AI">
                <mat-icon>query_stats</mat-icon>
                <span>KORVI AI</span>
              </a>
            }
            @if (canShow('education', true)) {
              <a routerLink="/educacion" routerLinkActive="active" title="Educación vial">
              <mat-icon>menu_book</mat-icon>
              <span>Educación vial</span>
              </a>
            }
          </nav>

          <section class="weather-strip" [class.alert]="weather()?.floodRisk">
            <img
              class="weather-icon-img"
              [class.remote]="isRemoteWeatherIcon()"
              [src]="weatherIconSrc()"
              [alt]="weatherIconLabel()"
              [title]="weatherIconLabel()" />
            <div class="weather-copy">
              <span>{{ weatherTitle() }}</span>
              <strong>{{ weatherMainText() }}</strong>
              <small>{{ weatherSubtitle() }}</small>
            </div>
          </section>

          <div class="rail-bottom">
            <button mat-button class="logout-button" title="Cerrar sesion" (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Salir</span>
            </button>
            <div class="avatar" [class.has-photo]="avatarImageUrl()" [ngClass]="avatarClass()" [title]="auth.user()?.fullName || 'Usuario'">
              @if (avatarImageUrl()) {
                <img [src]="avatarImageUrl() ?? ''" alt="" />
              } @else {
                <span class="cartoon-avatar" aria-hidden="true">
                  <span class="cartoon-hair"></span>
                  <span class="cartoon-face-shape">
                    <span class="cartoon-eye left"></span>
                    <span class="cartoon-eye right"></span>
                    <span class="cartoon-nose"></span>
                    <span class="cartoon-mouth"></span>
                  </span>
                </span>
              }
            </div>
          </div>
        </aside>

        <div class="content-shell">
          <nav class="navbar">
            <button mat-icon-button type="button" (click)="toggleSidebar()" [attr.aria-label]="collapsed() ? 'Expandir sidebar' : 'Colapsar sidebar'">
              <mat-icon>{{ collapsed() ? 'menu_open' : 'menu' }}</mat-icon>
            </button>
            <div>
              <strong>Centro de inteligencia vial</strong>
              <span>Reportes ciudadanos, mapa de riesgo y despacho institucional</span>
            </div>
            <div class="navbar-spacer"></div>
            <div class="theme-toggle" title="Cambiar tema">
              <mat-icon>{{ darkTheme() ? 'dark_mode' : 'light_mode' }}</mat-icon>
              <mat-slide-toggle [checked]="darkTheme()" (change)="setDarkTheme($event.checked)">
                <span>Tema oscuro</span>
              </mat-slide-toggle>
            </div>
            <button mat-button disableRipple class="user-menu-trigger" type="button" [matMenuTriggerFor]="userMenu" aria-label="Opciones de usuario">
              <span class="navbar-avatar" [class.has-photo]="avatarImageUrl()" [ngClass]="avatarClass()">
                @if (avatarImageUrl()) {
                  <img [src]="avatarImageUrl()" alt="" />
                } @else {
                  <span class="cartoon-avatar" aria-hidden="true">
                    <span class="cartoon-hair"></span>
                    <span class="cartoon-face-shape">
                      <span class="cartoon-eye left"></span>
                      <span class="cartoon-eye right"></span>
                      <span class="cartoon-nose"></span>
                      <span class="cartoon-mouth"></span>
                    </span>
                  </span>
                }
              </span>
              <span class="navbar-user-copy">
                <strong>{{ auth.user()?.fullName || 'Usuario' }}</strong>
                <small>{{ userContextLabel }}</small>
              </span>
              <mat-icon>expand_more</mat-icon>
            </button>
            <mat-menu #userMenu="matMenu" xPosition="before" class="user-menu">
              <div class="user-menu-header" (click)="$event.stopPropagation()">
                <span class="navbar-avatar large" [class.has-photo]="avatarImageUrl()" [ngClass]="avatarClass()">
                  @if (avatarImageUrl()) {
                    <img [src]="avatarImageUrl()" alt="" />
                  } @else {
                    <span class="cartoon-avatar" aria-hidden="true">
                      <span class="cartoon-hair"></span>
                      <span class="cartoon-face-shape">
                        <span class="cartoon-eye left"></span>
                        <span class="cartoon-eye right"></span>
                        <span class="cartoon-nose"></span>
                        <span class="cartoon-mouth"></span>
                      </span>
                    </span>
                  }
                </span>
                <div>
                  <strong>{{ auth.user()?.fullName || 'Usuario' }}</strong>
                  <span>{{ roleLabel }}</span>
                  @if (auth.user()?.institution?.name) {
                    <span>{{ auth.user()?.institution?.name }}</span>
                  }
                  <small>{{ auth.user()?.email }}</small>
                </div>
              </div>
              <a mat-menu-item routerLink="/perfil">
                <mat-icon>account_circle</mat-icon>
                <span>Mi perfil</span>
              </a>
              <a mat-menu-item routerLink="/perfil/cambiar-contrasena">
                <mat-icon>lock_reset</mat-icon>
                <span>Cambiar contrasena</span>
              </a>
              @if (adminLink) {
                <a mat-menu-item [routerLink]="adminLink">
                  <mat-icon>admin_panel_settings</mat-icon>
                  <span>Administracion</span>
                </a>
              }
              <button mat-menu-item type="button" (click)="logout()">
                <mat-icon>logout</mat-icon>
                <span>Salir</span>
              </button>
            </mat-menu>
          </nav>
          <main class="route-surface">
            <router-outlet />
          </main>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent implements OnInit {
  collapsed = signal(false);
  darkTheme = signal(false);
  weather = signal<WeatherStatus | null>(null);
  weatherLoading = signal(false);
  private readonly themeStorageKey = 'korvi_theme';

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router,
    private readonly featureFlags: FeatureFlagsService,
    private readonly rolePermissions: RolePermissionsService,
    private readonly reports: ReportsService,
  ) {}

  ngOnInit() {
    this.auth.refreshUser().subscribe();
    this.featureFlags.load().subscribe();
    this.rolePermissions.load().subscribe();
    this.loadThemePreference();
    this.loadWeatherStatus();
  }

  toggleSidebar() {
    this.collapsed.update((value) => !value);
  }

  get initials() {
    const name = this.auth.user()?.fullName ?? 'Usuario';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  get roleLabel() {
    const role = this.auth.user()?.role ?? 'CITIZEN';
    const labels: Record<string, string> = {
      CITIZEN: 'Ciudadano',
      MODERATOR: 'Moderador',
      INSTITUTION_ADMIN: 'Administrador institucional',
      INSURANCE_ADMIN: 'Administrador aseguradora',
      SUPER_ADMIN: 'Super administrador',
    };
    return labels[role] ?? role;
  }

  get userContextLabel() {
    return this.auth.user()?.institution?.name || this.roleLabel;
  }

  get adminLink(): string | null {
    if (this.hasAnyAdminOption()) return '/admin';
    return null;
  }

  canShow(key: string, fallback: boolean): boolean {
    if (this.featureFlags.flags().length && !this.featureFlags.isEnabled(key)) return false;
    if (!this.rolePermissions.permissions().length) return fallback;
    return this.rolePermissions.isEnabled(this.auth.user()?.role, key);
  }

  private hasAnyAdminOption(): boolean {
    if (!this.rolePermissions.permissions().length) return this.auth.canManageReports();
    return ['admin-reports', 'admin-education', 'admin-traffic-lights', 'admin-users', 'admin-roles', 'admin-system'].some((key) => this.canShow(key, false));
  }

  avatarImageUrl(): string | null {
    const user = this.auth.user();
    const avatarUrl = user?.avatarUrl;
    if (!avatarUrl || user?.avatarPreset !== 'photo') return null;
    return avatarUrl.startsWith('/uploads') ? `${API_URL.replace('/api', '')}${avatarUrl}` : avatarUrl;
  }

  avatarClass(): string {
    const preset = this.auth.user()?.avatarPreset || 'default';
    return preset === 'photo' ? 'avatar-preset-default' : `avatar-preset-${preset}`;
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  setDarkTheme(enabled: boolean) {
    this.darkTheme.set(enabled);
    document.body.classList.toggle('rs-dark-theme', enabled);
    localStorage.setItem(this.themeStorageKey, enabled ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('rs-theme-change', { detail: { dark: enabled } }));
  }

  weatherIconSrc(): string {
    const icon = this.weatherIconName();
    if (this.isRemoteWeatherIconValue(icon)) return icon;
    return `assets/weather-icons/${icon}.svg`;
  }

  isRemoteWeatherIcon(): boolean {
    return this.isRemoteWeatherIconValue(this.weatherIconName());
  }

  private weatherIconName(): string {
    if (this.weatherLoading()) return 'wi-refresh';
    const current = this.weather();
    if (current?.provider === 'google-forecast' && current.weatherIcon) return current.weatherIcon;
    if (current?.floodRisk) return 'wi-flood';
    return current?.weatherIcon ?? (current?.isDayTime === false ? 'wi-night-clear' : 'wi-day-sunny');
  }

  private isRemoteWeatherIconValue(icon: string): boolean {
    return icon.startsWith('http://') || icon.startsWith('https://');
  }

  weatherTitle(): string {
    const current = this.weather();
    if (current?.floodRisk) return 'Riesgo de inundacion';
    return current?.weatherText || 'Clima';
  }

  weatherStatusText(): string {
    if (this.weatherLoading()) return 'Consultando clima...';
    if (this.weather()?.enabled === false) return 'Clima no configurado';
    return 'Clima no disponible';
  }

  weatherMainText(): string {
    const current = this.weather();
    if (!current) return this.weatherStatusText();
    const temperature = current.temperatureCelsius;
    if (typeof temperature === 'number') return `${Math.round(temperature)}°C`;
    if (current.weatherText) return current.weatherText;
    const temperatureText = typeof temperature === 'number' ? `${Math.round(temperature)}°C` : '';
    return [temperatureText, current.weatherText || this.weatherStatusText()].filter(Boolean).join(' · ');
  }

  weatherIconLabel(): string {
    const current = this.weather();
    if (this.weatherLoading()) return 'Consultando clima';
    if (current?.floodRisk) return 'Riesgo de inundacion';
    return current?.weatherText || 'Clima actual';
  }

  weatherSubtitle(): string {
    const current = this.weather();
    if (!current) return 'Usa la ubicacion para consultar Open-Meteo.';
    if (current.enabled === false) return current.reason;
    const location = [current.locationName, current.province].filter(Boolean).join(', ');
    const humidity = current.relativeHumidity ? `Humedad ${current.relativeHumidity}%` : '';
    const rain = current.rainLastHoursMm ? `Lluvia ${current.rainLastHoursMm.toFixed(1)} mm` : '';
    return [location, humidity, rain].filter(Boolean).join(' · ') || current.reason;
  }

  private loadWeatherStatus() {
    if (!navigator.geolocation) return;
    this.weatherLoading.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.reports.weatherStatus(position.coords.latitude, position.coords.longitude).subscribe({
          next: (weather) => {
            this.weather.set(weather);
            this.weatherLoading.set(false);
          },
          error: () => {
            this.weather.set(null);
            this.weatherLoading.set(false);
          },
        });
      },
      () => {
        this.weatherLoading.set(false);
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 },
    );
  }

  private loadThemePreference() {
    const saved = localStorage.getItem(this.themeStorageKey);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.setDarkTheme(saved ? saved === 'dark' : prefersDark);
  }
}
