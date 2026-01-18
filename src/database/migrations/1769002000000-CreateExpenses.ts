import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpenses1769002000000 implements MigrationInterface {
  name = 'CreateExpenses1769002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."expenses_category_enum" AS ENUM('MAINTENANCE', 'UTILITIES', 'TAX', 'REPAIR', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "propertyId" uuid,
        "leaseId" uuid,
        "category" "public"."expenses_category_enum" NOT NULL,
        "description" text,
        "amount" numeric(10,2) NOT NULL,
        "expenseDate" date NOT NULL,
        "createdBy" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_expenses" PRIMARY KEY ("id"),
        CONSTRAINT "CK_expenses_amount_positive" CHECK ("amount" > 0)
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_expenses_companyId" ON "expenses" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expenses_propertyId" ON "expenses" ("propertyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expenses_leaseId" ON "expenses" ("leaseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expenses_category" ON "expenses" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expenses_expenseDate" ON "expenses" ("expenseDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_expenseDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_leaseId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_propertyId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_companyId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."expenses_category_enum"`,
    );
  }
}
