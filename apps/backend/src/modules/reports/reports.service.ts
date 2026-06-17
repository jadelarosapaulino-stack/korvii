import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { Express } from "express";
import { Repository } from "typeorm";
import { ReportCategory } from "../../common/enums/report-category.enum";
import { ReportStatus } from "../../common/enums/report-status.enum";
import { UserRole } from "../../common/enums/user-role.enum";
import { AiService } from "../ai/ai.service";
import { RealtimeEventPublisherService } from "../realtime-events/realtime-event-publisher.service";
import { ExternalApiLoggerService } from "../system-config/external-api-logger.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { User } from "../users/user.entity";
import { Institution } from "../institutions/institution.entity";
import { AccuWeatherService } from "./accuweather.service";
import { ActivateWeatherFloodZonesDto } from "./dto/activate-weather-flood-zones.dto";
import { AssignReportDto } from "./dto/assign-report.dto";
import { CreateEmergencyCallLogDto } from "./dto/create-emergency-call-log.dto";
import { CreateReportDto } from "./dto/create-report.dto";
import {
  GoogleMapsTileSessionDto,
  HighFlowTrafficDto,
  OptimizeRiskRouteDto,
} from "./dto/optimize-risk-route.dto";
import { QueryReportsDto } from "./dto/query-reports.dto";
import { RoadTelemetryDto } from "./dto/road-telemetry.dto";
import { UpdateReportStatusDto } from "./dto/update-report-status.dto";
import { WeatherStatusDto } from "./dto/weather-status.dto";
import { EmergencyCallLog } from "./entities/emergency-call-log.entity";
import { ReportConfirmation } from "./entities/report-confirmation.entity";
import { ReportPhoto } from "./entities/report-photo.entity";
import { Report } from "./entities/report.entity";
import { RoadTelemetryEvent } from "./entities/road-telemetry-event.entity";
import { StatusHistory } from "./entities/status-history.entity";
import {
  WeatherAutomationConfig,
  WeatherSettingsService,
} from "./weather-settings.service";

const defaultReportPhotoPrefix = "/uploads/default-reports/";
const defaultReportPhotoByCategory: Record<ReportCategory, string> = {
  [ReportCategory.ACCIDENT]: `${defaultReportPhotoPrefix}accident.png`,
  [ReportCategory.TRAFFIC_LIGHT_DAMAGED]: `${defaultReportPhotoPrefix}traffic-light-damaged.png`,
  [ReportCategory.ROAD_DAMAGE]: `${defaultReportPhotoPrefix}road-damage.png`,
  [ReportCategory.ROAD_OBSTRUCTION]: `${defaultReportPhotoPrefix}road-obstruction.png`,
  [ReportCategory.POOR_LIGHTING]: `${defaultReportPhotoPrefix}poor-lighting.png`,
  [ReportCategory.MISSING_SIGNAGE]: `${defaultReportPhotoPrefix}missing-signage.png`,
  [ReportCategory.RECKLESS_DRIVING]: `${defaultReportPhotoPrefix}reckless-driving.png`,
  [ReportCategory.DANGEROUS_CROSSING]: `${defaultReportPhotoPrefix}dangerous-crossing.png`,
  [ReportCategory.FLOOD_ZONE]: `${defaultReportPhotoPrefix}flood-zone.png`,
  [ReportCategory.POLICE_ON_ROAD]: `${defaultReportPhotoPrefix}other.png`,
  [ReportCategory.OTHER]: `${defaultReportPhotoPrefix}other.png`,
};

interface RouteCandidate {
  provider: "google-routes" | "openrouteservice" | "osrm";
  coordinates: Array<[number, number]>;
  distance: number;
  duration: number;
  traffic?: {
    congestedSegments: number;
    slowSegments: number;
    jamSegments: number;
    segments: Array<{
      speed: "NORMAL" | "SLOW" | "TRAFFIC_JAM" | string;
      coordinates: Array<[number, number]>;
    }>;
  };
  via?: { latitude: number; longitude: number };
  risk: {
    floodZones: number;
    highRiskReports: number;
    total: number;
    unsafe: boolean;
  };
}

interface OrsGeoJsonResponse {
  features?: Array<{
    geometry?: { coordinates?: Array<[number, number]> };
    properties?: { summary?: { distance?: number; duration?: number } };
  }>;
}

interface OsrmRouteResponse {
  routes?: Array<{
    geometry?: { coordinates?: Array<[number, number]> };
    distance?: number;
    duration?: number;
  }>;
}

interface GoogleRoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    staticDuration?: string;
    polyline?: {
      geoJsonLinestring?: {
        coordinates?: Array<[number, number]>;
      };
    };
    travelAdvisory?: {
      speedReadingIntervals?: Array<{
        startPolylinePointIndex?: number;
        endPolylinePointIndex?: number;
        speed?: "NORMAL" | "SLOW" | "TRAFFIC_JAM" | string;
      }>;
    };
  }>;
}

interface GoogleMapsTileSessionResponse {
  session?: string;
  expiry?: string;
  tileWidth?: number;
  tileHeight?: number;
  imageFormat?: string;
}

export interface GoogleMapsTileResponse {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

export interface HighFlowTrafficSegment {
  speed: "SLOW" | "TRAFFIC_JAM" | string;
  coordinates: Array<[number, number]>;
}

type RoutingProvider = "google-routes" | "openrouteservice" | "osrm";

interface FloodMonitorPoint {
  country: string;
  name: string;
  latitude: number;
  longitude: number;
  province?: string;
  municipality?: string;
}

@Injectable()
export class ReportsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReportsService.name);
  private readonly duplicateReportRadiusMeters = 500;
  private floodMonitorTimer?: NodeJS.Timeout;
  private floodMonitorRunning = false;

  private readonly dominicanRepublicBounds = {
    minLatitude: 17.4,
    maxLatitude: 20.1,
    minLongitude: -72.2,
    maxLongitude: -68,
  };

  constructor(
    @InjectRepository(Report) private readonly reportsRepo: Repository<Report>,
    @InjectRepository(ReportPhoto)
    private readonly photosRepo: Repository<ReportPhoto>,
    @InjectRepository(ReportConfirmation)
    private readonly confirmationsRepo: Repository<ReportConfirmation>,
    @InjectRepository(RoadTelemetryEvent)
    private readonly roadTelemetryRepo: Repository<RoadTelemetryEvent>,
    @InjectRepository(StatusHistory)
    private readonly historyRepo: Repository<StatusHistory>,
    @InjectRepository(EmergencyCallLog)
    private readonly emergencyCallLogsRepo: Repository<EmergencyCallLog>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Institution)
    private readonly institutionsRepo: Repository<Institution>,
    private readonly accuWeatherService: AccuWeatherService,
    private readonly weatherSettings: WeatherSettingsService,
    private readonly systemConfig: SystemConfigService,
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly realtimeEvents: RealtimeEventPublisherService,
    private readonly externalApiLogger: ExternalApiLoggerService,
  ) {}

  onApplicationBootstrap() {
    this.configureFloodMonitorTimer(true);
  }

  onModuleDestroy() {
    if (this.floodMonitorTimer) clearInterval(this.floodMonitorTimer);
  }

  async create(dto: CreateReportDto, userId: string) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const roadDamageAnalysis = this.detectRoadDamage(dto);
    const reportDto = roadDamageAnalysis.detected
      ? {
          ...dto,
          category: roadDamageAnalysis.category ?? ReportCategory.ROAD_DAMAGE,
          riskLevel: Math.max(dto.riskLevel ?? 1, roadDamageAnalysis.riskLevel),
        }
      : dto;
    const existing = await this.findDuplicateCandidate(reportDto);

    if (existing) {
      const confirmationResult = await this.confirmExistingReport(
        existing,
        reportDto,
        user,
      );
      return {
        report: this.serializeReport(confirmationResult.report),
        reused: true,
        confirmationAdded: confirmationResult.added,
      };
    }

    const assignedInstitution = dto.assignedInstitutionId
      ? await this.institutionsRepo.findOne({
          where: { id: dto.assignedInstitutionId, isActive: true },
        })
      : null;
    const creationComment = [
      roadDamageAnalysis.detected
        ? `Clasificacion automatica: posible via en mal estado. ${roadDamageAnalysis.reason}`
        : "",
      assignedInstitution
        ? `Reporte creado por ciudadano y mencionado a ${assignedInstitution.name}.`
        : "Reporte creado por ciudadano.",
    ]
      .filter(Boolean)
      .join(" ");
    const photoUrls = this.reportPhotoUrlsOrDefault(reportDto);

    const report = this.reportsRepo.create({
      title: reportDto.title,
      category: reportDto.category,
      description: reportDto.description,
      latitude: reportDto.latitude,
      longitude: reportDto.longitude,
      province: reportDto.province,
      municipality: reportDto.municipality,
      address: reportDto.address,
      riskLevel: reportDto.riskLevel ?? 3,
      confirmationCount: 1,
      source: reportDto.source ?? "web",
      createdBy: user,
      assignedInstitution,
      assignmentNote: assignedInstitution
        ? `Autoridad mencionada al crear el reporte: ${assignedInstitution.name}.`
        : null,
      photos: photoUrls.map((url) => this.photosRepo.create({ url })),
      history: [
        this.historyRepo.create({
          toStatus: ReportStatus.PENDING,
          comment: creationComment,
          changedBy: user,
        }),
      ],
    });

    const saved = await this.reportsRepo.save(report);
    void this.publishReportRealtimeEvent("report.created", saved);
    this.scheduleAiAnalysis(saved.id);
    return {
      report: this.serializeReport(saved),
      reused: false,
      confirmationAdded: false,
    };
  }

  async suggestReportFromImage(image: Express.Multer.File) {
    const suggestion = await this.aiService.suggestReportFromImage(image);
    if (!suggestion) {
      throw new ServiceUnavailableException(
        "La clasificacion por imagen con IA no esta disponible.",
      );
    }
    return suggestion;
  }

  async findAll(query: QueryReportsDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const baseQb = this.reportsRepo
      .createQueryBuilder("report")
      .orderBy("report.createdAt", "DESC");

    this.applyReportListFilters(baseQb, query);

    const total = await baseQb.getCount();
    const idRows = await baseQb
      .clone()
      .select("report.id", "id")
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany<{ id: string }>();
    const ids = idRows.map((row) => row.id);

    if (!ids.length) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const data = await this.reportsRepo
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.createdBy", "createdBy")
      .leftJoinAndSelect("report.assignedTo", "assignedTo")
      .leftJoinAndSelect("report.assignedInstitution", "assignedInstitution")
      .leftJoinAndSelect("report.photos", "photos")
      .leftJoinAndSelect("report.confirmations", "confirmations")
      .leftJoinAndSelect("confirmations.user", "confirmationUser")
      .leftJoinAndSelect("report.history", "history")
      .leftJoinAndSelect("history.changedBy", "historyChangedBy")
      .where("report.id IN (:...ids)", { ids })
      .orderBy("report.createdAt", "DESC")
      .addOrderBy("history.createdAt", "DESC")
      .getMany();

    const byId = new Map(data.map((report) => [report.id, report]));
    const orderedData = ids
      .map((id) => byId.get(id))
      .filter((report): report is Report => Boolean(report));

    return {
      data: orderedData.map((report) => this.serializeReport(report)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminMetrics(query: QueryReportsDto) {
    const qb = this.reportsRepo.createQueryBuilder("report");
    this.applyReportListFilters(qb, query);

    const [total, highRisk, statusRows] = await Promise.all([
      qb.clone().getCount(),
      qb.clone().andWhere("report.riskLevel >= :highRisk", { highRisk: 4 }).getCount(),
      qb
        .clone()
        .select("report.status", "status")
        .addSelect("COUNT(report.id)", "count")
        .groupBy("report.status")
        .getRawMany<{ status: ReportStatus; count: string }>(),
    ]);

    const byStatus = {
      [ReportStatus.PENDING]: 0,
      [ReportStatus.VALIDATED]: 0,
      [ReportStatus.IN_PROGRESS]: 0,
      [ReportStatus.RESOLVED]: 0,
      [ReportStatus.REJECTED]: 0,
      [ReportStatus.DUPLICATE]: 0,
    };

    statusRows.forEach((row) => {
      byStatus[row.status] = Number(row.count);
    });

    return {
      total,
      highRisk,
      pending: byStatus[ReportStatus.PENDING],
      validated: byStatus[ReportStatus.VALIDATED],
      inProgress: byStatus[ReportStatus.IN_PROGRESS],
      resolved: byStatus[ReportStatus.RESOLVED],
      rejected: byStatus[ReportStatus.REJECTED],
      duplicate: byStatus[ReportStatus.DUPLICATE],
      stages: [
        {
          status: ReportStatus.PENDING,
          label: "Pendientes",
          count: byStatus[ReportStatus.PENDING],
        },
        {
          status: ReportStatus.VALIDATED,
          label: "Validados",
          count: byStatus[ReportStatus.VALIDATED],
        },
        {
          status: ReportStatus.IN_PROGRESS,
          label: "Intervencion",
          count: byStatus[ReportStatus.IN_PROGRESS],
        },
        {
          status: ReportStatus.RESOLVED,
          label: "Resueltos",
          count: byStatus[ReportStatus.RESOLVED],
        },
      ],
    };
  }

  async logEmergencyCall(dto: CreateEmergencyCallLogDto, userId: string) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const log = this.emergencyCallLogsRepo.create({
      user,
      category: dto.category,
      title: dto.title,
      latitude: dto.latitude,
      longitude: dto.longitude,
      province: dto.province,
      municipality: dto.municipality,
      address: dto.address,
      phoneNumber: dto.phoneNumber || "911",
      source: dto.source,
    });

    return this.emergencyCallLogsRepo.save(log);
  }

  async activateWeatherFloodZones(dto: ActivateWeatherFloodZonesDto) {
    const weather = await this.accuWeatherService.evaluateFloodRisk(
      dto.latitude,
      dto.longitude,
    );
    if (!weather.enabled) return { activated: false, weather };
    if (!weather.shouldActivateFloodZone) return { activated: false, weather };

    const existing = await this.findRecentFloodZone(
      dto.latitude,
      dto.longitude,
    );
    if (existing)
      return { activated: true, report: existing, weather, reused: true };

    const systemUser = await this.findWeatherSystemUser();
    const locationName = dto.locationName || weather.locationName;
    const report = this.reportsRepo.create({
      title: `Zona de posible inundacion${locationName ? ` - ${locationName}` : ""}`,
      category: ReportCategory.FLOOD_ZONE,
      description: `Activacion automatica por estado del tiempo. ${weather.reason}`,
      latitude: dto.latitude,
      longitude: dto.longitude,
      province: dto.province ?? weather.province,
      municipality: dto.municipality ?? locationName,
      address: locationName
        ? `Referencia meteorologica: ${locationName}`
        : "Referencia meteorologica automatica",
      riskLevel: weather.riskLevel,
      source: "system",
      createdBy: systemUser,
      history: [
        this.historyRepo.create({
          toStatus: ReportStatus.PENDING,
          comment: `Zona activada automaticamente por Open-Meteo${locationName ? ` en ${locationName}` : ""}. ${weather.reason}`,
          changedBy: systemUser,
        }),
      ],
    });

    const saved = await this.reportsRepo.save(report);
    void this.publishReportRealtimeEvent("weather.flood_zone_created", saved, {
      rooms: ["reports:map", "reports:admin", "weather:alerts"],
    });
    this.scheduleAiAnalysis(saved.id);
    return { activated: true, report: saved, weather, reused: false };
  }

  async monitorFloodZones(
    source: "manual" | "scheduled" | "startup" = "manual",
  ) {
    if (this.floodMonitorRunning) {
      return {
        source,
        skipped: true,
        reason: "Monitoreo en curso.",
        total: 0,
        activated: 0,
        reused: 0,
        inactive: 0,
        failed: 0,
        results: [],
      };
    }

    this.floodMonitorRunning = true;
    const points = this.floodMonitorPoints();
    const results: Array<{
      name: string;
      latitude: number;
      longitude: number;
      activated: boolean;
      reused?: boolean;
      reason?: string;
      error?: string;
    }> = [];

    try {
      for (const point of points) {
        try {
          const result = await this.activateWeatherFloodZones({
            latitude: point.latitude,
            longitude: point.longitude,
            locationName: point.name,
            province: point.province,
            municipality: point.municipality,
          });
          results.push({
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            activated: Boolean(result.activated),
            reused: Boolean("reused" in result ? result.reused : false),
            reason: result.weather?.reason,
          });
        } catch (error) {
          results.push({
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            activated: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const summary = {
        source,
        skipped: false,
        total: results.length,
        activated: results.filter((item) => item.activated).length,
        reused: results.filter((item) => item.reused).length,
        inactive: results.filter((item) => !item.activated && !item.error)
          .length,
        failed: results.filter((item) => item.error).length,
        results,
      };

      if (source !== "manual") {
        this.logger.log(
          `Monitoreo de inundaciones: ${summary.activated}/${summary.total} puntos activados, ${summary.failed} fallidos.`,
        );
      }

      return summary;
    } finally {
      this.floodMonitorRunning = false;
    }
  }

  weatherStatus(dto: WeatherStatusDto) {
    return this.accuWeatherService.currentStatus(dto.latitude, dto.longitude);
  }

  weatherConfig() {
    return this.weatherSettings.get();
  }

  async updateWeatherConfig(patch: Partial<WeatherAutomationConfig>) {
    const previousInterval = this.weatherSettings.get().monitorIntervalMinutes;
    const previousEnabled = this.weatherSettings.get().floodMonitorEnabled;
    const next = await this.weatherSettings.update(patch);

    if (
      next.floodMonitorEnabled !== previousEnabled ||
      next.monitorIntervalMinutes !== previousInterval
    ) {
      this.configureFloodMonitorTimer(false);
    }

    return next;
  }

  async recordRoadTelemetry(dto: RoadTelemetryDto, userId: string) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const severity = this.roadTelemetrySeverity(dto);
    if (severity.riskLevel < 3) {
      return {
        accepted: false,
        reason: severity.reason,
      };
    }

    await this.roadTelemetryRepo.save(
      this.roadTelemetryRepo.create({
        eventType: dto.eventType,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accelerationMagnitude: dto.accelerationMagnitude ?? null,
        speedBeforeKmh: dto.speedBeforeKmh ?? null,
        speedAfterKmh: dto.speedAfterKmh ?? null,
        accuracyMeters: dto.accuracyMeters ?? null,
        riskLevel: severity.riskLevel,
        source: dto.source ?? "mobile-road-telemetry",
        user,
      }),
    );

    const reportDto: CreateReportDto = {
      title:
        dto.eventType === "impact"
          ? "Posible bache o desnivel detectado"
          : dto.eventType === "high_flow"
            ? "Zona de alto flujo vehicular marcada"
            : "Patron de frenadas bruscas detectado",
      category:
        dto.eventType === "high_flow"
          ? ReportCategory.ROAD_OBSTRUCTION
          : ReportCategory.ROAD_DAMAGE,
      description: `Deteccion automatica desde app movil. ${severity.reason}`,
      latitude: dto.latitude,
      longitude: dto.longitude,
      riskLevel: severity.riskLevel,
      source: "mobile",
    };
    const existing = await this.findDuplicateCandidate(
      reportDto,
      dto.eventType === "high_flow" ? 240 : 180,
    );

    if (existing) {
      const confirmation = await this.confirmExistingReport(
        existing,
        reportDto,
        user,
      );
      return {
        accepted: true,
        reused: true,
        confirmationAdded: confirmation.added,
        report: this.serializeReport(confirmation.report),
      };
    }

    if (dto.eventType === "speed_drop") {
      const cluster = await this.recentRoadTelemetryCluster(
        dto,
        "speed_drop",
        180,
        60,
      );
      if (cluster.length < 3) {
        return {
          accepted: true,
          reused: false,
          confirmationAdded: false,
          pendingSignal: true,
          signalCount: cluster.length,
          reason: `Frenada registrada como senal. Se requieren 3 senales cercanas para crear un reporte automatico.`,
        };
      }

      reportDto.description = `Deteccion automatica desde app movil. ${cluster.length} frenadas bruscas cercanas en los ultimos 60 minutos. ${severity.reason}`;
      reportDto.riskLevel = Math.max(
        severity.riskLevel,
        cluster.length >= 5 ? 5 : 4,
      );
    }

    const report = this.reportsRepo.create({
      title: reportDto.title,
      category: reportDto.category,
      description: reportDto.description,
      latitude: reportDto.latitude,
      longitude: reportDto.longitude,
      riskLevel: reportDto.riskLevel,
      confirmationCount: 1,
      source: "mobile",
      createdBy: user,
      history: [
        this.historyRepo.create({
          toStatus: ReportStatus.PENDING,
          comment: `Reporte automatico por telemetria movil. ${severity.reason}`,
          changedBy: user,
        }),
      ],
    });

    const saved = await this.reportsRepo.save(report);
    this.scheduleAiAnalysis(saved.id);
    return {
      accepted: true,
      reused: false,
      confirmationAdded: false,
      report: this.serializeReport(saved),
    };
  }

  async findMapPoints(query: QueryReportsDto) {
    const bounds = this.dominicanRepublicBounds;
    const automaticFloodZoneVisibleSince = new Date(
      Date.now() -
        this.weatherSettings.get().automaticFloodReportTtlHours *
          60 *
          60 *
          1000,
    );
    const qb = this.reportsRepo
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.createdBy", "createdBy")
      .leftJoinAndSelect("report.assignedTo", "assignedTo")
      .leftJoinAndSelect("report.assignedInstitution", "assignedInstitution")
      .leftJoinAndSelect("report.photos", "photos")
      .leftJoinAndSelect("report.confirmations", "confirmations")
      .leftJoinAndSelect("confirmations.user", "confirmationUser")
      .where("report.latitude BETWEEN :minLatitude AND :maxLatitude", bounds)
      .andWhere(
        "report.longitude BETWEEN :minLongitude AND :maxLongitude",
        bounds,
      )
      .andWhere("report.status NOT IN (:...closedMapStatuses)", {
        closedMapStatuses: [
          ReportStatus.RESOLVED,
          ReportStatus.REJECTED,
          ReportStatus.DUPLICATE,
        ],
      })
      .andWhere(
        "(report.category != :floodZoneCategory OR report.source != :systemSource OR report.createdAt >= :automaticFloodZoneVisibleSince)",
        {
          floodZoneCategory: ReportCategory.FLOOD_ZONE,
          systemSource: "system",
          automaticFloodZoneVisibleSince,
        },
      )
      .orderBy("report.createdAt", "DESC")
      .take(query.limit ?? 100);

    if (query.status)
      qb.andWhere("report.status = :status", { status: query.status });
    if (query.category)
      qb.andWhere("report.category = :category", { category: query.category });
    if (query.province)
      qb.andWhere("LOWER(report.province) LIKE LOWER(:province)", {
        province: `%${query.province}%`,
      });
    if (query.municipality)
      qb.andWhere("LOWER(report.municipality) LIKE LOWER(:municipality)", {
        municipality: `%${query.municipality}%`,
      });
    this.applyReportOperationalFilters(qb, query);
    this.applyReportDateFilters(qb, query);

    const reports = await qb.getMany();
    return reports
      .map((report) => this.serializeReport(report))
      .filter(
        (report) =>
          Number.isFinite(report.latitude) && Number.isFinite(report.longitude),
      );
  }

  async optimizeRiskRoute(dto: OptimizeRiskRouteDto) {
    this.validateRoutePoint(dto.origin, "origen");
    this.validateRoutePoint(dto.destination, "destino");

    const blockingReports = await this.routeBlockingReports();
    const directRoute = await this.fetchRoute(
      [dto.origin, dto.destination],
      dto,
    );
    if (!directRoute)
      throw new ServiceUnavailableException(
        "No se pudo calcular una ruta para ese trayecto.",
      );

    const direct = this.withRouteRisk(directRoute, blockingReports);
    const maxReasonableDistance = Math.min(
      direct.distance * 1.35,
      direct.distance + 1200,
    );
    const detourWaypoints = this.blockingReportsNearRoute(
      blockingReports,
      direct.coordinates,
    )
      .slice(0, 4)
      .flatMap((report) => this.detourWaypointsAround(report))
      .slice(0, 20);

    const detourResults = await Promise.allSettled(
      detourWaypoints.map(async (waypoint) => {
        const route = await this.fetchRoute(
          [dto.origin, waypoint, dto.destination],
          dto,
        );
        if (!route) throw new Error("Sin ruta alternativa");
        return this.withRouteRisk({ ...route, via: waypoint }, blockingReports);
      }),
    );
    const detours = detourResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const candidates = [direct, ...detours]
      .filter((route) => route.distance <= maxReasonableDistance)
      .sort(
        (a, b) =>
          a.risk.total - b.risk.total ||
          a.distance - b.distance ||
          a.duration - b.duration,
      );
    const best = candidates[0] ?? direct;

    return {
      provider: best.provider,
      summary: {
        distance: best.distance,
        duration: best.duration,
        distanceKm: Number((best.distance / 1000).toFixed(1)),
        durationMinutes: Math.round(best.duration / 60),
      },
      geometry: {
        type: "LineString",
        coordinates: best.coordinates,
      },
      risk: best.risk,
      traffic: best.traffic ?? {
        congestedSegments: 0,
        slowSegments: 0,
        jamSegments: 0,
        segments: [],
      },
      alternativesEvaluated: candidates.length,
      via: best.via ?? null,
    };
  }

  async highFlowTraffic(dto: HighFlowTrafficDto) {
    const bounds = this.normalizedTrafficBounds(dto.bounds);
    const apiKey = (
      dto.googleMapsApiKey ||
      this.systemConfig.getSecretApiKey("googleMaps") ||
      this.config.get<string>("GOOGLE_MAPS_API_KEY") ||
      ""
    ).trim();
    this.assertGoogleMapsApiKey(apiKey);

    const sampleRoutes = this.highFlowSampleRoutes(bounds);
    const results = await Promise.allSettled(
      sampleRoutes.map((points) => this.fetchGoogleRoutesRoute(points, apiKey)),
    );
    const segments = results.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      const route = result.value;
      return route?.traffic?.segments.filter(
        (segment) =>
          segment.coordinates.length >= 2 && segment.speed !== "NORMAL",
      ) ?? [];
    });

    const dedupedSegments = this.dedupeTrafficSegments(segments);
    const slowSegments = dedupedSegments.filter(
      (segment) => segment.speed === "SLOW",
    ).length;
    const jamSegments = dedupedSegments.filter(
      (segment) => segment.speed === "TRAFFIC_JAM",
    ).length;

    return {
      provider: "google-routes",
      bounds,
      congestedSegments: dedupedSegments.length,
      slowSegments,
      jamSegments,
      segments: dedupedSegments,
    };
  }

  async createGoogleMapsTileSession(dto: GoogleMapsTileSessionDto) {
    const apiKey = (
      dto.apiKey ||
      this.systemConfig.getSecretApiKey("googleMaps") ||
      this.config.get<string>("GOOGLE_MAPS_API_KEY") ||
      ""
    ).trim();
    this.assertGoogleMapsApiKey(apiKey);

    const mapType = dto.mapType === "satellite" ? "satellite" : "roadmap";
    const response = await this.fetchExternal(
      `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapType,
          language: "es",
          region: "DO",
          ...(mapType === "satellite"
            ? { layerTypes: ["layerRoadmap"], overlay: false }
            : {}),
        }),
      },
      {
        provider: "Google",
        service: "Map Tiles API",
        operation: `create tile session (${mapType})`,
      },
    );

    if (!response.ok) {
      const detail = await this.externalApiLogger.safeResponseText(
        response.clone(),
      );
      await this.recordExternalHttpFailure(response, {
        provider: "Google",
        service: "Map Tiles API",
        operation: `create tile session (${mapType})`,
      });
      this.logger.warn(
        `Google Map Tiles createSession fallo: ${response.status} ${(detail ?? "").slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        "No se pudo crear una sesion de Google Map Tiles. Verifica API key, billing, permisos y Map Tiles API.",
      );
    }

    const payload = (await response.json()) as GoogleMapsTileSessionResponse;
    if (!payload.session)
      throw new ServiceUnavailableException(
        "Google Map Tiles no devolvio session token.",
      );

    return payload;
  }

  async fetchGoogleMapsTile(
    session: string,
    z: number,
    x: number,
    y: number,
  ): Promise<GoogleMapsTileResponse> {
    const apiKey = (
      this.systemConfig.getSecretApiKey("googleMaps") ||
      this.config.get<string>("GOOGLE_MAPS_API_KEY") ||
      ""
    ).trim();
    this.assertGoogleMapsApiKey(apiKey);

    const safeSession = String(session || "").trim();
    if (!safeSession) {
      throw new BadRequestException("Session token de Google Maps requerido.");
    }
    if (![z, x, y].every((value) => Number.isInteger(value) && value >= 0)) {
      throw new BadRequestException("Coordenadas de tile invalidas.");
    }

    const response = await this.fetchExternal(
      `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(safeSession)}&key=${encodeURIComponent(apiKey)}`,
      undefined,
      {
        provider: "Google",
        service: "Map Tiles API",
        operation: `fetch tile ${z}/${x}/${y}`,
      },
    );

    if (!response.ok) {
      const detail = await this.externalApiLogger.safeResponseText(
        response.clone(),
      );
      await this.recordExternalHttpFailure(response, {
        provider: "Google",
        service: "Map Tiles API",
        operation: `fetch tile ${z}/${x}/${y}`,
      });
      this.logger.warn(
        `Google Map Tiles tile fallo: ${response.status} ${(detail ?? "").slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        "No se pudo cargar una tesela de Google Maps.",
      );
    }

    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "image/png",
      cacheControl:
        response.headers.get("cache-control") ||
        "public, max-age=86400, stale-while-revalidate=86400",
    };
  }

  async fetchMapTilerTile(
    z: number,
    x: number,
    y: number,
    style?: string,
  ): Promise<GoogleMapsTileResponse> {
    const apiKey = (
      this.systemConfig.getSecretApiKey("maptiler") ||
      this.config.get<string>("MAPTILER_API_KEY") ||
      ""
    ).trim();
    if (!apiKey) {
      throw new BadRequestException("API key de MapTiler requerida.");
    }
    if (![z, x, y].every((value) => Number.isInteger(value) && value >= 0)) {
      throw new BadRequestException("Coordenadas de tile invalidas.");
    }

    const safeStyle = this.safeMapTilerStyle(style);
    const response = await this.fetchExternal(
      `https://api.maptiler.com/maps/${safeStyle}/{z}/{x}/{y}.png`
        .replace("{z}", String(z))
        .replace("{x}", String(x))
        .replace("{y}", String(y)) + `?key=${encodeURIComponent(apiKey)}`,
      undefined,
      {
        provider: "MapTiler",
        service: "Raster Tiles API",
        operation: `fetch tile ${safeStyle}/${z}/${x}/${y}`,
      },
    );

    if (!response.ok) {
      const detail = await this.externalApiLogger.safeResponseText(
        response.clone(),
      );
      await this.recordExternalHttpFailure(response, {
        provider: "MapTiler",
        service: "Raster Tiles API",
        operation: `fetch tile ${safeStyle}/${z}/${x}/${y}`,
      });
      this.logger.warn(
        `MapTiler tile fallo: ${response.status} ${(detail ?? "").slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        "No se pudo cargar una tesela de MapTiler.",
      );
    }

    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "image/png",
      cacheControl:
        response.headers.get("cache-control") ||
        "public, max-age=86400, stale-while-revalidate=86400",
    };
  }

  private safeMapTilerStyle(style?: string): string {
    const value = String(style || "streets-v2").trim();
    return /^[a-z0-9-]+$/i.test(value) ? value : "streets-v2";
  }

  private async fetchExternal(
    url: string,
    init: RequestInit | undefined,
    context: {
      provider: string;
      service: string;
      operation: string;
    },
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      await this.externalApiLogger.recordException({
        ...context,
        error,
        message: `${context.provider} no disponible`,
      });
      throw error;
    }
  }

  private async recordExternalHttpFailure(
    response: Response,
    context: {
      provider: string;
      service: string;
      operation: string;
    },
  ) {
    await this.externalApiLogger.recordHttpFailure({
      ...context,
      response: response.clone(),
    });
  }

  private applyReportDateFilters(
    qb: ReturnType<Repository<Report>["createQueryBuilder"]>,
    query: QueryReportsDto,
  ) {
    if (query.from)
      qb.andWhere("report.createdAt >= :from", { from: new Date(query.from) });
    if (query.to)
      qb.andWhere("report.createdAt <= :to", { to: new Date(query.to) });
  }

  private applyReportListFilters(
    qb: ReturnType<Repository<Report>["createQueryBuilder"]>,
    query: QueryReportsDto,
  ) {
    if (query.status)
      qb.andWhere("report.status = :status", { status: query.status });
    if (query.category)
      qb.andWhere("report.category = :category", {
        category: query.category,
      });
    if (query.province)
      qb.andWhere("LOWER(report.province) LIKE LOWER(:province)", {
        province: `%${query.province}%`,
      });
    if (query.municipality)
      qb.andWhere("LOWER(report.municipality) LIKE LOWER(:municipality)", {
        municipality: `%${query.municipality}%`,
      });
    this.applyReportOperationalFilters(qb, query);
    this.applyReportDateFilters(qb, query);
  }

  private applyReportOperationalFilters(
    qb: ReturnType<Repository<Report>["createQueryBuilder"]>,
    query: QueryReportsDto,
  ) {
    if (query.source)
      qb.andWhere("report.source = :source", { source: query.source });
    if (query.minRisk)
      qb.andWhere("report.riskLevel >= :minRisk", { minRisk: query.minRisk });
    if (query.q?.trim()) {
      const search = `%${query.q.trim()}%`;
      qb.andWhere(
        "(LOWER(report.title) LIKE LOWER(:search) OR LOWER(report.description) LIKE LOWER(:search) OR LOWER(report.address) LIKE LOWER(:search))",
        { search },
      );
    }
  }

  private validateRoutePoint(
    point: { latitude: number; longitude: number } | undefined,
    label: string,
  ) {
    if (!point || !this.isInsideDominicanRepublicBounds(point)) {
      throw new BadRequestException(
        `El punto de ${label} no esta dentro de Republica Dominicana o no es valido.`,
      );
    }
  }

  private normalizedTrafficBounds(bounds: HighFlowTrafficDto["bounds"]) {
    const minLatitude = Math.max(
      this.dominicanRepublicBounds.minLatitude,
      Math.min(Number(bounds.minLatitude), Number(bounds.maxLatitude)),
    );
    const maxLatitude = Math.min(
      this.dominicanRepublicBounds.maxLatitude,
      Math.max(Number(bounds.minLatitude), Number(bounds.maxLatitude)),
    );
    const minLongitude = Math.max(
      this.dominicanRepublicBounds.minLongitude,
      Math.min(Number(bounds.minLongitude), Number(bounds.maxLongitude)),
    );
    const maxLongitude = Math.min(
      this.dominicanRepublicBounds.maxLongitude,
      Math.max(Number(bounds.minLongitude), Number(bounds.maxLongitude)),
    );

    if (
      ![minLatitude, maxLatitude, minLongitude, maxLongitude].every(
        Number.isFinite,
      ) ||
      minLatitude >= maxLatitude ||
      minLongitude >= maxLongitude
    ) {
      throw new BadRequestException(
        "El area visible del mapa no esta dentro de Republica Dominicana o no es valida.",
      );
    }

    return { minLatitude, maxLatitude, minLongitude, maxLongitude };
  }

  private highFlowSampleRoutes(bounds: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  }): Array<Array<{ latitude: number; longitude: number }>> {
    const latitudeSpan = bounds.maxLatitude - bounds.minLatitude;
    const longitudeSpan = bounds.maxLongitude - bounds.minLongitude;
    const horizontalLatitudes = [0.25, 0.5, 0.75].map(
      (ratio) => bounds.minLatitude + latitudeSpan * ratio,
    );
    const verticalLongitudes = [0.25, 0.5, 0.75].map(
      (ratio) => bounds.minLongitude + longitudeSpan * ratio,
    );

    return [
      ...horizontalLatitudes.map((latitude) => [
        { latitude, longitude: bounds.minLongitude },
        { latitude, longitude: bounds.maxLongitude },
      ]),
      ...verticalLongitudes.map((longitude) => [
        { latitude: bounds.minLatitude, longitude },
        { latitude: bounds.maxLatitude, longitude },
      ]),
    ];
  }

  private dedupeTrafficSegments(
    segments: HighFlowTrafficSegment[],
  ): HighFlowTrafficSegment[] {
    const seen = new Set<string>();
    return segments.filter((segment) => {
      const first = segment.coordinates[0];
      const last = segment.coordinates[segment.coordinates.length - 1];
      const key = [
        segment.speed,
        first?.[0]?.toFixed(4),
        first?.[1]?.toFixed(4),
        last?.[0]?.toFixed(4),
        last?.[1]?.toFixed(4),
      ].join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isInsideDominicanRepublicBounds(point: {
    latitude: number;
    longitude: number;
  }) {
    const bounds = this.dominicanRepublicBounds;
    return (
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= bounds.minLatitude &&
      point.latitude <= bounds.maxLatitude &&
      point.longitude >= bounds.minLongitude &&
      point.longitude <= bounds.maxLongitude
    );
  }

  private async fetchRoute(
    points: Array<{ latitude: number; longitude: number }>,
    options?: OptimizeRiskRouteDto,
  ): Promise<Omit<RouteCandidate, "risk"> | null> {
    const provider = this.normalizeRoutingProvider(options?.provider);

    if (provider === "google-routes") {
      const googleKey = (
        options?.googleMapsApiKey ||
        this.systemConfig.getSecretApiKey("googleMaps") ||
        this.config.get<string>("GOOGLE_MAPS_API_KEY") ||
        ""
      ).trim();
      if (googleKey) {
        this.assertGoogleMapsApiKey(googleKey);
        const route = await this.fetchGoogleRoutesRoute(points, googleKey);
        if (route) return route;
      }
    }

    if (provider === "openrouteservice") {
      const orsKey = (
        options?.openRouteServiceApiKey ||
        this.config.get<string>("OPENROUTESERVICE_API_KEY") ||
        ""
      ).trim();
      if (orsKey) {
        const route = await this.fetchOpenRouteServiceRoute(points, orsKey);
        if (route) return route;
      }
    }

    if (provider !== "osrm") {
      const fallbackRoute = await this.fetchConfiguredOsrmRoute(
        points,
        options?.endpoint,
      );
      if (fallbackRoute) return fallbackRoute;
    }

    return this.fetchConfiguredOsrmRoute(points, options?.endpoint);
  }

  private normalizeRoutingProvider(
    provider: string | undefined,
  ): RoutingProvider {
    const value = (provider ?? "").trim().toLowerCase();
    if (value.includes("google")) return "google-routes";
    if (value.includes("openroute")) return "openrouteservice";
    return "osrm";
  }

  private assertGoogleMapsApiKey(apiKey: string) {
    if (!apiKey) {
      throw new BadRequestException("API key de Google Maps requerida.");
    }

    const looksLikeOAuthClientId =
      apiKey.endsWith(".apps.googleusercontent.com") ||
      /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(apiKey);
    if (looksLikeOAuthClientId) {
      throw new BadRequestException(
        "GOOGLE_MAPS_API_KEY debe ser una API key de Google Maps Platform, no GOOGLE_CLIENT_ID de OAuth.",
      );
    }

    if (!apiKey.startsWith("AIza")) {
      throw new BadRequestException(
        "GOOGLE_MAPS_API_KEY no tiene formato de API key de Google Maps Platform.",
      );
    }
  }

  private async fetchGoogleRoutesRoute(
    points: Array<{ latitude: number; longitude: number }>,
    apiKey: string,
  ): Promise<Omit<RouteCandidate, "risk"> | null> {
    const [origin, ...rest] = points;
    const destination = rest[rest.length - 1];
    const intermediates = rest.slice(0, -1);
    if (!origin || !destination) return null;

    const response = await this.fetchExternal(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.geoJsonLinestring,routes.travelAdvisory.speedReadingIntervals",
        },
        body: JSON.stringify({
          origin: this.googleRoutesWaypoint(origin),
          destination: this.googleRoutesWaypoint(destination),
          intermediates: intermediates.map((point) =>
            this.googleRoutesWaypoint(point),
          ),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE_OPTIMAL",
          extraComputations: ["TRAFFIC_ON_POLYLINE"],
          computeAlternativeRoutes: false,
          polylineEncoding: "GEO_JSON_LINESTRING",
          languageCode: "es",
          regionCode: "DO",
        }),
      },
      {
        provider: "Google",
        service: "Routes API",
        operation: "compute route",
      },
    );

    if (!response.ok) {
      await this.recordExternalHttpFailure(response, {
        provider: "Google",
        service: "Routes API",
        operation: "compute route",
      });
      return null;
    }

    const data = (await response.json()) as GoogleRoutesResponse;
    const route = data.routes?.[0];
    const coordinates = route?.polyline?.geoJsonLinestring?.coordinates ?? [];
    if (!route || !coordinates.length) return null;

    return {
      provider: "google-routes",
      coordinates,
      distance: Number(route.distanceMeters ?? 0),
      duration: this.googleDurationSeconds(
        route.duration ?? route.staticDuration,
      ),
      traffic: this.googleTrafficSegments(
        coordinates,
        route.travelAdvisory?.speedReadingIntervals ?? [],
      ),
    };
  }

  private googleTrafficSegments(
    coordinates: Array<[number, number]>,
    intervals: NonNullable<
      NonNullable<GoogleRoutesResponse["routes"]>[number]["travelAdvisory"]
    >["speedReadingIntervals"],
  ): NonNullable<RouteCandidate["traffic"]> {
    const segments = (intervals ?? [])
      .map((interval) => {
        const start = Math.max(0, interval.startPolylinePointIndex ?? 0);
        const end = Math.min(
          coordinates.length,
          interval.endPolylinePointIndex ?? coordinates.length,
        );
        const segmentCoordinates = coordinates.slice(start, end + 1);
        return {
          speed: interval.speed ?? "NORMAL",
          coordinates: segmentCoordinates,
        };
      })
      .filter((segment) => segment.coordinates.length >= 2);

    const slowSegments = segments.filter(
      (segment) => segment.speed === "SLOW",
    ).length;
    const jamSegments = segments.filter(
      (segment) => segment.speed === "TRAFFIC_JAM",
    ).length;

    return {
      congestedSegments: slowSegments + jamSegments,
      slowSegments,
      jamSegments,
      segments,
    };
  }

  private googleRoutesWaypoint(point: { latitude: number; longitude: number }) {
    return {
      location: {
        latLng: {
          latitude: point.latitude,
          longitude: point.longitude,
        },
      },
    };
  }

  private googleDurationSeconds(duration: string | undefined): number {
    const match = duration?.match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Number(match[1]) : 0;
  }

  private async fetchOpenRouteServiceRoute(
    points: Array<{ latitude: number; longitude: number }>,
    apiKey: string,
  ): Promise<Omit<RouteCandidate, "risk"> | null> {
    const response = await this.fetchExternal(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: points.map((point) => [point.longitude, point.latitude]),
          instructions: false,
          preference: "recommended",
        }),
      },
      {
        provider: "OpenRouteService",
        service: "Directions API",
        operation: "driving route",
      },
    );

    if (!response.ok) {
      await this.recordExternalHttpFailure(response, {
        provider: "OpenRouteService",
        service: "Directions API",
        operation: "driving route",
      });
      return null;
    }

    const data = (await response.json()) as OrsGeoJsonResponse;
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates ?? [];
    if (!coordinates.length) return null;

    return {
      provider: "openrouteservice",
      coordinates,
      distance: Number(feature?.properties?.summary?.distance ?? 0),
      duration: Number(feature?.properties?.summary?.duration ?? 0),
    };
  }

  private async fetchConfiguredOsrmRoute(
    points: Array<{ latitude: number; longitude: number }>,
    endpoint?: string,
  ): Promise<Omit<RouteCandidate, "risk"> | null> {
    const configuredEndpoint = (
      endpoint ||
      this.config.get<string>("OSRM_ROUTE_ENDPOINT") ||
      ""
    ).trim();
    return this.fetchOsrmRoute(
      points,
      configuredEndpoint || "https://router.project-osrm.org/route/v1/driving",
    );
  }

  private async fetchOsrmRoute(
    points: Array<{ latitude: number; longitude: number }>,
    endpoint: string,
  ): Promise<Omit<RouteCandidate, "risk"> | null> {
    const coordinates = points
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(";");
    const baseEndpoint = endpoint.replace(/\/$/, "");
    const response = await this.fetchExternal(
      `${baseEndpoint}/${coordinates}?overview=full&geometries=geojson&alternatives=false`,
      undefined,
      {
        provider: "OSRM",
        service: "Route API",
        operation: "driving route",
      },
    );
    if (!response.ok) {
      await this.recordExternalHttpFailure(response, {
        provider: "OSRM",
        service: "Route API",
        operation: "driving route",
      });
      return null;
    }

    const data = (await response.json()) as OsrmRouteResponse;
    const route = data.routes?.[0];
    const geometry = route?.geometry?.coordinates ?? [];
    if (!route || !geometry.length) return null;

    return {
      provider: "osrm",
      coordinates: geometry,
      distance: Number(route.distance ?? 0),
      duration: Number(route.duration ?? 0),
    };
  }

  private async routeBlockingReports() {
    return this.reportsRepo
      .createQueryBuilder("report")
      .where("report.status NOT IN (:...closedStatuses)", {
        closedStatuses: [
          ReportStatus.RESOLVED,
          ReportStatus.REJECTED,
          ReportStatus.DUPLICATE,
        ],
      })
      .andWhere("(report.category = :floodZone OR report.riskLevel >= 4)", {
        floodZone: ReportCategory.FLOOD_ZONE,
      })
      .andWhere("report.latitude IS NOT NULL")
      .andWhere("report.longitude IS NOT NULL")
      .getMany();
  }

  private withRouteRisk(
    route: Omit<RouteCandidate, "risk">,
    reports: Report[],
  ): RouteCandidate {
    const floodZones = this.countReportsNearRoute(
      reports.filter((report) => report.category === ReportCategory.FLOOD_ZONE),
      route.coordinates,
      260,
    );
    const highRiskReports = this.countReportsNearRoute(
      reports.filter(
        (report) =>
          report.category !== ReportCategory.FLOOD_ZONE &&
          Number(report.riskLevel) >= 4,
      ),
      route.coordinates,
      180,
    );
    const total = floodZones * 100 + highRiskReports;

    return {
      ...route,
      risk: {
        floodZones,
        highRiskReports,
        total,
        unsafe: total > 0,
      },
    };
  }

  private blockingReportsNearRoute(
    reports: Report[],
    coordinates: Array<[number, number]>,
  ) {
    return reports.filter((report) => {
      const thresholdMeters =
        report.category === ReportCategory.FLOOD_ZONE ? 260 : 180;
      return this.isReportNearRoute(report, coordinates, thresholdMeters);
    });
  }

  private countReportsNearRoute(
    reports: Report[],
    coordinates: Array<[number, number]>,
    thresholdMeters: number,
  ) {
    return reports.filter((report) =>
      this.isReportNearRoute(report, coordinates, thresholdMeters),
    ).length;
  }

  private isReportNearRoute(
    report: Report,
    coordinates: Array<[number, number]>,
    thresholdMeters: number,
  ) {
    const reportPoint = {
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
    };
    return coordinates.some(([longitude, latitude], index) => {
      if (index % 8 !== 0) return false;
      return (
        this.metersBetween(reportPoint, { latitude, longitude }) <=
        thresholdMeters
      );
    });
  }

  private detourWaypointsAround(report: Report) {
    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);
    const offsets =
      report.category === ReportCategory.FLOOD_ZONE
        ? [0.01, 0.018]
        : [0.008, 0.014];

    return offsets
      .flatMap((offset) => [
        { latitude: latitude + offset, longitude },
        { latitude: latitude - offset, longitude },
        { latitude, longitude: longitude + offset },
        { latitude, longitude: longitude - offset },
        { latitude: latitude + offset, longitude: longitude + offset },
        { latitude: latitude + offset, longitude: longitude - offset },
        { latitude: latitude - offset, longitude: longitude + offset },
        { latitude: latitude - offset, longitude: longitude - offset },
      ])
      .filter((point) => this.isInsideDominicanRepublicBounds(point));
  }

  async findOne(id: string) {
    const report = await this.reportsRepo.findOne({
      where: { id },
      relations: { history: true, assignedTo: true, assignedInstitution: true },
      order: { history: { createdAt: "DESC" } },
    });
    if (!report) throw new NotFoundException("Reporte no encontrado");
    return report;
  }

  private async findRecentFloodZone(latitude: number, longitude: number) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const reports = await this.reportsRepo
      .createQueryBuilder("report")
      .where("report.category = :category", {
        category: ReportCategory.FLOOD_ZONE,
      })
      .andWhere("report.status NOT IN (:...closedStatuses)", {
        closedStatuses: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
      })
      .andWhere("report.createdAt >= :since", { since })
      .getMany();

    return reports.find(
      (report) =>
        this.metersBetween(
          { latitude, longitude },
          {
            latitude: Number(report.latitude),
            longitude: Number(report.longitude),
          },
        ) <= 1000,
    );
  }

  private detectRoadDamage(dto: CreateReportDto): {
    detected: boolean;
    category?: ReportCategory;
    riskLevel: number;
    reason: string;
  } {
    const categoryAllowsDetection =
      dto.category === ReportCategory.OTHER ||
      dto.category === ReportCategory.ROAD_DAMAGE;
    const obstructionAllowsDetection =
      dto.category === ReportCategory.OTHER ||
      dto.category === ReportCategory.ROAD_OBSTRUCTION;
    if (!categoryAllowsDetection && !obstructionAllowsDetection)
      return { detected: false, riskLevel: dto.riskLevel ?? 3, reason: "" };

    const text = this.normalizeSearchText(
      `${dto.title} ${dto.description} ${dto.address ?? ""}`,
    );
    const roadObstructionKeywords = [
      "escombro",
      "escombros",
      "basura",
      "basuras",
      "desperdicio",
      "desperdicios",
      "objeto en la via",
      "objeto en via",
      "obstaculo",
      "obstaculos",
      "via bloqueada",
      "calle bloqueada",
      "carril bloqueado",
      "arbol caido",
      "poste caido",
      "materiales en la via",
      "derrame",
      "carga caida",
    ];
    const roadDamageKeywords = [
      "bache",
      "hoyo",
      "hueco",
      "huecos",
      "grieta",
      "grietas",
      "asfalto roto",
      "asfalto levantado",
      "calle rota",
      "calle danada",
      "calle deteriorada",
      "calzada rota",
      "via rota",
      "via danada",
      "via deteriorada",
      "via en mal estado",
      "mal estado de la via",
      "deterioro de la via",
      "carretera deteriorada",
      "carretera rota",
      "carretera danada",
      "desnivel",
      "hundimiento",
      "socavon",
      "zanja",
      "alcantarilla sin tapa",
      "tapa de alcantarilla",
      "badén roto",
      "baden roto",
      "pavimento roto",
    ];
    const exposureKeywords = [
      "profundo",
      "grande",
      "peligroso",
      "accidente",
      "motociclista",
      "motor",
      "peaton",
      "noche",
      "curva",
      "puente",
      "autopista",
      "avenida",
      "escuela",
      "agua",
      "inundado",
    ];

    const obstructionMatches = obstructionAllowsDetection
      ? roadObstructionKeywords.filter((keyword) =>
          text.includes(this.normalizeSearchText(keyword)),
        )
      : [];
    const matches = categoryAllowsDetection
      ? roadDamageKeywords.filter((keyword) =>
          text.includes(this.normalizeSearchText(keyword)),
        )
      : [];
    if (obstructionMatches.length) {
      const exposureMatches = exposureKeywords.filter((keyword) =>
        text.includes(this.normalizeSearchText(keyword)),
      );
      const riskLevel = Math.min(
        5,
        Math.max(3, 4 + Math.min(1, exposureMatches.length)),
      );
      return {
        detected: true,
        category: ReportCategory.ROAD_OBSTRUCTION,
        riskLevel,
        reason: `Obstruccion detectada: ${obstructionMatches.slice(0, 4).join(", ")}${exposureMatches.length ? `. Exposicion: ${exposureMatches.slice(0, 3).join(", ")}` : ""}.`,
      };
    }
    if (!matches.length)
      return { detected: false, riskLevel: dto.riskLevel ?? 3, reason: "" };

    const exposureMatches = exposureKeywords.filter((keyword) =>
      text.includes(this.normalizeSearchText(keyword)),
    );
    const riskLevel = Math.min(
      5,
      Math.max(3, 3 + Math.min(2, exposureMatches.length)),
    );

    return {
      detected: true,
      category: ReportCategory.ROAD_DAMAGE,
      riskLevel,
      reason: `Coincidencias: ${matches.slice(0, 4).join(", ")}${exposureMatches.length ? `. Exposicion: ${exposureMatches.slice(0, 3).join(", ")}` : ""}.`,
    };
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private roadTelemetrySeverity(dto: RoadTelemetryDto): {
    riskLevel: number;
    reason: string;
  } {
    if (dto.accuracyMeters !== undefined && dto.accuracyMeters > 45) {
      return {
        riskLevel: 0,
        reason: `Precision GPS insuficiente: ${Math.round(dto.accuracyMeters)} m.`,
      };
    }

    if (dto.eventType === "impact") {
      const magnitude = dto.accelerationMagnitude ?? 0;
      if (magnitude < 18)
        return {
          riskLevel: 0,
          reason: `Impacto bajo: ${magnitude.toFixed(1)} m/s2.`,
        };
      if (magnitude >= 32)
        return {
          riskLevel: 5,
          reason: `Impacto severo detectado por acelerometro: ${magnitude.toFixed(1)} m/s2.`,
        };
      if (magnitude >= 24)
        return {
          riskLevel: 4,
          reason: `Impacto fuerte detectado por acelerometro: ${magnitude.toFixed(1)} m/s2.`,
        };
      return {
        riskLevel: 3,
        reason: `Impacto moderado detectado por acelerometro: ${magnitude.toFixed(1)} m/s2.`,
      };
    }

    if (dto.eventType === "high_flow") {
      return {
        riskLevel: 3,
        reason: "Zona marcada manualmente como punto de alto flujo vehicular.",
      };
    }

    const before = dto.speedBeforeKmh ?? 0;
    const after = dto.speedAfterKmh ?? before;
    const drop = before - after;
    if (before < 18 || drop < 14) {
      return {
        riskLevel: 0,
        reason: `Reduccion de velocidad insuficiente: ${before.toFixed(0)} a ${after.toFixed(0)} km/h.`,
      };
    }
    if (drop >= 35)
      return {
        riskLevel: 5,
        reason: `Frenada muy brusca detectada: ${before.toFixed(0)} a ${after.toFixed(0)} km/h.`,
      };
    if (drop >= 24)
      return {
        riskLevel: 4,
        reason: `Frenada brusca detectada: ${before.toFixed(0)} a ${after.toFixed(0)} km/h.`,
      };
    return {
      riskLevel: 3,
      reason: `Reduccion anormal de velocidad detectada: ${before.toFixed(0)} a ${after.toFixed(0)} km/h.`,
    };
  }

  private async recentRoadTelemetryCluster(
    dto: RoadTelemetryDto,
    eventType: "impact" | "speed_drop",
    radiusMeters: number,
    windowMinutes: number,
  ) {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const events = await this.roadTelemetryRepo
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.user", "user")
      .where("event.eventType = :eventType", { eventType })
      .andWhere("event.createdAt >= :since", { since })
      .getMany();

    const uniqueUsers = new Set<string>();
    return events.filter((event) => {
      const distance = this.metersBetween(
        { latitude: dto.latitude, longitude: dto.longitude },
        {
          latitude: Number(event.latitude),
          longitude: Number(event.longitude),
        },
      );
      if (distance > radiusMeters) return false;

      const userId = event.user?.id ?? event.id;
      const key = `${userId}:${Math.floor(Date.parse(String(event.createdAt)) / 60000)}`;
      if (uniqueUsers.has(key)) return false;
      uniqueUsers.add(key);
      return true;
    });
  }

  private async findDuplicateCandidate(
    dto: CreateReportDto,
    radiusMeters = this.duplicateReportRadiusMeters,
  ) {
    const reports = await this.reportsRepo
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.createdBy", "createdBy")
      .leftJoinAndSelect("report.assignedTo", "assignedTo")
      .leftJoinAndSelect("report.assignedInstitution", "assignedInstitution")
      .leftJoinAndSelect("report.confirmations", "confirmations")
      .leftJoinAndSelect("confirmations.user", "confirmationUser")
      .where("report.category = :category", { category: dto.category })
      .andWhere("report.status NOT IN (:...closedStatuses)", {
        closedStatuses: [
          ReportStatus.RESOLVED,
          ReportStatus.REJECTED,
          ReportStatus.DUPLICATE,
        ],
      })
      .getMany();

    return reports
      .map((report) => ({
        report,
        distance: this.metersBetween(
          { latitude: dto.latitude, longitude: dto.longitude },
          {
            latitude: Number(report.latitude),
            longitude: Number(report.longitude),
          },
        ),
      }))
      .filter((item) => item.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)[0]?.report;
  }

  private async confirmExistingReport(
    report: Report,
    dto: CreateReportDto,
    user: User,
  ) {
    const existingConfirmation = await this.confirmationsRepo.findOne({
      where: { report: { id: report.id }, user: { id: user.id } },
      relations: { report: true, user: true },
    });
    const alreadyOriginalReporter = report.createdBy?.id === user.id;

    if (existingConfirmation || alreadyOriginalReporter) {
      return { report, added: false };
    }

    const confirmation = this.confirmationsRepo.create({
      report,
      user,
      latitude: dto.latitude,
      longitude: dto.longitude,
      source: dto.source ?? "web",
      comment: dto.description,
    });

    report.confirmationCount =
      Math.max(Number(report.confirmationCount ?? 1), 1) + 1;
    if (dto.riskLevel && dto.riskLevel > report.riskLevel)
      report.riskLevel = dto.riskLevel;

    const history = this.historyRepo.create({
      report,
      fromStatus: report.status,
      toStatus: report.status,
      comment: `Riesgo confirmado por otro usuario desde ${dto.source ?? "web"}. Confirmaciones: ${report.confirmationCount}.`,
      changedBy: user,
    });

    await this.reportsRepo.save(report);
    await this.confirmationsRepo.save(confirmation);
    await this.historyRepo.save(history);

    report.confirmations = [...(report.confirmations ?? []), confirmation];
    void this.publishReportRealtimeEvent("report.updated", report);
    return { report, added: true };
  }

  async assignReport(
    id: string,
    dto: AssignReportDto,
    actor: { id: string; role: UserRole },
  ) {
    if (actor.role === UserRole.CITIZEN) {
      throw new ForbiddenException("Un ciudadano no puede asignar reportes");
    }

    const report = await this.findOne(id);
    const changedBy = await this.usersRepo.findOneByOrFail({ id: actor.id });
    const assignedTo = dto.assignedToId
      ? await this.usersRepo.findOneByOrFail({ id: dto.assignedToId })
      : changedBy;
    const assignedInstitution = dto.assignedInstitutionId
      ? await this.institutionsRepo.findOneByOrFail({
          id: dto.assignedInstitutionId,
        })
      : (assignedTo.institution ?? null);
    const previousStatus = report.status;

    report.assignedTo = assignedTo;
    report.assignedInstitution = assignedInstitution;
    report.assignmentNote =
      dto.note ??
      `Asignado a ${assignedTo.fullName}${assignedInstitution ? ` (${assignedInstitution.name})` : ""}.`;
    report.assignedAt = new Date();
    if (
      report.status === ReportStatus.PENDING ||
      report.status === ReportStatus.VALIDATED
    ) {
      report.status = ReportStatus.IN_PROGRESS;
    }

    const history = this.historyRepo.create({
      report,
      fromStatus: previousStatus,
      toStatus: report.status,
      comment: report.assignmentNote,
      changedBy,
    });

    await this.reportsRepo.save(report);
    await this.historyRepo.save(history);
    void this.publishReportRealtimeEvent("report.assigned", report, {
      assignedToId: assignedTo.id,
      institutionId: assignedInstitution?.id ?? null,
    });
    return this.serializeReport({
      ...report,
      history: [history, ...(report.history ?? [])],
    } as Report);
  }

  private serializeReport(report: Report) {
    const originalReporter = report.createdBy
      ? [
          {
            id: report.createdBy.id,
            fullName: report.createdBy.fullName,
            source: report.source,
            createdAt: report.createdAt,
            originalReporter: true,
          },
        ]
      : [];
    const additionalConfirmers =
      report.confirmations?.map((confirmation) => ({
        id: confirmation.user.id,
        fullName: confirmation.user.fullName,
        source: confirmation.source,
        createdAt: confirmation.createdAt,
        originalReporter: false,
      })) ?? [];
    const confirmers = [...originalReporter, ...additionalConfirmers];

    return {
      id: report.id,
      title: report.title,
      category: report.category,
      description: report.description,
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
      province: report.province,
      municipality: report.municipality,
      address: report.address,
      riskLevel: report.riskLevel,
      confirmationCount: Math.max(
        Number(report.confirmationCount ?? 1),
        confirmers.length || 1,
      ),
      confirmers,
      assignedTo: report.assignedTo
        ? {
            id: report.assignedTo.id,
            fullName: report.assignedTo.fullName,
            role: report.assignedTo.role,
          }
        : null,
      assignedInstitution: report.assignedInstitution
        ? {
            id: report.assignedInstitution.id,
            name: report.assignedInstitution.name,
            type: report.assignedInstitution.type,
            province: report.assignedInstitution.province,
            municipality: report.assignedInstitution.municipality,
            coverageArea: report.assignedInstitution.coverageArea,
            phone: report.assignedInstitution.phone,
            emergencyPhone: report.assignedInstitution.emergencyPhone,
            whatsapp: report.assignedInstitution.whatsapp,
            email: report.assignedInstitution.email,
            websiteUrl: report.assignedInstitution.websiteUrl,
            sourceUrl: report.assignedInstitution.sourceUrl,
            address: report.assignedInstitution.address,
          }
        : null,
      assignmentNote: report.assignmentNote,
      assignedAt: report.assignedAt,
      history:
        report.history?.map((item) => ({
          id: item.id,
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
          comment: item.comment,
          changedBy: item.changedBy
            ? { id: item.changedBy.id, fullName: item.changedBy.fullName }
            : null,
          createdAt: item.createdAt,
        })) ?? [],
      source: report.source,
      status: report.status,
      createdAt: report.createdAt,
      photoUrls: this.reportPhotoUrlsForResponse(report),
      aiAnalysisStatus: report.aiAnalysisStatus,
      aiSummary: report.aiSummary,
      aiSuggestedCategory: report.aiSuggestedCategory,
      aiRiskScore: report.aiRiskScore,
      aiPriority: report.aiPriority,
      aiSuggestedInstitution: report.aiSuggestedInstitution,
      aiConfidence:
        report.aiConfidence === null || report.aiConfidence === undefined
          ? null
          : Number(report.aiConfidence),
      aiRationale: report.aiRationale,
      aiAnalysisError: report.aiAnalysisError,
      aiProcessedAt: report.aiProcessedAt,
    };
  }

  private scheduleAiAnalysis(reportId: string) {
    if (!this.aiService.isEnabled()) return;
    setTimeout(() => void this.analyzeReportWithAi(reportId), 0);
  }

  private reportPhotoUrlsOrDefault(
    dto: Pick<CreateReportDto, "category" | "photoUrls">,
  ) {
    const urls = (dto.photoUrls ?? []).map((url) => url.trim()).filter(Boolean);
    return urls.length ? urls : [this.defaultReportPhotoUrl(dto.category)];
  }

  private defaultReportPhotoUrl(category: ReportCategory) {
    const configuredUrl = this.systemConfig.categoryDefaultPhotoUrl(category);
    return (
      configuredUrl ||
      defaultReportPhotoByCategory[category] ||
      defaultReportPhotoByCategory[ReportCategory.OTHER]
    );
  }

  private realReportPhotoUrls(report: Report) {
    const defaultPhotoUrl = this.defaultReportPhotoUrl(report.category);
    return (
      report.photos
        ?.map((photo) => photo.url)
        .filter(
          (url) =>
            !url.startsWith(defaultReportPhotoPrefix) && url !== defaultPhotoUrl,
        ) ?? []
    );
  }

  private reportPhotoUrlsForResponse(report: Report) {
    const urls = report.photos?.map((photo) => photo.url).filter(Boolean) ?? [];
    return urls.length ? urls : [this.defaultReportPhotoUrl(report.category)];
  }

  private async publishReportRealtimeEvent(
    type:
      | "report.created"
      | "report.updated"
      | "report.status_changed"
      | "report.assigned"
      | "weather.flood_zone_created",
    report: Report,
    extra: {
      rooms?: string[];
      assignedToId?: string | null;
      institutionId?: string | null;
      previousStatus?: ReportStatus;
    } = {},
  ) {
    const institutionId =
      extra.institutionId ?? report.assignedInstitution?.id ?? null;
    const assignedToId = extra.assignedToId ?? report.assignedTo?.id ?? null;
    const rooms = extra.rooms ?? [
      "reports:map",
      "reports:admin",
      ...(institutionId ? [`reports:institution:${institutionId}`] : []),
      ...(assignedToId ? [`reports:user:${assignedToId}`] : []),
    ];

    await this.realtimeEvents.publish({
      type,
      reportId: report.id,
      status: report.status,
      category: report.category,
      riskLevel: report.riskLevel,
      province: report.province ?? null,
      municipality: report.municipality ?? null,
      assignedToId,
      institutionId,
      rooms,
      data: {
        previousStatus: extra.previousStatus,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
      },
    });

    if (
      [
        "report.created",
        "report.status_changed",
        "report.assigned",
        "weather.flood_zone_created",
      ].includes(type)
    ) {
      await this.realtimeEvents.publish({
        type: "report.metrics_changed",
        rooms: ["reports:admin"],
        data: { reportId: report.id },
      });
    }
  }

  private async analyzeReportWithAi(reportId: string) {
    const report = await this.reportsRepo.findOne({
      where: { id: reportId },
      relations: { photos: true },
    });
    if (!report) return;

    report.aiAnalysisStatus = "pending";
    report.aiAnalysisError = null;
    await this.reportsRepo.save(report);

    try {
      const analysis = await this.aiService.analyzeReport({
        title: report.title,
        description: report.description,
        category: report.category,
        riskLevel: report.riskLevel,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        province: report.province,
        municipality: report.municipality,
        address: report.address,
        photoUrls: this.realReportPhotoUrls(report),
      });

      if (!analysis) return;

      Object.assign(report, {
        aiAnalysisStatus: "completed",
        aiSummary: analysis.summary,
        aiSuggestedCategory: analysis.suggestedCategory,
        aiRiskScore: analysis.riskScore,
        aiPriority: analysis.priority,
        aiSuggestedInstitution: analysis.suggestedInstitution,
        aiConfidence: analysis.confidence,
        aiRationale: analysis.rationale,
        aiAnalysisError: null,
        aiProcessedAt: new Date(),
      });
      await this.reportsRepo.save(report);
    } catch (error) {
      report.aiAnalysisStatus = "failed";
      report.aiAnalysisError =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : String(error).slice(0, 1000);
      report.aiProcessedAt = new Date();
      await this.reportsRepo.save(report);
      this.logger.warn(
        `No se pudo analizar reporte ${reportId} con IA: ${report.aiAnalysisError}`,
      );
    }
  }

  private async findWeatherSystemUser() {
    const email = this.config.get<string>(
      "WEATHER_SYSTEM_USER_EMAIL",
      this.config.get<string>(
        "ACCUWEATHER_SYSTEM_USER_EMAIL",
        "admin@demo.com",
      ),
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
      "No hay usuario de sistema para crear zonas meteorologicas.",
    );
  }

  private floodMonitorEnabled(): boolean {
    return this.weatherSettings.get().floodMonitorEnabled;
  }

  private floodMonitorIntervalMinutes(): number {
    return this.weatherSettings.get().monitorIntervalMinutes;
  }

  private configureFloodMonitorTimer(runStartupScan: boolean) {
    if (this.floodMonitorTimer) {
      clearInterval(this.floodMonitorTimer);
      this.floodMonitorTimer = undefined;
    }

    if (!this.floodMonitorEnabled()) {
      this.logger.log("Monitoreo automatico de inundaciones desactivado.");
      return;
    }

    const intervalMinutes = this.floodMonitorIntervalMinutes();
    this.logger.log(
      `Monitoreo automatico de inundaciones activo cada ${intervalMinutes} minutos.`,
    );

    this.floodMonitorTimer = setInterval(
      () => void this.monitorFloodZones("scheduled"),
      intervalMinutes * 60 * 1000,
    );

    if (runStartupScan)
      setTimeout(() => void this.monitorFloodZones("startup"), 15_000);
  }

  private floodMonitorPoints(): Array<{
    country: string;
    name: string;
    latitude: number;
    longitude: number;
    province?: string;
    municipality?: string;
  }> {
    const countries = this.floodMonitorCountries();
    const primaryCountry = countries[0] ?? this.floodMonitorCountry();
    const raw = this.weatherSettings.get().floodMonitorPoints.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Array<{
          name?: string;
          latitude?: number;
          longitude?: number;
          country?: string;
          province?: string;
          municipality?: string;
        }>;
        const configured = parsed
          .map((point, index) => ({
            country: this.normalizeFloodMonitorCountry(
              point.country || primaryCountry,
            ),
            name: point.name || `Punto configurado ${index + 1}`,
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            province: point.province,
            municipality: point.municipality,
          }))
          .filter(
            (point) =>
              Number.isFinite(point.latitude) &&
              Number.isFinite(point.longitude),
          );
        if (configured.length) return configured;
      } catch (error) {
        this.logger.warn(
          `Puntos de monitoreo climatico no son JSON valido: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return countries.flatMap((country) =>
      this.defaultFloodMonitorPointsForCountry(country),
    );
  }

  private floodMonitorCountries(): string[] {
    const countries = this.weatherSettings.get().floodMonitorCountries;
    const normalized = Array.from(
      new Set(
        (countries?.length ? countries : [this.floodMonitorCountry()]).map(
          (country) => this.normalizeFloodMonitorCountry(country),
        ),
      ),
    ).filter(Boolean);

    return normalized.length ? normalized : ["DO"];
  }

  private floodMonitorCountry(): string {
    return this.normalizeFloodMonitorCountry(
      this.weatherSettings.get().floodMonitorCountry,
    );
  }

  private normalizeFloodMonitorCountry(country: string): string {
    const normalized = String(country || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (
      ["DO", "DOM", "RD", "REPUBLICADOMINICANA", "DOMINICANREPUBLIC"].includes(
        normalized,
      )
    ) {
      return "DO";
    }

    return normalized || "DO";
  }

  private defaultFloodMonitorPointsForCountry(
    country: string,
  ): FloodMonitorPoint[] {
    if (country === "HT") {
      return [
        {
          country: "HT",
          province: "Ouest",
          municipality: "Port-au-Prince",
          name: "Haiti - Port-au-Prince",
          latitude: 18.5944,
          longitude: -72.3074,
        },
        {
          country: "HT",
          province: "Ouest",
          municipality: "Carrefour",
          name: "Haiti - Carrefour",
          latitude: 18.5411,
          longitude: -72.3992,
        },
        {
          country: "HT",
          province: "Nord",
          municipality: "Cap-Haitien",
          name: "Haiti - Cap-Haitien",
          latitude: 19.7594,
          longitude: -72.1982,
        },
        {
          country: "HT",
          province: "Artibonite",
          municipality: "Gonaives",
          name: "Haiti - Gonaives",
          latitude: 19.4456,
          longitude: -72.6893,
        },
        {
          country: "HT",
          province: "Sud",
          municipality: "Les Cayes",
          name: "Haiti - Les Cayes",
          latitude: 18.2004,
          longitude: -73.7507,
        },
        {
          country: "HT",
          province: "Sud-Est",
          municipality: "Jacmel",
          name: "Haiti - Jacmel",
          latitude: 18.2342,
          longitude: -72.5347,
        },
        {
          country: "HT",
          province: "Centre",
          municipality: "Hinche",
          name: "Haiti - Hinche",
          latitude: 19.15,
          longitude: -72.0167,
        },
        {
          country: "HT",
          province: "Nord-Est",
          municipality: "Fort-Liberte",
          name: "Haiti - Fort-Liberte",
          latitude: 19.6678,
          longitude: -71.8397,
        },
        {
          country: "HT",
          province: "Nord-Ouest",
          municipality: "Port-de-Paix",
          name: "Haiti - Port-de-Paix",
          latitude: 19.9398,
          longitude: -72.8304,
        },
        {
          country: "HT",
          province: "Grand'Anse",
          municipality: "Jeremie",
          name: "Haiti - Jeremie",
          latitude: 18.65,
          longitude: -74.1167,
        },
        {
          country: "HT",
          province: "Nippes",
          municipality: "Miragoane",
          name: "Haiti - Miragoane",
          latitude: 18.4426,
          longitude: -73.0887,
        },
        {
          country: "HT",
          province: "Artibonite",
          municipality: "Saint-Marc",
          name: "Haiti - Saint-Marc",
          latitude: 19.1082,
          longitude: -72.6938,
        },
      ];
    }

    if (country === "PR") {
      return [
        {
          country: "PR",
          province: "San Juan",
          municipality: "San Juan",
          name: "Puerto Rico - San Juan",
          latitude: 18.4655,
          longitude: -66.1057,
        },
        {
          country: "PR",
          province: "Bayamon",
          municipality: "Bayamon",
          name: "Puerto Rico - Bayamon",
          latitude: 18.3986,
          longitude: -66.1557,
        },
        {
          country: "PR",
          province: "Ponce",
          municipality: "Ponce",
          name: "Puerto Rico - Ponce",
          latitude: 18.0111,
          longitude: -66.6141,
        },
        {
          country: "PR",
          province: "Mayaguez",
          municipality: "Mayaguez",
          name: "Puerto Rico - Mayaguez",
          latitude: 18.2011,
          longitude: -67.1396,
        },
        {
          country: "PR",
          province: "Arecibo",
          municipality: "Arecibo",
          name: "Puerto Rico - Arecibo",
          latitude: 18.4724,
          longitude: -66.7157,
        },
        {
          country: "PR",
          province: "Humacao",
          municipality: "Humacao",
          name: "Puerto Rico - Humacao",
          latitude: 18.1497,
          longitude: -65.8274,
        },
        {
          country: "PR",
          province: "Caguas",
          municipality: "Caguas",
          name: "Puerto Rico - Caguas",
          latitude: 18.2341,
          longitude: -66.0485,
        },
        {
          country: "PR",
          province: "Fajardo",
          municipality: "Fajardo",
          name: "Puerto Rico - Fajardo",
          latitude: 18.3258,
          longitude: -65.6524,
        },
        {
          country: "PR",
          province: "Guayama",
          municipality: "Guayama",
          name: "Puerto Rico - Guayama",
          latitude: 17.9841,
          longitude: -66.1138,
        },
        {
          country: "PR",
          province: "Aguadilla",
          municipality: "Aguadilla",
          name: "Puerto Rico - Aguadilla",
          latitude: 18.4274,
          longitude: -67.1541,
        },
      ];
    }

    if (country === "JM") {
      return [
        {
          country: "JM",
          province: "Kingston",
          municipality: "Kingston",
          name: "Jamaica - Kingston",
          latitude: 17.9712,
          longitude: -76.7936,
        },
        {
          country: "JM",
          province: "Saint Andrew",
          municipality: "Half Way Tree",
          name: "Jamaica - Saint Andrew",
          latitude: 18.0106,
          longitude: -76.7847,
        },
        {
          country: "JM",
          province: "Saint James",
          municipality: "Montego Bay",
          name: "Jamaica - Montego Bay",
          latitude: 18.4762,
          longitude: -77.8939,
        },
        {
          country: "JM",
          province: "Saint Ann",
          municipality: "Ocho Rios",
          name: "Jamaica - Ocho Rios",
          latitude: 18.4074,
          longitude: -77.1031,
        },
        {
          country: "JM",
          province: "Manchester",
          municipality: "Mandeville",
          name: "Jamaica - Mandeville",
          latitude: 18.0417,
          longitude: -77.5071,
        },
        {
          country: "JM",
          province: "Westmoreland",
          municipality: "Savanna-la-Mar",
          name: "Jamaica - Savanna-la-Mar",
          latitude: 18.219,
          longitude: -78.1332,
        },
        {
          country: "JM",
          province: "Portland",
          municipality: "Port Antonio",
          name: "Jamaica - Port Antonio",
          latitude: 18.1762,
          longitude: -76.4509,
        },
        {
          country: "JM",
          province: "Saint Thomas",
          municipality: "Morant Bay",
          name: "Jamaica - Morant Bay",
          latitude: 17.8815,
          longitude: -76.4093,
        },
        {
          country: "JM",
          province: "Clarendon",
          municipality: "May Pen",
          name: "Jamaica - May Pen",
          latitude: 17.9702,
          longitude: -77.2452,
        },
        {
          country: "JM",
          province: "Trelawny",
          municipality: "Falmouth",
          name: "Jamaica - Falmouth",
          latitude: 18.4936,
          longitude: -77.6559,
        },
      ];
    }

    if (country === "CU") {
      return [
        {
          country: "CU",
          province: "La Habana",
          municipality: "La Habana",
          name: "Cuba - La Habana",
          latitude: 23.1136,
          longitude: -82.3666,
        },
        {
          country: "CU",
          province: "Santiago de Cuba",
          municipality: "Santiago de Cuba",
          name: "Cuba - Santiago de Cuba",
          latitude: 20.0169,
          longitude: -75.8302,
        },
        {
          country: "CU",
          province: "Camaguey",
          municipality: "Camaguey",
          name: "Cuba - Camaguey",
          latitude: 21.3808,
          longitude: -77.9169,
        },
        {
          country: "CU",
          province: "Holguin",
          municipality: "Holguin",
          name: "Cuba - Holguin",
          latitude: 20.8872,
          longitude: -76.2631,
        },
        {
          country: "CU",
          province: "Villa Clara",
          municipality: "Santa Clara",
          name: "Cuba - Santa Clara",
          latitude: 22.4069,
          longitude: -79.9649,
        },
        {
          country: "CU",
          province: "Pinar del Rio",
          municipality: "Pinar del Rio",
          name: "Cuba - Pinar del Rio",
          latitude: 22.4175,
          longitude: -83.6981,
        },
        {
          country: "CU",
          province: "Matanzas",
          municipality: "Matanzas",
          name: "Cuba - Matanzas",
          latitude: 23.0411,
          longitude: -81.5775,
        },
        {
          country: "CU",
          province: "Cienfuegos",
          municipality: "Cienfuegos",
          name: "Cuba - Cienfuegos",
          latitude: 22.1599,
          longitude: -80.4438,
        },
        {
          country: "CU",
          province: "Guantanamo",
          municipality: "Guantanamo",
          name: "Cuba - Guantanamo",
          latitude: 20.1444,
          longitude: -75.2092,
        },
        {
          country: "CU",
          province: "Granma",
          municipality: "Bayamo",
          name: "Cuba - Bayamo",
          latitude: 20.3817,
          longitude: -76.6428,
        },
        {
          country: "CU",
          province: "Sancti Spiritus",
          municipality: "Sancti Spiritus",
          name: "Cuba - Sancti Spiritus",
          latitude: 21.9297,
          longitude: -79.4425,
        },
        {
          country: "CU",
          province: "Las Tunas",
          municipality: "Las Tunas",
          name: "Cuba - Las Tunas",
          latitude: 20.9617,
          longitude: -76.9511,
        },
        {
          country: "CU",
          province: "Ciego de Avila",
          municipality: "Ciego de Avila",
          name: "Cuba - Ciego de Avila",
          latitude: 21.84,
          longitude: -78.7619,
        },
        {
          country: "CU",
          province: "Artemisa",
          municipality: "Artemisa",
          name: "Cuba - Artemisa",
          latitude: 22.8136,
          longitude: -82.7619,
        },
        {
          country: "CU",
          province: "Mayabeque",
          municipality: "San Jose de las Lajas",
          name: "Cuba - Mayabeque",
          latitude: 22.9614,
          longitude: -82.1511,
        },
      ];
    }

    if (country === "BS") {
      return [
        {
          country: "BS",
          province: "New Providence",
          municipality: "Nassau",
          name: "Bahamas - Nassau",
          latitude: 25.0443,
          longitude: -77.3504,
        },
        {
          country: "BS",
          province: "Grand Bahama",
          municipality: "Freeport",
          name: "Bahamas - Freeport",
          latitude: 26.5333,
          longitude: -78.7,
        },
        {
          country: "BS",
          province: "Abaco",
          municipality: "Marsh Harbour",
          name: "Bahamas - Marsh Harbour",
          latitude: 26.5412,
          longitude: -77.0636,
        },
        {
          country: "BS",
          province: "Exuma",
          municipality: "George Town",
          name: "Bahamas - Exuma",
          latitude: 23.5162,
          longitude: -75.7867,
        },
        {
          country: "BS",
          province: "Andros",
          municipality: "Andros Town",
          name: "Bahamas - Andros",
          latitude: 24.7053,
          longitude: -77.7691,
        },
        {
          country: "BS",
          province: "Eleuthera",
          municipality: "Governor's Harbour",
          name: "Bahamas - Eleuthera",
          latitude: 25.194,
          longitude: -76.243,
        },
        {
          country: "BS",
          province: "Long Island",
          municipality: "Clarence Town",
          name: "Bahamas - Long Island",
          latitude: 23.1,
          longitude: -74.9833,
        },
        {
          country: "BS",
          province: "Bimini",
          municipality: "Alice Town",
          name: "Bahamas - Bimini",
          latitude: 25.728,
          longitude: -79.297,
        },
      ];
    }

    if (country === "TC") {
      return [
        {
          country: "TC",
          province: "Providenciales",
          municipality: "Providenciales",
          name: "Turcas y Caicos - Providenciales",
          latitude: 21.7738,
          longitude: -72.2659,
        },
        {
          country: "TC",
          province: "Grand Turk",
          municipality: "Cockburn Town",
          name: "Turcas y Caicos - Grand Turk",
          latitude: 21.4675,
          longitude: -71.1389,
        },
        {
          country: "TC",
          province: "North Caicos",
          municipality: "Bottle Creek",
          name: "Turcas y Caicos - North Caicos",
          latitude: 21.8833,
          longitude: -71.95,
        },
        {
          country: "TC",
          province: "South Caicos",
          municipality: "Cockburn Harbour",
          name: "Turcas y Caicos - South Caicos",
          latitude: 21.4917,
          longitude: -71.5281,
        },
      ];
    }

    if (country === "CO") {
      return [
        {
          country: "CO",
          province: "Bogota D.C.",
          municipality: "Bogota",
          name: "Colombia - Bogota",
          latitude: 4.711,
          longitude: -74.0721,
        },
        {
          country: "CO",
          province: "Antioquia",
          municipality: "Medellin",
          name: "Colombia - Medellin",
          latitude: 6.2442,
          longitude: -75.5812,
        },
        {
          country: "CO",
          province: "Valle del Cauca",
          municipality: "Cali",
          name: "Colombia - Cali",
          latitude: 3.4516,
          longitude: -76.532,
        },
        {
          country: "CO",
          province: "Atlantico",
          municipality: "Barranquilla",
          name: "Colombia - Barranquilla",
          latitude: 10.9685,
          longitude: -74.7813,
        },
        {
          country: "CO",
          province: "Bolivar",
          municipality: "Cartagena",
          name: "Colombia - Cartagena",
          latitude: 10.391,
          longitude: -75.4794,
        },
        {
          country: "CO",
          province: "Santander",
          municipality: "Bucaramanga",
          name: "Colombia - Bucaramanga",
          latitude: 7.1193,
          longitude: -73.1227,
        },
        {
          country: "CO",
          province: "Norte de Santander",
          municipality: "Cucuta",
          name: "Colombia - Cucuta",
          latitude: 7.8939,
          longitude: -72.5078,
        },
        {
          country: "CO",
          province: "Risaralda",
          municipality: "Pereira",
          name: "Colombia - Pereira",
          latitude: 4.8087,
          longitude: -75.6906,
        },
        {
          country: "CO",
          province: "Caldas",
          municipality: "Manizales",
          name: "Colombia - Manizales",
          latitude: 5.0703,
          longitude: -75.5138,
        },
        {
          country: "CO",
          province: "Tolima",
          municipality: "Ibague",
          name: "Colombia - Ibague",
          latitude: 4.4389,
          longitude: -75.2322,
        },
        {
          country: "CO",
          province: "Huila",
          municipality: "Neiva",
          name: "Colombia - Neiva",
          latitude: 2.9345,
          longitude: -75.2809,
        },
        {
          country: "CO",
          province: "Magdalena",
          municipality: "Santa Marta",
          name: "Colombia - Santa Marta",
          latitude: 11.2408,
          longitude: -74.199,
        },
        {
          country: "CO",
          province: "Meta",
          municipality: "Villavicencio",
          name: "Colombia - Villavicencio",
          latitude: 4.142,
          longitude: -73.6266,
        },
        {
          country: "CO",
          province: "Narino",
          municipality: "Pasto",
          name: "Colombia - Pasto",
          latitude: 1.2136,
          longitude: -77.2811,
        },
        {
          country: "CO",
          province: "Cordoba",
          municipality: "Monteria",
          name: "Colombia - Monteria",
          latitude: 8.75,
          longitude: -75.8833,
        },
        {
          country: "CO",
          province: "Cesar",
          municipality: "Valledupar",
          name: "Colombia - Valledupar",
          latitude: 10.4631,
          longitude: -73.2532,
        },
        {
          country: "CO",
          province: "Cauca",
          municipality: "Popayan",
          name: "Colombia - Popayan",
          latitude: 2.4448,
          longitude: -76.6147,
        },
        {
          country: "CO",
          province: "La Guajira",
          municipality: "Riohacha",
          name: "Colombia - Riohacha",
          latitude: 11.5444,
          longitude: -72.9072,
        },
      ];
    }

    if (country === "VE") {
      return [
        {
          country: "VE",
          province: "Distrito Capital",
          municipality: "Caracas",
          name: "Venezuela - Caracas",
          latitude: 10.4806,
          longitude: -66.9036,
        },
        {
          country: "VE",
          province: "Zulia",
          municipality: "Maracaibo",
          name: "Venezuela - Maracaibo",
          latitude: 10.6427,
          longitude: -71.6125,
        },
        {
          country: "VE",
          province: "Carabobo",
          municipality: "Valencia",
          name: "Venezuela - Valencia",
          latitude: 10.1579,
          longitude: -67.9972,
        },
        {
          country: "VE",
          province: "Lara",
          municipality: "Barquisimeto",
          name: "Venezuela - Barquisimeto",
          latitude: 10.0678,
          longitude: -69.3474,
        },
        {
          country: "VE",
          province: "Aragua",
          municipality: "Maracay",
          name: "Venezuela - Maracay",
          latitude: 10.2469,
          longitude: -67.5958,
        },
        {
          country: "VE",
          province: "Bolivar",
          municipality: "Ciudad Guayana",
          name: "Venezuela - Ciudad Guayana",
          latitude: 8.3667,
          longitude: -62.65,
        },
        {
          country: "VE",
          province: "Anzoategui",
          municipality: "Barcelona",
          name: "Venezuela - Barcelona",
          latitude: 10.1363,
          longitude: -64.6862,
        },
        {
          country: "VE",
          province: "Monagas",
          municipality: "Maturin",
          name: "Venezuela - Maturin",
          latitude: 9.7457,
          longitude: -63.1832,
        },
        {
          country: "VE",
          province: "Merida",
          municipality: "Merida",
          name: "Venezuela - Merida",
          latitude: 8.5897,
          longitude: -71.1561,
        },
        {
          country: "VE",
          province: "Tachira",
          municipality: "San Cristobal",
          name: "Venezuela - San Cristobal",
          latitude: 7.7669,
          longitude: -72.225,
        },
        {
          country: "VE",
          province: "Falcon",
          municipality: "Coro",
          name: "Venezuela - Coro",
          latitude: 11.4045,
          longitude: -69.6734,
        },
        {
          country: "VE",
          province: "Sucre",
          municipality: "Cumana",
          name: "Venezuela - Cumana",
          latitude: 10.4635,
          longitude: -64.1775,
        },
        {
          country: "VE",
          province: "Portuguesa",
          municipality: "Guanare",
          name: "Venezuela - Guanare",
          latitude: 9.0436,
          longitude: -69.7489,
        },
        {
          country: "VE",
          province: "Guarico",
          municipality: "San Juan de los Morros",
          name: "Venezuela - San Juan de los Morros",
          latitude: 9.9115,
          longitude: -67.3538,
        },
        {
          country: "VE",
          province: "Apure",
          municipality: "San Fernando de Apure",
          name: "Venezuela - San Fernando de Apure",
          latitude: 7.8878,
          longitude: -67.4724,
        },
        {
          country: "VE",
          province: "Nueva Esparta",
          municipality: "Porlamar",
          name: "Venezuela - Porlamar",
          latitude: 10.957,
          longitude: -63.8491,
        },
      ];
    }

    if (country === "PA") {
      return [
        {
          country: "PA",
          province: "Panama",
          municipality: "Panama",
          name: "Panama - Ciudad de Panama",
          latitude: 8.9824,
          longitude: -79.5199,
        },
        {
          country: "PA",
          province: "Colon",
          municipality: "Colon",
          name: "Panama - Colon",
          latitude: 9.3592,
          longitude: -79.9014,
        },
        {
          country: "PA",
          province: "Chiriqui",
          municipality: "David",
          name: "Panama - David",
          latitude: 8.4273,
          longitude: -82.4308,
        },
        {
          country: "PA",
          province: "Cocle",
          municipality: "Penonome",
          name: "Panama - Penonome",
          latitude: 8.5189,
          longitude: -80.3573,
        },
        {
          country: "PA",
          province: "Herrera",
          municipality: "Chitre",
          name: "Panama - Chitre",
          latitude: 7.9608,
          longitude: -80.4294,
        },
        {
          country: "PA",
          province: "Los Santos",
          municipality: "Las Tablas",
          name: "Panama - Las Tablas",
          latitude: 7.7647,
          longitude: -80.2748,
        },
        {
          country: "PA",
          province: "Veraguas",
          municipality: "Santiago",
          name: "Panama - Santiago",
          latitude: 8.1004,
          longitude: -80.9831,
        },
        {
          country: "PA",
          province: "Bocas del Toro",
          municipality: "Bocas del Toro",
          name: "Panama - Bocas del Toro",
          latitude: 9.34,
          longitude: -82.24,
        },
        {
          country: "PA",
          province: "Darien",
          municipality: "La Palma",
          name: "Panama - Darien",
          latitude: 8.4061,
          longitude: -78.1396,
        },
        {
          country: "PA",
          province: "Guna Yala",
          municipality: "El Porvenir",
          name: "Panama - Guna Yala",
          latitude: 9.5522,
          longitude: -78.9522,
        },
      ];
    }

    if (country !== "DO") return [];

    return [
      {
        country: "DO",
        province: "Azua",
        municipality: "Azua de Compostela",
        name: "Azua - zona urbana",
        latitude: 18.453,
        longitude: -70.734,
      },
      {
        country: "DO",
        province: "Bahoruco",
        municipality: "Neiba",
        name: "Bahoruco - Neiba",
        latitude: 18.482,
        longitude: -71.418,
      },
      {
        country: "DO",
        province: "Barahona",
        municipality: "Santa Cruz de Barahona",
        name: "Barahona - zona urbana",
        latitude: 18.208,
        longitude: -71.101,
      },
      {
        country: "DO",
        province: "Dajabon",
        municipality: "Dajabon",
        name: "Dajabon - zona urbana",
        latitude: 19.548,
        longitude: -71.708,
      },
      {
        country: "DO",
        province: "Distrito Nacional",
        municipality: "Santo Domingo de Guzman",
        name: "Distrito Nacional - zona centro",
        latitude: 18.4887,
        longitude: -69.9024,
      },
      {
        country: "DO",
        province: "Duarte",
        municipality: "San Francisco de Macoris",
        name: "Duarte - San Francisco de Macoris",
        latitude: 19.3,
        longitude: -70.252,
      },
      {
        country: "DO",
        province: "El Seibo",
        municipality: "Santa Cruz de El Seibo",
        name: "El Seibo - zona urbana",
        latitude: 18.765,
        longitude: -69.039,
      },
      {
        country: "DO",
        province: "Elias Pina",
        municipality: "Comendador",
        name: "Elias Pina - Comendador",
        latitude: 18.877,
        longitude: -71.704,
      },
      {
        country: "DO",
        province: "Espaillat",
        municipality: "Moca",
        name: "Espaillat - Moca",
        latitude: 19.393,
        longitude: -70.525,
      },
      {
        country: "DO",
        province: "Hato Mayor",
        municipality: "Hato Mayor del Rey",
        name: "Hato Mayor - zona urbana",
        latitude: 18.765,
        longitude: -69.257,
      },
      {
        country: "DO",
        province: "Hermanas Mirabal",
        municipality: "Salcedo",
        name: "Hermanas Mirabal - Salcedo",
        latitude: 19.377,
        longitude: -70.417,
      },
      {
        country: "DO",
        province: "Independencia",
        municipality: "Jimani",
        name: "Independencia - Jimani",
        latitude: 18.493,
        longitude: -71.851,
      },
      {
        country: "DO",
        province: "La Altagracia",
        municipality: "Higuey",
        name: "La Altagracia - Higuey",
        latitude: 18.616,
        longitude: -68.708,
      },
      {
        country: "DO",
        province: "La Romana",
        municipality: "La Romana",
        name: "La Romana - zona urbana",
        latitude: 18.427,
        longitude: -68.972,
      },
      {
        country: "DO",
        province: "La Vega",
        municipality: "La Vega",
        name: "La Vega - zona urbana",
        latitude: 19.223,
        longitude: -70.529,
      },
      {
        country: "DO",
        province: "Maria Trinidad Sanchez",
        municipality: "Nagua",
        name: "Maria Trinidad Sanchez - Nagua",
        latitude: 19.376,
        longitude: -69.847,
      },
      {
        country: "DO",
        province: "Monsenor Nouel",
        municipality: "Bonao",
        name: "Monsenor Nouel - Bonao",
        latitude: 18.936,
        longitude: -70.409,
      },
      {
        country: "DO",
        province: "Monte Cristi",
        municipality: "San Fernando de Monte Cristi",
        name: "Monte Cristi - zona urbana",
        latitude: 19.849,
        longitude: -71.645,
      },
      {
        country: "DO",
        province: "Monte Plata",
        municipality: "Monte Plata",
        name: "Monte Plata - zona urbana",
        latitude: 18.807,
        longitude: -69.784,
      },
      {
        country: "DO",
        province: "Pedernales",
        municipality: "Pedernales",
        name: "Pedernales - zona urbana",
        latitude: 18.038,
        longitude: -71.744,
      },
      {
        country: "DO",
        province: "Peravia",
        municipality: "Bani",
        name: "Peravia - Bani",
        latitude: 18.279,
        longitude: -70.332,
      },
      {
        country: "DO",
        province: "Puerto Plata",
        municipality: "San Felipe de Puerto Plata",
        name: "Puerto Plata - zona urbana",
        latitude: 19.793,
        longitude: -70.688,
      },
      {
        country: "DO",
        province: "Samana",
        municipality: "Santa Barbara de Samana",
        name: "Samana - zona urbana",
        latitude: 19.205,
        longitude: -69.336,
      },
      {
        country: "DO",
        province: "San Cristobal",
        municipality: "San Cristobal",
        name: "San Cristobal - zona urbana",
        latitude: 18.416,
        longitude: -70.109,
      },
      {
        country: "DO",
        province: "San Jose de Ocoa",
        municipality: "San Jose de Ocoa",
        name: "San Jose de Ocoa - zona urbana",
        latitude: 18.546,
        longitude: -70.506,
      },
      {
        country: "DO",
        province: "San Juan",
        municipality: "San Juan de la Maguana",
        name: "San Juan - San Juan de la Maguana",
        latitude: 18.805,
        longitude: -71.229,
      },
      {
        country: "DO",
        province: "San Pedro de Macoris",
        municipality: "San Pedro de Macoris",
        name: "San Pedro de Macoris - zona urbana",
        latitude: 18.461,
        longitude: -69.306,
      },
      {
        country: "DO",
        province: "Sanchez Ramirez",
        municipality: "Cotui",
        name: "Sanchez Ramirez - Cotui",
        latitude: 19.052,
        longitude: -70.149,
      },
      {
        country: "DO",
        province: "Santiago",
        municipality: "Santiago de los Caballeros",
        name: "Santiago - zona urbana",
        latitude: 19.451,
        longitude: -70.697,
      },
      {
        country: "DO",
        province: "Santiago Rodriguez",
        municipality: "San Ignacio de Sabaneta",
        name: "Santiago Rodriguez - Sabaneta",
        latitude: 19.477,
        longitude: -71.342,
      },
      {
        country: "DO",
        province: "Santo Domingo",
        municipality: "Santo Domingo Este",
        name: "Santo Domingo Este - Residencial Acuario",
        latitude: 18.4924403,
        longitude: -69.8519308,
      },
      {
        country: "DO",
        province: "Santo Domingo",
        municipality: "Santo Domingo Norte",
        name: "Santo Domingo Norte - Villa Mella",
        latitude: 18.555,
        longitude: -69.902,
      },
      {
        country: "DO",
        province: "Santo Domingo",
        municipality: "Santo Domingo Oeste",
        name: "Santo Domingo Oeste - Herrera",
        latitude: 18.465,
        longitude: -69.982,
      },
      {
        country: "DO",
        province: "Santo Domingo",
        municipality: "Boca Chica",
        name: "Boca Chica - Autopista Las Americas",
        latitude: 18.452,
        longitude: -69.612,
      },
      {
        country: "DO",
        province: "Valverde",
        municipality: "Mao",
        name: "Valverde - Mao",
        latitude: 19.551,
        longitude: -71.078,
      },
    ];
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

  async updateStatus(
    id: string,
    dto: UpdateReportStatusDto,
    actor: { id: string; role: UserRole },
  ) {
    if (actor.role === UserRole.CITIZEN) {
      throw new ForbiddenException(
        "Un ciudadano no puede cambiar el estado de reportes",
      );
    }

    const report = await this.findOne(id);
    const changedBy = await this.usersRepo.findOneByOrFail({ id: actor.id });
    const previousStatus = report.status;
    report.status = dto.toStatus;

    const history = this.historyRepo.create({
      report,
      fromStatus: previousStatus,
      toStatus: dto.toStatus,
      comment: dto.comment,
      changedBy,
    });

    await this.reportsRepo.save(report);
    await this.historyRepo.save(history);
    void this.publishReportRealtimeEvent("report.status_changed", report, {
      previousStatus,
    });
    return this.findOne(id);
  }
}
