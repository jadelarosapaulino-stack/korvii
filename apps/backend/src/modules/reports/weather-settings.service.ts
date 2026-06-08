import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
export class WeatherSettingsService {
  private readonly logger = new Logger(WeatherSettingsService.name);
  private readonly configPath: string;
  private current: WeatherAutomationConfig;

  constructor(private readonly config: ConfigService) {
    this.configPath = this.config.get<string>(
      "WEATHER_CONFIG_PATH",
      join(process.cwd(), ".tmp", "weather-config.json"),
    );
    this.current = this.load();
  }

  get(): WeatherAutomationConfig {
    return { ...this.current };
  }

  update(patch: Partial<WeatherAutomationConfig>): WeatherAutomationConfig {
    this.current = this.sanitize({ ...this.current, ...patch });
    this.persist();
    return this.get();
  }

  private load(): WeatherAutomationConfig {
    if (!existsSync(this.configPath)) return this.defaultConfig();

    try {
      const stored = JSON.parse(
        readFileSync(this.configPath, "utf8"),
      ) as Partial<WeatherAutomationConfig>;
      return this.sanitize({ ...this.defaultConfig(), ...stored });
    } catch (error) {
      this.logger.warn(
        `No se pudo leer configuracion climatica: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.defaultConfig();
    }
  }

  private persist() {
    const directory = dirname(this.configPath);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    writeFileSync(
      this.configPath,
      JSON.stringify(this.current, null, 2),
      "utf8",
    );
  }

  private defaultConfig(): WeatherAutomationConfig {
    return {
      weatherProvider: "Open-Meteo Forecast",
      floodProvider: "Open-Meteo Flood / GloFAS",
      premiumProvider: "Ninguno",
      premiumApiKey: "",
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
