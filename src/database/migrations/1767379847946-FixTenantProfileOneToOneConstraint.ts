import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTenantProfileOneToOneConstraint1767379847946 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint on userId alone that prevents users from being tenants at multiple companies
    // This constraint was created by the @OneToOne relationship which we've changed to @ManyToOne
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" DROP CONSTRAINT "REL_b8a59063604d0b6d659548da5a"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the unique constraint on userId (for rollback purposes)
    // Note: This will fail if there are already multiple tenant profiles for the same user
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" ADD CONSTRAINT "REL_b8a59063604d0b6d659548da5a" UNIQUE ("userId")`,
    );
  }
}
