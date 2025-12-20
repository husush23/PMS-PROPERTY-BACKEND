import { Injectable, UnauthorizedException, HttpStatus } from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages.constant';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { CompanyService } from '../../company/company.service';
import { UserRole } from '../../../shared/enums/user-role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private companyService: CompanyService,
  ) {
    const secret = configService.get<string>('jwt.secret') || process.env.JWT_SECRET;
    // For development, use a default secret if not provided (NOT for production!)
    const finalSecret = secret || 'dev-secret-key-change-in-production';
    
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production. Please set it in your .env file.');
    }

    if (!secret) {
      console.warn('⚠️  WARNING: JWT_SECRET not set. Using default development secret. This is NOT secure for production!');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: finalSecret,
    });
  }

  async validate(payload: any) {
    // The payload contains the user data that was encoded in the JWT
    if (!payload.sub) {
      throw new BusinessException(
        ErrorCode.TOKEN_INVALID,
        ERROR_MESSAGES.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Fetch the user from database to ensure they still exist and are active
    try {
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

      // If token has companyId, validate user belongs to that company
      if (payload.companyId) {
        const role = await this.companyService.getUserRoleInCompany(
          user.id,
          payload.companyId,
        );

        if (!role) {
          throw new BusinessException(
            ErrorCode.USER_NOT_BELONGS_TO_COMPANY,
            ERROR_MESSAGES.USER_NOT_BELONGS_TO_COMPANY,
            HttpStatus.UNAUTHORIZED,
            { companyId: payload.companyId },
          );
        }

        return {
          id: user.id,
          email: user.email,
          companyId: payload.companyId,
          role: role as UserRole,
        };
      }

      // Token without companyId (user needs to select company)
      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      // If NotFoundException is thrown, convert to UnauthorizedException
      if (error.status === 404) {
        throw new UnauthorizedException('User not found');
      }
      throw error;
    }
  }
}


