import { Controller } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

@Controller({ path: 'maintenance', version: '1' })
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}
}






