# Lease API Documentation

Complete documentation for Lease CRUD operations and related actions in the Property Management System.

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Lease Entity Structure](#lease-entity-structure)
5. [Enums](#enums)
6. [CRUD Operations](#crud-operations)
7. [Lease Actions](#lease-actions)
8. [Query & Filtering](#query--filtering)
9. [Lease History](#lease-history)
10. [Business Rules & Validations](#business-rules--validations)
11. [Error Handling](#error-handling)
12. [Examples](#examples)

---

## Overview

The Lease API provides comprehensive functionality for managing property leases, including creation, activation, termination, renewal, and transfer operations. Leases go through a lifecycle from DRAFT → ACTIVE → TERMINATED/EXPIRED/RENEWED.

### Key Features

- **CRUD Operations**: Create, Read, Update, Delete leases
- **Automatic Activation**: Leases automatically activate when start date is reached
- **Lease Lifecycle Management**: Terminate, Renew, Transfer
- **Advanced Filtering**: Filter by status, type, dates, tenant, unit, property, company
- **Lease History**: View lease history by unit or tenant
- **Automatic Rent Generation**: First rent cycle generated upon activation
- **Status Management**: Automatic status updates (e.g., EXPIRED when end date passes)

---

## Base URL

```
/api/v1/leases
```

---

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Lease Entity Structure

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique lease identifier |
| `tenantId` | UUID | Yes | Tenant user ID (from tenant profile) |
| `unitId` | UUID | Yes | Unit being leased |
| `companyId` | UUID | Auto | Company ID (from unit) |
| `landlordUserId` | UUID | Optional | Landlord user ID |
| `leaseNumber` | String | Auto | Auto-generated lease number (format: `LEASE-YYYY-###`) |
| `status` | Enum | Auto | Lease status (default: `DRAFT`) |
| `leaseType` | Enum | Yes | Type of lease |

### Date Fields

| Field | Type | Description |
|-------|------|-------------|
| `startDate` | Date | Lease start date |
| `endDate` | Date | Lease end date |
| `moveInDate` | Date | Actual move-in date |
| `moveOutDate` | Date | Actual move-out date |
| `signedDate` | Date | Date lease was signed |
| `renewalDate` | Date | Renewal date |
| `noticeToVacateDate` | Date | Notice to vacate date |
| `billingStartDate` | Date | When billing starts (can differ from startDate) |
| `actualTerminationDate` | Date | Actual termination date |

### Billing & Payment Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `proratedFirstMonth` | Boolean | `false` | Whether first month is prorated |
| `gracePeriodDays` | Number | `0` | Days after due date before late fees |
| `rentDueDay` | Number (1-28) | Auto | Day of month when rent is due |
| `nextRentDueDate` | Date | Auto | Calculated next rent due date |
| `paymentFrequency` | Enum | `MONTHLY` | Payment frequency |
| `lateFeeType` | Enum | `FIXED` | Late fee calculation type |
| `lateFeeValue` | Number | - | Late fee amount or percentage |
| `lateFeeAmount` | Number | - | Fixed late fee amount |

### Financial Fields

| Field | Type | Description |
|-------|------|-------------|
| `monthlyRent` | Decimal | Monthly rent amount |
| `securityDeposit` | Decimal | Security deposit amount |
| `petDeposit` | Decimal | Pet deposit amount |
| `petRent` | Decimal | Monthly pet rent |
| `utilitiesIncluded` | Boolean | Whether utilities are included |
| `utilityCosts` | Decimal | Utility costs if not included |
| `currency` | String | Currency code (default: `KES`) |

### Terms & Conditions

| Field | Type | Description |
|-------|------|-------------|
| `leaseTerm` | Number | Lease term in months |
| `renewalOptions` | String | Renewal options text |
| `noticePeriod` | Number | Notice period in days |
| `petPolicy` | String | Pet policy description |
| `smokingPolicy` | String | Smoking policy description |
| `terms` | String | General lease terms |

### Additional Fields

| Field | Type | Description |
|-------|------|-------------|
| `coTenants` | Array[UUID] | Co-tenant user IDs |
| `guarantorInfo` | Object | Guarantor information (JSON) |
| `documents` | Array[String] | Lease document URLs |
| `notes` | String | Internal notes |
| `tags` | Array[String] | Tags for categorization |
| `createdBy` | UUID | User who created the lease |
| `isActive` | Boolean | Soft delete flag |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

### Termination Metadata

| Field | Type | Description |
|-------|------|-------------|
| `terminationReason` | String | Reason for termination |
| `terminatedBy` | UUID | User who terminated the lease |
| `terminationNotes` | String | Termination notes |
| `actualTerminationDate` | Date | Actual termination date |

### Renewal Linking

| Field | Type | Description |
|-------|------|-------------|
| `renewedFromLeaseId` | UUID | Previous lease ID if renewed |
| `renewedToLeaseId` | UUID | New lease ID if this was renewed |

---

## Enums

### LeaseStatus

```typescript
enum LeaseStatus {
  DRAFT = 'DRAFT',           // Initial state, not yet active
  ACTIVE = 'ACTIVE',         // Currently active lease
  EXPIRED = 'EXPIRED',       // End date has passed
  TERMINATED = 'TERMINATED', // Manually terminated
  RENEWED = 'RENEWED'        // Lease was renewed (replaced by new lease)
}
```

### LeaseType

```typescript
enum LeaseType {
  SHORT_TERM = 'SHORT_TERM',       // Short-term lease
  LONG_TERM = 'LONG_TERM',         // Long-term lease
  FIXED_TERM = 'FIXED_TERM',       // Fixed-term lease
  MONTH_TO_MONTH = 'MONTH_TO_MONTH' // Month-to-month lease
}
```

### PaymentFrequency

```typescript
enum PaymentFrequency {
  MONTHLY = 'MONTHLY'  // Monthly payments
}
```

### LateFeeType

```typescript
enum LateFeeType {
  FIXED = 'FIXED',         // Fixed amount
  PERCENTAGE = 'PERCENTAGE', // Percentage of rent
  NONE = 'NONE'            // No late fees
}
```

---

## CRUD Operations

### 1. Create Lease

Create a new lease. The lease status depends on the start date:
- **If `startDate` is today or earlier**: Lease is automatically activated (status becomes `ACTIVE`)
- **If `startDate` is in the future**: Lease remains `DRAFT` until the start date is reached

**Endpoint:** `POST /api/v1/leases`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`, `LANDLORD`

**Request Body:**

```json
{
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "unitId": "123e4567-e89b-12d3-a456-426614174001",
  "leaseType": "LONG_TERM",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "monthlyRent": 1500.00,
  "landlordUserId": "123e4567-e89b-12d3-a456-426614174002",
  "billingStartDate": "2024-01-01",
  "proratedFirstMonth": false,
  "gracePeriodDays": 5,
  "rentDueDay": 5,
  "paymentFrequency": "MONTHLY",
  "lateFeeType": "FIXED",
  "lateFeeAmount": 50.00,
  "securityDeposit": 1500.00,
  "currency": "KES",
  "leaseTerm": 12,
  "utilitiesIncluded": false,
  "moveInDate": "2024-01-01",
  "signedDate": "2023-12-15",
  "notes": "First-time tenant, excellent references",
  "tags": ["priority", "renewal"]
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantName": "John Doe",
    "tenantEmail": "john.doe@example.com",
    "unitId": "123e4567-e89b-12d3-a456-426614174001",
    "unitNumber": "101",
    "propertyId": "123e4567-e89b-12d3-a456-426614174004",
    "propertyName": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174005",
    "leaseNumber": "LEASE-2024-001",
    "status": "ACTIVE",
    "leaseType": "LONG_TERM",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "monthlyRent": 1500.00,
    "createdAt": "2023-12-15T10:00:00Z",
    "updatedAt": "2023-12-15T10:00:00Z"
  },
  "message": "Lease created successfully"
}
```

**Key Validations:**
- Unit must exist and be active
- Tenant profile must exist for the company
- Unit must not have an existing active lease
- `endDate` must be after `startDate`
- `rentDueDay` must be between 1 and 28
- Lease number is auto-generated if not provided

**Automatic Activation:**
- If `startDate <= today`, the lease is automatically activated upon creation
- Activation includes: status change to `ACTIVE`, unit status change to `OCCUPIED`, tenant status update, and first rent cycle generation
- If activation fails, the lease creation fails with an error

---

### 2. List Leases

Get a paginated list of leases with filtering options.

**Endpoint:** `GET /api/v1/leases`

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | Number | Page number (1-indexed) | `1` |
| `limit` | Number | Items per page (1-100) | `10` |
| `search` | String | Search by lease number or tenant name | `"LEASE-2024"` |
| `status` | Enum | Filter by lease status | `ACTIVE` |
| `leaseType` | Enum | Filter by lease type | `LONG_TERM` |
| `tenantId` | UUID | Filter by tenant ID | `"..."` |
| `unitId` | UUID | Filter by unit ID | `"..."` |
| `propertyId` | UUID | Filter by property ID | `"..."` |
| `companyId` | UUID | Filter by company ID | `"..."` |
| `startDateFrom` | Date | Filter leases starting from | `"2024-01-01"` |
| `startDateTo` | Date | Filter leases starting until | `"2024-12-31"` |
| `endDateFrom` | Date | Filter leases ending from | `"2024-01-01"` |
| `endDateTo` | Date | Filter leases ending until | `"2024-12-31"` |
| `expiringSoon` | Boolean | Filter leases expiring within 30 days | `true` |
| `sortBy` | String | Sort field (`startDate`, `endDate`, `createdAt`, `leaseNumber`, `monthlyRent`) | `"startDate"` |
| `sortOrder` | String | Sort order (`ASC`, `DESC`) | `"DESC"` |

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "leaseNumber": "LEASE-2024-001",
      "status": "ACTIVE",
      "tenantName": "John Doe",
      "unitNumber": "101",
      "propertyName": "Sunset Apartments",
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

**Access Control:**
- Tenants can only see their own leases
- Other users see leases in their companies
- Super admins see all leases

---

### 3. Get Lease by ID

Get a single lease by its ID.

**Endpoint:** `GET /api/v1/leases/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Lease ID |

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantName": "John Doe",
    "tenantEmail": "john.doe@example.com",
    "unitId": "123e4567-e89b-12d3-a456-426614174001",
    "unitNumber": "101",
    "propertyId": "123e4567-e89b-12d3-a456-426614174004",
    "propertyName": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174005",
    "leaseNumber": "LEASE-2024-001",
    "status": "ACTIVE",
    "leaseType": "LONG_TERM",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "moveInDate": "2024-01-01",
    "monthlyRent": 1500.00,
    "securityDeposit": 1500.00,
    "currency": "KES",
    "paymentFrequency": "MONTHLY",
    "rentDueDay": 5,
    "gracePeriodDays": 5,
    "lateFeeType": "FIXED",
    "lateFeeAmount": 50.00,
    "utilitiesIncluded": false,
    "createdAt": "2023-12-15T10:00:00Z",
    "updatedAt": "2024-01-01T08:00:00Z"
  }
}
```

**Access Control:**
- Tenants can view their own leases
- Users can view leases in their companies
- Super admins can view all leases

---

### 4. Update Lease

Update an existing lease. Update restrictions apply based on lease status.

**Endpoint:** `PATCH /api/v1/leases/:id`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`, `LANDLORD`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Lease ID |

**Request Body:** (All fields optional)

```json
{
  "notes": "Updated notes",
  "tags": ["updated", "priority"],
  "moveInDate": "2024-01-02",
  "renewalDate": "2024-11-01",
  "landlordUserId": "123e4567-e89b-12d3-a456-426614174002"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "notes": "Updated notes",
    "tags": ["updated", "priority"],
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "message": "Lease updated successfully"
}
```

**Update Restrictions:**

**For ACTIVE Leases:**
- ❌ Cannot update: `startDate`, `endDate`, `monthlyRent`, `securityDeposit`, `leaseType`
- ✅ Can update: `notes`, `tags`, `documents`, `moveInDate`, `moveOutDate`, `renewalDate`, `noticeToVacateDate`, `landlordUserId`

**For DRAFT Leases:**
- ✅ Can update all fields (with validation)

---

### 5. Delete Lease

Delete a lease (soft delete). Only allowed for `DRAFT` leases.

**Endpoint:** `DELETE /api/v1/leases/:id`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Lease ID |

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Lease deleted successfully"
}
```

**Restrictions:**
- Only `DRAFT` leases can be deleted
- Active leases must be terminated first

---

## Lease Actions

### 1. Lease Activation Scheduler

Manually trigger the lease activation check. This endpoint finds all `DRAFT` leases whose start date has been reached and activates them automatically.

**Endpoint:** `POST /api/v1/leases/scheduler/check-activation`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Lease activation check completed successfully"
}
```

**What This Does:**
- Finds all `DRAFT` leases where `startDate <= today`
- For each lease, automatically activates it:
  1. Lease status changes: `DRAFT` → `ACTIVE`
  2. Unit status changes: `AVAILABLE` → `OCCUPIED`
  3. Tenant status updated based on active lease count
  4. First rent cycle is automatically generated
  5. `moveInDate` is set if not already set

**Usage:**
- Typically called by an external cron job daily (e.g., at midnight)
- Can also be called manually for testing or immediate processing
- Errors for individual leases are logged but don't stop processing of other leases

**Note:** Leases with start dates that are today or earlier are automatically activated during creation, so this scheduler primarily handles leases that were created with future start dates.

---

### 2. Terminate Lease

Terminate an `ACTIVE` lease, changing status to `TERMINATED`.

**Endpoint:** `POST /api/v1/leases/:id/terminate`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Lease ID |

**Request Body:**

```json
{
  "terminationReason": "Lease expired",
  "terminationNotes": "Tenant chose not to renew",
  "actualTerminationDate": "2024-12-31"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "status": "TERMINATED",
    "terminationReason": "Lease expired",
    "terminationNotes": "Tenant chose not to renew\n\nOutstanding balance at termination: KES 0.00",
    "actualTerminationDate": "2024-12-31",
    "moveOutDate": "2024-12-31"
  },
  "message": "Lease terminated successfully"
}
```

**What Happens on Termination:**
1. Lease status changes: `ACTIVE` → `TERMINATED`
2. Unit status changes: `OCCUPIED` → `AVAILABLE`
3. Tenant status updated based on remaining active leases
4. Outstanding balance is logged in termination notes
5. `moveOutDate` is set to termination date
6. Future rent generation stops (checks for `ACTIVE` status)

**Validations:**
- Lease must be in `ACTIVE` status
- Outstanding payments are logged but don't block termination

---

### 3. Renew Lease

Create a new lease from an existing `ACTIVE` or `EXPIRED` lease.

**Endpoint:** `POST /api/v1/leases/:id/renew`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Lease ID (old lease) |

**Request Body:**

```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 1600.00,
  "securityDeposit": 1600.00,
  "proratedFirstMonth": false,
  "gracePeriodDays": 5,
  "leaseType": "LONG_TERM"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174006",
    "leaseNumber": "LEASE-2025-001",
    "status": "DRAFT",
    "renewedFromLeaseId": "123e4567-e89b-12d3-a456-426614174003",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "unitId": "123e4567-e89b-12d3-a456-426614174001",
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "monthlyRent": 1600.00
  },
  "message": "Lease renewed successfully"
}
```

**What Happens on Renewal:**
1. New lease is created in `DRAFT` status
2. Old lease status changes: `ACTIVE`/`EXPIRED` → `RENEWED`
3. Old lease `renewedToLeaseId` is set to new lease ID
4. New lease `renewedFromLeaseId` is set to old lease ID
5. Most fields are copied from old lease (can be overridden)
6. New lease number is auto-generated

**Validations:**
- Old lease must be `ACTIVE` or `EXPIRED`
- `endDate` must be after `startDate`
- New lease inherits tenant, unit, and company from old lease

---

### 4. Transfer Lease

Transfer a lease to a new tenant or unit (terminates old lease and creates new one).

**Endpoint:** `POST /api/v1/leases/:id/transfer`

**Required Roles:** `COMPANY_ADMIN`, `MANAGER`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Lease ID (old lease) |

**Request Body:**

```json
{
  "newTenantId": "123e4567-e89b-12d3-a456-426614174007",
  "newUnitId": "123e4567-e89b-12d3-a456-426614174008"
}
```

**Note:** At least one of `newTenantId` or `newUnitId` must be provided.

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174009",
    "leaseNumber": "LEASE-2024-002",
    "status": "DRAFT",
    "tenantId": "123e4567-e89b-12d3-a456-426614174007",
    "unitId": "123e4567-e89b-12d3-a456-426614174008",
    "notes": "Transferred from lease LEASE-2024-001"
  },
  "message": "Lease transferred successfully"
}
```

**What Happens on Transfer:**
1. Old lease is terminated (status → `TERMINATED`)
2. New lease is created in `DRAFT` status
3. Financial terms are copied from old lease
4. New lease notes include transfer reference
5. New unit is validated (must be available, no active lease)

**Validations:**
- At least one of `newTenantId` or `newUnitId` must be provided
- If `newUnitId` is provided, unit must exist and be available
- If `newUnitId` is provided, unit must not have an active lease

---

## Query & Filtering

### Filtering Options

The list leases endpoint supports comprehensive filtering:

**By Status:**
```
GET /api/v1/leases?status=ACTIVE
```

**By Type:**
```
GET /api/v1/leases?leaseType=LONG_TERM
```

**By Tenant:**
```
GET /api/v1/leases?tenantId=123e4567-e89b-12d3-a456-426614174000
```

**By Unit:**
```
GET /api/v1/leases?unitId=123e4567-e89b-12d3-a456-426614174001
```

**By Property:**
```
GET /api/v1/leases?propertyId=123e4567-e89b-12d3-a456-426614174004
```

**By Date Range:**
```
GET /api/v1/leases?startDateFrom=2024-01-01&startDateTo=2024-12-31
```

**Expiring Soon (within 30 days):**
```
GET /api/v1/leases?expiringSoon=true
```

**Search:**
```
GET /api/v1/leases?search=LEASE-2024
```

**Combined Filters:**
```
GET /api/v1/leases?status=ACTIVE&leaseType=LONG_TERM&expiringSoon=true&sortBy=endDate&sortOrder=ASC
```

---

## Lease History

### Get Lease History by Unit

Get all leases (active and historical) for a specific unit.

**Endpoint:** `GET /api/v1/leases/unit/:unitId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `unitId` | UUID | Unit ID |

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "leaseNumber": "LEASE-2024-001",
      "status": "TERMINATED",
      "tenantName": "John Doe",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174006",
      "leaseNumber": "LEASE-2025-001",
      "status": "ACTIVE",
      "tenantName": "Jane Smith",
      "startDate": "2025-01-01",
      "endDate": "2025-12-31"
    }
  ]
}
```

**Access Control:**
- Users must have access to the unit's company
- Super admins can access any unit

---

### Get Lease History by Tenant

Get all leases (active and historical) for a specific tenant.

**Endpoint:** `GET /api/v1/leases/tenant/:tenantId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | UUID | Tenant user ID |

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "leaseNumber": "LEASE-2024-001",
      "status": "TERMINATED",
      "unitNumber": "101",
      "propertyName": "Sunset Apartments",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  ]
}
```

**Access Control:**
- Tenants can only view their own history
- Company admins/managers can view tenant history in their companies
- Super admins can view any tenant's history

---

## Business Rules & Validations

### Lease Creation Rules

1. **One Active Lease Per Unit**: A unit can only have one active lease at a time
2. **Date Validation**: `endDate` must be after `startDate`
3. **Rent Due Day**: Must be between 1 and 28 (represents day of month)
4. **Tenant Validation**: Tenant profile must exist for the company
5. **Unit Validation**: Unit must exist and be active
6. **Auto-Generated Lease Number**: Format: `LEASE-YYYY-###` (e.g., `LEASE-2024-001`)

### Lease Status Transitions

```
DRAFT → ACTIVE (automatic when startDate is reached)
ACTIVE → TERMINATED (via terminate endpoint)
ACTIVE → EXPIRED (automatic when endDate passes)
ACTIVE → RENEWED (via renew endpoint)
EXPIRED → RENEWED (via renew endpoint)
```

**Automatic Activation:**
- On creation: If `startDate <= today`, lease activates immediately
- Scheduled: Daily job checks for `DRAFT` leases with `startDate <= today` and activates them
- No manual activation endpoint - activation is automatic based on start date

### Update Restrictions

**DRAFT Leases:**
- ✅ All fields can be updated
- ✅ Date validations apply

**ACTIVE Leases:**
- ❌ Cannot update: `startDate`, `endDate`, `monthlyRent`, `securityDeposit`, `leaseType`
- ✅ Can update: `notes`, `tags`, `documents`, `moveInDate`, `moveOutDate`, `renewalDate`, `noticeToVacateDate`, `landlordUserId`

### Activation Requirements

**Automatic Activation (on creation or scheduled check):**
1. Lease must be in `DRAFT` status
2. `startDate` must be today or earlier
3. Unit must be `AVAILABLE`
4. Unit must not have another active lease
5. First rent cycle generation must succeed

**Note:** Activation happens automatically - there is no manual activation endpoint. Leases activate when their start date is reached.

### Termination Effects

1. Lease status → `TERMINATED`
2. Unit status → `AVAILABLE`
3. Tenant status updated (if no other active leases)
4. Outstanding balance logged
5. Future rent generation stops

### Renewal Process

1. Old lease must be `ACTIVE` or `EXPIRED`
2. New lease created in `DRAFT` status
3. Old lease linked to new lease via `renewedToLeaseId`
4. Most fields copied from old lease
5. New lease number auto-generated

### Transfer Process

1. Old lease is terminated
2. New lease created in `DRAFT` status
3. At least one of `newTenantId` or `newUnitId` required
4. New unit validated (available, no active lease)
5. Financial terms copied from old lease

---

## Error Handling

### Common Error Responses

**400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "End date must be after start date",
  "error": "Bad Request"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Only company administrators, managers, and landlords can create leases.",
  "error": "Forbidden"
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Lease not found",
  "error": "Not Found"
}
```

### Error Codes

| Error Code | Description |
|------------|-------------|
| `UNIT_NOT_FOUND` | Unit does not exist |
| `TENANT_NOT_FOUND` | Tenant profile does not exist |
| `LEASE_NOT_FOUND` | Lease does not exist |
| `UNIT_ALREADY_LEASED` | Unit already has an active lease |
| `INVALID_LEASE_DATES` | End date is before or equal to start date |
| `LEASE_NOT_ACTIVE` | Lease is not in ACTIVE status |
| `LEASE_ALREADY_ACTIVE` | Lease is already active |
| `CANNOT_UPDATE_ACTIVE_LEASE_FIELD` | Cannot update restricted field on active lease |
| `CANNOT_DELETE_ACTIVE_LEASE` | Cannot delete non-DRAFT lease |
| `CANNOT_ACTIVATE_UNAVAILABLE_UNIT` | Unit is not available for activation (used during automatic activation) |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `VALIDATION_ERROR` | Request validation failed |

---

## Examples

### Complete Lease Creation Flow

**Step 1: Create Lease (Auto-Activates if startDate <= today)**
```bash
POST /api/v1/leases
{
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "unitId": "123e4567-e89b-12d3-a456-426614174001",
  "leaseType": "LONG_TERM",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "monthlyRent": 1500.00,
  "securityDeposit": 1500.00,
  "billingStartDate": "2024-01-01",
  "rentDueDay": 5,
  "gracePeriodDays": 5,
  "lateFeeType": "FIXED",
  "lateFeeAmount": 50.00
}
```
*Note: If startDate is today or earlier, lease is automatically activated*

**Step 2: View Active Lease**
```bash
GET /api/v1/leases/{leaseId}
```

**For Future Start Dates:**
If `startDate` is in the future, the lease remains `DRAFT` until the start date is reached. A scheduled job (or manual trigger) will activate it:
```bash
POST /api/v1/leases/scheduler/check-activation
```

### Renewal Flow

**Step 1: Renew Lease**
```bash
POST /api/v1/leases/{oldLeaseId}/renew
{
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 1600.00,
  "securityDeposit": 1600.00
}
```
*Note: New lease is created in DRAFT status. It will automatically activate when startDate is reached.*

### Transfer Flow

**Transfer to New Tenant**
```bash
POST /api/v1/leases/{leaseId}/transfer
{
  "newTenantId": "123e4567-e89b-12d3-a456-426614174007"
}
```

**Transfer to New Unit**
```bash
POST /api/v1/leases/{leaseId}/transfer
{
  "newUnitId": "123e4567-e89b-12d3-a456-426614174008"
}
```

### Query Examples

**Find Active Leases Expiring Soon**
```bash
GET /api/v1/leases?status=ACTIVE&expiringSoon=true&sortBy=endDate&sortOrder=ASC
```

**Find Leases for Specific Tenant**
```bash
GET /api/v1/leases?tenantId=123e4567-e89b-12d3-a456-426614174000
```

**Find Leases in Date Range**
```bash
GET /api/v1/leases?startDateFrom=2024-01-01&endDateTo=2024-12-31
```

---

## Notes

- All dates should be in ISO 8601 format (YYYY-MM-DD)
- All monetary values are decimal numbers with up to 2 decimal places
- Lease numbers are auto-generated but can be manually set
- Soft delete is used (leases are marked `isActive: false` rather than deleted)
- **Automatic activation**: Leases activate automatically when `startDate` is reached
  - On creation: If `startDate <= today`, lease activates immediately
  - Scheduled: Daily job activates leases with `startDate <= today`
- Automatic expiration: Leases with `endDate` in the past are automatically marked as `EXPIRED` (via scheduled job)
- Rent cycles are automatically generated when a lease is activated
- Outstanding balances are logged but don't block termination

---

## Related Documentation

- [Payment API Documentation](./PAYMENT_API_DOCUMENTATION.md)
- [Rent Cycle Frontend Guide](./RENT_CYCLE_FRONTEND_GUIDE.md)
- [Unit API Documentation](./UNIT_API_DOCUMENTATION.md)
- [Tenant API Documentation](./TENANT_TESTING_GUIDE.md)
