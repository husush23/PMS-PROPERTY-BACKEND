import { Injectable, UnauthorizedException, ConflictException, NotFoundException, HttpStatus } from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { PasswordUtil } from '../../common/utils/password.util';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../../shared/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private companyService: CompanyService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    
    if (!user) {
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        ERROR_MESSAGES.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.ACCOUNT_INACTIVE,
        ERROR_MESSAGES.ACCOUNT_INACTIVE,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        ERROR_MESSAGES.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    // Convert User entity to UserResponseDto
    const userResponse: UserResponseDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Super admin bypasses company selection - always return token without companyId
    if (user.isSuperAdmin) {
      const access_token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });
      
      // Get companies for display purposes (super admin can see all companies anyway)
      const companies = await this.companyService.getUserCompanies(user.id);
      
      return {
        access_token,
        user: userResponse,
        companies,
        requiresCompanySelection: false,
      };
    }

    // Get user's companies
    const companies = await this.companyService.getUserCompanies(user.id);

    // If user has 0 companies, return token without companyId
    if (companies.length === 0) {
      const access_token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });
      
      return {
        access_token,
        user: userResponse,
        companies: [],
        requiresCompanySelection: false,
      };
    }

    // If user has only one company, auto-select it
    if (companies.length === 1) {
      const companyId = companies[0].id;
      const role = await this.companyService.getUserRoleInCompany(user.id, companyId);
      const access_token = this.generateCompanyScopedToken(userResponse, companyId, role!);
      
      return {
        access_token,
        user: userResponse,
        companies,
        requiresCompanySelection: false,
      };
    }

    // If user has multiple companies, return token without companyId
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      access_token,
      user: userResponse,
      companies,
      requiresCompanySelection: true,
    };
  }

  async selectCompany(userId: string, companyId: string): Promise<AuthResponseDto> {
    // Get user to check if super admin
    const user = await this.userService.findById(userId);
    const userEntity = await this.userService.findByEmail(user.email);
    
    if (!userEntity) {
      throw new NotFoundException('User not found');
    }

    // Super admin can select any company (optional company context for specific views)
    if (userEntity.isSuperAdmin) {
      const role = await this.companyService.getUserRoleInCompany(userId, companyId);
      // Generate token with companyId if super admin wants company-specific view
      // But super admin doesn't require being a member
      const access_token = role
        ? this.generateCompanyScopedToken(user, companyId, role)
        : this.jwtService.sign({
            sub: user.id,
            email: user.email,
            companyId, // Include companyId for context but no role requirement
          });
      
      return {
        access_token,
        user,
      };
    }

    // Regular user - verify user belongs to company
    const role = await this.companyService.getUserRoleInCompany(userId, companyId);
    
    if (!role) {
      throw new BusinessException(
        ErrorCode.USER_NOT_BELONGS_TO_COMPANY,
        ERROR_MESSAGES.USER_NOT_BELONGS_TO_COMPANY,
        HttpStatus.NOT_FOUND,
        { companyId },
      );
    }
    
    // Generate company-scoped token
    const access_token = this.generateCompanyScopedToken(user, companyId, role);

    return {
      access_token,
      user,
    };
  }

  async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
    // Check for duplicate email
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BusinessException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
        HttpStatus.CONFLICT,
        { field: 'email', value: registerDto.email },
      );
    }

    // Create user only (no company)
    const user = await this.userService.create({
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
    });

    // Return token without companyId (user has no companies yet)
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      access_token,
      user,
      companies: [], // Empty - no companies yet
      requiresCompanySelection: false,
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    return this.userService.findById(userId);
  }

  async getUserCompanies(userId: string) {
    return this.companyService.getUserCompanies(userId);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: { name?: string; email?: string },
  ): Promise<UserResponseDto> {
    return this.userService.update(userId, updateProfileDto);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Get user to verify old password
    const userDto = await this.userService.findById(userId);
    const user = await this.userService.findByEmail(userDto.email);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isPasswordValid = await PasswordUtil.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password (no companyId needed for password change)
    await this.userService.update(userId, { password: newPassword });
  }

  private generateCompanyScopedToken(
    user: UserResponseDto,
    companyId: string,
    role: UserRole,
  ): string {
    const payload = {
      sub: user.id,
      email: user.email,
      companyId,
      role,
    };

    return this.jwtService.sign(payload);
  }
}






