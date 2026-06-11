import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SystemConfigService } from "./system-config.service";

@UseGuards(JwtAuthGuard)
@Controller("system/config")
export class SystemConfigController {
  constructor(private readonly systemConfig: SystemConfigService) {}

  @Get()
  get(@CurrentUser() user: { role?: string }) {
    return this.systemConfig.get(user.role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch()
  update(@Body() patch: Record<string, unknown>) {
    return this.systemConfig.update(patch);
  }
}
