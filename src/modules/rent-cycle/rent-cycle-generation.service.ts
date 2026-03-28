import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, QueryFailedError } from 'typeorm';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { RentCycleLineItemType } from '../../shared/enums/rent-cycle-line-item-type.enum';
import { InvoiceGenerationLog } from './interfaces/invoice-generation-log.interface';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentType } from '../../shared/enums/payment-type.enum';
import { AccountingEntry } from '../accounting/entities/accounting-entry.entity';
import { AccountingAccount } from '../accounting/enums/accounting-account.enum';
import { AccountingEntryDirection } from '../accounting/enums/accounting-entry-direction.enum';
import { AccountingReferenceType } from '../accounting/enums/accounting-reference-type.enum';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { CompanySettings } from '../company/entities/company-settings.entity';
import { RentCycleCategory } from '../../shared/enums/rent-cycle-category.enum';
import { generateNextInvoiceNumber } from './utils/invoice-number.util';
import {
  calculateNextDueDate,
  getPeriodsSinceStart,
} from '../../common/utils/rent-due-date.util';
import {
  calculateProratedMonthlyRentAmount,
  endOfUtcCalendarMonth,
  getLeaseBillingStart,
  isMidMonthProratedFirstCycle,
  periodKeyUtcMonth,
  proratedDayCountForFirstMonth,
  toUtcDateOnly,
} from '../../common/utils/rent-proration.util';
import { UtilityService } from '../utility/utility.service';

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
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectDataSource()
    private dataSource: DataSource,
    private companySettingsResolver: CompanySettingsResolver,
    private readonly utilityService: UtilityService,
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
    const billingStart = getLeaseBillingStart(lease);
    const billingAnchorDay =
      lease.billingAnchorDay || this.getDayOfMonth(billingStart);
    const paymentFrequency =
      lease.paymentFrequency || PaymentFrequency.MONTHLY;

    const useEomFirstCycle =
      isMidMonthProratedFirstCycle(lease);

    const dueDate = useEomFirstCycle
      ? endOfUtcCalendarMonth(billingStart)
      : calculateNextDueDate({
          billingStartDate: billingStart,
          billingAnchorDay,
          paymentFrequency,
          cyclesAhead: 0,
        });

    const period = useEomFirstCycle
      ? periodKeyUtcMonth(billingStart)
      : this.getPeriodForDate(dueDate, paymentFrequency);

    // Check if cycle already exists
    const existing = await this.rentCycleRepository.findOne({
      where: {
        leaseId: lease.id,
        period: period,
        category: RentCycleCategory.RENT,
      },
    });

    if (existing) {
      return existing;
    }

    // Calculate explicit period boundaries before line items (proration uses calendar month when useEomFirstCycle)
    const periodStartDate = toUtcDateOnly(billingStart);
    const leaseEndUtc = toUtcDateOnly(new Date(lease.endDate));
    const todayUtc = toUtcDateOnly(new Date());

    // Explicit cutoff validation: periodStartDate must be <= leaseEndDate
    if (periodStartDate > leaseEndUtc) {
      throw new Error(
        `Cannot generate first invoice: period start date ${periodStartDate.toISOString()} is after lease end date ${leaseEndUtc.toISOString()}`,
      );
    }
    // Invoice generation only when period has started
    if (periodStartDate > todayUtc) {
      throw new Error(
        `Cannot generate first invoice before period start date ${periodStartDate.toISOString()}`,
      );
    }

    const periodEndDate = useEomFirstCycle
      ? endOfUtcCalendarMonth(billingStart)
      : this.calculatePeriodEnd(periodStartDate, paymentFrequency);

    // Calculate line items (first period, check for proration)
    const lineItems = this.calculateLineItems(lease, true, paymentFrequency);

    const { cycle: savedCycle, created } = await this.createRentCycleWithRetry({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      period: period,
      dueDate: dueDate,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
      totalAmountDue: lineItems.reduce((sum, item) => sum + item.amount, 0),
    });

    if (created) {
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
      await this.attachUtilityReadingsForNewCycle(savedCycle);
    }

    if (created) {
      const companySettings =
        await this.companySettingsResolver.getSettings(lease.companyId);
      await this.applyCreditToInvoice(savedCycle, lease, companySettings);
    }

    this.logger.log(
      `Generated first rent cycle for lease ${lease.id}: ${savedCycle.invoiceNumber} (period: ${period})`,
    );

    // IMPORTANT:
    // Invoices represent real rent obligations only.
    // Advance payments must be stored as creditBalance.
    // Never generate invoices solely for advance payment.

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

    const settingsCache = new Map<string, CompanySettings>();
    const getSettings = async (companyId: string) => {
      const cached = settingsCache.get(companyId);
      if (cached) {
        return cached;
      }
      const settings = await this.companySettingsResolver.getSettings(companyId);
      settingsCache.set(companyId, settings);
      return settings;
    };

    for (const lease of activeLeases) {
      try {
        const companySettings = await getSettings(lease.companyId);
        if (!this.companySettingsResolver.shouldAutoGenerateRentCycles(companySettings)) {
          summary.skipped++;
          this.logger.debug(
            `Skipped lease ${lease.id}: autoGenerateRentCycles disabled for company ${lease.companyId}`,
          );
          continue;
        }

        const leaseEndDate = new Date(lease.endDate);
        const billingStart = lease.billingStartDate
          ? new Date(lease.billingStartDate)
          : new Date(lease.startDate);
        const billingAnchorDay =
          lease.billingAnchorDay || this.getDayOfMonth(billingStart);
        const paymentFrequency =
          lease.paymentFrequency || PaymentFrequency.MONTHLY;

        const periodsSinceStart = getPeriodsSinceStart(
          billingStart,
          today,
          paymentFrequency,
        );
        const nextDueDate = calculateNextDueDate({
          billingStartDate: billingStart,
          billingAnchorDay,
          paymentFrequency,
          cyclesAhead: periodsSinceStart,
        });

        // Handle final period if lease has ended
        if (leaseEndDate < today) {
          // Check if there's an unpaid invoice for final period
          const finalPeriod = this.getPeriodForDate(
            leaseEndDate,
            paymentFrequency,
          );
          const finalInvoice = await this.rentCycleRepository.findOne({
            where: {
              leaseId: lease.id,
              period: finalPeriod,
              category: RentCycleCategory.RENT,
            },
          });

          if (!finalInvoice && nextDueDate <= leaseEndDate) {
            // Generate partial invoice for final period
            await this.generatePartialCycleForPeriod(
              lease,
              nextDueDate,
              leaseEndDate,
              finalPeriod,
              paymentFrequency,
              companySettings,
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

        // IMPORTANT:
        // Invoices represent real rent obligations only.
        // Advance payments must be stored as creditBalance.
        // Never generate invoices solely for advance payment.
        //
        // INVOICE GENERATION CUTOFF RULE (Explicit):
        // No invoice should be generated if periodStartDate > leaseEndDate
        // This check must happen before any invoice creation
        // 
        // Rule: Calculate period start date and validate it's before lease end
        const periodStartDate = this.calculatePeriodStartDate(
          nextDueDate,
          paymentFrequency,
        );
        
        // Explicit cutoff validation: periodStartDate must be <= leaseEndDate
        if (periodStartDate > leaseEndDate) {
          summary.skipped++;
          this.logger.debug(
            `Skipped lease ${lease.id}: period start date ${periodStartDate.toISOString()} is after lease end date ${leaseEndDate.toISOString()}`,
          );
          continue; // Skip this lease - no more invoices should be generated
        }

        // Generate invoices only when the period has started
        if (periodStartDate <= today) {
          const period = this.getPeriodForDate(nextDueDate, paymentFrequency);

          // Check if cycle for this period already exists
          const existing = await this.rentCycleRepository.findOne({
            where: {
              leaseId: lease.id,
              period: period,
              category: RentCycleCategory.RENT,
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
                  companySettings,
                );
              } else {
                // Generate full cycle
                await this.generateCycleForPeriod(
                  lease,
                  nextDueDate,
                  period,
                  paymentFrequency,
                  companySettings,
                );
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
            `Skipped lease ${lease.id}: period not started yet (periodStartDate: ${periodStartDate.toISOString()})`,
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
    companySettings?: CompanySettings,
  ): Promise<RentCycle> {
    // Calculate line items (not first period, no proration)
    const lineItems = this.calculateLineItems(lease, false, paymentFrequency);

    // Calculate explicit period boundaries
    // Period starts at the due date (or calculated period start based on frequency)
    const periodStartDate = this.calculatePeriodStartDate(
      dueDate,
      paymentFrequency,
    );
    const periodEndDate = this.calculatePeriodEnd(periodStartDate, paymentFrequency);

    const { cycle: savedCycle, created } = await this.createRentCycleWithRetry({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      period: period,
      dueDate: dueDate,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
      totalAmountDue: lineItems.reduce((sum, item) => sum + item.amount, 0),
    });

    if (created) {
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
      await this.attachUtilityReadingsForNewCycle(savedCycle);
      if (companySettings) {
        await this.applyCreditToInvoice(savedCycle, lease, companySettings);
      }
    }

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
    companySettings?: CompanySettings,
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

    const { cycle: savedCycle, created } = await this.createRentCycleWithRetry({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      period: period,
      dueDate: periodStart,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
      totalAmountDue: lineItems.reduce((sum, item) => sum + item.amount, 0),
    });

    if (created) {
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
      await this.attachUtilityReadingsForNewCycle(savedCycle);
      if (companySettings) {
        await this.applyCreditToInvoice(savedCycle, lease, companySettings);
      }
    }

    return savedCycle;
  }

  /** Run after rent line items exist; before credit so totals include water. */
  private async attachUtilityReadingsForNewCycle(savedCycle: RentCycle): Promise<void> {
    if (savedCycle.isDeposit) {
      return;
    }
    try {
      await this.utilityService.attachUtilityToRentCycle(savedCycle.id);
    } catch (err) {
      this.logger.warn(
        `Utility attach failed for rent cycle ${savedCycle.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async createRentCycleWithRetry(data: {
    leaseId: string;
    companyId: string;
    tenantId: string;
    period: string;
    dueDate: Date;
    periodStartDate: Date;
    periodEndDate: Date;
    totalAmountDue: number;
  }): Promise<{ cycle: RentCycle; created: boolean }> {
    const maxAttempts = 5;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const invoiceNumber = await this.generateInvoiceNumber(
          data.companyId,
          data.period,
        );
        const rentCycle = this.rentCycleRepository.create({
          ...data,
          invoiceNumber,
          category: RentCycleCategory.RENT,
        });
        const savedCycle = await this.rentCycleRepository.save(rentCycle);
        await this.createRentIncomeEntry(savedCycle);
        return { cycle: savedCycle, created: true };
      } catch (error) {
        lastError = error;

        if (error instanceof QueryFailedError) {
          const driverError = error.driverError as {
            code?: string;
            constraint?: string;
            detail?: string;
          };
          if (driverError?.code === '23505') {
            const constraint = driverError.constraint;
            if (constraint === 'UQ_rent_cycles_lease_period_category') {
              const existing = await this.rentCycleRepository.findOne({
                where: {
                  leaseId: data.leaseId,
                  period: data.period,
                  category: RentCycleCategory.RENT,
                },
              });
              if (existing) {
                return { cycle: existing, created: false };
              }
            }

            if (
              constraint === 'UQ_rent_cycles_company_invoice_number' ||
              constraint === 'UQ_rent_cycles_invoice_number' ||
              driverError.detail?.includes('invoiceNumber') ||
              error.message.includes('invoiceNumber')
            ) {
              continue;
            }
          }
        }

        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to create rent cycle after retries');
  }

  private calculatePeriodStartDate(
    dueDate: Date,
    paymentFrequency: PaymentFrequency,
  ): Date {
    const periodStartDate = new Date(dueDate);
    if (paymentFrequency === PaymentFrequency.MONTHLY) {
      periodStartDate.setDate(1); // First day of month
    }
    return periodStartDate;
  }

  // Income is recognized at invoice creation, regardless of payment status.
  private async createRentIncomeEntry(rentCycle: RentCycle): Promise<void> {
    const accountingRepository = this.dataSource.getRepository(AccountingEntry);
    const entry = accountingRepository.create({
      companyId: rentCycle.companyId,
      leaseId: rentCycle.leaseId,
      tenantId: rentCycle.tenantId,
      account: AccountingAccount.RENT_INCOME,
      amount: Number(rentCycle.totalAmountDue),
      direction: AccountingEntryDirection.CREDIT,
      referenceType: AccountingReferenceType.INVOICE,
      referenceId: rentCycle.id,
      entryDate: rentCycle.dueDate,
      notes: null,
    });

    await accountingRepository.save(entry);
  }

  private async applyCreditToInvoice(
    rentCycle: RentCycle,
    lease: Lease,
    companySettings: CompanySettings,
  ): Promise<void> {
    if (!this.companySettingsResolver.shouldAutoApplyCredit(companySettings)) {
      return;
    }
    if (rentCycle.isVoid || rentCycle.isDeposit) {
      return;
    }

    const creditBalance = Number(lease.creditBalance || 0);
    if (creditBalance <= 0) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodStartDate = rentCycle.periodStartDate
      ? new Date(rentCycle.periodStartDate)
      : null;
    const dueDate = new Date(rentCycle.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (periodStartDate) {
      periodStartDate.setHours(0, 0, 0, 0);
      if (periodStartDate > today) {
        return;
      }
    } else if (dueDate > today) {
      return;
    }

    const payments = await this.paymentRepository.find({
      where: {
        rentCycleId: rentCycle.id,
        isActive: true,
        status: Not(PaymentStatus.REFUNDED),
      },
    });

    const amountPaid = payments
      .filter((payment) => payment.amount > 0)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalAmountDue = Number(rentCycle.totalAmountDue);
    const balance = totalAmountDue - amountPaid;

    if (balance <= 0) {
      return;
    }

    const creditToApply = Math.min(creditBalance, balance);
    const newBalance = balance - creditToApply;

    const creditPayment = this.paymentRepository.create({
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      leaseId: lease.id,
      rentCycleId: rentCycle.id,
      amount: creditToApply,
      amountDue: balance,
      amountPaid: creditToApply,
      balance: newBalance,
      currency: lease.currency,
      paymentDate: today,
      dueDate: rentCycle.dueDate,
      paymentMethod: PaymentMethod.CREDIT,
      paymentType: PaymentType.RENT,
      status: newBalance <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
      period: rentCycle.period,
      recordedBy: lease.createdBy || lease.tenantId,
      notes: 'Auto-applied from credit balance',
      isPartial: newBalance > 0,
      balanceAfter: newBalance,
      isActive: true,
      isLegacy: false,
    });

    const savedCreditPayment = await this.paymentRepository.save(creditPayment);
    await this.createCreditApplicationEntry(savedCreditPayment);

    await this.leaseRepository.update(lease.id, {
      creditBalance: creditBalance - creditToApply,
    });

    this.logger.log(
      `Applied credit to invoice ${rentCycle.invoiceNumber}: ${creditToApply}`,
    );
  }

  private async createCreditApplicationEntry(payment: Payment): Promise<void> {
    const accountingRepository = this.dataSource.getRepository(AccountingEntry);
    const entry = accountingRepository.create({
      companyId: payment.companyId,
      leaseId: payment.leaseId,
      tenantId: payment.tenantId,
      account: AccountingAccount.TENANT_CREDIT_LIABILITY,
      amount: Number(payment.amount),
      direction: AccountingEntryDirection.DEBIT,
      referenceType: AccountingReferenceType.PAYMENT,
      referenceId: payment.id,
      entryDate: payment.paymentDate,
      notes: payment.notes || null,
    });

    await accountingRepository.save(entry);
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
      let rentDescription: string;

      if (
        isFirstPeriod &&
        lease.proratedFirstMonth &&
        paymentFrequency === PaymentFrequency.MONTHLY
      ) {
        const billingStart = getLeaseBillingStart(lease);
        rentAmount = calculateProratedMonthlyRentAmount(
          rentAmount,
          billingStart,
        );
        rentDescription = isMidMonthProratedFirstCycle(lease)
          ? `Prorated rent for ${proratedDayCountForFirstMonth(billingStart)} days`
          : 'Monthly rent';
      } else {
        if (paymentFrequency === PaymentFrequency.WEEKLY) {
          rentAmount = rentAmount / 4;
        } else if (paymentFrequency === PaymentFrequency.BIWEEKLY) {
          rentAmount = rentAmount / 2;
        } else if (paymentFrequency === PaymentFrequency.QUARTERLY) {
          rentAmount = rentAmount * 3;
        } else if (paymentFrequency === PaymentFrequency.YEARLY) {
          rentAmount = rentAmount * 12;
        }
        rentDescription =
          paymentFrequency === PaymentFrequency.WEEKLY
            ? 'Weekly rent'
            : paymentFrequency === PaymentFrequency.BIWEEKLY
              ? 'Biweekly rent'
              : paymentFrequency === PaymentFrequency.QUARTERLY
                ? 'Quarterly rent'
                : paymentFrequency === PaymentFrequency.YEARLY
                  ? 'Yearly rent'
                  : 'Monthly rent';
      }

      const skipRentPartialForCalendarProration =
        isFirstPeriod &&
        lease.proratedFirstMonth &&
        paymentFrequency === PaymentFrequency.MONTHLY &&
        isMidMonthProratedFirstCycle(lease);

      if (!skipRentPartialForCalendarProration && periodStart && periodEnd) {
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
          rentDescription = 'Partial period rent';
        }
      }

      lineItems.push({
        type: RentCycleLineItemType.RENT,
        amount: Math.round(rentAmount * 100) / 100,
        description: rentDescription,
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

      if (
        isFirstPeriod &&
        lease.proratedFirstMonth &&
        paymentFrequency === PaymentFrequency.MONTHLY &&
        isMidMonthProratedFirstCycle(lease)
      ) {
        petRentAmount = calculateProratedMonthlyRentAmount(
          petRentAmount,
          getLeaseBillingStart(lease),
        );
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

      if (
        isFirstPeriod &&
        lease.proratedFirstMonth &&
        paymentFrequency === PaymentFrequency.MONTHLY &&
        isMidMonthProratedFirstCycle(lease)
      ) {
        utilityAmount = calculateProratedMonthlyRentAmount(
          utilityAmount,
          getLeaseBillingStart(lease),
        );
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

  private calculateProratedAmount(lease: Lease): number {
    return calculateProratedMonthlyRentAmount(
      Number(lease.monthlyRent),
      getLeaseBillingStart(lease),
    );
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
   * Get day of month from a date
   */
  private getDayOfMonth(date: Date): number {
    return date.getUTCDate();
  }

  /**
   * Generate invoice number (structured: INV-...-{category}-{sequence})
   */
  private async generateInvoiceNumber(
    companyId: string,
    period: string,
  ): Promise<string> {
    return generateNextInvoiceNumber(
      this.rentCycleRepository,
      companyId,
      period,
      RentCycleCategory.RENT,
    );
  }
}

