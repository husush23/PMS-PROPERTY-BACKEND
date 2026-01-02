import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class MemberResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: 'User role in the company',
    enum: UserRole,
    example: UserRole.MANAGER,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Date when user joined the company',
    example: '2024-01-01T00:00:00.000Z',
  })
  joinedAt: Date;

  @ApiProperty({
    description: 'Whether the user is active in the company',
    example: true,
  })
  isActive: boolean;
}
