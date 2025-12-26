# Lease API Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Base Configuration](#base-configuration)
- [Core Concepts](#core-concepts)
- [API Routes](#api-routes)
- [DTOs & Enums](#dtos--enums)
- [Use Cases & Flow Diagrams](#use-cases--flow-diagrams)
- [Permissions & Access Control](#permissions--access-control)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Best Practices](#best-practices)

---

## Overview

This documentation covers all lease management API endpoints for the Property Management System. The lease system supports:

- Creating and managing leases that connect tenants to units
- Lease lifecycle management (DRAFT → ACTIVE → TERMINATED/EXPIRED/RENEWED)
- Automated status management (updates Unit and Tenant status)
- Lease renewal and transfer operations
- Comprehensive filtering, pagination, and search capabilities
- Company-scoped lease access with tenant filtering
- Billing controls and financial management
- Lease history tracking

**Important**: All routes require JWT Bearer token authentication and company context (unless you're a super admin). Leases are scoped to companies, and tenants can only view their own leases.

---

## Base Configuration

### Base URL Structure
```
Base URL: http://localhost:8000/api/v1
```
*Note: The base URL may vary depending on your environment. Check with your backend team for the correct base URL.*

### API Versioning
All routes are versioned as `v1` in the URL path.

### Authentication Header Format
All routes require JWT token authentication:
```
Authorization: Bearer <your-jwt-token>
```

### Response Format
All responses follow this structure:
```json
{
  "success": true/false,
  "data": { ... },
  "message": "Response message"
}
```

For paginated responses, the structure includes pagination metadata:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## Core Concepts

### Lease Lifecycle

Leases have a clear lifecycle:

1. **DRAFT** → Lease is created but not yet active
   - Can be fully edited
   - Can be deleted
   - Does not affect unit or tenant status

2. **ACTIVE** → Lease is currently in effect
   - Limited editing (notes, tags, documents, dates)
   - Cannot be deleted (must terminate first)
   - Unit status: OCCUPIED
   - Tenant status: ACTIVE (if no other active leases)

3. **TERMINATED** → Lease was ended before expiration
   - Read-only
   - Unit status: AVAILABLE
   - Tenant status: FORMER (if no other active leases)

4. **EXPIRED** → Lease reached its end date
   - Read-only
   - Unit status: AVAILABLE
   - Tenant status: FORMER (if no other active leases)

5. **RENEWED** → Lease was renewed (replaced by new lease)
   - Read-only
   - Links to new lease via `renewedToLeaseId`

### Lease-Tenant-Unit Relationship

```
Lease (N) ──── (1) Tenant (User)
   │
   ├─── (1) Unit (1) ──── (1) Property
   │
   └─── (1) Company
```

- Each lease connects one tenant to one unit
- Property is derived from the unit (not duplicated)
- Only one ACTIVE lease per unit is allowed
- A tenant can have multiple leases (across different units/companies)

### Lease Statuses

Leases can have the following statuses (from `LeaseStatus` enum):

- **DRAFT**: Lease is created but not yet active (default)
- **ACTIVE**: Lease is currently active and in effect
- **EXPIRED**: Lease reached its end date
- **TERMINATED**: Lease was terminated before expiration
- **RENEWED**: Lease was renewed (replaced by new lease)

### Lease Types

Leases can be one of the following types (from `LeaseType` enum):

- **SHORT_TERM**: Short-term lease (typically less than 6 months)
- **LONG_TERM**: Long-term lease (typically 6 months or more)
- **MONTH_TO_MONTH**: Month-to-month lease

### Key Business Rules

1. **One Active Lease Per Unit**: Only one lease can be ACTIVE for a unit at a time
2. **ACTIVE Leases are Read-Only**: Limited updates allowed (notes, tags, documents, some dates)
3. **Lease Transfer**: Always terminate old lease + create new lease (not a single update)
4. **Property Derived**: Property information is obtained via `unit.property`, not duplicated
5. **Soft Delete**: Only DRAFT leases can be soft-deleted
6. **Status Automation**: Automatically updates tenant and unit status when lease is activated/terminated

### Status Update Flow

#### When Lease Activated:
1. Lease status: DRAFT → ACTIVE
2. Unit status: AVAILABLE → OCCUPIED
3. Tenant status: PENDING → ACTIVE (if no other active leases exist)

#### When Lease Terminated/Expired:
1. Lease status: ACTIVE → TERMINATED/EXPIRED
2. Unit status: OCCUPIED → AVAILABLE
3. Tenant status:
   - If other active leases exist: Stay ACTIVE
   - If no other active leases: ACTIVE → FORMER

---

## API Routes

### 1. Create Lease

**Endpoint**: `POST /api/v1/leases`

**Description**: Creates a new lease. The lease starts as DRAFT and must be activated before it becomes active.

**Required Permissions**: COMPANY_ADMIN, MANAGER, or LANDLORD

**Request Body**:
```json
{
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "unitId": "123e4567-e89b-12d3-a456-426614174001",
  "leaseType": "LONG_TERM",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "monthlyRent": 1500.00,
  "landlordUserId": "123e4567-e89b-12d3-a456-426614174002",
  "leaseNumber": "LEASE-2024-001",
  "moveInDate": "2024-01-01",
  "signedDate": "2023-12-15",
  "billingStartDate": "2024-01-01",
  "proratedFirstMonth": false,
  "gracePeriodDays": 5,
  "securityDeposit": 1500.00,
  "petDeposit": 500.00,
  "petRent": 50.00,
  "lateFeeAmount": 50.00,
  "utilitiesIncluded": false,
  "utilityCosts": 100.00,
  "currency": "KES",
  "leaseTerm": 12,
  "noticePeriod": 30,
  "petPolicy": "Dogs and cats allowed, max 2 pets",
  "smokingPolicy": "No smoking allowed",
  "terms": "Standard lease terms apply",
  "coTenants": ["123e4567-e89b-12d3-a456-426614174003"],
  "guarantorInfo": {
    "name": "John Doe",
    "phone": "1234567890",
    "relationship": "Parent"
  },
  "notes": "First-time tenant, excellent references",
  "tags": ["priority", "renewal"]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174004",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantName": "John Doe",
    "tenantEmail": "tenant@example.com",
    "unitId": "123e4567-e89b-12d3-a456-426614174001",
    "unitNumber": "101",
    "propertyId": "123e4567-e89b-12d3-a456-426614174005",
    "propertyName": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174006",
    "status": "DRAFT",
    "leaseType": "LONG_TERM",
    "monthlyRent": 1500.00,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Lease created successfully"
}
```

**Validation Rules**:
- `tenantId` must be a valid UUID and exist
- `unitId` must be a valid UUID and exist
- `endDate` must be after `startDate`
- Unit must not have an existing ACTIVE lease
- Tenant must be a tenant in the unit's company

---

### 2. List Leases

**Endpoint**: `GET /api/v1/leases`

**Description**: Retrieves a paginated list of leases with filtering and search capabilities.

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Items per page (max: 100)
- `search` (optional): Search by lease number or tenant name/email
- `status` (optional): Filter by lease status (DRAFT, ACTIVE, EXPIRED, TERMINATED, RENEWED)
- `leaseType` (optional): Filter by lease type (SHORT_TERM, LONG_TERM, MONTH_TO_MONTH)
- `tenantId` (optional): Filter by tenant ID
- `unitId` (optional): Filter by unit ID
- `propertyId` (optional): Filter by property ID (via unit)
- `companyId` (optional): Filter by company ID
- `startDateFrom` (optional): Filter leases starting from this date
- `startDateTo` (optional): Filter leases starting until this date
- `endDateFrom` (optional): Filter leases ending from this date
- `endDateTo` (optional): Filter leases ending until this date
- `expiringSoon` (optional, boolean): Filter leases expiring in next 30 days (ACTIVE only)
- `sortBy` (optional, default: createdAt): Sort field (startDate, endDate, createdAt, leaseNumber, monthlyRent)
- `sortOrder` (optional, default: DESC): Sort order (ASC, DESC)

**Example Request**:
```
GET /api/v1/leases?page=1&limit=10&status=ACTIVE&expiringSoon=true
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "tenantName": "John Doe",
      "unitNumber": "101",
      "propertyName": "Sunset Apartments",
      "status": "ACTIVE",
      "monthlyRent": 1500.00,
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

**Access Control**:
- Tenants can only see their own leases
- Company members can see leases in their companies
- Super admins can see all leases

---

### 3. Get Lease by ID

**Endpoint**: `GET /api/v1/leases/:id`

**Description**: Retrieves detailed information about a specific lease.

**Path Parameters**:
- `id` (required): Lease UUID

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174004",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantName": "John Doe",
    "tenantEmail": "tenant@example.com",
    "unitId": "123e4567-e89b-12d3-a456-426614174001",
    "unitNumber": "101",
    "propertyId": "123e4567-e89b-12d3-a456-426614174005",
    "propertyName": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174006",
    "landlordUserId": "123e4567-e89b-12d3-a456-426614174002",
    "leaseNumber": "LEASE-2024-001",
    "status": "ACTIVE",
    "leaseType": "LONG_TERM",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "moveInDate": "2024-01-01",
    "signedDate": "2023-12-15",
    "billingStartDate": "2024-01-01",
    "monthlyRent": 1500.00,
    "securityDeposit": 1500.00,
    "currency": "KES",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Access Control**:
- Tenants can view their own leases
- Company members can view leases in their companies
- Super admins can view all leases

---

### 4. Update Lease

**Endpoint**: `PATCH /api/v1/leases/:id`

**Description**: Updates a lease. Updates are limited for ACTIVE leases.

**Required Permissions**: COMPANY_ADMIN, MANAGER, or LANDLORD

**Path Parameters**:
- `id` (required): Lease UUID

**Request Body** (all fields optional):
```json
{
  "notes": "Updated notes",
  "tags": ["updated", "tag"],
  "documents": ["https://example.com/updated-document.pdf"],
  "moveInDate": "2024-01-05",
  "moveOutDate": "2024-12-30",
  "renewalDate": "2024-11-01",
  "noticeToVacateDate": "2024-11-01",
  "landlordUserId": "123e4567-e89b-12d3-a456-426614174007"
}
```

**Update Restrictions for ACTIVE Leases**:
- Cannot change `tenantId`, `unitId`, `startDate`, or `endDate`
- Can update: `notes`, `tags`, `documents`, `moveInDate`, `moveOutDate`, `renewalDate`, `noticeToVacateDate`, `landlordUserId`

**Update Rules for DRAFT Leases**:
- All fields can be updated
- Date validations still apply (`endDate` > `startDate`)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174004",
    "notes": "Updated notes",
    "tags": ["updated", "tag"]
  },
  "message": "Lease updated successfully"
}
```

---

### 5. Activate Lease

**Endpoint**: `POST /api/v1/leases/:id/activate`

**Description**: Activates a DRAFT lease, making it ACTIVE. This updates the unit and tenant status automatically.

**Required Permissions**: COMPANY_ADMIN or MANAGER only

**Path Parameters**:
- `id` (required): Lease UUID

**Validation**:
- Lease status must be DRAFT
- Unit must not have another ACTIVE lease
- Unit status must be AVAILABLE

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174004",
    "status": "ACTIVE",
    "moveInDate": "2024-01-01"
  },
  "message": "Lease activated successfully"
}
```

**Side Effects**:
- Lease status: DRAFT → ACTIVE
- Unit status: AVAILABLE → OCCUPIED
- Tenant status: PENDING → ACTIVE (if no other active leases)

---

### 6. Terminate Lease

**Endpoint**: `POST /api/v1/leases/:id/terminate`

**Description**: Terminates an ACTIVE lease before its end date.

**Required Permissions**: COMPANY_ADMIN or MANAGER only

**Path Parameters**:
- `id` (required): Lease UUID

**Request Body**:
```json
{
  "terminationReason": "Tenant requested early termination",
  "terminationNotes": "Mutual agreement to terminate early",
  "actualTerminationDate": "2024-06-30"
}
```

**Validation**:
- Lease status must be ACTIVE

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174004",
    "status": "TERMINATED",
    "terminationReason": "Tenant requested early termination",
    "actualTerminationDate": "2024-06-30",
    "moveOutDate": "2024-06-30"
  },
  "message": "Lease terminated successfully"
}
```

**Side Effects**:
- Lease status: ACTIVE → TERMINATED
- Unit status: OCCUPIED → AVAILABLE
- Tenant status: ACTIVE → FORMER (if no other active leases exist)

---

### 7. Renew Lease

**Endpoint**: `POST /api/v1/leases/:id/renew`

**Description**: Creates a new lease from an existing ACTIVE or EXPIRED lease. The old lease is marked as RENEWED.

**Required Permissions**: COMPANY_ADMIN or MANAGER only

**Path Parameters**:
- `id` (required): Lease UUID (the lease to renew)

**Request Body**:
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 1600.00,
  "leaseType": "LONG_TERM",
  "securityDeposit": 1600.00,
  "proratedFirstMonth": false,
  "gracePeriodDays": 5
}
```

**Validation**:
- Lease status must be ACTIVE or EXPIRED
- `endDate` must be after `startDate`

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174007",
    "status": "DRAFT",
    "renewedFromLeaseId": "123e4567-e89b-12d3-a456-426614174004",
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "monthlyRent": 1600.00
  },
  "message": "Lease renewed successfully"
}
```

**Side Effects**:
- Old lease status: ACTIVE/EXPIRED → RENEWED
- Old lease `renewedToLeaseId` is set to the new lease ID
- New lease is created as DRAFT (must be activated separately)

---

### 8. Transfer Lease

**Endpoint**: `POST /api/v1/leases/:id/transfer`

**Description**: Transfers a lease to a new tenant or unit. This terminates the old lease and creates a new one.

**Required Permissions**: COMPANY_ADMIN or MANAGER only

**Path Parameters**:
- `id` (required): Lease UUID (the lease to transfer)

**Request Body**:
```json
{
  "newTenantId": "123e4567-e89b-12d3-a456-426614174008"
}
```
OR
```json
{
  "newUnitId": "123e4567-e89b-12d3-a456-426614174009"
}
```
OR both:
```json
{
  "newTenantId": "123e4567-e89b-12d3-a456-426614174008",
  "newUnitId": "123e4567-e89b-12d3-a456-426614174009"
}
```

**Validation**:
- At least one of `newTenantId` or `newUnitId` must be provided
- New unit must not have an existing ACTIVE lease

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174010",
    "status": "DRAFT",
    "tenantId": "123e4567-e89b-12d3-a456-426614174008",
    "notes": "Transferred from lease LEASE-2024-001"
  },
  "message": "Lease transferred successfully"
}
```

**Side Effects**:
- Old lease is terminated (status: TERMINATED)
- New lease is created as DRAFT (must be activated separately)
- Unit status updates accordingly

---

### 9. Delete Lease

**Endpoint**: `DELETE /api/v1/leases/:id`

**Description**: Soft-deletes a lease. Only DRAFT leases can be deleted.

**Required Permissions**: COMPANY_ADMIN or MANAGER only

**Path Parameters**:
- `id` (required): Lease UUID

**Validation**:
- Lease status must be DRAFT

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lease deleted successfully"
}
```

**Note**: ACTIVE, EXPIRED, TERMINATED, or RENEWED leases cannot be deleted. They must be terminated first (for ACTIVE) or are permanently kept in the system for historical records.

---

### 10. Get Lease History by Unit

**Endpoint**: `GET /api/v1/leases/unit/:unitId`

**Description**: Retrieves all lease history for a specific unit, ordered by start date (newest first).

**Path Parameters**:
- `unitId` (required): Unit UUID

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "status": "ACTIVE",
      "tenantName": "John Doe",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174011",
      "status": "TERMINATED",
      "tenantName": "Jane Smith",
      "startDate": "2023-01-01",
      "endDate": "2023-12-31"
    }
  ]
}
```

---

### 11. Get Lease History by Tenant

**Endpoint**: `GET /api/v1/leases/tenant/:tenantId`

**Description**: Retrieves all lease history for a specific tenant, ordered by start date (newest first).

**Path Parameters**:
- `tenantId` (required): Tenant UUID

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "status": "ACTIVE",
      "unitNumber": "101",
      "propertyName": "Sunset Apartments",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  ]
}
```

**Access Control**:
- Tenants can view their own lease history
- Company admins/managers can view tenant lease history in their companies
- Super admins can view all lease history

---

## DTOs & Enums

### LeaseStatus Enum

```typescript
enum LeaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  RENEWED = 'RENEWED'
}
```

### LeaseType Enum

```typescript
enum LeaseType {
  SHORT_TERM = 'SHORT_TERM',
  LONG_TERM = 'LONG_TERM',
  MONTH_TO_MONTH = 'MONTH_TO_MONTH'
}
```

### CreateLeaseDto

**Required Fields**:
- `tenantId`: UUID
- `unitId`: UUID
- `leaseType`: LeaseType enum
- `startDate`: Date string (ISO format)
- `endDate`: Date string (ISO format)
- `monthlyRent`: Number

**Optional Fields**:
- `landlordUserId`: UUID
- `leaseNumber`: String
- `moveInDate`: Date string
- `moveOutDate`: Date string
- `signedDate`: Date string
- `renewalDate`: Date string
- `noticeToVacateDate`: Date string
- `billingStartDate`: Date string
- `proratedFirstMonth`: Boolean
- `gracePeriodDays`: Number
- `securityDeposit`: Number
- `petDeposit`: Number
- `petRent`: Number
- `lateFeeAmount`: Number
- `utilitiesIncluded`: Boolean
- `utilityCosts`: Number
- `currency`: String (default: "KES")
- `leaseTerm`: Number
- `renewalOptions`: String
- `noticePeriod`: Number
- `petPolicy`: String
- `smokingPolicy`: String
- `terms`: String
- `coTenants`: Array of UUIDs
- `guarantorInfo`: Object
- `documents`: Array of URLs
- `notes`: String
- `tags`: Array of strings

---

## Use Cases & Flow Diagrams

### Use Case 1: Creating and Activating a New Lease

```
1. Admin creates lease (DRAFT)
   POST /api/v1/leases
   ↓
2. Lease created as DRAFT
   Unit: AVAILABLE (unchanged)
   Tenant: PENDING (unchanged)
   ↓
3. Admin activates lease
   POST /api/v1/leases/:id/activate
   ↓
4. Lease becomes ACTIVE
   Unit: AVAILABLE → OCCUPIED
   Tenant: PENDING → ACTIVE
```

### Use Case 2: Lease Renewal Flow

```
1. Active lease approaching end date
   Lease: ACTIVE
   ↓
2. Admin renews lease
   POST /api/v1/leases/:id/renew
   ↓
3. Old lease: ACTIVE → RENEWED
   New lease: Created as DRAFT
   ↓
4. Admin activates new lease
   POST /api/v1/leases/:newId/activate
   ↓
5. New lease: DRAFT → ACTIVE
   Old lease: RENEWED (read-only)
```

### Use Case 3: Early Lease Termination

```
1. Active lease
   Lease: ACTIVE
   Unit: OCCUPIED
   Tenant: ACTIVE
   ↓
2. Admin terminates lease
   POST /api/v1/leases/:id/terminate
   ↓
3. Lease: ACTIVE → TERMINATED
   Unit: OCCUPIED → AVAILABLE
   Tenant: ACTIVE → FORMER (if no other active leases)
```

---

## Permissions & Access Control

### Role-Based Permissions

| Action | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | LANDLORD | STAFF | TENANT |
|--------|-------------|---------------|---------|----------|-------|--------|
| Create lease | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| List leases | ✅ (all) | ✅ (company) | ✅ (company) | ✅ (company) | ✅ (company) | ✅ (own only) |
| Get lease | ✅ (all) | ✅ (company) | ✅ (company) | ✅ (company) | ✅ (company) | ✅ (own only) |
| Update lease | ✅ (all) | ✅ (company) | ✅ (company) | ✅ (company) | ❌ | ❌ |
| Activate lease | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Terminate lease | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Renew lease | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Transfer lease | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete lease | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View lease history | ✅ (all) | ✅ (company) | ✅ (company) | ✅ (company) | ✅ (company) | ✅ (own only) |

### Company Scoping

- All lease operations are scoped to companies
- Users can only access leases from companies they belong to
- Super admins can access all leases across all companies
- Tenants can only view their own leases (regardless of company membership)

### Tenant Access Rules

- Tenants can only view their own leases
- Tenants cannot create, update, activate, terminate, renew, transfer, or delete leases
- Tenant lease history includes only leases where they are the tenant

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/leases"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `LEASE_NOT_FOUND` | 404 | The lease does not exist or you don't have access to it |
| `UNIT_ALREADY_LEASED` | 400 | The unit already has an active lease |
| `CANNOT_DELETE_ACTIVE_LEASE` | 400 | Active leases cannot be deleted (must terminate first) |
| `CANNOT_UPDATE_ACTIVE_LEASE_FIELD` | 400 | This field cannot be updated for an active lease |
| `INVALID_LEASE_DATES` | 400 | The lease end date must be after the start date |
| `LEASE_ALREADY_ACTIVE` | 400 | This lease is already active |
| `LEASE_NOT_ACTIVE` | 400 | This operation can only be performed on active leases |
| `CANNOT_ACTIVATE_UNAVAILABLE_UNIT` | 400 | Cannot activate lease for an unavailable unit |
| `INSUFFICIENT_PERMISSIONS` | 403 | You don't have permission to perform this action |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNIT_NOT_FOUND` | 404 | The unit does not exist |
| `TENANT_NOT_FOUND` | 404 | The tenant does not exist or is not in this company |

### Example Error Responses

**Lease Not Found**:
```json
{
  "success": false,
  "error": {
    "code": "LEASE_NOT_FOUND",
    "message": "The lease you're looking for doesn't exist or you don't have access to it.",
    "details": {
      "leaseId": "123e4567-e89b-12d3-a456-426614174000"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/leases/123e4567-e89b-12d3-a456-426614174000"
}
```

**Unit Already Leased**:
```json
{
  "success": false,
  "error": {
    "code": "UNIT_ALREADY_LEASED",
    "message": "This unit already has an active lease. Please terminate the existing lease first.",
    "details": {
      "unitId": "123e4567-e89b-12d3-a456-426614174001",
      "existingLeaseId": "123e4567-e89b-12d3-a456-426614174002"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/leases"
}
```

---

## Code Examples

### Example 1: Create and Activate a Lease

```javascript
// Step 1: Create lease
const createLeaseResponse = await fetch('http://localhost:8000/api/v1/leases', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    tenantId: '123e4567-e89b-12d3-a456-426614174000',
    unitId: '123e4567-e89b-12d3-a456-426614174001',
    leaseType: 'LONG_TERM',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    monthlyRent: 1500.00,
    securityDeposit: 1500.00,
    currency: 'KES'
  })
});

const { data: lease } = await createLeaseResponse.json();

// Step 2: Activate lease
const activateResponse = await fetch(
  `http://localhost:8000/api/v1/leases/${lease.id}/activate`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { data: activeLease } = await activateResponse.json();
console.log('Lease activated:', activeLease.status); // ACTIVE
```

### Example 2: List Active Leases Expiring Soon

```javascript
const response = await fetch(
  'http://localhost:8000/api/v1/leases?status=ACTIVE&expiringSoon=true&page=1&limit=10',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { data: leases, pagination } = await response.json();
console.log(`Found ${pagination.total} leases expiring soon`);
```

### Example 3: Renew a Lease

```javascript
const renewResponse = await fetch(
  `http://localhost:8000/api/v1/leases/${leaseId}/renew`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      monthlyRent: 1600.00,
      securityDeposit: 1600.00
    })
  }
);

const { data: newLease } = await renewResponse.json();
console.log('New lease created:', newLease.id);
console.log('Old lease renewed:', newLease.renewedFromLeaseId);
```

### Example 4: Get Lease History for a Unit

```javascript
const response = await fetch(
  `http://localhost:8000/api/v1/leases/unit/${unitId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { data: history } = await response.json();
console.log(`Unit has ${history.length} lease records`);
```

---

## Best Practices

### 1. Lease Creation

- Always create leases as DRAFT first
- Validate that the unit is available before creating
- Ensure the tenant exists and is part of the company
- Use auto-generated lease numbers for consistency (unless specific numbering is required)

### 2. Lease Activation

- Activate leases only when the tenant is ready to move in
- Verify unit availability before activation
- Consider setting `moveInDate` when activating

### 3. Lease Updates

- Remember that ACTIVE leases have limited update capabilities
- Use notes and tags for tracking important information
- Keep documents updated in the `documents` array

### 4. Lease Termination

- Always provide a termination reason for record-keeping
- Set `actualTerminationDate` if different from today
- Consider tenant's other active leases before termination (affects tenant status)

### 5. Lease Renewal

- Renew leases before they expire to maintain continuity
- Update rent amounts appropriately during renewal
- The new lease must be activated separately after renewal

### 6. Data Access

- Always filter leases by company context (unless super admin)
- Tenants should only see their own leases
- Use pagination for large lease lists

### 7. Status Management

- Let the system automatically update unit and tenant statuses
- Don't manually change unit/tenant status when working with leases
- Monitor lease expirations regularly

### 8. Error Handling

- Check for `UNIT_ALREADY_LEASED` before creating new leases
- Handle `CANNOT_UPDATE_ACTIVE_LEASE_FIELD` errors gracefully
- Provide clear error messages to users about lease state restrictions

### 9. Performance

- Use filtering and pagination to limit result sets
- Index frequently queried fields (status, dates, tenantId, unitId)
- Consider caching for frequently accessed lease data

### 10. Security

- Always validate user permissions before lease operations
- Ensure company scoping is enforced at the service level
- Protect sensitive lease financial information (rent, deposits)

---

## Quick Reference

### Lease Status Transitions

| From | To | Method | Notes |
|------|-----|--------|-------|
| DRAFT | ACTIVE | `POST /leases/:id/activate` | Requires unit to be available |
| ACTIVE | TERMINATED | `POST /leases/:id/terminate` | Can specify termination reason |
| ACTIVE | EXPIRED | Automatic | When `endDate` passes |
| ACTIVE/EXPIRED | RENEWED | `POST /leases/:id/renew` | Creates new DRAFT lease |
| DRAFT | (deleted) | `DELETE /leases/:id` | Soft delete only |

### Important Endpoints Summary

| Endpoint | Method | Purpose | Permissions |
|----------|--------|---------|-------------|
| `/leases` | POST | Create lease | ADMIN, MANAGER, LANDLORD |
| `/leases` | GET | List leases | All (filtered) |
| `/leases/:id` | GET | Get lease | All (filtered) |
| `/leases/:id` | PATCH | Update lease | ADMIN, MANAGER, LANDLORD |
| `/leases/:id/activate` | POST | Activate lease | ADMIN, MANAGER |
| `/leases/:id/terminate` | POST | Terminate lease | ADMIN, MANAGER |
| `/leases/:id/renew` | POST | Renew lease | ADMIN, MANAGER |
| `/leases/:id/transfer` | POST | Transfer lease | ADMIN, MANAGER |
| `/leases/:id` | DELETE | Delete lease | ADMIN, MANAGER |
| `/leases/unit/:unitId` | GET | Unit lease history | All (filtered) |
| `/leases/tenant/:tenantId` | GET | Tenant lease history | All (filtered) |

---

**Last Updated**: 2024-12-22





