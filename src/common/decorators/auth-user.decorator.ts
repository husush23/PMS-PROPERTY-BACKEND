import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser as AuthUserType } from '../types/express';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUserType | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
