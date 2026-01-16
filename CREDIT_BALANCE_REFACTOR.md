# Credit Balance Refactor Documentation

## Overview

This refactor introduces credit-based advance payments while preserving the existing rent cycle
status logic. Invoices now represent real rent obligations only and are generated only when the
rent period starts. Advance payments are stored on the lease as `creditBalance` and automatically
applied to due invoices.

## Core Rules (Enforced)

- Invoices represent real rent obligations only.
- Invoices are generated only when the period has started.
- Payments can be made at any time.
- Payments without invoices create `creditBalance`.
- Payments never auto-generate invoices.
- Outstanding amount includes only DUE/OVERDUE/PARTIAL invoices.
- PENDING, VOID, and future periods are excluded from outstanding.

## Data Model Changes

### Lease

Added:

- `creditBalance: number` (default 0)

Purpose:

- Stores advance payments
- Auto-applies to invoices when they become due
- Remains refundable on move-out

### Payment Method

Added enum value:

- `PaymentMethod.CREDIT`

Used for auto-applied credit transactions.

## Invoice Generation Behavior

Invoices are generated only when the rent period has started:

- A period is considered started when `periodStartDate <= today`.
- No future invoices are generated to allow advance payments.
- Backdated leases may generate multiple invoices, but only for already-started periods.

Period boundaries are always set on generated invoices:

- `periodStartDate`
- `periodEndDate`

## Credit Auto-Application

When a rent cycle is generated or checked by cron:

1. If `lease.creditBalance > 0` and invoice balance > 0
2. Apply credit up to the invoice balance
3. Create a payment record with `paymentMethod: CREDIT`
4. Reduce the lease `creditBalance`
5. Invoice becomes PAID if fully covered

Credit never applies to:

- VOID invoices
- Deposit invoices
- Future periods (period not started)

## Payment Creation Behavior

Two valid flows:

1. Payment linked to invoice
   - If `rentCycleId` is provided, payment is applied to the invoice.
   - Payments on VOID invoices are blocked.
2. Advance payment (no invoice)
   - If no invoice exists, payment is stored as `creditBalance`.
   - Payment is recorded without a `rentCycleId`.

Overpayments:

- Overpayment on an invoice remains on that invoice as negative balance.
- Advance payments without invoices increase `creditBalance`.

## Outstanding Balance Calculation

Outstanding balance is calculated from rent cycles only:

- Included: DUE, OVERDUE, PARTIAL
- Excluded: PENDING, PAID, VOID, CANCELLED

Future periods are excluded by definition because invoices are not created before the
period starts.

## Cron Behavior

Daily cron job:

- Generates invoices only if `periodStartDate <= today`
- Applies credit automatically
- Updates statuses (DUE -> OVERDUE via existing status logic)

Cron never:

- Generates future invoices
- Modifies credit except when applying to due invoices

## Lease Termination

When a lease is terminated:

- Outstanding balance is logged
- `creditBalance` is preserved and recorded in termination notes

No automatic refunds are issued in this refactor.

## API and UI Notes

- Block payment on VOID invoices
- Separate display of:
  - Outstanding balance (DUE/OVERDUE only)
  - Credit balance
  - Next rent due (informational only)

## Migration

Migration adds:

- `leases.creditBalance` column (default 0)
- `payments_paymentmethod_enum` includes `CREDIT`

## Testing Checklist

- Advance payment without invoice increases `creditBalance`
- Invoice created only when period starts
- Credit auto-applies to due invoice
- Outstanding excludes PENDING and VOID invoices
- Payment on VOID invoice is rejected
- Lease termination notes include credit balance

## Non-Goals

- Full accounting ledger
- Refund workflows
- Multi-currency credit handling
- Payment gateway callbacks

Add TODO comments where future expansion is expected.
