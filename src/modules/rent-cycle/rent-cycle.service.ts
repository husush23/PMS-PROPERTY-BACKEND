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
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import {
  calculateNextDueDate,
  getPeriodsSinceStart,
} from '../../common/utils/rent-due-date.util';

/**
 * TENANT TRUTH SOURCE RULE:
 * 
 * Invoice status is the SINGLE SOURCE OF TRUTH for tenant payment status.
 * 
 * Rules:
 * - Tenant/lease payment status is DERIVED from invoice statuses (not stored)
 * - No caching of payment status on tenant/lease entities
 * - To determine if tenant is due/overdue, query invoice statuses using this service
 * - Invoice status calculation (calculateStatus) is the authoritative source
 * - Tenant status (ACTIVE/FORMER) is separate from payment status (DUE/OVERDUE)
 */
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
    private companySettingsResolver: CompanySettingsResolver,
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
      dueDate: createDto.dueDate
        ? new Date(createDto.dueDate)
        : this.calculateDueDateFromPeriod(lease, createDto.period),
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

    // Filter by invoice type (rent, deposit, or all)
    const invoiceType = queryDto.invoiceType || 'all';
    if (invoiceType === 'rent') {
      queryBuilder.andWhere('rentCycle.isDeposit = :isDeposit', {
        isDeposit: false,
      });
    } else if (invoiceType === 'deposit') {
      queryBuilder.andWhere('rentCycle.isDeposit = :isDeposit', {
        isDeposit: true,
      });
    }
    // If 'all', no filter applied

    // Filter out voided invoices (default: true)
    const excludeVoided = queryDto.excludeVoided !== false; // Default to true if not specified
    if (excludeVoided) {
      queryBuilder.andWhere('rentCycle.isVoid = :isVoid', {
        isVoid: false,
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

    // Update total count for filtered results
    // Note: We need to recalculate total if status filter or other in-memory filters were applied
    const effectiveTotal =
      queryDto.statuses || queryDto.excludeVoided === false
        ? filteredCycles.length
        : total;

    return {
      data,
      pagination: {
        total: effectiveTotal,
        page,
        limit,
        totalPages: Math.ceil(effectiveTotal / limit),
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

  /**
   * Calculate invoice status based on explicit rules using period boundaries
   * 
   * EXPLICIT STATUS TRANSITION RULES:
   * - VOID: isVoid === true (takes precedence over all other statuses)
   * - PAID: balance <= 0 (fully paid, regardless of date)
   * - PARTIAL: amountPaid > 0 && balance > 0 (partially paid)
   * - PENDING: today < periodStartDate (period not started yet)
   * - DUE: periodStartDate ≤ today ≤ dueDate (period started, payment due)
   * - OVERDUE: today > dueDate + gracePeriodDays (past grace period, unpaid)
   * 
   * GRACE PERIOD RULE (Authoritative):
   * - Grace period ONLY affects OVERDUE transition (not DUE)
   * - Grace period NEVER affects invoice generation
   * - Grace period NEVER affects period boundaries
   * - DUE status occurs when: periodStartDate ≤ today ≤ dueDate
   * - OVERDUE status occurs when: today > dueDate + gracePeriodDays
   * - If today is between dueDate and (dueDate + gracePeriodDays), status is still DUE
   * 
   * Note: If periodStartDate is null (backward compatibility), falls back to dueDate-based logic
   */
  calculateStatus(rentCycle: RentCycle & { payments?: Payment[] }): RentCycleStatus {
    // VOID status takes precedence - if invoice is voided, return VOID immediately
    if (rentCycle.isVoid) {
      return RentCycleStatus.VOID;
    }

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

    // Use explicit period boundaries if available, otherwise fall back to dueDate
    const periodStartDate = rentCycle.periodStartDate
      ? new Date(rentCycle.periodStartDate)
      : null;
    if (periodStartDate) {
      periodStartDate.setHours(0, 0, 0, 0);
    }

    // Calculate grace period end (grace period ONLY affects OVERDUE transition)
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(
      gracePeriodEnd.getDate() + (rentCycle.lease.gracePeriodDays || 0),
    );

    // Rule 1: PAID - balance fully paid (takes precedence over date-based statuses)
    if (balance <= 0) {
      // TODO: Accounting Hook - When invoice status changes to PAID
      // → create accounting entry (future module)
      // This hook should be called when invoice becomes fully paid
      return RentCycleStatus.PAID;
    }

    // Rule 2: PARTIAL - partially paid
    if (amountPaid > 0) {
      return RentCycleStatus.PARTIAL;
    }

    // Rule 3: PENDING - period not started yet (if periodStartDate exists)
    if (periodStartDate && today < periodStartDate) {
      return RentCycleStatus.PENDING;
    }

    // Rule 4: DUE - period started and payment is due
    // DUE occurs when: periodStartDate ≤ today ≤ dueDate
    // If periodStartDate is null, use dueDate as fallback
    const periodStart = periodStartDate || dueDate;
    if (today >= periodStart && today <= dueDate) {
      return RentCycleStatus.DUE;
    }

    // Rule 5: OVERDUE - past grace period, unpaid
    // OVERDUE occurs when: today > dueDate + gracePeriodDays
    if (today > gracePeriodEnd) {
      return RentCycleStatus.OVERDUE;
    }

    // Rule 6: DUE - within grace period (after dueDate but before gracePeriodEnd)
    // This handles the case where today > dueDate but today <= gracePeriodEnd
    return RentCycleStatus.DUE;
  }

  /**
   * Calculate invoice amounts (total, paid, balance)
   *
   * CREDIT LIFECYCLE RULE:
   * - Credit is auto-applied only during invoice generation.
   * - This calculation does not apply credit; it only reflects recorded payments.
   * - Negative balance means tenant has overpaid (credit/advance payment).
   */
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
    // Allow negative balance for credit (overpayments)
    // Balance reflects recorded payments only; credit application happens elsewhere.
    const balance = totalAmountDue - amountPaid;

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
    const companySettings = await this.companySettingsResolver.getSettings(
      cycle.companyId,
    );
    if (!this.companySettingsResolver.isLateFeeEnabled(companySettings)) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Late fees are disabled for this company.',
        HttpStatus.BAD_REQUEST,
        { rentCycleId },
      );
    }

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

  /**
   * Void an invoice (mark as cancelled/voided)
   * Used for lease cancellation, admin actions, or correcting errors
   */
  async voidInvoice(
    rentCycleId: string,
    reason: string,
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

    // Check access
    await this.validateCompanyAccess(cycle.companyId, requesterUserId);

    // Check if already voided
    if (cycle.isVoid) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Invoice is already voided',
        HttpStatus.BAD_REQUEST,
        { rentCycleId },
      );
    }

    // Load payments to check if any payments exist
    const payments = await this.loadPaymentsForCycle(cycle);
    const hasPayments = payments.length > 0;

    if (hasPayments) {
      // Check if any payments are not refunded
      const activePayments = payments.filter(
        (p) => p.isActive && p.status !== PaymentStatus.REFUNDED,
      );
      if (activePayments.length > 0) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          'Cannot void invoice with active payments. Refund payments first.',
          HttpStatus.BAD_REQUEST,
          { rentCycleId, activePaymentsCount: activePayments.length },
        );
      }
    }

    // Void the invoice
    await this.rentCycleRepository.update(rentCycleId, {
      isVoid: true,
      voidReason: reason,
    });

    // Reload with relations
    const voidedCycle = await this.rentCycleRepository.findOne({
      where: { id: rentCycleId },
      relations: ['lease', 'lineItems'],
    });

    return this.toResponseDto({ ...voidedCycle!, payments }, requesterUserId);
  }

  /**
   * Create deposit invoice(s) for a lease
   * 
   * DEPOSIT SAFEGUARD RULES:
   * - Deposit invoices CANNOT affect rent status
   * - Deposit payments CANNOT be applied to rent invoices
   * - Deposit refunds do NOT create rent credit
   * - Deposits are separate from rent invoices and don't affect rent cycle generation
   * - Deposits are excluded from rent calculations and status checks
   */
  async createDepositInvoices(
    leaseId: string,
    securityDeposit?: number,
    petDeposit?: number,
  ): Promise<void> {
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

    const today = new Date();
    const period = `DEPOSIT-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Create security deposit invoice if amount exists
    if (securityDeposit && securityDeposit > 0) {
      await this.createDepositInvoice(
        lease,
        securityDeposit,
        'Security deposit',
        period,
      );
    }

    // Create pet deposit invoice if amount exists
    if (petDeposit && petDeposit > 0) {
      await this.createDepositInvoice(
        lease,
        petDeposit,
        'Pet deposit',
        period,
      );
    }
  }

  /**
   * Create a single deposit invoice
   */
  private async createDepositInvoice(
    lease: Lease,
    amount: number,
    description: string,
    period: string,
  ): Promise<RentCycle> {
    // Check if deposit invoice already exists for this lease and type
    const existing = await this.rentCycleRepository.findOne({
      where: {
        leaseId: lease.id,
        period: period,
        isDeposit: true,
      },
      relations: ['lineItems'],
    });

    // Check if this specific deposit type already exists
    if (existing) {
      const hasDepositType = existing.lineItems.some(
        (item) => item.type === RentCycleLineItemType.DEPOSIT && item.description === description,
      );
      if (hasDepositType) {
        // Deposit already exists, skip creation
        return existing;
      }
    }

    // Generate invoice number for deposit
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `DEP-${year}-${month}-`;

    const existingInvoices = await this.rentCycleRepository
      .createQueryBuilder('cycle')
      .where('cycle.invoiceNumber LIKE :prefix', {
        prefix: `${prefix}%`,
      })
      .orderBy('cycle.invoiceNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (existingInvoices) {
      const lastSequence = parseInt(
        existingInvoices.invoiceNumber.split('-').pop() || '0',
        10,
      );
      sequence = lastSequence + 1;
    }

    const invoiceNumber = `${prefix}${sequence.toString().padStart(3, '0')}`;

    // For deposits, period boundaries are the lease start date (one-time charge)
    const depositDueDate = new Date(lease.startDate);
    const periodStartDate = new Date(lease.startDate);
    const periodEndDate = new Date(lease.startDate); // Same day for one-time charge

    // Create deposit rent cycle
    const depositCycle = this.rentCycleRepository.create({
      leaseId: lease.id,
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      invoiceNumber,
      period: period,
      dueDate: depositDueDate,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
      totalAmountDue: amount,
      isDeposit: true, // Mark as deposit invoice
    });

    const savedCycle = await this.rentCycleRepository.save(depositCycle);

    // Create deposit line item
    const depositLineItem = this.lineItemRepository.create({
      rentCycleId: savedCycle.id,
      type: RentCycleLineItemType.DEPOSIT,
      amount: amount,
      description: description,
      isLateFee: false,
    });

    await this.lineItemRepository.save(depositLineItem);

    return savedCycle;
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
      periodStartDate: rentCycle.periodStartDate || null,
      periodEndDate: rentCycle.periodEndDate || null,
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
      isDeposit: rentCycle.isDeposit || false,
      isVoid: rentCycle.isVoid || false,
      voidReason: rentCycle.voidReason || null,
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

  private calculateDueDateFromPeriod(lease: Lease, period: string): Date {
    const billingStart = lease.billingStartDate
      ? new Date(lease.billingStartDate)
      : new Date(lease.startDate);
    const billingAnchorDay =
      lease.billingAnchorDay || billingStart.getUTCDate();
    const paymentFrequency =
      lease.paymentFrequency || PaymentFrequency.MONTHLY;
    const periodStartDate = this.getPeriodStartDate(
      period,
      paymentFrequency,
    );
    const cyclesAhead = Math.max(
      0,
      getPeriodsSinceStart(billingStart, periodStartDate, paymentFrequency),
    );
    return calculateNextDueDate({
      billingStartDate: billingStart,
      billingAnchorDay,
      paymentFrequency,
      cyclesAhead,
    });
  }

  private getPeriodStartDate(
    period: string,
    paymentFrequency: PaymentFrequency,
  ): Date {
    switch (paymentFrequency) {
      case PaymentFrequency.QUARTERLY: {
        const match = period.match(/^(\d{4})-Q([1-4])$/);
        if (!match) {
          break;
        }
        const year = Number(match[1]);
        const quarter = Number(match[2]);
        return new Date(Date.UTC(year, (quarter - 1) * 3, 1));
      }
      case PaymentFrequency.YEARLY: {
        if (!/^\d{4}$/.test(period)) {
          break;
        }
        return new Date(Date.UTC(Number(period), 0, 1));
      }
      case PaymentFrequency.WEEKLY:
      case PaymentFrequency.BIWEEKLY: {
        const match = period.match(/^(\d{4})-W(\d{2})/);
        if (!match) {
          break;
        }
        const year = Number(match[1]);
        const week = Number(match[2]);
        return this.getIsoWeekStartDate(year, week);
      }
      case PaymentFrequency.MONTHLY:
      default: {
        const match = period.match(/^(\d{4})-(\d{2})$/);
        if (!match) {
          break;
        }
        const year = Number(match[1]);
        const month = Number(match[2]);
        return new Date(Date.UTC(year, month - 1, 1));
      }
    }

    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      'Invalid billing period format for due date calculation.',
      HttpStatus.BAD_REQUEST,
      { period, paymentFrequency },
    );
  }

  private getIsoWeekStartDate(year: number, week: number): Date {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay();
    const isoWeekStart = new Date(simple);
    if (dayOfWeek <= 4) {
      isoWeekStart.setUTCDate(
        simple.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1),
      );
    } else {
      isoWeekStart.setUTCDate(simple.getUTCDate() + (8 - dayOfWeek));
    }
    return isoWeekStart;
  }
}

