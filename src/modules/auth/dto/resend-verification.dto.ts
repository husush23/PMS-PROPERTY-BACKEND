import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
    @ApiProperty({
        description: 'Email address to resend the verification link to',
        example: 'user@example.com',
    })
    @IsEmail()
    email: string;
}
