import { Request } from 'express';
import { UserRole } from '../../shared/enums/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  isSuperAdmin?: boolean;
  companyId?: string;
  role?: UserRole;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
    companyId?: string;
  }
}
