import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { RentCycleLineItemType } from '../../shared/enums/rent-cycle-line-item-type.enum';

@Injectable()
export class RentCycleGenerationService {
  constructor(
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(RentCycleLineItem)
    private lineItemRepository: Repository<RentCycleLineItem>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
  ) {}

  /**
   * Generate first rent cycle when lease is activated
   */
  async generateFirstCycle(leaseId: string): Promise<RentCycle> {
    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
    });

    if (!lease) {
      throw new Error(`Lease ${leaseId} not found`);
    }

    // Ensure dates are Date objects (they come as strings from DB)
    const billingStart = lease.billingStartDate 
      ? new Date(lease.billingStartDate) 
      : new Date(lease.startDate);
    const rentDueDay = lease.rentDueDay || this.getDayOfMonth(billingStart);
    const dueDate = this.calculateDueDate(billingStart, rentDueDay, 0);

    const period = this.getPeriodForDate(dueDate);

    // Check if cycle already exists
    const existing = await this.rentCycleRepository.findOne({
      where: {
        leaseId: lease.id,
        period: period,
      },
    });

    if (existing) {
      return existing;
    }

    // Calculate line items
    const lineItems = this.calculateLineItems(lease);

    // Create rent cycle
    const rentCycle = this.rentCycleRepository.create({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber: await this.generateInvoiceNumber(lease.companyId, period),
      period: period,
      dueDate: dueDate,
      totalAmountDue: lineItems.reduce((sum, item) => sum + item.amount, 0),
    });

    const savedCycle = await this.rentCycleRepository.save(rentCycle);

    // Create line items
    const savedLineItems = lineItems.map((item) =>
      this.lineItemRepository.create({
        rentCycleId: savedCycle.id,
        type: item.type,
        amount: item.amount,
        description: item.description,
        isLateFee: false,
      }),
    );

    await this.lineItemRepository.save(savedLineItems);

    // Update lease nextRentDueDate
    const nextDueDate = this.calculateDueDate(billingStart, rentDueDay, 1);
    await this.leaseRepository.update(lease.id, {
      nextRentDueDate: nextDueDate,
    });

    return savedCycle;
  }

  /**
   * Generate monthly rent cycles for all active leases
   */
  async generateMonthlyCycles(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active leases
    const activeLeases = await this.leaseRepository.find({
      where: {
        status: LeaseStatus.ACTIVE,
        isActive: true,
        paymentFrequency: PaymentFrequency.MONTHLY,
      },
    });

    for (const lease of activeLeases) {
      try {
        // Ensure dates are Date objects (they come as strings from DB)
        const leaseEndDate = new Date(lease.endDate);
        // Skip if lease has ended
        if (leaseEndDate < today) {
          continue;
        }

        // Ensure dates are Date objects (they come as strings from DB)
        const billingStart = lease.billingStartDate 
          ? new Date(lease.billingStartDate) 
          : new Date(lease.startDate);
        const rentDueDay = lease.rentDueDay || this.getDayOfMonth(billingStart);

        // Calculate next due date
        const nextDueDate = lease.nextRentDueDate
          ? new Date(lease.nextRentDueDate)
          : this.calculateDueDate(billingStart, rentDueDay, 0);

        // Check if we need to generate cycle (due date is today or in the past)
        if (nextDueDate <= today) {
          const period = this.getPeriodForDate(nextDueDate);

          // Check if cycle for this period already exists
          const existing = await this.rentCycleRepository.findOne({
            where: {
              leaseId: lease.id,
              period: period,
            },
          });

          if (!existing) {
            // Generate cycle
            await this.generateCycleForPeriod(lease, nextDueDate, period);

            // Calculate and update next due date
            const monthsSinceStart = this.getMonthsDifference(
              billingStart,
              nextDueDate,
            );
            const newNextDueDate = this.calculateDueDate(
              billingStart,
              rentDueDay,
              monthsSinceStart + 1,
            );

            // Only update if new due date is before lease end date
            const leaseEndDate = new Date(lease.endDate);
            if (newNextDueDate <= leaseEndDate) {
              await this.leaseRepository.update(lease.id, {
                nextRentDueDate: newNextDueDate,
              });
            }
          }
        }
      } catch (error) {
        // Log error but continue with other leases
        console.error(
          `Error generating rent cycle for lease ${lease.id}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Generate rent cycle for a specific period
   */
  private async generateCycleForPeriod(
    lease: Lease,
    dueDate: Date,
    period: string,
  ): Promise<RentCycle> {
    // Calculate line items
    const lineItems = this.calculateLineItems(lease);

    // Create rent cycle
    const rentCycle = this.rentCycleRepository.create({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber: await this.generateInvoiceNumber(lease.companyId, period),
      period: period,
      dueDate: dueDate,
      totalAmountDue: lineItems.reduce((sum, item) => sum + item.amount, 0),
    });

    const savedCycle = await this.rentCycleRepository.save(rentCycle);

    // Create line items
    const savedLineItems = lineItems.map((item) =>
      this.lineItemRepository.create({
        rentCycleId: savedCycle.id,
        type: item.type,
        amount: item.amount,
        description: item.description,
        isLateFee: false,
      }),
    );

    await this.lineItemRepository.save(savedLineItems);

    return savedCycle;
  }

  /**
   * Calculate line items for a lease
   */
  private calculateLineItems(lease: Lease): Array<{
    type: RentCycleLineItemType;
    amount: number;
    description: string;
  }> {
    const lineItems: Array<{
      type: RentCycleLineItemType;
      amount: number;
      description: string;
    }> = [];

    // Base rent
    if (lease.monthlyRent) {
      lineItems.push({
        type: RentCycleLineItemType.RENT,
        amount: Number(lease.monthlyRent),
        description: 'Monthly rent',
      });
    }

    // Pet rent
    if (lease.petRent) {
      lineItems.push({
        type: RentCycleLineItemType.PET_RENT,
        amount: Number(lease.petRent),
        description: 'Pet rent',
      });
    }

    // Utilities (if not included)
    if (!lease.utilitiesIncluded && lease.utilityCosts) {
      lineItems.push({
        type: RentCycleLineItemType.UTILITY,
        amount: Number(lease.utilityCosts),
        description: 'Utility costs',
      });
    }

    // Maintenance (if applicable)
    // Note: Add maintenance field to lease if needed, or calculate from other sources

    return lineItems;
  }

  /**
   * Calculate due date based on billing start date and rent due day
   */
  private calculateDueDate(
    billingStart: Date,
    rentDueDay: number,
    periodOffset: number,
  ): Date {
    const dueDate = new Date(
      billingStart.getFullYear(),
      billingStart.getMonth() + periodOffset,
      rentDueDay,
    );

    // Handle months with fewer days
    if (dueDate.getDate() !== rentDueDay) {
      dueDate.setDate(0); // Last day of previous month
    }

    return dueDate;
  }

  /**
   * Get period string for a given date (YYYY-MM)
   */
  private getPeriodForDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get day of month from a date
   */
  private getDayOfMonth(date: Date): number {
    return date.getDate();
  }

  /**
   * Calculate months difference between two dates
   */
  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const years = endDate.getFullYear() - startDate.getFullYear();
    const months = endDate.getMonth() - startDate.getMonth();
    return years * 12 + months;
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(
    companyId: string,
    period: string,
  ): Promise<string> {
    const [year, month] = period.split('-');
    const prefix = `INV-${year}-${month}-`;

    const existing = await this.rentCycleRepository
      .createQueryBuilder('cycle')
      .where('cycle.companyId = :companyId', { companyId })
      .andWhere('cycle.invoiceNumber LIKE :prefix', {
        prefix: `${prefix}%`,
      })
      .orderBy('cycle.invoiceNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (existing) {
      const lastSequence = parseInt(
        existing.invoiceNumber.split('-').pop() || '0',
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}

