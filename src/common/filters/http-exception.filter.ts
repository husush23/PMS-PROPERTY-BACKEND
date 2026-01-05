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
      const responseBody = exceptionResponse as
        | { message?: string | string[]; property?: string }
        | Array<{ property: string; constraints?: Record<string, string> }>;

      // Check if it's a validation error with array of messages (class-validator format)
      if (Array.isArray(responseBody)) {
        // This is the detailed format from class-validator
        const formattedErrors = responseBody.map((error) => {
          const field = error.property;
          let message = 'Invalid value';

          // Extract the first constraint message
          if (error.constraints) {
            const constraintKeys = Object.keys(error.constraints);
            if (constraintKeys.length > 0) {
              message = this.formatValidationMessage(
                error.constraints[constraintKeys[0]],
              );
            }
          }

          return {
            field: field,
            message: message,
            value: (request.body as Record<string, unknown>)?.[field],
          };
        });

        return response.status(status).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Please check the following fields and try again:',
            details: {
              fields: formattedErrors,
            },
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // Check if it's a validation error with array of messages (string format)
      if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        Array.isArray(responseBody.message)
      ) {
        // Format validation errors from class-validator (string messages)
        const formattedErrors = (responseBody.message as string[]).map(
          (msg: string, index: number) => {
            // Try to extract field name from various message formats
            let field = `field${index}`;
            let message = msg;

            // Pattern 1: "property propertyName should not exist"
            const shouldNotExistMatch = msg.match(
              /property\s+(\w+)\s+should\s+not\s+exist/i,
            );
            if (shouldNotExistMatch) {
              field = shouldNotExistMatch[1];
              message = `The field '${field}' is not allowed or is not recognized. Please check the API documentation for valid fields.`;
            } else {
              // Pattern 2: "fieldName must be..."
              const mustBeMatch = msg.match(/^(\w+)\s+(must|should)/i);
              if (mustBeMatch) {
                field = mustBeMatch[1];
                message = this.formatValidationMessage(msg);
              } else {
                // Pattern 3: Extract field from "each value in fieldName"
                const eachValueMatch = msg.match(/each\s+value\s+in\s+(\w+)/i);
                if (eachValueMatch) {
                  field = eachValueMatch[1];
                  message = this.formatValidationMessage(msg);
                }
              }
            }

            return {
              field: field,
              message: message,
              value:
                (request.body as Record<string, unknown>)?.[field] || undefined,
            };
          },
        );

        return response.status(status).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Please check the following fields and try again:',
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

    // Handle enum validation errors
    formatted = formatted.replace(
      /must be a valid (\w+) enum value/i,
      'must be one of the allowed values for $1',
    );
    formatted = formatted.replace(
      /must be one of the following values: (.+)/i,
      'must be one of: $1',
    );

    // Handle "should not exist" errors with better context
    formatted = formatted.replace(
      /property\s+(\w+)\s+should\s+not\s+exist/i,
      "The field '$1' is not recognized. Please check the API documentation for valid fields.",
    );

    // Replace technical terms
    formatted = formatted.replace(
      /must be an email/i,
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
      /must be a UUID/i,
      'must be a valid identifier (UUID)',
    );
    formatted = formatted.replace(/should not be empty/i, 'is required');
    formatted = formatted.replace(/must be a string/i, 'must be text');
    formatted = formatted.replace(/must be a number/i, 'must be a number');
    formatted = formatted.replace(
      /must be an integer/i,
      'must be a whole number',
    );
    formatted = formatted.replace(
      /must be a positive number/i,
      'must be a number greater than 0',
    );
    formatted = formatted.replace(
      /must be a non-negative number/i,
      'must be a number greater than or equal to 0',
    );

    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

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
