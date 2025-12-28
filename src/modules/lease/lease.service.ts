import {
  Injectable,
  HttpStatus,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { Lease } from './entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { TenantProfile } from '../tenant/entities/tenant-profile.entity';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { LeaseResponseDto } from './dto/lease-response.dto';
import { ListLeasesQueryDto } from './dto/list-leases-query.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TransferLeaseDto } from './dto/transfer-lease.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { UnitStatus } from '../../shared/enums/unit-status.enum';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class LeaseService {
  constructor(
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(TenantProfile)
    private tenantProfileRepository: Repository<TenantProfile>,
    @Inject(forwardRef(() => TenantService))
    private tenantService: TenantService,
  ) {}

  async create(
    createDto: CreateLeaseDto,
    requesterUserId: string,
  ): Promise<LeaseResponseDto> {
    // Permission check (COMPANY_ADMIN, MANAGER, LANDLORD)
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Get unit first to check company
      const unit = await this.unitRepository.findOne({ where: { id: createDto.unitId } });
      if (!unit) {
        throw new BusinessException(
          ErrorCode.UNIT_NOT_FOUND,
          ERROR_MESSAGES.UNIT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { unitId: createDto.unitId },
        );
      }

      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: unit.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators, managers, and landlords can create leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD] },
        );
      }
    }

    // Validate unit exists
    const unit = await this.unitRepository.findOne({
      where: { id: createDto.unitId, isActive: true },
      relations: ['property'],
    });

    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId: createDto.unitId },
      );
    }

    // Validate tenant profile exists (frontend sends tenant profile ID)
    // First, try to find tenant profile by ID
    let tenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: createDto.tenantId, companyId: unit.companyId },
      relations: ['user'],
    });

    // If not found as tenant profile ID, try as user ID (for backward compatibility)
    if (!tenantProfile) {
      tenantProfile = await this.tenantProfileRepository.findOne({
        where: { userId: createDto.tenantId, companyId: unit.companyId },
        relations: ['user'],
      });
    }

    if (!tenantProfile) {
      throw new BusinessException(
        ErrorCode.TENANT_NOT_FOUND,
        ERROR_MESSAGES.TENANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { tenantId: createDto.tenantId, companyId: unit.companyId },
      );
    }

    // Check if the associated user exists and is active
    if (!tenantProfile.user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        {
          tenantId: tenantProfile.id,
          userId: tenantProfile.userId,
          message: 'The tenant profile exists but the associated user is missing',
        },
      );
    }

    const tenantUserId = tenantProfile.userId;

    // Validate user is active
    if (!tenantProfile.user.isActive) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        {
          tenantId: tenantProfile.id,
          userId: tenantUserId,
          message: 'The associated user account is inactive',
        },
      );
    }

    // Check for existing active lease on unit (enforce one active lease rule)
    const existingActiveLease = await this.leaseRepository.findOne({
      where: {
        unitId: createDto.unitId,
        status: LeaseStatus.ACTIVE,
        isActive: true,
      },
    });

    if (existingActiveLease) {
      throw new BusinessException(
        ErrorCode.UNIT_ALREADY_LEASED,
        ERROR_MESSAGES.UNIT_ALREADY_LEASED,
        HttpStatus.BAD_REQUEST,
        { unitId: createDto.unitId, existingLeaseId: existingActiveLease.id },
      );
    }

    // Validate dates
    const startDate = new Date(createDto.startDate);
    const endDate = new Date(createDto.endDate);

    if (endDate <= startDate) {
      throw new BusinessException(
        ErrorCode.INVALID_LEASE_DATES,
        ERROR_MESSAGES.INVALID_LEASE_DATES,
        HttpStatus.BAD_REQUEST,
        { startDate: createDto.startDate, endDate: createDto.endDate },
      );
    }

    // Generate lease number if not provided
    let leaseNumber = createDto.leaseNumber;
    if (!leaseNumber) {
      const year = new Date().getFullYear();
      const count = await this.leaseRepository.count({
        where: {
          companyId: unit.companyId,
        },
      });
      leaseNumber = `LEASE-${year}-${String(count + 1).padStart(3, '0')}`;
    }

    // Create lease entity (use userId from tenant profile, not tenant profile ID)
    const lease = this.leaseRepository.create({
      tenantId: tenantUserId,
      unitId: createDto.unitId,
      companyId: unit.companyId,
      landlordUserId: createDto.landlordUserId,
      leaseNumber,
      status: LeaseStatus.DRAFT,
      leaseType: createDto.leaseType,
      startDate,
      endDate,
      moveInDate: createDto.moveInDate ? new Date(createDto.moveInDate) : undefined,
      moveOutDate: createDto.moveOutDate ? new Date(createDto.moveOutDate) : undefined,
      signedDate: createDto.signedDate ? new Date(createDto.signedDate) : undefined,
      renewalDate: createDto.renewalDate ? new Date(createDto.renewalDate) : undefined,
      noticeToVacateDate: createDto.noticeToVacateDate ? new Date(createDto.noticeToVacateDate) : undefined,
      billingStartDate: createDto.billingStartDate ? new Date(createDto.billingStartDate) : undefined,
      proratedFirstMonth: createDto.proratedFirstMonth ?? false,
      gracePeriodDays: createDto.gracePeriodDays ?? 0,
      monthlyRent: createDto.monthlyRent,
      securityDeposit: createDto.securityDeposit,
      petDeposit: createDto.petDeposit,
      petRent: createDto.petRent,
      lateFeeAmount: createDto.lateFeeAmount,
      utilitiesIncluded: createDto.utilitiesIncluded ?? false,
      utilityCosts: createDto.utilityCosts,
      currency: createDto.currency || 'KES',
      leaseTerm: createDto.leaseTerm,
      renewalOptions: createDto.renewalOptions,
      noticePeriod: createDto.noticePeriod,
      petPolicy: createDto.petPolicy,
      smokingPolicy: createDto.smokingPolicy,
      terms: createDto.terms,
      coTenants: createDto.coTenants,
      guarantorInfo: createDto.guarantorInfo,
      documents: createDto.documents,
      notes: createDto.notes,
      tags: createDto.tags,
      createdBy: requesterUserId,
    });

    const savedLease = await this.leaseRepository.save(lease);
    return this.findOne(savedLease.id, requesterUserId);
  }

  async findAll(
    queryDto: ListLeasesQueryDto,
    requesterUserId: string,
  ): Promise<{
    data: LeaseResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    // Check if user is super admin
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    // Check if user is a tenant (restricted access)
    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: requesterUserId, isActive: true },
    });
    const isTenant = userCompany?.role === UserRole.TENANT;

    const queryBuilder = this.leaseRepository.createQueryBuilder('lease')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .leftJoinAndSelect('lease.unit', 'unit')
      .leftJoinAndSelect('unit.property', 'property')
      .leftJoinAndSelect('lease.company', 'company')
      .leftJoinAndSelect('lease.landlord', 'landlord');

    // Company scoping and tenant filtering
    if (!isSuperAdmin) {
      if (isTenant) {
        // Tenants can only see their own leases
        queryBuilder.andWhere('lease.tenantId = :tenantId', { tenantId: requesterUserId });
      } else {
        // Other users can see leases in their companies
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
        queryBuilder.andWhere('lease.companyId IN (:...companyIds)', { companyIds });
      }
    }

    // Filters
    if (queryDto.tenantId) {
      queryBuilder.andWhere('lease.tenantId = :tenantId', { tenantId: queryDto.tenantId });
    }

    if (queryDto.unitId) {
      queryBuilder.andWhere('lease.unitId = :unitId', { unitId: queryDto.unitId });
    }

    if (queryDto.propertyId) {
      queryBuilder.andWhere('unit.propertyId = :propertyId', { propertyId: queryDto.propertyId });
    }

    if (queryDto.companyId) {
      queryBuilder.andWhere('lease.companyId = :companyId', { companyId: queryDto.companyId });
    }

    if (queryDto.status) {
      queryBuilder.andWhere('lease.status = :status', { status: queryDto.status });
    }

    if (queryDto.leaseType) {
      queryBuilder.andWhere('lease.leaseType = :leaseType', { leaseType: queryDto.leaseType });
    }

    if (queryDto.startDateFrom) {
      queryBuilder.andWhere('lease.startDate >= :startDateFrom', {
        startDateFrom: queryDto.startDateFrom,
      });
    }

    if (queryDto.startDateTo) {
      queryBuilder.andWhere('lease.startDate <= :startDateTo', {
        startDateTo: queryDto.startDateTo,
      });
    }

    if (queryDto.endDateFrom) {
      queryBuilder.andWhere('lease.endDate >= :endDateFrom', {
        endDateFrom: queryDto.endDateFrom,
      });
    }

    if (queryDto.endDateTo) {
      queryBuilder.andWhere('lease.endDate <= :endDateTo', {
        endDateTo: queryDto.endDateTo,
      });
    }

    if (queryDto.expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      queryBuilder.andWhere('lease.endDate <= :expiringDate', { expiringDate: thirtyDaysFromNow });
      queryBuilder.andWhere('lease.endDate >= :today', { today: new Date() });
      queryBuilder.andWhere('lease.status = :activeStatus', { activeStatus: LeaseStatus.ACTIVE });
    }

    if (queryDto.search) {
      queryBuilder.andWhere(
        '(lease.leaseNumber ILIKE :search OR tenant.name ILIKE :search OR tenant.email ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    // Only active leases
    queryBuilder.andWhere('lease.isActive = :isActive', { isActive: true });

    // Sorting
    const sortBy = queryDto.sortBy || 'createdAt';
    const sortOrder = queryDto.sortOrder || 'DESC';
    const validSortFields = ['startDate', 'endDate', 'createdAt', 'leaseNumber', 'monthlyRent'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`lease.${finalSortBy}`, sortOrder);

    // Pagination
    queryBuilder.skip(skip).take(limit);

    const [leases, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: leases.map((lease) => this.toResponseDto(lease)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(leaseId: string, requesterUserId: string): Promise<LeaseResponseDto> {
    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
      relations: ['tenant', 'unit', 'unit.property', 'company', 'landlord'],
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

    // Access control
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Check if tenant viewing own lease
      if (lease.tenantId === requesterUserId) {
        return this.toResponseDto(lease);
      }

      // Check if user has access to the lease's company
      const userCompany = await this.userCompanyRepository.findOne({
        where: {
          companyId: lease.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (!userCompany) {
        throw new BusinessException(
          ErrorCode.LEASE_NOT_FOUND,
          ERROR_MESSAGES.LEASE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { leaseId },
        );
      }
    }

    return this.toResponseDto(lease);
  }

  async update(
    leaseId: string,
    updateDto: UpdateLeaseDto,
    requesterUserId: string,
  ): Promise<LeaseResponseDto> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

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
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators, managers, and landlords can update leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD] },
        );
      }
    }

    // If ACTIVE: Only allow limited updates (notes, tags, documents, some dates)
    if (lease.status === LeaseStatus.ACTIVE) {
      // Cannot change startDate/endDate if ACTIVE (or require special permission)
      if (updateDto.startDate && new Date(updateDto.startDate).getTime() !== lease.startDate.getTime()) {
        throw new BusinessException(
          ErrorCode.CANNOT_UPDATE_ACTIVE_LEASE_FIELD,
          'Cannot change start date for an active lease.',
          HttpStatus.BAD_REQUEST,
          { field: 'startDate' },
        );
      }

      if (updateDto.endDate && new Date(updateDto.endDate).getTime() !== lease.endDate.getTime()) {
        throw new BusinessException(
          ErrorCode.CANNOT_UPDATE_ACTIVE_LEASE_FIELD,
          'Cannot change end date for an active lease.',
          HttpStatus.BAD_REQUEST,
          { field: 'endDate' },
        );
      }

      // Allowed fields for ACTIVE leases: notes, tags, documents, moveInDate, moveOutDate, etc.
      const allowedFields: (keyof UpdateLeaseDto)[] = [
        'notes',
        'tags',
        'documents',
        'moveInDate',
        'moveOutDate',
        'renewalDate',
        'noticeToVacateDate',
        'landlordUserId',
      ];

      const updateData: any = {};
      for (const key of allowedFields) {
        if (updateDto[key] !== undefined) {
          updateData[key] = updateDto[key];
        }
      }

      if (Object.keys(updateData).length === 0) {
        // No allowed fields to update
        return this.findOne(leaseId, requesterUserId);
      }

      // Convert date strings to Date objects
      const finalUpdateData: any = { ...updateData };
      if (finalUpdateData.moveInDate) {
        finalUpdateData.moveInDate = new Date(finalUpdateData.moveInDate);
      }
      if (finalUpdateData.moveOutDate) {
        finalUpdateData.moveOutDate = new Date(finalUpdateData.moveOutDate);
      }
      if (finalUpdateData.renewalDate) {
        finalUpdateData.renewalDate = new Date(finalUpdateData.renewalDate);
      }
      if (finalUpdateData.noticeToVacateDate) {
        finalUpdateData.noticeToVacateDate = new Date(finalUpdateData.noticeToVacateDate);
      }

      await this.leaseRepository.update(leaseId, finalUpdateData);
    } else {
      // If DRAFT: Allow full updates (but still validate dates)
      if (updateDto.startDate && updateDto.endDate) {
        const startDate = new Date(updateDto.startDate);
        const endDate = new Date(updateDto.endDate);

        if (endDate <= startDate) {
          throw new BusinessException(
            ErrorCode.INVALID_LEASE_DATES,
            ERROR_MESSAGES.INVALID_LEASE_DATES,
            HttpStatus.BAD_REQUEST,
            { startDate: updateDto.startDate, endDate: updateDto.endDate },
          );
        }
      }

      const updateData: any = { ...updateDto };
      
      // Convert date strings to Date objects
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }
      if (updateData.moveInDate) {
        updateData.moveInDate = updateData.moveInDate ? new Date(updateData.moveInDate) : null;
      }
      if (updateData.moveOutDate) {
        updateData.moveOutDate = updateData.moveOutDate ? new Date(updateData.moveOutDate) : null;
      }
      if (updateData.signedDate) {
        updateData.signedDate = updateData.signedDate ? new Date(updateData.signedDate) : null;
      }
      if (updateData.renewalDate) {
        updateData.renewalDate = updateData.renewalDate ? new Date(updateData.renewalDate) : null;
      }
      if (updateData.noticeToVacateDate) {
        updateData.noticeToVacateDate = updateData.noticeToVacateDate ? new Date(updateData.noticeToVacateDate) : null;
      }
      if (updateData.billingStartDate) {
        updateData.billingStartDate = updateData.billingStartDate ? new Date(updateData.billingStartDate) : null;
      }
      if (updateData.actualTerminationDate) {
        updateData.actualTerminationDate = updateData.actualTerminationDate ? new Date(updateData.actualTerminationDate) : null;
      }

      await this.leaseRepository.update(leaseId, updateData);
    }

    return this.findOne(leaseId, requesterUserId);
  }

  async activate(leaseId: string, requesterUserId: string): Promise<LeaseResponseDto> {
    // Permission check (COMPANY_ADMIN, MANAGER only)
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
      relations: ['unit', 'tenant'],
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

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
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can activate leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Validate lease status is DRAFT
    if (lease.status !== LeaseStatus.DRAFT) {
      throw new BusinessException(
        ErrorCode.LEASE_ALREADY_ACTIVE,
        'Lease is not in DRAFT status and cannot be activated.',
        HttpStatus.BAD_REQUEST,
        { currentStatus: lease.status },
      );
    }

    // Validate unit has no other active lease
    const existingActiveLease = await this.leaseRepository.findOne({
      where: {
        unitId: lease.unitId,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        id: Not(leaseId),
      },
    });

    if (existingActiveLease) {
      throw new BusinessException(
        ErrorCode.UNIT_ALREADY_LEASED,
        ERROR_MESSAGES.UNIT_ALREADY_LEASED,
        HttpStatus.BAD_REQUEST,
        { unitId: lease.unitId, existingLeaseId: existingActiveLease.id },
      );
    }

    // Validate unit is available
    const unit = await this.unitRepository.findOne({ where: { id: lease.unitId } });
    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId: lease.unitId },
      );
    }

    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new BusinessException(
        ErrorCode.CANNOT_ACTIVATE_UNAVAILABLE_UNIT,
        ERROR_MESSAGES.CANNOT_ACTIVATE_UNAVAILABLE_UNIT,
        HttpStatus.BAD_REQUEST,
        { unitId: lease.unitId, unitStatus: unit.status },
      );
    }

    // Set lease status to ACTIVE
    await this.leaseRepository.update(leaseId, {
      status: LeaseStatus.ACTIVE,
      moveInDate: lease.moveInDate || new Date(),
    });

    // Update unit status: AVAILABLE → OCCUPIED
    await this.unitRepository.update(lease.unitId, {
      status: UnitStatus.OCCUPIED,
    });

    // Update tenant status: PENDING → ACTIVE (call TenantService method)
    const activeLeasesCount = await this.leaseRepository.count({
      where: {
        tenantId: lease.tenantId,
        companyId: lease.companyId,
        status: LeaseStatus.ACTIVE,
        isActive: true,
      },
    });
    await this.tenantService.updateTenantStatusBasedOnActiveLeaseCount(
      lease.tenantId,
      lease.companyId,
      activeLeasesCount,
    );

    return this.findOne(leaseId, requesterUserId);
  }

  async terminate(
    leaseId: string,
    terminationDto: TerminateLeaseDto,
    requesterUserId: string,
  ): Promise<LeaseResponseDto> {
    // Permission check (COMPANY_ADMIN, MANAGER only)
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
      relations: ['unit', 'tenant'],
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

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
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can terminate leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Validate lease status is ACTIVE
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_ACTIVE,
        ERROR_MESSAGES.LEASE_NOT_ACTIVE,
        HttpStatus.BAD_REQUEST,
        { currentStatus: lease.status },
      );
    }

    const actualTerminationDate = terminationDto.actualTerminationDate
      ? new Date(terminationDto.actualTerminationDate)
      : new Date();

    // Set termination metadata and status to TERMINATED
    await this.leaseRepository.update(leaseId, {
      status: LeaseStatus.TERMINATED,
      terminationReason: terminationDto.terminationReason,
      terminatedBy: requesterUserId,
      terminationNotes: terminationDto.terminationNotes,
      actualTerminationDate,
      moveOutDate: actualTerminationDate,
    });

    // Update unit status: OCCUPIED → AVAILABLE
    await this.unitRepository.update(lease.unitId, {
      status: UnitStatus.AVAILABLE,
    });

    // Update tenant status based on other active leases
    const activeLeasesCount = await this.leaseRepository.count({
      where: {
        tenantId: lease.tenantId,
        companyId: lease.companyId,
        status: LeaseStatus.ACTIVE,
        isActive: true,
        id: Not(leaseId),
      },
    });
    await this.tenantService.updateTenantStatusBasedOnActiveLeaseCount(
      lease.tenantId,
      lease.companyId,
      activeLeasesCount,
    );

    return this.findOne(leaseId, requesterUserId);
  }

  async renew(
    leaseId: string,
    renewDto: RenewLeaseDto,
    requesterUserId: string,
  ): Promise<LeaseResponseDto> {
    // Permission check (COMPANY_ADMIN, MANAGER only)
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    const oldLease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
      relations: ['unit', 'tenant'],
    });

    if (!oldLease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: oldLease.companyId,
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
          'Only company administrators and managers can renew leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Validate lease status is ACTIVE or EXPIRED
    if (![LeaseStatus.ACTIVE, LeaseStatus.EXPIRED].includes(oldLease.status)) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_ACTIVE,
        'Lease must be ACTIVE or EXPIRED to be renewed.',
        HttpStatus.BAD_REQUEST,
        { currentStatus: oldLease.status },
      );
    }

    // Validate dates
    const startDate = new Date(renewDto.startDate);
    const endDate = new Date(renewDto.endDate);

    if (endDate <= startDate) {
      throw new BusinessException(
        ErrorCode.INVALID_LEASE_DATES,
        ERROR_MESSAGES.INVALID_LEASE_DATES,
        HttpStatus.BAD_REQUEST,
        { startDate: renewDto.startDate, endDate: renewDto.endDate },
      );
    }

    // Generate new lease number
    const year = new Date().getFullYear();
    const count = await this.leaseRepository.count({
      where: {
        companyId: oldLease.companyId,
      },
    });
    const leaseNumber = `LEASE-${year}-${String(count + 1).padStart(3, '0')}`;

    // Create new lease with data from renewDto
    const newLease = this.leaseRepository.create({
      tenantId: oldLease.tenantId,
      unitId: oldLease.unitId,
      companyId: oldLease.companyId,
      landlordUserId: oldLease.landlordUserId,
      leaseNumber,
      status: LeaseStatus.DRAFT,
      leaseType: renewDto.leaseType || oldLease.leaseType,
      startDate,
      endDate,
      monthlyRent: renewDto.monthlyRent,
      securityDeposit: renewDto.securityDeposit || oldLease.securityDeposit,
      petDeposit: oldLease.petDeposit,
      petRent: oldLease.petRent,
      lateFeeAmount: oldLease.lateFeeAmount,
      utilitiesIncluded: oldLease.utilitiesIncluded,
      utilityCosts: oldLease.utilityCosts,
      currency: oldLease.currency,
      proratedFirstMonth: renewDto.proratedFirstMonth ?? false,
      gracePeriodDays: renewDto.gracePeriodDays ?? oldLease.gracePeriodDays,
      leaseTerm: oldLease.leaseTerm,
      renewalOptions: oldLease.renewalOptions,
      noticePeriod: oldLease.noticePeriod,
      petPolicy: oldLease.petPolicy,
      smokingPolicy: oldLease.smokingPolicy,
      terms: oldLease.terms,
      coTenants: oldLease.coTenants,
      guarantorInfo: oldLease.guarantorInfo,
      documents: oldLease.documents,
      notes: oldLease.notes,
      tags: oldLease.tags,
      renewedFromLeaseId: oldLease.id,
      createdBy: requesterUserId,
    });

    const savedNewLease = await this.leaseRepository.save(newLease);

    // Link: old lease.renewedToLeaseId = new lease.id
    await this.leaseRepository.update(leaseId, {
      renewedToLeaseId: savedNewLease.id,
      status: LeaseStatus.RENEWED,
    });

    return this.findOne(savedNewLease.id, requesterUserId);
  }

  async delete(leaseId: string, requesterUserId: string): Promise<void> {
    // Permission check (COMPANY_ADMIN, MANAGER only)
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
    });

    if (!lease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

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
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can delete leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Only allow deletion if status is DRAFT
    if (lease.status !== LeaseStatus.DRAFT) {
      throw new BusinessException(
        ErrorCode.CANNOT_DELETE_ACTIVE_LEASE,
        ERROR_MESSAGES.CANNOT_DELETE_ACTIVE_LEASE,
        HttpStatus.BAD_REQUEST,
        { currentStatus: lease.status },
      );
    }

    // Soft delete
    await this.leaseRepository.update(leaseId, { isActive: false });
  }

  async transfer(
    leaseId: string,
    transferDto: TransferLeaseDto,
    requesterUserId: string,
  ): Promise<LeaseResponseDto> {
    // Permission check (COMPANY_ADMIN, MANAGER only)
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    const oldLease = await this.leaseRepository.findOne({
      where: { id: leaseId, isActive: true },
      relations: ['unit', 'tenant'],
    });

    if (!oldLease) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId },
      );
    }

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: oldLease.companyId,
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
          'Only company administrators and managers can transfer leases.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Validate at least one field is provided
    if (!transferDto.newTenantId && !transferDto.newUnitId) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Either newTenantId or newUnitId must be provided for transfer.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Terminate old lease (call terminate method)
    const terminateDto: TerminateLeaseDto = {
      terminationReason: 'Lease transferred',
      terminationNotes: transferDto.newTenantId
        ? `Transferred to new tenant: ${transferDto.newTenantId}`
        : `Transferred to new unit: ${transferDto.newUnitId}`,
    };
    await this.terminate(leaseId, terminateDto, requesterUserId);

    // Create new lease for new tenant/unit
    const newTenantId = transferDto.newTenantId || oldLease.tenantId;
    const newUnitId = transferDto.newUnitId || oldLease.unitId;

    // Validate new unit if changed
    if (transferDto.newUnitId) {
      const newUnit = await this.unitRepository.findOne({
        where: { id: newUnitId, isActive: true },
      });

      if (!newUnit) {
        throw new BusinessException(
          ErrorCode.UNIT_NOT_FOUND,
          ERROR_MESSAGES.UNIT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { unitId: newUnitId },
        );
      }

      // Check for existing active lease on new unit
      const existingActiveLease = await this.leaseRepository.findOne({
        where: {
          unitId: newUnitId,
          status: LeaseStatus.ACTIVE,
          isActive: true,
        },
      });

      if (existingActiveLease) {
        throw new BusinessException(
          ErrorCode.UNIT_ALREADY_LEASED,
          ERROR_MESSAGES.UNIT_ALREADY_LEASED,
          HttpStatus.BAD_REQUEST,
          { unitId: newUnitId, existingLeaseId: existingActiveLease.id },
        );
      }
    }

    // Create new lease
    const createDto: CreateLeaseDto = {
      tenantId: newTenantId,
      unitId: newUnitId,
      leaseType: oldLease.leaseType,
      startDate: new Date().toISOString().split('T')[0],
      endDate: oldLease.endDate.toISOString().split('T')[0],
      monthlyRent: oldLease.monthlyRent,
      securityDeposit: oldLease.securityDeposit,
      petDeposit: oldLease.petDeposit,
      petRent: oldLease.petRent,
      lateFeeAmount: oldLease.lateFeeAmount,
      utilitiesIncluded: oldLease.utilitiesIncluded,
      utilityCosts: oldLease.utilityCosts,
      currency: oldLease.currency,
      proratedFirstMonth: oldLease.proratedFirstMonth,
      gracePeriodDays: oldLease.gracePeriodDays,
      landlordUserId: oldLease.landlordUserId,
      leaseTerm: oldLease.leaseTerm,
      renewalOptions: oldLease.renewalOptions,
      noticePeriod: oldLease.noticePeriod,
      petPolicy: oldLease.petPolicy,
      smokingPolicy: oldLease.smokingPolicy,
      terms: oldLease.terms,
      coTenants: oldLease.coTenants,
      guarantorInfo: oldLease.guarantorInfo,
      documents: oldLease.documents,
      notes: `Transferred from lease ${oldLease.leaseNumber}`,
      tags: oldLease.tags,
    };

    return this.create(createDto, requesterUserId);
  }

  async getLeaseHistoryByUnit(unitId: string, requesterUserId: string): Promise<LeaseResponseDto[]> {
    const unit = await this.unitRepository.findOne({ where: { id: unitId } });
    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId },
      );
    }

    // Access control
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const userCompany = await this.userCompanyRepository.findOne({
        where: {
          companyId: unit.companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (!userCompany) {
        throw new BusinessException(
          ErrorCode.UNIT_NOT_FOUND,
          ERROR_MESSAGES.UNIT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { unitId },
        );
      }
    }

    const leases = await this.leaseRepository.find({
      where: { unitId, isActive: true },
      relations: ['tenant', 'unit', 'unit.property', 'company', 'landlord'],
      order: { startDate: 'DESC' },
    });

    return leases.map((lease) => this.toResponseDto(lease));
  }

  async getLeaseHistoryByTenant(tenantId: string, requesterUserId: string): Promise<LeaseResponseDto[]> {
    // Access control - tenants can only view their own history
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin && requesterUserId !== tenantId) {
      const userCompany = await this.userCompanyRepository.findOne({
        where: { userId: requesterUserId, isActive: true },
      });

      if (!userCompany || userCompany.role !== UserRole.TENANT) {
        // Only allow if requester is admin/manager in same company as tenant
        const tenantProfile = await this.tenantProfileRepository.findOne({
          where: { userId: tenantId },
        });

        if (!tenantProfile) {
          throw new BusinessException(
            ErrorCode.TENANT_NOT_FOUND,
            ERROR_MESSAGES.TENANT_NOT_FOUND,
            HttpStatus.NOT_FOUND,
            { tenantId },
          );
        }

        const requesterCompany = await this.userCompanyRepository.findOne({
          where: {
            companyId: tenantProfile.companyId,
            userId: requesterUserId,
            isActive: true,
          },
        });

        if (
          !requesterCompany ||
          ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requesterCompany.role)
        ) {
          throw new BusinessException(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            'You can only view your own lease history.',
            HttpStatus.FORBIDDEN,
          );
        }
      }
    }

    const leases = await this.leaseRepository.find({
      where: { tenantId, isActive: true },
      relations: ['tenant', 'unit', 'unit.property', 'company', 'landlord'],
      order: { startDate: 'DESC' },
    });

    return leases.map((lease) => this.toResponseDto(lease));
  }

  async checkAndExpireLeases(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredLeases = await this.leaseRepository.find({
      where: {
        status: LeaseStatus.ACTIVE,
        endDate: LessThan(today),
        isActive: true,
      },
      relations: ['unit', 'tenant'],
    });

    for (const lease of expiredLeases) {
      // Update lease status to EXPIRED
      await this.leaseRepository.update(lease.id, {
        status: LeaseStatus.EXPIRED,
      });

      // Update unit status: OCCUPIED → AVAILABLE
      await this.unitRepository.update(lease.unitId, {
        status: UnitStatus.AVAILABLE,
      });

      // Update tenant status if needed
      const activeLeasesCount = await this.leaseRepository.count({
        where: {
          tenantId: lease.tenantId,
          companyId: lease.companyId,
          status: LeaseStatus.ACTIVE,
          isActive: true,
        },
      });
      await this.tenantService.updateTenantStatusBasedOnActiveLeaseCount(
        lease.tenantId,
        lease.companyId,
        activeLeasesCount,
      );
    }
  }


  private toResponseDto(lease: Lease): LeaseResponseDto {
    return {
      id: lease.id,
      tenantId: lease.tenantId,
      tenantName: lease.tenant?.name,
      tenantEmail: lease.tenant?.email,
      unitId: lease.unitId,
      unitNumber: lease.unit?.unitNumber,
      propertyId: lease.unit?.propertyId,
      propertyName: lease.unit?.property?.name,
      companyId: lease.companyId,
      landlordUserId: lease.landlordUserId,
      leaseNumber: lease.leaseNumber,
      status: lease.status,
      leaseType: lease.leaseType,
      startDate: lease.startDate,
      endDate: lease.endDate,
      moveInDate: lease.moveInDate,
      moveOutDate: lease.moveOutDate,
      signedDate: lease.signedDate,
      renewalDate: lease.renewalDate,
      noticeToVacateDate: lease.noticeToVacateDate,
      billingStartDate: lease.billingStartDate,
      proratedFirstMonth: lease.proratedFirstMonth,
      gracePeriodDays: lease.gracePeriodDays,
      monthlyRent: typeof lease.monthlyRent === 'string' ? Number(lease.monthlyRent) : lease.monthlyRent,
      securityDeposit: lease.securityDeposit ? (typeof lease.securityDeposit === 'string' ? Number(lease.securityDeposit) : lease.securityDeposit) : undefined,
      petDeposit: lease.petDeposit ? (typeof lease.petDeposit === 'string' ? Number(lease.petDeposit) : lease.petDeposit) : undefined,
      petRent: lease.petRent ? (typeof lease.petRent === 'string' ? Number(lease.petRent) : lease.petRent) : undefined,
      lateFeeAmount: lease.lateFeeAmount ? (typeof lease.lateFeeAmount === 'string' ? Number(lease.lateFeeAmount) : lease.lateFeeAmount) : undefined,
      utilitiesIncluded: lease.utilitiesIncluded,
      utilityCosts: lease.utilityCosts ? (typeof lease.utilityCosts === 'string' ? Number(lease.utilityCosts) : lease.utilityCosts) : undefined,
      currency: lease.currency,
      terminationReason: lease.terminationReason,
      terminatedBy: lease.terminatedBy,
      terminationNotes: lease.terminationNotes,
      actualTerminationDate: lease.actualTerminationDate,
      renewedFromLeaseId: lease.renewedFromLeaseId,
      renewedToLeaseId: lease.renewedToLeaseId,
      leaseTerm: lease.leaseTerm,
      renewalOptions: lease.renewalOptions,
      noticePeriod: lease.noticePeriod,
      petPolicy: lease.petPolicy,
      smokingPolicy: lease.smokingPolicy,
      terms: lease.terms,
      coTenants: lease.coTenants,
      guarantorInfo: lease.guarantorInfo,
      documents: lease.documents,
      notes: lease.notes,
      tags: lease.tags,
      createdBy: lease.createdBy,
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt,
    };
  }
}
