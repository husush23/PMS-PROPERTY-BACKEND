# Lease and Payment Integration Guide

## Overview

This document describes the complete integration between Lease and Payment entities, including rent generation, due date tracking, overdue handling, and payment status management. This guide is intended for frontend developers implementing the lease and payment features.

---

## Table of Contents

1. [Lease Lifecycle](#lease-lifecycle)
2. [Payment Generation](#payment-generation)
3. [Payment Statuses](#payment-statuses)
4. [Due Date Calculation](#due-date-calculation)
5. [Overdue Handling](#overdue-handling)
6. [API Endpoints](#api-endpoints)
7. [Frontend Implementation Guide](#frontend-implementation-guide)
8. [Status Flow Diagrams](#status-flow-diagrams)

---

## Lease Lifecycle

### Lease Creation

When creating a lease, you can now specify additional fields for rent generation:

```typescript
{
  // ... existing lease fields
  "billingStartDate": "2025-12-04",      // When rent billing starts
  "proratedFirstMonth": false,            // Whether first month is prorated
  "rentDueDay": 5,                        // Day of month when rent is due (1-28)
  "paymentFrequency": "MONTHLY",           // Currently only MONTHLY supported
  "gracePeriodDays": 5,                   // Days after due date before late fee
  "lateFeeType": "FIXED",                 // FIXED, PERCENTAGE, or NONE
  "lateFeeValue": 50.00                   // Amount (FIXED) or percentage (PERCENTAGE)
}
```

**Important Notes:**
- `rentDueDay` must be between 1-28 (to handle months with different day counts)
- `billingStartDate` defaults to `startDate` if not provided
- `paymentFrequency` defaults to `MONTHLY`
- `lateFeeType` defaults to `FIXED`
- `gracePeriodDays` defaults to 0

### Lease Status Flow

```
DRAFT → ACTIVE → TERMINATED/EXPIRED
```

**When a lease is activated:**
1. Lease status changes to `ACTIVE`
2. Unit status changes to `OCCUPIED`
3. Tenant status is updated
4. **First payment is automatically generated** (if not already created)

---

## Payment Generation

### First Payment

The first payment is automatically created when a lease is activated. It includes:

- **Amount**: Monthly rent (or prorated if `proratedFirstMonth` is true)
- **Due Date**: Calculated from `billingStartDate` + `rentDueDay`
- **Status**: `PENDING` (or `DUE` if created on due date)
- **Period**: First billing period (e.g., "2025-12")

### Monthly Payments

Monthly payments are generated automatically by the system (via scheduled job or manual trigger):

- **Trigger**: When `nextRentDueDate` arrives or has passed
- **Frequency**: Based on `paymentFrequency` (currently monthly)
- **Amount**: Monthly rent + any additional charges (pet rent, utilities)
- **Due Date**: `nextRentDueDate` from the lease
- **Status**: `PENDING` (or `DUE` if due date is today)

### Payment Fields

Each payment record includes:

```typescript
{
  "id": "uuid",
  "leaseId": "uuid",
  "tenantId": "uuid",
  "amount": 40000,                    // Original payment amount
  "amountDue": 40000,                 // Expected amount for this period
  "amountPaid": 0,                    // Actual amount paid so far
  "balance": 40000,                   // Remaining balance (amountDue - amountPaid)
  "dueDate": "2026-01-05",           // When payment is due
  "paidAt": null,                     // Timestamp when fully paid (null if not paid)
  "status": "PENDING",                // Payment status
  "paymentType": "RENT",              // RENT, DEPOSIT, LATE_FEE, etc.
  "paymentMethod": "CASH",            // CASH, BANK_TRANSFER, etc.
  "period": "2025-12",                // Billing period (YYYY-MM)
  "lateFeeApplied": false,            // Whether late fee has been applied
  "isOverdue": false,                 // Computed: true if past due date
  "gracePeriodDays": 5,              // From lease
  // ... other fields
}
```

---

## Payment Statuses

### Status Definitions

| Status | Description | When It Occurs |
|--------|-------------|----------------|
| `PENDING` | Payment created but not yet due | Default status when payment is created before due date |
| `DUE` | Payment is due today | When `dueDate === today` and balance > 0 |
| `PARTIAL` | Partially paid | When `amountPaid > 0` but `balance > 0` |
| `PAID` | Fully paid | When `balance === 0` |
| `OVERDUE` | Past due date + grace period | When payment is not paid after grace period expires |
| `FAILED` | Payment failed | When payment processing fails |
| `REFUNDED` | Payment refunded | When a paid payment is refunded |
| `CANCELLED` | Payment cancelled | When payment is cancelled before processing |

### Status Transitions

```
PENDING → DUE (when due date arrives)
DUE → OVERDUE (after grace period expires)
DUE → PAID (when fully paid)
DUE → PARTIAL (when partially paid)
PARTIAL → PAID (when balance becomes 0)
OVERDUE → PAID (when fully paid)
OVERDUE → PARTIAL (when partially paid)
```

**Important:**
- Status automatically updates when fetching payments (real-time check)
- Status can be manually updated by admins/managers
- `DUE` status is automatically set when `dueDate === today`

---

## Due Date Calculation

### How Due Dates Are Calculated

1. **First Payment:**
   - Uses `billingStartDate` (or `startDate` if not provided)
   - Uses `rentDueDay` from lease
   - Formula: `billingStartDate` with day set to `rentDueDay`

2. **Subsequent Payments:**
   - Uses `nextRentDueDate` from lease
   - Updated after each payment generation
   - Formula: Previous due date + 1 month, with day set to `rentDueDay`

### Example

```typescript
// Lease configuration
billingStartDate: "2025-12-04"
rentDueDay: 5

// First payment due date: 2025-12-05
// Second payment due date: 2026-01-05
// Third payment due date: 2026-02-05
// etc.
```

### Edge Cases

- If `rentDueDay` is 31 and month has only 30 days → Uses last day of month
- If `rentDueDay` is 29-31 and month is February → Uses last day of February
- This is why `rentDueDay` is limited to 1-28

---

## Overdue Handling

### Grace Period

The grace period is the number of days after the due date before a payment is considered overdue:

```typescript
gracePeriodEnd = dueDate + gracePeriodDays
```

**Example:**
- Due Date: January 5, 2026
- Grace Period: 5 days
- Grace Period End: January 10, 2026
- Overdue After: January 11, 2026

### Late Fee Application

Late fees are automatically applied when a payment becomes overdue:

1. **FIXED Late Fee:**
   - Fixed amount added to `amountDue` and `balance`
   - Example: `lateFeeValue: 50.00` → Adds 50.00 to balance

2. **PERCENTAGE Late Fee:**
   - Percentage of `amountDue` added to balance
   - Example: `lateFeeValue: 5` → Adds 5% of amountDue to balance

3. **NONE:**
   - No late fee applied

**Important:**
- Late fee is applied only once per payment
- A separate `LATE_FEE` payment record is created for tracking
- Late fee is added to the original payment's balance

### Overdue Check Process

The system checks for overdue payments daily (via scheduled job):

1. Finds payments with status `PENDING`, `DUE`, or `PARTIAL`
2. Checks if `today > (dueDate + gracePeriodDays)`
3. Updates status to `OVERDUE`
4. Applies late fee if not already applied

---

## API Endpoints

### Lease Endpoints

#### Create Lease
```
POST /api/v1/leases
```

**Request Body:**
```json
{
  "tenantId": "uuid",
  "unitId": "uuid",
  "leaseType": "FIXED_TERM",
  "startDate": "2025-12-04",
  "endDate": "2026-12-31",
  "monthlyRent": 40000.00,
  "billingStartDate": "2025-12-04",
  "proratedFirstMonth": false,
  "gracePeriodDays": 5,
  "rentDueDay": 5,
  "paymentFrequency": "MONTHLY",
  "lateFeeType": "FIXED",
  "lateFeeValue": 50.00,
  "currency": "KES"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "DRAFT",
    "nextRentDueDate": null,  // Set after activation
    // ... other lease fields
  }
}
```

#### Activate Lease
```
POST /api/v1/leases/:leaseId/activate
```

**What Happens:**
- Lease status → `ACTIVE`
- Unit status → `OCCUPIED`
- **First payment is automatically generated**
- `nextRentDueDate` is set

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ACTIVE",
    "nextRentDueDate": "2026-01-05",  // Next due date
    // ... other fields
  }
}
```

#### Get Lease
```
GET /api/v1/leases/:leaseId
```

**Response includes:**
- `rentDueDay`: Day of month when rent is due
- `nextRentDueDate`: Next payment due date
- `paymentFrequency`: Payment frequency
- `lateFeeType`: Type of late fee
- `lateFeeValue`: Late fee amount/percentage

### Payment Endpoints

#### List Payments
```
GET /api/v1/payments?leaseId={leaseId}&status={status}&page=1&limit=10
```

**Query Parameters:**
- `leaseId` (optional): Filter by lease
- `tenantId` (optional): Filter by tenant
- `status` (optional): Filter by status (PENDING, DUE, OVERDUE, PAID, etc.)
- `paymentType` (optional): Filter by type (RENT, DEPOSIT, etc.)
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "leaseId": "uuid",
      "amountDue": 40000,
      "amountPaid": 0,
      "balance": 40000,
      "dueDate": "2026-01-05",
      "status": "DUE",
      "isOverdue": false,
      "lateFeeApplied": false,
      // ... other fields
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### Get Payment History for Lease
```
GET /api/v1/payments/lease/:leaseId/history
```

Returns all payments for a specific lease, ordered by date.

#### Get Lease Balance
```
GET /api/v1/payments/lease/:leaseId/balance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leaseId": "uuid",
    "totalPaid": 40000,
    "totalRefunded": 0,
    "netBalance": 40000,
    "byType": {
      "RENT": 40000
    },
    "lastPaymentDate": "2026-01-05"
  }
}
```

#### Create Payment (Manual)
```
POST /api/v1/payments
```

**Request Body:**
```json
{
  "leaseId": "uuid",
  "amount": 40000,
  "paymentDate": "2026-01-05",
  "paymentMethod": "CASH",
  "paymentType": "RENT",
  "amountDue": 40000,  // Optional, auto-calculated
  "dueDate": "2026-01-05",  // Optional, auto-calculated
  "period": "2026-01",
  "notes": "Payment notes"
}
```

#### Update Payment Status
```
PATCH /api/v1/payments/:paymentId
```

**Request Body:**
```json
{
  "status": "PAID",
  "notes": "Payment received"
}
```

**Allowed Status Transitions:**
- `PENDING` → `DUE`, `PAID`, `PARTIAL`, `OVERDUE`, `FAILED`, `CANCELLED`
- `DUE` → `PAID`, `PARTIAL`, `OVERDUE`, `PENDING`, `FAILED`, `CANCELLED`
- `PARTIAL` → `PAID`, `OVERDUE`, `DUE`, `PENDING`
- `OVERDUE` → `PAID`, `PARTIAL`, `DUE`, `PENDING`

#### Record Partial Payment
```
POST /api/v1/payments/:paymentId/record-payment
```

**Request Body:**
```json
{
  "amount": 20000,
  "paymentMethod": "CASH",
  "notes": "Partial payment"
}
```

Updates `amountPaid` and `balance`, sets status to `PARTIAL` or `PAID` automatically.

### Scheduler Endpoints (Admin/Manager Only)

#### Check Due Payments
```
POST /api/v1/payments/scheduler/check-due
```

Marks payments as `DUE` when their due date is today.

#### Check Overdue Payments
```
POST /api/v1/payments/scheduler/check-overdue
```

Marks payments as `OVERDUE` and applies late fees.

#### Generate Monthly Payments
```
POST /api/v1/payments/scheduler/generate-monthly
```

Generates monthly rent payments for all active leases.

---

## Frontend Implementation Guide

### Displaying Payment Status

#### Status Badge Colors

```typescript
const getStatusColor = (status: PaymentStatus) => {
  switch (status) {
    case 'PENDING':
      return 'gray';  // Not yet due
    case 'DUE':
      return 'orange';  // Due today - urgent
    case 'OVERDUE':
      return 'red';  // Past due - critical
    case 'PARTIAL':
      return 'yellow';  // Partially paid
    case 'PAID':
      return 'green';  // Fully paid
    case 'FAILED':
      return 'red';
    case 'REFUNDED':
      return 'blue';
    case 'CANCELLED':
      return 'gray';
    default:
      return 'gray';
  }
};
```

#### Status Labels

```typescript
const getStatusLabel = (status: PaymentStatus, isOverdue: boolean) => {
  if (isOverdue && status !== 'OVERDUE') {
    return 'Overdue';  // Use isOverdue flag for display
  }
  
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'DUE':
      return 'Due Today';
    case 'OVERDUE':
      return 'Overdue';
    case 'PARTIAL':
      return 'Partially Paid';
    case 'PAID':
      return 'Paid';
    case 'FAILED':
      return 'Failed';
    case 'REFUNDED':
      return 'Refunded';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
};
```

### Payment List Component

```typescript
interface PaymentListItem {
  id: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: PaymentStatus;
  isOverdue: boolean;
  lateFeeApplied: boolean;
  period: string;
}

// Display logic
const PaymentCard = ({ payment }: { payment: PaymentListItem }) => {
  const daysUntilDue = getDaysUntilDue(payment.dueDate);
  const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
  
  return (
    <Card>
      <CardHeader>
        <StatusBadge status={payment.status} isOverdue={payment.isOverdue} />
        <span>{payment.period}</span>
      </CardHeader>
      <CardBody>
        <div>
          <span>Amount Due: {formatCurrency(payment.amountDue)}</span>
          <span>Paid: {formatCurrency(payment.amountPaid)}</span>
          <span>Balance: {formatCurrency(payment.balance)}</span>
        </div>
        <div>
          <span>Due Date: {formatDate(payment.dueDate)}</span>
          {isDueSoon && <WarningBadge>Due Soon</WarningBadge>}
          {payment.isOverdue && <ErrorBadge>Overdue</ErrorBadge>}
        </div>
        {payment.lateFeeApplied && (
          <InfoBadge>Late Fee Applied</InfoBadge>
        )}
      </CardBody>
    </Card>
  );
};
```

### Lease Details Component

```typescript
const LeaseDetails = ({ leaseId }: { leaseId: string }) => {
  const { data: lease } = useGetLease(leaseId);
  const { data: payments } = useGetLeasePayments(leaseId);
  const { data: balance } = useGetLeaseBalance(leaseId);
  
  const upcomingPayment = payments?.find(
    p => p.status === 'PENDING' || p.status === 'DUE'
  );
  const overduePayments = payments?.filter(p => p.isOverdue);
  
  return (
    <div>
      <LeaseInfo lease={lease} />
      
      <BalanceSummary balance={balance} />
      
      {upcomingPayment && (
        <UpcomingPaymentCard payment={upcomingPayment} />
      )}
      
      {overduePayments && overduePayments.length > 0 && (
        <OverduePaymentsList payments={overduePayments} />
      )}
      
      <PaymentsHistory payments={payments} />
    </div>
  );
};
```

### Payment Form Component

```typescript
const PaymentForm = ({ paymentId }: { paymentId: string }) => {
  const { data: payment } = useGetPayment(paymentId);
  
  const handleRecordPayment = async (amount: number) => {
    // Record partial or full payment
    await recordPayment(paymentId, {
      amount,
      paymentMethod: 'CASH',
      notes: 'Payment recorded'
    });
    
    // Refresh payment data
    refetch();
  };
  
  return (
    <Form>
      <div>
        <label>Amount Due: {formatCurrency(payment.amountDue)}</label>
        <label>Amount Paid: {formatCurrency(payment.amountPaid)}</label>
        <label>Balance: {formatCurrency(payment.balance)}</label>
      </div>
      
      {payment.balance > 0 && (
        <PaymentInput
          maxAmount={payment.balance}
          onSubmit={handleRecordPayment}
        />
      )}
      
      {payment.status === 'DUE' && (
        <Alert type="warning">
          Payment is due today. Please process payment.
        </Alert>
      )}
      
      {payment.isOverdue && (
        <Alert type="error">
          Payment is overdue. Late fee may apply.
        </Alert>
      )}
    </Form>
  );
};
```

### Dashboard Widgets

#### Upcoming Payments Widget

```typescript
const UpcomingPaymentsWidget = () => {
  const { data: payments } = useGetPayments({
    status: 'PENDING',
    startDate: today,
    endDate: addDays(today, 7),  // Next 7 days
    sortBy: 'dueDate',
    sortOrder: 'ASC'
  });
  
  return (
    <Widget title="Upcoming Payments">
      {payments?.map(payment => (
        <PaymentItem
          key={payment.id}
          payment={payment}
          highlight={payment.status === 'DUE'}
        />
      ))}
    </Widget>
  );
};
```

#### Overdue Payments Widget

```typescript
const OverduePaymentsWidget = () => {
  const { data: payments } = useGetPayments({
    status: 'OVERDUE',
    sortBy: 'dueDate',
    sortOrder: 'ASC'
  });
  
  return (
    <Widget title="Overdue Payments" alert>
      {payments?.map(payment => (
        <PaymentItem
          key={payment.id}
          payment={payment}
          showLateFee={payment.lateFeeApplied}
        />
      ))}
    </Widget>
  );
};
```

### Utility Functions

```typescript
// Calculate days until due
const getDaysUntilDue = (dueDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Check if payment is due soon (within 3 days)
const isDueSoon = (dueDate: string): boolean => {
  const daysUntilDue = getDaysUntilDue(dueDate);
  return daysUntilDue >= 0 && daysUntilDue <= 3;
};

// Format currency
const formatCurrency = (amount: number, currency: string = 'KES'): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Get payment status priority for sorting
const getStatusPriority = (status: PaymentStatus): number => {
  const priorities = {
    'OVERDUE': 1,
    'DUE': 2,
    'PARTIAL': 3,
    'PENDING': 4,
    'PAID': 5,
    'FAILED': 6,
    'REFUNDED': 7,
    'CANCELLED': 8
  };
  return priorities[status] || 9;
};
```

---

## Status Flow Diagrams

### Payment Status Flow

```
                    ┌─────────┐
                    │ PENDING │
                    └────┬────┘
                         │
                         │ (dueDate === today)
                         ▼
                    ┌─────────┐
                    │   DUE   │
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        │                │                │
        ▼                ▼                ▼
   ┌────────┐      ┌──────────┐    ┌──────────┐
   │  PAID  │      │  PARTIAL │    │ OVERDUE  │
   └────────┘      └─────┬────┘    └─────┬────┘
                         │                │
                         │                │
                         ▼                ▼
                    ┌────────┐      ┌──────────┐
                    │  PAID  │      │   PAID   │
                    └────────┘      └──────────┘
```

### Lease Activation Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Create Lease (Status: DRAFT)                 │
│    - Set rentDueDay, billingStartDate, etc.       │
│    - No payment created yet                      │
└──────────────────┬──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 2. Activate Lease                               │
│    - Status: DRAFT → ACTIVE                     │
│    - Unit: AVAILABLE → OCCUPIED                 │
│    - Tenant status updated                      │
└──────────────────┬──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 3. First Payment Generated Automatically         │
│    - amountDue = monthlyRent                    │
│    - dueDate = billingStartDate + rentDueDay    │
│    - status = PENDING (or DUE if today)         │
│    - nextRentDueDate updated on lease           │
└─────────────────────────────────────────────────┘
```

### Overdue Process Flow

```
┌─────────────────────────────────────────────────┐
│ Payment with dueDate = 2026-01-05               │
│ Status: PENDING                                 │
└──────────────────┬──────────────────────────────┘
                    │
                    ▼ (Jan 5, 2026)
┌─────────────────────────────────────────────────┐
│ Status: PENDING → DUE                            │
│ (Automatic update when fetched or via scheduler)  │
└──────────────────┬──────────────────────────────┘
                    │
                    ▼ (Jan 6-10, 2026)
┌─────────────────────────────────────────────────┐
│ Status: DUE (within grace period)                │
│ Grace period: 5 days                             │
│ Grace period end: Jan 10, 2026                   │
└──────────────────┬──────────────────────────────┘
                    │
                    ▼ (Jan 11, 2026+)
┌─────────────────────────────────────────────────┐
│ Status: DUE → OVERDUE                            │
│ Late fee applied (if configured)                  │
│ - balance increased by lateFeeValue              │
│ - lateFeeApplied = true                          │
│ - Separate LATE_FEE payment record created      │
└─────────────────────────────────────────────────┘
```

---

## Best Practices

### 1. Real-time Status Updates

- Always fetch fresh payment data when displaying payment lists
- The `toResponseDto` method automatically updates status to `DUE` when fetching
- Consider polling or WebSocket updates for real-time status changes

### 2. Display Priority

- Show `OVERDUE` payments first (highest priority)
- Then `DUE` payments (urgent)
- Then `PENDING` payments sorted by `dueDate` (ascending)
- Finally `PAID` payments (lowest priority)

### 3. User Notifications

- Show notification when payment becomes `DUE`
- Show alert when payment becomes `OVERDUE`
- Display late fee information when `lateFeeApplied` is true

### 4. Payment Recording

- Always check `balance` before allowing payment input
- Validate payment amount doesn't exceed `balance`
- Show remaining balance after partial payment
- Update UI immediately after recording payment

### 5. Date Handling

- Always use UTC dates for API calls
- Format dates according to user's locale
- Show relative dates (e.g., "Due in 3 days", "Overdue by 5 days")
- Highlight payments due within 3 days

### 6. Error Handling

- Handle cases where payment doesn't exist
- Handle cases where lease is not active
- Show appropriate error messages for invalid status transitions
- Validate payment amounts before submission

---

## Testing Checklist

### Lease Creation
- [ ] Create lease with all new fields
- [ ] Verify `nextRentDueDate` is null initially
- [ ] Verify first payment is created on activation
- [ ] Verify `nextRentDueDate` is set after activation

### Payment Status
- [ ] Verify `PENDING` status for future payments
- [ ] Verify `DUE` status when `dueDate === today`
- [ ] Verify `OVERDUE` status after grace period
- [ ] Verify status updates when fetching payments

### Payment Display
- [ ] Display correct status badge colors
- [ ] Show balance correctly
- [ ] Display due date prominently
- [ ] Show late fee indicator when applicable
- [ ] Highlight overdue payments

### Payment Actions
- [ ] Record full payment (status → PAID)
- [ ] Record partial payment (status → PARTIAL)
- [ ] Verify balance updates correctly
- [ ] Verify status transitions are valid

### Overdue Handling
- [ ] Trigger overdue check manually
- [ ] Verify late fee is applied
- [ ] Verify separate late fee payment record
- [ ] Display late fee in payment details

---

## Support

For questions or issues related to lease and payment integration, please contact the backend team or refer to the API documentation.

**Last Updated:** January 5, 2026

