export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: "The email or password you entered is incorrect. Please try again.",
  ACCOUNT_INACTIVE: "Your account has been deactivated. Please contact support for assistance.",
  TOKEN_EXPIRED: "Your session has expired. Please log in again.",
  TOKEN_INVALID: "Your session is invalid. Please log in again.",
  USER_NOT_FOUND_AUTH: "We couldn't find an account with that email address.",
  
  // User
  USER_NOT_FOUND: "The user you're looking for doesn't exist or has been removed.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists. Please use a different email or try logging in.",
  USER_ALREADY_IN_COMPANY: "This user is already a member of this company.",
  USER_NOT_IN_COMPANY: "This user is not a member of this company.",
  
  // Company
  COMPANY_NOT_FOUND: "The company you're looking for doesn't exist or you don't have access to it.",
  COMPANY_SLUG_EXISTS: "A company with this identifier already exists. Please choose a different one.",
  NOT_COMPANY_ADMIN: "You don't have permission to perform this action. Only company administrators can do this.",
  COMPANY_CONTEXT_REQUIRED: "Please select a company to continue.",
  USER_NOT_BELONGS_TO_COMPANY: "You don't have access to this company. Please select a company you're a member of.",
  
  // Validation
  VALIDATION_ERROR: "Please check the following fields and try again:",
  
  // Permissions
  INSUFFICIENT_PERMISSIONS: "You don't have permission to perform this action.",
  NOT_COMPANY_MEMBER: "You are not a member of this company.",
  ROLE_REQUIRED: "You need a higher permission level to perform this action.",
  CAN_ONLY_UPDATE_OWN_PROFILE: "You can only update your own profile information.",
  SUPER_ADMIN_ACCESS_DENIED: "This action requires super administrator privileges.",
  CANNOT_REMOVE_LAST_SUPER_ADMIN: "Cannot remove the last super administrator. At least one super admin must exist.",
  
  // Invitations
  INVITATION_NOT_FOUND: "The invitation you're looking for doesn't exist or has been removed.",
  INVITATION_EXPIRED: "This invitation has expired. Please request a new invitation.",
  INVITATION_ALREADY_ACCEPTED: "This invitation has already been accepted.",
  INVITATION_ALREADY_CANCELLED: "This invitation has been cancelled.",
  USER_ALREADY_INVITED: "This user has already been invited to this company.",
  INVALID_INVITATION_TOKEN: "The invitation token is invalid or has expired.",
  
  // Property
  PROPERTY_NOT_FOUND: "The property you're looking for doesn't exist or you don't have access to it.",
  
  // Unit
  UNIT_NOT_FOUND: "The unit you're looking for doesn't exist or you don't have access to it.",
  UNIT_NUMBER_EXISTS: "A unit with this number already exists in this property.",
  
  // Tenant
  TENANT_NOT_FOUND: "The tenant you're looking for doesn't exist or you don't have access to it.",
  TENANT_ALREADY_EXISTS: "This user is already a tenant in this company.",
  TENANT_INVITATION_NOT_FOUND: "The tenant invitation you're looking for doesn't exist or has been removed.",
  TENANT_INVITATION_EXPIRED: "This tenant invitation has expired. Please request a new invitation.",
  TENANT_INVITATION_ALREADY_ACCEPTED: "This tenant invitation has already been accepted.",
  CAN_ONLY_VIEW_OWN_TENANT_DATA: "You can only view your own tenant information.",
  
  // Lease
  LEASE_NOT_FOUND: "The lease you're looking for doesn't exist or you don't have access to it.",
  UNIT_ALREADY_LEASED: "This unit already has an active lease. Please terminate the existing lease first.",
  CANNOT_DELETE_ACTIVE_LEASE: "Active leases cannot be deleted. Please terminate the lease first.",
  CANNOT_UPDATE_ACTIVE_LEASE_FIELD: "This field cannot be updated for an active lease.",
  INVALID_LEASE_DATES: "The lease end date must be after the start date.",
  LEASE_ALREADY_ACTIVE: "This lease is already active.",
  LEASE_NOT_ACTIVE: "This lease is not active. This operation can only be performed on active leases.",
  CANNOT_ACTIVATE_UNAVAILABLE_UNIT: "Cannot activate lease for an unavailable unit. The unit must be available.",
  
  // General
  INTERNAL_SERVER_ERROR: "Something went wrong on our end. Please try again later.",
  BAD_REQUEST: "The request you sent is invalid. Please check your input and try again.",
  NOT_FOUND: "The resource you're looking for doesn't exist.",
  UNAUTHORIZED: "You need to be logged in to access this resource.",
  FORBIDDEN: "You don't have permission to access this resource.",
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

