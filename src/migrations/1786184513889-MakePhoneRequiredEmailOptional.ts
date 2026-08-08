import { MigrationInterface, QueryRunner } from "typeorm";

export class MakePhoneRequiredEmailOptional1786184513889 implements MigrationInterface {
    name = 'MakePhoneRequiredEmailOptional1786184513889'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
        // Populate existing null phone numbers with a placeholder to satisfy NOT NULL constraint
        await queryRunner.query(`UPDATE "users" SET "phone" = concat('+000', left(md5(random()::text), 8)) WHERE "phone" IS NULL`);
        await queryRunner.query(`UPDATE "tenant_profiles" SET "phone" = concat('+000', left(md5(random()::text), 8)) WHERE "phone" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone")`);
        await queryRunner.query(`ALTER TABLE "tenant_profiles" ALTER COLUMN "phone" SET NOT NULL`);
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
        await queryRunner.query(`ALTER TABLE "tenant_profiles" ALTER COLUMN "phone" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_a000cca60bcf04454e727699490"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
    }

}
