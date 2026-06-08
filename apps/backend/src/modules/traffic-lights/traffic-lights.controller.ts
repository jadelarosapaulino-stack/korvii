import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FeatureFlag } from "../../common/decorators/feature-flag.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateTrafficLightDto } from "./dto/create-traffic-light.dto";
import { ImportTrafficLightsDto } from "./dto/import-traffic-lights.dto";
import { QueryTrafficLightsDto } from "./dto/query-traffic-lights.dto";
import { UpdateTrafficLightDto } from "./dto/update-traffic-light.dto";
import { TrafficLightsService } from "./traffic-lights.service";
import { TrafficLightsSettings } from "./traffic-lights-settings.service";

@ApiTags("Traffic lights")
@ApiBearerAuth()
@FeatureFlag("admin-traffic-lights")
@UseGuards(JwtAuthGuard, FeatureFlagGuard, RolesGuard)
@Controller("traffic-lights")
export class TrafficLightsController {
  constructor(private readonly trafficLightsService: TrafficLightsService) {}

  @Get()
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  findAll(@Query() query: QueryTrafficLightsDto) {
    return this.trafficLightsService.findAll(query);
  }

  @Get("settings")
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  settings() {
    return this.trafficLightsService.settings();
  }

  @Get("green-light-insights")
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  greenLightInsights(
    @Query() query: { radiusMeters?: number; limit?: number },
  ) {
    return this.trafficLightsService.greenLightInsights(query);
  }

  @Patch("settings")
  @Roles(UserRole.SUPER_ADMIN)
  updateSettings(@Body() dto: Partial<TrafficLightsSettings>) {
    return this.trafficLightsService.updateSettings(dto);
  }

  @Post("import/osm")
  @Roles(UserRole.SUPER_ADMIN)
  importFromOpenStreetMap(@Body() dto: ImportTrafficLightsDto) {
    return this.trafficLightsService.importFromOpenStreetMap(dto);
  }

  @Post("refresh-location-details")
  @Roles(UserRole.SUPER_ADMIN)
  refreshLocationDetails(
    @Body() dto: { source?: "osm" | "all"; limit?: number },
  ) {
    return this.trafficLightsService.startRefreshLocationDetails(dto);
  }

  @Get("refresh-location-details/status")
  @Roles(UserRole.SUPER_ADMIN)
  refreshLocationDetailsStatus() {
    return this.trafficLightsService.getRefreshLocationDetailsJob();
  }

  @Post()
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateTrafficLightDto) {
    return this.trafficLightsService.create(dto);
  }

  @Patch(":id")
  @Roles(UserRole.MODERATOR, UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateTrafficLightDto) {
    return this.trafficLightsService.update(id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.trafficLightsService.remove(id);
  }
}
