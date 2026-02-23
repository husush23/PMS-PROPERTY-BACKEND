import { randomUUID } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { NotificationService } from '../notification/notification.service';
import { RevokedRefreshToken } from './entities/revoked-refresh-token.entity';
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
    private configService: ConfigService,
    private notificationService: NotificationService,
    @InjectRepository(RevokedRefreshToken)
    private revokedRefreshTokenRepository: Repository<RevokedRefreshToken>,
  ) { }

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

  async login(
    loginDto: LoginDto,
  ): Promise<LoginResponseDto & { refresh_token: string }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // Block login if email is not verified
    if (!user.emailVerified) {
      throw new BusinessException(
        ErrorCode.EMAIL_NOT_VERIFIED,
        ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
        HttpStatus.FORBIDDEN,
      );
    }
    const userResponse: UserResponseDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      emailVerified: user.emailVerified,
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

      // Generate refresh token without companyId for super admin
      const refresh_token = this.generateRefreshToken(user.id, user.email);

      return {
        access_token,
        refresh_token,
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

      // Generate refresh token without companyId
      const refresh_token = this.generateRefreshToken(user.id, user.email);

      return {
        access_token,
        refresh_token,
        user: userResponse,
        companies: [],
        requiresCompanySelection: false,
      };
    }

    // If user has only one company, auto-select it
    if (companies.length === 1) {
      const companyId = companies[0].id;
      const role = await this.companyService.getUserRoleInCompany(
        user.id,
        companyId,
      );
      const access_token = this.generateCompanyScopedToken(
        userResponse,
        companyId,
        role!,
      );

      // Generate refresh token with companyId since we're auto-selecting
      const refresh_token = this.generateRefreshToken(
        user.id,
        user.email,
        companyId,
      );

      return {
        access_token,
        refresh_token,
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

    // Generate refresh token without companyId (user needs to select)
    const refresh_token = this.generateRefreshToken(user.id, user.email);

    return {
      access_token,
      refresh_token,
      user: userResponse,
      companies,
      requiresCompanySelection: true,
    };
  }

  async selectCompany(
    userId: string,
    companyId: string,
  ): Promise<AuthResponseDto & { refresh_token: string }> {
    // Get user to check if super admin
    const user = await this.userService.findById(userId);
    const userEntity = await this.userService.findByEmail(user.email);

    if (!userEntity) {
      throw new NotFoundException('User not found');
    }

    // Super admin can select any company (optional company context for specific views)
    if (userEntity.isSuperAdmin) {
      const role = await this.companyService.getUserRoleInCompany(
        userId,
        companyId,
      );
      // Generate token with companyId if super admin wants company-specific view
      // But super admin doesn't require being a member
      const access_token = role
        ? this.generateCompanyScopedToken(user, companyId, role)
        : this.jwtService.sign({
          sub: user.id,
          email: user.email,
          companyId, // Include companyId for context but no role requirement
        });

      // Generate refresh token with companyId
      const refresh_token = this.generateRefreshToken(
        user.id,
        user.email,
        companyId,
      );

      return {
        access_token,
        refresh_token,
        user,
      };
    }

    // Regular user - verify user belongs to company
    const role = await this.companyService.getUserRoleInCompany(
      userId,
      companyId,
    );

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

    // Generate refresh token with companyId
    const refresh_token = this.generateRefreshToken(
      user.id,
      user.email,
      companyId,
    );

    return {
      access_token,
      refresh_token,
      user,
    };
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<LoginResponseDto & { refresh_token: string }> {
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

    console.log(`[AuthService] User created: ${user.email} (ID: ${user.id}). Generating verification token...`);

    // Generate email verification token (expires in 24 hours)
    const verificationToken = randomUUID();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    // Save token to user
    await this.userService.update(user.id, {
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    } as any);

    // Send verification email
    await this.notificationService.sendEmailVerificationEmail(
      user.email,
      verificationToken,
      user.name || 'User',
    );

    // Generate tokens so frontend can show "check your inbox" screen
    const refresh_token = this.generateRefreshToken(user.id, user.email);
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      access_token,
      refresh_token,
      user,
      companies: [], // Empty - no companies yet
      requiresCompanySelection: false,
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userService.findByVerificationToken(token);

    if (!user || !user.emailVerificationToken || !user.emailVerificationExpires) {
      throw new BusinessException(
        ErrorCode.INVALID_VERIFICATION_TOKEN,
        ERROR_MESSAGES.INVALID_VERIFICATION_TOKEN,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (new Date() > user.emailVerificationExpires) {
      throw new BusinessException(
        ErrorCode.INVALID_VERIFICATION_TOKEN,
        'Your email verification link has expired. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userService.markEmailVerified(user.id);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);

    // Don't reveal whether the email exists
    if (!user) return;

    // Already verified — nothing to do
    if (user.emailVerified) return;

    // Generate a fresh token
    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await this.userService.update(user.id, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    } as any);

    await this.notificationService.sendEmailVerificationEmail(
      user.email,
      token,
      user.name || 'User',
    );
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
    const isPasswordValid = await PasswordUtil.compare(
      oldPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password (no companyId needed for password change)
    await this.userService.update(userId, { password: newPassword });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate random token
    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiration

    // Save token to user
    await this.userService.update(user.id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    } as any);

    // Send email
    await this.notificationService.sendPasswordResetEmail(
      user.email,
      token,
      user.name || 'User',
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find user by token
    const user = await this.userService.findByResetToken(token);

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      throw new BusinessException(
        ErrorCode.INVALID_RESET_TOKEN,
        'Invalid or expired password reset token',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if token is expired
    if (new Date() > user.resetPasswordExpires) {
      throw new BusinessException(
        ErrorCode.INVALID_RESET_TOKEN,
        'Password reset token has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Hash new password
    const hashedPassword = await PasswordUtil.hash(newPassword);

    // Update user: set new password and clear reset token fields
    // We use a direct update on the repository via userService (which exposes update but it does a query first).
    // To cleanly clear fields, we might need to cast null or use save.
    // UserService.update takes Partial<User> but might expect DTOs.
    // Let's check UserService.update signature again. 
    // It takes UpdateUserDto which allows password. 
    // It doesn't seem to expose clearing token fields easily via DTO if DTO is strict.
    // The UpdateUserDto likely doesn't have resetPasswordToken.
    // So we should add a specific method in UserService or use the fact that we can pass any object that matches Partial<User> if types allow.
    // But `update` method in UserService takes `UpdateUserDto`.
    // Let's create a specific method in UserService `clearResetTokenAndUpdatePassword` or just `updatePassword`.
    // Or, since I am in AuthService, I can inject UserRepository if I really wanted to, but better to stick to UserService.
    // I will add `updatePassword` to UserService which handles hashing too? 
    // No, `update` handles hashing.
    // I need to clear the tokens.
    // I'll add `resetUserPassword` to UserService.

    // For now, I'll assume I can just call update with a cast or I'll add the method to UserService in the next step if I can't.
    // Actually, I'll add `resetUserPassword` to UserService in the next step to be clean.
    // But wait, I can't leave this file broken. 
    // I'll implement it here assuming `userService.resetUserPassword` exists, and then add it.

    await this.userService.resetUserPassword(user.id, hashedPassword);
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

  /**
   * Generate refresh token using refresh secret
   */
  generateRefreshToken(
    userId: string,
    email: string,
    companyId?: string,
  ): string {
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      process.env.JWT_REFRESH_SECRET;

    // Get refreshExpiresIn with multiple fallbacks
    const configValue = this.configService.get<string>('jwt.refreshExpiresIn');
    const envValue = process.env.JWT_REFRESH_EXPIRES_IN;

    let refreshExpiresIn: string = '7d'; // Default fallback

    // Helper function to clean and validate expiresIn value
    const cleanExpiresIn = (value: string): string => {
      // Remove trailing commas, semicolons, and other invalid trailing characters
      // Also remove any leading/trailing whitespace
      const cleaned = value
        .trim()
        .replace(/[,;]+$/, '')
        .trim();
      // If empty after cleaning, return default
      if (!cleaned || cleaned === '') {
        return '7d';
      }
      return cleaned;
    };

    if (
      configValue &&
      typeof configValue === 'string' &&
      configValue.trim() !== ''
    ) {
      refreshExpiresIn = cleanExpiresIn(configValue);
    } else if (
      envValue &&
      typeof envValue === 'string' &&
      envValue.trim() !== ''
    ) {
      refreshExpiresIn = cleanExpiresIn(envValue);
    }

    if (!refreshSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET is required. Please set it in your .env file.',
      );
    }

    const payload: any = {
      sub: userId,
      email: email,
      type: 'refresh',
      jti: randomUUID(),
    };

    // Include companyId if provided
    if (companyId) {
      payload.companyId = companyId;
    }

    // Use jsonwebtoken directly since we need a different secret than the JWT module default
    const options: jwt.SignOptions = {
      // @ts-expect-error - expiresIn accepts string like "7d" but types are strict
      expiresIn: refreshExpiresIn,
    };

    return jwt.sign(payload, refreshSecret as jwt.Secret, options);
  }

  /**
   * Revoke a refresh token by jti (server-side invalidation on logout).
   */
  async revokeRefreshToken(jti: string, expiresAt: Date): Promise<void> {
    await this.revokedRefreshTokenRepository
      .createQueryBuilder()
      .insert()
      .into(RevokedRefreshToken)
      .values({ jti, expiresAt })
      .orIgnore()
      .execute();
  }

  /**
   * Validate refresh token and generate new access token
   */
  async refreshToken(
    refreshToken: string,
    companyId?: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET is required. Please set it in your .env file.',
      );
    }

    try {
      // Verify refresh token using jsonwebtoken directly since it uses a different secret
      interface RefreshTokenPayload {
        sub: string;
        type: string;
        companyId?: string;
        jti?: string;
      }
      const payload = jwt.verify(
        refreshToken,
        refreshSecret,
      ) as RefreshTokenPayload;

      if (payload.type !== 'refresh') {
        throw new BusinessException(
          ErrorCode.TOKEN_INVALID,
          ERROR_MESSAGES.TOKEN_INVALID,
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Server-side revocation: if jti present, reject if revoked (e.g. after logout)
      if (payload.jti) {
        const revoked = await this.revokedRefreshTokenRepository.findOne({
          where: { jti: payload.jti },
        });
        if (revoked) {
          throw new BusinessException(
            ErrorCode.TOKEN_INVALID,
            ERROR_MESSAGES.TOKEN_INVALID,
            HttpStatus.UNAUTHORIZED,
          );
        }
      }

      // Get user to ensure they still exist and are active
      const user = await this.userService.findById(payload.sub);

      if (!user) {
        throw new BusinessException(
          ErrorCode.USER_NOT_FOUND,
          ERROR_MESSAGES.USER_NOT_FOUND_AUTH,
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

      // Determine companyId from refresh token payload or parameter
      let finalCompanyId = companyId || payload.companyId;

      // Generate new access token
      const accessTokenPayload: any = {
        sub: user.id,
        email: user.email,
      };

      // If companyId is provided, verify user still belongs to that company
      if (finalCompanyId) {
        const role = await this.companyService.getUserRoleInCompany(
          user.id,
          finalCompanyId,
        );

        if (role) {
          // User still belongs to company - include companyId and role
          accessTokenPayload.companyId = finalCompanyId;
          accessTokenPayload.role = role;
        } else {
          // User no longer belongs to company - don't include companyId
          finalCompanyId = undefined;
        }
      }

      const access_token = this.jwtService.sign(accessTokenPayload);

      // Generate new refresh token (rotate refresh token) with companyId if available
      const refresh_token = this.generateRefreshToken(
        user.id,
        user.email,
        finalCompanyId,
      );

      return {
        access_token,
        refresh_token,
      };
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        ErrorCode.TOKEN_INVALID,
        ERROR_MESSAGES.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
