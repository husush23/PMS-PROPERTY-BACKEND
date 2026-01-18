import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdjustRentCycleInvoiceNumberUniqueness1769000000000
  implements MigrationInterface
{
  name = 'AdjustRentCycleInvoiceNumberUniqueness1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_rent_cycles_invoice_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_rent_cycles_company_invoice_number" UNIQUE ("companyId", "invoiceNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" DROP CONSTRAINT IF EXISTS "UQ_rent_cycles_company_invoice_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_rent_cycles_invoice_number" UNIQUE ("invoiceNumber")`,
    );
  }
}
