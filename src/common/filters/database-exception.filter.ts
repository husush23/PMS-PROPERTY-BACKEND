import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Catch(QueryFailedError, EntityNotFoundError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(
    exception: QueryFailedError | EntityNotFoundError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle TypeORM EntityNotFoundError (e.g. from findOneOrFail)
    if (exception instanceof EntityNotFoundError) {
      const logMsg = `DB EntityNotFound ${request.method} ${request.url} requestId=${request.requestId ?? '-'}`;
      this.logger.warn(logMsg);
      return response.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: ERROR_MESSAGES.NOT_FOUND,
          details: {},
        },
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(request.requestId && { requestId: request.requestId }),
      });
    }

    // Handle QueryFailedError
    const errorMessage = exception.message;
    let humanReadableMessage: string = ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
    let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: Record<string, unknown> = {};

    // Unique constraint violation
    if (
      errorMessage.includes('duplicate key') ||
      errorMessage.includes('UNIQUE constraint')
    ) {
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
    else if (
      errorMessage.includes('foreign key') ||
      errorMessage.includes('FOREIGN KEY constraint')
    ) {
      humanReadableMessage =
        'This operation cannot be completed because it would violate data integrity.';
      errorCode = ErrorCode.BAD_REQUEST;
      statusCode = HttpStatus.BAD_REQUEST;
    }
    // Not null constraint violation
    else if (
      errorMessage.includes('NOT NULL constraint') ||
      errorMessage.includes('null value')
    ) {
      const field = this.extractFieldFromError(errorMessage);
      humanReadableMessage = `The field "${field}" is required and cannot be empty.`;
      errorCode = ErrorCode.VALIDATION_ERROR;
      statusCode = HttpStatus.BAD_REQUEST;
      details = { field };
    }
    // Connection errors
    else if (
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      humanReadableMessage =
        'Unable to connect to the database. Please try again later.';
      errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
    }

    // In development, include original error in details
    if (process.env.NODE_ENV !== 'production') {
      details = { ...details, originalError: errorMessage };
    }

    // Structured logging: warn for constraint/validation (4xx), error for 5xx
    const logMsg = `DB error ${statusCode} ${request.method} ${request.url} requestId=${request.requestId ?? '-'} ${errorCode}`;
    if (statusCode >= 500) {
      this.logger.error(logMsg);
    } else {
      this.logger.warn(logMsg);
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
      ...(request.requestId && { requestId: request.requestId }),
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
