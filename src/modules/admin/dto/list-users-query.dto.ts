import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search by email or name',
    example: 'john',
  })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by super admin status',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['name', 'email', 'createdAt'],
    example: 'createdAt',
  })
  @IsOptional()
  sortBy?: 'name' | 'email' | 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
