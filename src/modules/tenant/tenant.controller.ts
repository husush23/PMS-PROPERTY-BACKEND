import { Controller } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}
}






