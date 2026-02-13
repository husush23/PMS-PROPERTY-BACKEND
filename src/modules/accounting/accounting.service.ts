import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { AccountingEntry } from './entities/accounting-entry.entity';
import { AccountingAccount } from './enums/accounting-account.enum';
import { AccountingEntryDirection } from './enums/accounting-entry-direction.enum';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Expense } from '../expense/entities/expense.entity';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { RentCycleStatus } from '../../shared/enums/rent-cycle-status.enum';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AccountingSummaryResponseDto } from './dto/accounting-summary-response.dto';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(AccountingEntry)
    private accountingEntryRepository: Repository<AccountingEntry>,
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
  ) {}

  async validateCompanyAccounting(companyId: string): Promise<void> {
    const rows = await this.accountingEntryRepository
      .createQueryBuilder('entry')
      .select('entry.account', 'account')
      .addSelect('entry.direction', 'direction')
      .addSelect('SUM(entry.amount)', 'total')
      .where('entry.companyId = :companyId', { companyId })
      .groupBy('entry.account')
      .addGroupBy('entry.direction')
      .getRawMany<{ account: string; direction: string; total: string }>();

    const totals = new Map<
      AccountingAccount,
      { debit: number; credit: number }
    >();

    for (const row of rows) {
      const account = row.account as AccountingAccount;
      const direction = row.direction as AccountingEntryDirection;
      const total = Number(row.total || 0);
      const current = totals.get(account) || { debit: 0, credit: 0 };
      if (direction === AccountingEntryDirection.DEBIT) {
        current.debit += total;
      } else {
        current.credit += total;
      }
      totals.set(account, current);
    }

    const cashTotals = totals.get(AccountingAccount.CASH) || {
      debit: 0,
      credit: 0,
    };
    const tenantCreditTotals =
      totals.get(AccountingAccount.TENANT_CREDIT_LIABILITY) || {
        debit: 0,
        credit: 0,
      };
    const securityDepositTotals =
      totals.get(AccountingAccount.SECURITY_DEPOSIT_LIABILITY) || {
        debit: 0,
        credit: 0,
      };

    const cashBalance = cashTotals.debit - cashTotals.credit;
    const tenantCreditBalance =
      tenantCreditTotals.credit - tenantCreditTotals.debit;
    const securityDepositBalance =
      securityDepositTotals.credit - securityDepositTotals.debit;

    if (cashBalance < 0) {
      this.logger.warn(
        `Accounting sanity check failed (CASH < 0) for company ${companyId}: ${cashBalance}`,
      );
    }

    if (tenantCreditBalance < 0) {
      this.logger.warn(
        `Accounting sanity check failed (TENANT_CREDIT_LIABILITY < 0) for company ${companyId}: ${tenantCreditBalance}`,
      );
    }

    if (securityDepositBalance < 0) {
      this.logger.warn(
        `Accounting sanity check failed (SECURITY_DEPOSIT_LIABILITY < 0) for company ${companyId}: ${securityDepositBalance}`,
      );
    }

    const combinedLiabilities = tenantCreditBalance + securityDepositBalance;
    if (cashBalance < combinedLiabilities) {
      this.logger.warn(
        `Accounting warning: CASH (${cashBalance}) < liabilities (${combinedLiabilities}) for company ${companyId}`,
      );
    }
  }

  /**
   * Read-only accounting summary for frontend dashboards.
   * No ledger exposure and no record creation.
   */
  async getSummary(
    companyId: string,
    requesterUserId: string,
  ): Promise<AccountingSummaryResponseDto> {
    // Rent income is recorded at invoice creation only.
    // Tenant credit balance is a liability, never income.
    await this.validateCompanyAccess(companyId, requesterUserId);

    const totalRentRow = await this.rentCycleRepository
      .createQueryBuilder('cycle')
      .select('COALESCE(SUM(cycle.totalAmountDue), 0)', 'total')
      .where('cycle.companyId = :companyId', { companyId })
      .andWhere('cycle.isVoid = false')
      .andWhere('cycle.isDeposit = false')
      .getRawOne<{ total: string }>();

    const paymentsRow = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.companyId = :companyId', { companyId })
      .andWhere('payment.isActive = true')
      .andWhere('payment.amount > 0')
      .andWhere('payment.status != :refunded', {
        refunded: PaymentStatus.REFUNDED,
      })
      .andWhere('payment.paymentMethod != :creditMethod', {
        creditMethod: PaymentMethod.CREDIT,
      })
      .getRawOne<{ total: string }>();

    const expensesRow = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.companyId = :companyId', { companyId })
      .getRawOne<{ total: string }>();

    const creditTotals = await this.getAccountBalance(
      AccountingAccount.TENANT_CREDIT_LIABILITY,
      companyId,
    );
    const depositTotals = await this.getAccountBalance(
      AccountingAccount.SECURITY_DEPOSIT_LIABILITY,
      companyId,
    );

    const rentCycles = await this.rentCycleRepository.find({
      where: { companyId, isVoid: false, isDeposit: false },
    });

    let totalOutstanding = 0;
    for (const cycle of rentCycles) {
      const payments = await this.paymentRepository.find({
        where: { rentCycleId: cycle.id, isActive: true },
      });

      const amountPaid = payments
        .filter(
          (payment) =>
            payment.status !== PaymentStatus.REFUNDED && payment.amount > 0,
        )
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      const totalAmountDue = Number(cycle.totalAmountDue);
      const balance = totalAmountDue - amountPaid;
      const status = this.calculateInvoiceStatus(cycle, balance);

      if (
        status === RentCycleStatus.DUE ||
        status === RentCycleStatus.OVERDUE
      ) {
        totalOutstanding += balance > 0 ? balance : 0;
      }
    }

    const totalRentIncome = Number(totalRentRow?.total || 0);
    const totalPaymentsReceived = Number(paymentsRow?.total || 0);
    const totalExpenses = Number(expensesRow?.total || 0);
    const totalCreditLiability = creditTotals.credit - creditTotals.debit;
    const totalDepositsLiability = depositTotals.credit - depositTotals.debit;
    // Net position = income minus expenses (liabilities shown separately on UI).
    const netPosition = totalRentIncome - totalExpenses;

    return {
      totalRentIncome,
      totalPaymentsReceived,
      totalOutstandingReceivables: totalOutstanding,
      totalExpenses,
      totalCreditLiability,
      totalDepositsLiability,
      netPosition,
    };
  }

  private calculateInvoiceStatus(
    rentCycle: RentCycle,
    balance: number,
  ): RentCycleStatus {
    if (rentCycle.isVoid) {
      return RentCycleStatus.VOID;
    }

    if (balance <= 0) {
      return RentCycleStatus.PAID;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(rentCycle.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const periodStartDate = rentCycle.periodStartDate
      ? new Date(rentCycle.periodStartDate)
      : null;
    if (periodStartDate) {
      periodStartDate.setHours(0, 0, 0, 0);
    }

    if (periodStartDate && today < periodStartDate) {
      return RentCycleStatus.PENDING;
    }

    const periodStart = periodStartDate || dueDate;
    if (today >= periodStart && today <= dueDate) {
      return RentCycleStatus.DUE;
    }

    if (today > dueDate) {
      return RentCycleStatus.OVERDUE;
    }

    return RentCycleStatus.DUE;
  }

  /**
   * Get tenant credit balance (liability) for a specific tenant.
   * Read-only; returns a single number. No ledger exposure.
   */
  async getTenantCreditBalance(
    companyId: string,
    tenantId: string,
  ): Promise<number> {
    const rows = await this.accountingEntryRepository
      .createQueryBuilder('entry')
      .select('entry.direction', 'direction')
      .addSelect('COALESCE(SUM(entry.amount), 0)', 'total')
      .where('entry.companyId = :companyId', { companyId })
      .andWhere('entry.tenantId = :tenantId', { tenantId })
      .andWhere('entry.account = :account', {
        account: AccountingAccount.TENANT_CREDIT_LIABILITY,
      })
      .groupBy('entry.direction')
      .getRawMany<{ direction: string; total: string }>();

    let debit = 0;
    let credit = 0;
    for (const row of rows) {
      if (row.direction === AccountingEntryDirection.DEBIT) {
        debit = Number(row.total || 0);
      } else {
        credit = Number(row.total || 0);
      }
    }
    return credit - debit;
  }

  private async getAccountBalance(
    account: AccountingAccount,
    companyId: string,
  ): Promise<{ debit: number; credit: number }> {
    const rows = await this.accountingEntryRepository
      .createQueryBuilder('entry')
      .select('entry.direction', 'direction')
      .addSelect('COALESCE(SUM(entry.amount), 0)', 'total')
      .where('entry.companyId = :companyId', { companyId })
      .andWhere('entry.account = :account', { account })
      .groupBy('entry.direction')
      .getRawMany<{ direction: string; total: string }>();

    const totals = { debit: 0, credit: 0 };
    for (const row of rows) {
      if (row.direction === AccountingEntryDirection.DEBIT) {
        totals.debit = Number(row.total || 0);
      } else {
        totals.credit = Number(row.total || 0);
      }
    }
    return totals;
  }

  private async validateCompanyAccess(
    companyId: string,
    requesterUserId: string,
  ): Promise<void> {
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;
    if (isSuperAdmin) {
      return;
    }

    const requester = await this.userCompanyRepository.findOne({
      where: {
        companyId,
        userId: requesterUserId,
        isActive: true,
      },
    });

    if (!requester || requester.role === UserRole.TENANT) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
