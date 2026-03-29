import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { Lease } from '../lease/entities/lease.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { RentCycleService } from '../rent-cycle/rent-cycle.service';
import { AccountingService } from '../accounting/accounting.service';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { RentCycleStatus } from '../../shared/enums/rent-cycle-status.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { RentCycleLineItemType } from '../../shared/enums/rent-cycle-line-item-type.enum';
import {
  calculateProratedMonthlyRentAmount,
  getLeaseBillingStart,
  getNextScheduledDueOnOrAfter,
  getScheduledMonthlyDueDate,
  isMidMonthProratedFirstCycle,
  proratedDayCountForFirstMonth,
  toUtcDateOnly,
} from '../../common/utils/rent-proration.util';
import {
  TenantDashboardResponseDto,
  TenantDashboardCurrentRentDto,
  TenantDashboardNextRentDto,
  TenantDashboardRecentPaymentDto,
  TenantDashboardLeaseSummaryDto,
  TenantDashboardPaymentStatus,
} from './dto/tenant-dashboard.response.dto';

@Injectable()
export class TenantDashboardService {
  constructor(
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private rentCycleService: RentCycleService,
    private accountingService: AccountingService,
  ) {}

  /**
   * Get full dashboard data for the authenticated tenant (active lease scope).
   * Fails with 404 when tenant has no active lease.
   */
  async getDashboard(userId: string): Promise<TenantDashboardResponseDto> {
    const lease = await this.resolveActiveLease(userId);
    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        'No active lease found.',
        HttpStatus.NOT_FOUND,
        { userId },
      );
    }

    const [currentRent, outstandingBalance, creditBalance, nextRent, recentPayments] =
      await Promise.all([
        this.buildCurrentRent(lease),
        this.buildOutstandingBalance(lease.id),
        this.accountingService.getTenantCreditBalance(lease.companyId, userId),
        this.buildNextRent(lease),
        this.buildRecentPayments(lease.id, userId),
      ]);

    const leaseSummary = this.buildLeaseSummary(lease);

    return {
      currentRent,
      outstandingBalance,
      creditBalance,
      nextRent,
      recentPayments,
      leaseSummary,
    };
  }

  private async resolveActiveLease(userId: string): Promise<Lease | null> {
    const today = new Date().toISOString().slice(0, 10);
    const leases = await this.leaseRepository.find({
      where: {
        tenantId: userId,
        status: LeaseStatus.ACTIVE,
        isActive: true,
      },
      relations: ['unit', 'unit.property'],
      order: { startDate: 'ASC' },
      take: 1,
    });
    const lease = leases[0];
    if (!lease) return null;
    const start =
      (lease.startDate as Date).toISOString?.()?.slice(0, 10) ??
      String(lease.startDate).slice(0, 10);
    const end =
      (lease.endDate as Date).toISOString?.()?.slice(0, 10) ??
      String(lease.endDate).slice(0, 10);
    if (today < start || today > end) return null;
    return lease;
  }

  private async buildCurrentRent(lease: Lease): Promise<TenantDashboardCurrentRentDto> {
    const cycles = await this.rentCycleRepository.find({
      where: {
        leaseId: lease.id,
        isVoid: false,
        isDeposit: false,
      },
      relations: ['lease', 'lineItems'],
      order: { dueDate: 'DESC' },
    });

    const cyclesWithPayments = await Promise.all(
      cycles.map(async (cycle) => {
        const payments = await this.loadPaymentsForCycle(cycle);
        return { ...cycle, payments };
      }),
    );

    const current = cyclesWithPayments.find((c) => {
      const status = this.rentCycleService.calculateStatus(c);
      return [RentCycleStatus.PAID, RentCycleStatus.DUE, RentCycleStatus.OVERDUE].includes(status);
    });

    if (!current) {
      const dueDate = lease.nextRentDueDate
        ? (lease.nextRentDueDate as Date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      return {
        invoiceId: null,
        periodStartDate: null,
        periodEndDate: null,
        amount: Number(lease.monthlyRent ?? 0),
        dueDate,
        status: RentCycleStatus.DUE,
        gracePeriodEndsAt: undefined,
        lateFeeApplied: undefined,
      };
    }

    const amounts = this.rentCycleService.calculateAmounts(current);
    const status = this.rentCycleService.calculateStatus(current) as
      | RentCycleStatus.PAID
      | RentCycleStatus.DUE
      | RentCycleStatus.OVERDUE;
    const dueDate = (current.dueDate as Date).toISOString?.()?.slice(0, 10) ?? String(current.dueDate).slice(0, 10);
    const periodStart = current.periodStartDate
      ? (current.periodStartDate as Date).toISOString?.()?.slice(0, 10) ?? String(current.periodStartDate).slice(0, 10)
      : null;
    const periodEnd = current.periodEndDate
      ? (current.periodEndDate as Date).toISOString?.()?.slice(0, 10) ?? String(current.periodEndDate).slice(0, 10)
      : null;

    let gracePeriodEndsAt: string | undefined;
    if (current.lease?.gracePeriodDays) {
      const d = new Date(current.dueDate);
      d.setDate(d.getDate() + Number(current.lease.gracePeriodDays));
      gracePeriodEndsAt = d.toISOString().slice(0, 10);
    }

    const lateFeeApplied =
      current.lineItems
        ?.filter(
          (li) =>
            li.type === RentCycleLineItemType.LATE_FEE || (li as { isLateFee?: boolean }).isLateFee,
        )
        .reduce((sum, li) => sum + Number(li.amount ?? 0), 0) ?? 0;

    return {
      invoiceId: current.id,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      amount: amounts.totalAmountDue,
      dueDate,
      status,
      gracePeriodEndsAt: gracePeriodEndsAt ?? undefined,
      lateFeeApplied: lateFeeApplied > 0 ? lateFeeApplied : undefined,
    };
  }

  private async buildOutstandingBalance(leaseId: string): Promise<number> {
    const cycles = await this.rentCycleRepository.find({
      where: { leaseId, isVoid: false, isDeposit: false },
      relations: ['lease', 'lineItems'],
    });

    const cyclesWithPayments = await Promise.all(
      cycles.map(async (cycle) => {
        const payments = await this.loadPaymentsForCycle(cycle);
        return { ...cycle, payments };
      }),
    );

    let total = 0;
    for (const c of cyclesWithPayments) {
      const status = this.rentCycleService.calculateStatus(c);
      if (status !== RentCycleStatus.DUE && status !== RentCycleStatus.OVERDUE) continue;
      const amounts = this.rentCycleService.calculateAmounts(c);
      if (amounts.balance > 0) total += amounts.balance;
    }
    return total;
  }

  private buildNextRent(lease: Lease): TenantDashboardNextRentDto {
    const billingStart = getLeaseBillingStart(lease);
    const anchorDay =
      lease.billingAnchorDay ?? billingStart.getUTCDate();
    const frequency =
      (lease.paymentFrequency as PaymentFrequency) ?? PaymentFrequency.MONTHLY;

    const nextDueDate = getNextScheduledDueOnOrAfter({
      billingStartDate: billingStart,
      billingAnchorDay: anchorDay,
      proratedFirstMonth: lease.proratedFirstMonth ?? false,
      paymentFrequency: frequency,
      asOf: new Date(),
    });

    let amount = Number(lease.monthlyRent ?? 0);
    let prorationDays: number | null = null;
    let prorationSummary: string | null = null;
    let nextFullRentDueDate: string | null = null;
    let nextFullRentSummary: string | null = null;

    const proratedMid = isMidMonthProratedFirstCycle(lease);
    if (frequency === PaymentFrequency.MONTHLY && proratedMid) {
      const firstDue = toUtcDateOnly(billingStart);
      if (
        toUtcDateOnly(nextDueDate).getTime() ===
        firstDue.getTime()
      ) {
        amount = calculateProratedMonthlyRentAmount(amount, billingStart);
        prorationDays = proratedDayCountForFirstMonth(billingStart);
        prorationSummary = `Prorated rent for ${prorationDays} days`;
        const secondDue = getScheduledMonthlyDueDate({
          billingStartDate: billingStart,
          billingAnchorDay: anchorDay,
          scheduleIndex: 1,
          proratedMidMonth: true,
        });
        nextFullRentDueDate = toUtcDateOnly(secondDue)
          .toISOString()
          .slice(0, 10);
        nextFullRentSummary = `Next full rent due on ${nextFullRentDueDate}`;
      }
    }

    return {
      dueDate: toUtcDateOnly(nextDueDate).toISOString().slice(0, 10),
      amount,
      frequency,
      prorationDays,
      prorationSummary,
      nextFullRentDueDate,
      nextFullRentSummary,
    };
  }

  private async buildRecentPayments(
    leaseId: string,
    userId: string,
  ): Promise<TenantDashboardRecentPaymentDto[]> {
    const payments = await this.paymentRepository.find({
      where: { leaseId, tenantId: userId, isActive: true },
      order: { paymentDate: 'DESC' },
      take: 5,
    });

    return payments.map((p) => ({
      id: p.id,
      date:
        (p.paymentDate as Date).toISOString?.()?.slice(0, 10) ??
        String(p.paymentDate).slice(0, 10),
      amount: Number(p.amount),
      method: p.paymentMethod as string,
      status: this.mapPaymentStatus(p.status),
    }));
  }

  private mapPaymentStatus(status: PaymentStatus): TenantDashboardPaymentStatus {
    if (status === PaymentStatus.PAID) return 'APPROVED';
    if (
      status === PaymentStatus.FAILED ||
      status === PaymentStatus.REFUNDED ||
      status === PaymentStatus.CANCELLED
    )
      return 'REJECTED';
    return 'PENDING';
  }

  private buildLeaseSummary(lease: Lease): TenantDashboardLeaseSummaryDto {
    const unit = lease.unit as { unitNumber: string; property?: { name: string } } | undefined;
    const property = unit?.property;
    return {
      leaseId: lease.id,
      unitName: unit?.unitNumber ?? '',
      propertyName: property?.name ?? '',
      startDate:
        (lease.startDate as Date).toISOString?.()?.slice(0, 10) ??
        String(lease.startDate).slice(0, 10),
      endDate: lease.endDate
        ? (lease.endDate as Date).toISOString?.()?.slice(0, 10) ?? String(lease.endDate).slice(0, 10)
        : undefined,
    };
  }

  private async loadPaymentsForCycle(cycle: RentCycle): Promise<Payment[]> {
    let payments = await this.paymentRepository.find({
      where: { rentCycleId: cycle.id, isActive: true },
    });
    if (payments.length === 0) {
      payments = await this.paymentRepository.find({
        where: {
          leaseId: cycle.leaseId,
          period: cycle.period,
          rentCycleId: IsNull(),
          isActive: true,
          status: Not(PaymentStatus.REFUNDED),
        },
      });
    }
    return payments;
  }
}
