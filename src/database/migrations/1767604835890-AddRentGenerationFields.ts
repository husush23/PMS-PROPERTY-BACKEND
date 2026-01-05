import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRentGenerationFields1767604835890
  implements MigrationInterface
{
  name = 'AddRentGenerationFields1767604835890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values to payments_status_enum
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'PARTIAL'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'OVERDUE'`,
    );

    // Add FIXED_TERM to leases_leasetype_enum
    await queryRunner.query(
      `ALTER TYPE "public"."leases_leasetype_enum" ADD VALUE IF NOT EXISTS 'FIXED_TERM'`,
    );

    // Create new enums for leases
    await queryRunner.query(
      `CREATE TYPE "public"."payment_frequency_enum" AS ENUM('MONTHLY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."late_fee_type_enum" AS ENUM('FIXED', 'PERCENTAGE', 'NONE')`,
    );

    // Add new fields to leases table
    await queryRunner.query(
      `ALTER TABLE "leases" ADD COLUMN "rentDueDay" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD COLUMN "nextRentDueDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD COLUMN "paymentFrequency" "public"."payment_frequency_enum" NOT NULL DEFAULT 'MONTHLY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD COLUMN "lateFeeType" "public"."late_fee_type_enum" NOT NULL DEFAULT 'FIXED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ADD COLUMN "lateFeeValue" numeric(10,2)`,
    );

    // Add new fields to payments table
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "amountDue" numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "amountPaid" numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "balance" numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "dueDate" date NOT NULL DEFAULT CURRENT_DATE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "paidAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "lateFeeApplied" boolean NOT NULL DEFAULT false`,
    );

    // Update existing payments: set amountDue = amount, amountPaid = amount if status is PAID
    await queryRunner.query(
      `UPDATE "payments" SET "amountDue" = "amount", "amountPaid" = CASE WHEN "status" = 'PAID' THEN "amount" ELSE 0 END, "balance" = CASE WHEN "status" = 'PAID' THEN 0 ELSE "amount" END, "dueDate" = "paymentDate" WHERE "amountDue" = 0`,
    );

    // Set rentDueDay default for existing leases (use day of billingStartDate or 1)
    await queryRunner.query(
      `UPDATE "leases" SET "rentDueDay" = EXTRACT(DAY FROM "billingStartDate") WHERE "billingStartDate" IS NOT NULL AND "rentDueDay" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "leases" SET "rentDueDay" = EXTRACT(DAY FROM "startDate") WHERE "billingStartDate" IS NULL AND "rentDueDay" IS NULL AND "startDate" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "leases" SET "rentDueDay" = 1 WHERE "rentDueDay" IS NULL`,
    );

    // Set lateFeeValue default for existing leases (use lateFeeAmount if set)
    await queryRunner.query(
      `UPDATE "leases" SET "lateFeeValue" = "lateFeeAmount" WHERE "lateFeeAmount" IS NOT NULL AND "lateFeeValue" IS NULL`,
    );

    // Create indexes for new fields
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_dueDate" ON "payments" ("dueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_status_dueDate" ON "payments" ("status", "dueDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_status_dueDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_dueDate"`);

    // Remove columns from payments table
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "lateFeeApplied"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "paidAt"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "dueDate"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "balance"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "amountPaid"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "amountDue"`);

    // Remove columns from leases table
    await queryRunner.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "lateFeeValue"`);
    await queryRunner.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "lateFeeType"`);
    await queryRunner.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "paymentFrequency"`);
    await queryRunner.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "nextRentDueDate"`);
    await queryRunner.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "rentDueDay"`);

    // Drop enums (Note: Cannot easily remove enum values, so we'll leave the enum types)
    // The enum values PARTIAL and OVERDUE will remain but unused
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."late_fee_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payment_frequency_enum"`);
  }
}

