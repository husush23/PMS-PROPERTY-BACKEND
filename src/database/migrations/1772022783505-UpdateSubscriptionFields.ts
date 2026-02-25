import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSubscriptionFields1772022783505 implements MigrationInterface {
    name = 'UpdateSubscriptionFields1772022783505'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_revoked_refresh_tokens_jti"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" RENAME COLUMN "billingCycle" TO "planType"`);
        await queryRunner.query(`ALTER TYPE "public"."subscriptions_billingcycle_enum" RENAME TO "subscriptions_plantype_enum"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "paymentDate"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "periodStart" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "periodEnd" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "referenceNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "proofImageUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "recordedBy" character varying`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "recordedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TYPE "public"."subscriptions_status_enum" RENAME TO "subscriptions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('TRIAL', 'ACTIVE', 'EXPIRED')`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "public"."subscriptions_status_enum" USING "status"::"text"::"public"."subscriptions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'TRIAL'`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."expenses_category_enum" RENAME TO "expenses_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."expenses_category_enum" AS ENUM('MAINTENANCE', 'UTILITIES', 'TAX', 'REPAIR', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "public"."expenses_category_enum" USING "category"::"text"::"public"."expenses_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_category_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_account_enum" RENAME TO "accounting_entries_account_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_account_enum" AS ENUM('RENT_INCOME', 'TENANT_CREDIT_LIABILITY', 'SECURITY_DEPOSIT_LIABILITY', 'CASH', 'FEES_INCOME')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "account" TYPE "public"."accounting_entries_account_enum" USING "account"::"text"::"public"."accounting_entries_account_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_account_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_direction_enum" RENAME TO "accounting_entries_direction_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_direction_enum" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "direction" TYPE "public"."accounting_entries_direction_enum" USING "direction"::"text"::"public"."accounting_entries_direction_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_direction_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_direction_enum_old" AS ENUM('CREDIT', 'DEBIT')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "direction" TYPE "public"."accounting_entries_direction_enum_old" USING "direction"::"text"::"public"."accounting_entries_direction_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_direction_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_direction_enum_old" RENAME TO "accounting_entries_direction_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_account_enum_old" AS ENUM('CASH', 'FEES_INCOME', 'RENT_INCOME', 'SECURITY_DEPOSIT_LIABILITY', 'TENANT_CREDIT_LIABILITY')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "account" TYPE "public"."accounting_entries_account_enum_old" USING "account"::"text"::"public"."accounting_entries_account_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_account_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_account_enum_old" RENAME TO "accounting_entries_account_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."expenses_category_enum_old" AS ENUM('MAINTENANCE', 'OTHER', 'REPAIR', 'TAX', 'UTILITIES')`);
        await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "public"."expenses_category_enum_old" USING "category"::"text"::"public"."expenses_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."expenses_category_enum_old" RENAME TO "expenses_category_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum_old" AS ENUM('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE', 'TRIAL')`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "public"."subscriptions_status_enum_old" USING "status"::"text"::"public"."subscriptions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'TRIAL'`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."subscriptions_status_enum_old" RENAME TO "subscriptions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "recordedAt"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "recordedBy"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "proofImageUrl"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "referenceNumber"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "periodEnd"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" DROP COLUMN "periodStart"`);
        await queryRunner.query(`ALTER TABLE "subscription_payments" ADD "paymentDate" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."subscriptions_plantype_enum" RENAME TO "subscriptions_billingcycle_enum"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" RENAME COLUMN "planType" TO "billingCycle"`);
        await queryRunner.query(`CREATE INDEX "IDX_revoked_refresh_tokens_jti" ON "revoked_refresh_tokens" ("jti") `);
    }

}
