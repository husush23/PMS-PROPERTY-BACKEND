import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Subscription, SubscriptionStatus, BillingCycle } from './entities/subscription.entity';
import { Plan } from '../plan/entities/plan.entity';
import { Company } from '../company/entities/company.entity';

@Injectable()
export class SubscriptionService {
    constructor(
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        @InjectRepository(Plan)
        private readonly planRepository: Repository<Plan>,
        @InjectRepository(Company)
        private readonly companyRepository: Repository<Company>,
    ) { }

    async createTrial(companyId: string): Promise<Subscription> {
        const defaultPlan = await this.planRepository.findOne({
            where: { isActive: true },
            order: { monthlyPrice: 'ASC' },
        });

        if (!defaultPlan) {
            throw new NotFoundException('No active plans available for trial');
        }

        const startDate = new Date();
        const trialEndsAt = new Date(startDate);
        trialEndsAt.setDate(startDate.getDate() + 30); // 30 days trial

        const existingSubscription = await this.subscriptionRepository.findOne({
            where: { companyId },
        });

        if (existingSubscription) {
            return existingSubscription;
        }

        const subscription = this.subscriptionRepository.create({
            companyId,
            planId: defaultPlan.id,
            status: SubscriptionStatus.TRIAL,
            billingCycle: BillingCycle.MONTHLY,
            startDate: startDate,
            endDate: trialEndsAt,
            trialEndsAt: trialEndsAt,
            autoRenew: true,
        });

        return await this.subscriptionRepository.save(subscription);
    }

    async assignSubscription(
        companyId: string,
        planId: string,
        billingCycle: BillingCycle,
        startDate?: Date,
        endDate?: Date,
        status?: SubscriptionStatus
    ): Promise<Subscription> {
        const plan = await this.planRepository.findOne({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found');

        const company = await this.companyRepository.findOne({ where: { id: companyId } });
        if (!company) throw new NotFoundException('Company not found');

        let subscription = await this.subscriptionRepository.findOne({ where: { companyId } });

        const now = new Date();
        const effectiveStartDate = startDate ? new Date(startDate) : now;
        let effectiveEndDate = endDate ? new Date(endDate) : new Date(effectiveStartDate);

        if (!endDate) {
            if (billingCycle === BillingCycle.MONTHLY) {
                effectiveEndDate.setMonth(effectiveEndDate.getMonth() + 1);
            } else {
                effectiveEndDate.setFullYear(effectiveEndDate.getFullYear() + 1);
            }
        }

        if (subscription) {
            subscription.plan = plan;
            subscription.billingCycle = billingCycle;
            subscription.status = status || SubscriptionStatus.ACTIVE;
            subscription.startDate = effectiveStartDate;
            subscription.endDate = effectiveEndDate;
        } else {
            subscription = this.subscriptionRepository.create({
                companyId,
                planId,
                status: status || SubscriptionStatus.ACTIVE,
                billingCycle,
                startDate: effectiveStartDate,
                endDate: effectiveEndDate,
                autoRenew: true,
            });
        }

        return await this.subscriptionRepository.save(subscription);
    }

    async addManualDays(subscriptionId: string, days: number): Promise<Subscription> {
        const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
        if (!subscription) throw new NotFoundException('Subscription not found');

        const currentEndDate = new Date(subscription.endDate);
        currentEndDate.setDate(currentEndDate.getDate() + days);
        subscription.endDate = currentEndDate;

        if (subscription.status === SubscriptionStatus.EXPIRED && currentEndDate > new Date()) {
            subscription.status = SubscriptionStatus.ACTIVE;
        }

        return await this.subscriptionRepository.save(subscription);
    }

    async cancelSubscription(subscriptionId: string): Promise<Subscription> {
        const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
        if (!subscription) throw new NotFoundException('Subscription not found');

        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.autoRenew = false;
        return await this.subscriptionRepository.save(subscription);
    }

    async findAll(): Promise<Subscription[]> {
        return await this.subscriptionRepository.find({ relations: ['plan', 'company'] });
    }

    async findOne(id: string): Promise<Subscription> {
        const sub = await this.subscriptionRepository.findOne({ where: { id }, relations: ['plan', 'company'] });
        if (!sub) throw new NotFoundException('Subscription not found');
        return sub;
    }

    async getSubscriptionByCompanyId(companyId: string): Promise<Subscription> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { companyId },
            relations: ['plan'],
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found for this company');
        }

        return subscription;
    }

    async checkSubscriptionStatus(companyId: string): Promise<boolean> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { companyId },
        });

        if (!subscription) return false;

        const now = new Date();

        // If cancelled, check if end date is in future (still served)
        if (subscription.status === SubscriptionStatus.CANCELLED) {
            return subscription.endDate > now;
        }

        if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIAL) {
            if (subscription.endDate > now) {
                return true;
            }

            // Grace period check (3 days)
            const gracePeriodEnd = new Date(subscription.endDate);
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);
            if (now <= gracePeriodEnd) return true;
        }

        return false;
    }
}
