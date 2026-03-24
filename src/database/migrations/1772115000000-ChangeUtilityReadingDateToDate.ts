import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeUtilityReadingDateToDate1772115000000
  implements MigrationInterface
{
  name = 'ChangeUtilityReadingDateToDate1772115000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sameDayDuplicates = (await queryRunner.query(
      `SELECT "meterId", ("readingDate")::date AS "readingDay", COUNT(*)::int AS "count"
       FROM "utility_readings"
       GROUP BY "meterId", ("readingDate")::date
       HAVING COUNT(*) > 1
       LIMIT 5`,
    )) as Array<{ meterId: string; readingDay: string; count: number }>;

    if (sameDayDuplicates.length > 0) {
      throw new Error(
        `Cannot convert utility_readings.readingDate to date with unique constraint: same-day duplicates exist. ` +
          `Please deduplicate by meterId + readingDay first. Sample: ${JSON.stringify(sameDayDuplicates)}`,
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_utility_readings_meter_date_unique"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_readings" ALTER COLUMN "readingDate" TYPE date USING "readingDate"::date`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_utility_readings_meter_date_unique" ON "utility_readings" ("meterId", "readingDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_utility_readings_meter_date_unique"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_readings" ALTER COLUMN "readingDate" TYPE TIMESTAMP USING "readingDate"::timestamp`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_utility_readings_meter_date_unique" ON "utility_readings" ("meterId", "readingDate")`,
    );
  }
}
