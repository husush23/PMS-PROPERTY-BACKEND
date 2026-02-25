import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPayment } from './entities/subscription-payment.entity';

@Injectable()
export class SubscriptionPaymentService {
    constructor(
        @InjectRepository(SubscriptionPayment)
        private readonly subscriptionPaymentRepository: Repository<SubscriptionPayment>,
    ) { }

    async create(createSubscriptionPaymentDto: any) {
        const payment = this.subscriptionPaymentRepository.create(createSubscriptionPaymentDto);
        return await this.subscriptionPaymentRepository.save(payment);
    }

    async findAll() {
        return await this.subscriptionPaymentRepository.find({ relations: ['subscription'] });
    }

    async findOne(id: string) {
        return await this.subscriptionPaymentRepository.findOne({
            where: { id },
            relations: ['subscription']
        });
    }

    async findByCompany(companyId: string) {
        return await this.subscriptionPaymentRepository.createQueryBuilder('payment')
            .innerJoinAndSelect('payment.subscription', 'subscription')
            .leftJoinAndSelect('subscription.plan', 'plan')
            .where('subscription.companyId = :companyId', { companyId })
            .orderBy('payment.recordedAt', 'DESC')
            .getMany();
    }
}
