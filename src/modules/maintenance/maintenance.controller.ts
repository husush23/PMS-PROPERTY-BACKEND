import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@Controller({ path: 'maintenance', version: '1' })
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}
}
