import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { BusinessException, ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle specific database errors
    const errorMessage = exception.message;
    let humanReadableMessage: string = ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
    let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: any = {};

    // Unique constraint violation
    if (errorMessage.includes('duplicate key') || errorMessage.includes('UNIQUE constraint')) {
      const field = this.extractFieldFromError(errorMessage);
      if (field === 'email') {
        humanReadableMessage = ERROR_MESSAGES.EMAIL_ALREADY_EXISTS;
        errorCode = ErrorCode.EMAIL_ALREADY_EXISTS;
        statusCode = HttpStatus.CONFLICT;
      } else if (field === 'slug') {
        humanReadableMessage = ERROR_MESSAGES.COMPANY_SLUG_EXISTS;
        errorCode = ErrorCode.COMPANY_SLUG_EXISTS;
        statusCode = HttpStatus.CONFLICT;
      } else {
        humanReadableMessage = `A record with this ${field} already exists. Please use a different value.`;
        errorCode = ErrorCode.BAD_REQUEST;
        statusCode = HttpStatus.CONFLICT;
      }
      details = { field };
    }
    // Foreign key constraint violation
    else if (errorMessage.includes('foreign key') || errorMessage.includes('FOREIGN KEY constraint')) {
      humanReadableMessage = 'This operation cannot be completed because it would violate data integrity.';
      errorCode = ErrorCode.BAD_REQUEST;
      statusCode = HttpStatus.BAD_REQUEST;
    }
    // Not null constraint violation
    else if (errorMessage.includes('NOT NULL constraint') || errorMessage.includes('null value')) {
      const field = this.extractFieldFromError(errorMessage);
      humanReadableMessage = `The field "${field}" is required and cannot be empty.`;
      errorCode = ErrorCode.VALIDATION_ERROR;
      statusCode = HttpStatus.BAD_REQUEST;
      details = { field };
    }
    // Connection errors
    else if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      humanReadableMessage = 'Unable to connect to the database. Please try again later.';
      errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
    }

    // In development, include original error in details
    if (process.env.NODE_ENV !== 'production') {
      details.originalError = errorMessage;
    }

    return response.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: humanReadableMessage,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private extractFieldFromError(errorMessage: string): string {
    // Try to extract field name from error message
    const patterns = [
      /column "(\w+)"/i,
      /field "(\w+)"/i,
      /key "(\w+)"/i,
      /constraint "(\w+)"/i,
    ];

    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'unknown';
  }
}

