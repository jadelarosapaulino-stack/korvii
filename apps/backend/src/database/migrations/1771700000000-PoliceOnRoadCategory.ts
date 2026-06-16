import { MigrationInterface, QueryRunner } from "typeorm";

export class PoliceOnRoadCategory1771700000000 implements MigrationInterface {
  name = "PoliceOnRoadCategory1771700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "reports_category_enum" ADD VALUE IF NOT EXISTS 'POLICE_ON_ROAD'`,
    );
    await queryRunner.query(
      `ALTER TYPE "emergency_call_logs_category_enum" ADD VALUE IF NOT EXISTS 'POLICE_ON_ROAD'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot safely remove enum values without recreating the type.
  }
}
