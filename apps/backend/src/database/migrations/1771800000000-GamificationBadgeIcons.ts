import { MigrationInterface, QueryRunner } from "typeorm";

export class GamificationBadgeIcons1771800000000
  implements MigrationInterface
{
  name = "GamificationBadgeIcons1771800000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gamification_settings" ADD COLUMN IF NOT EXISTS "icon" character varying(60)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gamification_settings" DROP COLUMN IF EXISTS "icon"`,
    );
  }
}
