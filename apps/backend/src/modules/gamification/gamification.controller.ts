import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GamificationService } from "./gamification.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get("settings")
  @Roles(UserRole.SUPER_ADMIN)
  settings() {
    return this.gamification.getSettings();
  }

  @Patch("settings")
  @Roles(UserRole.SUPER_ADMIN)
  updateSettings(@Body() body: Record<string, number>) {
    return this.gamification.updateSettings(body);
  }
}
