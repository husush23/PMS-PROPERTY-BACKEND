import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
    @ApiProperty({
        description: 'Email verification token received in the verification email',
        example: 'uuid-token-here',
    })
    @IsString()
    @IsNotEmpty()
    token: string;
}
