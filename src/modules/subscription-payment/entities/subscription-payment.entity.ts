import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Subscription } from '../../subscription/entities/subscription.entity';

export enum PaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export enum PaymentMethod {
    MANUAL = 'MANUAL',
    STRIPE = 'STRIPE',
}

@Entity('subscription_payments')
export class SubscriptionPayment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    subscriptionId: string;

    @ManyToOne(() => Subscription, (subscription) => subscription.payments)
    @JoinColumn({ name: 'subscriptionId' })
    subscription: Subscription;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({ default: 'USD' })
    currency: string;

    @Column({ type: 'timestamp' })
    paymentDate: Date;

    @Column({
        type: 'enum',
        enum: PaymentMethod,
        default: PaymentMethod.MANUAL
    })
    paymentMethod: PaymentMethod;

    @Column({ nullable: true })
    transactionId: string;

    @Column({ nullable: true })
    invoiceUrl: string;

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING
    })
    status: PaymentStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
