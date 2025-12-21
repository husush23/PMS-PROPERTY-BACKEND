import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from '../../company/entities/company.entity';
import { PropertyStatus } from '../../../shared/enums/property-status.enum';
import { PropertyType } from '../../../shared/enums/property-type.enum';

@Entity('properties')
@Index(['companyId'])
@Index(['status'])
@Index(['propertyType'])
@Index(['companyId', 'status'])
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('uuid')
  companyId: string;

  @Column({
    type: 'enum',
    enum: PropertyType,
  })
  propertyType: PropertyType;

  @Column({
    type: 'enum',
    enum: PropertyStatus,
    default: PropertyStatus.AVAILABLE,
  })
  status: PropertyStatus;

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

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ type: 'int', nullable: true })
  yearBuilt: number;

  @Column({ type: 'int', nullable: true })
  squareFootage: number;

  @Column({ type: 'int', nullable: true })
  floors: number;

  @Column({ type: 'int', nullable: true })
  parkingSpaces: number;

  @Column({ type: 'int', nullable: true })
  totalUnits: number;

  @Column({ type: 'json', nullable: true })
  images: string[];

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // OneToMany relation to Unit entity
  // Note: Using forward reference to avoid circular dependency
  // @OneToMany(() => import('../../unit/entities/unit.entity').then(m => m.Unit), (unit) => unit.property)
  // units: Unit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

