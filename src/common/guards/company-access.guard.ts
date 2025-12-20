import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { BusinessException, ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

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

