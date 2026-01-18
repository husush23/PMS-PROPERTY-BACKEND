import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { Expense } from './entities/expense.entity';
import { ExpenseRepository } from './expense.repository';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { ExpenseSummaryResponseDto } from './dto/expense-summary-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { UserRole } from '../../shared/enums/user-role.enum';

@Injectable()
export class ExpenseService {
  constructor(
    private readonly expenseRepository: ExpenseRepository,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
  ) {}

  /**
   * MVP EXPENSE TRACKING ONLY:
   * - Does not affect rent, payments, invoices, or credit balance.
   * - No accounting ledger logic is implemented here.
   */
  async create(
    createDto: CreateExpenseDto,
    requesterUserId: string,
  ): Promise<ExpenseResponseDto> {
    await this.validateCompanyAccess(createDto.companyId, requesterUserId);

    const expense = this.expenseRepository.create({
      companyId: createDto.companyId,
      propertyId: createDto.propertyId || null,
      leaseId: createDto.leaseId || null,
      category: createDto.category,
      description: createDto.description || null,
      amount: createDto.amount,
      expenseDate: new Date(createDto.expenseDate),
      createdBy: requesterUserId,
    });

    const saved = await this.expenseRepository.save(expense);
    return this.toResponseDto(saved);
  }

  async findAll(
    queryDto: ListExpensesQueryDto,
    requesterUserId: string,
  ): Promise<{
    data: ExpenseResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    await this.validateCompanyAccess(queryDto.companyId, requesterUserId);

    const page = queryDto.page || 1;
    const limit = Math.min(queryDto.limit || 10, 100);
    const skip = (page - 1) * limit;

    const queryBuilder = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.companyId = :companyId', {
        companyId: queryDto.companyId,
      });

    if (queryDto.propertyId) {
      queryBuilder.andWhere('expense.propertyId = :propertyId', {
        propertyId: queryDto.propertyId,
      });
    }

    if (queryDto.leaseId) {
      queryBuilder.andWhere('expense.leaseId = :leaseId', {
        leaseId: queryDto.leaseId,
      });
    }

    if (queryDto.category) {
      queryBuilder.andWhere('expense.category = :category', {
        category: queryDto.category,
      });
    }

    if (queryDto.fromDate) {
      queryBuilder.andWhere('expense.expenseDate >= :fromDate', {
        fromDate: queryDto.fromDate,
      });
    }

    if (queryDto.toDate) {
      queryBuilder.andWhere('expense.expenseDate <= :toDate', {
        toDate: queryDto.toDate,
      });
    }

    queryBuilder.orderBy('expense.expenseDate', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    const expenses = await queryBuilder.getMany();

    return {
      data: expenses.map((expense) => this.toResponseDto(expense)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSummary(
    queryDto: ListExpensesQueryDto,
    requesterUserId: string,
  ): Promise<ExpenseSummaryResponseDto> {
    // Expenses are not linked to rent cycles; they only reduce net income in summaries.
    await this.validateCompanyAccess(queryDto.companyId, requesterUserId);

    const baseQuery = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.companyId = :companyId', {
        companyId: queryDto.companyId,
      });

    if (queryDto.propertyId) {
      baseQuery.andWhere('expense.propertyId = :propertyId', {
        propertyId: queryDto.propertyId,
      });
    }

    if (queryDto.leaseId) {
      baseQuery.andWhere('expense.leaseId = :leaseId', {
        leaseId: queryDto.leaseId,
      });
    }

    if (queryDto.category) {
      baseQuery.andWhere('expense.category = :category', {
        category: queryDto.category,
      });
    }

    if (queryDto.fromDate) {
      baseQuery.andWhere('expense.expenseDate >= :fromDate', {
        fromDate: queryDto.fromDate,
      });
    }

    if (queryDto.toDate) {
      baseQuery.andWhere('expense.expenseDate <= :toDate', {
        toDate: queryDto.toDate,
      });
    }

    const totalRow = await baseQuery
      .clone()
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne<{ total: string }>();

    const categoryRows = await baseQuery
      .clone()
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('expense.category')
      .getRawMany<{ category: string; total: string }>();

    const expensesByCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      expensesByCategory[row.category] = Number(row.total || 0);
    }

    return {
      totalExpenses: Number(totalRow?.total || 0),
      expensesByCategory,
    } as ExpenseSummaryResponseDto;
  }

  async update(
    id: string,
    updateDto: UpdateExpenseDto,
    requesterUserId: string,
  ): Promise<ExpenseResponseDto> {
    const expense = await this.expenseRepository.findOneById(id);
    if (!expense) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Expense not found',
        HttpStatus.NOT_FOUND,
        { expenseId: id },
      );
    }

    await this.validateCompanyAccess(expense.companyId, requesterUserId);

    if (updateDto.propertyId !== undefined) {
      expense.propertyId = updateDto.propertyId || null;
    }
    if (updateDto.leaseId !== undefined) {
      expense.leaseId = updateDto.leaseId || null;
    }
    if (updateDto.category !== undefined) {
      expense.category = updateDto.category;
    }
    if (updateDto.description !== undefined) {
      expense.description = updateDto.description || null;
    }
    if (updateDto.amount !== undefined) {
      expense.amount = updateDto.amount;
    }
    if (updateDto.expenseDate !== undefined) {
      expense.expenseDate = new Date(updateDto.expenseDate);
    }

    const saved = await this.expenseRepository.save(expense);
    return this.toResponseDto(saved);
  }

  async remove(id: string, requesterUserId: string): Promise<void> {
    const expense = await this.expenseRepository.findOneById(id);
    if (!expense) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Expense not found',
        HttpStatus.NOT_FOUND,
        { expenseId: id },
      );
    }

    await this.validateCompanyAccess(expense.companyId, requesterUserId);
    await this.expenseRepository.deleteById(id);
  }

  private toResponseDto(expense: Expense): ExpenseResponseDto {
    return {
      id: expense.id,
      companyId: expense.companyId,
      propertyId: expense.propertyId || null,
      leaseId: expense.leaseId || null,
      category: expense.category,
      description: expense.description || null,
      amount: Number(expense.amount),
      expenseDate: expense.expenseDate,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
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
