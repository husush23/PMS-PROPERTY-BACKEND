# Invoice (Rent Cycle) Creation and Payment Flow Guide

This guide walks you through the complete flow of creating an invoice (rent cycle) and processing payments for it.

## Table of Contents
1. [Creating a New Invoice](#creating-a-new-invoice)
2. [Paying an Invoice](#paying-an-invoice)
3. [Complete Flow Example](#complete-flow-example)
4. [Status Updates](#status-updates)
5. [Troubleshooting](#troubleshooting)

---

## Creating a New Invoice

### Automatic Creation (Recommended)

Invoices are **automatically created** when:
- A lease status changes to `ACTIVE` (first invoice)
- Monthly scheduled job runs (subsequent invoices)

**No manual action required** - the system handles this automatically.

### Manual Creation (Admin/Manager Only)

If you need to create an invoice manually:

**Endpoint:** `POST /api/v1/rent-cycles`

**Request Body:**
```json
{
  "leaseId": "uuid-of-lease",
  "period": "2024-01",           // Format: YYYY-MM
  "dueDate": "2024-01-15",        // Format: YYYY-MM-DD
  "lineItems": [
    {
      "type": "RENT",
      "amount": 1500.00,
      "description": "Monthly rent"
    },
    {
      "type": "UTILITY",
      "amount": 200.00,
      "description": "Utility costs"
    },
    {
      "type": "PET_RENT",
      "amount": 50.00,
      "description": "Pet rent"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid",
    "leaseId": "lease-uuid",
    "invoiceNumber": "INV-2024-01-001",
    "period": "2024-01",
    "dueDate": "2024-01-15",
    "totalAmountDue": 1750.00,
    "amountPaid": 0,
    "balance": 1750.00,
    "status": "PENDING",
    "lineItems": [...],
    "pagination": {...}
  },
  "message": "Rent cycle created successfully"
}
```

**Important Notes:**
- Only `COMPANY_ADMIN` or `MANAGER` roles can create invoices manually
- Invoice number is auto-generated
- `totalAmountDue` is calculated from line items
- Status starts as `PENDING` (before due date)

---

## Paying an Invoice

### Step 1: Get Invoice Details

**Endpoint:** `GET /api/v1/rent-cycles/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-2024-01-001",
    "totalAmountDue": 1750.00,
    "amountPaid": 0,
    "balance": 1750.00,
    "status": "DUE",
    "lineItems": [...],
    "paymentsCount": 0
  }
}
```

### Step 2: Create Payment

**Endpoint:** `POST /api/v1/payments`

**Request Body (Recommended - with rentCycleId):**
```json
{
  "leaseId": "lease-uuid",
  "rentCycleId": "invoice-uuid",        // ← Link to invoice (RECOMMENDED)
  "amount": 1750.00,
  "paymentDate": "2024-01-15",
  "paymentMethod": "BANK_TRANSFER",
  "paymentType": "RENT",
  "reference": "TXN-123456",
  "notes": "Full payment for January rent",
  "currency": "KES"
}
```

**Alternative (Auto-linking by period):**
If you don't have `rentCycleId`, provide `period` and the system will auto-link:
```json
{
  "leaseId": "lease-uuid",
  "period": "2024-01",                  // ← Used for auto-linking
  "amount": 1750.00,
  "paymentDate": "2024-01-15",
  "paymentMethod": "BANK_TRANSFER",
  "paymentType": "RENT",
  "reference": "TXN-123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid",
    "rentCycleId": "invoice-uuid",
    "amount": 1750.00,
    "status": "PAID",
    "paymentDate": "2024-01-15",
    ...
  },
  "message": "Payment created successfully"
}
```

### Step 3: Verify Invoice Status

**Endpoint:** `GET /api/v1/rent-cycles/:id`

**Response (after payment):**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-2024-01-001",
    "totalAmountDue": 1750.00,
    "amountPaid": 1750.00,              // ← Updated
    "balance": 0.00,                     // ← Updated
    "status": "PAID",                    // ← Updated
    "paymentsCount": 1                    // ← Updated
  }
}
```

---

## Complete Flow Example

### Scenario: Tenant pays January rent

#### 1. Invoice is automatically created (or manually created)

```bash
# Invoice created automatically when lease activates
# OR manually by admin:
POST /api/v1/rent-cycles
```

**Invoice Created:**
- Invoice Number: `INV-2024-01-001`
- Amount Due: `$1,750.00`
- Due Date: `2024-01-15`
- Status: `PENDING`

#### 2. Due date arrives (January 15)

The system automatically updates status to `DUE` when the due date arrives.

**Invoice Status:**
- Status: `DUE`
- Balance: `$1,750.00`

#### 3. Tenant makes payment

```bash
POST /api/v1/payments
{
  "leaseId": "lease-uuid",
  "rentCycleId": "invoice-uuid",  # From invoice detail page
  "amount": 1750.00,
  "paymentDate": "2024-01-15",
  "paymentMethod": "BANK_TRANSFER",
  "paymentType": "RENT",
  "reference": "TXN-123456"
}
```

#### 4. Invoice automatically updates

**Invoice Status After Payment:**
- Status: `PAID` ✅
- Amount Paid: `$1,750.00`
- Balance: `$0.00`
- Payments Count: `1`

#### 5. Verify payment

```bash
# Get invoice details
GET /api/v1/rent-cycles/:id

# Get payment details
GET /api/v1/payments/:id

# List all payments for this invoice
GET /api/v1/payments?rentCycleId=invoice-uuid
```

---

## Partial Payment Flow

### Scenario: Tenant pays $1,000 of $1,750 invoice

#### 1. Create partial payment

```json
POST /api/v1/payments
{
  "leaseId": "lease-uuid",
  "rentCycleId": "invoice-uuid",
  "amount": 1000.00,              // ← Partial amount
  "paymentDate": "2024-01-15",
  "paymentMethod": "BANK_TRANSFER",
  "paymentType": "RENT"
}
```

#### 2. Invoice status updates

**Invoice Status:**
- Status: `PARTIAL`
- Amount Paid: `$1,000.00`
- Balance: `$750.00`
- Payments Count: `1`

#### 3. Record additional payment

```json
POST /api/v1/payments
{
  "leaseId": "lease-uuid",
  "rentCycleId": "invoice-uuid",
  "amount": 750.00,               // ← Remaining amount
  "paymentDate": "2024-01-20",
  "paymentMethod": "CASH",
  "paymentType": "RENT"
}
```

#### 4. Invoice fully paid

**Invoice Status:**
- Status: `PAID` ✅
- Amount Paid: `$1,750.00`
- Balance: `$0.00`
- Payments Count: `2`

---

## Status Updates

### Invoice Status Flow

```
PENDING → DUE → OVERDUE
   ↓        ↓       ↓
  PAID    PAID    PAID
   ↑        ↑       ↑
PARTIAL  PARTIAL  PARTIAL
```

**Status Definitions:**
- **PENDING**: Invoice created, due date hasn't arrived
- **DUE**: Due date is today
- **OVERDUE**: Past due date + grace period, still has balance
- **PARTIAL**: Some payment received but balance remains
- **PAID**: Fully paid (balance = 0)

### Automatic Status Updates

The system automatically updates invoice status:
- **Daily at 1 AM**: Updates `PENDING` → `DUE` when due date arrives
- **Daily at 2 AM**: Updates `DUE` → `OVERDUE` after grace period
- **Immediately**: Updates status when payment is recorded

---

## Troubleshooting

### Issue: Invoice shows as DUE/OVERDUE even after payment

**Cause:** Payment not linked to invoice (`rentCycleId` is null)

**Solution:**
1. Check if payment has `rentCycleId`:
   ```bash
   GET /api/v1/payments/:payment-id
   ```

2. If `rentCycleId` is null, the system will now automatically find payments by `leaseId + period` (this fix was just implemented)

3. For existing unlinked payments, you can:
   - Create a new payment with `rentCycleId` specified
   - Or wait for the system to auto-link on next invoice fetch

### Issue: Invoice balance doesn't match payments

**Check:**
1. Verify payment `status` is not `REFUNDED`
2. Verify payment `isActive` is `true`
3. Verify payment `amount` is positive
4. Check if multiple payments exist for the invoice

**Query payments for invoice:**
```bash
GET /api/v1/payments?rentCycleId=invoice-uuid
```

### Issue: Can't create payment

**Common Causes:**
1. **Lease not active**: Only active leases can accept payments
2. **Payment amount exceeds amount due**: Check `amountDue` field
3. **Missing required fields**: Ensure `leaseId`, `amount`, `paymentDate`, `paymentMethod`, `paymentType` are provided
4. **Permission issue**: Only `COMPANY_ADMIN`, `MANAGER`, or `LANDLORD` can create payments

### Issue: Late fee not applied

**Check:**
1. Invoice must be `OVERDUE` (past due date + grace period)
2. Invoice must have remaining balance
3. Lease must have late fee configured (`lateFeeType !== NONE`)
4. Late fee can only be applied once per invoice

**Manual late fee application:**
```bash
POST /api/v1/rent-cycles/:id/apply-late-fee
```

---

## Best Practices

### 1. Always Link Payments to Invoices

**✅ Recommended:**
```json
{
  "rentCycleId": "invoice-uuid",  // Always provide this
  "leaseId": "lease-uuid",
  "amount": 1750.00
}
```

**❌ Not Recommended:**
```json
{
  "leaseId": "lease-uuid",
  "period": "2024-01",  // Relies on auto-linking
  "amount": 1750.00
}
```

### 2. Use Invoice Detail Page for Payments

When creating a payment from the invoice detail page:
- Pre-fill `rentCycleId` from the invoice
- Pre-fill `leaseId` from the invoice
- Pre-fill `amountDue` from invoice `totalAmountDue`
- Pre-fill `period` from invoice `period`

### 3. Verify Payment Linking

After creating a payment, verify it's linked:
```bash
GET /api/v1/rent-cycles/:id
# Check paymentsCount > 0
# Check amountPaid > 0
```

### 4. Handle Partial Payments

For partial payments:
- Create payment with partial amount
- Invoice status will be `PARTIAL`
- Create additional payments until balance is 0
- Invoice status will automatically update to `PAID`

### 5. Monitor Invoice Status

Regularly check invoice status:
- `GET /api/v1/rent-cycles/overdue` - Check overdue invoices
- `GET /api/v1/rent-cycles/upcoming` - Check upcoming invoices
- `GET /api/v1/rent-cycles?statuses=DUE,OVERDUE` - Filter by status

---

## API Endpoints Summary

### Invoice (Rent Cycle) Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/rent-cycles` | List all invoices |
| `GET` | `/api/v1/rent-cycles/upcoming` | Get upcoming invoices |
| `GET` | `/api/v1/rent-cycles/overdue` | Get overdue invoices |
| `GET` | `/api/v1/rent-cycles/lease/:leaseId` | Get invoices for lease |
| `GET` | `/api/v1/rent-cycles/:id` | Get invoice by ID |
| `POST` | `/api/v1/rent-cycles` | Create invoice (Admin/Manager) |
| `POST` | `/api/v1/rent-cycles/:id/apply-late-fee` | Apply late fee (Admin/Manager) |

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/payments` | Create payment |
| `GET` | `/api/v1/payments` | List payments |
| `GET` | `/api/v1/payments?rentCycleId=:id` | Get payments for invoice |
| `GET` | `/api/v1/payments/:id` | Get payment by ID |
| `PATCH` | `/api/v1/payments/:id` | Update payment |
| `POST` | `/api/v1/payments/:id/record` | Record additional payment |

---

## Quick Reference

### Invoice Status Calculation

```typescript
if (balance <= 0) → PAID
if (amountPaid > 0 && balance > 0) → PARTIAL
if (today < dueDate) → PENDING
if (today === dueDate) → DUE
if (today > dueDate + gracePeriod) → OVERDUE
else → DUE (within grace period)
```

### Payment Linking Priority

1. **Direct link**: Payment with `rentCycleId = invoice.id` ✅
2. **Auto-link**: Payment with `leaseId + period` matching invoice (if `rentCycleId` is null)
3. **No link**: Payment without matching criteria (won't affect invoice balance)

---

## Support

For issues or questions:
1. Check invoice status and payments via API
2. Verify payment `rentCycleId` is set
3. Check payment `status` and `isActive` fields
4. Review this guide's troubleshooting section
