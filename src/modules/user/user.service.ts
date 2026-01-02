import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PasswordUtil } from '../../common/utils/password.util';
import { CompanyService } from '../company/company.service';
import { UserRole } from '../../shared/enums/user-role.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    private companyService: CompanyService,
  ) {}

  async findAll(
    companyId: string,
    paginationQuery?: PaginationQueryDto,
  ): Promise<{
    data: UserResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = paginationQuery?.page || 1;
    const limit = paginationQuery?.limit || 10;
    const skip = (page - 1) * limit;

    // Get users in the company via UserCompany join table
    const [userCompanies, total] =
      await this.userCompanyRepository.findAndCount({
        where: { companyId, isActive: true },
        relations: ['user'],
        skip,
        take: limit,
        order: {
          joinedAt: 'DESC',
        },
      });

    const totalPages = Math.ceil(total / limit);

    return {
      data: userCompanies.map((uc) => this.toResponseDto(uc.user)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string, companyId?: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { field: 'userId', value: id },
      );
    }

    // If companyId provided, verify user belongs to company
    if (companyId) {
      const userCompany = await this.userCompanyRepository.findOne({
        where: { userId: id, companyId, isActive: true },
      });
      if (!userCompany) {
        throw new BusinessException(
          ErrorCode.USER_NOT_IN_COMPANY,
          ERROR_MESSAGES.USER_NOT_IN_COMPANY,
          HttpStatus.NOT_FOUND,
          { userId: id, companyId },
        );
      }
    }

    return this.toResponseDto(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.isSuperAdmin || false;
  }

  async promoteToSuperAdmin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isSuperAdmin: true });
  }

  async removeSuperAdmin(userId: string): Promise<void> {
    // Check if this is the last super admin
    const superAdminCount = await this.userRepository.count({
      where: { isSuperAdmin: true },
    });

    if (superAdminCount <= 1) {
      throw new BusinessException(
        ErrorCode.CANNOT_REMOVE_LAST_SUPER_ADMIN,
        ERROR_MESSAGES.CANNOT_REMOVE_LAST_SUPER_ADMIN,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userRepository.update(userId, { isSuperAdmin: false });
  }

  async create(
    createUserDto: CreateUserDto,
    companyId?: string,
    role: UserRole = UserRole.TENANT,
  ): Promise<UserResponseDto> {
    // Check for duplicate email
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      // If user exists and companyId provided, add them to company
      if (companyId) {
        try {
          await this.companyService.assignUserToCompany(
            existingUser.id,
            companyId,
            role,
          );
          return this.toResponseDto(existingUser);
        } catch (error) {
          if (
            error instanceof ConflictException ||
            error instanceof BusinessException
          ) {
            throw new BusinessException(
              ErrorCode.USER_ALREADY_IN_COMPANY,
              ERROR_MESSAGES.USER_ALREADY_IN_COMPANY,
              HttpStatus.CONFLICT,
              { userId: existingUser.id, companyId },
            );
          }
          throw error;
        }
      } else {
        throw new BusinessException(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
          HttpStatus.CONFLICT,
          { field: 'email', value: createUserDto.email },
        );
      }
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hash(createUserDto.password);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Assign user to company if companyId provided
    if (companyId) {
      await this.companyService.assignUserToCompany(
        savedUser.id,
        companyId,
        role,
      );
    }

    return this.toResponseDto(savedUser);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    companyId?: string,
  ): Promise<UserResponseDto> {
    // Check if user exists
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If companyId provided, verify user belongs to company
    if (companyId) {
      const userCompany = await this.userCompanyRepository.findOne({
        where: { userId: id, companyId, isActive: true },
      });
      if (!userCompany) {
        throw new NotFoundException('User not found in this company');
      }
    }

    // Check for duplicate email if email is being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.findByEmail(updateUserDto.email);
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

    await this.userRepository.update(id, updateData);
    const updatedUser = await this.userRepository.findOne({ where: { id } });
    return this.toResponseDto(updatedUser!);
  }

  async delete(id: string, companyId: string): Promise<boolean> {
    // Verify user belongs to company
    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: id, companyId },
    });

    if (!userCompany) {
      throw new NotFoundException('User not found in this company');
    }

    // Remove user from company (soft delete by setting isActive to false)
    await this.userCompanyRepository.update(userCompany.id, {
      isActive: false,
    });
    return true;
  }

  private toResponseDto(user: User): UserResponseDto {
    const { password, userCompanies, ...userResponse } = user;
    return userResponse as UserResponseDto;
  }
}
