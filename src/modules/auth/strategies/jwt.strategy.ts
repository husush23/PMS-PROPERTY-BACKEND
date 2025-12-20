import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
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
    // You can add additional validation here, e.g., check if user still exists
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Optionally, fetch the user from database to ensure they still exist
    // const user = await this.userService.findById(payload.sub);
    // if (!user) {
    //   throw new UnauthorizedException('User not found');
    // }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}


