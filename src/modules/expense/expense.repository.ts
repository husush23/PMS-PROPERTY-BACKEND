import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository, SelectQueryBuilder } from 'typeorm';
import { Expense } from './entities/expense.entity';

@Injectable()
export class ExpenseRepository {
  constructor(
    @InjectRepository(Expense)
    private readonly repository: Repository<Expense>,
  ) {}

  create(data: DeepPartial<Expense>): Expense {
    return this.repository.create(data);
  }

  save(expense: Expense): Promise<Expense> {
    return this.repository.save(expense);
  }

  findOneById(id: string): Promise<Expense | null> {
    return this.repository.findOne({ where: { id } });
  }

  deleteById(id: string): Promise<void> {
    return this.repository.delete(id).then(() => undefined);
  }

  createQueryBuilder(alias: string): SelectQueryBuilder<Expense> {
    return this.repository.createQueryBuilder(alias);
  }
}
