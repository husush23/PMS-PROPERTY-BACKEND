import { IsUUID, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptCompanyInvitationPublicDto {
    @ApiProperty({
        description: 'Invitation token',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID('4', { message: 'Token must be a valid UUID' })
    token: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    @IsString()
    @MinLength(2)
    name: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePassword123!',
    })
    @IsString()
    @MinLength(8)
    password: string;
}
