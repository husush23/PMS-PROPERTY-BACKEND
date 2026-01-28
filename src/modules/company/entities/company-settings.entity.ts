import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity';
import { LateFeeType } from '../../../shared/enums/late-fee-type.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { UserRole } from '../../../shared/enums/user-role.enum';

// Company defaults are policy settings, not lease contract values.
@Entity('company_settings')
@Index(['companyId'], { unique: true })
export class CompanySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @OneToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'KES' })
  defaultCurrency: string;

  @Column({ type: 'int', default: 0 })
  defaultGracePeriodDays: number;

  @Column({
    type: 'enum',
    enum: LateFeeType,
    default: LateFeeType.FIXED,
  })
  // NOTE: Late fees will be recognized as income in future accounting.
  defaultLateFeeType: LateFeeType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  // NOTE: Late fees will be recognized as income in future accounting.
  defaultLateFeeValue: number;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.TENANT,
  })
  defaultInvitedRole: UserRole;

  @Column({ default: true })
  staffCanRecordPayments: boolean;

  @Column({ default: false })
  staffCanApprovePayments: boolean;

  @Column({ default: false })
  staffCanInviteTenants: boolean;

  @Column({
    type: 'json',
    default: () =>
      `'["CASH","BANK","MPESA","CARD","CHECK","OTHER"]'`,
  })
  allowedPaymentMethods: PaymentMethod[];

  @Column({ default: false })
  requirePaymentApproval: boolean;

  @Column({ default: true })
  allowPartialPayments: boolean;

  // NOTE: Advance payments should increase tenant credit (liability), not income.
  @Column({ default: true })
  allowAdvancePayments: boolean;

  @Column({ default: false })
  requirePaymentReference: boolean;

  @Column({ default: true })
  defaultEmailNotifications: boolean;

  @Column({ default: true })
  defaultSmsNotifications: boolean;

  @Column({ default: true })
  autoGenerateRentCycles: boolean;

  @Column({ default: true })
  autoApplyCredit: boolean;

  @Column({ default: true })
  autoApplyLateFees: boolean;

  // NOTE: Late fees will be recognized as income in future accounting.
  @Column({ default: false })
  lateFeeEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
