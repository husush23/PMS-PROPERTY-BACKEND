import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptTenantInviteDto {
  @ApiProperty({
    description: 'Invitation token from the email link',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Password to set for the account',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

