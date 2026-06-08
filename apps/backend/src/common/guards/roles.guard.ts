import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../enums/user-role.enum";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RolePermissionsService } from "../../modules/role-permissions/role-permissions.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissions: RolePermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const baseRole = user?.role
      ? this.rolePermissions.baseRoleFor(user.role)
      : null;
    return Boolean(
      user?.role &&
        (requiredRoles.includes(user.role) ||
          (baseRole && requiredRoles.includes(baseRole))),
    );
  }
}
