import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteTenantDto {
  @ApiPropertyOptional({
    description: 'Email address of the tenant to invite',
    example: 'tenant@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiProperty({
    description: 'Phone number of the tenant to invite',
    example: '+1234567890',
  })
  @IsString()
  phone: string;
}





