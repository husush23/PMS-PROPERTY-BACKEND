import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingEntry } from './entities/accounting-entry.entity';
import { AccountingEntryRepository } from './accounting-entry.repository';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Expense } from '../expense/entities/expense.entity';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountingEntry,
      RentCycle,
      Payment,
      Lease,
      Expense,
      User,
      UserCompany,
    ]),
  ],
  controllers: [AccountingController],
  providers: [AccountingEntryRepository, AccountingService],
  exports: [AccountingEntryRepository, AccountingService],
})
export class AccountingModule {}
