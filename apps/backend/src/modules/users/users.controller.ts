import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { QueryUsersDto } from "./dto/query-users.dto";
import { UpdateUserAdminDto } from "./dto/update-user-admin.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Patch(":id/admin")
  @Roles(UserRole.SUPER_ADMIN)
  updateUserAdmin(
    @Param("id") id: string,
    @Body() dto: UpdateUserAdminDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.usersService.updateUserAdmin(id, dto, actor.id);
  }
}
