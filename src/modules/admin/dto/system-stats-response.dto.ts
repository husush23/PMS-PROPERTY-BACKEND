import { ApiProperty } from '@nestjs/swagger';

export class SystemStatsResponseDto {
  @ApiProperty({ description: 'Total number of companies', example: 50 })
  totalCompanies: number;

  @ApiProperty({ description: 'Total number of users', example: 200 })
  totalUsers: number;

  @ApiProperty({ description: 'Total number of super admins', example: 2 })
  totalSuperAdmins: number;

  @ApiProperty({ description: 'Total number of active companies', example: 45 })
  activeCompanies: number;

  @ApiProperty({ description: 'Total number of active users', example: 180 })
  activeUsers: number;
}
