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

    // Calculate due date and amount
    const billingStart = lease.billingStartDate || lease.startDate;
    const rentDueDay = lease.rentDueDay || this.getDayOfMonth(billingStart);
    const dueDate = this.calculateDueDate(billingStart, rentDueDay, 0);

    let amountDue = Number(lease.monthlyRent);
    if (lease.proratedFirstMonth) {
      amountDue = this.calculateProratedAmount(lease);
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
      notes: lease.proratedFirstMonth
        ? 'First month prorated rent'
        : 'First month rent',
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update lease nextRentDueDate
    const nextDueDate = this.calculateDueDate(billingStart, rentDueDay, 1);
    await this.leaseRepository.update(leaseId, {
      nextRentDueDate: nextDueDate,
    });

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
        const rentDueDay = lease.rentDueDay || this.getDayOfMonth(billingStart);

        // Calculate next due date
        const nextDueDate = lease.nextRentDueDate
          ? new Date(lease.nextRentDueDate)
          : this.calculateDueDate(billingStart, rentDueDay, 0);

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
            if (newNextDueDate <= lease.endDate) {
              await this.leaseRepository.update(lease.id, {
                nextRentDueDate: newNextDueDate,
              });
            }
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
   * Calculate due date based on billing start date and rent due day
   */
  private calculateDueDate(
    billingStart: Date,
    rentDueDay: number,
    periodOffset: number,
  ): Date {
    const start = new Date(billingStart);
    const dueDate = new Date(
      start.getFullYear(),
      start.getMonth() + periodOffset,
      rentDueDay,
    );

    // If day doesn't exist in month (e.g., Feb 30), use last day of month
    if (dueDate.getDate() !== rentDueDay) {
      dueDate.setDate(0); // Last day of previous month
    }

    return dueDate;
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
   * Get first period string (YYYY-MM)
   */
  private getFirstPeriod(lease: Lease): string {
    const billingStart = lease.billingStartDate
      ? new Date(lease.billingStartDate)
      : new Date(lease.startDate);
    return `${billingStart.getFullYear()}-${String(billingStart.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get period string for a given date (YYYY-MM)
   */
  private getPeriodForDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
  private getMonthsDifference(date1: Date, date2: Date): number {
    const years = date2.getFullYear() - date1.getFullYear();
    const months = date2.getMonth() - date1.getMonth();
    return years * 12 + months;
  }

  private async getSystemPaymentMethodId(): Promise<string | null> {
    const method = await this.paymentMethodRepository.findOne({
      where: { isGlobal: true, code: PaymentMethod.OTHER },
    });
    return method?.id || null;
  }
}

