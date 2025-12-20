import { Controller } from '@nestjs/common';
import { PropertyService } from './property.service';

@Controller({ path: 'properties', version: '1' })
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}
}






