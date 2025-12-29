import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Lease } from '../../lease/entities/lease.entity';
import { User } from '../../user/entities/user.entity';
import { Company } from '../../company/entities/company.entity';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { PaymentType } from '../../../shared/enums/payment-type.enum';

@Entity('payments')
@Index(['companyId'])
@Index(['tenantId'])
@Index(['leaseId'])
@Index(['paymentDate'])
@Index(['status'])
@Index(['companyId', 'tenantId'])
@Index(['leaseId', 'paymentDate'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  leaseId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'KES' })
  currency: string;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  paymentType: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ nullable: true })
  reference: string;

  @Column('uuid')
  recordedBy: string;

  @Column({ nullable: true })
  period: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  isPartial: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  balanceAfter: number;

  @Column({ nullable: true })
  attachmentUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Lease, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leaseId' })
  lease: Lease;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: User;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recordedBy' })
  recordedByUser: User;
}

