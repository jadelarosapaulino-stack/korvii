import { Global, Module } from "@nestjs/common";
import { SystemConfigModule } from "../system-config/system-config.module";
import { RolePermissionsController } from "./role-permissions.controller";
import { RolePermissionsService } from "./role-permissions.service";

@Global()
@Module({
  imports: [SystemConfigModule],
  controllers: [RolePermissionsController],
  providers: [RolePermissionsService],
  exports: [RolePermissionsService],
})
export class RolePermissionsModule {}
