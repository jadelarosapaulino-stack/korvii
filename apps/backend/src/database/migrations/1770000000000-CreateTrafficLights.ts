import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrafficLights1770000000000 implements MigrationInterface {
  name = "CreateTrafficLights1770000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "traffic_lights" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "latitude" numeric(10,7) NOT NULL,
        "longitude" numeric(10,7) NOT NULL,
        "province" character varying(80),
        "municipality" character varying(80),
        "intersection" character varying(220),
        "osmId" character varying(40),
        "status" character varying(20) NOT NULL DEFAULT 'unknown',
        "source" character varying(20) NOT NULL DEFAULT 'manual',
        "lastObservedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_traffic_lights_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_traffic_lights_lat_lng" ON "traffic_lights" ("latitude", "longitude")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_traffic_lights_status" ON "traffic_lights" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_traffic_lights_osm_id" ON "traffic_lights" ("osmId") WHERE "osmId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_traffic_lights_osm_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_traffic_lights_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_traffic_lights_lat_lng"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "traffic_lights"`);
  }
}
