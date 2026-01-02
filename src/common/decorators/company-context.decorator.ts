import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CompanyContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    // Extract companyId from JWT payload (set by JwtStrategy)
    return request.user?.companyId || null;
  },
);
