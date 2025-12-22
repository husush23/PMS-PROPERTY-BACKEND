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
import { User } from '../../user/entities/user.entity';
import { Unit } from '../../unit/entities/unit.entity';
import { Company } from '../../company/entities/company.entity';
import { LeaseStatus } from '../../../shared/enums/lease-status.enum';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

@Entity('leases')
@Index(['unitId'])
@Index(['tenantId'])
@Index(['companyId'])
@Index(['status'])
@Index(['unitId', 'status'])
@Index(['startDate'])
@Index(['endDate'])
export class Lease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  unitId: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid', { nullable: true })
  landlordUserId: string;

  // Lease Information
  @Column({ nullable: true })
  leaseNumber: string;

  @Column({
    type: 'enum',
    enum: LeaseStatus,
    default: LeaseStatus.DRAFT,
  })
  status: LeaseStatus;

  @Column({
    type: 'enum',
    enum: LeaseType,
  })
  leaseType: LeaseType;

  // Dates
  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'date', nullable: true })
  moveInDate: Date;

  @Column({ type: 'date', nullable: true })
  moveOutDate: Date;

  @Column({ type: 'date', nullable: true })
  signedDate: Date;

  @Column({ type: 'date', nullable: true })
  renewalDate: Date;

  @Column({ type: 'date', nullable: true })
  noticeToVacateDate: Date;

  // Billing Controls
  @Column({ type: 'date', nullable: true })
  billingStartDate: Date;

  @Column({ default: false })
  proratedFirstMonth: boolean;

  @Column({ type: 'int', default: 0 })
  gracePeriodDays: number;

  // Financial
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthlyRent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  securityDeposit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  petDeposit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  petRent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lateFeeAmount: number;

  @Column({ default: false })
  utilitiesIncluded: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  utilityCosts: number;

  @Column({ default: 'KES' })
  currency: string;

  // Termination Metadata
  @Column({ nullable: true })
  terminationReason: string;

  @Column('uuid', { nullable: true })
  terminatedBy: string;

  @Column({ type: 'text', nullable: true })
  terminationNotes: string;

  @Column({ type: 'date', nullable: true })
  actualTerminationDate: Date;

  // Renewal Linking
  @Column('uuid', { nullable: true })
  renewedFromLeaseId: string;

  @Column('uuid', { nullable: true })
  renewedToLeaseId: string;

  // Terms & Conditions
  @Column({ type: 'int', nullable: true })
  leaseTerm: number;

  @Column({ type: 'text', nullable: true })
  renewalOptions: string;

  @Column({ type: 'int', nullable: true })
  noticePeriod: number;

  @Column({ type: 'text', nullable: true })
  petPolicy: string;

  @Column({ type: 'text', nullable: true })
  smokingPolicy: string;

  @Column({ type: 'text', nullable: true })
  terms: string;

  // Additional
  @Column({ type: 'json', nullable: true })
  coTenants: string[];

  @Column({ type: 'json', nullable: true })
  guarantorInfo: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  documents: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column('uuid', { nullable: true })
  createdBy: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: User;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'landlordUserId' })
  landlord: User;

  @ManyToOne(() => Lease, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'renewedFromLeaseId' })
  renewedFrom: Lease;

  @ManyToOne(() => Lease, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'renewedToLeaseId' })
  renewedTo: Lease;
}

