import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Some environments were created before category-based rent cycle uniqueness
 * and still enforce uniqueness on ("leaseId","period") under an auto-generated
 * constraint name (e.g. UQ_dab5907fc83a860ea083ca1e75e).
 *
 * This migration normalizes the constraint to:
 *   UNIQUE ("leaseId","period","category")
 */
export class FixRentCycleUniquenessLeasePeriodCategory1772500000000
  implements MigrationInterface
{
  name = 'FixRentCycleUniquenessLeasePeriodCategory1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy constraint names (different DBs may use different names).
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_dab5907fc83a860ea083ca1e75e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_rent_cycles_lease_period"`,
    );

    // Ensure correct composite uniqueness exists (idempotent across environments).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_rent_cycles_lease_period_category'
        ) THEN
          ALTER TABLE "rent_cycles"
            ADD CONSTRAINT "UQ_rent_cycles_lease_period_category"
            UNIQUE ("leaseId", "period", "category");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_rent_cycles_lease_period_category"`,
    );

    // Restore the exact legacy constraint name that exists in affected DBs.
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_dab5907fc83a860ea083ca1e75e" UNIQUE ("leaseId", "period")`,
    );
  }
}

