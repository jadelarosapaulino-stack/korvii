import { MigrationInterface, QueryRunner } from "typeorm";

export class UserMustChangePassword1771300000000
  implements MigrationInterface
{
  name = "UserMustChangePassword1771300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "mustChangePassword" boolean NOT NULL DEFAULT false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "mustChangePassword"',
    );
  }
}
