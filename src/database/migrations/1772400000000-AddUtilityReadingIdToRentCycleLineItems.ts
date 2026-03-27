import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUtilityReadingIdToRentCycleLineItems1772400000000
  implements MigrationInterface
{
  name = 'AddUtilityReadingIdToRentCycleLineItems1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_cycle_line_items" ADD "utilityReadingId" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rent_cycle_line_items_utility_reading_id" ON "rent_cycle_line_items" ("utilityReadingId") WHERE "utilityReadingId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycle_line_items" ADD CONSTRAINT "FK_rent_cycle_line_items_utility_reading" FOREIGN KEY ("utilityReadingId") REFERENCES "utility_readings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_cycle_line_items" DROP CONSTRAINT "FK_rent_cycle_line_items_utility_reading"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_rent_cycle_line_items_utility_reading_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rent_cycle_line_items" DROP COLUMN "utilityReadingId"`,
    );
  }
}
