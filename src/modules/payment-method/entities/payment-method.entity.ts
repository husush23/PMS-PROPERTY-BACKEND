import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payment_methods')
@Index(['companyId'])
@Index(['isGlobal'])
export class PaymentMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  code: string | null;

  @Column({ default: false })
  isGlobal: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerName?: string | null;

  @Column({ type: 'text', nullable: true })
  instructions?: string | null;

  @Column({ default: false })
  requiresReference: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
