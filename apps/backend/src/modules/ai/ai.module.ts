import { Module } from "@nestjs/common";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AiService } from "./ai.service";

@Module({
  imports: [SystemConfigModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
