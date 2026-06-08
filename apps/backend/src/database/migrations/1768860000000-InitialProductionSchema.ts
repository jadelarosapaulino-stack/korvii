import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialProductionSchema1768860000000
  implements MigrationInterface
{
  name = "InitialProductionSchema1768860000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await this.createEnum(queryRunner, "users_role_enum", [
      "CITIZEN",
      "MODERATOR",
      "INSTITUTION_ADMIN",
      "INSURANCE_ADMIN",
      "SUPER_ADMIN",
    ]);
    await this.createEnum(queryRunner, "reports_category_enum", [
      "ACCIDENT",
      "TRAFFIC_LIGHT_DAMAGED",
      "ROAD_DAMAGE",
      "ROAD_OBSTRUCTION",
      "POOR_LIGHTING",
      "MISSING_SIGNAGE",
      "RECKLESS_DRIVING",
      "DANGEROUS_CROSSING",
      "FLOOD_ZONE",
      "OTHER",
    ]);
    await this.createEnum(queryRunner, "reports_status_enum", [
      "PENDING",
      "VALIDATED",
      "DUPLICATE",
      "REJECTED",
      "IN_PROGRESS",
      "RESOLVED",
    ]);
    await this.createEnum(queryRunner, "status_history_fromstatus_enum", [
      "PENDING",
      "VALIDATED",
      "DUPLICATE",
      "REJECTED",
      "IN_PROGRESS",
      "RESOLVED",
    ]);
    await this.createEnum(queryRunner, "status_history_tostatus_enum", [
      "PENDING",
      "VALIDATED",
      "DUPLICATE",
      "REJECTED",
      "IN_PROGRESS",
      "RESOLVED",
    ]);
    await this.createEnum(queryRunner, "emergency_call_logs_category_enum", [
      "ACCIDENT",
      "TRAFFIC_LIGHT_DAMAGED",
      "ROAD_DAMAGE",
      "ROAD_OBSTRUCTION",
      "POOR_LIGHTING",
      "MISSING_SIGNAGE",
      "RECKLESS_DRIVING",
      "DANGEROUS_CROSSING",
      "FLOOD_ZONE",
      "OTHER",
    ]);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fullName" character varying(150) NOT NULL,
        "email" character varying(150) NOT NULL,
        "passwordHash" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'CITIZEN',
        "province" character varying(80),
        "municipality" character varying(80),
        "vehicleType" character varying(80),
        "phone" character varying(30),
        "occupation" character varying(100),
        "mobilityMode" character varying(80),
        "drivingFrequency" character varying(80),
        "emergencyContactName" character varying(120),
        "emergencyContactPhone" character varying(30),
        "preferredContactChannel" character varying(80),
        "avatarUrl" character varying(255),
        "avatarPreset" character varying(40) NOT NULL DEFAULT 'default',
        "notificationsEnabled" boolean NOT NULL DEFAULT true,
        "decisionInsightsConsent" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT false,
        "activationCodeHash" character varying,
        "activationCodeExpiresAt" TIMESTAMP WITH TIME ZONE,
        "activatedAt" TIMESTAMP WITH TIME ZONE,
        "passwordResetCodeHash" character varying,
        "passwordResetCodeExpiresAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gamification_settings" (
        "key" character varying(80) NOT NULL,
        "value" integer NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gamification_settings_key" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(160) NOT NULL,
        "content" text NOT NULL,
        "category" character varying(80) NOT NULL,
        "courseTitle" character varying(120),
        "videoUrl" text,
        "thumbnailUrl" text,
        "durationMinutes" integer NOT NULL DEFAULT 8,
        "points" integer NOT NULL DEFAULT 10,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lessons_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(180) NOT NULL,
        "category" "reports_category_enum" NOT NULL,
        "description" text NOT NULL,
        "latitude" numeric(10,7) NOT NULL,
        "longitude" numeric(10,7) NOT NULL,
        "province" character varying(80),
        "municipality" character varying(80),
        "address" character varying(220),
        "riskLevel" integer NOT NULL DEFAULT 3,
        "confirmationCount" integer NOT NULL DEFAULT 1,
        "source" character varying(20) NOT NULL DEFAULT 'web',
        "status" "reports_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_photos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid,
        "url" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_photos_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_confirmations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid,
        "userId" uuid NOT NULL,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "source" character varying(20) NOT NULL DEFAULT 'web',
        "comment" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_confirmations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid,
        "fromStatus" "status_history_fromstatus_enum",
        "toStatus" "status_history_tostatus_enum" NOT NULL,
        "comment" text,
        "changedById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_status_history_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "emergency_call_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "category" "emergency_call_logs_category_enum",
        "title" character varying(180),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "province" character varying(80),
        "municipality" character varying(80),
        "address" character varying(220),
        "phoneNumber" character varying(30) NOT NULL DEFAULT '911',
        "source" character varying(120),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_emergency_call_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quizzes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lessonId" uuid,
        "question" text NOT NULL,
        "options" jsonb NOT NULL,
        "correctIndex" integer NOT NULL,
        CONSTRAINT "PK_quizzes_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "lessonId" uuid,
        "completed" boolean NOT NULL DEFAULT false,
        "progressPercent" integer NOT NULL DEFAULT 0,
        "score" integer NOT NULL DEFAULT 0,
        "completedAt" TIMESTAMP,
        "lastAccessedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_progress_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_activity_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "method" character varying(12) NOT NULL,
        "path" character varying(240) NOT NULL,
        "action" character varying(120) NOT NULL,
        "platform" character varying(20),
        "eventType" character varying(40),
        "statusCode" integer,
        "durationMs" integer,
        "ip" character varying(80),
        "userAgent" character varying(320),
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_activity_logs_id" PRIMARY KEY ("id")
      )
    `);

    await this.addColumnIfMissing(
      queryRunner,
      "reports",
      "confirmationCount",
      `"confirmationCount" integer NOT NULL DEFAULT 1`,
    );
    await this.createIndexes(queryRunner);
    await this.createForeignKeys(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_activity_logs" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_progress" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quizzes" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "emergency_call_logs" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "status_history" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "report_confirmations" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "report_photos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lessons" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "gamification_settings" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "emergency_call_logs_category_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "status_history_tostatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "status_history_fromstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "reports_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reports_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }

  private async createEnum(
    queryRunner: QueryRunner,
    name: string,
    values: string[],
  ) {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "${name}" AS ENUM (${values.map((value) => `'${value}'`).join(", ")});
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ) {
    await queryRunner.query(
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${definition}`,
    );
    await queryRunner.query(
      `UPDATE "${table}" SET "${column}" = 1 WHERE "${column}" IS NULL`,
    );
  }

  private async createIndexes(queryRunner: QueryRunner) {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_latitude_longitude" ON "reports" ("latitude", "longitude")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_category_status" ON "reports" ("category", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_confirmations_latitude_longitude" ON "report_confirmations" ("latitude", "longitude")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_report_confirmations_report_user" ON "report_confirmations" ("reportId", "userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_progress_user_lesson" ON "user_progress" ("userId", "lessonId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_activity_logs_user_created" ON "user_activity_logs" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_activity_logs_method_path" ON "user_activity_logs" ("method", "path")`,
    );
  }

  private async createForeignKeys(queryRunner: QueryRunner) {
    await this.addForeignKeyIfMissing(
      queryRunner,
      "reports",
      "FK_reports_createdBy",
      "createdById",
      "users",
      "id",
      "NO ACTION",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "report_photos",
      "FK_report_photos_report",
      "reportId",
      "reports",
      "id",
      "CASCADE",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "report_confirmations",
      "FK_report_confirmations_report",
      "reportId",
      "reports",
      "id",
      "CASCADE",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "report_confirmations",
      "FK_report_confirmations_user",
      "userId",
      "users",
      "id",
      "NO ACTION",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "status_history",
      "FK_status_history_report",
      "reportId",
      "reports",
      "id",
      "CASCADE",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "status_history",
      "FK_status_history_changedBy",
      "changedById",
      "users",
      "id",
      "NO ACTION",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "emergency_call_logs",
      "FK_emergency_call_logs_user",
      "userId",
      "users",
      "id",
      "NO ACTION",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "quizzes",
      "FK_quizzes_lesson",
      "lessonId",
      "lessons",
      "id",
      "CASCADE",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "user_progress",
      "FK_user_progress_user",
      "userId",
      "users",
      "id",
      "CASCADE",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "user_progress",
      "FK_user_progress_lesson",
      "lessonId",
      "lessons",
      "id",
      "CASCADE",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "user_activity_logs",
      "FK_user_activity_logs_user",
      "userId",
      "users",
      "id",
      "SET NULL",
    );
  }

  private async addForeignKeyIfMissing(
    queryRunner: QueryRunner,
    table: string,
    constraint: string,
    column: string,
    targetTable: string,
    targetColumn: string,
    onDelete: string,
  ) {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = '${constraint}' AND table_name = '${table}'
        ) THEN
          ALTER TABLE "${table}"
          ADD CONSTRAINT "${constraint}"
          FOREIGN KEY ("${column}") REFERENCES "${targetTable}"("${targetColumn}") ON DELETE ${onDelete};
        END IF;
      END $$;
    `);
  }
}
