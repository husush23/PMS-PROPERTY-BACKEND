import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Property } from '../../property/entities/property.entity';
import { Company } from '../../company/entities/company.entity';
import { UnitStatus } from '../../../shared/enums/unit-status.enum';
import { UnitType } from '../../../shared/enums/unit-type.enum';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

@Entity('units')
@Unique(['propertyId', 'unitNumber'])
@Index(['propertyId'])
@Index(['companyId'])
@Index(['status'])
@Index(['unitType'])
@Index(['propertyId', 'status'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  propertyId: string;

  @Column('uuid')
  companyId: string;

  @Column()
  unitNumber: string;

  @Column({
    type: 'enum',
    enum: UnitStatus,
    default: UnitStatus.AVAILABLE,
  })
  status: UnitStatus;

  @Column({
    type: 'enum',
    enum: UnitType,
  })
  unitType: UnitType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthlyRent: number;

  @Column({ type: 'int', nullable: true })
  squareFootage: number;

  @Column({ type: 'int', nullable: true })
  bedrooms: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  bathrooms: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depositAmount: number;

  @Column({ type: 'int', nullable: true })
  floorNumber: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  images: string[];

  @Column({ type: 'json', nullable: true })
  features: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: LeaseType,
    nullable: true,
  })
  leaseType: LeaseType;

  @Column({ nullable: true })
  hasParking: boolean;

  @Column({ nullable: true })
  parkingSpotNumber: string;

  @Column({ nullable: true })
  petFriendly: boolean;

  @Column({ nullable: true })
  furnished: boolean;

  @Column({ nullable: true })
  utilitiesIncluded: boolean;

  @Column({ type: 'text', nullable: true })
  utilityNotes: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lateFeeAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  petDeposit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  petRent: number;

  @Column({ nullable: true })
  accessCode: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // OneToOne relation to Lease (current/active lease) - for future implementation
  // @OneToOne(() => Lease, (lease) => lease.unit)
  // lease: Lease;

  // OneToMany relation to Lease (lease history) - for future implementation
  // @OneToMany(() => Lease, (lease) => lease.unit)
  // leases: Lease[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

