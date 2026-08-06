import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneToUser1786026196585 implements MigrationInterface {
    name = 'AddPhoneToUser1786026196585'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "utility_meters" DROP CONSTRAINT "FK_utility_meters_property"`);
        await queryRunner.query(`ALTER TABLE "utility_meters" DROP CONSTRAINT "FK_utility_meters_unit"`);
        await queryRunner.query(`ALTER TABLE "rent_cycle_line_items" DROP CONSTRAINT "FK_rent_cycle_line_items_utility_reading"`);
        await queryRunner.query(`ALTER TABLE "utility_readings" DROP CONSTRAINT "FK_utility_readings_meter"`);
        await queryRunner.query(`ALTER TABLE "utility_readings" DROP CONSTRAINT "FK_utility_readings_rent_cycle"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_utility_meters_property_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_utility_meters_unit_id"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_rent_cycle_line_items_utility_reading_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_utility_readings_meter_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_utility_readings_meter_date_unique"`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" DROP CONSTRAINT "UQ_rent_cycles_lease_period_category"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."rent_cycle_category_enum" RENAME TO "rent_cycle_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."rent_cycles_category_enum" AS ENUM('RENT', 'DEPOSIT', 'UTILITY')`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ALTER COLUMN "category" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ALTER COLUMN "category" TYPE "public"."rent_cycles_category_enum" USING "category"::"text"::"public"."rent_cycles_category_enum"`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ALTER COLUMN "category" SET DEFAULT 'RENT'`);
        await queryRunner.query(`DROP TYPE "public"."rent_cycle_category_enum_old"`);
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
        await queryRunner.query(`CREATE INDEX "IDX_81c2d741723706bc52ecdd5df3" ON "utility_meters" ("unitId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c79c4f4cfd835c21290dcc8b6a" ON "utility_meters" ("propertyId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fc18bb947d4cc97ad42fcf9b4d" ON "utility_readings" ("meterId", "readingDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e62e3d7d83c7a055a9eae0995" ON "utility_readings" ("meterId") `);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_8fb4dbf223dc7bc62bf1c8d351b" UNIQUE ("leaseId", "period", "category")`);
        await queryRunner.query(`ALTER TABLE "utility_meters" ADD CONSTRAINT "FK_c79c4f4cfd835c21290dcc8b6a8" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utility_meters" ADD CONSTRAINT "FK_81c2d741723706bc52ecdd5df34" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rent_cycle_line_items" ADD CONSTRAINT "FK_a2d8832bb1a8833c005b5c53d34" FOREIGN KEY ("utilityReadingId") REFERENCES "utility_readings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_0e62e3d7d83c7a055a9eae09951" FOREIGN KEY ("meterId") REFERENCES "utility_meters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_18b336038f2d1abf1645590ce04" FOREIGN KEY ("rentCycleId") REFERENCES "rent_cycles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "utility_readings" DROP CONSTRAINT "FK_18b336038f2d1abf1645590ce04"`);
        await queryRunner.query(`ALTER TABLE "utility_readings" DROP CONSTRAINT "FK_0e62e3d7d83c7a055a9eae09951"`);
        await queryRunner.query(`ALTER TABLE "rent_cycle_line_items" DROP CONSTRAINT "FK_a2d8832bb1a8833c005b5c53d34"`);
        await queryRunner.query(`ALTER TABLE "utility_meters" DROP CONSTRAINT "FK_81c2d741723706bc52ecdd5df34"`);
        await queryRunner.query(`ALTER TABLE "utility_meters" DROP CONSTRAINT "FK_c79c4f4cfd835c21290dcc8b6a8"`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" DROP CONSTRAINT "UQ_8fb4dbf223dc7bc62bf1c8d351b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e62e3d7d83c7a055a9eae0995"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc18bb947d4cc97ad42fcf9b4d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c79c4f4cfd835c21290dcc8b6a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81c2d741723706bc52ecdd5df3"`);
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
        await queryRunner.query(`CREATE TYPE "public"."rent_cycle_category_enum_old" AS ENUM('DEPOSIT', 'RENT', 'UTILITY')`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ALTER COLUMN "category" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ALTER COLUMN "category" TYPE "public"."rent_cycle_category_enum_old" USING "category"::"text"::"public"."rent_cycle_category_enum_old"`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ALTER COLUMN "category" SET DEFAULT 'RENT'`);
        await queryRunner.query(`DROP TYPE "public"."rent_cycles_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."rent_cycle_category_enum_old" RENAME TO "rent_cycle_category_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "rent_cycles" ADD CONSTRAINT "UQ_rent_cycles_lease_period_category" UNIQUE ("leaseId", "period", "category")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_utility_readings_meter_date_unique" ON "utility_readings" ("meterId", "readingDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_utility_readings_meter_id" ON "utility_readings" ("meterId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_rent_cycle_line_items_utility_reading_id" ON "rent_cycle_line_items" ("utilityReadingId") WHERE ("utilityReadingId" IS NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_utility_meters_unit_id" ON "utility_meters" ("unitId") `);
        await queryRunner.query(`CREATE INDEX "IDX_utility_meters_property_id" ON "utility_meters" ("propertyId") `);
        await queryRunner.query(`ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_utility_readings_rent_cycle" FOREIGN KEY ("rentCycleId") REFERENCES "rent_cycles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_utility_readings_meter" FOREIGN KEY ("meterId") REFERENCES "utility_meters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rent_cycle_line_items" ADD CONSTRAINT "FK_rent_cycle_line_items_utility_reading" FOREIGN KEY ("utilityReadingId") REFERENCES "utility_readings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utility_meters" ADD CONSTRAINT "FK_utility_meters_unit" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utility_meters" ADD CONSTRAINT "FK_utility_meters_property" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
