import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeEventsModule } from "../realtime-events/realtime-events.module";
import { Report } from "../reports/entities/report.entity";
import { StatusHistory } from "../reports/entities/status-history.entity";
import { SystemConfigModule } from "../system-config/system-config.module";
import { User } from "../users/user.entity";
import { TrafficLight } from "./entities/traffic-light.entity";
import { TrafficLightsController } from "./traffic-lights.controller";
import { TrafficLightsService } from "./traffic-lights.service";
import { TrafficLightsSettingsService } from "./traffic-lights-settings.service";

@Module({
  imports: [
    RealtimeEventsModule,
    SystemConfigModule,
    TypeOrmModule.forFeature([TrafficLight, Report, StatusHistory, User]),
  ],
  controllers: [TrafficLightsController],
  providers: [TrafficLightsService, TrafficLightsSettingsService],
})
export class TrafficLightsModule {}
