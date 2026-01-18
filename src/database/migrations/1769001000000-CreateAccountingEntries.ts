import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountingEntries1769001000000
  implements MigrationInterface
{
  name = 'CreateAccountingEntries1769001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."accounting_entries_account_enum" AS ENUM('RENT_INCOME', 'TENANT_CREDIT_LIABILITY', 'SECURITY_DEPOSIT_LIABILITY', 'CASH', 'FEES_INCOME')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accounting_entries_direction_enum" AS ENUM('DEBIT', 'CREDIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accounting_entries_reference_type_enum" AS ENUM('INVOICE', 'PAYMENT', 'ADJUSTMENT')`,
    );

    await queryRunner.query(
      `CREATE TABLE "accounting_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "leaseId" uuid,
        "tenantId" uuid,
        "account" "public"."accounting_entries_account_enum" NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "direction" "public"."accounting_entries_direction_enum" NOT NULL,
        "referenceType" "public"."accounting_entries_reference_type_enum" NOT NULL,
        "referenceId" uuid NOT NULL,
        "entryDate" date NOT NULL,
        "notes" text,
        CONSTRAINT "PK_accounting_entries" PRIMARY KEY ("id"),
        CONSTRAINT "CK_accounting_entries_amount_positive" CHECK ("amount" > 0)
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_entries_companyId" ON "accounting_entries" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_entries_leaseId" ON "accounting_entries" ("leaseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_entries_tenantId" ON "accounting_entries" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_entries_entryDate" ON "accounting_entries" ("entryDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_entries_reference" ON "accounting_entries" ("referenceType", "referenceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_accounting_entries_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_accounting_entries_entryDate"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_accounting_entries_tenantId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_accounting_entries_leaseId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_accounting_entries_companyId"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_entries"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."accounting_entries_reference_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."accounting_entries_direction_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."accounting_entries_account_enum"`,
    );
  }
}
