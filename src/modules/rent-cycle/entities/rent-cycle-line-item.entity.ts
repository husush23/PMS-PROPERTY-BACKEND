import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RentCycle } from './rent-cycle.entity';
import { RentCycleLineItemType } from '../../../shared/enums/rent-cycle-line-item-type.enum';

@Entity('rent_cycle_line_items')
@Index(['rentCycleId'])
export class RentCycleLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  rentCycleId: string;

  @Column({
    type: 'enum',
    enum: RentCycleLineItemType,
  })
  type: RentCycleLineItemType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isLateFee: boolean; // True if this is a late fee line item

  // Relationships
  @ManyToOne(() => RentCycle, (rentCycle) => rentCycle.lineItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rentCycleId' })
  rentCycle: RentCycle;
}

