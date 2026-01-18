# Finance Model & API Integration (Frontend)

This guide explains invoices, payments, credit, and accounting behavior **and** the API endpoints/payloads needed to build UI safely.

## Authentication & Envelope

- All endpoints use cookie auth: `access_token`.
- Responses generally follow:
```json
{
  "success": true,
  "data": { },
  "message": "optional",
  "pagination": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 }
}
```

## Core Concepts

- **Invoice (RentCycle)**: Legal rent obligation. Income is recognized at invoice creation, even if unpaid.
- **Payment**: Money received. Payments move cash but do **not** create income by themselves.
- **Credit Balance**: Advance payment/overpayment. A **liability** until applied or refunded.
- **Security Deposit**: Separate liability, isolated from credit balance.

## Invoice vs Payment vs Credit Balance

- Invoices exist only when a period has started.
- Payments can exist without invoices (advance).
- Advance payments increase `lease.creditBalance`.
- Credit applies only when a **new invoice** is generated.

## Outstanding Balance (What It Means)

Outstanding balance is the total unpaid amount across invoices that are:
- `DUE`, `OVERDUE`, or `PARTIAL`

It **excludes**:
- `PENDING` invoices (future periods)
- `VOID` invoices
- unused credit balance

## Why Future Invoices May Not Exist

Invoices are created only when `periodStartDate <= today`.  
Do **not** assume next month’s invoice exists.

## Data Models (API View)

### Lease (partial)

Key fields:
- `id`
- `tenantId`
- `companyId`
- `monthlyRent`
- `creditBalance` (liability)
- `nextRentDueDate` (nullable)

```json
{
  "id": "lease-123",
  "tenantId": "tenant-456",
  "companyId": "company-789",
  "monthlyRent": 1200,
  "creditBalance": 250.00,
  "nextRentDueDate": "2026-02-01"
}
```

### RentCycle / Invoice

Key fields:
- `id`, `leaseId`, `tenantId`, `companyId`
- `invoiceNumber`, `period`
- `periodStartDate`, `periodEndDate`, `dueDate`
- `totalAmountDue`, `amountPaid`, `balance`
- `status` (`PENDING`, `DUE`, `OVERDUE`, `PARTIAL`, `PAID`, `VOID`)

```json
{
  "id": "inv-001",
  "leaseId": "lease-123",
  "invoiceNumber": "INV-2026-02-001",
  "period": "2026-02",
  "periodStartDate": "2026-02-01",
  "periodEndDate": "2026-02-28",
  "dueDate": "2026-02-01",
  "totalAmountDue": 1200,
  "amountPaid": 400,
  "balance": 800,
  "status": "PARTIAL"
}
```

### Payment

Key fields:
- `id`, `leaseId`, `tenantId`
- `rentCycleId` (nullable)
- `paymentMethod` (includes `CREDIT` for auto-applied credit)
- `paymentType` (`RENT`, `DEPOSIT`, etc.)
- `amount`, `paymentDate`, `status`

Examples:
```json
{
  "id": "pay-100",
  "rentCycleId": "inv-001",
  "paymentMethod": "MPESA",
  "paymentType": "RENT",
  "amount": 400,
  "status": "PAID"
}
```
```json
{
  "id": "pay-101",
  "rentCycleId": "inv-001",
  "paymentMethod": "CREDIT",
  "paymentType": "RENT",
  "amount": 250,
  "status": "PAID"
}
```
```json
{
  "id": "pay-102",
  "rentCycleId": null,
  "paymentMethod": "BANK",
  "paymentType": "RENT",
  "amount": 300,
  "status": "PAID"
}
```

## API Endpoints

Base path (versioned): `/v1`

### Rent Cycles (Invoices)

`GET /v1/rent-cycles`  
Query params:
- `page`, `limit`
- `leaseId`, `tenantId`, `companyId`
- `statuses` (comma-separated)
- `dueDateFrom`, `dueDateTo`
- `upcoming` (boolean)
- `invoiceType` (`all` | `rent` | `deposit`)
- `excludeVoided` (boolean)
- `sortBy`, `sortOrder`

`GET /v1/rent-cycles/upcoming`  
Returns due-today or future invoices (not paid).

`GET /v1/rent-cycles/overdue`

`GET /v1/rent-cycles/lease/:leaseId`

`GET /v1/rent-cycles/:id`

`POST /v1/rent-cycles` (admin/manager)  
Body:
```json
{
  "leaseId": "uuid",
  "period": "2026-01",
  "dueDate": "2026-01-05",
  "lineItems": [
    { "type": "RENT", "amount": 1200, "description": "Monthly rent" }
  ]
}
```

`POST /v1/rent-cycles/:id/apply-late-fee` (admin/manager)

### Payments

`POST /v1/payments` (admin/manager/landlord)  
Body:
```json
{
  "leaseId": "uuid",
  "rentCycleId": "uuid (optional)",
  "amount": 1500,
  "amountDue": 1500,
  "currency": "KES",
  "paymentDate": "2026-01-15",
  "dueDate": "2026-01-15",
  "paymentMethod": "MPESA",
  "paymentType": "RENT",
  "reference": "TXN-123",
  "period": "2026-01",
  "notes": "Jan rent"
}
```

`GET /v1/payments`  
Query params:
- `page`, `limit`
- `tenantId`, `leaseId`, `rentCycleId`, `companyId`
- `status`, `paymentType`, `paymentMethod`
- `startDate`, `endDate`
- `sortBy`, `sortOrder`

`GET /v1/payments/:id`

`PATCH /v1/payments/:id` (admin/manager)  
Limited fields: `notes`, `attachmentUrl`, `period`, `status`

`POST /v1/payments/:id/reverse` (admin/manager)

`POST /v1/payments/:id/mark-failed` (admin/manager)

`DELETE /v1/payments/:id` (admin/manager)

`GET /v1/payments/tenant/:tenantId/balance?companyId=...`  
Returns totals by type plus `netBalance` for the tenant.

`GET /v1/payments/lease/:leaseId/balance`

`GET /v1/payments/tenant/:tenantId/history`

`GET /v1/payments/lease/:leaseId/history`

Scheduler (admin/manager):
- `POST /v1/payments/scheduler/generate-monthly`
- `POST /v1/payments/scheduler/check-due`
- `POST /v1/payments/scheduler/check-overdue`

### Accounting

There are **no** direct accounting endpoints.  
Accounting entries are created automatically when:
- An invoice is generated (Rent Income)
- A payment is received (Cash)
- Advance payments are made (Tenant Credit Liability)
- Credit is applied to an invoice (Debit Tenant Credit Liability)
- Deposits are received (Security Deposit Liability)

## User Flows

### Paying rent when an invoice exists
1. Call `POST /v1/payments` with `rentCycleId`.
2. Invoice status updates based on paid amount.
3. Cash entry is recorded. Income was already recognized at invoice creation.

### Paying rent in advance (no invoice)
1. Call `POST /v1/payments` without `rentCycleId`.
2. `lease.creditBalance` increases.
3. No invoice is created automatically.
4. Credit applies only when a new invoice is generated.

### What happens on due date
- If an invoice exists, its status transitions based on date and payments.
- If no invoice exists, nothing happens (future period not started).

### What happens when lease is terminated
- No new invoices are generated for future periods.
- Final partial invoice may exist only if the period started before termination.

## UI Guidelines

Show:
- **Outstanding Balance**: sum of DUE/OVERDUE/PARTIAL invoices only.
- **Credit Balance**: show as refundable credit (liability).
- **Invoice Status**: clearly show `PENDING` vs `DUE` vs `OVERDUE`.
- **Advance Payments**: label as “Advance payment / credit balance”.

Avoid:
- Computing balances on the frontend.
- Inferring income from payments.
- Assuming next invoice exists.

## Important Rules for Frontend

- Never assume a future invoice exists.
- Do not calculate balances locally; use API fields.
- Always treat `creditBalance` as refundable liability.
- Do not apply credit in the UI; credit is applied automatically on invoice generation.
- Deposits are separate from credit balance.

