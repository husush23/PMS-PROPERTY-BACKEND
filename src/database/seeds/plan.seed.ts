import { DataSource } from 'typeorm';
import { Plan } from '../../modules/plan/entities/plan.entity';

export async function seedPlans(dataSource: DataSource): Promise<void> {
    const planRepository = dataSource.getRepository(Plan);

    const defaultPlans = [
        {
            name: 'Monthly Plan',
            description: 'Flexible month-to-month billing for getting started.',
            monthlyPrice: 4000,
            yearlyPrice: 48000,
            features: {
                leaseManagement: true,
                automatedRentCycles: true,
                invoiceAutoGeneration: true,
                paymentTracking: true,
                tenantManagement: true,
                dashboardOverview: true,
                basicFinancialReports: true,
                emailNotifications: true,
                roleBasedAccess: ['Admin', 'Cashier'],
                communicationModule: true,
                secureCloudAccess: true,
                prioritySupport: false,
                advancedReports: false,
            },
            isActive: true,
        },
        {
            name: 'Yearly Plan',
            description: 'Best value for long-term growth with advanced features.',
            monthlyPrice: 4000,
            yearlyPrice: 40000, // 2 months free (4000 * 10)
            features: {
                leaseManagement: true,
                automatedRentCycles: true,
                invoiceAutoGeneration: true,
                paymentTracking: true,
                tenantManagement: true,
                dashboardOverview: true,
                basicFinancialReports: true,
                emailNotifications: true,
                roleBasedAccess: ['Admin', 'Cashier'],
                communicationModule: true,
                secureCloudAccess: true,
                prioritySupport: true,
                advancedReports: true,
                monthsFree: 2,
            },
            isActive: true,
        }
    ];

    for (const planData of defaultPlans) {
        const existingPlan = await planRepository.findOne({
            where: { name: planData.name },
        });

        if (existingPlan) {
            // Update existing plan with new features and pricing
            Object.assign(existingPlan, planData);
            await planRepository.save(existingPlan);
            console.log(`✅ Updated existing plan: ${planData.name}`);
        } else {
            // Create new plan
            const plan = planRepository.create(planData);
            await planRepository.save(plan);
            console.log(`✅ Created default plan: ${planData.name}`);
        }
    }
}
