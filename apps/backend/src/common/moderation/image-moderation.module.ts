import { Global, Module } from "@nestjs/common";
import { ImageModerationService } from "./image-moderation.service";

@Global()
@Module({
  providers: [ImageModerationService],
  exports: [ImageModerationService],
})
export class ImageModerationModule {}
