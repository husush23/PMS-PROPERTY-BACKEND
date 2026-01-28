import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLeaseDefaultsFromCompanySettings1769800000000
  implements MigrationInterface
{
  name = 'RemoveLeaseDefaultsFromCompanySettings1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "defaultPaymentFrequency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "defaultRentDueDay"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "defaultLeaseTerm"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "defaultProratedFirstMonth"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."company_settings_defaultpaymentfrequency_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."company_settings_defaultpaymentfrequency_enum" AS ENUM('MONTHLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD COLUMN "defaultPaymentFrequency" "public"."company_settings_defaultpaymentfrequency_enum" NOT NULL DEFAULT 'MONTHLY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD COLUMN "defaultRentDueDay" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD COLUMN "defaultLeaseTerm" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD COLUMN "defaultProratedFirstMonth" boolean NOT NULL DEFAULT false`,
    );
  }
}
