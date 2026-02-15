import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRLSAndIndexes1771150845352 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- 1. Enable RLS ---
        const tablesWithRLS = [
            "users", "companies", "user_companies", "company_settings",
            "properties", "units",
            "tenant_profiles", "leases",
            "rent_cycles", "rent_cycle_line_items", "payments", "expenses", "accounting_entries", "payment_methods",
            "company_invitations", "tenant_invitations", "revoked_refresh_tokens",
            "migrations", "items"
        ];

        for (const table of tablesWithRLS) {
            await queryRunner.query(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY`); // Check if table exists is implied by migration order usually, but safer to just run it. 
        }

        // --- 2. Create Indexes ---
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_reset_password_token" ON "public"."users" ("resetPasswordToken")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_companies_user_active" ON "public"."user_companies" ("userId", "isActive")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_companies_slug" ON "public"."companies" ("slug")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_rent_cycle_active" ON "public"."payments" ("rentCycleId", "isActive")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_company_settings_company_id" ON "public"."company_settings" ("companyId")`);

        // Remove old index if exists to replace with v2
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_company_status"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_rent_cycles_lookup_v2" ON "public"."rent_cycles" ("companyId", "isVoid", "isDeposit", "dueDate")`);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_leases_company_active" ON "public"."leases" ("companyId", "status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // --- 1. Revert Indexes ---
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leases_company_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rent_cycles_lookup_v2"`);
        // Re-create the old one if we want exact rollback, but for now just dropping the new one is enough.

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_settings_company_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_rent_cycle_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_slug"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_companies_user_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_reset_password_token"`);

        // --- 2. Disable RLS ---
        const tablesWithRLS = [
            "users", "companies", "user_companies", "company_settings",
            "properties", "units",
            "tenant_profiles", "leases",
            "rent_cycles", "rent_cycle_line_items", "payments", "expenses", "accounting_entries", "payment_methods",
            "company_invitations", "tenant_invitations", "revoked_refresh_tokens",
            "migrations", "items"
        ];

        for (const table of tablesWithRLS) {
            await queryRunner.query(`ALTER TABLE "public"."${table}" DISABLE ROW LEVEL SECURITY`);
        }
    }

}
