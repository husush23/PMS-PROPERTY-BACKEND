import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';
import { CreateRentCycleDto } from './dto/create-rent-cycle.dto';
import { RentCycleResponseDto } from './dto/rent-cycle-response.dto';
import { ListRentCyclesQueryDto } from './dto/list-rent-cycles-query.dto';
import { RentCycleStatus } from '../../shared/enums/rent-cycle-status.enum';
import { RentCycleLineItemType } from '../../shared/enums/rent-cycle-line-item-type.enum';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { UserRole } from '../../shared/enums/user-role.enum';

@Injectable()
export class RentCycleService {
  constructor(
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(RentCycleLineItem)
    private lineItemRepository: Repository<RentCycleLineItem>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(
    createDto: CreateRentCycleDto,
    requesterUserId: string,
  ): Promise<RentCycleResponseDto> {
    // Validate lease exists
    const lease = await this.leaseRepository.findOne({
      where: { id: createDto.leaseId, isActive: true },
      relations: ['tenant'],
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND_FOR_PAYMENT,
        ERROR_MESSAGES.LEASE_NOT_FOUND_FOR_PAYMENT,
        HttpStatus.NOT_FOUND,
        { leaseId: createDto.leaseId },
      );
    }

    // Check company access
    await this.validateCompanyAccess(lease.companyId, requesterUserId);

    // Check if cycle already exists for this lease + period
    const existing = await this.rentCycleRepository.findOne({
      where: {
        leaseId: createDto.leaseId,
        period: createDto.period,
      },
    });

    if (existing) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Rent cycle already exists for this lease and period',
        HttpStatus.BAD_REQUEST,
        { leaseId: createDto.leaseId, period: createDto.period },
      );
    }

    // Calculate total amount from line items
    const totalAmountDue = createDto.lineItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    // Generate invoice number - now checks globally for uniqueness
    let invoiceNumber = await this.generateInvoiceNumber(
      lease.companyId,
      createDto.period,
    );

    // Double-check if this invoice number already exists (race condition protection)
    const existingWithNumber = await this.rentCycleRepository.findOne({
      where: { invoiceNumber },
    });

    if (existingWithNumber) {
      // If it exists, generate a new one with a higher sequence
      // This handles the rare race condition where two requests generate the same number
      const [year, month] = createDto.period.split('-');
      const prefix = `INV-${year}-${month}-`;
      
      // Get all existing invoice numbers for this period
      const allExisting = await this.rentCycleRepository
        .createQueryBuilder('cycle')
        .where('cycle.invoiceNumber LIKE :prefix', {
          prefix: `${prefix}%`,
        })
        .select('cycle.invoiceNumber', 'invoiceNumber')
        .getRawMany();

      // Extract all sequence numbers
      const usedSequences = allExisting
        .map((inv) => {
          const parts = inv.invoiceNumber.split('-');
          const seq = parseInt(parts[parts.length - 1] || '0', 10);
          return isNaN(seq) ? 0 : seq;
        })
        .filter((seq) => seq > 0)
        .sort((a, b) => b - a);

      // Use the highest sequence + 1
      const nextSequence = usedSequences.length > 0 ? usedSequences[0] + 1 : 1;
      invoiceNumber = `${prefix}${nextSequence.toString().padStart(3, '0')}`;
      
      // Final check - if this also exists, something is very wrong
      const finalCheck = await this.rentCycleRepository.findOne({
        where: { invoiceNumber },
      });
      
      if (finalCheck) {
        throw new BusinessException(
          ErrorCode.INTERNAL_SERVER_ERROR,
          'Unable to generate unique invoice number. Please contact support.',
          HttpStatus.INTERNAL_SERVER_ERROR,
          { period: createDto.period },
        );
      }
    }

    // Safety check: invoiceNumber should always be assigned at this point
    if (!invoiceNumber) {
      throw new BusinessException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Failed to generate invoice number',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { period: createDto.period },
      );
    }

    // Create rent cycle
    const rentCycle = this.rentCycleRepository.create({
      leaseId: createDto.leaseId,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber,
      period: createDto.period,
      dueDate: new Date(createDto.dueDate),
      totalAmountDue,
    });

    let savedCycle: RentCycle;
    try {
      savedCycle = await this.rentCycleRepository.save(rentCycle);
    } catch (error: any) {
      // Handle duplicate invoice number error (race condition)
      // PostgreSQL error code 23505 = unique_violation
      // Check both constraint name and error message
      if (
        error.code === '23505' ||
        (error.constraint &&
          error.constraint.includes('UQ_rent_cycles_invoice_number')) ||
        (error.message &&
          error.message.includes('UQ_rent_cycles_invoice_number'))
      ) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          'An invoice with this number already exists. This may happen if multiple invoices are being created simultaneously. Please try again.',
          HttpStatus.BAD_REQUEST,
          {
            invoiceNumber,
            period: createDto.period,
            message: 'Invoice number conflict detected. Please retry the request.',
          },
        );
      }
      // Re-throw other errors
      throw error;
    }

    // Create line items
    const lineItems = createDto.lineItems.map((item) =>
      this.lineItemRepository.create({
        rentCycleId: savedCycle.id,
        type: item.type,
        amount: item.amount,
        description: item.description,
        isLateFee: item.type === 'LATE_FEE',
      }),
    );

    await this.lineItemRepository.save(lineItems);

    // Reload with relations
    const cycleWithRelations = await this.rentCycleRepository.findOne({
      where: { id: savedCycle.id },
      relations: ['lease', 'lineItems', 'payments'],
    });

    return this.toResponseDto(cycleWithRelations!, requesterUserId);
  }

  async findAll(
    queryDto: ListRentCyclesQueryDto,
    requesterUserId: string,
  ): Promise<{
    data: RentCycleResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = queryDto.page || 1;
    const limit = Math.min(queryDto.limit || 10, 100);
    const skip = (page - 1) * limit;

    // Check if user is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    // Check if user is a tenant
    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: requesterUserId, isActive: true },
    });
    const isTenant = userCompany?.role === UserRole.TENANT;

    const queryBuilder = this.rentCycleRepository
      .createQueryBuilder('rentCycle')
      .leftJoinAndSelect('rentCycle.lease', 'lease')
      .leftJoinAndSelect('rentCycle.lineItems', 'lineItems')
      .leftJoin('lease.tenant', 'tenant')
      .addSelect(['tenant.id', 'tenant.name', 'tenant.email']);

    // Company scoping and tenant filtering
    if (!isSuperAdmin) {
      if (isTenant) {
        // Tenants can only see their own invoices
        queryBuilder.andWhere('rentCycle.tenantId = :tenantId', {
          tenantId: requesterUserId,
        });
      } else {
        // Admins/Managers/Staff can see invoices in their companies
        const userCompanies = await this.userCompanyRepository.find({
          where: { userId: requesterUserId, isActive: true },
          select: ['companyId'],
        });

        if (userCompanies.length === 0) {
          return {
            data: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
            },
          };
        }

        const companyIds = userCompanies.map((uc) => uc.companyId);
        queryBuilder.andWhere('rentCycle.companyId IN (:...companyIds)', {
          companyIds,
        });
      }
    }

    // Apply filters
    if (queryDto.leaseId) {
      queryBuilder.andWhere('rentCycle.leaseId = :leaseId', {
        leaseId: queryDto.leaseId,
      });
    }

    if (queryDto.tenantId) {
      queryBuilder.andWhere('rentCycle.tenantId = :tenantId', {
        tenantId: queryDto.tenantId,
      });
    }

    if (queryDto.companyId) {
      queryBuilder.andWhere('rentCycle.companyId = :companyId', {
        companyId: queryDto.companyId,
      });
    }

    if (queryDto.statuses) {
      // Note: Status is calculated, so we'll filter after calculation
      // For now, we'll load all and filter in memory
      // In production, you might want to add a computed column or materialized view
    }

    if (queryDto.dueDateFrom) {
      queryBuilder.andWhere('rentCycle.dueDate >= :dueDateFrom', {
        dueDateFrom: queryDto.dueDateFrom,
      });
    }

    if (queryDto.dueDateTo) {
      queryBuilder.andWhere('rentCycle.dueDate <= :dueDateTo', {
        dueDateTo: queryDto.dueDateTo,
      });
    }

    if (queryDto.upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      queryBuilder.andWhere('rentCycle.dueDate >= :today', {
        today: today.toISOString().split('T')[0],
      });
    }

    // Sorting
    const sortBy = queryDto.sortBy || 'dueDate';
    const sortOrder = queryDto.sortOrder || 'ASC';
    queryBuilder.orderBy(`rentCycle.${sortBy}`, sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const cycles = await queryBuilder.getMany();

    // Load payments for each cycle
    const cyclesWithPayments = await Promise.all(
      cycles.map(async (cycle) => {
        const payments = await this.loadPaymentsForCycle(cycle);
        return { ...cycle, payments };
      }),
    );

    // Calculate status and filter by statuses if provided
    let filteredCycles = cyclesWithPayments;
    if (queryDto.statuses) {
      const statusArray = queryDto.statuses.split(',').map((s) => s.trim());
      filteredCycles = cyclesWithPayments.filter((cycle) => {
        const status = this.calculateStatus(cycle);
        return statusArray.includes(status);
      });
    }

    const data = await Promise.all(
      filteredCycles.map((cycle) => this.toResponseDto(cycle, requesterUserId)),
    );

    return {
      data,
      pagination: {
        total: queryDto.statuses ? filteredCycles.length : total,
        page,
        limit,
        totalPages: Math.ceil(
          (queryDto.statuses ? filteredCycles.length : total) / limit,
        ),
      },
    };
  }

  async findOne(
    id: string,
    requesterUserId: string,
  ): Promise<RentCycleResponseDto> {
    const cycle = await this.rentCycleRepository.findOne({
      where: { id },
      relations: ['lease', 'lineItems'],
    });

    if (!cycle) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Rent cycle not found',
        HttpStatus.NOT_FOUND,
        { rentCycleId: id },
      );
    }

    // Check access (handles tenant and company access)
    await this.validateAccess(cycle, requesterUserId);

    // Load payments
    const payments = await this.loadPaymentsForCycle(cycle);

    return this.toResponseDto({ ...cycle, payments }, requesterUserId);
  }

  async findByLeaseId(
    leaseId: string,
    requesterUserId: string,
  ): Promise<RentCycleResponseDto[]> {
    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND_FOR_PAYMENT,
        ERROR_MESSAGES.LEASE_NOT_FOUND_FOR_PAYMENT,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

    // Check if user is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    // Check if user is a tenant
    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: requesterUserId, isActive: true },
    });
    const isTenant = userCompany?.role === UserRole.TENANT;

    // Validate access based on role
    if (!isSuperAdmin) {
      if (isTenant) {
        // Tenants can only see invoices for their own leases
        if (lease.tenantId !== requesterUserId) {
          throw new BusinessException(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            'You can only view invoices for your own leases.',
            HttpStatus.FORBIDDEN,
          );
        }
      } else {
        // Other users must belong to the same company
        await this.validateCompanyAccess(lease.companyId, requesterUserId);
      }
    }

    const cycles = await this.rentCycleRepository.find({
      where: { leaseId },
      relations: ['lease', 'lineItems'],
      order: { dueDate: 'ASC' },
    });

    const cyclesWithPayments = await Promise.all(
      cycles.map(async (cycle) => {
        const payments = await this.loadPaymentsForCycle(cycle);
        return { ...cycle, payments };
      }),
    );

    return Promise.all(
      cyclesWithPayments.map((cycle) =>
        this.toResponseDto(cycle, requesterUserId),
      ),
    );
  }

  calculateStatus(rentCycle: RentCycle & { payments?: Payment[] }): RentCycleStatus {
    if (!rentCycle.lease) {
      return RentCycleStatus.PENDING;
    }

    const payments = rentCycle.payments || [];
    const amountPaid = payments
      .filter(
        (p) =>
          p.isActive &&
          p.status !== PaymentStatus.REFUNDED &&
          p.amount > 0,
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalAmountDue = Number(rentCycle.totalAmountDue);
    const balance = totalAmountDue - amountPaid;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(rentCycle.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(
      gracePeriodEnd.getDate() + (rentCycle.lease.gracePeriodDays || 0),
    );

    if (balance <= 0) {
      return RentCycleStatus.PAID;
    }

    if (amountPaid > 0) {
      return RentCycleStatus.PARTIAL;
    }

    if (today < dueDate) {
      return RentCycleStatus.PENDING;
    }

    if (today.getTime() === dueDate.getTime()) {
      return RentCycleStatus.DUE;
    }

    if (today > gracePeriodEnd) {
      return RentCycleStatus.OVERDUE;
    }

    return RentCycleStatus.DUE; // Within grace period
  }

  calculateAmounts(
    rentCycle: RentCycle & { payments?: Payment[] },
  ): {
    totalAmountDue: number;
    amountPaid: number;
    balance: number;
  } {
    const payments = rentCycle.payments || [];
    const amountPaid = payments
      .filter(
        (p) =>
          p.isActive &&
          p.status !== PaymentStatus.REFUNDED &&
          p.amount > 0,
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalAmountDue = Number(rentCycle.totalAmountDue);
    const balance = Math.max(0, totalAmountDue - amountPaid);

    return {
      totalAmountDue,
      amountPaid,
      balance,
    };
  }

  async applyLateFee(
    rentCycleId: string,
    requesterUserId: string,
  ): Promise<RentCycleResponseDto> {
    const cycle = await this.rentCycleRepository.findOne({
      where: { id: rentCycleId },
      relations: ['lease', 'lineItems'],
    });

    if (!cycle) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Rent cycle not found',
        HttpStatus.NOT_FOUND,
        { rentCycleId },
      );
    }

    await this.validateCompanyAccess(cycle.companyId, requesterUserId);

    // Check if late fee already applied
    const hasLateFee = cycle.lineItems.some((item) => item.isLateFee);

    if (hasLateFee) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Late fee already applied to this rent cycle',
        HttpStatus.BAD_REQUEST,
        { rentCycleId },
      );
    }

    const lease = cycle.lease;
    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND_FOR_PAYMENT,
        ERROR_MESSAGES.LEASE_NOT_FOUND_FOR_PAYMENT,
        HttpStatus.NOT_FOUND,
        { leaseId: cycle.leaseId },
      );
    }

    // Calculate late fee
    let lateFeeAmount = 0;
    if (lease.lateFeeType === 'FIXED') {
      lateFeeAmount = Number(lease.lateFeeValue || 0);
    } else if (lease.lateFeeType === 'PERCENTAGE') {
      const percentage = Number(lease.lateFeeValue || 0);
      lateFeeAmount = Math.round((cycle.totalAmountDue * percentage) / 100 * 100) / 100;
    }

    if (lateFeeAmount > 0) {
      // Create late fee line item
      const lateFeeItem = this.lineItemRepository.create({
        rentCycleId: cycle.id,
        type: RentCycleLineItemType.LATE_FEE,
        amount: lateFeeAmount,
        description: `Late fee for period ${cycle.period}`,
        isLateFee: true,
      });

      await this.lineItemRepository.save(lateFeeItem);

      // Update total amount due
      await this.rentCycleRepository.update(cycle.id, {
        totalAmountDue: Number(cycle.totalAmountDue) + lateFeeAmount,
      });
    }

    // Reload with relations
    const updatedCycle = await this.rentCycleRepository.findOne({
      where: { id: cycle.id },
      relations: ['lease', 'lineItems'],
    });

    const payments = await this.paymentRepository.find({
      where: {
        rentCycleId: cycle.id,
        isActive: true,
      },
    });

    return this.toResponseDto({ ...updatedCycle!, payments }, requesterUserId);
  }

  async toResponseDto(
    rentCycle: RentCycle & { payments?: Payment[] },
    requesterUserId: string,
  ): Promise<RentCycleResponseDto> {
    const amounts = this.calculateAmounts(rentCycle);
    const status = this.calculateStatus(rentCycle);

    return {
      id: rentCycle.id,
      leaseId: rentCycle.leaseId,
      leaseNumber: rentCycle.lease?.leaseNumber,
      companyId: rentCycle.companyId,
      tenantId: rentCycle.tenantId,
      tenantName: (rentCycle.lease as any)?.tenant?.name,
      invoiceNumber: rentCycle.invoiceNumber,
      period: rentCycle.period,
      dueDate: rentCycle.dueDate,
      totalAmountDue: amounts.totalAmountDue,
      amountPaid: amounts.amountPaid,
      balance: amounts.balance,
      status,
      lineItems: (rentCycle.lineItems || []).map((item) => ({
        id: item.id,
        type: item.type,
        amount: Number(item.amount),
        description: item.description,
        isLateFee: item.isLateFee,
      })),
      paymentsCount: rentCycle.payments?.length || 0,
      createdAt: rentCycle.createdAt,
      updatedAt: rentCycle.updatedAt,
    };
  }

  /**
   * Load payments for a rent cycle
   * This method handles both directly linked payments (via rentCycleId) and
   * unlinked payments that match by leaseId + period (for backward compatibility)
   */
  private async loadPaymentsForCycle(
    cycle: RentCycle,
  ): Promise<Payment[]> {
    // First, try to find payments linked directly via rentCycleId
    let payments = await this.paymentRepository.find({
      where: {
        rentCycleId: cycle.id,
        isActive: true,
      },
    });

    // If no directly linked payments, try to find by leaseId + period
    // This handles cases where payments were created before rent cycles existed
    // or payments were created without rentCycleId
    if (payments.length === 0) {
      payments = await this.paymentRepository.find({
        where: {
          leaseId: cycle.leaseId,
          period: cycle.period,
          rentCycleId: IsNull(),
          isActive: true,
          status: Not(PaymentStatus.REFUNDED),
        },
      });
    }

    return payments;
  }

  private async generateInvoiceNumber(
    companyId: string,
    period: string,
  ): Promise<string> {
    // Format: INV-YYYY-MM-{sequence}
    const [year, month] = period.split('-');
    const prefix = `INV-${year}-${month}-`;

    // Find ALL existing invoice numbers for this period (globally, not just company)
    // This ensures uniqueness across the entire system
    const existingInvoices = await this.rentCycleRepository
      .createQueryBuilder('cycle')
      .where('cycle.invoiceNumber LIKE :prefix', {
        prefix: `${prefix}%`,
      })
      .select('cycle.invoiceNumber', 'invoiceNumber')
      .orderBy('cycle.invoiceNumber', 'DESC')
      .getRawMany();

    // Extract sequence numbers and find the next available one
    const usedSequences = existingInvoices
      .map((inv) => {
        const parts = inv.invoiceNumber.split('-');
        const seq = parseInt(parts[parts.length - 1] || '0', 10);
        return isNaN(seq) ? 0 : seq;
      })
      .filter((seq) => seq > 0)
      .sort((a, b) => b - a); // Sort descending

    // Find the next available sequence number
    let sequence = 1;
    if (usedSequences.length > 0) {
      // Start from the highest sequence + 1
      sequence = usedSequences[0] + 1;
      
      // Check if there are any gaps we can use (optimization)
      // But for simplicity, we'll just use highest + 1
      // This ensures we always get a unique number
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }

  private async validateCompanyAccess(
    companyId: string,
    requesterUserId: string,
  ): Promise<void> {
    const requester = await this.userCompanyRepository.findOne({
      where: {
        companyId,
        userId: requesterUserId,
        isActive: true,
      },
    });

    if (!requester) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async validateAccess(
    rentCycle: RentCycle,
    requesterUserId: string,
  ): Promise<void> {
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (isSuperAdmin) {
      return;
    }

    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: requesterUserId, isActive: true },
    });
    const isTenant = userCompany?.role === UserRole.TENANT;

    if (isTenant) {
      // Tenants can only access their own invoices
      if (rentCycle.tenantId !== requesterUserId) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'You can only view your own invoices.',
          HttpStatus.FORBIDDEN,
        );
      }
    } else {
      // Other users must belong to the same company
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: rentCycle.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (!requester) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }
}

