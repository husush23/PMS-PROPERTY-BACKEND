# Project Structure

This document describes the file structure for the Property Management System (PMS) backend.

## Directory Structure

```
src/
├── app.module.ts              # Root application module
├── main.ts                    # Application entry point
│
├── config/                    # Configuration files
│   ├── app.config.ts          # Application configuration
│   ├── db.config.ts           # Database configuration
│   ├── jwt.config.ts          # JWT configuration
│   ├── mail.config.ts         # Email configuration
│   └── cache.config.ts        # Cache configuration
│
├── common/                    # Shared/common code
│   ├── decorators/            # Custom decorators
│   │   ├── auth-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── guards/                # Authentication & authorization guards
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/          # Interceptors
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   ├── pipes/                 # Validation pipes
│   │   └── validation.pipe.ts
│   ├── filters/               # Exception filters
│   │   └── http-exception.filter.ts
│   ├── dto/                   # Shared DTOs
│   └── utils/                 # Utility functions
│       ├── password.util.ts
│       └── date.util.ts
│
├── modules/                   # Feature modules
│   ├── auth/                  # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/        # Passport strategies
│   │   │   ├── jwt.strategy.ts
│   │   │   └── refresh-jwt.strategy.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── register.dto.ts
│   │       └── verify-otp.dto.ts
│   │
│   ├── user/                  # User management
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   └── dto/
│   │
│   ├── property/              # Property management
│   │   ├── property.module.ts
│   │   ├── property.controller.ts
│   │   ├── property.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── unit/                  # Unit/Apartment management
│   │   ├── unit.module.ts
│   │   ├── unit.controller.ts
│   │   ├── unit.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── lease/                 # Lease/Contract management
│   │   ├── lease.module.ts
│   │   ├── lease.controller.ts
│   │   ├── lease.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── tenant/                # Tenant management
│   │   ├── tenant.module.ts
│   │   ├── tenant.controller.ts
│   │   ├── tenant.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── payment/               # Payment & Invoice management
│   │   ├── payment.module.ts
│   │   ├── payment.controller.ts
│   │   ├── payment.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── maintenance/           # Maintenance requests
│   │   ├── maintenance.module.ts
│   │   ├── maintenance.controller.ts
│   │   ├── maintenance.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── document/              # Document management
│   │   ├── document.module.ts
│   │   ├── document.controller.ts
│   │   ├── document.service.ts
│   │   └── dto/
│   │
│   └── notification/          # Notifications
│       ├── notification.module.ts
│       ├── notification.service.ts
│       └── dto/
│
├── database/                  # Database layer
│   └── prisma.service.ts      # Prisma service
│
├── middleware/                # Custom middleware
│   └── logger.middleware.ts
│
└── shared/                    # Shared types & constants
    ├── enums/
    │   ├── user-role.enum.ts
    │   ├── property-status.enum.ts
    │   └── lease-status.enum.ts
    ├── interfaces/
    │   ├── pagination.interface.ts
    │   └── response.interface.ts
    └── constants/
        └── app.constants.ts
```

## Key Features

### 1. **Modular Architecture**
- All business logic modules are organized under `modules/`
- Each module is self-contained with its own controller, service, DTOs, and entities

### 2. **Separation of Concerns**
- **Config/**: Environment-based configuration
- **Common/**: Reusable decorators, guards, interceptors, pipes, filters
- **Shared/**: Types, enums, interfaces, constants
- **Database/**: Database service abstraction
- **Middleware/**: Request/response middleware

### 3. **Module Pattern**
Each feature module follows this structure:
```
module-name/
├── module-name.module.ts      # Module definition
├── module-name.controller.ts  # HTTP endpoints
├── module-name.service.ts     # Business logic
├── entities/                  # Domain entities
└── dto/                       # Data Transfer Objects
```

## Next Steps

1. **Install additional dependencies** (if needed):
   - `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`
   - `@nestjs/config`
   - `class-validator`, `class-transformer`
   - `bcrypt`

2. **Set up Prisma schema** with your domain models

3. **Implement authentication** module first

4. **Add validation** using class-validator in DTOs

5. **Configure environment variables** in `.env` file

6. **Set up Swagger** documentation









