import { Injectable, HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Lease } from '../lease/entities/lease.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { CompanySettingsService } from '../company/company-settings.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { PropertyListItemDto } from './dto/property-list-item.dto';
import {
  PropertyDetailsResponseDto,
  PropertyOccupancySummaryDto,
  PropertyFinancialSummaryDto,
} from './dto/property-details-response.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { PropertyStatus } from '../../shared/enums/property-status.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    userId: string,
  ): Promise<PropertyResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN or MANAGER)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: createPropertyDto.companyId,
          userId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can create properties.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Verify company exists
    const company = await this.companyRepository.findOne({
      where: { id: createPropertyDto.companyId },
    });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId: createPropertyDto.companyId },
      );
    }

    // Create property
    const property = this.propertyRepository.create({
      ...createPropertyDto,
      status: createPropertyDto.status || PropertyStatus.AVAILABLE,
    });

    const savedProperty = await this.propertyRepository.save(property);
    const unitCount = await this.unitRepository.count({
      where: { propertyId: savedProperty.id, isActive: true },
    });
    return this.toResponseDto(savedProperty, unitCount);
  }

  async findAll(
    query: ListPropertiesQueryDto,
    userId: string,
  ): Promise<{
    data: PropertyListItemDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const queryBuilder = this.propertyRepository.createQueryBuilder('property');

    // Company scoping - super admin can see all, others only their company
    if (!isSuperAdmin) {
      const userCompanies = await this.userCompanyRepository.find({
        where: { userId, isActive: true },
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
      queryBuilder.andWhere('property.companyId IN (:...companyIds)', {
        companyIds,
      });
    }

    // Filter by companyId if provided (super admin can filter by company)
    if (query.companyId) {
      queryBuilder.andWhere('property.companyId = :companyId', {
        companyId: query.companyId,
      });
    }

    // Search filter
    if (query.search) {
      queryBuilder.andWhere(
        '(property.name ILIKE :search OR property.address ILIKE :search OR property.city ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Status filter
    if (query.status) {
      queryBuilder.andWhere('property.status = :status', {
        status: query.status,
      });
    }

    // Property type filter
    if (query.propertyType) {
      queryBuilder.andWhere('property.propertyType = :propertyType', {
        propertyType: query.propertyType,
      });
    }

    // City filter
    if (query.city) {
      queryBuilder.andWhere('property.city = :city', { city: query.city });
    }

    // State filter
    if (query.state) {
      queryBuilder.andWhere('property.state = :state', { state: query.state });
    }

    // Only active properties
    queryBuilder.andWhere('property.isActive = :isActive', { isActive: true });

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder.orderBy(`property.${sortBy}`, sortOrder);

    // Pagination
    queryBuilder.skip(skip).take(limit);

    const [properties, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    const countMap = new Map<string, number>();
    const occupiedMap = new Map<string, number>();
    if (properties.length > 0) {
      const propertyIds = properties.map((p) => p.id);
      const counts = await this.unitRepository
        .createQueryBuilder('u')
        .select('u.propertyId', 'propertyId')
        .addSelect('COUNT(*)', 'cnt')
        .where('u.propertyId IN (:...propertyIds)', { propertyIds })
        .andWhere('u.isActive = :isActive', { isActive: true })
        .groupBy('u.propertyId')
        .getRawMany();
      for (const row of counts) {
        countMap.set(row.propertyId, Number(row.cnt) || 0);
      }

      const asOfDate = new Date().toISOString().slice(0, 10);
      const occupiedCounts = await this.leaseRepository
        .createQueryBuilder('l')
        .innerJoin('l.unit', 'unit')
        .select('unit.propertyId', 'propertyId')
        .addSelect('COUNT(*)', 'cnt')
        .where('unit.propertyId IN (:...propertyIds)', { propertyIds })
        .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
        .andWhere('l.startDate <= :asOfDate', { asOfDate })
        .andWhere('l.endDate >= :asOfDate', { asOfDate })
        .groupBy('unit.propertyId')
        .getRawMany();
      for (const row of occupiedCounts) {
        occupiedMap.set(row.propertyId, Number(row.cnt) || 0);
      }
    }

    return {
      data: properties.map((property) => {
        const totalUnits = countMap.get(property.id) ?? 0;
        const occupiedUnits = occupiedMap.get(property.id) ?? 0;
        const occupancyRatePercent =
          totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
        const base = this.toResponseDto(property, totalUnits);
        return {
          ...base,
          occupiedUnits,
          occupancyRatePercent,
        } as PropertyListItemDto;
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<PropertyDetailsResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const property = await this.propertyRepository.findOne({
      where: { id, isActive: true },
    });

    if (!property) {
      throw new BusinessException(
        ErrorCode.PROPERTY_NOT_FOUND,
        ERROR_MESSAGES.PROPERTY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { propertyId: id },
      );
    }

    if (!isSuperAdmin) {
      // Verify user has access to the property's company
      const userCompany = await this.userCompanyRepository.findOne({
        where: {
          companyId: property.companyId,
          userId,
          isActive: true,
        },
      });

      if (!userCompany) {
        throw new BusinessException(
          ErrorCode.PROPERTY_NOT_FOUND,
          ERROR_MESSAGES.PROPERTY_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { propertyId: id },
        );
      }
    }

    const unitCount = await this.unitRepository.count({
      where: { propertyId: id, isActive: true },
    });

    const base = this.toResponseDto(property, unitCount);
    const occupancy = await this.getOccupancySummary(id, unitCount);
    const financial = await this.getFinancialSummary(id, property.companyId);
    return {
      ...base,
      occupancy: occupancy ?? undefined,
      financial: financial ?? undefined,
    };
  }

  private async getOccupancySummary(
    propertyId: string,
    totalUnits: number,
  ): Promise<PropertyOccupancySummaryDto | null> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const occupiedCount = await this.leaseRepository
      .createQueryBuilder('l')
      .innerJoin('l.unit', 'unit')
      .where('unit.propertyId = :propertyId', { propertyId })
      .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
      .andWhere('l.startDate <= :asOfDate', { asOfDate })
      .andWhere('l.endDate >= :asOfDate', { asOfDate })
      .getCount();
    const occupancyRatePercent =
      totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;
    return {
      occupiedUnits: occupiedCount,
      totalUnits,
      occupancyRatePercent,
      asOfDate,
    };
  }

  private async getFinancialSummary(
    propertyId: string,
    companyId: string,
  ): Promise<PropertyFinancialSummaryDto | null> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const settings = await this.companySettingsService.getOrCreate(companyId);
    const currency = settings?.defaultCurrency ?? 'USD';

    const cycles = await this.rentCycleRepository
      .createQueryBuilder('rc')
      .innerJoin('rc.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .where('unit.propertyId = :propertyId', { propertyId })
      .andWhere('rc.isVoid = :isVoid', { isVoid: false })
      .andWhere('rc.dueDate >= :periodStart', { periodStart })
      .andWhere('rc.dueDate <= :periodEnd', { periodEnd })
      .andWhere('lease.currency = :currency', { currency })
      .getMany();

    const totalRentDue = cycles.reduce(
      (sum, c) => sum + Number(c.totalAmountDue ?? 0),
      0,
    );
    const cycleIds = cycles.map((c) => c.id);
    if (cycleIds.length === 0) {
      return {
        currency,
        totalRentDue: 0,
        totalRentCollected: 0,
        outstandingBalance: 0,
        periodStart,
        periodEnd,
      };
    }

    const excludedStatuses = [PaymentStatus.REFUNDED, PaymentStatus.CANCELLED];
    const payments = await this.paymentRepository
      .createQueryBuilder('p')
      .where('p.rentCycleId IN (:...cycleIds)', { cycleIds })
      .andWhere('p.isActive = :isActive', { isActive: true })
      .andWhere('p.status NOT IN (:...excluded)', {
        excluded: excludedStatuses,
      })
      .getMany();
    const totalRentCollected = payments.reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0,
    );
    const outstandingBalance = Math.max(
      0,
      totalRentDue - totalRentCollected,
    );
    return {
      currency,
      totalRentDue,
      totalRentCollected,
      outstandingBalance,
      periodStart,
      periodEnd,
    };
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    userId: string,
  ): Promise<PropertyResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const property = await this.propertyRepository.findOne({
      where: { id, isActive: true },
    });

    if (!property) {
      throw new BusinessException(
        ErrorCode.PROPERTY_NOT_FOUND,
        ERROR_MESSAGES.PROPERTY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { propertyId: id },
      );
    }

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN or MANAGER)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: property.companyId,
          userId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can update properties.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Update property
    await this.propertyRepository.update(id, updatePropertyDto);
    const updatedProperty = await this.propertyRepository.findOne({
      where: { id },
    });

    const unitCount = await this.unitRepository.count({
      where: { propertyId: id, isActive: true },
    });
    return this.toResponseDto(updatedProperty!, unitCount);
  }

  async delete(id: string, userId: string): Promise<void> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const property = await this.propertyRepository.findOne({
      where: { id, isActive: true },
    });

    if (!property) {
      throw new BusinessException(
        ErrorCode.PROPERTY_NOT_FOUND,
        ERROR_MESSAGES.PROPERTY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { propertyId: id },
      );
    }

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN only)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: property.companyId,
          userId,
          role: UserRole.COMPANY_ADMIN,
          isActive: true,
        },
      });

      if (!requester) {
        throw new BusinessException(
          ErrorCode.NOT_COMPANY_ADMIN,
          ERROR_MESSAGES.NOT_COMPANY_ADMIN,
          HttpStatus.FORBIDDEN,
          { companyId: property.companyId },
        );
      }
    }

    // Soft delete
    await this.propertyRepository.update(id, { isActive: false });
  }

  private toResponseDto(
    property: Property,
    numberOfUnits: number = 0,
  ): PropertyResponseDto {
    return {
      id: property.id,
      name: property.name,
      companyId: property.companyId,
      propertyType: property.propertyType,
      status: property.status,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      country: property.country,
      phone: property.phone,
      email: property.email,
      description: property.description,
      latitude: property.latitude ? Number(property.latitude) : null,
      longitude: property.longitude ? Number(property.longitude) : null,
      yearBuilt: property.yearBuilt,
      squareFootage: property.squareFootage,
      floors: property.floors,
      parkingSpaces: property.parkingSpaces,
      totalUnits: property.totalUnits,
      numberOfUnits, // Computed from Units relation (0 for now until Units module is implemented)
      images: property.images,
      isActive: property.isActive,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };
  }
}
