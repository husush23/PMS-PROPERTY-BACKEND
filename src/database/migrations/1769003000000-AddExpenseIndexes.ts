import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpenseIndexes1769003000000 implements MigrationInterface {
  name = 'AddExpenseIndexes1769003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_expenses_companyId" ON "expenses" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_expenses_companyId_expenseDate" ON "expenses" ("companyId", "expenseDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_expenses_leaseId" ON "expenses" ("leaseId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_expenses_leaseId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_expenses_companyId_expenseDate"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_expenses_companyId"`,
    );
  }
}
