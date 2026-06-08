import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  RolePermissionView,
  RolePermissionsService,
} from "./role-permissions.service";

@ApiTags("Role permissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("role-permissions")
export class RolePermissionsController {
  constructor(private readonly permissions: RolePermissionsService) {}

  @Get()
  findAll() {
    return this.permissions.get();
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN)
  update(@Body() body: RolePermissionView[]) {
    return this.permissions.update(body);
  }

  @Post("reset")
  @Roles(UserRole.SUPER_ADMIN)
  reset() {
    return this.permissions.reset();
  }
}
