import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { AccountingEntry } from './entities/accounting-entry.entity';

@Injectable()
export class AccountingEntryRepository {
  constructor(
    @InjectRepository(AccountingEntry)
    private readonly repository: Repository<AccountingEntry>,
  ) {}

  create(data: DeepPartial<AccountingEntry>): AccountingEntry {
    return this.repository.create(data);
  }

  save(entry: AccountingEntry): Promise<AccountingEntry> {
    return this.repository.save(entry);
  }

  findById(id: string): Promise<AccountingEntry | null> {
    return this.repository.findOne({ where: { id } });
  }
}
