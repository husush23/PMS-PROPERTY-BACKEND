import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { seedSuperAdmin } from './database/seeds/super-admin.seed';
import { seedCashier } from './database/seeds/cashier.seed';
import { seedPlans } from './database/seeds/plan.seed';
import { DataSource } from 'typeorm';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createOpenApiDocument } from './openapi/swagger-document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Request ID for tracing (must run early)
  app.use(requestIdMiddleware);

  // Cookie parser middleware
  app.use(cookieParser());

  // Security - Helmet (configured to not block CORS)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS Configuration - MUST be before other middleware
  const corsOrigin = process.env.CORS_ORIGIN;

  // In production, require CORS_ORIGIN to be set
  if (!corsOrigin && process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️  WARNING: CORS_ORIGIN not set in production. CORS may not work correctly.',
    );
  }

  // Handle multiple origins (comma-separated)
  // In production, only use CORS_ORIGIN from environment (no fallback)
  // In development, allow localhost
  const allowedOrigins = corsOrigin
    ? corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
    : process.env.NODE_ENV === 'production'
      ? [] // Production: no fallback, must set CORS_ORIGIN
      : ['http://localhost:3000']; // Development only

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(
          `CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`,
        );
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Credentials',
    ],
    exposedHeaders: ['Set-Cookie', 'X-Request-Id'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api';
  app.setGlobalPrefix(apiPrefix);

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global guards
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // Global interceptors
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // Global exception filters: register catch-all first so it runs last (only catches unhandled)
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new DatabaseExceptionFilter(),
    new HttpExceptionFilter(),
  );

  // Swagger/OpenAPI documentation (shared with `npm run openapi:export`)
  const document = createOpenApiDocument(app);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  try {
    const dataSource = app.get(DataSource);
    await seedSuperAdmin(dataSource);
    console.log('Super admin seeded successfully');
    await seedCashier(dataSource);
    console.log('Cashier seeded successfully');
    await seedPlans(dataSource);
    console.log('Subscription plans seeded successfully');
  } catch (error) {
    console.error('Error seeding data', error);
  }

  const port = configService.get<number>('app.port') ?? 8000;
  await app.listen(port);

  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(
    `Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
  );
}
void bootstrap();
