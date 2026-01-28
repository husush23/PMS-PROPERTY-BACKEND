import { Injectable, HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettings } from './entities/company-settings.entity';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';

@Injectable()
export class CompanySettingsResolver {
  // Company settings = system behavior defaults.
  constructor(private readonly settingsService: CompanySettingsService) {}

  async getSettings(companyId: string): Promise<CompanySettings> {
    return this.settingsService.getOrCreate(companyId);
  }

  assertPaymentMethodAllowed(
    settings: CompanySettings,
    method: PaymentMethod,
  ): void {
    if (!settings.allowedPaymentMethods?.includes(method)) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment method is not allowed for this company.',
        HttpStatus.BAD_REQUEST,
        { paymentMethod: method },
      );
    }
  }

  assertPartialPaymentsAllowed(settings: CompanySettings): void {
    if (!settings.allowPartialPayments) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Partial payments are not allowed for this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  assertAdvancePaymentsAllowed(settings: CompanySettings): void {
    if (!settings.allowAdvancePayments) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Advance payments are not allowed for this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  assertPaymentReference(
    settings: CompanySettings,
    reference: string | undefined,
    methodRequiresReference: boolean,
  ): void {
    if ((settings.requirePaymentReference || methodRequiresReference) && !reference) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment reference is required for this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  resolveCurrency(
    settings: CompanySettings,
    providedCurrency?: string | null,
    leaseCurrency?: string | null,
  ): string {
    return (
      providedCurrency ??
      leaseCurrency ??
      settings.defaultCurrency ??
      'KES'
    );
  }

  shouldAutoGenerateRentCycles(settings: CompanySettings): boolean {
    return settings.autoGenerateRentCycles;
  }

  shouldAutoApplyLateFees(settings: CompanySettings): boolean {
    return settings.lateFeeEnabled && settings.autoApplyLateFees;
  }

  isLateFeeEnabled(settings: CompanySettings): boolean {
    return settings.lateFeeEnabled;
  }

  shouldAutoApplyCredit(settings: CompanySettings): boolean {
    return settings.autoApplyCredit;
  }
}
