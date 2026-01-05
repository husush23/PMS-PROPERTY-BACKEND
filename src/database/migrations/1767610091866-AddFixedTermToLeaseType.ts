import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFixedTermToLeaseType1767610091866
  implements MigrationInterface
{
  name = 'AddFixedTermToLeaseType1767610091866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add FIXED_TERM to leases_leasetype_enum
    await queryRunner.query(
      `ALTER TYPE "public"."leases_leasetype_enum" ADD VALUE IF NOT EXISTS 'FIXED_TERM'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum type, which is complex
    // For now, we'll leave the enum value in place
    // If needed, this can be handled manually or through a more complex migration
  }
}

