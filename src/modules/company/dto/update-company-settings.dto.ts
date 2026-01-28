import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LateFeeType } from '../../../shared/enums/late-fee-type.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ description: 'Company timezone', example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Default currency code', example: 'KES' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Currency code must be at least 3 characters' })
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Default grace period days',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultGracePeriodDays?: number;

  @ApiPropertyOptional({
    description: 'Default late fee type',
    enum: LateFeeType,
  })
  @IsOptional()
  @IsEnum(LateFeeType)
  defaultLateFeeType?: LateFeeType;

  @ApiPropertyOptional({
    description: 'Default late fee value (amount or percentage)',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  defaultLateFeeValue?: number;

  @ApiPropertyOptional({
    description: 'Default role for invited users',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole)
  defaultInvitedRole?: UserRole;

  @ApiPropertyOptional({
    description: 'Whether staff can record payments',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  staffCanRecordPayments?: boolean;

  @ApiPropertyOptional({
    description: 'Whether staff can approve payments',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  staffCanApprovePayments?: boolean;

  @ApiPropertyOptional({
    description: 'Whether staff can invite tenants',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  staffCanInviteTenants?: boolean;

  @ApiPropertyOptional({
    description: 'Allowed payment methods',
    isArray: true,
    enum: PaymentMethod,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PaymentMethod, { each: true })
  allowedPaymentMethods?: PaymentMethod[];

  @ApiPropertyOptional({
    description: 'Require admin approval for payments',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requirePaymentApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Allow partial payments',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allowPartialPayments?: boolean;

  @ApiPropertyOptional({
    description: 'Allow advance payments',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allowAdvancePayments?: boolean;

  @ApiPropertyOptional({
    description: 'Require payment reference/receipt code',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requirePaymentReference?: boolean;

  @ApiPropertyOptional({
    description: 'Default email notifications for tenants',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  defaultEmailNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Default SMS notifications for tenants',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  defaultSmsNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Auto-generate rent cycles',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoGenerateRentCycles?: boolean;

  @ApiPropertyOptional({
    description: 'Auto-apply credit balance to invoices',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoApplyCredit?: boolean;

  @ApiPropertyOptional({
    description: 'Auto-apply late fees when overdue',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoApplyLateFees?: boolean;

  @ApiPropertyOptional({
    description: 'Late fee enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  lateFeeEnabled?: boolean;

}
