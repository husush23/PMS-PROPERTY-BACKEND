import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingEntryIndexes1769004000000
  implements MigrationInterface
{
  name = 'AddAccountingEntryIndexes1769004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_entries_companyId" ON "accounting_entries" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_entries_leaseId" ON "accounting_entries" ("leaseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_entries_tenantId" ON "accounting_entries" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_entries_entryDate" ON "accounting_entries" ("entryDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_entries_reference" ON "accounting_entries" ("referenceType", "referenceId")`,
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
  }
}
