import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiModule } from "../ai/ai.module";
import { RealtimeEventsModule } from "../realtime-events/realtime-events.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { User } from "../users/user.entity";
import { Institution } from "../institutions/institution.entity";
import { EmergencyCallLog } from "./entities/emergency-call-log.entity";
import { ReportConfirmation } from "./entities/report-confirmation.entity";
import { ReportPhoto } from "./entities/report-photo.entity";
import { Report } from "./entities/report.entity";
import { RoadTelemetryEvent } from "./entities/road-telemetry-event.entity";
import { StatusHistory } from "./entities/status-history.entity";
import { AccuWeatherService } from "./accuweather.service";
import { GoogleMapsTilesController } from "./google-maps-tiles.controller";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { WeatherSettingsService } from "./weather-settings.service";

@Module({
  imports: [
    AiModule,
    RealtimeEventsModule,
    SystemConfigModule,
    TypeOrmModule.forFeature([
      Report,
      ReportPhoto,
      ReportConfirmation,
      RoadTelemetryEvent,
      StatusHistory,
      EmergencyCallLog,
      User,
      Institution,
    ]),
  ],
  controllers: [ReportsController, GoogleMapsTilesController],
  providers: [ReportsService, AccuWeatherService, WeatherSettingsService],
  exports: [ReportsService, TypeOrmModule],
})
export class ReportsModule {}
