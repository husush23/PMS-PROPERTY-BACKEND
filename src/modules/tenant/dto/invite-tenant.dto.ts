import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteTenantDto {
  @ApiProperty({
    description: 'Email address of the tenant to invite',
    example: 'tenant@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number of the tenant to invite',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}





