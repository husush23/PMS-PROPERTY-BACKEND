import { Injectable, Logger } from '@nestjs/common';
import { RentGenerationService } from './rent-generation.service';
import { OverdueHandlerService } from './overdue-handler.service';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);

  constructor(
    private readonly rentGenerationService: RentGenerationService,
    private readonly overdueHandlerService: OverdueHandlerService,
  ) {}

  /**
   * Generate monthly payments for all active leases
   * Should be called daily (e.g., at 2 AM)
   */
  async generateMonthlyPayments(): Promise<void> {
    this.logger.log('Starting monthly rent generation job...');
    try {
      await this.rentGenerationService.generateMonthlyPayments();
      this.logger.log('Monthly rent generation job completed successfully');
    } catch (error) {
      this.logger.error(
        `Error in monthly rent generation job: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check and mark overdue payments, apply late fees
   * Should be called daily (e.g., at 3 AM)
   */
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

