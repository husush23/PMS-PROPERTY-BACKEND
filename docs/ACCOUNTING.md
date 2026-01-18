# Accounting (MVP) — Frontend Integration

This is the minimal accounting module for MVP UI integration.

## 1) Available Backend Endpoints

Accounting summary:
- `GET /v1/accounting/summary?companyId=...`
  - Returns: `totalRentInvoiced`, `totalPaymentsReceived`, `totalOutstanding`, `totalExpenses`, `tenantCreditLiability`, `netIncome`

Expenses:
- `GET /v1/expenses?companyId=...`
- `POST /v1/expenses`
- `GET /v1/expenses/summary?companyId=...`

## 2) Accounting Rules (Important)

- Rent income is recorded only at invoice creation.
- Credit balance is a tenant liability, not income.
- Credit auto-applies only when invoices are created.
- Expenses reduce net income only.
- Outstanding = `DUE` + `OVERDUE` invoices only.

## 3) Frontend Pages Structure

- `/dashboard/accounting`
  - Overview dashboard (uses `/accounting/summary`)
- `/dashboard/accounting/expenses`
  - Expense list + create expense

## 4) UI Constraints

- No ledger view yet.
- No manual journal entries.
- No editing/deleting rent-generated accounting data.

## 5) Data Sources

- Accounting summary → `/accounting/summary`
- Expenses → `/expenses` and `/expenses/summary`
- Rent, payments, credit → existing lease/invoice/payment APIs
