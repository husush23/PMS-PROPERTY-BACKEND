import { Injectable, HttpStatus, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { Payment } from './entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { UserRole } from '../../shared/enums/user-role.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
  ) {}

  async create(
    createDto: CreatePaymentDto,
    requesterUserId: string,
  ): Promise<PaymentResponseDto> {
    // Permission check (COMPANY_ADMIN, MANAGER, LANDLORD)
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    // Validate lease exists and get company ID
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

    // Validate lease is ACTIVE before accepting payment
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_ACTIVE,
        ERROR_MESSAGES.CANNOT_CREATE_PAYMENT_FOR_INACTIVE_LEASE,
        HttpStatus.BAD_REQUEST,
        {
          leaseId: createDto.leaseId,
          status: lease.status,
          message: `The lease is currently ${lease.status.toLowerCase()}. Only active leases can accept payments.`,
        },
      );
    }

    // Check company access
    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: lease.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD].includes(
          requester.role,
        )
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators, managers, and landlords can create payments.',
          HttpStatus.FORBIDDEN,
          {
            requiredRoles: [
              UserRole.COMPANY_ADMIN,
              UserRole.MANAGER,
              UserRole.LANDLORD,
            ],
          },
        );
      }
    }

    // Validate tenant exists and belongs to lease
    const tenant = await this.userRepository.findOne({
      where: { id: lease.tenantId, isActive: true },
    });

    if (!tenant) {
      throw new BusinessException(
        ErrorCode.TENANT_NOT_FOUND_FOR_PAYMENT,
        ERROR_MESSAGES.TENANT_NOT_FOUND_FOR_PAYMENT,
        HttpStatus.NOT_FOUND,
        { tenantId: lease.tenantId, leaseId: createDto.leaseId },
      );
    }

    // Validate payment date (cannot be in future - configurable, but defaulting to no future dates)
    const paymentDate = new Date(createDto.paymentDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    if (paymentDate > today) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment date cannot be in the future.',
        HttpStatus.BAD_REQUEST,
        { paymentDate: createDto.paymentDate },
      );
    }

    // Calculate amountDue from lease if not provided
    let amountDue = createDto.amountDue;
    if (!amountDue) {
      // Try to find existing payment for this period to get amountDue
      if (createDto.period) {
        const existingPayment = await this.paymentRepository.findOne({
          where: {
            leaseId: createDto.leaseId,
            period: createDto.period,
            paymentType: createDto.paymentType,
            isActive: true,
          },
          order: { createdAt: 'DESC' },
        });
        if (existingPayment) {
          amountDue = Number(existingPayment.amountDue);
        }
      }
      // If still no amountDue, use payment amount as default
      if (!amountDue) {
        amountDue = createDto.amount;
      }
    }

    // Validate amountPaid cannot exceed amountDue
    if (createDto.amount > amountDue) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        ERROR_MESSAGES.PAYMENT_AMOUNT_EXCEEDS_DUE,
        HttpStatus.BAD_REQUEST,
        {
          amount: createDto.amount,
          amountDue,
          message: `The payment amount (${createDto.amount}) exceeds the amount due (${amountDue}). Please adjust the payment amount.`,
        },
      );
    }

    // Find or create RentCycle if rentCycleId not provided
    let rentCycleId = createDto.rentCycleId;
    let rentCycle: RentCycle | null = null;

    if (!rentCycleId && createDto.period) {
      // Try to find existing RentCycle for this lease + period
      rentCycle = await this.rentCycleRepository.findOne({
        where: {
          leaseId: createDto.leaseId,
          period: createDto.period,
        },
      });

      if (rentCycle) {
        rentCycleId = rentCycle.id;
        // Use RentCycle's amountDue if not provided
        if (!amountDue) {
          amountDue = Number(rentCycle.totalAmountDue);
        }
      }
    }

    // Calculate dueDate from RentCycle, lease nextRentDueDate, or use payment date
    let dueDate = createDto.dueDate ? new Date(createDto.dueDate) : null;
    if (!dueDate && rentCycle) {
      dueDate = new Date(rentCycle.dueDate);
    } else if (!dueDate && lease.nextRentDueDate) {
      dueDate = new Date(lease.nextRentDueDate);
    }
    if (!dueDate) {
      // Default to payment date if no due date available
      dueDate = paymentDate;
    }

    // Initialize amountPaid and balance
    // For new payments, amountPaid starts at the payment amount
    // If this is a payment against an existing invoice, we should use recordPayment instead
    const amountPaid = createDto.amount;
    const balance = Math.max(0, amountDue - amountPaid); // Ensure balance is never negative

    // Determine status based on balance and due date
    let status = PaymentStatus.PENDING;
    if (balance <= 0) {
      status = PaymentStatus.PAID;
    } else if (amountPaid > 0) {
      status = PaymentStatus.PARTIAL;
    } else {
      // Check if payment is due today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDateCheck = new Date(dueDate);
      dueDateCheck.setHours(0, 0, 0, 0);
      if (dueDateCheck.getTime() === today.getTime()) {
        status = PaymentStatus.DUE;
      }
    }

    // Create payment entity
    const payment = this.paymentRepository.create({
      companyId: lease.companyId,
      tenantId: lease.tenantId,
      leaseId: createDto.leaseId,
      rentCycleId: rentCycleId || null,
      amount: createDto.amount,
      amountDue: amountDue,
      amountPaid: amountPaid,
      balance: balance,
      currency: createDto.currency || lease.currency || 'KES',
      paymentDate: paymentDate,
      dueDate: dueDate,
      paymentMethod: createDto.paymentMethod,
      paymentType: createDto.paymentType,
      status: status,
      reference: createDto.reference,
      recordedBy: requesterUserId,
      period: createDto.period,
      notes: createDto.notes,
      isPartial: balance > 0,
      balanceAfter: createDto.balanceAfter || balance,
      attachmentUrl: createDto.attachmentUrl,
      paidAt: balance <= 0 ? new Date() : undefined,
      isLegacy: false, // New payments are not legacy
    });

    const savedPayment = await this.paymentRepository.save(payment);
    return this.toResponseDto(savedPayment, requesterUserId);
  }

  async findAll(
    queryDto: ListPaymentsQueryDto,
    requesterUserId: string,
  ): Promise<{
    data: PaymentResponseDto[];
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

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.lease', 'lease')
      .leftJoinAndSelect('payment.tenant', 'tenant')
      .leftJoinAndSelect('payment.company', 'company')
      .leftJoinAndSelect('payment.recordedByUser', 'recordedByUser')
      .where('payment.isActive = :isActive', { isActive: true });

    // Company scoping and tenant filtering
    if (!isSuperAdmin) {
      if (isTenant) {
        // Tenants can only see their own payments
        queryBuilder.andWhere('payment.tenantId = :tenantId', {
          tenantId: requesterUserId,
        });
      } else {
        // Other users can see payments in their companies
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
        queryBuilder.andWhere('payment.companyId IN (:...companyIds)', {
          companyIds,
        });
      }
    }

    // Apply filters
    if (queryDto.tenantId) {
      queryBuilder.andWhere('payment.tenantId = :tenantId', {
        tenantId: queryDto.tenantId,
      });
    }

    if (queryDto.leaseId) {
      queryBuilder.andWhere('payment.leaseId = :leaseId', {
        leaseId: queryDto.leaseId,
      });
    }

    if (queryDto.rentCycleId) {
      queryBuilder.andWhere('payment.rentCycleId = :rentCycleId', {
        rentCycleId: queryDto.rentCycleId,
      });
    }

    if (queryDto.companyId) {
      queryBuilder.andWhere('payment.companyId = :companyId', {
        companyId: queryDto.companyId,
      });
    }

    if (queryDto.status) {
      queryBuilder.andWhere('payment.status = :status', {
        status: queryDto.status,
      });
    }

    if (queryDto.paymentType) {
      queryBuilder.andWhere('payment.paymentType = :paymentType', {
        paymentType: queryDto.paymentType,
      });
    }

    if (queryDto.paymentMethod) {
      queryBuilder.andWhere('payment.paymentMethod = :paymentMethod', {
        paymentMethod: queryDto.paymentMethod,
      });
    }

    if (queryDto.startDate) {
      queryBuilder.andWhere('payment.paymentDate >= :startDate', {
        startDate: queryDto.startDate,
      });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('payment.paymentDate <= :endDate', {
        endDate: queryDto.endDate,
      });
    }

    // Sorting
    const sortBy = queryDto.sortBy || 'paymentDate';
    const sortOrder = queryDto.sortOrder || 'DESC';
    queryBuilder.orderBy(`payment.${sortBy}`, sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const payments = await queryBuilder.getMany();

    const data = await Promise.all(
      payments.map((payment) => this.toResponseDto(payment, requesterUserId)),
    );

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    requesterUserId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id, isActive: true },
      relations: ['lease', 'tenant', 'company', 'recordedByUser'],
    });

    if (!payment) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { paymentId: id },
      );
    }

    // Access control
    await this.validateAccess(payment, requesterUserId);

    return this.toResponseDto(payment, requesterUserId);
  }

  async update(
    id: string,
    updateDto: UpdatePaymentDto,
    requesterUserId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id, isActive: true },
    });

    if (!payment) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { paymentId: id },
      );
    }

    // Access control
    await this.validateAccess(payment, requesterUserId);

    // Permission check (COMPANY_ADMIN, MANAGER only for updates)
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: payment.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can update payments.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Validate status transition (if status is being updated)
    if (updateDto.status) {
      this.validateStatusTransition(payment.status, updateDto.status);
    }

    // Only allow updating specific fields (notes, attachmentUrl, period, status)
    // Immutability: amount, paymentDate, paymentMethod cannot be changed
    if (updateDto.notes !== undefined) {
      payment.notes = updateDto.notes;
    }
    if (updateDto.attachmentUrl !== undefined) {
      payment.attachmentUrl = updateDto.attachmentUrl;
    }
    if (updateDto.period !== undefined) {
      payment.period = updateDto.period;
    }

    // Handle status changes
    const previousStatus = payment.status;
    if (updateDto.status !== undefined) {
      payment.status = updateDto.status;

      // When status changes to PAID
      if (updateDto.status === PaymentStatus.PAID && previousStatus !== PaymentStatus.PAID) {
        payment.amountPaid = Number(payment.amountDue);
        payment.balance = 0;
        payment.paidAt = new Date();
        payment.isPartial = false;
      }

      // When status changes from PAID to something else, reset paidAt
      if (previousStatus === PaymentStatus.PAID && updateDto.status !== PaymentStatus.PAID) {
        payment.paidAt = null;
        // Recalculate balance if needed
        if (payment.amountPaid < payment.amountDue) {
          payment.balance = Number(payment.amountDue) - Number(payment.amountPaid);
        }
      }
    }

    // Update balance and status based on amountPaid if it changed
    // Note: amountPaid can be updated through recordPayment method
    if (payment.amountPaid !== undefined && payment.amountDue !== undefined) {
      payment.balance = Number(payment.amountDue) - Number(payment.amountPaid);
      
      // Auto-update status based on balance
      if (payment.balance <= 0 && payment.status !== PaymentStatus.PAID) {
        payment.status = PaymentStatus.PAID;
        payment.paidAt = new Date();
        payment.isPartial = false;
      } else if (payment.balance > 0 && payment.amountPaid > 0 && payment.status !== PaymentStatus.PARTIAL) {
        payment.status = PaymentStatus.PARTIAL;
        payment.isPartial = true;
        payment.paidAt = null;
      } else if (payment.balance === payment.amountDue && payment.status !== PaymentStatus.PENDING) {
        payment.status = PaymentStatus.PENDING;
        payment.isPartial = false;
        payment.paidAt = null;
      }
    }

    const updatedPayment = await this.paymentRepository.save(payment);
    return this.toResponseDto(updatedPayment, requesterUserId);
  }

  /**
   * Record a payment against an existing payment record (for partial payments)
   */
  async recordPayment(
    paymentId: string,
    amount: number,
    requesterUserId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, isActive: true },
    });

    if (!payment) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { paymentId },
      );
    }

    // Access control
    await this.validateAccess(payment, requesterUserId);

    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: payment.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD].includes(
          requester.role,
        )
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators, managers, and landlords can record payments.',
          HttpStatus.FORBIDDEN,
          {
            requiredRoles: [
              UserRole.COMPANY_ADMIN,
              UserRole.MANAGER,
              UserRole.LANDLORD,
            ],
          },
        );
      }
    }

    // Validate amount
    if (amount <= 0) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment amount must be greater than 0.',
        HttpStatus.BAD_REQUEST,
        { amount },
      );
    }

    // Validate payment is not already fully paid
    if (Number(payment.balance) <= 0) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        ERROR_MESSAGES.PAYMENT_ALREADY_FULLY_PAID,
        HttpStatus.BAD_REQUEST,
        {
          paymentId,
          balance: payment.balance,
          message: 'This payment has already been fully paid. No additional payments can be recorded.',
        },
      );
    }

    // Update amountPaid and balance
    const newAmountPaid = Number(payment.amountPaid || 0) + amount;
    const amountDue = Number(payment.amountDue || payment.amount);

    if (newAmountPaid > amountDue) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Payment amount exceeds amount due. Amount due: ${amountDue}, Current paid: ${payment.amountPaid}, Attempting to add: ${amount}`,
        HttpStatus.BAD_REQUEST,
        { amountDue, currentPaid: payment.amountPaid, amount },
      );
    }

    payment.amountPaid = newAmountPaid;
    payment.balance = amountDue - newAmountPaid;

    // Update status based on balance
    if (payment.balance <= 0) {
      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date();
      payment.isPartial = false;
    } else {
      payment.status = PaymentStatus.PARTIAL;
      payment.isPartial = true;
      payment.paidAt = null;
    }

    // Update notes
    payment.notes = payment.notes
      ? `${payment.notes}\nAdditional payment of ${payment.currency} ${amount.toFixed(2)} recorded on ${new Date().toISOString()}`
      : `Additional payment of ${payment.currency} ${amount.toFixed(2)} recorded on ${new Date().toISOString()}`;

    const updatedPayment = await this.paymentRepository.save(payment);
    return this.toResponseDto(updatedPayment, requesterUserId);
  }

  async reverse(
    id: string,
    reverseDto: ReversePaymentDto,
    requesterUserId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id, isActive: true },
    });

    if (!payment) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { paymentId: id },
      );
    }

    // Access control
    await this.validateAccess(payment, requesterUserId);

    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: payment.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can reverse payments.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Only PAID payments can be reversed
    if (payment.status !== PaymentStatus.PAID) {
      throw new BusinessException(
        ErrorCode.CANNOT_REVERSE_PAYMENT,
        ERROR_MESSAGES.CANNOT_REVERSE_PAYMENT,
        HttpStatus.BAD_REQUEST,
        { paymentId: id, currentStatus: payment.status },
      );
    }

    // Create reversal payment (negative amount)
    const reversalPayment = this.paymentRepository.create({
      companyId: payment.companyId,
      tenantId: payment.tenantId,
      leaseId: payment.leaseId,
      amount: -payment.amount, // Negative amount
      currency: payment.currency,
      paymentDate: new Date(),
      paymentMethod: payment.paymentMethod,
      paymentType: payment.paymentType,
      status: PaymentStatus.REFUNDED,
      reference: payment.reference
        ? `REV-${payment.reference}`
        : `REV-${payment.id.substring(0, 8)}`,
      recordedBy: requesterUserId,
      period: payment.period,
      notes: `Reversal: ${reverseDto.reason}${reverseDto.notes ? `. ${reverseDto.notes}` : ''}`,
      isPartial: false,
    });

    const savedReversal = await this.paymentRepository.save(reversalPayment);

    // Update original payment status to REFUNDED
    payment.status = PaymentStatus.REFUNDED;
    payment.notes = payment.notes
      ? `${payment.notes}\n\nReversed on ${new Date().toISOString()}: ${reverseDto.reason}`
      : `Reversed on ${new Date().toISOString()}: ${reverseDto.reason}`;
    await this.paymentRepository.save(payment);

    return this.toResponseDto(savedReversal, requesterUserId);
  }

  async markAsFailed(
    id: string,
    requesterUserId: string,
    notes?: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id, isActive: true },
    });

    if (!payment) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { paymentId: id },
      );
    }

    // Access control
    await this.validateAccess(payment, requesterUserId);

    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: payment.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can mark payments as failed.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Only PENDING payments can be marked as failed
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BusinessException(
        ErrorCode.INVALID_PAYMENT_STATUS_TRANSITION,
        'Only pending payments can be marked as failed.',
        HttpStatus.BAD_REQUEST,
        { paymentId: id, currentStatus: payment.status },
      );
    }

    payment.status = PaymentStatus.FAILED;
    if (notes) {
      payment.notes = payment.notes ? `${payment.notes}\n\n${notes}` : notes;
    }

    const updatedPayment = await this.paymentRepository.save(payment);
    return this.toResponseDto(updatedPayment, requesterUserId);
  }

  async softDelete(id: string, requesterUserId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id, isActive: true },
    });

    if (!payment) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { paymentId: id },
      );
    }

    // Access control
    await this.validateAccess(payment, requesterUserId);

    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: payment.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can delete payments.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Only PENDING or CANCELLED payments can be deleted
    if (
      ![PaymentStatus.PENDING, PaymentStatus.CANCELLED].includes(payment.status)
    ) {
      throw new BusinessException(
        ErrorCode.CANNOT_DELETE_COMPLETED_PAYMENT,
        ERROR_MESSAGES.CANNOT_DELETE_COMPLETED_PAYMENT,
        HttpStatus.BAD_REQUEST,
        { paymentId: id, currentStatus: payment.status },
      );
    }

    payment.isActive = false;
    await this.paymentRepository.save(payment);
  }

  async getTenantBalance(
    tenantId: string,
    companyId: string,
    requesterUserId: string,
  ): Promise<{
    tenantId: string;
    companyId: string;
    totalPaid: number;
    totalRefunded: number;
    netBalance: number;
    byType: Record<string, number>;
  }> {
    // Access control - validate user has access to this tenant/company
    await this.validateCompanyAccess(companyId, requesterUserId);

    const payments = await this.paymentRepository.find({
      where: {
        tenantId,
        companyId,
        isActive: true,
      },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.PAID && p.amount > 0)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRefunded = payments
      .filter((p) => p.status === PaymentStatus.REFUNDED || p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);

    const netBalance = totalPaid - totalRefunded;

    // Group by payment type
    const byType: Record<string, number> = {};
    payments
      .filter((p) => p.status === PaymentStatus.PAID && p.amount > 0)
      .forEach((p) => {
        byType[p.paymentType] = (byType[p.paymentType] || 0) + Number(p.amount);
      });

    return {
      tenantId,
      companyId,
      totalPaid,
      totalRefunded,
      netBalance,
      byType,
    };
  }

  async getLeaseBalance(
    leaseId: string,
    requesterUserId: string,
  ): Promise<{
    leaseId: string;
    totalPaid: number;
    totalRefunded: number;
    netBalance: number;
    byType: Record<string, number>;
    lastPaymentDate?: Date;
  }> {
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

    // Access control
    await this.validateCompanyAccess(lease.companyId, requesterUserId);

    const payments = await this.paymentRepository.find({
      where: {
        leaseId,
        isActive: true,
      },
      order: { paymentDate: 'DESC' },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.PAID && p.amount > 0)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRefunded = payments
      .filter((p) => p.status === PaymentStatus.REFUNDED || p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);

    const netBalance = totalPaid - totalRefunded;

    // Group by payment type
    const byType: Record<string, number> = {};
    payments
      .filter((p) => p.status === PaymentStatus.PAID && p.amount > 0)
      .forEach((p) => {
        byType[p.paymentType] = (byType[p.paymentType] || 0) + Number(p.amount);
      });

    const lastPaymentDate =
      payments.length > 0 ? payments[0].paymentDate : undefined;

    return {
      leaseId,
      totalPaid,
      totalRefunded,
      netBalance,
      byType,
      lastPaymentDate,
    };
  }

  async getPaymentHistory(
    tenantId?: string,
    leaseId?: string,
    requesterUserId?: string,
  ): Promise<PaymentResponseDto[]> {
    if (!tenantId && !leaseId) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Either tenantId or leaseId must be provided.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.lease', 'lease')
      .leftJoinAndSelect('payment.tenant', 'tenant')
      .leftJoinAndSelect('payment.company', 'company')
      .leftJoinAndSelect('payment.recordedByUser', 'recordedByUser')
      .where('payment.isActive = :isActive', { isActive: true });

    if (tenantId) {
      queryBuilder.andWhere('payment.tenantId = :tenantId', { tenantId });
    }

    if (leaseId) {
      queryBuilder.andWhere('payment.leaseId = :leaseId', { leaseId });
    }

    // Access control
    if (requesterUserId) {
      const requesterUser = await this.userRepository.findOne({
        where: { id: requesterUserId },
      });
      const isSuperAdmin = requesterUser?.isSuperAdmin || false;

      if (!isSuperAdmin) {
        const userCompany = await this.userCompanyRepository.findOne({
          where: { userId: requesterUserId, isActive: true },
        });
        const isTenant = userCompany?.role === UserRole.TENANT;

        if (isTenant) {
          queryBuilder.andWhere('payment.tenantId = :requesterUserId', {
            requesterUserId,
          });
        } else {
          const userCompanies = await this.userCompanyRepository.find({
            where: { userId: requesterUserId, isActive: true },
            select: ['companyId'],
          });

          if (userCompanies.length > 0) {
            const companyIds = userCompanies.map((uc) => uc.companyId);
            queryBuilder.andWhere('payment.companyId IN (:...companyIds)', {
              companyIds,
            });
          } else {
            return [];
          }
        }
      }
    }

    queryBuilder.orderBy('payment.paymentDate', 'DESC');

    const payments = await queryBuilder.getMany();

    return Promise.all(
      payments.map((payment) => this.toResponseDto(payment, requesterUserId)),
    );
  }

  // Helper methods
  private async validateAccess(
    payment: Payment,
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
      // Tenants can only access their own payments
      if (payment.tenantId !== requesterUserId) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'You can only view your own payments.',
          HttpStatus.FORBIDDEN,
        );
      }
    } else {
      // Other users must belong to the same company
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: payment.companyId,
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

    if (!requester) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private validateStatusTransition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus,
  ): void {
    const allowedTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [
        PaymentStatus.DUE,
        PaymentStatus.PAID,
        PaymentStatus.PARTIAL,
        PaymentStatus.OVERDUE,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
      ],
      [PaymentStatus.DUE]: [
        PaymentStatus.PAID,
        PaymentStatus.PARTIAL,
        PaymentStatus.OVERDUE,
        PaymentStatus.PENDING,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
      ],
      [PaymentStatus.PARTIAL]: [
        PaymentStatus.PAID,
        PaymentStatus.OVERDUE,
        PaymentStatus.DUE,
        PaymentStatus.PENDING,
      ],
      [PaymentStatus.OVERDUE]: [
        PaymentStatus.PAID,
        PaymentStatus.PARTIAL,
        PaymentStatus.DUE,
        PaymentStatus.PENDING,
      ],
      [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
      [PaymentStatus.FAILED]: [],
      [PaymentStatus.REFUNDED]: [],
      [PaymentStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new BusinessException(
        ErrorCode.INVALID_PAYMENT_STATUS_TRANSITION,
        ERROR_MESSAGES.INVALID_PAYMENT_STATUS_TRANSITION,
        HttpStatus.BAD_REQUEST,
        { currentStatus, newStatus },
      );
    }
  }

  private async toResponseDto(
    payment: Payment,
    requesterUserId?: string,
  ): Promise<PaymentResponseDto> {
    // Load relations if not already loaded
    if (!payment.lease) {
      payment =
        (await this.paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['lease', 'tenant', 'company', 'recordedByUser'],
        })) || payment;
    }

    // Check and update DUE status if payment is due today
    if (
      payment.status === PaymentStatus.PENDING &&
      payment.dueDate &&
      payment.balance > 0 &&
      payment.lease &&
      payment.lease.status === LeaseStatus.ACTIVE
    ) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate.getTime() === today.getTime()) {
        // Update status to DUE if not already updated
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.DUE,
        });
        payment.status = PaymentStatus.DUE;
      }
    }

    // Calculate derived fields
    const tenantBalance = await this.calculateTenantBalance(
      payment.tenantId,
      payment.companyId,
    );
    const leaseBalance = await this.calculateLeaseBalance(payment.leaseId);
    const lastPaymentDate = await this.getLastPaymentDate(
      payment.leaseId,
      payment.tenantId,
    );

    const response: PaymentResponseDto = {
      id: payment.id,
      companyId: payment.companyId,
      tenantId: payment.tenantId,
      tenantName: payment.tenant?.name,
      leaseId: payment.leaseId,
      leaseNumber: payment.lease?.leaseNumber,
      amount: Number(payment.amount),
      currency: payment.currency,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      paymentType: payment.paymentType,
      status: payment.status,
      reference: payment.reference,
      recordedBy: payment.recordedBy,
      period: payment.period,
      notes: payment.notes,
      isPartial: payment.isPartial,
      balanceAfter: payment.balanceAfter
        ? Number(payment.balanceAfter)
        : undefined,
      attachmentUrl: payment.attachmentUrl,
      isActive: payment.isActive,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      // New fields (handle backward compatibility for existing records)
      amountDue: Number(payment.amountDue ?? payment.amount ?? 0),
      amountPaid: Number(payment.amountPaid ?? 0),
      balance: Number(payment.balance ?? (payment.amountDue ? Number(payment.amountDue) - Number(payment.amountPaid || 0) : 0)),
      dueDate: payment.dueDate || payment.paymentDate,
      paidAt: payment.paidAt || undefined,
      lateFeeApplied: payment.lateFeeApplied ?? false,
      tenantBalance,
      leaseBalance,
      lastPaymentDate,
      isOverdue: this.calculateIsOverdue(payment),
    };

    return response;
  }

  private async calculateTenantBalance(
    tenantId: string,
    companyId: string,
  ): Promise<number> {
    const payments = await this.paymentRepository.find({
      where: {
        tenantId,
        companyId,
        isActive: true,
      },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.PAID && p.amount > 0)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRefunded = payments
      .filter((p) => p.status === PaymentStatus.REFUNDED || p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);

    return totalPaid - totalRefunded;
  }

  private async calculateLeaseBalance(leaseId: string): Promise<number> {
    const payments = await this.paymentRepository.find({
      where: {
        leaseId,
        isActive: true,
      },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.PAID && p.amount > 0)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRefunded = payments
      .filter((p) => p.status === PaymentStatus.REFUNDED || p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);

    return totalPaid - totalRefunded;
  }

  private async getLastPaymentDate(
    leaseId: string,
    tenantId: string,
  ): Promise<Date | undefined> {
    const payment = await this.paymentRepository.findOne({
      where: {
        leaseId,
        tenantId,
        isActive: true,
        status: PaymentStatus.PAID,
      },
      order: { paymentDate: 'DESC' },
    });

    return payment?.paymentDate;
  }

  private calculateIsOverdue(payment: Payment): boolean {
    if (!payment.dueDate || payment.balance <= 0) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    return (
      today > dueDate &&
      (payment.status === PaymentStatus.OVERDUE ||
        payment.status === PaymentStatus.DUE)
    );
  }

  /**
   * Check and update payments to DUE status when due date arrives
   * Should be called daily (e.g., at 1 AM) before overdue check
   */
  async checkAndMarkDue(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find payments that are due today and still PENDING
    const payments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PENDING,
        isActive: true,
      },
      relations: ['lease'],
    });

    for (const payment of payments) {
      try {
        // Skip if lease is not active
        if (!payment.lease || payment.lease.status !== LeaseStatus.ACTIVE) {
          continue;
        }

        if (!payment.dueDate || payment.balance <= 0) {
          continue;
        }

        const dueDate = new Date(payment.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        // Check if payment is due today
        if (dueDate.getTime() === today.getTime()) {
          await this.paymentRepository.update(payment.id, {
            status: PaymentStatus.DUE,
          });
        }
      } catch (error) {
        // Log error but continue with other payments
        console.error(
          `Error processing due payment ${payment.id}:`,
          error.message,
        );
      }
    }
  }
}
