import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { FeatureFlag, FeatureFlagsService } from "./feature-flags.service";

@ApiTags("Feature flags")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("feature-flags")
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get()
  findAll() {
    return this.featureFlags.get();
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN)
  update(@Body() body: FeatureFlag[]) {
    return this.featureFlags.update(body);
  }

  @Post("reset")
  @Roles(UserRole.SUPER_ADMIN)
  reset() {
    return this.featureFlags.reset();
  }
}
