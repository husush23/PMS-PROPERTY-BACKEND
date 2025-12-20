import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CompanyContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Extract companyId from JWT payload (set by JwtStrategy)
    return request.user?.companyId || null;
  },
);

