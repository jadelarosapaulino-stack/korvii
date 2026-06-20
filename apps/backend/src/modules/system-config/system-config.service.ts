import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Repository } from "typeorm";
import { UserRole } from "../../common/enums/user-role.enum";
import { SystemConfigEntry } from "./system-config.entity";

type SystemConfig = Record<string, unknown> & {
  categories?: Array<Record<string, unknown>>;
  libraries?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
  apiKeys?: Record<string, unknown>;
};

export interface ExternalApiLogEntry {
  id: string;
  provider: string;
  service: string;
  operation: string;
  status?: number;
  message: string;
  details?: string;
  createdAt: string;
}

export interface ExternalApiLogsPage {
  data: ExternalApiLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private static readonly CONFIG_KEY = "shared";
  private static readonly EXTERNAL_API_LOGS_KEY = "external_api_logs";
  private readonly logger = new Logger(SystemConfigService.name);
  private readonly configPath: string;
  private current: SystemConfig;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SystemConfigEntry)
    private readonly configRepo: Repository<SystemConfigEntry>,
  ) {
    this.configPath = this.config.get<string>(
      "SYSTEM_CONFIG_PATH",
      join(process.cwd(), ".tmp", "system-config.json"),
    );
    this.current = this.defaultConfig();
  }

  async onModuleInit() {
    this.current = await this.load();
  }

  async get(role?: string): Promise<SystemConfig> {
    this.current = await this.load();
    return this.canSeeSecrets(role)
      ? this.current
      : this.withMaskedSecrets(this.current);
  }

  getSecretApiKey(key: string): string {
    const value = this.current.apiKeys?.[key];
    return typeof value === "string" ? value.trim() : "";
  }

  categoryDefaultPhotoUrl(category: string): string {
    const value = this.current.categories?.find(
      (item) => item.id === category,
    )?.defaultPhotoUrl;
    return typeof value === "string" ? value.trim() : "";
  }

  async update(patch: Partial<SystemConfig>): Promise<SystemConfig> {
    this.current = this.merge(await this.load(), patch);
    await this.persist();
    return this.get(UserRole.SUPER_ADMIN);
  }

  async updateCategoryDefaultPhoto(
    category: string,
    defaultPhotoUrl: string,
  ): Promise<SystemConfig> {
    const current = await this.load();
    const categories = Array.isArray(current.categories)
      ? current.categories
      : [];
    const found = categories.some((item) => item.id === category);
    const nextCategories = found
      ? categories.map((item) =>
          item.id === category ? { ...item, defaultPhotoUrl } : item,
        )
      : [...categories, { id: category, defaultPhotoUrl }];

    return this.update({ categories: nextCategories });
  }

  async externalApiLogs(query: {
    page?: string | number;
    limit?: string | number;
  } = {}): Promise<ExternalApiLogsPage> {
    const requestedPage = Number(query.page ?? 1);
    const requestedLimit = Number(query.limit ?? 10);
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, Math.floor(requestedPage))
      : 1;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
      : 10;
    const stored = await this.configRepo.findOne({
      where: { key: SystemConfigService.EXTERNAL_API_LOGS_KEY },
    });
    const logs = Array.isArray(stored?.value?.["logs"])
      ? (stored.value["logs"] as ExternalApiLogEntry[])
      : [];
    const total = logs.length;
    const start = (page - 1) * limit;
    return {
      data: logs.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async clearExternalApiLogs(): Promise<{ logs: ExternalApiLogEntry[] }> {
    await this.configRepo.save(
      this.configRepo.create({
        key: SystemConfigService.EXTERNAL_API_LOGS_KEY,
        value: { logs: [] },
      }),
    );
    return { logs: [] };
  }

  async loadValue<T>(key: string, defaults: T, filePath?: string): Promise<T> {
    const stored = await this.configRepo.findOne({ where: { key } });
    if (stored) return structuredClone(stored.value as T);

    const fileConfig = this.loadValueFromFile<T>(filePath);
    const value = fileConfig ?? defaults;
    await this.saveValue(key, value);
    return structuredClone(value);
  }

  async saveValue<T>(key: string, value: T): Promise<T> {
    await this.configRepo.save(
      this.configRepo.create({
        key,
        value: value as Record<string, unknown>,
      }),
    );
    return structuredClone(value);
  }

  private async load(): Promise<SystemConfig> {
    const stored = await this.configRepo.findOne({
      where: { key: SystemConfigService.CONFIG_KEY },
    });
    if (stored) {
      this.current = this.merge(
        this.defaultConfig(),
        stored.value as SystemConfig,
      );
      await this.persist();
      return this.current;
    }

    const fileConfig = this.loadFromFile();
    if (fileConfig) {
      this.current = this.merge(this.defaultConfig(), fileConfig);
      await this.persist();
      return this.current;
    }

    this.current = this.defaultConfig();
    await this.persist();
    return this.current;
  }

  private loadFromFile(): SystemConfig | null {
    return this.loadValueFromFile<SystemConfig>(this.configPath);
  }

  private loadValueFromFile<T>(filePath?: string): T | null {
    if (!filePath || !existsSync(filePath)) return null;

    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as T;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer configuracion del sistema: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async persist() {
    await this.configRepo.save(
      this.configRepo.create({
        key: SystemConfigService.CONFIG_KEY,
        value: this.current,
      }),
    );
  }

  private defaultConfig(): SystemConfig {
    return {
      libraries: {
        mapProvider: this.config.get<string>("MAP_PROVIDER", "OpenStreetMap"),
        maptilerApiKey: this.config.get<string>("MAPTILER_API_KEY", ""),
        mapRenderer: "MapLibre GL",
        routingProvider: "OSRM publico",
        routingEndpoint: "https://router.project-osrm.org/route/v1/driving",
      },
      integrations: {
        mapProvider: this.config.get<string>("MAP_PROVIDER", "OpenStreetMap"),
        geocodingProvider: "OpenStreetMap Nominatim",
        routingProvider: "OSRM publico",
      },
      apiKeys: {
        maptiler: this.config.get<string>("MAPTILER_API_KEY", ""),
        googleMaps: this.config.get<string>("GOOGLE_MAPS_API_KEY", ""),
        openRouteService: this.config.get<string>(
          "OPENROUTESERVICE_API_KEY",
          "",
        ),
      },
    };
  }

  private withMaskedSecrets(config: SystemConfig): SystemConfig {
    const apiKeys = { ...(config.apiKeys ?? {}) };
    for (const key of Object.keys(apiKeys)) {
      if (key !== "maptiler") apiKeys[key] = "";
    }
    return { ...config, apiKeys };
  }

  private merge(
    base: SystemConfig,
    patch: Partial<SystemConfig>,
  ): SystemConfig {
    return {
      ...base,
      ...patch,
      categories: this.mergeCategories(base.categories, patch.categories),
      libraries: { ...(base.libraries ?? {}), ...(patch.libraries ?? {}) },
      integrations: {
        ...(base.integrations ?? {}),
        ...(patch.integrations ?? {}),
      },
      apiKeys: { ...(base.apiKeys ?? {}), ...(patch.apiKeys ?? {}) },
    };
  }

  private canSeeSecrets(role?: string): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private mergeCategories(
    base: SystemConfig["categories"],
    patch: SystemConfig["categories"],
  ) {
    if (!patch) return base;
    const byId = new Map((base ?? []).map((item) => [item.id, item]));
    for (const category of patch) {
      if (!category?.id) continue;
      byId.set(category.id, { ...(byId.get(category.id) ?? {}), ...category });
    }
    return Array.from(byId.values());
  }
}
