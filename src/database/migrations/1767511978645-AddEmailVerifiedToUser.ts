import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerifiedToUser1767511978645 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add emailVerified column to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerified" boolean NOT NULL DEFAULT false`,
    );

    // Set existing active users to verified (backward compatibility)
    // Assuming active users were already verified
    await queryRunner.query(
      `UPDATE "users" SET "emailVerified" = true WHERE "isActive" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove emailVerified column
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerified"`,
    );
  }
}

