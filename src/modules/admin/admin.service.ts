import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Company } from '../company/entities/company.entity';
import { User } from '../user/entities/user.entity';
import { CompanyResponseDto } from '../company/dto/company-response.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { CreateCompanyDto } from '../company/dto/create-company.dto';
import { UpdateCompanyDto } from '../company/dto/update-company.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UpdateUserDto } from '../user/dto/update-user.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SystemStatsResponseDto } from './dto/system-stats-response.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { PasswordUtil } from '../../common/utils/password.util';
import { UserRole } from '../../shared/enums/user-role.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userService: UserService,
    private companyService: CompanyService,
  ) {}

  async findAllCompanies(query: ListCompaniesQueryDto): Promise<{
    data: CompanyResponseDto[];
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

    const where: any = {};
    if (query.search) {
      where.name = ILike(`%${query.search}%`);
    }

    const [companies, total] = await this.companyRepository.findAndCount({
      where: where,
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: companies.map((company) => this.toCompanyResponseDto(company)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findCompanyById(id: string): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId: id },
      );
    }
    return this.toCompanyResponseDto(company);
  }

  async createCompany(createCompanyDto: CreateCompanyDto): Promise<CompanyResponseDto> {
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
    return this.toCompanyResponseDto(savedCompany);
  }

  async updateCompany(id: string, updateCompanyDto: UpdateCompanyDto): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId: id },
      );
    }

    if (updateCompanyDto.slug && updateCompanyDto.slug !== company.slug) {
      const existing = await this.companyRepository.findOne({
        where: { slug: updateCompanyDto.slug },
      });
      if (existing) {
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
    return this.toCompanyResponseDto(updated!);
  }

  async deleteCompany(id: string): Promise<void> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId: id },
      );
    }

    await this.companyRepository.remove(company);
  }

  async findAllUsers(query: ListUsersQueryDto): Promise<{
    data: UserResponseDto[];
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

    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    if (query.search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    
    if (query.isSuperAdmin !== undefined) {
      queryBuilder.andWhere('user.isSuperAdmin = :isSuperAdmin', {
        isSuperAdmin: query.isSuperAdmin,
      });
    }
    
    queryBuilder.skip(skip).take(limit).orderBy('user.createdAt', 'DESC');
    
    const [users, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((user) => this.toUserResponseDto(user)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findUserById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { userId: id },
      );
    }
    return this.toUserResponseDto(user);
  }

  async promoteToSuperAdmin(userId: string): Promise<void> {
    await this.userService.promoteToSuperAdmin(userId);
  }

  async removeSuperAdmin(userId: string): Promise<void> {
    await this.userService.removeSuperAdmin(userId);
  }

  async activateUser(userId: string, isActive: boolean): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { userId },
      );
    }

    await this.userRepository.update(userId, { isActive });
    const updated = await this.userRepository.findOne({ where: { id: userId } });
    return this.toUserResponseDto(updated!);
  }

  async createUser(
    createUserDto: CreateAdminUserDto,
  ): Promise<UserResponseDto> {
    // Check for duplicate email
    const existingUser = await this.userService.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new BusinessException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
        HttpStatus.CONFLICT,
        { field: 'email', value: createUserDto.email },
      );
    }

    // Validate company exists if companyId provided
    if (createUserDto.companyId) {
      const company = await this.companyRepository.findOne({
        where: { id: createUserDto.companyId },
      });
      if (!company) {
        throw new BusinessException(
          ErrorCode.COMPANY_NOT_FOUND,
          ERROR_MESSAGES.COMPANY_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { companyId: createUserDto.companyId },
        );
      }
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hash(createUserDto.password);

    // Create user
    const user = this.userRepository.create({
      email: createUserDto.email.toLowerCase(),
      password: hashedPassword,
      name: createUserDto.name,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Assign user to company if companyId provided
    if (createUserDto.companyId) {
      const role = createUserDto.role || UserRole.TENANT;
      await this.companyService.assignUserToCompany(
        savedUser.id,
        createUserDto.companyId,
        role,
      );
    }

    return this.toUserResponseDto(savedUser);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { userId },
      );
    }

    // Check for duplicate email if email is being updated
    if (updateUserDto.email && updateUserDto.email.toLowerCase() !== user.email) {
      const emailExists = await this.userService.findByEmail(updateUserDto.email);
      if (emailExists) {
        throw new BusinessException(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
          HttpStatus.CONFLICT,
          { field: 'email', value: updateUserDto.email },
        );
      }
    }

    // Hash password if it's being updated
    const updateData: Partial<User> = { ...updateUserDto };
    if (updateUserDto.password) {
      updateData.password = await PasswordUtil.hash(updateUserDto.password);
    }

    // Normalize email to lowercase if provided
    if (updateUserDto.email) {
      updateData.email = updateUserDto.email.toLowerCase();
    }

    await this.userRepository.update(userId, updateData);
    const updated = await this.userRepository.findOne({ where: { id: userId } });
    return this.toUserResponseDto(updated!);
  }

  async deleteUser(userId: string, hardDelete: boolean = false): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { userId },
      );
    }

    // Prevent deleting last super admin
    if (user.isSuperAdmin) {
      const superAdminCount = await this.userRepository.count({
        where: { isSuperAdmin: true },
      });
      if (superAdminCount <= 1) {
        throw new BusinessException(
          ErrorCode.CANNOT_REMOVE_LAST_SUPER_ADMIN,
          ERROR_MESSAGES.CANNOT_REMOVE_LAST_SUPER_ADMIN,
          HttpStatus.BAD_REQUEST,
          { userId },
        );
      }
    }

    if (hardDelete) {
      // Hard delete: Permanently remove from database
      // Note: TypeORM will handle cascade deletes based on entity relationships
      // If there are foreign key constraints, this may fail - that's expected behavior
      await this.userRepository.remove(user);
    } else {
      // Soft delete: Deactivate user
      await this.userRepository.update(userId, { isActive: false });
      
      // Optionally deactivate all UserCompany relationships
      // This is handled by CompanyService if needed, but we'll leave them active
      // so the user can be reactivated later if needed
    }
  }

  async getSystemStats(): Promise<SystemStatsResponseDto> {
    const [
      totalCompanies,
      totalUsers,
      totalSuperAdmins,
      activeCompanies,
      activeUsers,
    ] = await Promise.all([
      this.companyRepository.count(),
      this.userRepository.count(),
      this.userRepository.count({ where: { isSuperAdmin: true } }),
      this.companyRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { isActive: true } }),
    ]);

    return {
      totalCompanies,
      totalUsers,
      totalSuperAdmins,
      activeCompanies,
      activeUsers,
    };
  }

  private toCompanyResponseDto(company: Company): CompanyResponseDto {
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

  private toUserResponseDto(user: User): UserResponseDto {
    const { password, userCompanies, ...userResponse } = user;
    return userResponse as UserResponseDto;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

