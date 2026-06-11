import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { SystemConfigService } from "../system-config/system-config.service";

export interface WeatherAutomationConfig {
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

@Injectable()
export class WeatherSettingsService implements OnModuleInit {
  private static readonly CONFIG_KEY = "weather_settings";
  private readonly configPath: string;
  private current: WeatherAutomationConfig;

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.configPath = this.config.get<string>(
      "WEATHER_CONFIG_PATH",
      join(process.cwd(), ".tmp", "weather-config.json"),
    );
    this.current = this.defaultConfig();
  }

  async onModuleInit() {
    const defaults = this.defaultConfig();
    const stored = await this.systemConfig.loadValue(
      WeatherSettingsService.CONFIG_KEY,
      defaults,
      this.configPath,
    );
    this.current = this.sanitize({ ...defaults, ...stored });
    await this.persist();
  }

  get(): WeatherAutomationConfig {
    return { ...this.current };
  }

  async update(
    patch: Partial<WeatherAutomationConfig>,
  ): Promise<WeatherAutomationConfig> {
    this.current = this.sanitize({ ...this.current, ...patch });
    await this.persist();
    return this.get();
  }

  private async persist() {
    await this.systemConfig.saveValue(
      WeatherSettingsService.CONFIG_KEY,
      this.current,
    );
  }

  private defaultConfig(): WeatherAutomationConfig {
    const googleForecastApiKey = this.config
      .get<string>(
        "GOOGLE_FORECAST_API_KEY",
        this.config.get<string>("GOOGLE_MAPS_API_KEY", ""),
      )
      .trim();
    const googleFloodApiKey = this.config
      .get<string>("GOOGLE_FLOOD_FORECASTING_API_KEY", googleForecastApiKey)
      .trim();

    return {
      weatherProvider: googleForecastApiKey
        ? "Google Weather Forecast API"
        : "Open-Meteo Forecast",
      floodProvider: googleFloodApiKey
        ? "Google Flood Forecasting API"
        : "Open-Meteo Flood / GloFAS",
      premiumProvider: googleForecastApiKey ? "Google Forecast" : "Ninguno",
      premiumApiKey: googleForecastApiKey || googleFloodApiKey,
      useOpenMeteoForecast: true,
      useOpenMeteoFlood: true,
      usePremiumNowcasting: false,
      useOfficialAlerts: true,
      floodMonitorEnabled:
        this.config.get<string>("WEATHER_FLOOD_MONITOR_ENABLED", "false") ===
        "true",
      floodMonitorCountry: this.config
        .get<string>("WEATHER_FLOOD_MONITOR_COUNTRY", "DO")
        .trim(),
      floodMonitorCountries: this.countriesFromEnv(),
      floodMonitorPoints: this.config
        .get<string>("WEATHER_FLOOD_MONITOR_POINTS", "")
        .trim(),
      monitorIntervalMinutes: this.numberFromEnv(
        "WEATHER_FLOOD_MONITOR_INTERVAL_MINUTES",
        30,
        5,
      ),
      activationLeadMinutes: this.numberFromEnv(
        "WEATHER_FLOOD_ACTIVATION_LEAD_MINUTES",
        30,
        0,
      ),
      intenseRainHourlyThresholdMm: this.numberFromEnv(
        "WEATHER_INTENSE_RAIN_HOURLY_MM",
        15,
        1,
      ),
      intenseRainThreeHourThresholdMm: this.numberFromEnv(
        "WEATHER_INTENSE_RAIN_THREE_HOUR_MM",
        35,
        1,
      ),
      intenseRainProbabilityThreshold: this.numberFromEnv(
        "WEATHER_INTENSE_RAIN_PROBABILITY",
        70,
        0,
        100,
      ),
      riverDischargeMultiplier: this.numberFromEnv(
        "WEATHER_RIVER_DISCHARGE_MULTIPLIER",
        1.25,
        1,
      ),
      automaticFloodReportTtlHours: this.numberFromEnv(
        "WEATHER_AUTOMATIC_FLOOD_REPORT_TTL_HOURS",
        4,
        1,
      ),
    };
  }

  private sanitize(config: WeatherAutomationConfig): WeatherAutomationConfig {
    return {
      weatherProvider: String(config.weatherProvider || "Open-Meteo Forecast"),
      floodProvider: String(
        config.floodProvider || "Open-Meteo Flood / GloFAS",
      ),
      premiumProvider: String(config.premiumProvider || "Ninguno"),
      premiumApiKey: String(config.premiumApiKey || ""),
      useOpenMeteoForecast: Boolean(config.useOpenMeteoForecast),
      useOpenMeteoFlood: Boolean(config.useOpenMeteoFlood),
      usePremiumNowcasting: Boolean(config.usePremiumNowcasting),
      useOfficialAlerts: Boolean(config.useOfficialAlerts),
      floodMonitorEnabled: Boolean(config.floodMonitorEnabled),
      floodMonitorCountry: String(config.floodMonitorCountry || "DO").trim(),
      floodMonitorCountries: this.sanitizeCountries(
        config.floodMonitorCountries?.length
          ? config.floodMonitorCountries
          : [config.floodMonitorCountry],
      ),
      floodMonitorPoints: String(config.floodMonitorPoints || "").trim(),
      monitorIntervalMinutes: this.clampNumber(
        config.monitorIntervalMinutes,
        30,
        5,
      ),
      activationLeadMinutes: this.clampNumber(
        config.activationLeadMinutes,
        30,
        0,
      ),
      intenseRainHourlyThresholdMm: this.clampNumber(
        config.intenseRainHourlyThresholdMm,
        15,
        1,
      ),
      intenseRainThreeHourThresholdMm: this.clampNumber(
        config.intenseRainThreeHourThresholdMm,
        35,
        1,
      ),
      intenseRainProbabilityThreshold: this.clampNumber(
        config.intenseRainProbabilityThreshold,
        70,
        0,
        100,
      ),
      riverDischargeMultiplier: this.clampNumber(
        config.riverDischargeMultiplier,
        1.25,
        1,
      ),
      automaticFloodReportTtlHours: this.clampNumber(
        config.automaticFloodReportTtlHours,
        4,
        1,
      ),
    };
  }

  private numberFromEnv(
    key: string,
    fallback: number,
    min: number,
    max = Number.POSITIVE_INFINITY,
  ): number {
    return this.clampNumber(
      Number(this.config.get<string>(key, String(fallback))),
      fallback,
      min,
      max,
    );
  }

  private countriesFromEnv(): string[] {
    const countries = this.config.get<string>(
      "WEATHER_FLOOD_MONITOR_COUNTRIES",
    );
    if (countries) {
      return this.sanitizeCountries(countries.split(","));
    }

    return this.sanitizeCountries([
      this.config.get<string>("WEATHER_FLOOD_MONITOR_COUNTRY", "DO"),
    ]);
  }

  private sanitizeCountries(countries: unknown[]): string[] {
    const normalized = countries
      .map((country) =>
        String(country || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z]/g, ""),
      )
      .map((country) => {
        if (
          [
            "DO",
            "DOM",
            "RD",
            "REPUBLICADOMINICANA",
            "DOMINICANREPUBLIC",
          ].includes(country)
        ) {
          return "DO";
        }

        return country;
      })
      .filter(Boolean);

    return Array.from(new Set(normalized.length ? normalized : ["DO"]));
  }

  private clampNumber(
    value: number,
    fallback: number,
    min: number,
    max = Number.POSITIVE_INFINITY,
  ): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }
}
