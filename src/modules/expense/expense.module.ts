import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { ExpenseRepository } from './expense.repository';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, User, UserCompany])],
  controllers: [ExpenseController],
  providers: [ExpenseRepository, ExpenseService],
  exports: [ExpenseService],
})
export class ExpenseModule {}
