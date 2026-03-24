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
import { UtilityMeter } from './utility-meter.entity';
import { RentCycle } from '../../rent-cycle/entities/rent-cycle.entity';

@Entity('utility_readings')
@Index(['meterId'])
@Index(['meterId', 'readingDate'], { unique: true })
export class UtilityReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  meterId: string;

  @Column({ type: 'date' })
  readingDate: Date;

  @Column({ type: 'double precision' })
  previousReading: number;

  @Column({ type: 'double precision' })
  currentReading: number;

  @Column({ type: 'double precision' })
  usage: number;

  @Column({ type: 'double precision' })
  rateUsed: number;

  @Column({ type: 'double precision' })
  totalAmount: number;

  @Column({ default: false })
  isBilled: boolean;

  @Column('uuid', { nullable: true })
  rentCycleId: string | null;

  @ManyToOne(() => UtilityMeter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meterId' })
  meter: UtilityMeter;

  @ManyToOne(() => RentCycle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rentCycleId' })
  rentCycle: RentCycle | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
