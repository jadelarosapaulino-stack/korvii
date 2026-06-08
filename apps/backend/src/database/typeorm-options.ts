import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSourceOptions } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { UserRole } from "../common/enums/user-role.enum";
import { ReportCategory } from "../common/enums/report-category.enum";
import { ReportStatus } from "../common/enums/report-status.enum";
import { UserActivityLog } from "../modules/activity/user-activity.entity";
import { Lesson } from "../modules/education/entities/lesson.entity";
import { Quiz } from "../modules/education/entities/quiz.entity";
import { UserProgress } from "../modules/education/entities/user-progress.entity";
import { GamificationSetting } from "../modules/gamification/gamification-setting.entity";
import { Institution } from "../modules/institutions/institution.entity";
import { EmergencyCallLog } from "../modules/reports/entities/emergency-call-log.entity";
import { ReportConfirmation } from "../modules/reports/entities/report-confirmation.entity";
import { ReportPhoto } from "../modules/reports/entities/report-photo.entity";
import { Report } from "../modules/reports/entities/report.entity";
import { RoadTelemetryEvent } from "../modules/reports/entities/road-telemetry-event.entity";
import { StatusHistory } from "../modules/reports/entities/status-history.entity";
import { TrafficLight } from "../modules/traffic-lights/entities/traffic-light.entity";
import { User } from "../modules/users/user.entity";

export const databaseEntities = [
  User,
  UserActivityLog,
  GamificationSetting,
  Institution,
  Lesson,
  Quiz,
  UserProgress,
  Report,
  ReportPhoto,
  ReportConfirmation,
  RoadTelemetryEvent,
  StatusHistory,
  EmergencyCallLog,
  TrafficLight,
];

export function loadBackendEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= value;
  }
}

export function buildTypeOrmOptions(): TypeOrmModuleOptions &
  DataSourceOptions &
  PostgresConnectionOptions {
  return {
    type: "postgres",
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? "ruta_segura",
    password: process.env.DB_PASSWORD ?? "ruta_segura_pwd",
    database: process.env.DB_NAME ?? "ruta_segura_rd",
    entities: databaseEntities,
    migrations: [join(__dirname, "migrations/*{.ts,.js}")],
    synchronize: process.env.DB_SYNC === "true",
    migrationsRun: process.env.DB_MIGRATIONS_RUN === "true",
    logging: process.env.DB_LOGGING === "true",
  };
}

export const enumValues = {
  userRoles: Object.values(UserRole),
  reportCategories: Object.values(ReportCategory),
  reportStatuses: Object.values(ReportStatus),
};
