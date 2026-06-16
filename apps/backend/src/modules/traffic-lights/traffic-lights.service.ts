import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReportCategory } from "../../common/enums/report-category.enum";
import { ReportStatus } from "../../common/enums/report-status.enum";
import { UserRole } from "../../common/enums/user-role.enum";
import { RealtimeEventPublisherService } from "../realtime-events/realtime-event-publisher.service";
import { Report } from "../reports/entities/report.entity";
import { StatusHistory } from "../reports/entities/status-history.entity";
import { User } from "../users/user.entity";
import { CreateTrafficLightDto } from "./dto/create-traffic-light.dto";
import { ImportTrafficLightsDto } from "./dto/import-traffic-lights.dto";
import { QueryTrafficLightsDto } from "./dto/query-traffic-lights.dto";
import { UpdateTrafficLightDto } from "./dto/update-traffic-light.dto";
import { TrafficLight } from "./entities/traffic-light.entity";
import {
  TrafficLightsSettings,
  TrafficLightsSettingsService,
} from "./traffic-lights-settings.service";

interface OverpassResponse {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  }>;
}

interface ProvinceBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface ReverseGeocodeResponse {
  display_name?: string;
  address?: Record<string, string | undefined>;
}

interface ReverseGeocodeDetails {
  province?: string | null;
  municipality?: string | null;
  intersection?: string | null;
}

export interface RefreshLocationDetailsResult {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

export type RefreshLocationDetailsStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface RefreshLocationDetailsJob {
  id: string;
  status: RefreshLocationDetailsStatus;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  source: "osm" | "all";
  limit: number;
  skipRecentlyUpdatedHours: number;
  progress: RefreshLocationDetailsResult & { total: number };
  error?: string;
}

export interface GreenLightInsight {
  trafficLight: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    province?: string | null;
    municipality?: string | null;
    intersection?: string | null;
    status: string;
  };
  score: number;
  priority: "low" | "medium" | "high" | "critical";
  nearbyReports: number;
  highRiskReports: number;
  accidents: number;
  damagedSignalReports: number;
  averageRisk: number;
  openReports: number;
  lastReportAt?: Date | null;
  recommendation: string;
  reasons: string[];
}

const DOMINICAN_PROVINCE_BOUNDS: Record<string, ProvinceBounds> = {
  Azua: { south: 18.17, west: -71.02, north: 18.74, east: -70.43 },
  Baoruco: { south: 18.28, west: -71.7, north: 18.72, east: -71.05 },
  Barahona: { south: 17.92, west: -71.33, north: 18.45, east: -70.82 },
  Dajabon: { south: 19.17, west: -71.76, north: 19.72, east: -71.25 },
  "Distrito Nacional": {
    south: 18.4,
    west: -70.05,
    north: 18.52,
    east: -69.86,
  },
  Duarte: { south: 18.96, west: -70.35, north: 19.42, east: -69.75 },
  "El Seibo": { south: 18.56, west: -69.25, north: 19.1, east: -68.55 },
  "Elias Pina": { south: 18.45, west: -72.02, north: 19.05, east: -71.32 },
  Espaillat: { south: 19.28, west: -70.62, north: 19.72, east: -70.16 },
  "Hato Mayor": { south: 18.62, west: -69.55, north: 19.1, east: -68.88 },
  "Hermanas Mirabal": {
    south: 19.25,
    west: -70.48,
    north: 19.55,
    east: -70.12,
  },
  Independencia: { south: 18.02, west: -72.05, north: 18.64, east: -71.43 },
  "La Altagracia": { south: 18.37, west: -68.98, north: 18.93, east: -68.32 },
  "La Romana": { south: 18.25, west: -69.15, north: 18.67, east: -68.66 },
  "La Vega": { south: 18.74, west: -70.92, north: 19.34, east: -70.28 },
  "Maria Trinidad Sanchez": {
    south: 19.28,
    west: -70.2,
    north: 19.74,
    east: -69.65,
  },
  "Monsenor Nouel": { south: 18.78, west: -70.7, north: 19.18, east: -70.22 },
  "Monte Cristi": { south: 19.5, west: -71.88, north: 19.95, east: -71.15 },
  "Monte Plata": { south: 18.7, west: -70.05, north: 19.2, east: -69.35 },
  Pedernales: { south: 17.47, west: -71.83, north: 18.18, east: -71.05 },
  Peravia: { south: 18.15, west: -70.63, north: 18.55, east: -70.1 },
  "Puerto Plata": { south: 19.4, west: -71.05, north: 19.94, east: -70.35 },
  Samana: { south: 19.05, west: -69.65, north: 19.45, east: -69.05 },
  "San Cristobal": { south: 18.22, west: -70.35, north: 18.68, east: -69.86 },
  "San Jose de Ocoa": {
    south: 18.38,
    west: -70.75,
    north: 18.75,
    east: -70.28,
  },
  "San Juan": { south: 18.55, west: -71.75, north: 19.18, east: -70.85 },
  "San Pedro de Macoris": {
    south: 18.3,
    west: -69.6,
    north: 18.78,
    east: -69.05,
  },
  "Sanchez Ramirez": { south: 18.88, west: -70.35, north: 19.3, east: -69.82 },
  Santiago: { south: 19.05, west: -71.08, north: 19.68, east: -70.48 },
  "Santiago Rodriguez": {
    south: 19.15,
    west: -71.55,
    north: 19.62,
    east: -70.95,
  },
  "Santo Domingo": { south: 18.32, west: -70.12, north: 18.72, east: -69.6 },
  Valverde: { south: 19.35, west: -71.22, north: 19.75, east: -70.7 },
};

@Injectable()
export class TrafficLightsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrafficLightsService.name);
  private readonly reverseGeocodeCache = new Map<
    string,
    ReverseGeocodeDetails
  >();
  private refreshLocationDetailsJob: RefreshLocationDetailsJob | null = null;
  private trafficLightMonitorTimer?: ReturnType<typeof setInterval>;
  private trafficLightMonitorRunning = false;

  constructor(
    @InjectRepository(TrafficLight)
    private readonly trafficLightsRepo: Repository<TrafficLight>,
    @InjectRepository(Report) private readonly reportsRepo: Repository<Report>,
    @InjectRepository(StatusHistory)
    private readonly historyRepo: Repository<StatusHistory>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly settingsService: TrafficLightsSettingsService,
    private readonly realtimeEvents: RealtimeEventPublisherService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    setTimeout(() => {
      this.configureTrafficLightMonitorTimer();
      this.runTrafficLightMonitorScan("startup");
    }, 1000);
  }

  onModuleDestroy() {
    if (this.trafficLightMonitorTimer) {
      clearInterval(this.trafficLightMonitorTimer);
      this.trafficLightMonitorTimer = undefined;
    }
  }

  async findAll(query: QueryTrafficLightsDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const qb = this.trafficLightsRepo
      .createQueryBuilder("trafficLight")
      .orderBy("COALESCE(NULLIF(trafficLight.province, ''), 'ZZZ')", "ASC")
      .addOrderBy(
        "COALESCE(NULLIF(trafficLight.municipality, ''), 'ZZZ')",
        "ASC",
      )
      .addOrderBy("trafficLight.name", "ASC")
      .addOrderBy("trafficLight.updatedAt", "DESC");

    if (query.status)
      qb.andWhere("trafficLight.status = :status", { status: query.status });
    if (query.province)
      qb.andWhere("LOWER(trafficLight.province) LIKE LOWER(:province)", {
        province: `%${query.province}%`,
      });
    if (query.municipality)
      qb.andWhere(
        "LOWER(trafficLight.municipality) LIKE LOWER(:municipality)",
        { municipality: `%${query.municipality}%` },
      );
    if (query.q?.trim()) {
      const search = `%${query.q.trim()}%`;
      qb.andWhere(
        "(LOWER(trafficLight.name) LIKE LOWER(:search) OR LOWER(trafficLight.intersection) LIKE LOWER(:search))",
        { search },
      );
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  settings() {
    return this.settingsService.get();
  }

  updateSettings(patch: Partial<TrafficLightsSettings>) {
    return this.settingsService.update(patch).then((settings) => {
      this.configureTrafficLightMonitorTimer();
      return settings;
    });
  }

  async scanTrafficLightSituations(
    source: "manual" | "scheduled" | "startup" = "manual",
  ) {
    const settings = this.settingsService.get();
    if (!settings.automaticReportsEnabled) {
      return {
        source,
        skipped: true,
        reason: "automatic-reports-disabled",
        opened: 0,
        reused: 0,
        closed: 0,
      };
    }

    if (this.trafficLightMonitorRunning) {
      return {
        source,
        skipped: true,
        reason: "scan-already-running",
        opened: 0,
        reused: 0,
        closed: 0,
      };
    }

    this.trafficLightMonitorRunning = true;
    try {
      const radiusMeters = Math.min(
        1000,
        Math.max(100, Number(settings.automaticReportRadiusMeters ?? 120)),
      );
      const { trafficLights, insights } =
        await this.buildGreenLightInsightsSnapshot(radiusMeters);
      const actionableInsights = insights.filter((insight) =>
        this.shouldCreateAutomaticTrafficLightReport(insight),
      );

      let opened = 0;
      let reused = 0;
      const reportIds: string[] = [];
      const trigger =
        source === "manual"
          ? "manual-scan"
          : source === "startup"
            ? "startup-scan"
            : "scheduled-scan";

      for (const insight of actionableInsights) {
        const result = await this.createAutomaticTrafficLightReport(
          insight,
          trigger,
        );
        if (result.created) opened += 1;
        else reused += 1;
        if (result.report?.id) reportIds.push(result.report.id);
      }

      const closed = await this.closeResolvedAutomaticTrafficLightReports(
        insights,
        radiusMeters,
        trigger,
      );

      if (opened || closed) {
        this.logger.log(
          `Revision automatica de semaforos (${source}): ${opened} abiertos, ${reused} reutilizados, ${closed} cerrados.`,
        );
      }

      return {
        source,
        skipped: false,
        analyzedTrafficLights: trafficLights.length,
        actionableTrafficLights: actionableInsights.length,
        opened,
        reused,
        closed,
        reportIds,
        generatedAt: new Date(),
      };
    } finally {
      this.trafficLightMonitorRunning = false;
    }
  }

  async greenLightInsights(
    query: { radiusMeters?: number; limit?: number } = {},
  ) {
    const radiusMeters = Math.min(
      1000,
      Math.max(100, Number(query.radiusMeters ?? 300)),
    );
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 12)));
    const { trafficLights, insights: allInsights } =
      await this.buildGreenLightInsightsSnapshot(radiusMeters);

    const insights = allInsights
      .filter(
        (insight) =>
          insight.nearbyReports > 0 || insight.trafficLight.status !== "active",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const automaticReports = await this.createAutomaticReportsForInsights(
      insights,
    );

    return {
      generatedAt: new Date(),
      radiusMeters,
      windowDays: 90,
      automaticReports,
      kpis: {
        analyzedTrafficLights: trafficLights.length,
        rankedTrafficLights: insights.length,
        critical: insights.filter((item) => item.priority === "critical")
          .length,
        high: insights.filter((item) => item.priority === "high").length,
        affectedReports: insights.reduce(
          (sum, item) => sum + item.nearbyReports,
          0,
        ),
      },
      insights,
    };
  }

  async create(dto: CreateTrafficLightDto) {
    const trafficLight = this.trafficLightsRepo.create({
      ...dto,
      status: dto.status ?? "unknown",
      source: "manual",
      lastObservedAt: new Date(),
    });
    return this.trafficLightsRepo.save(trafficLight);
  }

  async update(id: string, dto: UpdateTrafficLightDto) {
    const trafficLight = await this.trafficLightsRepo.findOneBy({ id });
    if (!trafficLight) throw new NotFoundException("Semaforo no encontrado");

    Object.assign(trafficLight, dto);
    if (
      dto.province !== undefined ||
      dto.municipality !== undefined ||
      dto.intersection !== undefined
    ) {
      trafficLight.locationDetailsRefreshedAt = new Date();
    }
    trafficLight.lastObservedAt = new Date();
    const saved = await this.trafficLightsRepo.save(trafficLight);
    if (saved.status === "offline") {
      const insight = this.buildGreenLightInsight(saved, [], 300);
      await this.createAutomaticTrafficLightReport(insight, "status-update");
    }
    return saved;
  }

  async remove(id: string) {
    const trafficLight = await this.trafficLightsRepo.findOneBy({ id });
    if (!trafficLight) throw new NotFoundException("Semaforo no encontrado");
    await this.trafficLightsRepo.remove(trafficLight);
    return { deleted: true };
  }

  async importFromOpenStreetMap(dto: ImportTrafficLightsDto) {
    const settings = this.settingsService.get();
    const importTargets = this.resolveImportTargets(dto, settings);
    let imported = 0;
    let created = 0;
    let updated = 0;

    for (const target of importTargets) {
      const result = await this.importBoundsFromOpenStreetMap(
        dto,
        settings,
        target.bounds,
        target.province,
      );
      imported += result.imported;
      created += result.created;
      updated += result.updated;
    }

    this.logger.log(
      `Importacion OSM semaforos: ${created} creados, ${updated} actualizados.`,
    );
    return { imported, created, updated };
  }

  startRefreshLocationDetails(
    dto: {
      source?: "osm" | "all";
      limit?: number;
      skipRecentlyUpdatedHours?: number;
    } = {},
  ) {
    const currentJob = this.refreshLocationDetailsJob;
    if (currentJob && ["queued", "running"].includes(currentJob.status)) {
      return {
        accepted: false,
        job: this.cloneRefreshLocationDetailsJob(currentJob),
      };
    }

    const limit = Math.min(1000, Math.max(1, Number(dto.limit ?? 500)));
    const source = dto.source === "all" ? "all" : "osm";
    const skipRecentlyUpdatedHours = Math.min(
      720,
      Math.max(0, Number(dto.skipRecentlyUpdatedHours ?? 24)),
    );
    const job: RefreshLocationDetailsJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "queued",
      requestedAt: new Date().toISOString(),
      source,
      limit,
      skipRecentlyUpdatedHours,
      progress: { scanned: 0, total: 0, updated: 0, skipped: 0, failed: 0 },
    };

    this.refreshLocationDetailsJob = job;
    setTimeout(() => void this.runRefreshLocationDetailsJob(job), 0);
    return { accepted: true, job: this.cloneRefreshLocationDetailsJob(job) };
  }

  getRefreshLocationDetailsJob() {
    return this.refreshLocationDetailsJob
      ? this.cloneRefreshLocationDetailsJob(this.refreshLocationDetailsJob)
      : null;
  }

  async refreshLocationDetails(
    dto: {
      source?: "osm" | "all";
      limit?: number;
      skipRecentlyUpdatedHours?: number;
    } = {},
    onProgress?: (progress: RefreshLocationDetailsJob["progress"]) => void,
  ): Promise<RefreshLocationDetailsResult> {
    const limit = Math.min(1000, Math.max(1, Number(dto.limit ?? 500)));
    const skipRecentlyUpdatedHours = Math.min(
      720,
      Math.max(0, Number(dto.skipRecentlyUpdatedHours ?? 24)),
    );
    const refreshCutoff = new Date(
      Date.now() - skipRecentlyUpdatedHours * 60 * 60 * 1000,
    );
    const qb = this.trafficLightsRepo
      .createQueryBuilder("trafficLight")
      .where("trafficLight.latitude IS NOT NULL")
      .andWhere("trafficLight.longitude IS NOT NULL")
      .andWhere(
        skipRecentlyUpdatedHours > 0
          ? "(trafficLight.locationDetailsRefreshedAt IS NULL OR trafficLight.locationDetailsRefreshedAt < :refreshCutoff)"
          : "1 = 1",
        { refreshCutoff },
      )
      .orderBy("trafficLight.locationDetailsRefreshedAt", "ASC", "NULLS FIRST")
      .addOrderBy("trafficLight.updatedAt", "ASC")
      .take(limit);

    if (dto.source !== "all") {
      qb.andWhere("trafficLight.source = :source", { source: "osm" });
    }

    const trafficLights = await qb.getMany();
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let scanned = 0;

    for (const trafficLight of trafficLights) {
      const details = await this.reverseGeocodeCoordinates(
        Number(trafficLight.latitude),
        Number(trafficLight.longitude),
      );
      scanned += 1;
      if (!details) {
        failed += 1;
        onProgress?.({
          scanned,
          total: trafficLights.length,
          updated,
          skipped,
          failed,
        });
        continue;
      }

      const refreshedAt = new Date();
      const patch = {
        province: details.province || trafficLight.province,
        municipality: details.municipality || trafficLight.municipality,
        intersection: details.intersection || trafficLight.intersection,
      };
      const hasChanges =
        patch.province !== trafficLight.province ||
        patch.municipality !== trafficLight.municipality ||
        patch.intersection !== trafficLight.intersection;

      if (!hasChanges) {
        trafficLight.locationDetailsRefreshedAt = refreshedAt;
        await this.trafficLightsRepo.save(trafficLight);
        skipped += 1;
        onProgress?.({
          scanned,
          total: trafficLights.length,
          updated,
          skipped,
          failed,
        });
        continue;
      }

      Object.assign(trafficLight, patch, {
        lastObservedAt: refreshedAt,
        locationDetailsRefreshedAt: refreshedAt,
      });
      await this.trafficLightsRepo.save(trafficLight);
      updated += 1;
      onProgress?.({
        scanned,
        total: trafficLights.length,
        updated,
        skipped,
        failed,
      });
    }

    this.logger.log(
      `Actualizacion masiva de ubicacion semaforos: ${updated} actualizados, ${skipped} omitidos/sin cambios, ${failed} fallidos. Ventana reciente: ${skipRecentlyUpdatedHours}h.`,
    );
    return { scanned: trafficLights.length, updated, skipped, failed };
  }

  private async runRefreshLocationDetailsJob(job: RefreshLocationDetailsJob) {
    job.status = "running";
    job.startedAt = new Date().toISOString();

    try {
      const result = await this.refreshLocationDetails(
        {
          source: job.source,
          limit: job.limit,
          skipRecentlyUpdatedHours: job.skipRecentlyUpdatedHours,
        },
        (progress) => {
          job.progress = progress;
        },
      );
      job.progress = {
        ...job.progress,
        ...result,
        total: job.progress.total || result.scanned,
      };
      job.status = "completed";
      job.finishedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.finishedAt = new Date().toISOString();
      this.logger.error(
        `Fallo actualizacion de ubicaciones de semaforos: ${job.error}`,
      );
    }
  }

  private cloneRefreshLocationDetailsJob(
    job: RefreshLocationDetailsJob,
  ): RefreshLocationDetailsJob {
    return {
      ...job,
      progress: { ...job.progress },
    };
  }

  private configureTrafficLightMonitorTimer() {
    if (this.trafficLightMonitorTimer) {
      clearInterval(this.trafficLightMonitorTimer);
      this.trafficLightMonitorTimer = undefined;
    }

    const settings = this.settingsService.get();
    if (!settings.automaticReportsEnabled) return;

    const intervalMinutes = Math.min(
      1440,
      Math.max(5, Number(settings.automaticReportMonitorIntervalMinutes ?? 30)),
    );
    this.trafficLightMonitorTimer = setInterval(
      () => this.runTrafficLightMonitorScan("scheduled"),
      intervalMinutes * 60 * 1000,
    );
    this.logger.log(
      `Monitor automatico de semaforos activo cada ${intervalMinutes} minutos.`,
    );
  }

  private runTrafficLightMonitorScan(source: "scheduled" | "startup") {
    void this.scanTrafficLightSituations(source).catch((error) => {
      this.logger.error(
        `Fallo revision automatica de semaforos (${source}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  private async buildGreenLightInsightsSnapshot(radiusMeters: number) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [trafficLights, reports] = await Promise.all([
      this.trafficLightsRepo.find({ order: { updatedAt: "DESC" }, take: 1000 }),
      this.reportsRepo
        .createQueryBuilder("report")
        .leftJoinAndSelect("report.confirmations", "confirmations")
        .where("report.createdAt >= :since", { since })
        .andWhere("report.latitude IS NOT NULL")
        .andWhere("report.longitude IS NOT NULL")
        .andWhere(
          "NOT (report.category = :autoCategory AND report.source = :autoSource AND report.title LIKE :autoTitlePrefix)",
          {
            autoCategory: ReportCategory.TRAFFIC_LIGHT_DAMAGED,
            autoSource: "system",
            autoTitlePrefix: "Situacion con semaforo -%",
          },
        )
        .getMany(),
    ]);

    return {
      trafficLights,
      reports,
      insights: trafficLights.map((trafficLight) =>
        this.buildGreenLightInsight(trafficLight, reports, radiusMeters),
      ),
    };
  }

  private async importBoundsFromOpenStreetMap(
    dto: ImportTrafficLightsDto,
    settings: TrafficLightsSettings,
    bounds: ProvinceBounds,
    province?: string,
  ) {
    this.validateBounds(bounds);

    const importDto = {
      ...dto,
      province: province ?? dto.province,
      municipality: province ? undefined : dto.municipality,
      provinces: province ? [province] : dto.provinces,
    };

    const query = [
      "[out:json][timeout:30];",
      "(",
      `node["highway"="traffic_signals"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`,
      `way["highway"="traffic_signals"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`,
      `relation["highway"="traffic_signals"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`,
      ");",
      "out center tags;",
    ].join("");

    const data = await this.fetchOverpass(query, settings.overpassEndpoint);
    const elements: Array<
      Omit<TrafficLight, "id" | "createdAt" | "updatedAt">
    > = [];
    for (const element of data.elements ?? []) {
      const trafficLight = this.overpassElementToTrafficLight(
        element,
        importDto,
        settings,
      );
      if (!trafficLight) continue;
      elements.push(await this.enrichTrafficLightLocation(trafficLight));
    }

    let created = 0;
    let updated = 0;

    for (const element of elements) {
      const existing = element.osmId
        ? await this.trafficLightsRepo.findOne({
            where: { osmId: element.osmId },
          })
        : null;
      if (existing) {
        Object.assign(existing, {
          name: element.name,
          latitude: element.latitude,
          longitude: element.longitude,
          province: element.province,
          municipality: element.municipality,
          intersection: element.intersection,
          source: "osm",
          lastObservedAt: new Date(),
          status: dto.replaceExisting ? element.status : existing.status,
        });
        await this.trafficLightsRepo.save(existing);
        updated += 1;
      } else {
        await this.trafficLightsRepo.save(
          this.trafficLightsRepo.create(element),
        );
        created += 1;
      }
    }

    return { imported: elements.length, created, updated };
  }

  private buildGreenLightInsight(
    trafficLight: TrafficLight,
    reports: Report[],
    radiusMeters: number,
  ): GreenLightInsight {
    const center = {
      latitude: Number(trafficLight.latitude),
      longitude: Number(trafficLight.longitude),
    };
    const nearbyReports = reports.filter((report) => {
      const distance = this.metersBetween(center, {
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
      });
      return distance <= radiusMeters;
    });
    const highRiskReports = nearbyReports.filter(
      (report) => Number(report.riskLevel) >= 4,
    ).length;
    const accidents = nearbyReports.filter(
      (report) => report.category === ReportCategory.ACCIDENT,
    ).length;
    const damagedSignalReports = nearbyReports.filter(
      (report) => report.category === ReportCategory.TRAFFIC_LIGHT_DAMAGED,
    ).length;
    const openReports = nearbyReports.filter(
      (report) =>
        ![
          ReportStatus.RESOLVED,
          ReportStatus.REJECTED,
          ReportStatus.DUPLICATE,
        ].includes(report.status),
    ).length;
    const confirmationLoad = nearbyReports.reduce(
      (sum, report) =>
        sum + Math.max(0, Number(report.confirmationCount ?? 1) - 1),
      0,
    );
    const averageRisk = nearbyReports.length
      ? Number(
          (
            nearbyReports.reduce(
              (sum, report) => sum + Number(report.riskLevel ?? 0),
              0,
            ) / nearbyReports.length
          ).toFixed(1),
        )
      : 0;
    const lastReportAt =
      nearbyReports
        .map((report) => report.createdAt)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a))[0] ?? null;

    const offlinePenalty =
      trafficLight.status === "offline"
        ? 28
        : trafficLight.status === "unknown"
          ? 12
          : 0;
    const recencyBoost =
      lastReportAt &&
      Date.now() - new Date(lastReportAt).getTime() <= 14 * 24 * 60 * 60 * 1000
        ? 10
        : 0;
    const score = Math.min(
      100,
      Math.round(
        nearbyReports.length * 7 +
          highRiskReports * 10 +
          accidents * 12 +
          damagedSignalReports * 14 +
          openReports * 4 +
          confirmationLoad * 3 +
          averageRisk * 6 +
          offlinePenalty +
          recencyBoost,
      ),
    );
    const priority = this.greenLightPriority(score);

    return {
      trafficLight: {
        id: trafficLight.id,
        name: trafficLight.name,
        latitude: Number(trafficLight.latitude),
        longitude: Number(trafficLight.longitude),
        province: trafficLight.province,
        municipality: trafficLight.municipality,
        intersection: trafficLight.intersection,
        status: trafficLight.status,
      },
      score,
      priority,
      nearbyReports: nearbyReports.length,
      highRiskReports,
      accidents,
      damagedSignalReports,
      averageRisk,
      openReports,
      lastReportAt,
      recommendation: this.greenLightRecommendation(
        priority,
        damagedSignalReports,
        accidents,
        trafficLight.status,
      ),
      reasons: this.greenLightReasons({
        trafficLight,
        nearbyReports: nearbyReports.length,
        highRiskReports,
        accidents,
        damagedSignalReports,
        openReports,
        averageRisk,
        recencyBoost,
      }),
    };
  }

  private async createAutomaticReportsForInsights(
    insights: GreenLightInsight[],
  ) {
    if (!this.settingsService.get().automaticReportsEnabled) {
      return { created: 0, reused: 0, skipped: insights.length, reportIds: [] };
    }

    let created = 0;
    let reused = 0;
    let skipped = 0;
    const reportIds: string[] = [];

    for (const insight of insights) {
      if (!this.shouldCreateAutomaticTrafficLightReport(insight)) {
        skipped += 1;
        continue;
      }

      const result = await this.createAutomaticTrafficLightReport(
        insight,
        "green-light-insights",
      );
      if (result.created) created += 1;
      else reused += 1;
      if (result.report?.id) reportIds.push(result.report.id);
    }

    return { created, reused, skipped, reportIds };
  }

  private shouldCreateAutomaticTrafficLightReport(insight: GreenLightInsight) {
    return (
      insight.trafficLight.status === "offline" ||
      insight.priority === "critical" ||
      insight.priority === "high"
    );
  }

  private async createAutomaticTrafficLightReport(
    insight: GreenLightInsight,
    trigger:
      | "green-light-insights"
      | "status-update"
      | "scheduled-scan"
      | "startup-scan"
      | "manual-scan",
  ) {
    if (!this.settingsService.get().automaticReportsEnabled) {
      return { created: false, report: null };
    }

    const existing = await this.findRecentAutomaticTrafficLightReport(
      insight.trafficLight.latitude,
      insight.trafficLight.longitude,
    );
    if (existing) return { created: false, report: existing };

    const systemUser = await this.findTrafficLightSystemUser();
    const riskLevel =
      insight.priority === "critical" || insight.trafficLight.status === "offline"
        ? 5
        : 4;
    const locationLabel =
      insight.trafficLight.intersection ||
      insight.trafficLight.name ||
      insight.trafficLight.municipality ||
      "semaforo";
    const description = [
      `Reporte automatico generado por KORVI AI al detectar una situacion con un semaforo.`,
      `Prioridad: ${insight.priority}. Puntaje: ${insight.score}/100.`,
      `Recomendacion: ${insight.recommendation}`,
      `Senales: ${insight.reasons.join(" ")}`,
      `Origen: ${trigger}.`,
    ].join(" ");

    const report = this.reportsRepo.create({
      title: `Situacion con semaforo - ${locationLabel}`.slice(0, 180),
      category: ReportCategory.TRAFFIC_LIGHT_DAMAGED,
      description,
      latitude: insight.trafficLight.latitude,
      longitude: insight.trafficLight.longitude,
      province: insight.trafficLight.province ?? undefined,
      municipality: insight.trafficLight.municipality ?? undefined,
      address:
        insight.trafficLight.intersection ||
        insight.trafficLight.name ||
        "Referencia automatica de semaforo",
      riskLevel,
      source: "system",
      createdBy: systemUser,
      history: [
        this.historyRepo.create({
          toStatus: ReportStatus.PENDING,
          comment: `Reporte automatico por situacion de semaforo. ${insight.recommendation}`,
          changedBy: systemUser,
        }),
      ],
    });

    const saved = await this.reportsRepo.save(report);
    await this.publishTrafficLightReportCreated(saved, insight, trigger);
    return { created: true, report: saved };
  }

  private async findRecentAutomaticTrafficLightReport(
    latitude: number,
    longitude: number,
  ) {
    const radiusMeters = this.settingsService.get().automaticReportRadiusMeters;
    const reports = await this.reportsRepo
      .createQueryBuilder("report")
      .where("report.category = :category", {
        category: ReportCategory.TRAFFIC_LIGHT_DAMAGED,
      })
      .andWhere("report.source = :source", { source: "system" })
      .andWhere("report.latitude IS NOT NULL")
      .andWhere("report.longitude IS NOT NULL")
      .andWhere("report.status NOT IN (:...closedStatuses)", {
        closedStatuses: [
          ReportStatus.RESOLVED,
          ReportStatus.REJECTED,
          ReportStatus.DUPLICATE,
        ],
      })
      .getMany();

    return (
      reports.find(
        (report) =>
          this.metersBetween(
            { latitude, longitude },
            {
              latitude: Number(report.latitude),
              longitude: Number(report.longitude),
            },
          ) <= radiusMeters,
      ) ?? null
    );
  }

  private async closeResolvedAutomaticTrafficLightReports(
    insights: GreenLightInsight[],
    radiusMeters: number,
    trigger: string,
  ) {
    const openAutomaticReports = await this.reportsRepo
      .createQueryBuilder("report")
      .where("report.category = :category", {
        category: ReportCategory.TRAFFIC_LIGHT_DAMAGED,
      })
      .andWhere("report.source = :source", { source: "system" })
      .andWhere("report.title LIKE :titlePrefix", {
        titlePrefix: "Situacion con semaforo -%",
      })
      .andWhere("report.latitude IS NOT NULL")
      .andWhere("report.longitude IS NOT NULL")
      .andWhere("report.status NOT IN (:...closedStatuses)", {
        closedStatuses: [
          ReportStatus.RESOLVED,
          ReportStatus.REJECTED,
          ReportStatus.DUPLICATE,
        ],
      })
      .getMany();

    if (!openAutomaticReports.length) return 0;

    const systemUser = await this.findTrafficLightSystemUser();
    let closed = 0;

    for (const report of openAutomaticReports) {
      const nearest = this.findNearestInsightForReport(
        report,
        insights,
        radiusMeters,
      );
      if (!nearest || this.shouldCreateAutomaticTrafficLightReport(nearest)) {
        continue;
      }

      const previousStatus = report.status;
      report.status = ReportStatus.RESOLVED;
      await this.reportsRepo.save(report);
      await this.historyRepo.save(
        this.historyRepo.create({
          report,
          fromStatus: previousStatus,
          toStatus: ReportStatus.RESOLVED,
          comment: `Cierre automatico por revision de semaforos. No se detectan senales activas de prioridad alta, critica o apagado. Origen: ${trigger}.`,
          changedBy: systemUser,
        }),
      );
      await this.publishTrafficLightReportStatusChanged(
        report,
        previousStatus,
        nearest,
        trigger,
      );
      closed += 1;
    }

    return closed;
  }

  private findNearestInsightForReport(
    report: Report,
    insights: GreenLightInsight[],
    radiusMeters: number,
  ) {
    let nearest: GreenLightInsight | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const insight of insights) {
      const distance = this.metersBetween(
        {
          latitude: Number(report.latitude),
          longitude: Number(report.longitude),
        },
        {
          latitude: insight.trafficLight.latitude,
          longitude: insight.trafficLight.longitude,
        },
      );
      if (distance <= radiusMeters && distance < nearestDistance) {
        nearest = insight;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private async publishTrafficLightReportCreated(
    report: Report,
    insight: GreenLightInsight,
    trigger: string,
  ) {
    await this.realtimeEvents.publish({
      type: "traffic_light.report_created",
      reportId: report.id,
      status: report.status,
      category: report.category,
      riskLevel: report.riskLevel,
      province: report.province ?? null,
      municipality: report.municipality ?? null,
      rooms: ["reports:map", "reports:admin", "traffic-lights:alerts"],
      data: {
        trigger,
        trafficLightId: insight.trafficLight.id,
        priority: insight.priority,
        score: insight.score,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
      },
    });
    await this.realtimeEvents.publish({
      type: "report.metrics_changed",
      rooms: ["reports:admin"],
      data: { reportId: report.id },
    });
  }

  private async publishTrafficLightReportStatusChanged(
    report: Report,
    previousStatus: ReportStatus,
    insight: GreenLightInsight,
    trigger: string,
  ) {
    await this.realtimeEvents.publish({
      type: "report.status_changed",
      reportId: report.id,
      status: report.status,
      category: report.category,
      riskLevel: report.riskLevel,
      province: report.province ?? null,
      municipality: report.municipality ?? null,
      rooms: ["reports:map", "reports:admin", "traffic-lights:alerts"],
      data: {
        trigger,
        previousStatus,
        trafficLightId: insight.trafficLight.id,
        priority: insight.priority,
        score: insight.score,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
      },
    });
    await this.realtimeEvents.publish({
      type: "report.metrics_changed",
      rooms: ["reports:admin"],
      data: { reportId: report.id },
    });
  }

  private async findTrafficLightSystemUser() {
    const email = this.config.get<string>(
      "TRAFFIC_LIGHT_SYSTEM_USER_EMAIL",
      this.config.get<string>("WEATHER_SYSTEM_USER_EMAIL", "admin@demo.com"),
    );
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
    if (user) return user;

    const fallback = await this.usersRepo.findOne({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (fallback) return fallback;

    throw new ServiceUnavailableException(
      "No hay usuario de sistema para crear reportes automaticos de semaforos.",
    );
  }

  private greenLightPriority(score: number): GreenLightInsight["priority"] {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 35) return "medium";
    return "low";
  }

  private greenLightRecommendation(
    priority: GreenLightInsight["priority"],
    damagedSignalReports: number,
    accidents: number,
    status: string,
  ) {
    if (status === "offline" || damagedSignalReports >= 2)
      return "Priorizar inspeccion tecnica del semaforo y validar plan de contingencia en hora pico.";
    if (accidents >= 2)
      return "Revisar fases, tiempos de despeje peatonal y coordinacion con intersecciones adyacentes.";
    if (priority === "critical" || priority === "high")
      return "Evaluar sincronizacion del corredor y presencia operativa en los horarios de mayor reporte.";
    return "Mantener en observacion y consolidar mas evidencia antes de ajustar tiempos semaforicos.";
  }

  private greenLightReasons(input: {
    trafficLight: TrafficLight;
    nearbyReports: number;
    highRiskReports: number;
    accidents: number;
    damagedSignalReports: number;
    openReports: number;
    averageRisk: number;
    recencyBoost: number;
  }) {
    const reasons: string[] = [];
    if (input.trafficLight.status !== "active")
      reasons.push(`Estado del semaforo: ${input.trafficLight.status}.`);
    if (input.nearbyReports)
      reasons.push(`${input.nearbyReports} reportes cercanos en 90 dias.`);
    if (input.highRiskReports)
      reasons.push(`${input.highRiskReports} reportes de riesgo alto.`);
    if (input.accidents)
      reasons.push(`${input.accidents} accidentes asociados al entorno.`);
    if (input.damagedSignalReports)
      reasons.push(
        `${input.damagedSignalReports} reportes de semaforo danado.`,
      );
    if (input.openReports)
      reasons.push(`${input.openReports} casos aun abiertos.`);
    if (input.averageRisk)
      reasons.push(`Riesgo promedio ${input.averageRisk}/5.`);
    if (input.recencyBoost)
      reasons.push("Actividad reciente en los ultimos 14 dias.");
    return reasons.length ? reasons : ["Sin senales criticas recientes."];
  }

  private metersBetween(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) {
    const earthRadiusMeters = 6371000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const deltaLatitude = toRadians(b.latitude - a.latitude);
    const deltaLongitude = toRadians(b.longitude - a.longitude);
    const latitudeA = toRadians(a.latitude);
    const latitudeB = toRadians(b.latitude);
    const haversine =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(latitudeA) *
        Math.cos(latitudeB) *
        Math.sin(deltaLongitude / 2) ** 2;

    return (
      earthRadiusMeters *
      2 *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  }

  private resolveImportTargets(
    dto: ImportTrafficLightsDto,
    settings: TrafficLightsSettings,
  ): Array<{ province?: string; bounds: ProvinceBounds }> {
    const selectedProvinces = Array.from(
      new Set(
        [...(dto.provinces ?? []), ...(settings.importProvinces ?? [])]
          .map((province) => province.trim())
          .filter(Boolean),
      ),
    );
    if (selectedProvinces.length) {
      return selectedProvinces.map((province) => {
        const bounds = DOMINICAN_PROVINCE_BOUNDS[province];
        if (!bounds)
          throw new BadRequestException(
            `No hay limites configurados para la provincia ${province}.`,
          );
        return { province, bounds };
      });
    }

    const bounds = {
      south: dto.south ?? settings.defaultSouth,
      west: dto.west ?? settings.defaultWest,
      north: dto.north ?? settings.defaultNorth,
      east: dto.east ?? settings.defaultEast,
    };

    return [{ province: dto.province ?? settings.defaultProvince, bounds }];
  }

  private overpassElementToTrafficLight(
    element: NonNullable<OverpassResponse["elements"]>[number],
    dto: ImportTrafficLightsDto,
    settings: TrafficLightsSettings,
  ): Omit<TrafficLight, "id" | "createdAt" | "updatedAt"> | null {
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const tags = element.tags ?? {};
    const name =
      tags.name ||
      tags["traffic_signals:name"] ||
      tags.ref ||
      `Semaforo OSM ${element.id}`;
    const intersection =
      tags["addr:street"] || tags.crossing || tags.description || null;
    const municipality =
      this.extractMunicipality(tags) ??
      dto.municipality ??
      (dto.provinces?.length ? null : settings.defaultMunicipality);

    return {
      name,
      latitude,
      longitude,
      province: dto.province ?? settings.defaultProvince,
      municipality,
      intersection,
      osmId: `${element.type}/${element.id}`,
      status: "unknown",
      source: "osm",
      lastObservedAt: new Date(),
    } as Omit<TrafficLight, "id" | "createdAt" | "updatedAt">;
  }

  private extractMunicipality(tags: Record<string, string>): string | null {
    const municipality =
      tags["addr:municipality"] ||
      tags["is_in:municipality"] ||
      tags["addr:city"] ||
      tags["is_in:city"] ||
      tags["addr:town"] ||
      tags["addr:village"] ||
      "";

    return municipality.trim() || null;
  }

  private async enrichTrafficLightLocation(
    trafficLight: Omit<TrafficLight, "id" | "createdAt" | "updatedAt">,
  ): Promise<Omit<TrafficLight, "id" | "createdAt" | "updatedAt">> {
    const details = await this.reverseGeocodeCoordinates(
      Number(trafficLight.latitude),
      Number(trafficLight.longitude),
    );
    if (!details) return trafficLight;

    return {
      ...trafficLight,
      province: details.province || trafficLight.province,
      municipality: details.municipality || trafficLight.municipality,
      intersection: details.intersection || trafficLight.intersection,
      locationDetailsRefreshedAt: new Date(),
    };
  }

  private async reverseGeocodeCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeDetails | null> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const cached = this.reverseGeocodeCache.get(cacheKey);
    if (cached) return cached;

    try {
      const query = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
        zoom: "18",
        addressdetails: "1",
        namedetails: "0",
        "accept-language": "es",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
        {
          headers: {
            "User-Agent": "Korvi/0.1",
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) return null;

      const data = (await response.json()) as ReverseGeocodeResponse;
      const details = this.extractReverseGeocodeDetails(
        data,
        latitude,
        longitude,
      );
      this.reverseGeocodeCache.set(cacheKey, details);
      return details;
    } catch (error) {
      this.logger.warn(
        `No se pudo geocodificar semaforo ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private extractReverseGeocodeDetails(
    data: ReverseGeocodeResponse,
    latitude: number,
    longitude: number,
  ): ReverseGeocodeDetails {
    const address = data.address ?? {};
    const detectedProvince = this.cleanAdministrativeName(
      address.state || address.province || address.region,
    );
    const inferredMunicipality = this.inferMunicipalityFromCoordinates(
      latitude,
      longitude,
    );
    const municipality =
      inferredMunicipality ??
      this.cleanAdministrativeName(
        address.municipality ||
          address.city ||
          address.town ||
          address.village ||
          address.county,
      );
    const province = inferredMunicipality
      ? inferredMunicipality === "Santo Domingo de Guzman"
        ? "Distrito Nacional"
        : "Santo Domingo"
      : detectedProvince;
    const road =
      address.road || address.pedestrian || address.footway || address.cycleway;
    const place = address.neighbourhood || address.suburb || address.quarter;

    return {
      province,
      municipality,
      intersection: this.cleanIntersection(
        [road, place].filter(Boolean).join(", ") || data.display_name,
      ),
    };
  }

  private inferMunicipalityFromCoordinates(
    latitude: number,
    longitude: number,
  ): string | null {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (
      latitude >= 18.4 &&
      latitude <= 18.52 &&
      longitude >= -69.99 &&
      longitude <= -69.86
    )
      return "Santo Domingo de Guzman";
    if (
      latitude >= 18.42 &&
      latitude <= 18.6 &&
      longitude >= -69.92 &&
      longitude <= -69.72
    )
      return "Santo Domingo Este";
    if (
      latitude >= 18.48 &&
      latitude <= 18.66 &&
      longitude >= -70.05 &&
      longitude < -69.88
    )
      return "Santo Domingo Norte";
    if (
      latitude >= 18.38 &&
      latitude <= 18.56 &&
      longitude >= -70.1 &&
      longitude < -69.98
    )
      return "Santo Domingo Oeste";
    if (
      latitude >= 18.37 &&
      latitude <= 18.56 &&
      longitude >= -70.15 &&
      longitude < -70.03
    )
      return "Los Alcarrizos";
    if (
      latitude >= 18.35 &&
      latitude <= 18.5 &&
      longitude >= -69.72 &&
      longitude <= -69.55
    )
      return "Boca Chica";
    if (
      latitude >= 18.45 &&
      latitude <= 18.68 &&
      longitude >= -69.78 &&
      longitude <= -69.55
    )
      return "San Antonio de Guerra";
    return null;
  }

  private cleanAdministrativeName(value: string | undefined): string | null {
    const clean = (value ?? "")
      .replace(/^Provincia\s+/i, "")
      .replace(/^Municipio\s+/i, "")
      .trim();

    return clean || null;
  }

  private cleanIntersection(value: string | undefined): string | null {
    const clean = (value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(
        (part) =>
          part &&
          !["Republica Dominicana", "República Dominicana"].includes(part),
      )
      .slice(0, 3)
      .join(", ");

    return clean || null;
  }

  private async fetchOverpass(
    query: string,
    configuredEndpoint: string,
  ): Promise<OverpassResponse> {
    const endpoints = Array.from(
      new Set(
        [
          configuredEndpoint,
          "https://overpass.kumi.systems/api/interpreter",
          "https://overpass-api.de/api/interpreter",
        ].filter(Boolean),
      ),
    );
    const errors: string[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Korvi/0.1",
          },
          body: new URLSearchParams({ data: query }).toString(),
        });

        if (response.ok) return (await response.json()) as OverpassResponse;

        const body = await response.text();
        errors.push(
          `${endpoint} HTTP ${response.status}${body ? `: ${body.slice(0, 180).replace(/\s+/g, " ")}` : ""}`,
        );
      } catch (error) {
        errors.push(
          `${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw new BadRequestException(
      `No se pudo consultar Overpass. ${errors.join(" | ")}`,
    );
  }

  private validateBounds(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }) {
    if (bounds.south >= bounds.north || bounds.west >= bounds.east) {
      throw new BadRequestException("La caja geografica no es valida.");
    }

    const span =
      Math.abs(bounds.north - bounds.south) *
      Math.abs(bounds.east - bounds.west);
    if (span > 2) {
      throw new BadRequestException(
        "La caja geografica es demasiado grande para importar semaforos.",
      );
    }
  }
}
