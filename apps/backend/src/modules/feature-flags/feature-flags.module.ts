import { Global, Module } from "@nestjs/common";
import { SystemConfigModule } from "../system-config/system-config.module";
import { FeatureFlagsController } from "./feature-flags.controller";
import { FeatureFlagsService } from "./feature-flags.service";

@Global()
@Module({
  imports: [SystemConfigModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
