import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentFrequencies1736346561000 implements MigrationInterface {
  name = 'AddPaymentFrequencies1736346561000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new payment frequency enum values
    await queryRunner.query(
      `ALTER TYPE "public"."payment_frequency_enum" ADD VALUE IF NOT EXISTS 'WEEKLY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payment_frequency_enum" ADD VALUE IF NOT EXISTS 'BIWEEKLY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payment_frequency_enum" ADD VALUE IF NOT EXISTS 'QUARTERLY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payment_frequency_enum" ADD VALUE IF NOT EXISTS 'YEARLY'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values directly
    // This would require recreating the enum type, which is complex
    // For now, we'll leave the enum values in place
    // If needed, a more complex migration can be created to handle this
    // Enum values will remain in the database but won't be used in the application
  }
}
