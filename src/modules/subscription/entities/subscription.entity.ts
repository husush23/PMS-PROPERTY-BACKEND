import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Company } from '../../company/entities/company.entity';
import { Plan } from '../../plan/entities/plan.entity';
import { SubscriptionPayment } from '../../subscription-payment/entities/subscription-payment.entity';

export enum SubscriptionStatus {
    TRIAL = 'TRIAL',
    ACTIVE = 'ACTIVE',
    EXPIRED = 'EXPIRED',
}

export enum PlanType {
    MONTHLY = 'MONTHLY',
    YEARLY = 'YEARLY',
}

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    companyId: string;

    @ManyToOne(() => Company, (company) => company.subscriptions)
    @JoinColumn({ name: 'companyId' })
    company: Company;

    @Column()
    planId: string;

    @ManyToOne(() => Plan, (plan) => plan.subscriptions)
    @JoinColumn({ name: 'planId' })
    plan: Plan;

    @Column({
        type: 'enum',
        enum: SubscriptionStatus,
        default: SubscriptionStatus.TRIAL
    })
    status: SubscriptionStatus;

    @Column({
        type: 'enum',
        enum: PlanType,
        default: PlanType.MONTHLY
    })
    planType: PlanType;

    @Column({ type: 'timestamp' })
    startDate: Date;

    @Column({ type: 'timestamp' })
    endDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    trialEndsAt: Date;

    @Column({ default: true })
    autoRenew: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastPaymentDate: Date;

    @OneToMany(() => SubscriptionPayment, (payment) => payment.subscription)
    payments: SubscriptionPayment[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
