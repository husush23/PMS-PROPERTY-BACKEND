import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class InviteUserDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Role to assign to the user in the company',
    enum: UserRole,
    example: UserRole.MANAGER,
  })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole enum value' })
  role: UserRole;
}

