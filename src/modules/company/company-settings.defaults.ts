import { LateFeeType } from '../../shared/enums/late-fee-type.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { UserRole } from '../../shared/enums/user-role.enum';

/**
 * MVP-safe default values for company_settings when a company is created via POST /companies.
 * Backend-owned; frontend must not send or manage these.
 * Explicitly excludes: rent due day, payment frequency, lease term, billing start date, rent amount.
 */
export const COMPANY_SETTINGS_MVP_DEFAULTS = {
  timezone: 'UTC',
  defaultCurrency: 'KES',
  defaultGracePeriodDays: 5,
  lateFeeEnabled: false,
  defaultLateFeeType: LateFeeType.NONE,
  defaultLateFeeValue: 0,
  defaultInvitedRole: UserRole.TENANT,
  staffCanRecordPayments: true,
  staffCanApprovePayments: false,
  staffCanInviteTenants: false,
  requirePaymentApproval: false,
  allowPartialPayments: true,
  allowAdvancePayments: true,
  requirePaymentReference: false,
  defaultEmailNotifications: true,
  defaultSmsNotifications: true,
  autoGenerateRentCycles: true,
  autoApplyLateFees: true,
  autoApplyCredit: true,
} as const;

/** Fallback allowed payment methods when no active global payment methods exist (e.g. before seed). */
export const FALLBACK_ALLOWED_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.BANK,
  PaymentMethod.MPESA,
  PaymentMethod.CARD,
  PaymentMethod.CHECK,
  PaymentMethod.CREDIT,
  PaymentMethod.OTHER,
];
