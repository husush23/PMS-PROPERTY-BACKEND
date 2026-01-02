import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // If the response already has a success field, return it as-is (already wrapped by controller)
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        // Otherwise, wrap it with the standard response format
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
