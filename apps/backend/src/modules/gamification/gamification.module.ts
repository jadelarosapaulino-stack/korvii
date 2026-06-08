import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GamificationController } from "./gamification.controller";
import { GamificationSetting } from "./gamification-setting.entity";
import { GamificationService } from "./gamification.service";

@Module({
  imports: [TypeOrmModule.forFeature([GamificationSetting])],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
