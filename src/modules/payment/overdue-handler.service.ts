import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentType } from '../../shared/enums/payment-type.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { LateFeeType } from '../../shared/enums/late-fee-type.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';

@Injectable()
export class OverdueHandlerService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
  ) {}

  /**
   * Check and mark overdue payments, apply late fees (cron job)
   */
  async checkAndMarkOverdue(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find payments that are past due date + grace period and not fully paid
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.lease', 'lease')
      .where('payment.status IN (:...statuses)', {
        statuses: [PaymentStatus.PENDING, PaymentStatus.PARTIAL],
      })
      .andWhere('payment.balance > 0')
      .andWhere('payment.isActive = :isActive', { isActive: true })
      .andWhere('lease.status = :leaseStatus', {
        leaseStatus: LeaseStatus.ACTIVE,
      })
      .getMany();

    for (const payment of payments) {
      try {
        const lease = payment.lease;
        if (!lease) {
          continue;
        }

        // Calculate grace period end date
        const gracePeriodEnd = new Date(payment.dueDate);
        gracePeriodEnd.setDate(
          gracePeriodEnd.getDate() + (lease.gracePeriodDays || 0),
        );

        // Check if payment is overdue (past grace period)
        if (today > gracePeriodEnd && payment.balance > 0) {
          // Mark as overdue if not already
          if (payment.status !== PaymentStatus.OVERDUE) {
            await this.paymentRepository.update(payment.id, {
              status: PaymentStatus.OVERDUE,
            });
          }

          // Apply late fee if not already applied
          if (!payment.lateFeeApplied && lease.lateFeeType !== LateFeeType.NONE) {
            await this.applyLateFee(payment.id);
          }
        }
      } catch (error) {
        // Log error but continue with other payments
        console.error(
          `Error processing overdue payment ${payment.id}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Apply late fee to a payment
   */
  private async applyLateFee(paymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['lease'],
    });

    if (!payment || !payment.lease) {
      return;
    }

    const lease = payment.lease;
    const lateFeeAmount = this.calculateLateFee(lease, payment);

    if (lateFeeAmount > 0) {
      // Update payment balance with late fee
      const newBalance = Number(payment.balance) + lateFeeAmount;
      const newAmountDue = Number(payment.amountDue) + lateFeeAmount;

      await this.paymentRepository.update(payment.id, {
        lateFeeApplied: true,
        balance: newBalance,
        amountDue: newAmountDue,
        notes: payment.notes
          ? `${payment.notes}\nLate fee applied: ${lease.currency} ${lateFeeAmount.toFixed(2)}`
          : `Late fee applied: ${lease.currency} ${lateFeeAmount.toFixed(2)}`,
      });

      // Create a separate late fee payment record for tracking
      const lateFeePayment = this.paymentRepository.create({
        companyId: payment.companyId,
        tenantId: payment.tenantId,
        leaseId: payment.leaseId,
        amount: lateFeeAmount,
        amountDue: lateFeeAmount,
        amountPaid: 0,
        balance: lateFeeAmount,
        currency: lease.currency,
        paymentDate: new Date(),
        dueDate: payment.dueDate, // Same due date as original payment
        paymentMethod: PaymentMethod.OTHER, // System-generated
        paymentType: PaymentType.LATE_FEE,
        status: PaymentStatus.PENDING,
        period: payment.period,
        isPartial: false,
        recordedBy: lease.createdBy || payment.tenantId,
        notes: `Late fee for payment period ${payment.period}`,
      });

      await this.paymentRepository.save(lateFeePayment);
    } else {
      // Mark as applied even if amount is 0 (NONE type)
      await this.paymentRepository.update(payment.id, {
        lateFeeApplied: true,
      });
    }
  }

  /**
   * Calculate late fee amount based on lease configuration
   */
  private calculateLateFee(lease: Lease, payment: Payment): number {
    if (lease.lateFeeType === LateFeeType.NONE) {
      return 0;
    }

    if (lease.lateFeeType === LateFeeType.FIXED) {
      // Use lateFeeValue if set, otherwise fall back to lateFeeAmount
      return Number(lease.lateFeeValue || lease.lateFeeAmount || 0);
    }

    if (lease.lateFeeType === LateFeeType.PERCENTAGE) {
      // Calculate percentage of amountDue
      const percentage = Number(lease.lateFeeValue || 0);
      if (percentage > 0) {
        return Math.round((Number(payment.amountDue) * percentage) / 100 * 100) / 100;
      }
    }

    return 0;
  }
}

