import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ImageModerationModule } from "./common/moderation/image-moderation.module";
import { StorageModule } from "./common/storage/storage.module";
import { buildTypeOrmOptions } from "./database/typeorm-options";
import { HealthController } from "./health.controller";
import { ActivityModule } from "./modules/activity/activity.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EducationModule } from "./modules/education/education.module";
import { FeatureFlagsModule } from "./modules/feature-flags/feature-flags.module";
import { GamificationModule } from "./modules/gamification/gamification.module";
import { InstitutionsModule } from "./modules/institutions/institutions.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolePermissionsModule } from "./modules/role-permissions/role-permissions.module";
import { TrafficLightsModule } from "./modules/traffic-lights/traffic-lights.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ImageModerationModule,
    StorageModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildTypeOrmOptions(),
        host: config.get<string>("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.get<string>("DB_USER", "ruta_segura"),
        password: config.get<string>("DB_PASSWORD", "ruta_segura_pwd"),
        database: config.get<string>("DB_NAME", "ruta_segura_rd"),
        synchronize: config.get<string>("DB_SYNC", "false") === "true",
        migrationsRun:
          config.get<string>("DB_MIGRATIONS_RUN", "false") === "true",
        logging: config.get<string>("DB_LOGGING", "false") === "true",
      }),
    }),
    UsersModule,
    AuthModule,
    FeatureFlagsModule,
    GamificationModule,
    ActivityModule,
    InstitutionsModule,
    ReportsModule,
    RolePermissionsModule,
    TrafficLightsModule,
    EducationModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
