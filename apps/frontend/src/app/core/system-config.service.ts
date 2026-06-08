import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
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
    this.http.patch<SystemSocialAuthConfig>(`${API_URL}/auth/social/settings`, patch).subscribe({
      next: (socialAuth) => this.applySocialAuthConfig(socialAuth),
      error: () => undefined,
    });
  }

  updateWeather(patch: Partial<SystemWeatherConfig>) {
    const optimistic = { ...this.config().weather, ...patch };
    this.update({ ...this.config(), weather: optimistic });
    this.http.patch<SystemWeatherConfig>(`${API_URL}/reports/weather/config`, patch).subscribe({
      next: (weather) => this.applyWeatherConfig(weather),
      error: () => undefined,
    });
  }

  updateApiKeys(patch: Partial<SystemApiKeysConfig>) {
    const apiKeys = { ...this.config().apiKeys, ...patch };
    this.update({
      ...this.config(),
      apiKeys,
      libraries: {
        ...this.config().libraries,
        maptilerApiKey: patch.maptiler ?? this.config().libraries.maptilerApiKey,
      },
      weather: {
        ...this.config().weather,
        premiumApiKey: patch.googleForecast ?? patch.tomorrowIo ?? patch.meteomatics ?? this.config().weather.premiumApiKey,
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
    this.http.patch<SystemWeatherConfig>(`${API_URL}/reports/weather/config`, defaults.weather).subscribe({
      next: (weather) => this.applyWeatherConfig(weather),
      error: () => undefined,
    });
    this.http.patch<SystemSocialAuthConfig>(`${API_URL}/auth/social/settings`, defaults.socialAuth).subscribe({
      next: (socialAuth) => this.applySocialAuthConfig(socialAuth),
      error: () => undefined,
    });
  }

  private update(next: SystemConfig) {
    this.config.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('rs-map-config-change', { detail: next.libraries }));
  }

  private applyWeatherConfig(weather: SystemWeatherConfig) {
    this.update({ ...this.config(), weather: { ...this.defaultConfig().weather, ...weather } });
  }

  private applySocialAuthConfig(socialAuth: SystemSocialAuthConfig) {
    this.update({ ...this.config(), socialAuth: { ...this.defaultConfig().socialAuth, ...socialAuth } });
  }

  private readConfig(): SystemConfig {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return this.defaultConfig();

    try {
      const stored = JSON.parse(raw) as Partial<SystemConfig>;
      const apiKeys = {
        ...this.defaultConfig().apiKeys,
        ...stored.apiKeys,
        maptiler: stored.apiKeys?.maptiler ?? stored.libraries?.maptilerApiKey ?? this.defaultConfig().apiKeys.maptiler,
        googleMaps: stored.apiKeys?.googleMaps ?? '',
        googleForecast:
          stored.apiKeys?.googleForecast ??
          (stored.weather?.weatherProvider === 'Google Weather Forecast API' || stored.weather?.premiumProvider === 'Google Forecast' ? stored.weather?.premiumApiKey : '') ??
          '',
        tomorrowIo: stored.apiKeys?.tomorrowIo ?? (stored.weather?.premiumProvider === 'Tomorrow.io' ? stored.weather?.premiumApiKey : '') ?? '',
        meteomatics: stored.apiKeys?.meteomatics ?? (stored.weather?.premiumProvider === 'Meteomatics' ? stored.weather?.premiumApiKey : '') ?? '',
        googleFloodForecasting: stored.apiKeys?.googleFloodForecasting ?? (stored.weather?.floodProvider === 'Google Flood Forecasting API' ? stored.weather?.premiumApiKey : '') ?? '',
      };
      const defaultConfig = this.defaultConfig();
      const integrations = {
        ...defaultConfig.integrations,
        ...stored.integrations,
        mapProvider: stored.integrations?.mapProvider ?? stored.libraries?.mapProvider ?? defaultConfig.integrations.mapProvider,
        routingProvider: stored.integrations?.routingProvider ?? stored.libraries?.routingProvider ?? defaultConfig.integrations.routingProvider,
        weatherProvider: stored.integrations?.weatherProvider ?? stored.weather?.weatherProvider ?? defaultConfig.integrations.weatherProvider,
        floodProvider: stored.integrations?.floodProvider ?? stored.weather?.floodProvider ?? defaultConfig.integrations.floodProvider,
        storageProvider: stored.integrations?.storageProvider ?? stored.storage?.provider ?? defaultConfig.integrations.storageProvider,
      };
      return {
        ...defaultConfig,
        ...stored,
        categories: this.mergeCategories(stored.categories),
        storage: { ...defaultConfig.storage, ...stored.storage, provider: integrations.storageProvider },
        libraries: { ...defaultConfig.libraries, ...stored.libraries, mapProvider: integrations.mapProvider, routingProvider: integrations.routingProvider },
        subscriptions: { ...defaultConfig.subscriptions, ...stored.subscriptions },
        socialAuth: { ...defaultConfig.socialAuth, ...stored.socialAuth },
        weather: {
          ...defaultConfig.weather,
          ...stored.weather,
          weatherProvider: integrations.weatherProvider,
          floodProvider: integrations.floodProvider,
          floodMonitorCountries: stored.weather?.floodMonitorCountries?.length
            ? stored.weather.floodMonitorCountries
            : [stored.weather?.floodMonitorCountry ?? defaultConfig.weather.floodMonitorCountry],
        },
        apiKeys,
        integrations,
      };
    } catch {
      localStorage.removeItem(this.storageKey);
      return this.defaultConfig();
    }
  }

  private mergeCategories(stored: SystemConfig['categories'] | undefined): ReportCategoryConfig[] {
    const storedById = new Map((stored ?? []).map((item) => [item.id, item]));
    return this.defaultConfig().categories.map((category) => ({ ...category, ...storedById.get(category.id) }));
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
        mapProvider: 'MapTiler',
        maptilerApiKey: '',
        mapStyleLight: 'streets-v2',
        mapStyleDark: 'streets-v2-dark',
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
        mapProvider: 'MapTiler',
        geocodingProvider: 'MapTiler Geocoding',
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
}

