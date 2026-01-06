import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRentCycleTables1767717575427
  implements MigrationInterface
{
  name = 'CreateRentCycleTables1767717575427';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create rent_cycle_line_item_type enum
    await queryRunner.query(
      `CREATE TYPE "public"."rent_cycle_line_item_type_enum" AS ENUM('RENT', 'UTILITY', 'PET_RENT', 'MAINTENANCE', 'LATE_FEE')`,
    );

    // Create rent_cycles table
    await queryRunner.query(
      `CREATE TABLE "rent_cycles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "leaseId" uuid NOT NULL,
        "companyId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "invoiceNumber" character varying NOT NULL,
        "period" character varying NOT NULL,
        "dueDate" date NOT NULL,
        "totalAmountDue" numeric(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rent_cycles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rent_cycles_lease_period" UNIQUE ("leaseId", "period"),
        CONSTRAINT "UQ_rent_cycles_invoice_number" UNIQUE ("invoiceNumber")
      )`,
    );

    // Create rent_cycle_line_items table
    await queryRunner.query(
      `CREATE TABLE "rent_cycle_line_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rentCycleId" uuid NOT NULL,
        "type" "public"."rent_cycle_line_item_type_enum" NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "description" text,
        "isLateFee" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_rent_cycle_line_items" PRIMARY KEY ("id")
      )`,
    );

    // Add foreign keys
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD CONSTRAINT "FK_rent_cycles_lease" 
       FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "rent_cycle_line_items" ADD CONSTRAINT "FK_rent_cycle_line_items_rent_cycle" 
       FOREIGN KEY ("rentCycleId") REFERENCES "rent_cycles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Add indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_leaseId" ON "rent_cycles" ("leaseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_companyId" ON "rent_cycles" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_tenantId" ON "rent_cycles" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_period" ON "rent_cycles" ("period")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_dueDate" ON "rent_cycles" ("dueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_company_tenant" ON "rent_cycles" ("companyId", "tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycles_lease_dueDate" ON "rent_cycles" ("leaseId", "dueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rent_cycle_line_items_rentCycleId" ON "rent_cycle_line_items" ("rentCycleId")`,
    );

    // Add rentCycleId and isLegacy columns to payments table
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "rentCycleId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "isLegacy" boolean NOT NULL DEFAULT false`,
    );

    // Add foreign key for rentCycleId
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_rent_cycle" 
       FOREIGN KEY ("rentCycleId") REFERENCES "rent_cycles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // Add index on rentCycleId
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_rentCycleId" ON "payments" ("rentCycleId")`,
    );

    // Mark all existing payments as legacy
    await queryRunner.query(
      `UPDATE "payments" SET "isLegacy" = true WHERE "isLegacy" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_rentCycleId"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_rent_cycle_line_items_rentCycleId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_rent_cycles_lease_dueDate"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_rent_cycles_company_tenant"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_dueDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_period"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_tenantId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_companyId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_leaseId"`);

    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_rent_cycle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycle_line_items" DROP CONSTRAINT IF EXISTS "FK_rent_cycle_line_items_rent_cycle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "FK_rent_cycles_lease"`,
    );

    // Drop columns from payments
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "isLegacy"`);
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "rentCycleId"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "rent_cycle_line_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rent_cycles"`);

    // Drop enum
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."rent_cycle_line_item_type_enum"`,
    );
  }
}

