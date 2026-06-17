import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfigEntry } from "../system-config/system-config.entity";
import { AiService } from "./ai.service";

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntry])],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
