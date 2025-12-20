import { Controller } from '@nestjs/common';
import { UnitService } from './unit.service';

@Controller({ path: 'units', version: '1' })
export class UnitController {
  constructor(private readonly unitService: UnitService) {}
}






