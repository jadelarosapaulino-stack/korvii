import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Report } from "../reports/entities/report.entity";
import { TrafficLight } from "./entities/traffic-light.entity";
import { TrafficLightsController } from "./traffic-lights.controller";
import { TrafficLightsService } from "./traffic-lights.service";
import { TrafficLightsSettingsService } from "./traffic-lights-settings.service";

@Module({
  imports: [TypeOrmModule.forFeature([TrafficLight, Report])],
  controllers: [TrafficLightsController],
  providers: [TrafficLightsService, TrafficLightsSettingsService],
})
export class TrafficLightsModule {}
