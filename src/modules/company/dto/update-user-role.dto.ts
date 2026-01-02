import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role for the user in the company',
    enum: UserRole,
    example: UserRole.MANAGER,
  })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole enum value' })
  role: UserRole;
}
