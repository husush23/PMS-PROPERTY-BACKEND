import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyDto } from './create-property.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({
    description: 'Property active status',
    example: true,
  })
  isActive?: boolean;
}

