import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { seedSuperAdmin } from './database/seeds/super-admin.seed';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Cookie parser middleware
  app.use(cookieParser());

  // Security - Helmet
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
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

  // Global exception filters
  app.useGlobalFilters(new HttpExceptionFilter(), new DatabaseExceptionFilter());

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('PMS Backend API')
    .setDescription(
      'Property Management System Backend API Documentation\n\n' +
      '**Authentication**: This API uses HTTP-only cookies for authentication. ' +
      'Access tokens and refresh tokens are automatically set as cookies when you login, register, or refresh tokens. ' +
      'Cookies are sent automatically with each request. ' +
      'Use the `/auth/refresh` endpoint to refresh your access token when it expires. ' +
      'Use the `/auth/logout` endpoint to clear authentication cookies.\n\n' +
      '**Important**: Ensure your client sends credentials (cookies) with requests by setting `withCredentials: true` (axios) or `credentials: "include"` (fetch).'
    )
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('properties', 'Property management endpoints')
    .addTag('units', 'Unit management endpoints')
    .addTag('leases', 'Lease management endpoints')
    .addTag('tenants', 'Tenant management endpoints')
    .addTag('payments', 'Payment management endpoints')
    .addTag('maintenance', 'Maintenance request endpoints')
    .addTag('documents', 'Document management endpoints')
    .addTag('notifications', 'Notification endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  try{
    const dataSource = app.get(DataSource);
    await seedSuperAdmin(dataSource);
    console.log('Super admin seeded successfully');
  }catch(error){
    console.error('Error seeding super admin', error);
  }

  const port = configService.get<number>('app.port') || 8000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`);
}
bootstrap();
