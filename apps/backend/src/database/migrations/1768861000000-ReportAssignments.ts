import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportAssignments1768861000000 implements MigrationInterface {
  name = "ReportAssignments1768861000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assignedToId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assignmentNote" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_reports_assignedTo' AND table_name = 'reports'
        ) THEN
          ALTER TABLE "reports"
          ADD CONSTRAINT "FK_reports_assignedTo"
          FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_assigned_to" ON "reports" ("assignedToId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_assigned_to"`);
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "FK_reports_assignedTo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "assignedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "assignmentNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "assignedToId"`,
    );
  }
}
