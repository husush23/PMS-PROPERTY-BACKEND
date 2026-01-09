import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { RentCycleLineItemType } from '../../shared/enums/rent-cycle-line-item-type.enum';
import { InvoiceGenerationLog } from './interfaces/invoice-generation-log.interface';

@Injectable()
export class RentCycleGenerationService {
  private readonly logger = new Logger(RentCycleGenerationService.name);

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
    const paymentFrequency =
      lease.paymentFrequency || PaymentFrequency.MONTHLY;
    const dueDate = this.calculateNextDueDate(
      billingStart,
      rentDueDay,
      paymentFrequency,
      0,
    );

    const period = this.getPeriodForDate(dueDate, paymentFrequency);

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

    // Calculate line items (first period, check for proration)
    const lineItems = this.calculateLineItems(lease, true, paymentFrequency);

    // Calculate explicit period boundaries
    // INVOICE GENERATION CUTOFF RULE: No invoice generated if periodStartDate > leaseEndDate
    const periodStartDate = billingStart; // Period starts at billing start date
    const leaseEndDate = new Date(lease.endDate);
    leaseEndDate.setHours(0, 0, 0, 0);
    
    // Explicit cutoff validation: periodStartDate must be <= leaseEndDate
    if (periodStartDate > leaseEndDate) {
      throw new Error(
        `Cannot generate first invoice: period start date ${periodStartDate.toISOString()} is after lease end date ${leaseEndDate.toISOString()}`,
      );
    }
    
    const periodEndDate = this.calculatePeriodEnd(periodStartDate, paymentFrequency);

    // Create rent cycle
    const rentCycle = this.rentCycleRepository.create({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber: await this.generateInvoiceNumber(lease.companyId, period),
      period: period,
      dueDate: dueDate,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
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

    // Update lease nextRentDueDate based on payment frequency
    const nextDueDate = this.calculateNextDueDate(
      billingStart,
      rentDueDay,
      lease.paymentFrequency || PaymentFrequency.MONTHLY,
      1,
    );
    await this.leaseRepository.update(lease.id, {
      nextRentDueDate: nextDueDate,
    });

    this.logger.log(
      `Generated first rent cycle for lease ${lease.id}: ${savedCycle.invoiceNumber} (period: ${period})`,
    );

    // Fix for backdated lease: If first invoice due date is <= today,
    // generate next invoice immediately to allow advance payments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstInvoiceDueDate = new Date(dueDate);
    firstInvoiceDueDate.setHours(0, 0, 0, 0);

    if (firstInvoiceDueDate <= today) {
      // First invoice is already due, generate next invoice immediately
      const nextPeriod = this.getPeriodForDate(nextDueDate, paymentFrequency);
      const leaseEndDate = new Date(lease.endDate);
      leaseEndDate.setHours(0, 0, 0, 0);

      // Check if next due date is before lease end date
      if (nextDueDate <= leaseEndDate) {
        // Check if next invoice already exists
        const existingNext = await this.rentCycleRepository.findOne({
          where: {
            leaseId: lease.id,
            period: nextPeriod,
          },
        });

        if (!existingNext) {
          // Check if this period extends beyond lease end date (partial period)
          const periodEnd = this.calculatePeriodEnd(
            nextDueDate,
            paymentFrequency,
          );
          const isPartialPeriod = periodEnd > leaseEndDate;

          if (isPartialPeriod) {
            // Generate partial invoice for next period
            await this.generatePartialCycleForPeriod(
              lease,
              nextDueDate,
              leaseEndDate,
              nextPeriod,
              paymentFrequency,
            );
          } else {
            // Generate full cycle for next period
            await this.generateCycleForPeriod(
              lease,
              nextDueDate,
              nextPeriod,
              paymentFrequency,
            );
          }

          // Update nextRentDueDate to the period after next
          const periodsSinceStart = this.getPeriodsSinceStart(
            billingStart,
            nextDueDate,
            paymentFrequency,
          );
          const newNextDueDate = this.calculateNextDueDate(
            billingStart,
            rentDueDay,
            paymentFrequency,
            periodsSinceStart + 1,
          );

          // Only update if new due date is before or equal to lease end date
          if (newNextDueDate <= leaseEndDate) {
            await this.leaseRepository.update(lease.id, {
              nextRentDueDate: newNextDueDate,
            });
          }

          this.logger.log(
            `Generated next rent cycle immediately for backdated lease ${lease.id}: period ${nextPeriod}`,
          );
        }
      }
    }

    return savedCycle;
  }

  /**
   * Generate rent cycles for all active leases (supports all payment frequencies)
   * Should be called daily (e.g., at 2 AM)
   */
  async generateRentCycles(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active leases (all frequencies)
    const activeLeases = await this.leaseRepository.find({
      where: {
        status: LeaseStatus.ACTIVE,
        isActive: true,
      },
    });

    this.logger.log(
      `Starting rent cycle generation for ${activeLeases.length} active leases`,
    );

    const summary = {
      generated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const lease of activeLeases) {
      try {
        const leaseEndDate = new Date(lease.endDate);
        const billingStart = lease.billingStartDate
          ? new Date(lease.billingStartDate)
          : new Date(lease.startDate);
        const rentDueDay = lease.rentDueDay || this.getDayOfMonth(billingStart);
        const paymentFrequency =
          lease.paymentFrequency || PaymentFrequency.MONTHLY;

        // Calculate next due date based on payment frequency
        const nextDueDate = lease.nextRentDueDate
          ? new Date(lease.nextRentDueDate)
          : this.calculateNextDueDate(billingStart, rentDueDay, paymentFrequency, 0);

        // Handle final period if lease has ended
        if (leaseEndDate < today) {
          // Check if there's an unpaid invoice for final period
          const finalPeriod = this.getPeriodForDate(
            leaseEndDate,
            paymentFrequency,
          );
          const finalInvoice = await this.rentCycleRepository.findOne({
            where: { leaseId: lease.id, period: finalPeriod },
          });

          if (!finalInvoice && nextDueDate <= leaseEndDate) {
            // Generate partial invoice for final period
            await this.generatePartialCycleForPeriod(
              lease,
              nextDueDate,
              leaseEndDate,
              finalPeriod,
              paymentFrequency,
            );
            summary.generated++;
            this.logger.log(
              `Generated partial final period invoice for lease ${lease.id}: period ${finalPeriod}`,
            );
          } else {
            summary.skipped++;
            this.logger.warn(
              `Skipped lease ${lease.id}: lease ended, final invoice already exists or no valid period`,
            );
          }
          continue;
        }

        // INVOICE GENERATION CUTOFF RULE (Explicit):
        // No invoice should be generated if periodStartDate > leaseEndDate
        // This check must happen before any invoice creation
        // 
        // Rule: Calculate period start date and validate it's before lease end
        const calculatedPeriodStart = nextDueDate; // For monthly, adjust to first of month
        let periodStartDate = new Date(calculatedPeriodStart);
        if (paymentFrequency === PaymentFrequency.MONTHLY) {
          periodStartDate.setDate(1); // First day of month
        }
        
        // Explicit cutoff validation: periodStartDate must be <= leaseEndDate
        if (periodStartDate > leaseEndDate) {
          summary.skipped++;
          this.logger.debug(
            `Skipped lease ${lease.id}: period start date ${periodStartDate.toISOString()} is after lease end date ${leaseEndDate.toISOString()}`,
          );
          continue; // Skip this lease - no more invoices should be generated
        }

        // Check if we need to generate cycle (due date is today or in the past)
        if (nextDueDate <= today) {
          const period = this.getPeriodForDate(nextDueDate, paymentFrequency);

          // Check if cycle for this period already exists
          const existing = await this.rentCycleRepository.findOne({
            where: {
              leaseId: lease.id,
              period: period,
            },
          });

          if (!existing) {
            // Check if this period extends beyond lease end date (partial period)
            if (nextDueDate < leaseEndDate) {
              const periodEnd = this.calculatePeriodEnd(
                nextDueDate,
                paymentFrequency,
              );
              const isPartialPeriod = periodEnd > leaseEndDate;

              if (isPartialPeriod) {
                // Generate partial invoice
                await this.generatePartialCycleForPeriod(
                  lease,
                  nextDueDate,
                  leaseEndDate,
                  period,
                  paymentFrequency,
                );
              } else {
                // Generate full cycle
                await this.generateCycleForPeriod(
                  lease,
                  nextDueDate,
                  period,
                  paymentFrequency,
                );
              }

              // Calculate and update next due date
              const periodsSinceStart = this.getPeriodsSinceStart(
                billingStart,
                nextDueDate,
                paymentFrequency,
              );
              const newNextDueDate = this.calculateNextDueDate(
                billingStart,
                rentDueDay,
                paymentFrequency,
                periodsSinceStart + 1,
              );

              // Only update if new due date is before or equal to lease end date
              if (newNextDueDate <= leaseEndDate) {
                await this.leaseRepository.update(lease.id, {
                  nextRentDueDate: newNextDueDate,
                });
              }

              summary.generated++;
              this.logger.log(
                `Generated rent cycle for lease ${lease.id}: period ${period} (${paymentFrequency})`,
              );
            } else {
              summary.skipped++;
              this.logger.warn(
                `Skipped lease ${lease.id}: next due date is after lease end date`,
              );
            }
          } else {
            summary.skipped++;
            this.logger.debug(
              `Skipped lease ${lease.id}: invoice already exists for period ${period}`,
            );
          }
        } else {
          summary.skipped++;
          this.logger.debug(
            `Skipped lease ${lease.id}: next due date ${nextDueDate.toISOString()} is in the future`,
          );
        }
      } catch (error) {
        summary.errors++;
        this.logger.error(
          `Error generating rent cycle for lease ${lease.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `Rent cycle generation completed: ${summary.generated} generated, ${summary.skipped} skipped, ${summary.errors} errors`,
    );
  }

  /**
   * Legacy method name - kept for backward compatibility
   * @deprecated Use generateRentCycles() instead
   */
  async generateMonthlyCycles(): Promise<void> {
    return this.generateRentCycles();
  }

  /**
   * Generate rent cycle for a specific period
   */
  private async generateCycleForPeriod(
    lease: Lease,
    dueDate: Date,
    period: string,
    paymentFrequency: PaymentFrequency = PaymentFrequency.MONTHLY,
  ): Promise<RentCycle> {
    // Calculate line items (not first period, no proration)
    const lineItems = this.calculateLineItems(lease, false, paymentFrequency);

    // Calculate explicit period boundaries
    // Period starts at the due date (or calculated period start based on frequency)
    const periodStartDate = new Date(dueDate);
    // For monthly, period start is typically the first day of the month containing dueDate
    // Adjust based on payment frequency
    if (paymentFrequency === PaymentFrequency.MONTHLY) {
      periodStartDate.setDate(1); // First day of month
    }
    const periodEndDate = this.calculatePeriodEnd(periodStartDate, paymentFrequency);

    // Create rent cycle
    const rentCycle = this.rentCycleRepository.create({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber: await this.generateInvoiceNumber(lease.companyId, period),
      period: period,
      dueDate: dueDate,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
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
   * Generate partial rent cycle for final period when lease ends mid-period
   */
  private async generatePartialCycleForPeriod(
    lease: Lease,
    periodStart: Date,
    periodEnd: Date,
    period: string,
    paymentFrequency: PaymentFrequency = PaymentFrequency.MONTHLY,
  ): Promise<RentCycle> {
    // Calculate line items with partial period adjustment
    const lineItems = this.calculateLineItems(
      lease,
      false,
      paymentFrequency,
      periodStart,
      periodEnd,
    );

    // For partial periods, period boundaries are explicitly provided
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    // Create rent cycle
    const rentCycle = this.rentCycleRepository.create({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber: await this.generateInvoiceNumber(lease.companyId, period),
      period: period,
      dueDate: periodStart,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
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
  private calculateLineItems(
    lease: Lease,
    isFirstPeriod: boolean = false,
    paymentFrequency: PaymentFrequency = PaymentFrequency.MONTHLY,
    periodStart?: Date,
    periodEnd?: Date,
  ): Array<{
    type: RentCycleLineItemType;
    amount: number;
    description: string;
  }> {
    const lineItems: Array<{
      type: RentCycleLineItemType;
      amount: number;
      description: string;
    }> = [];

    // Base rent (with proration if first period or partial period)
    if (lease.monthlyRent) {
      let rentAmount = Number(lease.monthlyRent);

      // Apply proration for first period if enabled (only for monthly frequency)
      if (
        isFirstPeriod &&
        lease.proratedFirstMonth &&
        paymentFrequency === PaymentFrequency.MONTHLY
      ) {
        rentAmount = this.calculateProratedAmount(lease);
      } else {
        // Adjust for payment frequency (after proration if applicable)
        if (paymentFrequency === PaymentFrequency.WEEKLY) {
          rentAmount = rentAmount / 4; // Approximate weekly amount
        } else if (paymentFrequency === PaymentFrequency.BIWEEKLY) {
          rentAmount = rentAmount / 2; // Biweekly amount
        } else if (paymentFrequency === PaymentFrequency.QUARTERLY) {
          rentAmount = rentAmount * 3; // Quarterly amount
        } else if (paymentFrequency === PaymentFrequency.YEARLY) {
          rentAmount = rentAmount * 12; // Yearly amount
        }
      }

      // Apply partial period adjustment if period is shorter than full period
      if (periodStart && periodEnd) {
        const fullPeriodEnd = this.calculatePeriodEnd(
          periodStart,
          paymentFrequency,
        );
        if (periodEnd < fullPeriodEnd) {
          rentAmount = this.calculatePartialPeriodAmount(
            rentAmount,
            periodStart,
            fullPeriodEnd,
            periodEnd,
          );
        }
      }

      const description =
        isFirstPeriod && lease.proratedFirstMonth
          ? 'Prorated rent'
          : periodStart && periodEnd
            ? 'Partial period rent'
            : paymentFrequency === PaymentFrequency.WEEKLY
              ? 'Weekly rent'
              : paymentFrequency === PaymentFrequency.BIWEEKLY
                ? 'Biweekly rent'
                : paymentFrequency === PaymentFrequency.QUARTERLY
                  ? 'Quarterly rent'
                  : paymentFrequency === PaymentFrequency.YEARLY
                    ? 'Yearly rent'
                    : 'Monthly rent';

      lineItems.push({
        type: RentCycleLineItemType.RENT,
        amount: Math.round(rentAmount * 100) / 100,
        description,
      });
    }

    // Pet rent (proportional for partial periods)
    if (lease.petRent) {
      let petRentAmount = Number(lease.petRent);

      // Adjust for payment frequency
      if (paymentFrequency === PaymentFrequency.WEEKLY) {
        petRentAmount = petRentAmount / 4;
      } else if (paymentFrequency === PaymentFrequency.BIWEEKLY) {
        petRentAmount = petRentAmount / 2;
      } else if (paymentFrequency === PaymentFrequency.QUARTERLY) {
        petRentAmount = petRentAmount * 3;
      } else if (paymentFrequency === PaymentFrequency.YEARLY) {
        petRentAmount = petRentAmount * 12;
      }

      // Apply partial period adjustment if needed
      if (periodStart && periodEnd) {
        const fullPeriodEnd = this.calculatePeriodEnd(
          periodStart,
          paymentFrequency,
        );
        if (periodEnd < fullPeriodEnd) {
          petRentAmount = this.calculatePartialPeriodAmount(
            petRentAmount,
            periodStart,
            fullPeriodEnd,
            periodEnd,
          );
        }
      }

      lineItems.push({
        type: RentCycleLineItemType.PET_RENT,
        amount: Math.round(petRentAmount * 100) / 100,
        description: 'Pet rent',
      });
    }

    // Utilities (if not included, proportional for partial periods)
    if (!lease.utilitiesIncluded && lease.utilityCosts) {
      let utilityAmount = Number(lease.utilityCosts);

      // Adjust for payment frequency
      if (paymentFrequency === PaymentFrequency.WEEKLY) {
        utilityAmount = utilityAmount / 4;
      } else if (paymentFrequency === PaymentFrequency.BIWEEKLY) {
        utilityAmount = utilityAmount / 2;
      } else if (paymentFrequency === PaymentFrequency.QUARTERLY) {
        utilityAmount = utilityAmount * 3;
      } else if (paymentFrequency === PaymentFrequency.YEARLY) {
        utilityAmount = utilityAmount * 12;
      }

      // Apply partial period adjustment if needed
      if (periodStart && periodEnd) {
        const fullPeriodEnd = this.calculatePeriodEnd(
          periodStart,
          paymentFrequency,
        );
        if (periodEnd < fullPeriodEnd) {
          utilityAmount = this.calculatePartialPeriodAmount(
            utilityAmount,
            periodStart,
            fullPeriodEnd,
            periodEnd,
          );
        }
      }

      lineItems.push({
        type: RentCycleLineItemType.UTILITY,
        amount: Math.round(utilityAmount * 100) / 100,
        description: 'Utility costs',
      });
    }

    return lineItems;
  }

  /**
   * Calculate prorated amount for first month
   */
  private calculateProratedAmount(lease: Lease): number {
    const startDate = new Date(lease.startDate);
    const billingStart = lease.billingStartDate
      ? new Date(lease.billingStartDate)
      : startDate;

    // Get last day of first month
    const lastDayOfMonth = new Date(
      billingStart.getFullYear(),
      billingStart.getMonth() + 1,
      0,
    );

    const daysInMonth = lastDayOfMonth.getDate();
    const daysToCharge = lastDayOfMonth.getDate() - billingStart.getDate() + 1;

    const monthlyRent = Number(lease.monthlyRent);
    const proratedAmount = (monthlyRent / daysInMonth) * daysToCharge;

    return Math.round(proratedAmount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate partial period amount when period is shorter than full period
   */
  private calculatePartialPeriodAmount(
    fullAmount: number,
    periodStart: Date,
    periodEnd: Date,
    actualEnd: Date,
  ): number {
    // Calculate days in full period vs actual period
    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const actualDays = Math.ceil(
      (actualEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.round((fullAmount / totalDays) * actualDays * 100) / 100;
  }

  /**
   * Calculate due date based on billing start date, rent due day, and payment frequency
   */
  private calculateNextDueDate(
    billingStart: Date,
    rentDueDay: number,
    paymentFrequency: PaymentFrequency,
    periodOffset: number,
  ): Date {
    switch (paymentFrequency) {
      case PaymentFrequency.WEEKLY:
        return this.calculateWeeklyDueDate(billingStart, rentDueDay, periodOffset);
      case PaymentFrequency.BIWEEKLY:
        return this.calculateBiweeklyDueDate(billingStart, rentDueDay, periodOffset);
      case PaymentFrequency.QUARTERLY:
        return this.calculateQuarterlyDueDate(billingStart, rentDueDay, periodOffset);
      case PaymentFrequency.YEARLY:
        return this.calculateYearlyDueDate(billingStart, rentDueDay, periodOffset);
      case PaymentFrequency.MONTHLY:
      default:
        return this.calculateMonthlyDueDate(billingStart, rentDueDay, periodOffset);
    }
  }

  /**
   * Calculate monthly due date
   */
  private calculateMonthlyDueDate(
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
   * Calculate weekly due date
   */
  private calculateWeeklyDueDate(
    billingStart: Date,
    rentDueDay: number,
    periodOffset: number,
  ): Date {
    // rentDueDay represents day of week (0-6, Sunday-Saturday) or day of month
    // For weekly, we'll use the day of week from billing start
    const dayOfWeek = billingStart.getDay();
    const dueDate = new Date(billingStart);
    dueDate.setDate(dueDate.getDate() + periodOffset * 7);

    // Adjust to the correct day of week
    const daysToAdd = (rentDueDay % 7) - dayOfWeek;
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    return dueDate;
  }

  /**
   * Calculate biweekly due date
   */
  private calculateBiweeklyDueDate(
    billingStart: Date,
    rentDueDay: number,
    periodOffset: number,
  ): Date {
    const dueDate = new Date(billingStart);
    dueDate.setDate(dueDate.getDate() + periodOffset * 14);

    // Adjust to the correct day of week (biweekly = every 2 weeks)
    const dayOfWeek = billingStart.getDay();
    const targetDayOfWeek = rentDueDay % 7;
    const daysToAdd = targetDayOfWeek - dayOfWeek;
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    return dueDate;
  }

  /**
   * Calculate quarterly due date
   */
  private calculateQuarterlyDueDate(
    billingStart: Date,
    rentDueDay: number,
    periodOffset: number,
  ): Date {
    const dueDate = new Date(
      billingStart.getFullYear(),
      billingStart.getMonth() + periodOffset * 3,
      rentDueDay,
    );

    // Handle months with fewer days
    if (dueDate.getDate() !== rentDueDay) {
      dueDate.setDate(0); // Last day of previous month
    }

    return dueDate;
  }

  /**
   * Calculate yearly due date
   */
  private calculateYearlyDueDate(
    billingStart: Date,
    rentDueDay: number,
    periodOffset: number,
  ): Date {
    const dueDate = new Date(
      billingStart.getFullYear() + periodOffset,
      billingStart.getMonth(),
      rentDueDay,
    );

    // Handle February in leap years
    if (dueDate.getDate() !== rentDueDay) {
      dueDate.setDate(0); // Last day of previous month
    }

    return dueDate;
  }

  /**
   * Get period string for a given date based on payment frequency
   */
  private getPeriodForDate(
    date: Date,
    paymentFrequency: PaymentFrequency = PaymentFrequency.MONTHLY,
  ): string {
    const year = date.getFullYear();

    switch (paymentFrequency) {
      case PaymentFrequency.WEEKLY: {
        // Get week number (ISO week)
        const week = this.getWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
      }
      case PaymentFrequency.BIWEEKLY: {
        // Get week number and biweek indicator
        const week = this.getWeekNumber(date);
        const biweek = Math.floor((week - 1) / 2) + 1;
        return `${year}-W${String(week).padStart(2, '0')}-B${biweek}`;
      }
      case PaymentFrequency.QUARTERLY: {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${year}-Q${quarter}`;
      }
      case PaymentFrequency.YEARLY:
        return `${year}`;
      case PaymentFrequency.MONTHLY:
      default: {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      }
    }
  }

  /**
   * Get ISO week number for a date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Calculate the end date of a period based on payment frequency
   */
  private calculatePeriodEnd(
    periodStart: Date,
    paymentFrequency: PaymentFrequency,
  ): Date {
    const endDate = new Date(periodStart);

    switch (paymentFrequency) {
      case PaymentFrequency.WEEKLY:
        endDate.setDate(endDate.getDate() + 7);
        break;
      case PaymentFrequency.BIWEEKLY:
        endDate.setDate(endDate.getDate() + 14);
        break;
      case PaymentFrequency.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case PaymentFrequency.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case PaymentFrequency.YEARLY:
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    return endDate;
  }

  /**
   * Calculate number of periods since start based on payment frequency
   */
  private getPeriodsSinceStart(
    startDate: Date,
    currentDate: Date,
    paymentFrequency: PaymentFrequency,
  ): number {
    switch (paymentFrequency) {
      case PaymentFrequency.WEEKLY: {
        const diffTime = currentDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 7);
      }
      case PaymentFrequency.BIWEEKLY: {
        const diffTime = currentDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 14);
      }
      case PaymentFrequency.QUARTERLY: {
        const years = currentDate.getFullYear() - startDate.getFullYear();
        const months = currentDate.getMonth() - startDate.getMonth();
        return Math.floor((years * 12 + months) / 3);
      }
      case PaymentFrequency.YEARLY: {
        return currentDate.getFullYear() - startDate.getFullYear();
      }
      case PaymentFrequency.MONTHLY:
      default:
        return this.getMonthsDifference(startDate, currentDate);
    }
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
   * Supports different period formats: YYYY-MM, YYYY-WW, YYYY-QX, YYYY
   */
  private async generateInvoiceNumber(
    companyId: string,
    period: string,
  ): Promise<string> {
    // Extract year and create prefix based on period format
    let prefix: string;
    if (period.includes('-Q')) {
      // Quarterly: YYYY-QX
      prefix = `INV-${period}-`;
    } else if (period.includes('-W')) {
      // Weekly/Biweekly: YYYY-WW or YYYY-WW-BX
      prefix = `INV-${period}-`;
    } else if (period.match(/^\d{4}$/)) {
      // Yearly: YYYY
      prefix = `INV-${period}-`;
    } else {
      // Monthly: YYYY-MM (default)
      const [year, month] = period.split('-');
      prefix = `INV-${year}-${month}-`;
    }

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
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}

