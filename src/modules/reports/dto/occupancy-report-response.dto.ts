import { ApiProperty } from '@nestjs/swagger';

export class OccupancyReportUnitItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  unitId: string;
  @ApiProperty({ example: 'Unit 101' })
  unitNumber: string;
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  propertyId: string;
  @ApiProperty({ example: 'Building A' })
  propertyName: string;
  @ApiProperty({ example: 'occupied', enum: ['occupied', 'vacant'] })
  status: 'occupied' | 'vacant';
  @ApiProperty({ example: '2026-01-01', nullable: true })
  leaseStart: string | null;
  @ApiProperty({ example: '2026-12-31', nullable: true })
  leaseEnd: string | null;
}

export class OccupancyReportResponseDto {
  @ApiProperty({ example: 50 })
  totalUnits: number;
  @ApiProperty({ example: 42 })
  occupiedUnits: number;
  @ApiProperty({ example: 8 })
  vacantUnits: number;
  @ApiProperty({ example: 84 })
  occupancyRate: number;
  @ApiProperty({ example: 15 })
  averageVacancyDays: number;
  @ApiProperty({ type: [OccupancyReportUnitItemDto] })
  units: OccupancyReportUnitItemDto[];
}
