import { MigrationInterface, QueryRunner } from "typeorm";

export class TrafficLightLocationRefresh1771600000000
  implements MigrationInterface
{
  name = "TrafficLightLocationRefresh1771600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "traffic_lights" ADD COLUMN IF NOT EXISTS "locationDetailsRefreshedAt" timestamp`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_traffic_lights_location_refreshed" ON "traffic_lights" ("locationDetailsRefreshedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_traffic_lights_location_refreshed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "traffic_lights" DROP COLUMN IF EXISTS "locationDetailsRefreshedAt"`,
    );
  }
}
