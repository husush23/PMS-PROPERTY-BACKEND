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
import { Property } from '../../property/entities/property.entity';
import { Unit } from '../../unit/entities/unit.entity';
import { UtilityType } from '../../../shared/enums/utility-type.enum';

@Entity('utility_meters')
@Index(['propertyId'])
@Index(['unitId'])
export class UtilityMeter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  propertyId: string;

  @Column('uuid', { nullable: true })
  unitId: string | null;

  @Column({
    type: 'enum',
    enum: UtilityType,
    default: UtilityType.WATER,
  })
  type: UtilityType;

  @Column()
  meterNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @ManyToOne(() => Unit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unitId' })
  unit: Unit | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
