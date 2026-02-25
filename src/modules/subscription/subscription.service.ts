import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus, PlanType } from './entities/subscription.entity';
import { Plan } from '../plan/entities/plan.entity';
import { Company } from '../company/entities/company.entity';
import { SubscriptionPayment, PaymentStatus } from '../subscription-payment/entities/subscription-payment.entity';
import { addMonths, addYears, isAfter, endOfDay } from 'date-fns';

@Injectable()
export class SubscriptionService {
    constructor(
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        @InjectRepository(Plan)
        private readonly planRepository: Repository<Plan>,
        @InjectRepository(Company)
        private readonly companyRepository: Repository<Company>,
        @InjectRepository(SubscriptionPayment)
        private readonly subPaymentRepository: Repository<SubscriptionPayment>,
    ) { }

    async recordSubscriptionPayment(data: {
        companyId: string;
        planType: PlanType;
        amount: number;
        referenceNumber?: string;
        proofImageUrl?: string;
        recordedBy: string;
    }): Promise<Subscription> {
        const { companyId, planType, amount, referenceNumber, proofImageUrl, recordedBy } = data;

        // 1. Fetch latest subscription (only one should be ACTIVE ideally)
        let subscription = await this.subscriptionRepository.findOne({
            where: { companyId },
            order: { endDate: 'DESC' }
        });

        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (!subscription || subscription.status === SubscriptionStatus.EXPIRED || !isAfter(subscription.endDate, now)) {
            // New or expired, start from today
            startDate = now;
            if (subscription && subscription.status === SubscriptionStatus.ACTIVE) {
                subscription.status = SubscriptionStatus.EXPIRED;
                await this.subscriptionRepository.save(subscription);
            }
        } else {
            // Active, extend from current endDate
            startDate = subscription.endDate;
        }

        // Calculate new endDate
        if (planType === PlanType.MONTHLY) {
            endDate = addMonths(startDate, 1);
        } else {
            endDate = addYears(startDate, 1);
        }

        // 2. Update or create subscription
        if (subscription && subscription.status !== SubscriptionStatus.EXPIRED) {
            subscription.endDate = endDate;
            subscription.status = SubscriptionStatus.ACTIVE;
            subscription.planType = planType;
        } else {
            // Get a default plan if none associated (matching logic)
            const defaultPlan = await this.planRepository.findOne({ where: { isActive: true } });
            if (!defaultPlan) throw new InternalServerErrorException('No active plans found to associate.');

            subscription = this.subscriptionRepository.create({
                companyId,
                planId: defaultPlan.id,
                status: SubscriptionStatus.ACTIVE,
                planType,
                startDate: startDate === now ? startDate : now, // If new, start now
                endDate,
            });
        }

        const savedSubscription = await this.subscriptionRepository.save(subscription);

        // 3. Record payment
        const payment = this.subPaymentRepository.create({
            subscriptionId: savedSubscription.id,
            amount,
            periodStart: startDate,
            periodEnd: endDate,
            referenceNumber,
            proofImageUrl,
            recordedBy,
            recordedAt: now,
            status: PaymentStatus.COMPLETED
        });

        await this.subPaymentRepository.save(payment);

        return savedSubscription;
    }

    async checkSubscriptionStatus(companyId: string): Promise<boolean> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { companyId },
            order: { endDate: 'DESC' }
        });

        if (!subscription) return false;

        const now = new Date();

        // If status is ACTIVE or TRIAL, we check the endDate
        if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIAL) {
            if (isAfter(endOfDay(subscription.endDate), now)) {
                return true;
            } else {
                // Auto-update to EXPIRED if date has passed
                subscription.status = SubscriptionStatus.EXPIRED;
                await this.subscriptionRepository.save(subscription);
                return false;
            }
        }

        return false;
    }

    async createTrial(companyId: string): Promise<Subscription> {
        // Check if company already has a subscription
        const existing = await this.subscriptionRepository.findOne({ where: { companyId } });
        if (existing) return existing;

        const defaultPlan = await this.planRepository.findOne({ where: { isActive: true } });
        if (!defaultPlan) throw new InternalServerErrorException('No active plans found for trial');

        const now = new Date();
        const trialEndDate = new Date();
        trialEndDate.setDate(now.getDate() + 30);

        const subscription = this.subscriptionRepository.create({
            companyId,
            planId: defaultPlan.id,
            status: SubscriptionStatus.TRIAL,
            planType: PlanType.MONTHLY,
            startDate: now,
            endDate: trialEndDate,
            trialEndsAt: trialEndDate,
        });

        return await this.subscriptionRepository.save(subscription);
    }

    async updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<void> {
        await this.subscriptionRepository.update(id, { status });
    }

    async findAll(): Promise<Subscription[]> {
        return await this.subscriptionRepository.find({ relations: ['plan', 'company'] });
    }

    async findOne(id: string): Promise<Subscription> {
        const sub = await this.subscriptionRepository.findOne({ where: { id }, relations: ['plan', 'company'] });
        if (!sub) throw new NotFoundException('Subscription not found');
        return sub;
    }

    async getSubscriptionByCompanyId(companyId: string): Promise<Subscription | null> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { companyId },
            relations: ['plan'],
            order: { endDate: 'DESC' }
        });

        return subscription;
    }
}
