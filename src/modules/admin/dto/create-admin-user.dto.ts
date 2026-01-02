import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class CreateAdminUserDto extends CreateUserDto {
  @ApiPropertyOptional({
    description: 'Optional company ID to assign user to during creation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Role to assign when adding user to company (defaults to TENANT)',
    enum: UserRole,
    example: UserRole.TENANT,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

