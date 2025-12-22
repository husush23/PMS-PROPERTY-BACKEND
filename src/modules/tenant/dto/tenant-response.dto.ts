import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '../../../shared/enums/tenant-status.enum';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class TenantResponseDto {
  @ApiProperty({
    description: 'Tenant profile unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiProperty({
    description: 'Email address',
    example: 'tenant@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: "User's full name",
    example: 'John Doe',
    nullable: true,
  })
  name: string | null;

  @ApiPropertyOptional({
    description: 'Primary phone number',
    example: '+1234567890',
    nullable: true,
  })
  phone: string | null;

  @ApiPropertyOptional({
    description: 'Alternative phone number',
    example: '+1234567891',
    nullable: true,
  })
  alternativePhone: string | null;

  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-15',
    nullable: true,
  })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({
    description: 'Government ID or passport number',
    example: '123-45-6789',
    nullable: true,
  })
  idNumber: string | null;

  @ApiPropertyOptional({
    description: 'Type of ID',
    example: 'SSN',
    nullable: true,
  })
  idType: string | null;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '123 Main Street',
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
    nullable: true,
  })
  city: string | null;

  @ApiPropertyOptional({
    description: 'State or Province',
    example: 'NY',
    nullable: true,
  })
  state: string | null;

  @ApiPropertyOptional({
    description: 'ZIP or Postal code',
    example: '10001',
    nullable: true,
  })
  zipCode: string | null;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    nullable: true,
  })
  country: string | null;

  @ApiPropertyOptional({
    description: 'Emergency contact name',
    example: 'Jane Doe',
    nullable: true,
  })
  emergencyContactName: string | null;

  @ApiPropertyOptional({
    description: 'Emergency contact phone number',
    example: '+1234567892',
    nullable: true,
  })
  emergencyContactPhone: string | null;

  @ApiPropertyOptional({
    description: 'Emergency contact relationship',
    example: 'Spouse',
    nullable: true,
  })
  emergencyContactRelationship: string | null;

  @ApiProperty({
    description: 'Tenant status',
    enum: TenantStatus,
    example: TenantStatus.PENDING,
  })
  status: TenantStatus;

  @ApiPropertyOptional({
    description: 'Additional notes about the tenant',
    example: 'Prefers first floor units',
    nullable: true,
  })
  notes: string | null;

  @ApiPropertyOptional({
    description: 'Tags for categorizing tenants',
    example: ['preferred', 'pet_owner'],
    type: [String],
    nullable: true,
  })
  tags: string[] | null;

  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
  })
  emailNotifications: boolean;

  @ApiProperty({
    description: 'Enable SMS notifications',
    example: true,
  })
  smsNotifications: boolean;

  @ApiProperty({
    description: 'User role (always TENANT)',
    enum: UserRole,
    example: UserRole.TENANT,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Date when tenant joined the company',
    example: '2024-01-01T00:00:00.000Z',
  })
  joinedAt: Date;

  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Tenant profile creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Tenant profile last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

