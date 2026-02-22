import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Subscription } from '../../subscription/entities/subscription.entity';

@Entity('plans')
export class Plan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string; // e.g. "Basic", "Pro"

    @Column({ nullable: true })
    description: string;

    @Column('decimal', { precision: 10, scale: 2 })
    monthlyPrice: number;

    @Column('decimal', { precision: 10, scale: 2 })
    yearlyPrice: number;

    @Column({ type: 'jsonb', nullable: true })
    features: Record<string, any>; // JSON defining limits/features

    @Column({ default: true })
    isActive: boolean;

    @OneToMany(() => Subscription, (subscription) => subscription.plan)
    subscriptions: Subscription[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
