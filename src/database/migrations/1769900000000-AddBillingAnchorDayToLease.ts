import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingAnchorDayToLease1769900000000
  implements MigrationInterface
{
  name = 'AddBillingAnchorDayToLease1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leases" ADD COLUMN "billingAnchorDay" integer`,
    );
    await queryRunner.query(
      `UPDATE "leases" SET "billingAnchorDay" = EXTRACT(DAY FROM "billingStartDate") WHERE "billingStartDate" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "leases" SET "billingAnchorDay" = EXTRACT(DAY FROM "startDate") WHERE "billingStartDate" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "leases" SET "billingAnchorDay" = 1 WHERE "billingAnchorDay" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ALTER COLUMN "billingAnchorDay" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "leases" ALTER COLUMN "billingAnchorDay" SET DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leases" DROP COLUMN "billingAnchorDay"`,
    );
  }
}
