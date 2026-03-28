import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RLS policies for tables exposed via Supabase PostgREST.
 * The NestJS API uses a direct DB role that bypasses RLS; these policies apply to anon/authenticated.
 * For PostgREST access to work, Supabase Auth user id should match public.users.id.
 */
export class RlsPoliciesPlansSubscriptionsUtilities1772600000000
  implements MigrationInterface
{
  name = 'RlsPoliciesPlansSubscriptionsUtilities1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const superAdmin = `EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u."isSuperAdmin" = true
    )`;

    // --- plans ---
    await queryRunner.query(`
      DROP POLICY IF EXISTS "plans_select_public" ON public.plans;
      DROP POLICY IF EXISTS "plans_modify_super_admin" ON public.plans;
    `);
    await queryRunner.query(`
      CREATE POLICY "plans_select_public"
      ON public.plans
      FOR SELECT
      TO anon, authenticated
      USING (true);
    `);
    await queryRunner.query(`
      CREATE POLICY "plans_modify_super_admin"
      ON public.plans
      FOR ALL
      TO authenticated
      USING (${superAdmin})
      WITH CHECK (${superAdmin});
    `);

    // --- subscriptions ---
    const subscriptionCompanyAccess = `EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc."userId" = (SELECT auth.uid())
        AND uc."companyId" = subscriptions."companyId"
        AND uc."isActive" = true
    )`;

    await queryRunner.query(`
      DROP POLICY IF EXISTS "subscriptions_select_members" ON public.subscriptions;
      DROP POLICY IF EXISTS "subscriptions_super_admin_all" ON public.subscriptions;
    `);
    await queryRunner.query(`
      CREATE POLICY "subscriptions_select_members"
      ON public.subscriptions
      FOR SELECT
      TO authenticated
      USING (${superAdmin} OR ${subscriptionCompanyAccess});
    `);
    await queryRunner.query(`
      CREATE POLICY "subscriptions_super_admin_all"
      ON public.subscriptions
      FOR ALL
      TO authenticated
      USING (${superAdmin})
      WITH CHECK (${superAdmin});
    `);

    // --- subscription_payments ---
    const paymentCompanyAccess = `EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN public.user_companies uc
        ON uc."companyId" = s."companyId"
      WHERE s.id = subscription_payments."subscriptionId"
        AND uc."userId" = (SELECT auth.uid())
        AND uc."isActive" = true
    )`;

    await queryRunner.query(`
      DROP POLICY IF EXISTS "subscription_payments_select_members" ON public.subscription_payments;
      DROP POLICY IF EXISTS "subscription_payments_super_admin_all" ON public.subscription_payments;
    `);
    await queryRunner.query(`
      CREATE POLICY "subscription_payments_select_members"
      ON public.subscription_payments
      FOR SELECT
      TO authenticated
      USING (${superAdmin} OR ${paymentCompanyAccess});
    `);
    await queryRunner.query(`
      CREATE POLICY "subscription_payments_super_admin_all"
      ON public.subscription_payments
      FOR ALL
      TO authenticated
      USING (${superAdmin})
      WITH CHECK (${superAdmin});
    `);

    // --- utility_meters / utility_readings (company staff: COMPANY_ADMIN, MANAGER, SUPER_ADMIN) ---
    const utilityStaffRoles = `uc.role::text IN ('COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN')`;

    const meterAccess = `EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.user_companies uc ON uc."companyId" = p."companyId"
      WHERE p.id = utility_meters."propertyId"
        AND uc."userId" = (SELECT auth.uid())
        AND uc."isActive" = true
        AND ${utilityStaffRoles}
    )`;

    const readingAccess = `EXISTS (
      SELECT 1
      FROM public.utility_meters m
      JOIN public.properties p ON p.id = m."propertyId"
      JOIN public.user_companies uc ON uc."companyId" = p."companyId"
      WHERE m.id = utility_readings."meterId"
        AND uc."userId" = (SELECT auth.uid())
        AND uc."isActive" = true
        AND ${utilityStaffRoles}
    )`;

    await queryRunner.query(`
      DROP POLICY IF EXISTS "utility_meters_staff_all" ON public.utility_meters;
      DROP POLICY IF EXISTS "utility_readings_staff_all" ON public.utility_readings;
    `);
    await queryRunner.query(`
      CREATE POLICY "utility_meters_staff_all"
      ON public.utility_meters
      FOR ALL
      TO authenticated
      USING (${superAdmin} OR ${meterAccess})
      WITH CHECK (${superAdmin} OR ${meterAccess});
    `);
    await queryRunner.query(`
      CREATE POLICY "utility_readings_staff_all"
      ON public.utility_readings
      FOR ALL
      TO authenticated
      USING (${superAdmin} OR ${readingAccess})
      WITH CHECK (${superAdmin} OR ${readingAccess});
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS "utility_readings_staff_all" ON public.utility_readings;
      DROP POLICY IF EXISTS "utility_meters_staff_all" ON public.utility_meters;
      DROP POLICY IF EXISTS "subscription_payments_super_admin_all" ON public.subscription_payments;
      DROP POLICY IF EXISTS "subscription_payments_select_members" ON public.subscription_payments;
      DROP POLICY IF EXISTS "subscriptions_super_admin_all" ON public.subscriptions;
      DROP POLICY IF EXISTS "subscriptions_select_members" ON public.subscriptions;
      DROP POLICY IF EXISTS "plans_modify_super_admin" ON public.plans;
      DROP POLICY IF EXISTS "plans_select_public" ON public.plans;
    `);
  }
}
