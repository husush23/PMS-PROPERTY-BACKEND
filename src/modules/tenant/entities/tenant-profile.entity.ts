import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Company } from '../../company/entities/company.entity';
import { TenantStatus } from '../../../shared/enums/tenant-status.enum';

@Entity('tenant_profiles')
@Unique(['userId', 'companyId'])
@Index(['userId'])
@Index(['companyId'])
@Index(['status'])
@Index(['companyId', 'status'])
export class TenantProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  companyId: string;

  // Contact Information
  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  alternativePhone: string;

  // Personal Information
  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  idNumber: string;

  @Column({ nullable: true })
  idType: string;

  // Address
  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ nullable: true })
  country: string;

  // Emergency Contact
  @Column({ nullable: true })
  emergencyContactName: string;

  @Column({ nullable: true })
  emergencyContactPhone: string;

  @Column({ type: 'text', nullable: true })
  emergencyContactRelationship: string;

  // Tenant Status
  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.PENDING,
  })
  status: TenantStatus;

  // Additional Info
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  // Preferences
  @Column({ nullable: true, default: true })
  emailNotifications: boolean;

  @Column({ nullable: true, default: true })
  smsNotifications: boolean;

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
