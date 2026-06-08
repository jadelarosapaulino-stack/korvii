import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FeatureFlag } from "../../common/decorators/feature-flag.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureFlagGuard, RolesGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  summary() {
    return this.analyticsService.summary();
  }

  @Get("intelligence")
  @FeatureFlag("intelligence")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  intelligence() {
    return this.analyticsService.intelligence();
  }
}
