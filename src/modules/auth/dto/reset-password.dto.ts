import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        example: 'uuid-token-here',
        description: 'The password reset token received via email',
    })
    @IsNotEmpty()
    @IsString()
    token: string;

    @ApiProperty({
        example: 'NewPassword123!',
        description: 'The new password',
        minLength: 6,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    newPassword: string;
}
