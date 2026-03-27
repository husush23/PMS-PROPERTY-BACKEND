import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRentCycleCategory1772120000000
  implements MigrationInterface
{
  name = 'AddRentCycleCategory1772120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rent_cycle_category_enum" AS ENUM('RENT', 'DEPOSIT', 'UTILITY')`,
    );

    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD "category" "public"."rent_cycle_category_enum" NOT NULL DEFAULT 'RENT'`,
    );

    // Backfill deposit invoices
    await queryRunner.query(
      `UPDATE "rent_cycles" SET "category" = 'DEPOSIT' WHERE "isDeposit" = true`,
    );

    // Replace old uniqueness (leaseId, period) with (leaseId, period, category)
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_rent_cycles_lease_period"`,
    );

    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_rent_cycles_lease_period_category" UNIQUE ("leaseId", "period", "category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_rent_cycles_lease_period_category"`,
    );

    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_rent_cycles_lease_period" UNIQUE ("leaseId", "period")`,
    );

    await queryRunner.query(`ALTER TABLE "rent_cycles" DROP COLUMN IF EXISTS "category"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."rent_cycle_category_enum"`,
    );
  }
}

