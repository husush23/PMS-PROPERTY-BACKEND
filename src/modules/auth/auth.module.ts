import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('jwt.secret') || process.env.JWT_SECRET;
        const expiresIn = configService.get<string>('jwt.expiresIn') || '15m';
        
        // For development, use a default secret if not provided (NOT for production!)
        const finalSecret = secret || 'dev-secret-key-change-in-production';
        
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET is required in production. Please set it in your .env file.');
        }

        if (!secret) {
          console.warn('⚠️  WARNING: JWT_SECRET not set. Using default development secret. This is NOT secure for production!');
        }

        return {
          secret: finalSecret,
          signOptions: {
            // @ts-expect-error - expiresIn accepts string like "15m" but types are strict
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    UserModule,
    CompanyModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}






