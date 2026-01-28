import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentType } from '../../shared/enums/payment-type.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { LateFeeType } from '../../shared/enums/late-fee-type.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { RentCycleStatus } from '../../shared/enums/rent-cycle-status.enum';
import { RentCycleService } from '../rent-cycle/rent-cycle.service';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { CompanySettings } from '../company/entities/company-settings.entity';

/**
 * GRACE PERIOD RULE (Authoritative - Single Source of Truth):
 * 
 * - Grace period ONLY affects OVERDUE transition (not DUE)
 * - Grace period NEVER affects invoice generation
 * - Grace period NEVER affects period boundaries
 * 
 * Status Transition Rules:
 * - DUE status occurs when: periodStartDate ≤ today ≤ dueDate
 * - OVERDUE status occurs when: today > dueDate + gracePeriodDays
 * 
 * Important:
 * - If today is between dueDate and (dueDate + gracePeriodDays), status is still DUE
 * - Grace period delays the transition from DUE to OVERDUE, it does not change when DUE occurs
 * - Invoice generation happens at period start, regardless of grace period
 */
@Injectable()
export class OverdueHandlerService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @Inject(forwardRef(() => RentCycleService))
    private rentCycleService: RentCycleService,
    private companySettingsResolver: CompanySettingsResolver,
  ) {}

  /**
   * Check and mark overdue rent cycles, apply late fees (cron job)
   */
  async checkAndMarkOverdue(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find rent cycles that are past due date + grace period and not fully paid
    const rentCycles = await this.rentCycleRepository
      .createQueryBuilder('rentCycle')
      .leftJoinAndSelect('rentCycle.lease', 'lease')
      .leftJoinAndSelect('rentCycle.lineItems', 'lineItems')
      .where('lease.status = :leaseStatus', {
        leaseStatus: LeaseStatus.ACTIVE,
      })
      .andWhere('lease.isActive = :isActive', { isActive: true })
      .getMany();

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

    for (const rentCycle of rentCycles) {
      try {
        const lease = rentCycle.lease;
        if (!lease) {
          continue;
        }

        // Load payments for this cycle
        const payments = await this.paymentRepository.find({
          where: {
            rentCycleId: rentCycle.id,
            isActive: true,
          },
        });

        // Calculate status and amounts
        const status = this.rentCycleService.calculateStatus({
          ...rentCycle,
          payments,
        });
        const amounts = this.rentCycleService.calculateAmounts({
          ...rentCycle,
          payments,
        });

        // Calculate grace period end date
        const gracePeriodEnd = new Date(rentCycle.dueDate);
        gracePeriodEnd.setDate(
          gracePeriodEnd.getDate() + (lease.gracePeriodDays || 0),
        );

        // Check if cycle is overdue (past grace period)
        if (today > gracePeriodEnd && amounts.balance > 0) {
          // Check if late fee already applied
          const hasLateFee = rentCycle.lineItems.some((item) => item.isLateFee);

          // Apply late fee if not already applied
          const companySettings = await getSettings(lease.companyId);
          if (
            !hasLateFee &&
            lease.lateFeeType !== LateFeeType.NONE &&
            this.companySettingsResolver.shouldAutoApplyLateFees(companySettings)
          ) {
            await this.applyLateFee(rentCycle.id, lease);
          }
        }
      } catch (error) {
        // Log error but continue with other cycles
        console.error(
          `Error processing overdue rent cycle ${rentCycle.id}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Apply late fee to a rent cycle (adds as line item)
   */
  private async applyLateFee(
    rentCycleId: string,
    lease: Lease,
  ): Promise<void> {
    const rentCycle = await this.rentCycleRepository.findOne({
      where: { id: rentCycleId },
      relations: ['lineItems'],
    });

    if (!rentCycle) {
      return;
    }

    const lateFeeAmount = this.calculateLateFee(lease, rentCycle);

    if (lateFeeAmount > 0) {
      // Use RentCycleService to apply late fee (adds line item)
      // Note: We need a userId, but for system operations we can use a system user ID
      // In production, you might want to pass a system user ID or make applyLateFee accept optional userId
      try {
        await this.rentCycleService.applyLateFee(rentCycleId, lease.createdBy || rentCycle.tenantId);
      } catch (error) {
        // If applyLateFee fails (e.g., already applied), continue
        console.error(`Error applying late fee to rent cycle ${rentCycleId}:`, error.message);
      }
    }
  }

  /**
   * Calculate late fee amount based on lease configuration
   */
  private calculateLateFee(lease: Lease, rentCycle: RentCycle): number {
    if (lease.lateFeeType === LateFeeType.NONE) {
      return 0;
    }

    if (lease.lateFeeType === LateFeeType.FIXED) {
      // Use lateFeeValue if set, otherwise fall back to lateFeeAmount
      return Number(lease.lateFeeValue || lease.lateFeeAmount || 0);
    }

    if (lease.lateFeeType === LateFeeType.PERCENTAGE) {
      // Calculate percentage of totalAmountDue
      const percentage = Number(lease.lateFeeValue || 0);
      if (percentage > 0) {
        return Math.round((Number(rentCycle.totalAmountDue) * percentage) / 100 * 100) / 100;
      }
    }

    return 0;
  }
}

