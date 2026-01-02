import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class AddUserToCompanyDto {
  @ApiProperty({
    description: 'User ID to add to company',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'User role in the company',
    enum: UserRole,
    example: UserRole.TENANT,
  })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole enum value' })
  role: UserRole;
}
