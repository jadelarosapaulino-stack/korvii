import { MigrationInterface, QueryRunner } from "typeorm";

export class RoadTelemetryEvents1768863000000 implements MigrationInterface {
  name = "RoadTelemetryEvents1768863000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "road_telemetry_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" character varying(30) NOT NULL,
        "latitude" numeric(10,7) NOT NULL,
        "longitude" numeric(10,7) NOT NULL,
        "accelerationMagnitude" double precision,
        "speedBeforeKmh" double precision,
        "speedAfterKmh" double precision,
        "accuracyMeters" double precision,
        "riskLevel" integer NOT NULL DEFAULT 0,
        "source" character varying(40) NOT NULL DEFAULT 'mobile-road-telemetry',
        "userId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_road_telemetry_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_road_telemetry_event_time" ON "road_telemetry_events" ("eventType", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_road_telemetry_location" ON "road_telemetry_events" ("latitude", "longitude")`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_road_telemetry_user' AND table_name = 'road_telemetry_events'
        ) THEN
          ALTER TABLE "road_telemetry_events"
          ADD CONSTRAINT "FK_road_telemetry_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "road_telemetry_events" DROP CONSTRAINT IF EXISTS "FK_road_telemetry_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_road_telemetry_location"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_road_telemetry_event_time"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "road_telemetry_events"`);
  }
}
