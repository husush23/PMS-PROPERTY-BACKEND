import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { Payment } from './entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentType } from '../../shared/enums/payment-type.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import { PaymentMethodEntity } from '../payment-method/entities/payment-method.entity';
import {
  calculateNextDueDate,
  getPeriodsSinceStart,
} from '../../common/utils/rent-due-date.util';
import {
  calculateProratedMonthlyRentAmount,
  getLeaseBillingStart,
  isMidMonthProratedFirstCycle,
  periodKeyUtcMonth,
  proratedDayCountForFirstMonth,
  toUtcDateOnly,
} from '../../common/utils/rent-proration.util';

@Injectable()
export class RentGenerationService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(PaymentMethodEntity)
    private paymentMethodRepository: Repository<PaymentMethodEntity>,
  ) {}

  /**
   * Generate first payment when lease is activated
   */
  async generateFirstPayment(leaseId: string): Promise<Payment> {
    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND_FOR_PAYMENT,
        ERROR_MESSAGES.LEASE_NOT_FOUND_FOR_PAYMENT,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_ACTIVE,
        `Cannot generate payment for lease with status '${lease.status}'. Only active leases can have payments generated.`,
        HttpStatus.BAD_REQUEST,
        {
          leaseId,
          status: lease.status,
          message: `The lease must be ACTIVE to generate payments. Current status: ${lease.status}`,
        },
      );
    }

    // Check if first payment already exists
    const existingPayment = await this.paymentRepository.findOne({
      where: {
        leaseId,
        period: this.getFirstPeriod(lease),
        isActive: true,
      },
    });

    if (existingPayment) {
      return existingPayment;
    }

    // Calculate due date and amount (rent cycles are authoritative; keep parity for legacy payments)
    const billingStart = getLeaseBillingStart(lease);
    const billingAnchorDay =
      lease.billingAnchorDay || billingStart.getUTCDate();
    const paymentFrequency =
      lease.paymentFrequency || PaymentFrequency.MONTHLY;
    const dueDate = isMidMonthProratedFirstCycle(lease)
      ? toUtcDateOnly(billingStart)
      : calculateNextDueDate({
          billingStartDate: billingStart,
          billingAnchorDay,
          paymentFrequency,
          cyclesAhead: 0,
        });

    let amountDue = Number(lease.monthlyRent);
    if (lease.proratedFirstMonth) {
      amountDue = calculateProratedMonthlyRentAmount(
        amountDue,
        billingStart,
      );
    }

    // Add pet rent if applicable
    if (lease.petRent) {
      amountDue += Number(lease.petRent);
    }

    // Add utility costs if not included
    if (!lease.utilitiesIncluded && lease.utilityCosts) {
      amountDue += Number(lease.utilityCosts);
    }

    const period = this.getFirstPeriod(lease);

    const systemMethodId = await this.getSystemPaymentMethodId();
    const payment = this.paymentRepository.create({
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      leaseId: lease.id,
      amount: amountDue,
      amountDue: amountDue,
      amountPaid: 0,
      balance: amountDue,
      currency: lease.currency,
      paymentDate: new Date(),
      dueDate: dueDate,
      paymentMethod: PaymentMethod.OTHER, // System-generated
      paymentMethodId: systemMethodId,
      paymentType: PaymentType.RENT,
      status: PaymentStatus.PENDING,
      period: period,
      isPartial: false,
      recordedBy: lease.createdBy || lease.tenantId, // System or lease creator
      notes: isMidMonthProratedFirstCycle(lease)
        ? `First month prorated rent (${proratedDayCountForFirstMonth(billingStart)} days)`
        : 'First month rent',
    });

    const savedPayment = await this.paymentRepository.save(payment);

    return savedPayment;
  }

  /**
   * Generate monthly payments for all active leases (cron job)
   */
  async generateMonthlyPayments(): Promise<void> {
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
        // Skip if lease has ended
        if (lease.endDate < today) {
          continue;
        }

        const billingStart = lease.billingStartDate || lease.startDate;
        const billingAnchorDay =
          lease.billingAnchorDay || billingStart.getUTCDate();
        const periodsSinceStart = getPeriodsSinceStart(
          billingStart,
          today,
          PaymentFrequency.MONTHLY,
        );
        const nextDueDate = calculateNextDueDate({
          billingStartDate: billingStart,
          billingAnchorDay,
          paymentFrequency: PaymentFrequency.MONTHLY,
          cyclesAhead: periodsSinceStart,
        });

        // Check if we need to generate payment (due date is today or in the past)
        if (nextDueDate <= today) {
          // Check if payment for this period already exists (prevent duplicates)
          const period = this.getPeriodForDate(nextDueDate);
          const existingPayment = await this.paymentRepository.findOne({
            where: {
              leaseId: lease.id,
              period: period,
              paymentType: PaymentType.RENT,
              isActive: true,
            },
          });

          if (!existingPayment) {
            // Generate payment
            await this.generatePaymentForPeriod(lease, nextDueDate, period);

          }
        }
      } catch (error) {
        // Log error but continue with other leases
        console.error(
          `Error generating payment for lease ${lease.id}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Generate payment for a specific period
   */
  private async generatePaymentForPeriod(
    lease: Lease,
    dueDate: Date,
    period: string,
  ): Promise<Payment> {
    let amountDue = Number(lease.monthlyRent);

    // Add pet rent if applicable
    if (lease.petRent) {
      amountDue += Number(lease.petRent);
    }

    // Add utility costs if not included
    if (!lease.utilitiesIncluded && lease.utilityCosts) {
      amountDue += Number(lease.utilityCosts);
    }

    const systemMethodId = await this.getSystemPaymentMethodId();
    const payment = this.paymentRepository.create({
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      leaseId: lease.id,
      amount: amountDue,
      amountDue: amountDue,
      amountPaid: 0,
      balance: amountDue,
      currency: lease.currency,
      paymentDate: new Date(),
      dueDate: dueDate,
      paymentMethod: PaymentMethod.OTHER, // System-generated
      paymentMethodId: systemMethodId,
      paymentType: PaymentType.RENT,
      status: PaymentStatus.PENDING,
      period: period,
      isPartial: false,
      recordedBy: lease.createdBy || lease.tenantId,
      notes: `Monthly rent for ${period}`,
    });

    return await this.paymentRepository.save(payment);
  }

  /**
   * Get first period string (YYYY-MM)
   */
  private getFirstPeriod(lease: Lease): string {
    return periodKeyUtcMonth(getLeaseBillingStart(lease));
  }

  /**
   * Get period string for a given date (YYYY-MM)
   */
  private getPeriodForDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }


  private async getSystemPaymentMethodId(): Promise<string | null> {
    const method = await this.paymentMethodRepository.findOne({
      where: { isGlobal: true, code: PaymentMethod.OTHER },
    });
    return method?.id || null;
  }
}

