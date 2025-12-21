import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { BusinessException, ErrorCode } from '../exceptions/business.exception';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.isSuperAdmin) {
      throw new BusinessException(
        ErrorCode.SUPER_ADMIN_ACCESS_DENIED,
        ERROR_MESSAGES.SUPER_ADMIN_ACCESS_DENIED,
        403,
      );
    }

    return true;
  }
}

