# Payment Split Reporting (Frontend Labeling Guide)

## What changed
Payments are still stored as **one payment per `RentCycle`** (no DB allocation schema changes).

For reporting/UI, the backend now derives:
- `rentPaid` vs `utilityPaid` (proportional split)
- `invoiceRentTotal` vs `invoiceUtilityTotal` (derived from the invoice line items)
- `rentPortion` vs `utilityPortion` (shares used for the proportional allocation)

These values are computed from the linked invoice (`RentCycle.lineItems`):
- `invoiceRentTotal = sum(lineItems where type=RENT).amount`
- `invoiceUtilityTotal = sum(lineItems where type=UTILITY).amount`
- `rentPaid = payment.amountPaid * (invoiceRentTotal / (invoiceRentTotal + invoiceUtilityTotal))`
- `utilityPaid = payment.amountPaid - rentPaid`

## How to label payment entries
Use the split fields instead of relying only on `paymentType`.

Recommended labeling rule:
- If `utilityPaid > 0` and `rentPaid > 0` => **"Rent + Utility"**
- If `utilityPaid > 0` and `rentPaid == 0` => **"Utility payment"**
- Otherwise => **"Rent payment"**

Notes:
- Because `rentPaid/utilityPaid` are computed on the backend, small rounding differences can exist. If you see a value like `0.01`, consider treating it as zero in your UI threshold (e.g. `<= 0.005`).
- If `rentPaid` / `utilityPaid` are missing (`undefined`), fall back to existing UI logic based on `paymentType`.

## Example (response shape)
```ts
{
  paymentType: "RENT",
  amountPaid: 50000,
  invoiceRentTotal: 45000,
  invoiceUtilityTotal: 5000,
  rentPaid: 45000,
  utilityPaid: 5000
}
```

---

## OpenAPI / TypeScript types

- Run **`npm run openapi:export`** in `pms-backend` to write **`openapi/openapi.json`** (needs DB env; same as bootstrapping the app).
- Run **`npm run openapi:types`** to emit **`openapi/openapi.d.ts`** (`npx openapi-typescript`).
- Swagger UI: **`/{apiPrefix}/docs`** (e.g. `http://localhost:8000/api/docs`).
- Raw JSON while dev server runs: **`/{apiPrefix}/docs-json`**.

The OpenAPI description summarizes **error envelopes** (`success`, `error.code`, `error.message`, `error.details`) and **invoice number** conventions (`INV-…-RENT|UTILITY|DEPOSIT-…`).

---

## Rent cycle line items (`utilityReadingId`)

New UTILITY line items may include **`utilityReadingId`** (UUID of the billed `UtilityReading`). Use it for audit/drill-down to meter history; **legacy rows** may omit it (`null`). Do not assume it is always present for `type === 'UTILITY'`.

