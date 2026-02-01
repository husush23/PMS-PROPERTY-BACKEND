import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log full error and stack server-side (never sent to client in production)
    const message =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `Unhandled exception: ${message}`,
      stack ?? undefined,
    );

    const requestId = request.requestId;
    const details: Record<string, unknown> = {};
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      details.errorName = exception.name;
    }

    const body = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId && { requestId }),
    };

    if (!response.headersSent) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
    }
  }
}
