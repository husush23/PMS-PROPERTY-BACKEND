import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodsAndSettingsFields1769605000000
  implements MigrationInterface
{
  name = 'AddPaymentMethodsAndSettingsFields1769605000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid,
        "name" character varying(120) NOT NULL,
        "code" character varying(60),
        "isGlobal" boolean NOT NULL DEFAULT false,
        "providerName" character varying(120),
        "instructions" text,
        "requiresReference" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_methods_companyId" ON "payment_methods" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_methods_isGlobal" ON "payment_methods" ("isGlobal")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_methods_global_code" ON "payment_methods" ("code") WHERE "isGlobal" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_methods_company_name" ON "payment_methods" ("companyId", "name") WHERE "companyId" IS NOT NULL`,
    );

    await queryRunner.query(
      `INSERT INTO "payment_methods" ("name", "code", "isGlobal", "requiresReference")
       SELECT * FROM (VALUES
         ('Cash', 'CASH', true, false),
         ('Bank Transfer', 'BANK', true, true),
         ('Cheque', 'CHECK', true, true),
         ('Card', 'CARD', true, false),
         ('M-Pesa', 'MPESA', true, true),
         ('Other', 'OTHER', true, false),
         ('Credit', 'CREDIT', true, false)
       ) AS v(name, code, "isGlobal", "requiresReference")
       WHERE NOT EXISTS (
         SELECT 1 FROM "payment_methods" pm
         WHERE pm."isGlobal" = true AND pm."code" = v.code
       )`,
    );

    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentMethodId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_paymentMethodId" ON "payments" ("paymentMethodId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_paymentMethod" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `UPDATE "payments" p
       SET "paymentMethodId" = pm."id"
       FROM "payment_methods" pm
       WHERE pm."isGlobal" = true
         AND pm."code" = p."paymentMethod"::text
         AND p."paymentMethodId" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "allowAdvancePayments" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "lateFeeEnabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_paymentMethod"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payments_paymentMethodId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "paymentMethodId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_payment_methods_company_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_payment_methods_global_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_methods_isGlobal"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_methods_companyId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_methods"`);

    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "allowAdvancePayments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "lateFeeEnabled"`,
    );
  }
}
