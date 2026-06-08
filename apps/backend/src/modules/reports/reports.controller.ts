import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Express } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { FeatureFlag } from "../../common/decorators/feature-flag.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ImageModerationService } from "../../common/moderation/image-moderation.service";
import { StorageService } from "../../common/storage/storage.service";
import { ActivateWeatherFloodZonesDto } from "./dto/activate-weather-flood-zones.dto";
import { AssignReportDto } from "./dto/assign-report.dto";
import { CreateEmergencyCallLogDto } from "./dto/create-emergency-call-log.dto";
import { CreateReportDto } from "./dto/create-report.dto";
import {
  GoogleMapsTileSessionDto,
  OptimizeRiskRouteDto,
} from "./dto/optimize-risk-route.dto";
import { QueryReportsDto } from "./dto/query-reports.dto";
import { RoadTelemetryDto } from "./dto/road-telemetry.dto";
import { UpdateReportStatusDto } from "./dto/update-report-status.dto";
import { WeatherStatusDto } from "./dto/weather-status.dto";
import { ReportsService } from "./reports.service";
import { WeatherAutomationConfig } from "./weather-settings.service";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureFlagGuard, RolesGuard)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly imageModeration: ImageModerationService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @FeatureFlag("new-report")
  @ApiConsumes("multipart/form-data", "application/json")
  @UseInterceptors(
    FilesInterceptor("photos", 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 5 },
      fileFilter: (_req, file, callback) => {
        if (!allowedImageMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              "Solo se permiten imagenes JPG, PNG o WebP",
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async create(
    @Body() dto: CreateReportDto,
    @UploadedFiles() photos: Express.Multer.File[] = [],
    @CurrentUser() user: { id: string },
  ) {
    await Promise.all(
      photos.map((photo) =>
        this.imageModeration.assertAllowed(photo, "report"),
      ),
    );
    const uploadedPhotoUrls = await Promise.all(
      photos.map((photo) => this.storage.uploadPublicFile("reports", photo)),
    );
    return this.reportsService.create(
      { ...dto, photoUrls: [...(dto.photoUrls ?? []), ...uploadedPhotoUrls] },
      user.id,
    );
  }

  @Get()
  findAll(@Query() query: QueryReportsDto) {
    return this.reportsService.findAll(query);
  }

  @Get("map")
  findMapPoints(@Query() query: QueryReportsDto) {
    return this.reportsService.findMapPoints(query);
  }

  @Get("admin/metrics")
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  adminMetrics(@Query() query: QueryReportsDto) {
    return this.reportsService.adminMetrics(query);
  }

  @Post("emergency-call-logs")
  logEmergencyCall(
    @Body() dto: CreateEmergencyCallLogDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reportsService.logEmergencyCall(dto, user.id);
  }

  @Post("weather/flood-zones/activate")
  @FeatureFlag("weather-monitor")
  activateWeatherFloodZones(@Body() dto: ActivateWeatherFloodZonesDto) {
    return this.reportsService.activateWeatherFloodZones(dto);
  }

  @Post("weather/flood-zones/scan")
  @FeatureFlag("weather-monitor")
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  monitorFloodZones() {
    return this.reportsService.monitorFloodZones("manual");
  }

  @Post("weather/status")
  @FeatureFlag("weather-monitor")
  weatherStatus(@Body() dto: WeatherStatusDto) {
    return this.reportsService.weatherStatus(dto);
  }

  @Get("weather/config")
  @FeatureFlag("weather-monitor")
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  weatherConfig() {
    return this.reportsService.weatherConfig();
  }

  @Patch("weather/config")
  @FeatureFlag("weather-monitor")
  @Roles(UserRole.SUPER_ADMIN)
  updateWeatherConfig(@Body() dto: Partial<WeatherAutomationConfig>) {
    return this.reportsService.updateWeatherConfig(dto);
  }

  @Post("road-telemetry")
  recordRoadTelemetry(
    @Body() dto: RoadTelemetryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reportsService.recordRoadTelemetry(dto, user.id);
  }

  @Post("routes/optimize-risk")
  @FeatureFlag("optimized-routes")
  optimizeRiskRoute(@Body() dto: OptimizeRiskRouteDto) {
    return this.reportsService.optimizeRiskRoute(dto);
  }

  @Post("maps/google/tile-session")
  createGoogleMapsTileSession(
    @Body() dto: GoogleMapsTileSessionDto,
  ): Promise<unknown> {
    return this.reportsService.createGoogleMapsTileSession(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(":id/status")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.reportsService.updateStatus(id, dto, user);
  }

  @Patch(":id/assignment")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  assignReport(
    @Param("id") id: string,
    @Body() dto: AssignReportDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.reportsService.assignReport(id, dto, user);
  }
}
