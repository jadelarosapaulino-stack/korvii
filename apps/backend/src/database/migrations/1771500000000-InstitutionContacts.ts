import { MigrationInterface, QueryRunner } from "typeorm";

export class InstitutionContacts1771500000000 implements MigrationInterface {
  name = "InstitutionContacts1771500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "phone" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "emergencyPhone" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "whatsapp" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "email" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "websiteUrl" character varying(250)`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "sourceUrl" character varying(250)`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "address" character varying(220)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "sourceUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "websiteUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "whatsapp"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "emergencyPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institutions" DROP COLUMN IF EXISTS "phone"`,
    );
  }
}
