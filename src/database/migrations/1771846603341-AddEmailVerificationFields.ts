import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerificationFields1771846603341 implements MigrationInterface {
    name = 'AddEmailVerificationFields1771846603341'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationToken" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationExpires" TIMESTAMP`);
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
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_direction_enum_old" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "direction" TYPE "public"."accounting_entries_direction_enum_old" USING "direction"::"text"::"public"."accounting_entries_direction_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_direction_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_direction_enum_old" RENAME TO "accounting_entries_direction_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_entries_account_enum_old" AS ENUM('RENT_INCOME', 'TENANT_CREDIT_LIABILITY', 'SECURITY_DEPOSIT_LIABILITY', 'CASH', 'FEES_INCOME')`);
        await queryRunner.query(`ALTER TABLE "accounting_entries" ALTER COLUMN "account" TYPE "public"."accounting_entries_account_enum_old" USING "account"::"text"::"public"."accounting_entries_account_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_entries_account_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_entries_account_enum_old" RENAME TO "accounting_entries_account_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."expenses_category_enum_old" AS ENUM('MAINTENANCE', 'UTILITIES', 'TAX', 'REPAIR', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "public"."expenses_category_enum_old" USING "category"::"text"::"public"."expenses_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."expenses_category_enum_old" RENAME TO "expenses_category_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationToken"`);
    }

}
