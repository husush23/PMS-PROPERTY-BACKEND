import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaterSettingsAndUnitBaseline1772105000000
  implements MigrationInterface
{
  name = 'AddWaterSettingsAndUnitBaseline1772105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "properties" ADD "waterEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" ADD "waterRatePerM3" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" ADD "lastWaterReading" numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "units" DROP COLUMN "lastWaterReading"`);
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "waterRatePerM3"`,
    );
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN "waterEnabled"`);
  }
}
