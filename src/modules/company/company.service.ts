import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { UserCompany } from './entities/user-company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { AddUserToCompanyDto } from './dto/add-user-to-company.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserRole } from '../../shared/enums/user-role.enum';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
  ) {}

  async create(
    createCompanyDto: CreateCompanyDto,
    userId: string,
  ): Promise<CompanyResponseDto> {
    // Check if slug already exists
    if (createCompanyDto.slug) {
      const existing = await this.companyRepository.findOne({
        where: { slug: createCompanyDto.slug },
      });
      if (existing) {
        throw new BusinessException(
          ErrorCode.COMPANY_SLUG_EXISTS,
          ERROR_MESSAGES.COMPANY_SLUG_EXISTS,
          HttpStatus.CONFLICT,
          { field: 'slug', value: createCompanyDto.slug },
        );
      }
    }

    // Generate slug from name if not provided
    let slug = createCompanyDto.slug;
    if (!slug) {
      slug = this.generateSlug(createCompanyDto.name);
      // Ensure uniqueness
      let counter = 1;
      let uniqueSlug = slug;
      while (
        await this.companyRepository.findOne({ where: { slug: uniqueSlug } })
      ) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = uniqueSlug;
    }

    const company = this.companyRepository.create({
      ...createCompanyDto,
      slug,
    });

    const savedCompany = await this.companyRepository.save(company);

    // Assign creator as COMPANY_ADMIN
    await this.assignUserToCompany(userId, savedCompany.id, UserRole.COMPANY_ADMIN);

    return this.toResponseDto(savedCompany);
  }

  async findAll(userId: string): Promise<CompanyResponseDto[]> {
    const userCompanies = await this.userCompanyRepository.find({
      where: { userId, isActive: true },
      relations: ['company'],
    });

    return userCompanies.map((uc) => this.toResponseDto(uc.company));
  }

  async findOne(id: string, userId: string): Promise<CompanyResponseDto> {
    // Verify user belongs to company
    const userCompany = await this.userCompanyRepository.findOne({
      where: { companyId: id, userId, isActive: true },
      relations: ['company'],
    });

    if (!userCompany) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId: id },
      );
    }

    return this.toResponseDto(userCompany.company);
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    userId: string,
  ): Promise<CompanyResponseDto> {
    // Verify user is COMPANY_ADMIN of this company
    const userCompany = await this.userCompanyRepository.findOne({
      where: {
        companyId: id,
        userId,
        role: UserRole.COMPANY_ADMIN,
        isActive: true,
      },
    });

    if (!userCompany) {
      throw new BusinessException(
        ErrorCode.NOT_COMPANY_ADMIN,
        ERROR_MESSAGES.NOT_COMPANY_ADMIN,
        HttpStatus.FORBIDDEN,
        { companyId: id },
      );
    }

    if (updateCompanyDto.slug) {
      const existing = await this.companyRepository.findOne({
        where: { slug: updateCompanyDto.slug },
      });
      if (existing && existing.id !== id) {
        throw new BusinessException(
          ErrorCode.COMPANY_SLUG_EXISTS,
          ERROR_MESSAGES.COMPANY_SLUG_EXISTS,
          HttpStatus.CONFLICT,
          { field: 'slug', value: updateCompanyDto.slug },
        );
      }
    }

    await this.companyRepository.update(id, updateCompanyDto);
    const updated = await this.companyRepository.findOne({ where: { id } });
    return this.toResponseDto(updated!);
  }

  async assignUserToCompany(
    userId: string,
    companyId: string,
    role: UserRole,
  ): Promise<UserCompany> {
    // Check if already assigned
    const existing = await this.userCompanyRepository.findOne({
      where: { userId, companyId },
    });

    if (existing) {
      throw new BusinessException(
        ErrorCode.USER_ALREADY_IN_COMPANY,
        ERROR_MESSAGES.USER_ALREADY_IN_COMPANY,
        HttpStatus.CONFLICT,
        { userId, companyId },
      );
    }

    const userCompany = this.userCompanyRepository.create({
      userId,
      companyId,
      role,
    });

    return this.userCompanyRepository.save(userCompany);
  }

  async addUserToCompany(
    companyId: string,
    addUserDto: AddUserToCompanyDto,
    requesterUserId: string,
  ): Promise<void> {
    // Verify requester has permission (COMPANY_ADMIN or MANAGER)
    const requester = await this.userCompanyRepository.findOne({
      where: {
        companyId,
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
        'Only company administrators and managers can add users to the company.',
        HttpStatus.FORBIDDEN,
        { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
      );
    }

    await this.assignUserToCompany(addUserDto.userId, companyId, addUserDto.role);
  }

  async updateUserRole(
    companyId: string,
    userId: string,
    updateRoleDto: UpdateUserRoleDto,
    requesterUserId: string,
  ): Promise<void> {
    // Verify requester has permission (COMPANY_ADMIN only)
    const requester = await this.userCompanyRepository.findOne({
      where: {
        companyId,
        userId: requesterUserId,
        role: UserRole.COMPANY_ADMIN,
        isActive: true,
      },
    });

    if (!requester) {
      throw new BusinessException(
        ErrorCode.NOT_COMPANY_ADMIN,
        ERROR_MESSAGES.NOT_COMPANY_ADMIN,
        HttpStatus.FORBIDDEN,
        { companyId },
      );
    }

    const userCompany = await this.userCompanyRepository.findOne({
      where: { companyId, userId },
    });

    if (!userCompany) {
      throw new NotFoundException('User is not assigned to this company');
    }

    await this.userCompanyRepository.update(userCompany.id, {
      role: updateRoleDto.role,
    });
  }

  async removeUserFromCompany(
    companyId: string,
    userId: string,
    requesterUserId: string,
  ): Promise<void> {
    // Verify requester has permission (COMPANY_ADMIN only)
    const requester = await this.userCompanyRepository.findOne({
      where: {
        companyId,
        userId: requesterUserId,
        role: UserRole.COMPANY_ADMIN,
        isActive: true,
      },
    });

    if (!requester) {
      throw new BusinessException(
        ErrorCode.NOT_COMPANY_ADMIN,
        ERROR_MESSAGES.NOT_COMPANY_ADMIN,
        HttpStatus.FORBIDDEN,
        { companyId },
      );
    }

    const userCompany = await this.userCompanyRepository.findOne({
      where: { companyId, userId },
    });

    if (!userCompany) {
      throw new BusinessException(
        ErrorCode.USER_NOT_IN_COMPANY,
        ERROR_MESSAGES.USER_NOT_IN_COMPANY,
        HttpStatus.NOT_FOUND,
        { userId, companyId },
      );
    }

    await this.userCompanyRepository.delete(userCompany.id);
  }

  async getUserRoleInCompany(
    userId: string,
    companyId: string,
  ): Promise<UserRole | null> {
    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId, companyId, isActive: true },
    });

    return userCompany ? userCompany.role : null;
  }

  async getUserCompanies(userId: string): Promise<CompanyResponseDto[]> {
    return this.findAll(userId);
  }

  async createDefaultCompany(name: string = 'Default Company'): Promise<Company> {
    const company = this.companyRepository.create({
      name,
      slug: this.generateSlug(name),
      isActive: true,
    });

    return this.companyRepository.save(company);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toResponseDto(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      address: company.address,
      phone: company.phone,
      email: company.email,
      logo: company.logo,
      isActive: company.isActive,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}

