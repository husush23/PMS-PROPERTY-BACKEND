import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { BusinessException, ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // Super admin bypasses company context requirement
    if (user?.isSuperAdmin) {
      return true;
    }

    if (!user || !user.companyId) {
      throw new BusinessException(
        ErrorCode.COMPANY_CONTEXT_REQUIRED,
        ERROR_MESSAGES.COMPANY_CONTEXT_REQUIRED,
        403,
      );
    }

    return true;
  }
}
