import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportAiAnalysis1771000000000 implements MigrationInterface {
  name = "ReportAiAnalysis1771000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiAnalysisStatus" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiSummary" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiSuggestedCategory" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiRiskScore" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiPriority" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiSuggestedInstitution" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiConfidence" numeric(4,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiRationale" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiAnalysisError" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "aiProcessedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_ai_analysis_status" ON "reports" ("aiAnalysisStatus")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reports_ai_analysis_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiProcessedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiAnalysisError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiRationale"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiConfidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiSuggestedInstitution"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiPriority"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiRiskScore"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiSuggestedCategory"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiSummary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN IF EXISTS "aiAnalysisStatus"`,
    );
  }
}
