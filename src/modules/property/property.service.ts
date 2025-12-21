import {
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';
import { Unit } from '../unit/entities/unit.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { PropertyStatus } from '../../shared/enums/property-status.enum';

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
    data: PropertyResponseDto[];
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
      queryBuilder.andWhere('property.companyId IN (:...companyIds)', { companyIds });
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
      queryBuilder.andWhere('property.status = :status', { status: query.status });
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

    return {
      data: properties.map((property) => this.toResponseDto(property, 0)), // numberOfUnits will be 0 until Units module is implemented
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string, userId: string): Promise<PropertyResponseDto> {
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
    return this.toResponseDto(property, unitCount);
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

  private toResponseDto(property: Property, numberOfUnits: number = 0): PropertyResponseDto {
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
