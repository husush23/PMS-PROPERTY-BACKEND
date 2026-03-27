import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** `error` object for failed API responses (see HttpExceptionFilter). */
export class ApiErrorBodyDto {
  @ApiProperty({
    description: 'Stable machine-readable code (matches ErrorCode enum)',
    example: 'RENT_CYCLE_CLOSED',
  })
  code: string;

  @ApiProperty({ description: 'Human-readable message' })
  message: string;

  @ApiProperty({
    description: 'Optional structured context (ids, fields, etc.)',
    type: 'object',
    additionalProperties: true,
  })
  details: Record<string, unknown>;
}

/**
 * Standard failure envelope for BusinessException and validation errors.
 * Registered in OpenAPI via `extraModels` for client codegen reference.
 */
export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: ApiErrorBodyDto })
  error: ApiErrorBodyDto;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  path: string;

  @ApiPropertyOptional({ description: 'Present when request ID middleware is enabled' })
  requestId?: string;
}
