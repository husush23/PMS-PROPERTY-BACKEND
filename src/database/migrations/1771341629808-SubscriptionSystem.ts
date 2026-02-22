import { MigrationInterface, QueryRunner } from "typeorm";

export class SubscriptionSystem1771341629808 implements MigrationInterface {
    name = 'SubscriptionSystem1771341629808'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_companies_slug"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_companies_user_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_reset_password_token"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leases_company_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_rent_cycle_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_rent_cycles_lookup_v2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_company_settings_company_id"`);
        await queryRunner.query(`CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "monthlyPrice" numeric(10,2) NOT NULL, "yearlyPrice" numeric(10,2) NOT NULL, "features" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_253d25dae4c94ee913bc5ec4850" UNIQUE ("name"), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."subscription_payments_paymentmethod_enum" AS ENUM('MANUAL', 'STRIPE')`);
        await queryRunner.query(`CREATE TYPE "public"."subscription_payments_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "subscription_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscriptionId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'USD', "paymentDate" TIMESTAMP NOT NULL, "paymentMethod" "public"."subscription_payments_paymentmethod_enum" NOT NULL DEFAULT 'MANUAL', "transactionId" character varying, "invoiceUrl" character varying, "status" "public"."subscription_payments_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1b7a76365fd477de59cba0ab957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_billingcycle_enum" AS ENUM('MONTHLY', 'YEARLY')`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "planId" uuid NOT NULL, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'TRIAL', "billingCycle" "public"."subscriptions_billingcycle_enum" NOT NULL DEFAULT 'MONTHLY', "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "trialEndsAt" TIMESTAMP, "autoRenew" boolean NOT NULL DEFAULT true, "lastPaymentDate" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."expenses_category_enum" RENAME TO "expenses_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."expenses_category_enum" AS ENUM('MAINTENANCE', 'UTILITIES', 'TAX', 'REPAIR', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "public"."expenses_category_enum" USING "category"::"text"::"public"."expenses_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_category_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."company_settings_defaultinvitedrole_enum" RENAME TO "company_settings_defaultinvitedrole_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."company_settings_defaultinvitedrole_enum" AS ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'LANDLORD', 'STAFF', 'TENANT', 'CASHIER')`);
        await queryRunner.query(`ALTER TABLE "company_settings" ALTER COLUMN "defaultInvitedRole" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "company_settings" ALTER COLUMN "defaultInvitedRole" TYPE "public"."company_settings_defaultinvitedrole_enum" USING "defaultInvitedRole"::"text"::"public"."company_settings_defaultinvitedrole_enum"`);
        await queryRunner.query(`ALTER TABLE "company_settings" ALTER COLUMN "defaultInvitedRole" SET DEFAULT 'TENANT'`);
        await queryRunner.query(`DROP TYPE "public"."company_settings_defaultinvitedrole_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_account_enum" RENAME TO "accounting_entries_account_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_account_enum" AS ENUM('RENT_INCOME', 'TENANT_CREDIT_LIABILITY', 'SECURITY_DEPOSIT_LIABILITY', 'CASH', 'FEES_INCOME')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "account" TYPE "public"."accounting_entries_account_enum" USING "account"::"text"::"public"."accounting_entries_account_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_account_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_direction_enum" RENAME TO "accounting_entries_direction_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_direction_enum" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "direction" TYPE "public"."accounting_entries_direction_enum" USING "direction"::"text"::"public"."accounting_entries_direction_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_direction_enum_old"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD CONSTRAINT "FK_b71c34361d0308a49ceed66d63b" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_ea19a7bd47edc90d4f1f6f6f312" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_7536cba909dd7584a4640cad7d5" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_7536cba909dd7584a4640cad7d5"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_ea19a7bd47edc90d4f1f6f6f312"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP CONSTRAINT "FK_b71c34361d0308a49ceed66d63b"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_direction_enum_old" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "direction" TYPE "public"."accounting_entries_direction_enum_old" USING "direction"::"text"::"public"."accounting_entries_direction_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_direction_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_direction_enum_old" RENAME TO "accounting_entries_direction_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_account_enum_old" AS ENUM('RENT_INCOME', 'TENANT_CREDIT_LIABILITY', 'SECURITY_DEPOSIT_LIABILITY', 'CASH', 'FEES_INCOME')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "account" TYPE "public"."accounting_entries_account_enum_old" USING "account"::"text"::"public"."accounting_entries_account_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_account_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_account_enum_old" RENAME TO "accounting_entries_account_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."company_settings_defaultinvitedrole_enum_old" AS ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'LANDLORD', 'STAFF', 'TENANT')`);
        await queryRunner.query(`ALTER TABLE "company_settings" ALTER COLUMN "defaultInvitedRole" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "company_settings" ALTER COLUMN "defaultInvitedRole" TYPE "public"."company_settings_defaultinvitedrole_enum_old" USING "defaultInvitedRole"::"text"::"public"."company_settings_defaultinvitedrole_enum_old"`);
        await queryRunner.query(`ALTER TABLE "company_settings" ALTER COLUMN "defaultInvitedRole" SET DEFAULT 'TENANT'`);
        await queryRunner.query(`DROP TYPE "public"."company_settings_defaultinvitedrole_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."company_settings_defaultinvitedrole_enum_old" RENAME TO "company_settings_defaultinvitedrole_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."expenses_category_enum_old" AS ENUM('MAINTENANCE', 'UTILITIES', 'TAX', 'REPAIR', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "public"."expenses_category_enum_old" USING "category"::"text"::"public"."expenses_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."expenses_category_enum_old" RENAME TO "expenses_category_enum"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_billingcycle_enum"`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
        await queryRunner.query(`DROP TABLE "subscription_payments"`);
        await queryRunner.query(`DROP TYPE "public"."subscription_payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."subscription_payments_paymentmethod_enum"`);
        await queryRunner.query(`DROP TABLE "plans"`);
        await queryRunner.query(`CREATE INDEX "IDX_company_settings_company_id" ON "company_settings" ("companyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_rent_cycles_lookup_v2" ON "rent_cycles" ("companyId", "dueDate", "isDeposit", "isVoid") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_rent_cycle_active" ON "payments" ("isActive", "rentCycleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_leases_company_active" ON "leases" ("companyId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_users_reset_password_token" ON "users" ("resetPasswordToken") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_companies_user_active" ON "user_companies" ("isActive", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_companies_slug" ON "companies" ("slug") `);
    }

}
