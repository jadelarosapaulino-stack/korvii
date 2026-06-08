import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface TrafficLightsSettings {
  overpassEndpoint: string;
  defaultSouth: number;
  defaultWest: number;
  defaultNorth: number;
  defaultEast: number;
  defaultProvince: string;
  defaultMunicipality: string;
  importProvinces: string[];
}

@Injectable()
export class TrafficLightsSettingsService {
  private readonly logger = new Logger(TrafficLightsSettingsService.name);
  private readonly configPath: string;
  private current: TrafficLightsSettings;

  constructor(private readonly config: ConfigService) {
    this.configPath = this.config.get<string>(
      "TRAFFIC_LIGHTS_CONFIG_PATH",
      join(process.cwd(), ".tmp", "traffic-lights-config.json"),
    );
    this.current = this.load();
  }

  get(): TrafficLightsSettings {
    return { ...this.current };
  }

  update(patch: Partial<TrafficLightsSettings>): TrafficLightsSettings {
    this.current = this.sanitize({ ...this.current, ...patch });
    this.persist();
    return this.get();
  }

  private load(): TrafficLightsSettings {
    if (!existsSync(this.configPath)) return this.defaultConfig();

    try {
      const stored = JSON.parse(
        readFileSync(this.configPath, "utf8"),
      ) as Partial<TrafficLightsSettings>;
      return this.sanitize({ ...this.defaultConfig(), ...stored });
    } catch (error) {
      this.logger.warn(
        `No se pudo leer configuracion de semaforos: ${error instanceof Error ? error.message : String(error)}`,
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
