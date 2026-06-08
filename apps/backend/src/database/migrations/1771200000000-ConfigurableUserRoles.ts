import { MigrationInterface, QueryRunner } from "typeorm";

export class ConfigurableUserRoles1771200000000 implements MigrationInterface {
  name = "ConfigurableUserRoles1771200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(80) USING "role"::text',
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CITIZEN'`,
    );
    await queryRunner.query('DROP TYPE IF EXISTS "public"."users_role_enum"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('CITIZEN', 'MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN')`,
    );
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT',
    );
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'CITIZEN' WHERE "role" NOT IN ('CITIZEN', 'MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN')`,
    );
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"public"."users_role_enum"',
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CITIZEN'`,
    );
  }
}
