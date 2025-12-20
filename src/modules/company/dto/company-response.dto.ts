import { ApiProperty } from '@nestjs/swagger';

export class CompanyResponseDto {
  @ApiProperty({
    description: 'Company unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Property Management',
  })
  name: string;

  @ApiProperty({
    description: 'Company slug',
    example: 'acme-property',
    nullable: true,
  })
  slug: string | null;

  @ApiProperty({
    description: 'Company address',
    example: '123 Main St, City, State 12345',
    nullable: true,
  })
  address: string | null;

  @ApiProperty({
    description: 'Company phone number',
    example: '+1234567890',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: 'Company email',
    example: 'contact@company.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Company logo URL',
    nullable: true,
  })
  logo: string | null;

  @ApiProperty({
    description: 'Company active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Company creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Company last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

