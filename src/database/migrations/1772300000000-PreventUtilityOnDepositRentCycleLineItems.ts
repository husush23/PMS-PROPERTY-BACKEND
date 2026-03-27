import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreventUtilityOnDepositRentCycleLineItems1772300000000
  implements MigrationInterface
{
  name = 'PreventUtilityOnDepositRentCycleLineItems1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.prevent_utility_on_deposit_rent_cycle_line_items()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."type" = 'UTILITY' THEN
          IF (
            SELECT rc."category"
            FROM public."rent_cycles" rc
            WHERE rc.id = NEW."rentCycleId"
          ) = 'DEPOSIT' THEN
            RAISE EXCEPTION 'Utility charges cannot be added to deposit invoices';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_prevent_utility_on_deposit_rent_cycle_line_items"
      ON "rent_cycle_line_items";
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_prevent_utility_on_deposit_rent_cycle_line_items"
      BEFORE INSERT OR UPDATE
      ON "rent_cycle_line_items"
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_utility_on_deposit_rent_cycle_line_items();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_prevent_utility_on_deposit_rent_cycle_line_items"
      ON "rent_cycle_line_items";
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.prevent_utility_on_deposit_rent_cycle_line_items();
    `);
  }
}

