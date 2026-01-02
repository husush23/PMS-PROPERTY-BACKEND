import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteTenantDto {
  @ApiProperty({
    description: 'Email address of the tenant to invite',
    example: 'tenant@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

