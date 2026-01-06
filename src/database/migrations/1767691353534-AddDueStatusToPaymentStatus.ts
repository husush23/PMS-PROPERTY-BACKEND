import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDueStatusToPaymentStatus1767691353534
  implements MigrationInterface
{
  name = 'AddDueStatusToPaymentStatus1767691353534';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add DUE value to payments_status_enum
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'DUE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values easily
    // The DUE value will remain in the enum but unused
    // This is a limitation of PostgreSQL enums
  }
}

