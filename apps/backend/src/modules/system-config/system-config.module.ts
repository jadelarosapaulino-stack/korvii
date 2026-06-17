import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfigController } from "./system-config.controller";
import { ExternalApiLoggerService } from "./external-api-logger.service";
import { SystemConfigEntry } from "./system-config.entity";
import { SystemConfigService } from "./system-config.service";

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntry])],
  controllers: [SystemConfigController],
  providers: [SystemConfigService, ExternalApiLoggerService],
  exports: [SystemConfigService, ExternalApiLoggerService],
})
export class SystemConfigModule {}
