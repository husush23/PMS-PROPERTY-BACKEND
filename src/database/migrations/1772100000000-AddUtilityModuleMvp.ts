import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUtilityModuleMvp1772100000000 implements MigrationInterface {
  name = 'AddUtilityModuleMvp1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."utility_meters_type_enum" AS ENUM('WATER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "utility_meters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "propertyId" uuid NOT NULL, "unitId" uuid, "type" "public"."utility_meters_type_enum" NOT NULL DEFAULT 'WATER', "meterNumber" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_019c4384a97caf3f4dcf1f668dd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_utility_meters_property_id" ON "utility_meters" ("propertyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_utility_meters_unit_id" ON "utility_meters" ("unitId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "utility_readings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "meterId" uuid NOT NULL, "readingDate" TIMESTAMP NOT NULL, "previousReading" double precision NOT NULL, "currentReading" double precision NOT NULL, "usage" double precision NOT NULL, "rateUsed" double precision NOT NULL, "totalAmount" double precision NOT NULL, "isBilled" boolean NOT NULL DEFAULT false, "rentCycleId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4ea446560c975f85cc7d6657319" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_utility_readings_meter_id" ON "utility_readings" ("meterId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_meters" ADD CONSTRAINT "FK_utility_meters_property" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_meters" ADD CONSTRAINT "FK_utility_meters_unit" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_utility_readings_meter" FOREIGN KEY ("meterId") REFERENCES "utility_meters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_utility_readings_rent_cycle" FOREIGN KEY ("rentCycleId") REFERENCES "rent_cycles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "utility_readings" DROP CONSTRAINT "FK_utility_readings_rent_cycle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_readings" DROP CONSTRAINT "FK_utility_readings_meter"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_meters" DROP CONSTRAINT "FK_utility_meters_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "utility_meters" DROP CONSTRAINT "FK_utility_meters_property"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_utility_readings_meter_id"`);
    await queryRunner.query(`DROP TABLE "utility_readings"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_utility_meters_unit_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_utility_meters_property_id"`);
    await queryRunner.query(`DROP TABLE "utility_meters"`);
    await queryRunner.query(`DROP TYPE "public"."utility_meters_type_enum"`);
  }
}
