# Payment API Documentation

## Overview

The Payment API provides comprehensive payment tracking functionality for property management. Payments are immutable financial records - corrections are made through reversals, not edits. All payments are scoped to companies and must be linked to a lease.

**Base URL**: `/api/v1/payments`

**Authentication**: All endpoints require JWT authentication via Bearer token.

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [Payment Statuses](#payment-statuses)
- [Payment Methods](#payment-methods)
- [Payment Types](#payment-types)
- [API Endpoints](#api-endpoints)
- [Request/Response Examples](#requestresponse-examples)
- [Error Handling](#error-handling)
- [Business Rules](#business-rules)
- [Access Control](#access-control)
- [Common Use Cases](#common-use-cases)

---

## Core Concepts

### Payment Immutability

**Key Rule**: Payments are immutable financial records. Once created, core fields (amount, paymentDate, paymentMethod) cannot be changed. To correct errors:

- **Reversals**: Create a reversal payment (negative amount) for paid payments
- **Status Updates**: Update status (PENDING → PAID, PAID → REFUNDED)
- **Limited Edits**: Only notes, attachmentUrl, and period can be updated

### Payment Relationships

```
Payment (1) ──── (1) Lease (required)
Payment (1) ──── (1) Tenant (User) (required)
Payment (1) ──── (1) Company (required)
Payment (1) ──── (1) User (recordedBy)
```

### Balance Tracking

Balances are **computed dynamically**, not stored:
- **Tenant Balance**: Sum of all payments for a tenant in a company
- **Lease Balance**: Sum of all payments for a lease
- **Last Payment Date**: Most recent payment date for tenant/lease

---

## Payment Statuses

| Status | Description | Can Transition To |
|---------|-------------|-------------------|
| `PENDING` | Payment recorded but not yet confirmed | `PAID`, `FAILED`, `CANCELLED` |
| `PAID` | Payment completed successfully | `REFUNDED` |
| `FAILED` | Payment failed | None (terminal) |
| `REFUNDED` | Payment was refunded | None (terminal) |
| `CANCELLED` | Payment was cancelled | None (terminal) |

**Status Transition Rules**:
- PENDING → PAID, FAILED, or CANCELLED
- PAID → REFUNDED (via reversal)
- Cannot go backwards (e.g., PAID → PENDING)

---

## Payment Methods

| Method | Description |
|--------|-------------|
| `CASH` | Cash payment |
| `BANK` | Bank transfer |
| `MPESA` | M-Pesa mobile money |
| `CARD` | Credit/debit card |
| `CHECK` | Check payment |
| `OTHER` | Other payment method |

---

## Payment Types

| Type | Description |
|------|-------------|
| `RENT` | Monthly rent payment |
| `DEPOSIT` | Security deposit |
| `LATE_FEE` | Late payment fee |
| `UTILITY` | Utility payment |
| `PET_DEPOSIT` | Pet deposit |
| `PET_RENT` | Pet rent |
| `MAINTENANCE` | Maintenance fee |
| `OTHER` | Other payment type |

---

## API Endpoints

### 1. Create Payment

**POST** `/api/v1/payments`

Create a new payment record.

**Authorization**: `COMPANY_ADMIN`, `MANAGER`, or `LANDLORD`

**Request Body**:
```json
{
  "leaseId": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 1500.00,
  "currency": "KES",
  "paymentDate": "2024-01-15",
  "paymentMethod": "CASH",
  "paymentType": "RENT",
  "reference": "TXN-123456",
  "period": "2025-03",
  "notes": "Monthly rent payment for March 2025",
  "isPartial": false,
  "balanceAfter": 500.00,
  "attachmentUrl": "https://example.com/receipts/receipt-123.pdf"
}
```

**Required Fields**:
- `leaseId` (UUID)
- `amount` (number, > 0)
- `paymentDate` (date string, ISO format)
- `paymentMethod` (enum)
- `paymentType` (enum)

**Optional Fields**:
- `currency` (default: "KES")
- `reference` (string)
- `period` (string, e.g., "2025-03")
- `notes` (string)
- `isPartial` (boolean, default: false)
- `balanceAfter` (number)
- `attachmentUrl` (string)

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "companyId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantName": "John Doe",
    "leaseId": "123e4567-e89b-12d3-a456-426614174000",
    "leaseNumber": "LEASE-2024-001",
    "amount": 1500.00,
    "currency": "KES",
    "paymentDate": "2024-01-15",
    "paymentMethod": "CASH",
    "paymentType": "RENT",
    "status": "PENDING",
    "reference": "TXN-123456",
    "recordedBy": "123e4567-e89b-12d3-a456-426614174000",
    "period": "2025-03",
    "notes": "Monthly rent payment for March 2025",
    "isPartial": false,
    "balanceAfter": 500.00,
    "attachmentUrl": "https://example.com/receipts/receipt-123.pdf",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "tenantBalance": 1500.00,
    "leaseBalance": 1500.00,
    "lastPaymentDate": "2024-01-15",
    "isOverdue": false
  },
  "message": "Payment created successfully"
}
```

---

### 2. List Payments

**GET** `/api/v1/payments`

List payments with filtering, sorting, and pagination.

**Authorization**: All authenticated users (scoped by role)

**Query Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | number | Page number (1-based) | `1` |
| `limit` | number | Items per page (max 100) | `10` |
| `tenantId` | UUID | Filter by tenant ID | `123e4567-...` |
| `leaseId` | UUID | Filter by lease ID | `123e4567-...` |
| `companyId` | UUID | Filter by company ID | `123e4567-...` |
| `status` | enum | Filter by status | `PAID` |
| `paymentType` | enum | Filter by payment type | `RENT` |
| `paymentMethod` | enum | Filter by payment method | `CASH` |
| `startDate` | date | Filter from date (inclusive) | `2024-01-01` |
| `endDate` | date | Filter to date (inclusive) | `2024-12-31` |
| `sortBy` | string | Sort field | `paymentDate` |
| `sortOrder` | string | Sort order | `DESC` |

**Example Request**:
```
GET /api/v1/payments?page=1&limit=10&status=PAID&paymentType=RENT&startDate=2024-01-01&endDate=2024-12-31
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "companyId": "123e4567-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "tenantName": "John Doe",
      "leaseId": "123e4567-e89b-12d3-a456-426614174000",
      "leaseNumber": "LEASE-2024-001",
      "amount": 1500.00,
      "currency": "KES",
      "paymentDate": "2024-01-15",
      "paymentMethod": "CASH",
      "paymentType": "RENT",
      "status": "PAID",
      "reference": "TXN-123456",
      "recordedBy": "123e4567-e89b-12d3-a456-426614174000",
      "period": "2025-03",
      "notes": "Monthly rent payment for March 2025",
      "isPartial": false,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "tenantBalance": 1500.00,
      "leaseBalance": 1500.00,
      "lastPaymentDate": "2024-01-15",
      "isOverdue": false
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

### 3. Get Payment

**GET** `/api/v1/payments/:id`

Get a single payment by ID.

**Authorization**: All authenticated users (scoped by role)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "companyId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantName": "John Doe",
    "leaseId": "123e4567-e89b-12d3-a456-426614174000",
    "leaseNumber": "LEASE-2024-001",
    "amount": 1500.00,
    "currency": "KES",
    "paymentDate": "2024-01-15",
    "paymentMethod": "CASH",
    "paymentType": "RENT",
    "status": "PAID",
    "reference": "TXN-123456",
    "recordedBy": "123e4567-e89b-12d3-a456-426614174000",
    "period": "2025-03",
    "notes": "Monthly rent payment for March 2025",
    "isPartial": false,
    "balanceAfter": 500.00,
    "attachmentUrl": "https://example.com/receipts/receipt-123.pdf",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "tenantBalance": 1500.00,
    "leaseBalance": 1500.00,
    "lastPaymentDate": "2024-01-15",
    "isOverdue": false
  }
}
```

---

### 4. Update Payment

**PATCH** `/api/v1/payments/:id`

Update limited fields of a payment (immutability enforced).

**Authorization**: `COMPANY_ADMIN` or `MANAGER`

**Request Body**:
```json
{
  "notes": "Updated payment notes",
  "attachmentUrl": "https://example.com/receipts/receipt-123-updated.pdf",
  "period": "2025-03",
  "status": "PAID"
}
```

**Allowed Fields**:
- `notes` (string)
- `attachmentUrl` (string)
- `period` (string)
- `status` (enum, limited transitions only)

**Note**: `amount`, `paymentDate`, and `paymentMethod` **cannot** be changed.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "PAID",
    "notes": "Updated payment notes",
    "attachmentUrl": "https://example.com/receipts/receipt-123-updated.pdf",
    "period": "2025-03",
    ...
  },
  "message": "Payment updated successfully"
}
```

---

### 5. Reverse Payment

**POST** `/api/v1/payments/:id/reverse`

Reverse a paid payment by creating a reversal entry.

**Authorization**: `COMPANY_ADMIN` or `MANAGER`

**Request Body**:
```json
{
  "reason": "Payment made in error",
  "notes": "Customer requested refund due to duplicate payment"
}
```

**Required Fields**:
- `reason` (string, min 3 characters)

**Optional Fields**:
- `notes` (string)

**Business Rules**:
- Only `PAID` payments can be reversed
- Creates a new payment with negative amount
- Updates original payment status to `REFUNDED`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "amount": -1500.00,
    "status": "REFUNDED",
    "notes": "Reversal: Payment made in error. Customer requested refund due to duplicate payment",
    "reference": "REV-TXN-123456",
    ...
  },
  "message": "Payment reversed successfully"
}
```

---

### 6. Mark Payment as Failed

**POST** `/api/v1/payments/:id/mark-failed`

Mark a pending payment as failed.

**Authorization**: `COMPANY_ADMIN` or `MANAGER`

**Business Rules**:
- Only `PENDING` payments can be marked as failed
- Updates status to `FAILED`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "FAILED",
    ...
  },
  "message": "Payment marked as failed successfully"
}
```

---

### 7. Delete Payment

**DELETE** `/api/v1/payments/:id`

Soft delete a payment (sets `isActive` to false).

**Authorization**: `COMPANY_ADMIN` or `MANAGER`

**Business Rules**:
- Only `PENDING` or `CANCELLED` payments can be deleted
- `PAID` or `REFUNDED` payments cannot be deleted (use reversal instead)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment deleted successfully"
}
```

---

### 8. Get Tenant Balance

**GET** `/api/v1/payments/tenant/:tenantId/balance?companyId=:companyId`

Get balance breakdown for a tenant.

**Authorization**: All authenticated users (scoped by role)

**Query Parameters**:
- `companyId` (required, UUID)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "companyId": "123e4567-e89b-12d3-a456-426614174000",
    "totalPaid": 4500.00,
    "totalRefunded": 0.00,
    "netBalance": 4500.00,
    "byType": {
      "RENT": 3000.00,
      "DEPOSIT": 1500.00,
      "LATE_FEE": 0.00
    }
  }
}
```

---

### 9. Get Lease Balance

**GET** `/api/v1/payments/lease/:leaseId/balance`

Get balance breakdown for a lease.

**Authorization**: All authenticated users (scoped by role)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "leaseId": "123e4567-e89b-12d3-a456-426614174000",
    "totalPaid": 4500.00,
    "totalRefunded": 0.00,
    "netBalance": 4500.00,
    "byType": {
      "RENT": 3000.00,
      "DEPOSIT": 1500.00
    },
    "lastPaymentDate": "2024-01-15"
  }
}
```

---

### 10. Get Payment History

**GET** `/api/v1/payments/tenant/:tenantId/history`

Get payment history for a tenant.

**Authorization**: All authenticated users (scoped by role)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "amount": 1500.00,
      "paymentDate": "2024-01-15",
      "paymentType": "RENT",
      "status": "PAID",
      ...
    }
  ]
}
```

**Alternative Endpoint**:
- **GET** `/api/v1/payments/lease/:leaseId/history` - Get payment history for a lease

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "errorCode": "PAYMENT_NOT_FOUND",
  "message": "The payment you're looking for doesn't exist or you don't have access to it.",
  "details": {
    "paymentId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `PAYMENT_NOT_FOUND` | 404 | Payment not found or no access |
| `PAYMENT_ALREADY_COMPLETED` | 400 | Payment already completed |
| `CANNOT_EDIT_COMPLETED_PAYMENT` | 400 | Cannot edit completed payment |
| `INVALID_PAYMENT_STATUS_TRANSITION` | 400 | Invalid status transition |
| `LEASE_NOT_FOUND_FOR_PAYMENT` | 404 | Lease not found |
| `TENANT_NOT_FOUND_FOR_PAYMENT` | 404 | Tenant not found or doesn't belong to lease |
| `CANNOT_DELETE_COMPLETED_PAYMENT` | 400 | Cannot delete completed/refunded payment |
| `CANNOT_REVERSE_PAYMENT` | 400 | Payment cannot be reversed (not PAID) |
| `INSUFFICIENT_PERMISSIONS` | 403 | User doesn't have required permissions |
| `VALIDATION_ERROR` | 400 | Request validation failed |

### Example Error Responses

**404 Not Found**:
```json
{
  "errorCode": "PAYMENT_NOT_FOUND",
  "message": "The payment you're looking for doesn't exist or you don't have access to it.",
  "details": {
    "paymentId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

**400 Bad Request (Invalid Status Transition)**:
```json
{
  "errorCode": "INVALID_PAYMENT_STATUS_TRANSITION",
  "message": "This payment status transition is not allowed.",
  "details": {
    "currentStatus": "PAID",
    "newStatus": "PENDING"
  }
}
```

**403 Forbidden**:
```json
{
  "errorCode": "INSUFFICIENT_PERMISSIONS",
  "message": "You don't have permission to perform this action.",
  "details": {
    "requiredRoles": ["COMPANY_ADMIN", "MANAGER"]
  }
}
```

---

## Business Rules

### 1. Immutability

- **Amount**, **paymentDate**, and **paymentMethod** cannot be changed after creation
- Only **notes**, **attachmentUrl**, and **period** can be updated
- Status can only transition forward (with exceptions for REFUNDED)

### 2. Payment Date Validation

- Payment date cannot be in the future (configurable, but defaults to no future dates)

### 3. Status Transitions

**Allowed Transitions**:
- `PENDING` → `PAID`, `FAILED`, `CANCELLED`
- `PAID` → `REFUNDED` (via reversal)
- Cannot go backwards (e.g., `PAID` → `PENDING`)

### 4. Deletion Rules

- Only `PENDING` or `CANCELLED` payments can be deleted
- `PAID` or `REFUNDED` payments cannot be deleted (use reversal instead)

### 5. Reversal Rules

- Only `PAID` payments can be reversed
- Reversal creates a new payment with negative amount
- Original payment status is updated to `REFUNDED`

### 6. Company Scoping

- All payments must belong to a company
- Users can only access payments in their companies
- Super admins can access all payments

### 7. Lease Requirement

- Every payment must be linked to a lease
- Lease must exist and be active

---

## Access Control

### Role-Based Permissions

| Role | Create | View | Update | Reverse | Delete | Balance |
|------|--------|------|--------|---------|--------|---------|
| `SUPER_ADMIN` | ✅ | ✅ (all) | ✅ | ✅ | ✅ | ✅ |
| `COMPANY_ADMIN` | ✅ | ✅ (company) | ✅ | ✅ | ✅ | ✅ |
| `MANAGER` | ✅ | ✅ (company) | ✅ | ✅ | ✅ | ✅ |
| `LANDLORD` | ✅ | ✅ (company) | ❌ | ❌ | ❌ | ✅ |
| `TENANT` | ❌ | ✅ (own only) | ❌ | ❌ | ❌ | ✅ (own) |
| `STAFF` | ❌ | ✅ (company) | ❌ | ❌ | ❌ | ✅ |

### View Access Rules

- **Tenants**: Can only view their own payments
- **Other roles**: Can view payments in their companies
- **Super admins**: Can view all payments across all companies

---

## Common Use Cases

### Use Case 1: Record a Rent Payment

```javascript
// 1. Create payment
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leaseId: 'lease-uuid',
    amount: 1500.00,
    currency: 'KES',
    paymentDate: '2024-01-15',
    paymentMethod: 'CASH',
    paymentType: 'RENT',
    period: '2025-03',
    reference: 'TXN-123456',
    notes: 'Monthly rent payment for March 2025'
  })
});

// 2. Update status to PAID
await fetch(`/api/v1/payments/${paymentId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'PAID'
  })
});
```

### Use Case 2: Reverse a Payment

```javascript
// Reverse a paid payment
const response = await fetch(`/api/v1/payments/${paymentId}/reverse`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Payment made in error',
    notes: 'Customer requested refund due to duplicate payment'
  })
});
```

### Use Case 3: Get Tenant Payment History

```javascript
// Get payment history for a tenant
const response = await fetch(`/api/v1/payments/tenant/${tenantId}/history`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: payments } = await response.json();
```

### Use Case 4: Get Lease Balance

```javascript
// Get balance for a lease
const response = await fetch(`/api/v1/payments/lease/${leaseId}/balance`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: balance } = await response.json();
console.log(`Total Paid: ${balance.totalPaid}`);
console.log(`Net Balance: ${balance.netBalance}`);
```

### Use Case 5: List Payments with Filters

```javascript
// List paid rent payments for a tenant in date range
const params = new URLSearchParams({
  tenantId: 'tenant-uuid',
  status: 'PAID',
  paymentType: 'RENT',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  page: '1',
  limit: '10',
  sortBy: 'paymentDate',
  sortOrder: 'DESC'
});

const response = await fetch(`/api/v1/payments?${params}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: payments, pagination } = await response.json();
```

### Use Case 6: Mark Payment as Failed

```javascript
// Mark a pending payment as failed
const response = await fetch(`/api/v1/payments/${paymentId}/mark-failed`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Response Fields Reference

### Payment Response DTO

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Payment ID |
| `companyId` | UUID | Company ID |
| `tenantId` | UUID | Tenant user ID |
| `tenantName` | string | Tenant name (derived) |
| `leaseId` | UUID | Lease ID |
| `leaseNumber` | string | Lease number (derived) |
| `amount` | number | Payment amount |
| `currency` | string | Currency code (default: "KES") |
| `paymentDate` | date | Payment date |
| `paymentMethod` | enum | Payment method |
| `paymentType` | enum | Payment type |
| `status` | enum | Payment status |
| `reference` | string | Reference/receipt/transaction code |
| `recordedBy` | UUID | User ID who recorded the payment |
| `period` | string | Period for rent payments (e.g., "2025-03") |
| `notes` | string | Payment notes |
| `isPartial` | boolean | Whether this is a partial payment |
| `balanceAfter` | number | Balance after this payment (snapshot) |
| `attachmentUrl` | string | Receipt/image/PDF attachment URL |
| `isActive` | boolean | Whether the payment is active |
| `createdAt` | datetime | Created timestamp |
| `updatedAt` | datetime | Updated timestamp |
| `tenantBalance` | number | Tenant balance (computed) |
| `leaseBalance` | number | Lease balance (computed) |
| `lastPaymentDate` | date | Last payment date (computed) |
| `isOverdue` | boolean | Whether payment is overdue (computed) |

---

## Notes for Frontend Developers

### 1. Payment Status Workflow

When displaying payments, consider the status workflow:

```
PENDING → [User confirms] → PAID
PENDING → [Payment fails] → FAILED
PENDING → [User cancels] → CANCELLED
PAID → [Reversal] → REFUNDED (creates negative payment)
```

### 2. Immutability UI Considerations

- **Disable editing** of amount, paymentDate, and paymentMethod after creation
- **Show warning** when attempting to edit completed payments
- **Provide reversal option** instead of edit for paid payments

### 3. Balance Display

- Balances are computed on-the-fly, so they're always up-to-date
- Use `tenantBalance` and `leaseBalance` from payment responses
- For detailed breakdowns, use the balance endpoints

### 4. Partial Payments

- Set `isPartial: true` when recording partial payments
- Track partial payments separately in UI
- Consider showing "Partial Payment" badge

### 5. Receipt Attachments

- Store receipt URLs in `attachmentUrl` field
- Display receipt links/thumbnails in payment details
- Allow updating attachment URL after payment creation

### 6. Period Field

- Use `period` field for rent payments (format: "YYYY-MM")
- Helps group rent payments by month
- Useful for generating rent statements

### 7. Error Handling

- Always check `errorCode` in error responses
- Display user-friendly messages from `message` field
- Use `details` object for additional context

### 8. Pagination

- Default page size is 10, max is 100
- Use pagination metadata to build pagination controls
- Consider implementing infinite scroll for mobile

### 9. Date Formatting

- All dates are in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
- Format dates according to user locale
- Payment dates are date-only (no time component)

### 10. Currency Handling

- Default currency is "KES" (Kenyan Shilling)
- Format amounts according to currency
- Display currency symbol/code appropriately

---

## Testing Endpoints

### Swagger Documentation

All endpoints are documented in Swagger UI at:
```
http://your-api-url/api/docs
```

### Postman Collection

For testing, you can use the following base structure:

```
Base URL: http://your-api-url/api/v1/payments
Headers:
  Authorization: Bearer {your-jwt-token}
  Content-Type: application/json
```

---

## Support

For questions or issues:
1. Check this documentation first
2. Review error messages and codes
3. Contact the backend team for clarification

---

**Last Updated**: 2024-01-15
**API Version**: v1

