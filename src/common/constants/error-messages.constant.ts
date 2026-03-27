export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS:
    'The email or password you entered is incorrect. Please try again.',
  ACCOUNT_INACTIVE:
    'Your account has been deactivated. Please contact support for assistance.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  TOKEN_INVALID: 'Your session is invalid. Please log in again.',
  INVALID_RESET_TOKEN: 'The password reset token is invalid or has expired.',
  EMAIL_NOT_VERIFIED:
    'Please verify your email address before logging in. Check your inbox or request a new verification email.',
  INVALID_VERIFICATION_TOKEN:
    'The email verification link is invalid or has expired. Please request a new one.',
  USER_NOT_FOUND_AUTH: "We couldn't find an account with that email address.",

  // User
  USER_NOT_FOUND:
    "The user you're looking for doesn't exist or has been removed.",
  EMAIL_ALREADY_EXISTS:
    'An account with this email already exists. Please use a different email or try logging in.',
  USER_ALREADY_IN_COMPANY: 'This user is already a member of this company.',
  USER_NOT_IN_COMPANY: 'This user is not a member of this company.',

  // Company
  COMPANY_NOT_FOUND:
    "The company you're looking for doesn't exist or you don't have access to it.",
  COMPANY_SLUG_EXISTS:
    'A company with this identifier already exists. Please choose a different one.',
  NOT_COMPANY_ADMIN:
    "You don't have permission to perform this action. Only company administrators can do this.",
  COMPANY_CONTEXT_REQUIRED: 'Please select a company to continue.',
  USER_NOT_BELONGS_TO_COMPANY:
    "You don't have access to this company. Please select a company you're a member of.",

  // Validation
  VALIDATION_ERROR: 'Please check the following fields and try again:',

  // Permissions
  INSUFFICIENT_PERMISSIONS: "You don't have permission to perform this action.",
  NOT_COMPANY_MEMBER: 'You are not a member of this company.',
  ROLE_REQUIRED: 'You need a higher permission level to perform this action.',
  CAN_ONLY_UPDATE_OWN_PROFILE:
    'You can only update your own profile information.',
  SUPER_ADMIN_ACCESS_DENIED:
    'This action requires super administrator privileges.',
  CANNOT_REMOVE_LAST_SUPER_ADMIN:
    'Cannot remove the last super administrator. At least one super admin must exist.',

  // Invitations
  INVITATION_NOT_FOUND:
    "The invitation you're looking for doesn't exist or has been removed.",
  INVITATION_EXPIRED:
    'This invitation has expired. Please request a new invitation.',
  INVITATION_ALREADY_ACCEPTED: 'This invitation has already been accepted.',
  INVITATION_ALREADY_CANCELLED: 'This invitation has been cancelled.',
  USER_ALREADY_INVITED: 'This user has already been invited to this company.',
  INVALID_INVITATION_TOKEN: 'The invitation token is invalid or has expired.',

  // Property
  PROPERTY_NOT_FOUND:
    "The property you're looking for doesn't exist or you don't have access to it.",

  // Unit
  UNIT_NOT_FOUND:
    "The unit you're looking for doesn't exist or you don't have access to it.",
  UNIT_NUMBER_EXISTS:
    'A unit with this number already exists in this property.',

  // Tenant
  TENANT_NOT_FOUND:
    "The tenant you're looking for doesn't exist or you don't have access to it.",
  TENANT_ALREADY_EXISTS: 'This user is already a tenant in this company.',
  TENANT_INVITATION_NOT_FOUND:
    "The tenant invitation you're looking for doesn't exist or has been removed.",
  TENANT_INVITATION_EXPIRED:
    'This tenant invitation has expired. Please request a new invitation.',
  TENANT_INVITATION_ALREADY_ACCEPTED:
    'This tenant invitation has already been accepted.',
  CAN_ONLY_VIEW_OWN_TENANT_DATA:
    'You can only view your own tenant information.',
  CAN_ONLY_VIEW_INVOICES_FOR_OWN_LEASES:
    'You can only view invoices for your own leases.',
  CAN_ONLY_VIEW_OWN_INVOICES:
    'You can only view your own invoices.',

  // Lease
  LEASE_NOT_FOUND:
    "The lease you're looking for doesn't exist or you don't have access to it.",
  UNIT_ALREADY_LEASED:
    'This unit already has an active lease. Please terminate the existing lease first.',
  CANNOT_DELETE_ACTIVE_LEASE:
    'Active leases cannot be deleted. Please terminate the lease first.',
  CANNOT_UPDATE_ACTIVE_LEASE_FIELD:
    'This field cannot be updated for an active lease.',
  INVALID_LEASE_DATES: 'The lease end date must be after the start date.',
  LEASE_ALREADY_ACTIVE: 'This lease is already active.',
  LEASE_NOT_ACTIVE:
    'This lease is not active. This operation can only be performed on active leases.',
  CANNOT_ACTIVATE_UNAVAILABLE_UNIT:
    'Cannot activate lease for an unavailable unit. The unit must be available.',

  // Payment
  PAYMENT_NOT_FOUND:
    "The payment you're looking for doesn't exist or you don't have access to it.",
  PAYMENT_ALREADY_COMPLETED:
    'This payment has already been completed and cannot be modified.',
  CANNOT_EDIT_COMPLETED_PAYMENT:
    'Completed payments cannot be edited. Use reversal to correct errors.',
  INVALID_PAYMENT_STATUS_TRANSITION:
    'This payment status transition is not allowed.',
  LEASE_NOT_FOUND_FOR_PAYMENT:
    "The lease specified for this payment does not exist or you don't have access to it.",
  TENANT_NOT_FOUND_FOR_PAYMENT:
    'The tenant specified for this payment does not exist or does not belong to the lease.',
  CANNOT_DELETE_COMPLETED_PAYMENT:
    'Completed or refunded payments cannot be deleted. Use reversal instead.',
  CANNOT_REVERSE_PAYMENT:
    'This payment cannot be reversed. Only paid payments can be reversed.',
  PAYMENT_CREATE_ROLE_REQUIRED:
    'Only company administrators, managers, landlords, and cashiers can create payments.',
  PAYMENT_DATE_IN_FUTURE: 'Payment date cannot be in the future.',
  PAYMENT_VOID_INVOICE: 'Cannot make payment on voided invoice',
  PAYMENT_NON_DEPOSIT_ON_DEPOSIT_INVOICE:
    'Cannot apply non-deposit payment to deposit invoice. Deposit invoices only accept deposit payments.',
  PAYMENT_NON_UTILITY_ON_UTILITY_INVOICE:
    'Cannot apply non-utility payment to utility invoice. Utility invoices only accept utility payments.',
  PAYMENT_DEPOSIT_ON_RENT_INVOICE:
    'Cannot apply deposit payment to rent invoice. Deposit payments must be applied to deposit invoices only.',
  PAYMENT_UTILITY_ON_RENT_INVOICE:
    'Cannot apply utility payment to rent invoice. Utility payments must be applied to utility invoices only.',
  RENT_CYCLE_NOT_FOUND_OR_LEASE_MISMATCH:
    'Rent cycle not found or does not belong to this lease',
  PAYMENT_UPDATE_ROLE_REQUIRED:
    'Only company administrators and managers can update payments.',
  PAYMENT_RECORD_ROLE_REQUIRED:
    'Only company administrators, managers, and landlords can record payments.',
  PAYMENT_AMOUNT_MUST_BE_POSITIVE: 'Payment amount must be greater than 0.',
  PAYMENT_REVERSE_ROLE_REQUIRED:
    'Only company administrators and managers can reverse payments.',
  PAYMENT_MARK_FAILED_ROLE_REQUIRED:
    'Only company administrators and managers can mark payments as failed.',
  PAYMENT_DELETE_ROLE_REQUIRED:
    'Only company administrators and managers can delete payments.',
  PAYMENT_MARK_FAILED_PENDING_ONLY:
    'Only pending payments can be marked as failed.',
  PAYMENT_TENANT_OR_LEASE_REQUIRED:
    'Either tenantId or leaseId must be provided.',
  PAYMENT_VIEW_OWN_ONLY: 'You can only view your own payments.',
  PAYMENT_METHOD_NOT_FOUND: 'Payment method not found.',
  PAYMENT_METHOD_COMPANY_MISMATCH:
    'Payment method does not belong to this company.',
  PAYMENT_METHOD_REQUIRED: 'Payment method is required.',
  PAYMENT_ALREADY_FULLY_PAID:
    'This payment is already fully paid. No additional payments can be recorded.',
  PAYMENT_AMOUNT_EXCEEDS_DUE:
    'The payment amount exceeds the amount due for this payment period.',
  CANNOT_CREATE_PAYMENT_FOR_INACTIVE_LEASE:
    'Payments can only be created for active leases. Please activate the lease first.',

  // Rent cycle
  RENT_CYCLE_NOT_FOUND:
    "The rent cycle you're looking for doesn't exist or you don't have access to it.",
  RENT_CYCLE_ALREADY_EXISTS_FOR_PERIOD:
    'Rent cycle already exists for this lease and period',
  INVOICE_NUMBER_GENERATION_FAILED:
    'Unable to generate unique invoice number. Please contact support.',
  INVOICE_NUMBER_GENERATION_FAILED_FALLBACK: 'Failed to generate invoice number',
  INVOICE_NUMBER_CONFLICT_RETRY:
    'An invoice with this number already exists. This may happen if multiple invoices are being created simultaneously. Please try again.',
  LATE_FEES_DISABLED_FOR_COMPANY: 'Late fees are disabled for this company.',
  LATE_FEE_ALREADY_APPLIED: 'Late fee already applied to this rent cycle',
  INVOICE_ALREADY_VOIDED: 'Invoice is already voided',
  CANNOT_VOID_INVOICE_WITH_ACTIVE_PAYMENTS:
    'Cannot void invoice with active payments. Refund payments first.',
  INVALID_BILLING_PERIOD_FORMAT:
    'Invalid billing period format for due date calculation.',
  RENT_CYCLE_CLOSED:
    'Utility charges cannot be added to this invoice because it is not open for billing.',

  // Water / utility
  WATER_METER_NOT_FOUND:
    'No active water meter is linked to this unit. Add a water meter before recording readings.',
  WATER_DISABLED_FOR_PROPERTY:
    'Water billing is turned off for this property. Enable it in property settings before recording readings.',
  WATER_UTILITIES_INCLUDED:
    'Utilities are included in rent for this unit, so water usage is not billed separately.',
  WATER_LEASE_INACTIVE_FOR_READING:
    'Cannot record a water reading because this unit does not have an active lease.',
  WATER_NO_ACTIVE_TENANT:
    'Cannot record a water reading because there is no active tenant on the lease.',
  WATER_MISSING_INITIAL_READING:
    'Set an initial water reading on the unit (or add a first reading) before recording new readings.',
  INVALID_METER_READING:
    'The new reading must be greater than or equal to the previous reading.',
  WATER_RATE_NOT_CONFIGURED:
    'Water price per cubic meter is not set for this property. Configure it in property settings.',
  WATER_DUPLICATE_READING_SAME_DATE:
    'A water reading for this meter has already been recorded for this calendar day.',
  UTILITY_NOT_ALLOWED_ON_DEPOSIT:
    'Utility charges cannot be added to deposit invoices',
  UTILITY_ACCESS_DENIED:
    "You don't have access to this property or unit for utility actions.",

  // General
  INTERNAL_SERVER_ERROR:
    'Something went wrong on our end. Please try again later.',
  BAD_REQUEST:
    'The request you sent is invalid. Please check your input and try again.',
  NOT_FOUND: "The resource you're looking for doesn't exist.",
  UNAUTHORIZED: 'You need to be logged in to access this resource.',
  FORBIDDEN: "You don't have permission to access this resource.",
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
