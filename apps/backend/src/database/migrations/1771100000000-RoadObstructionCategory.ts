import { MigrationInterface, QueryRunner } from "typeorm";

export class RoadObstructionCategory1771100000000
  implements MigrationInterface
{
  name = "RoadObstructionCategory1771100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "reports_category_enum" ADD VALUE IF NOT EXISTS 'ROAD_OBSTRUCTION'`,
    );
    await queryRunner.query(
      `ALTER TYPE "emergency_call_logs_category_enum" ADD VALUE IF NOT EXISTS 'ROAD_OBSTRUCTION'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot safely remove enum values without recreating the type.
  }
}
