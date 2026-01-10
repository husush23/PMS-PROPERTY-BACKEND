import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPeriodBoundariesToRentCycle1767989719322
  implements MigrationInterface
{
  name = 'AddPeriodBoundariesToRentCycle1767989719322';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add periodStartDate column
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD COLUMN IF NOT EXISTS "periodStartDate" date NULL`,
    );

    // Add periodEndDate column
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD COLUMN IF NOT EXISTS "periodEndDate" date NULL`,
    );

    // Add isDeposit column
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD COLUMN IF NOT EXISTS "isDeposit" boolean NOT NULL DEFAULT false`,
    );

    // Add isVoid column
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD COLUMN IF NOT EXISTS "isVoid" boolean NOT NULL DEFAULT false`,
    );

    // Add voidReason column
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD COLUMN IF NOT EXISTS "voidReason" text NULL`,
    );

    // Backfill existing records: Calculate period boundaries from dueDate and period
    // For existing records, set periodStartDate to dueDate (or first of month for monthly)
    // and periodEndDate to one period after periodStartDate
    await queryRunner.query(
      `UPDATE "rent_cycles" 
       SET "periodStartDate" = 
         CASE 
           WHEN "period" ~ '^\\d{4}-\\d{2}$' THEN 
             -- Monthly: First day of the month
             DATE_TRUNC('month', "dueDate")::date
           ELSE 
             -- Other frequencies: Use dueDate as period start
             "dueDate"
         END,
       "periodEndDate" = 
         CASE 
           WHEN "period" ~ '^\\d{4}-\\d{2}$' THEN 
             -- Monthly: Last day of the month
             (DATE_TRUNC('month', "dueDate") + INTERVAL '1 month' - INTERVAL '1 day')::date
           ELSE 
             -- Other frequencies: Add appropriate period (default to 1 month)
             ("dueDate" + INTERVAL '1 month')::date
         END
       WHERE "periodStartDate" IS NULL OR "periodEndDate" IS NULL`,
    );

    // Note: We keep columns nullable for backward compatibility, but new records should always have these set
    // isDeposit and isVoid default to false for existing records
    // voidReason is nullable and remains NULL for existing records
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all added columns
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" 
       DROP COLUMN IF EXISTS "voidReason",
       DROP COLUMN IF EXISTS "isVoid",
       DROP COLUMN IF EXISTS "isDeposit",
       DROP COLUMN IF EXISTS "periodEndDate",
       DROP COLUMN IF EXISTS "periodStartDate"`,
    );
  }
}
