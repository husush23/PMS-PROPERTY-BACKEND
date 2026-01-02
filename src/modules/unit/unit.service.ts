import { Injectable, HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto } from './dto/unit-response.dto';
import { ListUnitsQueryDto } from './dto/list-units-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { UnitStatus } from '../../shared/enums/unit-status.enum';

@Injectable()
export class UnitService {
  constructor(
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(
    createUnitDto: CreateUnitDto,
    userId: string,
  ): Promise<UnitResponseDto> {
    // Verify property exists
    const property = await this.propertyRepository.findOne({
      where: { id: createUnitDto.propertyId, isActive: true },
    });

    if (!property) {
      throw new BusinessException(
        ErrorCode.PROPERTY_NOT_FOUND,
        ERROR_MESSAGES.PROPERTY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { propertyId: createUnitDto.propertyId },
      );
    }

    // Auto-populate companyId from Property if not provided
    const companyId = createUnitDto.companyId || property.companyId;

    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN or MANAGER)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId,
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
          'Only company administrators and managers can create units.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Check if unitNumber already exists for this property
    const existingUnit = await this.unitRepository.findOne({
      where: {
        propertyId: createUnitDto.propertyId,
        unitNumber: createUnitDto.unitNumber,
        isActive: true,
      },
    });

    if (existingUnit) {
      throw new BusinessException(
        ErrorCode.UNIT_NUMBER_EXISTS,
        ERROR_MESSAGES.UNIT_NUMBER_EXISTS,
        HttpStatus.CONFLICT,
        {
          propertyId: createUnitDto.propertyId,
          unitNumber: createUnitDto.unitNumber,
        },
      );
    }

    // Create unit
    const unit = this.unitRepository.create({
      ...createUnitDto,
      companyId,
      status: createUnitDto.status || UnitStatus.AVAILABLE,
    });

    const savedUnit = await this.unitRepository.save(unit);
    return this.toResponseDto(savedUnit);
  }

  async findAll(
    query: ListUnitsQueryDto,
    userId: string,
  ): Promise<{
    data: UnitResponseDto[];
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

    const queryBuilder = this.unitRepository.createQueryBuilder('unit');

    // Company scoping - super admin can see all, others only their company's units
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
      queryBuilder.andWhere('unit.companyId IN (:...companyIds)', {
        companyIds,
      });
    }

    // Filter by propertyId if provided
    if (query.propertyId) {
      queryBuilder.andWhere('unit.propertyId = :propertyId', {
        propertyId: query.propertyId,
      });
    }

    // Filter by companyId if provided (super admin can filter by company)
    if (query.companyId) {
      queryBuilder.andWhere('unit.companyId = :companyId', {
        companyId: query.companyId,
      });
    }

    // Search filter (by unitNumber)
    if (query.search) {
      queryBuilder.andWhere('unit.unitNumber ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // Status filter
    if (query.status) {
      queryBuilder.andWhere('unit.status = :status', { status: query.status });
    }

    // Unit type filter
    if (query.unitType) {
      queryBuilder.andWhere('unit.unitType = :unitType', {
        unitType: query.unitType,
      });
    }

    // Rent range filters
    if (query.minRent !== undefined) {
      queryBuilder.andWhere('unit.monthlyRent >= :minRent', {
        minRent: query.minRent,
      });
    }

    if (query.maxRent !== undefined) {
      queryBuilder.andWhere('unit.monthlyRent <= :maxRent', {
        maxRent: query.maxRent,
      });
    }

    // Bedrooms filter
    if (query.bedrooms !== undefined) {
      queryBuilder.andWhere('unit.bedrooms = :bedrooms', {
        bedrooms: query.bedrooms,
      });
    }

    // Bathrooms filter
    if (query.bathrooms !== undefined) {
      queryBuilder.andWhere('unit.bathrooms = :bathrooms', {
        bathrooms: query.bathrooms,
      });
    }

    // Only active units
    queryBuilder.andWhere('unit.isActive = :isActive', { isActive: true });

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder.orderBy(`unit.${sortBy}`, sortOrder);

    // Pagination
    queryBuilder.skip(skip).take(limit);

    const [units, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: units.map((unit) => this.toResponseDto(unit)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string, userId: string): Promise<UnitResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const unit = await this.unitRepository.findOne({
      where: { id, isActive: true },
    });

    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId: id },
      );
    }

    if (!isSuperAdmin) {
      // Verify user has access to the unit's company
      const userCompany = await this.userCompanyRepository.findOne({
        where: {
          companyId: unit.companyId,
          userId,
          isActive: true,
        },
      });

      if (!userCompany) {
        throw new BusinessException(
          ErrorCode.UNIT_NOT_FOUND,
          ERROR_MESSAGES.UNIT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { unitId: id },
        );
      }
    }

    return this.toResponseDto(unit);
  }

  async update(
    id: string,
    updateUnitDto: UpdateUnitDto,
    userId: string,
  ): Promise<UnitResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const unit = await this.unitRepository.findOne({
      where: { id, isActive: true },
    });

    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId: id },
      );
    }

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN or MANAGER)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: unit.companyId,
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
          'Only company administrators and managers can update units.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // If unitNumber is being updated, check for uniqueness
    if (
      updateUnitDto.unitNumber &&
      updateUnitDto.unitNumber !== unit.unitNumber
    ) {
      const existingUnit = await this.unitRepository.findOne({
        where: {
          propertyId: unit.propertyId,
          unitNumber: updateUnitDto.unitNumber,
          isActive: true,
        },
      });

      if (existingUnit) {
        throw new BusinessException(
          ErrorCode.UNIT_NUMBER_EXISTS,
          ERROR_MESSAGES.UNIT_NUMBER_EXISTS,
          HttpStatus.CONFLICT,
          {
            propertyId: unit.propertyId,
            unitNumber: updateUnitDto.unitNumber,
          },
        );
      }
    }

    // If propertyId is being updated, validate new property exists and user has access
    if (
      updateUnitDto.propertyId &&
      updateUnitDto.propertyId !== unit.propertyId
    ) {
      const newProperty = await this.propertyRepository.findOne({
        where: { id: updateUnitDto.propertyId, isActive: true },
      });

      if (!newProperty) {
        throw new BusinessException(
          ErrorCode.PROPERTY_NOT_FOUND,
          ERROR_MESSAGES.PROPERTY_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { propertyId: updateUnitDto.propertyId },
        );
      }

      // Auto-update companyId if property changes
      if (!updateUnitDto.companyId) {
        updateUnitDto.companyId = newProperty.companyId;
      }
    }

    // Update unit
    await this.unitRepository.update(id, updateUnitDto);
    const updatedUnit = await this.unitRepository.findOne({
      where: { id },
    });

    return this.toResponseDto(updatedUnit!);
  }

  async delete(id: string, userId: string): Promise<void> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    const unit = await this.unitRepository.findOne({
      where: { id, isActive: true },
    });

    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId: id },
      );
    }

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN only)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId: unit.companyId,
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
          { companyId: unit.companyId },
        );
      }
    }

    // Soft delete
    await this.unitRepository.update(id, { isActive: false });
  }

  async findByProperty(
    propertyId: string,
    userId: string,
  ): Promise<UnitResponseDto[]> {
    // Verify property exists and user has access
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId, isActive: true },
    });

    if (!property) {
      throw new BusinessException(
        ErrorCode.PROPERTY_NOT_FOUND,
        ERROR_MESSAGES.PROPERTY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { propertyId },
      );
    }

    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

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
          { propertyId },
        );
      }
    }

    const units = await this.unitRepository.find({
      where: { propertyId, isActive: true },
      order: { unitNumber: 'ASC' },
    });

    return units.map((unit) => this.toResponseDto(unit));
  }

  private toResponseDto(unit: Unit): UnitResponseDto {
    return {
      id: unit.id,
      propertyId: unit.propertyId,
      companyId: unit.companyId,
      unitNumber: unit.unitNumber,
      status: unit.status,
      unitType: unit.unitType,
      monthlyRent: Number(unit.monthlyRent),
      squareFootage: unit.squareFootage,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms ? Number(unit.bathrooms) : null,
      depositAmount: unit.depositAmount ? Number(unit.depositAmount) : null,
      floorNumber: unit.floorNumber,
      description: unit.description,
      images: unit.images,
      features: unit.features,
      notes: unit.notes,
      leaseType: unit.leaseType,
      hasParking: unit.hasParking,
      parkingSpotNumber: unit.parkingSpotNumber,
      petFriendly: unit.petFriendly,
      furnished: unit.furnished,
      utilitiesIncluded: unit.utilitiesIncluded,
      utilityNotes: unit.utilityNotes,
      lateFeeAmount: unit.lateFeeAmount ? Number(unit.lateFeeAmount) : null,
      petDeposit: unit.petDeposit ? Number(unit.petDeposit) : null,
      petRent: unit.petRent ? Number(unit.petRent) : null,
      accessCode: unit.accessCode,
      isActive: unit.isActive,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }
}
