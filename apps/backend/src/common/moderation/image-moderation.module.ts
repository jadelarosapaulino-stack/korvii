import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfigEntry } from "../../modules/system-config/system-config.entity";
import { ImageModerationService } from "./image-moderation.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntry])],
  providers: [ImageModerationService],
  exports: [ImageModerationService],
})
export class ImageModerationModule {}
