import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditBalanceToLease1768001234567
  implements MigrationInterface
{
  name = 'AddCreditBalanceToLease1768001234567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leases" ADD "creditBalance" numeric(10,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_paymentmethod_enum" ADD VALUE IF NOT EXISTS 'CREDIT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leases" DROP COLUMN "creditBalance"`);
  }
}
