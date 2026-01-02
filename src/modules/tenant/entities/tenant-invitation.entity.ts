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
import { Company } from '../../company/entities/company.entity';
import { User } from '../../user/entities/user.entity';
import { TenantProfile } from './tenant-profile.entity';
import { InvitationStatus } from '../../company/entities/company-invitation.entity';

@Entity('tenant_invitations')
@Unique(['token'])
@Index(['companyId'])
@Index(['email'])
@Index(['email', 'companyId'])
@Index(['tenantProfileId'])
export class TenantInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid', { nullable: true })
  tenantProfileId: string;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column('uuid')
  invitedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitedBy' })
  inviter: User;

  @ManyToOne(() => TenantProfile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenantProfileId' })
  tenantProfile: TenantProfile;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
