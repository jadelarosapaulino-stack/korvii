import { MigrationInterface, QueryRunner } from "typeorm";

export class Institutions1768862000000 implements MigrationInterface {
  name = "Institutions1768862000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "institutions_type_enum" AS ENUM ('GOVERNMENT', 'MUNICIPALITY', 'TRANSIT_AUTHORITY', 'EMERGENCY', 'INSURANCE', 'NGO', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "institutions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(160) NOT NULL,
        "type" "institutions_type_enum" NOT NULL DEFAULT 'OTHER',
        "province" character varying(80),
        "municipality" character varying(80),
        "coverageArea" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_institutions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_institutions_name" ON "institutions" ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "institutionId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "institutionRole" character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assignedInstitutionId" uuid`,
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "users",
      "FK_users_institution",
      "institutionId",
      "institutions",
      "id",
      "SET NULL",
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      "reports",
      "FK_reports_assignedInstitution",
      "assignedInstitutionId",
      "institutions",
      "id",
      "SET NULL",
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_institution" ON "users" ("institutionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_assigned_institution" ON "reports" ("assignedInstitutionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reports_assigned_institution"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_institution"`);
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "FK_reports_assignedInstitution"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_institution"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "assignedInstitutionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "institutionRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "institutionId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "institutions" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "institutions_type_enum"`);
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
