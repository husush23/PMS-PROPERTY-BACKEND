import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { LeaseService } from './lease.service';

@Injectable()
export class LeaseSchedulerService {
  private readonly logger = new Logger(LeaseSchedulerService.name);

  constructor(
    @Inject(forwardRef(() => LeaseService))
    private readonly leaseService: LeaseService,
  ) {}

  /**
   * Check and activate leases whose start date has been reached
   * Should be called daily (e.g., at midnight or early morning)
   */
  async checkAndActivateLeases(): Promise<void> {
    this.logger.log('Starting lease activation check job...');
    try {
      await this.leaseService.checkAndActivateLeases();
      this.logger.log('Lease activation check job completed successfully');
    } catch (error) {
      this.logger.error(
        `Error in lease activation check job: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
