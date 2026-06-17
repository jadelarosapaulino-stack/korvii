import { Global, Module } from "@nestjs/common";
import { SystemConfigModule } from "../../modules/system-config/system-config.module";
import { ImageModerationService } from "./image-moderation.service";

@Global()
@Module({
  imports: [SystemConfigModule],
  providers: [ImageModerationService],
  exports: [ImageModerationService],
})
export class ImageModerationModule {}
