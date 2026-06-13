import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { REPORT_CATEGORY_LABELS, ReportCategory } from './reports.service';
import { API_URL } from './api.config';

export interface ReportCategoryConfig {
  id: ReportCategory;
  label: string;
  enabled: boolean;
  defaultRiskLevel: number;
  requiresEmergencyCall: boolean;
  emergencyInstructions: string;
}

export interface SystemStorageConfig {
  provider: string;
  retentionDays: number;
  evidenceMaxFiles: number;
  evidenceMaxMb: number;
  allowedFileTypes: string[];
  antivirusScanEnabled: boolean;
  encryptAtRest: boolean;
  publicAccess: boolean;
  localPath: string;
  localPublicBaseUrl: string;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3ForcePathStyle: boolean;
  azureAccountName: string;
  azureContainer: string;
  azureConnectionString: string;
  azureCdnBaseUrl: string;
}

export interface SystemLibraryConfig {
  mapProvider: string;
  maptilerApiKey: string;
  mapStyleLight: string;
  mapStyleDark: string;
  mapThemeLight: SystemMapThemeConfig;
  mapThemeDark: SystemMapThemeConfig;
  defaultLatitude: number;
  defaultLongitude: number;
  defaultZoom: number;
  mapRenderer: string;
  enableMapClustering: boolean;
  enableHeatmapLayer: boolean;
  enableGeolocationControl: boolean;
  chartLibrary: string;
  chartTheme: string;
  chartAnimationEnabled: boolean;
  chartRefreshSeconds: number;
  routingProvider: string;
  routingEndpoint: string;
  avoidHighRiskReports: boolean;
  routeRiskRadiusMeters: number;
}

export interface SystemMapThemeConfig {
  background: string;
  land: string;
  park: string;
  water: string;
  building: string;
  buildingOutline: string;
  road: string;
  roadPrimary: string;
  roadSecondary: string;
  roadCasing: string;
  label: string;
  labelMuted: string;
  poi: string;
  boundary: string;
  googleBrightnessMin: number;
  googleBrightnessMax: number;
  googleContrast: number;
  googleSaturation: number;
  googleHueRotate: number;
}

export interface SystemSubscriptionConfig {
  citizenSubscriptionsEnabled: boolean;
  institutionalSubscriptionsEnabled: boolean;
  requireManualApproval: boolean;
}

export interface SystemSocialAuthConfig {
  googleClientId: string;
  facebookAppId: string;
  facebookAppSecret: string;
  facebookAppSecretConfigured?: boolean;
}

export interface SystemWeatherConfig {
  weatherProvider: string;
  floodProvider: string;
  premiumProvider: string;
  premiumApiKey: string;
  useOpenMeteoForecast: boolean;
  useOpenMeteoFlood: boolean;
  usePremiumNowcasting: boolean;
  useOfficialAlerts: boolean;
  floodMonitorEnabled: boolean;
  floodMonitorCountry: string;
  floodMonitorCountries: string[];
  floodMonitorPoints: string;
  monitorIntervalMinutes: number;
  activationLeadMinutes: number;
  intenseRainHourlyThresholdMm: number;
  intenseRainThreeHourThresholdMm: number;
  intenseRainProbabilityThreshold: number;
  riverDischargeMultiplier: number;
  automaticFloodReportTtlHours: number;
}

export interface SystemApiKeysConfig {
  maptiler: string;
  googleMaps: string;
  openRouteService: string;
  openAi: string;
  accuWeather: string;
  openWeatherMap: string;
  weatherApi: string;
  visualCrossing: string;
  weatherbit: string;
  windy: string;
  ibmWeather: string;
  googleForecast: string;
  tomorrowIo: string;
  meteomatics: string;
  googleFloodForecasting: string;
  localWeatherAuthority: string;
}

export interface SystemIntegrationConfig {
  mapProvider: string;
  geocodingProvider: string;
  routingProvider: string;
  aiProvider: string;
  weatherProvider: string;
  floodProvider: string;
  storageProvider: string;
}

export interface SystemConfig {
  categories: ReportCategoryConfig[];
  storage: SystemStorageConfig;
  libraries: SystemLibraryConfig;
  subscriptions: SystemSubscriptionConfig;
  socialAuth: SystemSocialAuthConfig;
  weather: SystemWeatherConfig;
  apiKeys: SystemApiKeysConfig;
  integrations: SystemIntegrationConfig;
}

@Injectable({ providedIn: 'root' })
export class SystemConfigService {
  private readonly storageKey = 'ruta_segura_system_config';
  readonly config = signal<SystemConfig>(this.readConfig());

  constructor(private readonly http: HttpClient) {}

  loadSharedConfig(): Observable<SystemConfig> {
    return this.http.get<Partial<SystemConfig>>(`${API_URL}/system/config`).pipe(
      map((shared) => this.applySharedConfig(shared)),
      catchError(() => of(this.config())),
    );
  }

  loadWeatherConfig() {
    this.http.get<SystemWeatherConfig>(`${API_URL}/reports/weather/config`).subscribe({
      next: (weather) => this.applyWeatherConfig(weather),
      error: () => undefined,
    });
  }

  loadSocialAuthConfig() {
    this.http.get<SystemSocialAuthConfig>(`${API_URL}/auth/social/settings`).subscribe({
      next: (socialAuth) => this.applySocialAuthConfig(socialAuth),
      error: () => undefined,
    });
  }

  getCategoryConfig(category: string | null | undefined): ReportCategoryConfig | null {
    return this.config().categories.find((item) => item.id === category) ?? null;
  }

  updateCategory(category: ReportCategory, patch: Partial<ReportCategoryConfig>) {
    this.update({
      ...this.config(),
      categories: this.config().categories.map((item) => (item.id === category ? { ...item, ...patch } : item)),
    });
  }

  updateStorage(patch: Partial<SystemStorageConfig>) {
    this.update({ ...this.config(), storage: { ...this.config().storage, ...patch } });
  }

  updateLibraries(patch: Partial<SystemLibraryConfig>) {
    this.update({ ...this.config(), libraries: { ...this.config().libraries, ...patch } });
  }

  updateSubscriptions(patch: Partial<SystemSubscriptionConfig>) {
    this.update({ ...this.config(), subscriptions: { ...this.config().subscriptions, ...patch } });
  }

  updateSocialAuth(patch: Partial<SystemSocialAuthConfig>) {
    const optimistic = { ...this.config().socialAuth, ...patch };
    this.update({ ...this.config(), socialAuth: optimistic });
  }

  updateWeather(patch: Partial<SystemWeatherConfig>) {
    const optimistic = { ...this.config().weather, ...patch, premiumApiKey: '' };
    this.update({ ...this.config(), weather: optimistic });
  }

  updateApiKeys(_patch: Partial<SystemApiKeysConfig>) {
    const apiKeys = this.emptyApiKeys();
    this.update({
      ...this.config(),
      apiKeys,
      libraries: {
        ...this.config().libraries,
        maptilerApiKey: '',
      },
      weather: {
        ...this.config().weather,
        premiumApiKey: '',
      },
    });
  }

  updateIntegrations(patch: Partial<SystemIntegrationConfig>) {
    const integrations = { ...this.config().integrations, ...patch };
    this.update({
      ...this.config(),
      integrations,
      libraries: {
        ...this.config().libraries,
        mapProvider: patch.mapProvider ?? this.config().libraries.mapProvider,
        routingProvider: patch.routingProvider ?? this.config().libraries.routingProvider,
      },
      weather: {
        ...this.config().weather,
        weatherProvider: patch.weatherProvider ?? this.config().weather.weatherProvider,
        floodProvider: patch.floodProvider ?? this.config().weather.floodProvider,
      },
      storage: {
        ...this.config().storage,
        provider: patch.storageProvider ?? this.config().storage.provider,
      },
    });
  }

  resetDefaults() {
    const defaults = this.defaultConfig();
    this.update(defaults);
  }

  saveSharedConfig(config = this.config()): Observable<Partial<SystemConfig>> {
    const payload: Partial<SystemConfig> = {
      categories: config.categories,
      libraries: { ...config.libraries, maptilerApiKey: '' },
      integrations: config.integrations,
      storage: config.storage,
      subscriptions: config.subscriptions,
    };
    return this.http.patch<Partial<SystemConfig>>(`${API_URL}/system/config`, payload).pipe(
      map((shared) => {
        this.applySharedConfig(shared);
        return shared;
      }),
    );
  }

  saveConfig(config = this.config()) {
    const socialAuth: Partial<SystemSocialAuthConfig> = {
      googleClientId: config.socialAuth.googleClientId,
      facebookAppId: config.socialAuth.facebookAppId,
    };
    return forkJoin({
      shared: this.saveSharedConfig(config),
      weather: this.http.patch<SystemWeatherConfig>(`${API_URL}/reports/weather/config`, { ...config.weather, premiumApiKey: '' }),
      socialAuth: this.http.patch<SystemSocialAuthConfig>(`${API_URL}/auth/social/settings`, socialAuth),
    }).pipe(
      map((result) => {
        this.applyWeatherConfig(result.weather);
        this.applySocialAuthConfig(result.socialAuth);
        return result;
      }),
    );
  }

  private update(next: SystemConfig) {
    const sanitized = this.sanitizeFrontendConfig(next);
    this.config.set(sanitized);
    localStorage.setItem(this.storageKey, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent('rs-map-config-change', { detail: sanitized.libraries }));
  }

  private applyWeatherConfig(weather: SystemWeatherConfig) {
    this.update({ ...this.config(), weather: { ...this.defaultConfig().weather, ...weather, premiumApiKey: '' } });
  }

  private applySocialAuthConfig(socialAuth: SystemSocialAuthConfig) {
    this.update({ ...this.config(), socialAuth: { ...this.defaultConfig().socialAuth, ...socialAuth } });
  }

  private applySharedConfig(shared: Partial<SystemConfig>): SystemConfig {
    const next = this.mergeConfig(shared, this.config());
    this.update(next);
    return next;
  }

  private readConfig(): SystemConfig {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return this.defaultConfig();

    try {
      const stored = JSON.parse(raw) as Partial<SystemConfig>;
      return this.mergeConfig(stored);
    } catch {
      localStorage.removeItem(this.storageKey);
      return this.defaultConfig();
    }
  }

  private mergeConfig(stored: Partial<SystemConfig>, base = this.defaultConfig()): SystemConfig {
      const apiKeys = this.emptyApiKeys();
      const integrations = {
        ...base.integrations,
        ...stored.integrations,
        mapProvider: stored.integrations?.mapProvider ?? stored.libraries?.mapProvider ?? base.integrations.mapProvider,
        routingProvider: stored.integrations?.routingProvider ?? stored.libraries?.routingProvider ?? base.integrations.routingProvider,
        weatherProvider: stored.integrations?.weatherProvider ?? stored.weather?.weatherProvider ?? base.integrations.weatherProvider,
        floodProvider: stored.integrations?.floodProvider ?? stored.weather?.floodProvider ?? base.integrations.floodProvider,
        storageProvider: stored.integrations?.storageProvider ?? stored.storage?.provider ?? base.integrations.storageProvider,
      };
      return {
        ...base,
        ...stored,
        categories: this.mergeCategories(stored.categories, base.categories),
        storage: { ...base.storage, ...stored.storage, provider: integrations.storageProvider },
        libraries: {
          ...base.libraries,
          ...stored.libraries,
          maptilerApiKey: '',
          mapProvider: integrations.mapProvider,
          routingProvider: integrations.routingProvider,
          mapThemeLight: { ...base.libraries.mapThemeLight, ...stored.libraries?.mapThemeLight },
          mapThemeDark: { ...base.libraries.mapThemeDark, ...stored.libraries?.mapThemeDark },
        },
        subscriptions: { ...base.subscriptions, ...stored.subscriptions },
        socialAuth: { ...base.socialAuth, ...stored.socialAuth },
        weather: {
          ...base.weather,
          ...stored.weather,
          premiumApiKey: '',
          weatherProvider: integrations.weatherProvider,
          floodProvider: integrations.floodProvider,
          floodMonitorCountries: stored.weather?.floodMonitorCountries?.length
            ? stored.weather.floodMonitorCountries
            : [stored.weather?.floodMonitorCountry ?? base.weather.floodMonitorCountry],
        },
        apiKeys,
        integrations,
      };
  }

  private sanitizeFrontendConfig(config: SystemConfig): SystemConfig {
    return {
      ...config,
      apiKeys: this.emptyApiKeys(),
      libraries: {
        ...config.libraries,
        maptilerApiKey: '',
      },
      weather: {
        ...config.weather,
        premiumApiKey: '',
      },
    };
  }

  private emptyApiKeys(): SystemApiKeysConfig {
    return {
      maptiler: '',
      googleMaps: '',
      openRouteService: '',
      openAi: '',
      accuWeather: '',
      openWeatherMap: '',
      weatherApi: '',
      visualCrossing: '',
      weatherbit: '',
      windy: '',
      ibmWeather: '',
      googleForecast: '',
      tomorrowIo: '',
      meteomatics: '',
      googleFloodForecasting: '',
      localWeatherAuthority: '',
    };
  }

  private mergeCategories(stored: SystemConfig['categories'] | undefined, base = this.defaultConfig().categories): ReportCategoryConfig[] {
    const storedById = new Map((stored ?? []).map((item) => [item.id, item]));
    return base.map((category) => ({ ...category, ...storedById.get(category.id) }));
  }

  private defaultConfig(): SystemConfig {
    const categories: ReportCategoryConfig[] = (Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((id) => ({
      id,
      label: REPORT_CATEGORY_LABELS[id],
      enabled: true,
      defaultRiskLevel: this.defaultRiskLevel(id),
      requiresEmergencyCall: ['ACCIDENT'].includes(id),
      emergencyInstructions: 'Si hay personas heridas, peligro inmediato o bloqueo crítico de la vía, contacta al 911 y comparte tu ubicación.',
    }));

    return {
      categories,
      storage: {
        provider: 'Local uploads',
        retentionDays: 365,
        evidenceMaxFiles: 5,
        evidenceMaxMb: 5,
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp'],
        antivirusScanEnabled: false,
        encryptAtRest: true,
        publicAccess: false,
        localPath: 'uploads/reports',
        localPublicBaseUrl: '/uploads/reports',
        s3Endpoint: '',
        s3Region: 'us-east-1',
        s3Bucket: '',
        s3AccessKeyId: '',
        s3SecretAccessKey: '',
        s3ForcePathStyle: true,
        azureAccountName: '',
        azureContainer: '',
        azureConnectionString: '',
        azureCdnBaseUrl: '',
      },
      libraries: {
        mapProvider: 'OpenStreetMap',
        maptilerApiKey: '',
        mapStyleLight: 'streets-v2',
        mapStyleDark: 'streets-v2-dark',
        mapThemeLight: this.defaultMapThemeLight(),
        mapThemeDark: this.defaultMapThemeDark(),
        defaultLatitude: 18.4861,
        defaultLongitude: -69.9312,
        defaultZoom: 12,
        mapRenderer: 'MapLibre GL',
        enableMapClustering: true,
        enableHeatmapLayer: true,
        enableGeolocationControl: true,
        chartLibrary: 'Chart.js',
        chartTheme: 'Sistema',
        chartAnimationEnabled: true,
        chartRefreshSeconds: 60,
        routingProvider: 'OSRM publico',
        routingEndpoint: 'https://router.project-osrm.org/route/v1/driving',
        avoidHighRiskReports: true,
        routeRiskRadiusMeters: 180,
      },
      subscriptions: {
        citizenSubscriptionsEnabled: true,
        institutionalSubscriptionsEnabled: true,
        requireManualApproval: true,
      },
      socialAuth: {
        googleClientId: '',
        facebookAppId: '',
        facebookAppSecret: '',
      },
      weather: {
        weatherProvider: 'Open-Meteo Forecast',
        floodProvider: 'Open-Meteo Flood / GloFAS',
        premiumProvider: 'Ninguno',
        premiumApiKey: '',
        useOpenMeteoForecast: true,
        useOpenMeteoFlood: true,
        usePremiumNowcasting: false,
        useOfficialAlerts: true,
        floodMonitorEnabled: true,
        floodMonitorCountry: 'DO',
        floodMonitorCountries: ['DO'],
        floodMonitorPoints: '',
        monitorIntervalMinutes: 30,
        activationLeadMinutes: 30,
        intenseRainHourlyThresholdMm: 15,
        intenseRainThreeHourThresholdMm: 35,
        intenseRainProbabilityThreshold: 70,
        riverDischargeMultiplier: 1.25,
        automaticFloodReportTtlHours: 4,
      },
      apiKeys: {
        maptiler: '',
        googleMaps: '',
        openRouteService: '',
        openAi: '',
        accuWeather: '',
        openWeatherMap: '',
        weatherApi: '',
        visualCrossing: '',
        weatherbit: '',
        windy: '',
        ibmWeather: '',
        googleForecast: '',
        tomorrowIo: '',
        meteomatics: '',
        googleFloodForecasting: '',
        localWeatherAuthority: '',
      },
      integrations: {
        mapProvider: 'OpenStreetMap',
        geocodingProvider: 'OpenStreetMap Nominatim',
        routingProvider: 'OSRM publico',
        aiProvider: 'OpenAI',
        weatherProvider: 'Open-Meteo Forecast',
        floodProvider: 'Open-Meteo Flood / GloFAS',
        storageProvider: 'Local uploads',
      },
    };
  }

  private defaultRiskLevel(category: ReportCategory): number {
    const risk: Record<ReportCategory, number> = {
      ACCIDENT: 5,
      TRAFFIC_LIGHT_DAMAGED: 4,
      ROAD_DAMAGE: 4,
      ROAD_OBSTRUCTION: 4,
      POOR_LIGHTING: 3,
      MISSING_SIGNAGE: 3,
      RECKLESS_DRIVING: 5,
      DANGEROUS_CROSSING: 4,
      FLOOD_ZONE: 5,
      OTHER: 2,
    };
    return risk[category];
  }

  private defaultMapThemeLight(): SystemMapThemeConfig {
    return {
      background: '#EEF7F6',
      land: '#F7FBF9',
      park: '#DDF3E6',
      water: '#B9E7EF',
      building: '#E2EBF0',
      buildingOutline: '#CFDDE4',
      road: '#FFFFFF',
      roadPrimary: '#A7DCD7',
      roadSecondary: '#D5E7EF',
      roadCasing: '#8FBFCA',
      label: '#163548',
      labelMuted: '#657A86',
      poi: '#4F8F8B',
      boundary: '#9ABFC3',
      googleBrightnessMin: 0.06,
      googleBrightnessMax: 0.98,
      googleContrast: 0.1,
      googleSaturation: -0.28,
      googleHueRotate: 22,
    };
  }

  private defaultMapThemeDark(): SystemMapThemeConfig {
    return {
      background: '#0D1B24',
      land: '#12242A',
      park: '#153B32',
      water: '#123F51',
      building: '#1B3039',
      buildingOutline: '#284652',
      road: '#38525D',
      roadPrimary: '#4FA3A0',
      roadSecondary: '#53778A',
      roadCasing: '#0A1821',
      label: '#E5F3F1',
      labelMuted: '#A8BDC2',
      poi: '#98D6CF',
      boundary: '#4F737A',
      googleBrightnessMin: 0.04,
      googleBrightnessMax: 0.74,
      googleContrast: 0.14,
      googleSaturation: -0.32,
      googleHueRotate: 16,
    };
  }
}

