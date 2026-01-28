import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanySettings1769512000000 implements MigrationInterface {
  name = 'CreateCompanySettings1769512000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."company_settings_defaultlatefeetype_enum" AS ENUM('FIXED', 'PERCENTAGE', 'NONE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_settings_defaultinvitedrole_enum" AS ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'LANDLORD', 'STAFF', 'TENANT')`,
    );

    await queryRunner.query(
      `CREATE TABLE "company_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "timezone" character varying NOT NULL DEFAULT 'UTC',
        "defaultCurrency" character varying NOT NULL DEFAULT 'KES',
        "defaultGracePeriodDays" integer NOT NULL DEFAULT 0,
        "defaultLateFeeType" "public"."company_settings_defaultlatefeetype_enum" NOT NULL DEFAULT 'FIXED',
        "defaultLateFeeValue" numeric(10,2) NOT NULL DEFAULT 0,
        "defaultInvitedRole" "public"."company_settings_defaultinvitedrole_enum" NOT NULL DEFAULT 'TENANT',
        "staffCanRecordPayments" boolean NOT NULL DEFAULT true,
        "staffCanApprovePayments" boolean NOT NULL DEFAULT false,
        "staffCanInviteTenants" boolean NOT NULL DEFAULT false,
        "allowedPaymentMethods" json NOT NULL DEFAULT '["CASH","BANK","MPESA","CARD","CHECK","OTHER"]',
        "requirePaymentApproval" boolean NOT NULL DEFAULT false,
        "allowPartialPayments" boolean NOT NULL DEFAULT true,
        "requirePaymentReference" boolean NOT NULL DEFAULT false,
        "defaultEmailNotifications" boolean NOT NULL DEFAULT true,
        "defaultSmsNotifications" boolean NOT NULL DEFAULT true,
        "autoGenerateRentCycles" boolean NOT NULL DEFAULT true,
        "autoApplyCredit" boolean NOT NULL DEFAULT true,
        "autoApplyLateFees" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_settings_company" UNIQUE ("companyId")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD CONSTRAINT "FK_company_settings_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_company_settings_companyId" ON "company_settings" ("companyId")`,
    );

    await queryRunner.query(
      `INSERT INTO "company_settings" ("companyId")
       SELECT "id" FROM "companies"
       WHERE NOT EXISTS (
         SELECT 1 FROM "company_settings" cs WHERE cs."companyId" = "companies"."id"
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_settings_companyId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP CONSTRAINT IF EXISTS "FK_company_settings_company"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "company_settings"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."company_settings_defaultinvitedrole_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."company_settings_defaultlatefeetype_enum"`,
    );
  }
}
