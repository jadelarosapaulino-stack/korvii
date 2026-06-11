import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfigController } from "./system-config.controller";
import { SystemConfigEntry } from "./system-config.entity";
import { SystemConfigService } from "./system-config.service";

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntry])],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
