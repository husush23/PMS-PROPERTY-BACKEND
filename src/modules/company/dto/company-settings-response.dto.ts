import { ApiProperty } from '@nestjs/swagger';
import { LateFeeType } from '../../../shared/enums/late-fee-type.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class CompanySettingsResponseDto {
  @ApiProperty({
    description: 'Settings unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiProperty({ description: 'Company timezone', example: 'Africa/Nairobi' })
  timezone: string;

  @ApiProperty({ description: 'Default currency code', example: 'USD' })
  defaultCurrency: string;

  @ApiProperty({
    description: 'Default grace period days',
    example: 0,
  })
  defaultGracePeriodDays: number;

  @ApiProperty({
    description: 'Default late fee type',
    enum: LateFeeType,
  })
  defaultLateFeeType: LateFeeType;

  @ApiProperty({
    description: 'Default late fee value (amount or percentage)',
    example: 50,
  })
  defaultLateFeeValue: number;

  @ApiProperty({
    description: 'Default role for invited users',
    enum: UserRole,
  })
  defaultInvitedRole: UserRole;

  @ApiProperty({
    description: 'Whether staff can record payments',
    example: true,
  })
  staffCanRecordPayments: boolean;

  @ApiProperty({
    description: 'Whether staff can approve payments',
    example: false,
  })
  staffCanApprovePayments: boolean;

  @ApiProperty({
    description: 'Whether staff can invite tenants',
    example: false,
  })
  staffCanInviteTenants: boolean;

  @ApiProperty({
    description: 'Allowed payment methods',
    isArray: true,
    enum: PaymentMethod,
  })
  allowedPaymentMethods: PaymentMethod[];

  @ApiProperty({
    description: 'Require admin approval for payments',
    example: false,
  })
  requirePaymentApproval: boolean;

  @ApiProperty({
    description: 'Allow partial payments',
    example: true,
  })
  allowPartialPayments: boolean;

  @ApiProperty({
    description: 'Allow advance payments',
    example: true,
  })
  allowAdvancePayments: boolean;

  @ApiProperty({
    description: 'Require payment reference/receipt code',
    example: false,
  })
  requirePaymentReference: boolean;

  @ApiProperty({
    description: 'Default email notifications for tenants',
    example: true,
  })
  defaultEmailNotifications: boolean;

  @ApiProperty({
    description: 'Default SMS notifications for tenants',
    example: true,
  })
  defaultSmsNotifications: boolean;

  @ApiProperty({
    description: 'Auto-generate rent cycles',
    example: true,
  })
  autoGenerateRentCycles: boolean;

  @ApiProperty({
    description: 'Auto-apply credit balance to invoices',
    example: true,
  })
  autoApplyCredit: boolean;

  @ApiProperty({
    description: 'Auto-apply late fees when overdue',
    example: true,
  })
  autoApplyLateFees: boolean;

  @ApiProperty({
    description: 'Late fee enabled',
    example: false,
  })
  lateFeeEnabled: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
