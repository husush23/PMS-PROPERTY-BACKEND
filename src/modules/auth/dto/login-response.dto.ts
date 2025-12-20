import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { CompanyResponseDto } from '../../company/dto/company-response.dto';

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token (may or may not include companyId)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'List of companies the user belongs to',
    type: [CompanyResponseDto],
  })
  companies: CompanyResponseDto[];

  @ApiProperty({
    description: 'Whether company selection is required',
    example: false,
  })
  requiresCompanySelection: boolean;
}

