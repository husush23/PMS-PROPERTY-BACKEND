import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException, ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Handle BusinessException with error codes
    if (exception instanceof BusinessException) {
      return response.status(status).json({
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: exception.details || {},
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    // Handle validation errors (from ValidationPipe)
    if (status === (HttpStatus.BAD_REQUEST as number)) {
      const responseBody = exceptionResponse as { message?: string | string[] };

      // Check if it's a validation error with array of messages
      if (Array.isArray(responseBody.message)) {
        // Format validation errors from class-validator
        const formattedErrors = responseBody.message.map(
          (msg: string, index: number) => {
            // Try to extract field name and constraint
            const fieldMatch = msg.match(/^(\w+)\s/);
            const field = fieldMatch ? fieldMatch[1] : `field${index}`;

            return {
              field: field.toLowerCase(),
              message: this.formatValidationMessage(msg),
              value:
                (request.body as Record<string, unknown>)?.[field] || undefined,
            };
          },
        );

        return response.status(status).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: ERROR_MESSAGES.VALIDATION_ERROR,
            details: {
              fields: formattedErrors,
            },
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }

    // Handle standard HttpException
    const message = this.getHumanReadableMessage(exception.message, status);
    const errorCode = this.getErrorCodeFromStatus(status);

    return response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message: message,
        details:
          typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'details' in exceptionResponse
            ? (exceptionResponse as { details?: Record<string, unknown> })
                .details || {}
            : {},
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private formatValidationMessage(message: string): string {
    // Make validation messages more user-friendly
    let formatted = message;

    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    // Replace technical terms
    formatted = formatted.replace(
      /must be an email/,
      'must be a valid email address',
    );
    formatted = formatted.replace(
      /must be longer than or equal to (\d+)/,
      'must be at least $1 characters long',
    );
    formatted = formatted.replace(
      /must be shorter than or equal to (\d+)/,
      'must be at most $1 characters long',
    );
    formatted = formatted.replace(
      /must be a UUID/,
      'must be a valid identifier',
    );
    formatted = formatted.replace(/should not be empty/, 'is required');
    formatted = formatted.replace(/must be a string/, 'must be text');
    formatted = formatted.replace(/must be a number/, 'must be a number');

    return formatted;
  }

  private getHumanReadableMessage(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status: HttpStatus,
  ): string {
    // Map common technical messages to human-readable ones
    const messageMap: Record<string, string> = {
      'Not Found': ERROR_MESSAGES.NOT_FOUND,
      Unauthorized: ERROR_MESSAGES.UNAUTHORIZED,
      Forbidden: ERROR_MESSAGES.FORBIDDEN,
      'Bad Request': ERROR_MESSAGES.BAD_REQUEST,
    };

    // Check if message matches any key
    for (const [key, value] of Object.entries(messageMap)) {
      if (message.includes(key)) {
        return value;
      }
    }

    // If message contains technical details, make it more friendly
    if (message.includes('not found')) {
      return ERROR_MESSAGES.NOT_FOUND;
    }

    if (message.includes('already exists')) {
      return message; // Keep as is, usually already user-friendly
    }

    // Return original message if no mapping found
    return message;
  }

  private getErrorCodeFromStatus(status: HttpStatus): ErrorCode {
    switch (status) {
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_SERVER_ERROR;
      default:
        return ErrorCode.BAD_REQUEST;
    }
  }
}
