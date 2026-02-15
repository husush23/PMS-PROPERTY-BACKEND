import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCashierRole1771100000001 implements MigrationInterface {
    name = 'AddCashierRole1771100000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // We use the trick of committing the current transaction to run ALTER TYPE
        // because ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
        // Note: This assumes the migration is running inside a transaction (default behavior).
        await queryRunner.commitTransaction();
        await queryRunner.startTransaction();

        try {
            await queryRunner.query(`ALTER TYPE "public"."user_companies_role_enum" ADD VALUE IF NOT EXISTS 'CASHIER'`);
        } catch (e) {
            // Ignore if already exists (IF NOT EXISTS should handle it but consistent behavior across versions varies)
        }

        try {
            await queryRunner.query(`ALTER TYPE "public"."company_invitations_role_enum" ADD VALUE IF NOT EXISTS 'CASHIER'`);
        } catch (e) {
            // Ignore
        }

        // Commit the ALTER TYPE changes
        await queryRunner.commitTransaction();

        // Restart transaction for TypeORM management
        await queryRunner.startTransaction();
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Removing enum values is not supported natively in a simple way in Postgres.
        // Leaving it as is.
    }
}
