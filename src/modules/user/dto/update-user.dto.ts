import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'User password',
    example: 'NewSecurePassword123!',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;

  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    example: UserRole.TENANT,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole enum value' })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'User active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

