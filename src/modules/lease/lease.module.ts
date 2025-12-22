import { Module } from '@nestjs/common';
import { LeaseController } from './lease.controller';
import { LeaseService } from './lease.service';

@Module({
  controllers: [LeaseController],
  providers: [LeaseService],
  exports: [LeaseService],
})
export class LeaseModule {}









