import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_MESSAGES, ErrorMessageKey } from '../constants/error-messages.constant';

export enum ErrorCode {
  // Authentication
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  
  // User
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USER_ALREADY_IN_COMPANY = 'USER_ALREADY_IN_COMPANY',
  USER_NOT_IN_COMPANY = 'USER_NOT_IN_COMPANY',
  
  // Company
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  COMPANY_SLUG_EXISTS = 'COMPANY_SLUG_EXISTS',
  NOT_COMPANY_ADMIN = 'NOT_COMPANY_ADMIN',
  COMPANY_CONTEXT_REQUIRED = 'COMPANY_CONTEXT_REQUIRED',
  USER_NOT_BELONGS_TO_COMPANY = 'USER_NOT_BELONGS_TO_COMPANY',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Permissions
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  NOT_COMPANY_MEMBER = 'NOT_COMPANY_MEMBER',
  ROLE_REQUIRED = 'ROLE_REQUIRED',
  CAN_ONLY_UPDATE_OWN_PROFILE = 'CAN_ONLY_UPDATE_OWN_PROFILE',
  SUPER_ADMIN_ACCESS_DENIED = 'SUPER_ADMIN_ACCESS_DENIED',
  CANNOT_REMOVE_LAST_SUPER_ADMIN = 'CANNOT_REMOVE_LAST_SUPER_ADMIN',
  
  // Invitations
  INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_ALREADY_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED',
  INVITATION_ALREADY_CANCELLED = 'INVITATION_ALREADY_CANCELLED',
  USER_ALREADY_INVITED = 'USER_ALREADY_INVITED',
  INVALID_INVITATION_TOKEN = 'INVALID_INVITATION_TOKEN',
  
  // Property
  PROPERTY_NOT_FOUND = 'PROPERTY_NOT_FOUND',
  
  // Unit
  UNIT_NOT_FOUND = 'UNIT_NOT_FOUND',
  UNIT_NUMBER_EXISTS = 'UNIT_NUMBER_EXISTS',
  
  // General
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  fields?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  [key: string]: any;
}

export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message?: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: ErrorDetails,
  ) {
    const errorMessage = message || ERROR_MESSAGES[errorCode as ErrorMessageKey] || 'An error occurred';
    super(
      {
        errorCode,
        message: errorMessage,
        details: details || {},
      },
      statusCode,
    );
  }
}

