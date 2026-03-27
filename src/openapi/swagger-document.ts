import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error.dto';

/**
 * Single source for Swagger/OpenAPI document (runtime `/api/docs` and `openapi:export`).
 */
export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('PMS Backend API')
    .setDescription(getOpenApiDescription())
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('admin', 'Super admin / system endpoints')
    .addTag('companies', 'Company and membership management')
    .addTag('settings', 'Company settings and bootstrap')
    .addTag('properties', 'Property management endpoints')
    .addTag('units', 'Unit management endpoints')
    .addTag('leases', 'Lease management endpoints')
    .addTag('tenants', 'Tenant management endpoints')
    .addTag('payments', 'Payment management endpoints')
    .addTag('payment-methods', 'Payment method configuration')
    .addTag('rent-cycles', 'Rent cycle and billing periods')
    .addTag('utilities', 'Water / utility readings and billing')
    .addTag('expenses', 'Expense management')
    .addTag('accounting', 'Accounting summary and reports')
    .addTag('reports', 'Financial and occupancy reports')
    .addTag('dashboard', 'Dashboard summary for landlord/admin')
    .addTag('maintenance', 'Maintenance request endpoints')
    .addTag('documents', 'Document management endpoints')
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorResponseDto],
  });
}

function getOpenApiDescription(): string {
  return (
    'Property Management System Backend API Documentation\n\n' +
    '**Authentication**: This API uses HTTP-only cookies for authentication. ' +
    'Access tokens and refresh tokens are automatically set as cookies when you login, register, or refresh tokens. ' +
    'Cookies are sent automatically with each request. ' +
    'Use the `/auth/refresh` endpoint to refresh your access token when it expires. ' +
    'Use the `/auth/logout` endpoint to clear authentication cookies.\n\n' +
    '**Important**: Ensure your client sends credentials (cookies) with requests by setting `withCredentials: true` (axios) or `credentials: "include"` (fetch).\n\n' +
    '---\n\n' +
    '### Error responses (BusinessException)\n\n' +
    'Most domain errors return **4xx** with body:\n' +
    '```json\n' +
    '{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {} }, "timestamp": "...", "path": "..." }\n' +
    '```\n\n' +
    'Use `error.code` for programmatic handling; `error.message` is user-facing.\n' +
    'Representative billing/utility codes: `RENT_CYCLE_CLOSED`, `LEASE_NOT_ACTIVE`, `INVALID_METER_READING`, ' +
    '`UTILITY_NOT_ALLOWED_ON_DEPOSIT`, `PAYMENT_VOID_INVOICE`, `RENT_CYCLE_NOT_FOUND`, and payment-specific `PAYMENT_*` codes.\n\n' +
    '---\n\n' +
    '### Invoice numbers (`RentCycle.invoiceNumber`)\n\n' +
    'Structured format: **`INV-{periodSegment}-{CATEGORY}-{sequence}`** (3-digit sequence).\n' +
    '- Monthly: `INV-2024-01-RENT-001`, `INV-2024-01-UTILITY-001`, `INV-2024-03-DEPOSIT-001`\n' +
    '- Utility is billed on its **own** rent cycle (`category=UTILITY`), not as a suffix on the rent invoice.\n' +
    '- Legacy rows may still use older patterns until replaced.\n\n' +
    '---\n\n' +
    '### OpenAPI artifact\n\n' +
    'Generate `openapi/openapi.json` locally: `npm run openapi:export` (requires DB env like the app). ' +
    'Generate TypeScript types: `npm run openapi:types`.'
  );
}
