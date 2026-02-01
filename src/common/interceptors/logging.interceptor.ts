import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = request.requestId ?? '-';
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(
          `${request.method} ${request.url} ${duration}ms requestId=${requestId}`,
        );
      }),
    );
  }
}
