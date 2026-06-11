import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemConfigDb1771400000000 implements MigrationInterface {
  name = "SystemConfigDb1771400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "system_config" ("key" character varying(80) NOT NULL, "value" jsonb NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_system_config_key" PRIMARY KEY ("key"))',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "system_config"');
  }
}
