import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUtilityReadingUniqueMeterDate1772110000000
  implements MigrationInterface
{
  name = 'AddUtilityReadingUniqueMeterDate1772110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exactDuplicates = (await queryRunner.query(
      `SELECT "meterId", "readingDate", COUNT(*)::int AS "count"
       FROM "utility_readings"
       GROUP BY "meterId", "readingDate"
       HAVING COUNT(*) > 1
       LIMIT 5`,
    )) as Array<{ meterId: string; readingDate: string; count: number }>;

    if (exactDuplicates.length > 0) {
      throw new Error(
        `Cannot create unique index on utility_readings(meterId, readingDate): duplicate rows exist. ` +
          `Please deduplicate utility_readings first. Sample: ${JSON.stringify(exactDuplicates)}`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_utility_readings_meter_date_unique" ON "utility_readings" ("meterId", "readingDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_utility_readings_meter_date_unique"`,
    );
  }
}
