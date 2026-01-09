import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RentGenerationService } from './rent-generation.service';
import { OverdueHandlerService } from './overdue-handler.service';
import { PaymentService } from './payment.service';
import { RentCycleGenerationService } from '../rent-cycle/rent-cycle-generation.service';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);

  constructor(
    private readonly rentGenerationService: RentGenerationService,
    private readonly overdueHandlerService: OverdueHandlerService,
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => RentCycleGenerationService))
    private readonly rentCycleGenerationService: RentCycleGenerationService,
  ) {}

  /**
   * Generate rent cycles for all active leases (supports all payment frequencies)
   * Runs daily at 2 AM to generate new invoices when period starts
   */
  @Cron('0 2 * * *') // Daily at 2:00 AM
  async generateMonthlyPayments(): Promise<void> {
    this.logger.log('Starting rent cycle generation job...');
    try {
      await this.rentCycleGenerationService.generateRentCycles();
      this.logger.log('Rent cycle generation job completed successfully');
    } catch (error) {
      this.logger.error(
        `Error in rent cycle generation job: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check and mark payments as DUE when due date arrives
   * Runs daily at 1 AM before overdue check
   */
  @Cron('0 1 * * *') // Daily at 1:00 AM
  async checkAndMarkDue(): Promise<void> {
    this.logger.log('Starting due payment check job...');
    try {
      await this.paymentService.checkAndMarkDue();
      this.logger.log('Due payment check job completed successfully');
    } catch (error) {
      this.logger.error(
        `Error in due payment check job: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check and mark overdue payments, apply late fees
   * Updates invoice statuses (DUE → OVERDUE) when past grace period
   * Runs daily at 3 AM after due check
   */
  @Cron('0 3 * * *') // Daily at 3:00 AM
  async checkAndMarkOverdue(): Promise<void> {
    this.logger.log('Starting overdue payment check job...');
    try {
      await this.overdueHandlerService.checkAndMarkOverdue();
      this.logger.log('Overdue payment check job completed successfully');
    } catch (error) {
      this.logger.error(
        `Error in overdue payment check job: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

