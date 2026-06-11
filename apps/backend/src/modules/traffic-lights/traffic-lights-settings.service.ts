import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { SystemConfigService } from "../system-config/system-config.service";

export interface TrafficLightsSettings {
  overpassEndpoint: string;
  defaultSouth: number;
  defaultWest: number;
  defaultNorth: number;
  defaultEast: number;
  defaultProvince: string;
  defaultMunicipality: string;
  importProvinces: string[];
  automaticReportsEnabled: boolean;
  automaticReportTtlHours: number;
  automaticReportRadiusMeters: number;
  automaticReportMonitorIntervalMinutes: number;
}

@Injectable()
export class TrafficLightsSettingsService implements OnModuleInit {
  private static readonly CONFIG_KEY = "traffic_lights_settings";
  private readonly configPath: string;
  private current: TrafficLightsSettings;

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.configPath = this.config.get<string>(
      "TRAFFIC_LIGHTS_CONFIG_PATH",
      join(process.cwd(), ".tmp", "traffic-lights-config.json"),
    );
    this.current = this.defaultConfig();
  }

  async onModuleInit() {
    const defaults = this.defaultConfig();
    const stored = await this.systemConfig.loadValue(
      TrafficLightsSettingsService.CONFIG_KEY,
      defaults,
      this.configPath,
    );
    this.current = this.sanitize({ ...defaults, ...stored });
    await this.persist();
  }

  get(): TrafficLightsSettings {
    return { ...this.current };
  }

  async update(
    patch: Partial<TrafficLightsSettings>,
  ): Promise<TrafficLightsSettings> {
    this.current = this.sanitize({ ...this.current, ...patch });
    await this.persist();
    return this.get();
  }

  private async persist() {
    await this.systemConfig.saveValue(
      TrafficLightsSettingsService.CONFIG_KEY,
      this.current,
    );
  }

  private defaultConfig(): TrafficLightsSettings {
    return {
      overpassEndpoint: this.config.get<string>(
        "TRAFFIC_LIGHTS_OVERPASS_ENDPOINT",
        "https://overpass.kumi.systems/api/interpreter",
      ),
      defaultSouth: this.numberFromEnv("TRAFFIC_LIGHTS_DEFAULT_SOUTH", 18.35),
      defaultWest: this.numberFromEnv("TRAFFIC_LIGHTS_DEFAULT_WEST", -70.05),
      defaultNorth: this.numberFromEnv("TRAFFIC_LIGHTS_DEFAULT_NORTH", 18.6),
      defaultEast: this.numberFromEnv("TRAFFIC_LIGHTS_DEFAULT_EAST", -69.75),
      defaultProvince: this.config.get<string>(
        "TRAFFIC_LIGHTS_DEFAULT_PROVINCE",
        "Santo Domingo",
      ),
      defaultMunicipality: this.config.get<string>(
        "TRAFFIC_LIGHTS_DEFAULT_MUNICIPALITY",
        "Gran Santo Domingo",
      ),
      importProvinces: this.stringListFromEnv(
        "TRAFFIC_LIGHTS_IMPORT_PROVINCES",
        ["Santo Domingo"],
      ),
      automaticReportsEnabled:
        this.config.get<string>("TRAFFIC_LIGHTS_AUTOMATIC_REPORTS_ENABLED", "true") !==
        "false",
      automaticReportTtlHours: this.numberFromEnv(
        "TRAFFIC_LIGHTS_AUTOMATIC_REPORT_TTL_HOURS",
        24,
      ),
      automaticReportRadiusMeters: this.numberFromEnv(
        "TRAFFIC_LIGHTS_AUTOMATIC_REPORT_RADIUS_METERS",
        120,
      ),
      automaticReportMonitorIntervalMinutes: this.numberFromEnv(
        "TRAFFIC_LIGHTS_AUTOMATIC_REPORT_MONITOR_INTERVAL_MINUTES",
        30,
      ),
    };
  }

  private sanitize(settings: TrafficLightsSettings): TrafficLightsSettings {
    return {
      overpassEndpoint: String(
        settings.overpassEndpoint ||
          "https://overpass.kumi.systems/api/interpreter",
      ),
      defaultSouth: this.clamp(Number(settings.defaultSouth), 18.35, -90, 90),
      defaultWest: this.clamp(Number(settings.defaultWest), -70.05, -180, 180),
      defaultNorth: this.clamp(Number(settings.defaultNorth), 18.6, -90, 90),
      defaultEast: this.clamp(Number(settings.defaultEast), -69.75, -180, 180),
      defaultProvince: String(settings.defaultProvince || ""),
      defaultMunicipality: String(settings.defaultMunicipality || ""),
      importProvinces: this.cleanStringList(settings.importProvinces),
      automaticReportsEnabled: Boolean(settings.automaticReportsEnabled),
      automaticReportTtlHours: this.clamp(
        Number(settings.automaticReportTtlHours),
        24,
        1,
        168,
      ),
      automaticReportRadiusMeters: this.clamp(
        Number(settings.automaticReportRadiusMeters),
        120,
        20,
        1000,
      ),
      automaticReportMonitorIntervalMinutes: this.clamp(
        Number(settings.automaticReportMonitorIntervalMinutes),
        30,
        5,
        1440,
      ),
    };
  }

  private numberFromEnv(key: string, fallback: number): number {
    return this.clamp(
      Number(this.config.get<string>(key, String(fallback))),
      fallback,
      -180,
      180,
    );
  }

  private stringListFromEnv(key: string, fallback: string[]): string[] {
    return this.cleanStringList(this.config.get<string>(key, "").split(","))
      .length
      ? this.cleanStringList(this.config.get<string>(key, "").split(","))
      : fallback;
  }

  private cleanStringList(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return Array.from(
      new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    );
  }

  private clamp(
    value: number,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }
}
