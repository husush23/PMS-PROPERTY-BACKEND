import { ApiProperty } from '@nestjs/swagger';

export class PropertiesReportPropertyItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  propertyId: string;
  @ApiProperty({ example: 'Building A' })
  name: string;
  @ApiProperty({ example: 20 })
  totalUnits: number;
  @ApiProperty({ example: 18 })
  occupiedUnits: number;
  @ApiProperty({ example: 2 })
  vacantUnits: number;
  @ApiProperty({ example: 90 })
  occupancyRate: number;
  @ApiProperty({ example: 500000 })
  monthlyRentPotential: number;
  @ApiProperty({ example: 450000 })
  monthlyCollected: number;
  @ApiProperty({ example: 10000 })
  outstandingBalance: number;
}

export class PropertiesReportSummaryDto {
  @ApiProperty({ example: 50 })
  totalUnits: number;
  @ApiProperty({ example: 45 })
  occupiedUnits: number;
  @ApiProperty({ example: 5 })
  vacantUnits: number;
  @ApiProperty({ example: 90 })
  occupancyRate: number;
  @ApiProperty({ example: 1200000 })
  monthlyRentPotential: number;
  @ApiProperty({ example: 1100000 })
  monthlyCollected: number;
  @ApiProperty({ example: 25000 })
  outstandingBalance: number;
}

export class PropertiesReportResponseDto {
  @ApiProperty({ type: [PropertiesReportPropertyItemDto] })
  properties: PropertiesReportPropertyItemDto[];
  @ApiProperty({ type: PropertiesReportSummaryDto })
  summary: PropertiesReportSummaryDto;
}
