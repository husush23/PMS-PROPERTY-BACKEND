# Reports API Documentation

## Overview

The Reports API provides read-only, aggregated reporting data for dashboards and reports pages. All data is derived from existing entities (leases, rent cycles, payments, units, properties, tenants)—no new tables or accounting logic. Reports are company-scoped and intended for admin/manager use.

**Base URL**: `/api/v1/reports`

**Authentication**: JWT via HTTP-only cookie (`access_token`). Send credentials with each request (`credentials: 'include'` or `withCredentials: true`).

**Access**: Company-scoped. Requires **COMPANY_ADMIN** or **MANAGER** role. User must have an active company context (`companyId`). Super admin must select a company (or receives 400 if no company context).

---

## Table of Contents

- [Endpoints Summary](#endpoints-summary)
- [Financial Report](#financial-report)
- [Occupancy Report](#occupancy-report)
- [Tenants Report](#tenants-report)
- [Properties Report](#properties-report)
- [Response Format](#response-format)
- [Empty Data Behavior](#empty-data-behavior)
- [Error Handling](#error-handling)
- [Scenarios Quick Reference](#scenarios-quick-reference)

---

## Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/reports/financial` | GET | Financial aggregates (invoiced, collected, outstanding, breakdowns) |
| `/api/v1/reports/occupancy` | GET | Unit occupancy (total, occupied, vacant, list) |
| `/api/v1/reports/tenants` | GET | Tenant list with balances and summary |
| `/api/v1/reports/properties` | GET | Per-property metrics and summary |

All endpoints return `200 OK` with body `{ success: true, data: <report payload> }` when successful. Empty data returns zeroed summaries and empty arrays—never 404/500.

---

## Financial Report

**Path**: `GET /api/v1/reports/financial`

**Description**: Aggregated financial metrics for a date range: total invoiced, collected, outstanding, late fees, credits applied, refunds, net income, plus breakdowns by month, property, and payment method.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startDate` | string (YYYY-MM-DD) | No | First day of **current month** | Start of report period (inclusive). |
| `endDate` | string (YYYY-MM-DD) | No | Last day of **current month** | End of report period (inclusive). |
| `propertyId` | UUID | No | — | Restrict to leases under this property. |
| `currency` | string | No | Company default currency | Restrict monetary aggregates to this currency (e.g. `KES`, `USD`). |

### Scenarios

#### 1. No query params (default current month)

**Request**: `GET /api/v1/reports/financial`

**Behavior**: Uses first day of current month as `startDate` and last day of current month as `endDate`. All other filters omitted (all properties, company default currency).

**Example**: In January 2026, equivalent to `?startDate=2026-01-01&endDate=2026-01-31`.

---

#### 2. With date range only

**Request**: `GET /api/v1/reports/financial?startDate=2026-01-01&endDate=2026-12-31`

**Behavior**: Report for full year 2026. No property or currency filter.

---

#### 3. With property filter

**Request**: `GET /api/v1/reports/financial?startDate=2026-01-01&endDate=2026-12-31&propertyId=<uuid>`

**Behavior**: Same date range, but only invoices/payments for leases whose unit belongs to the given property.

---

#### 4. With currency filter

**Request**: `GET /api/v1/reports/financial?startDate=2026-01-01&endDate=2026-12-31&currency=USD`

**Behavior**: Only cycles and payments in `USD` are included in totals and breakdowns.

---

#### 5. Partial params (only startDate or only endDate)

**Request**: e.g. `GET /api/v1/reports/financial?startDate=2026-06-01`

**Behavior**: When one of `startDate` or `endDate` is omitted, the default (current month start/end) is used for the missing one. So this example uses `endDate` = last day of current month.

---

### Response Shape

```json
{
  "success": true,
  "data": {
    "totalInvoiced": 500000,
    "totalCollected": 480000,
    "outstandingBalance": 20000,
    "lateFeesCollected": 5000,
    "creditsApplied": 10000,
    "refunds": 0,
    "netIncome": 480000,
    "byMonth": [
      {
        "month": "2026-01",
        "totalInvoiced": 50000,
        "totalCollected": 48000,
        "outstandingBalance": 2000,
        "lateFeesCollected": 500,
        "creditsApplied": 1000,
        "refunds": 0,
        "netIncome": 48000
      }
    ],
    "byProperty": [
      {
        "propertyId": "uuid",
        "propertyName": "Building A",
        "totalInvoiced": 50000,
        "totalCollected": 48000,
        "outstandingBalance": 2000,
        "lateFeesCollected": 500,
        "creditsApplied": 1000,
        "refunds": 0,
        "netIncome": 48000
      }
    ],
    "byPaymentMethod": [
      {
        "paymentMethod": "MPESA",
        "totalCollected": 30000,
        "paymentCount": 50
      }
    ]
  }
}
```

- **netIncome**: `totalCollected - refunds`.
- **byMonth**: One entry per month that has invoice/payment activity in the range.
- **byProperty**: One entry per property that has activity (when no `propertyId` filter); when `propertyId` is set, typically one entry.
- **byPaymentMethod**: One entry per payment method used in the period.

---

## Occupancy Report

**Path**: `GET /api/v1/reports/occupancy`

**Description**: Unit-level occupancy as of a given date: total units, occupied/vacant counts, occupancy rate, average vacancy days, and a list of units with status and lease dates.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `asOfDate` | string (YYYY-MM-DD) | No | **Today** (server date) | Date at which occupancy is evaluated. |
| `propertyId` | UUID | No | — | Restrict to units in this property. |

### Scenarios

#### 1. No query params (current date, all properties)

**Request**: `GET /api/v1/reports/occupancy`

**Behavior**: Occupancy as of today for all units in the company.

---

#### 2. With asOfDate only

**Request**: `GET /api/v1/reports/occupancy?asOfDate=2026-06-15`

**Behavior**: Occupancy snapshot as of 2026-06-15 for all properties.

---

#### 3. With property filter

**Request**: `GET /api/v1/reports/occupancy?propertyId=<uuid>`

**Behavior**: Only units belonging to the given property; asOfDate defaults to today.

---

#### 4. With both asOfDate and propertyId

**Request**: `GET /api/v1/reports/occupancy?asOfDate=2026-06-15&propertyId=<uuid>`

**Behavior**: Occupancy for that property as of the given date.

---

### Response Shape

```json
{
  "success": true,
  "data": {
    "totalUnits": 50,
    "occupiedUnits": 42,
    "vacantUnits": 8,
    "occupancyRate": 84,
    "averageVacancyDays": 15,
    "units": [
      {
        "unitId": "uuid",
        "unitNumber": "101",
        "propertyId": "uuid",
        "propertyName": "Building A",
        "status": "occupied",
        "leaseStart": "2026-01-01",
        "leaseEnd": "2026-12-31"
      },
      {
        "unitId": "uuid",
        "unitNumber": "102",
        "propertyId": "uuid",
        "propertyName": "Building A",
        "status": "vacant",
        "leaseStart": null,
        "leaseEnd": null
      }
    ]
  }
}
```

- **occupancyRate**: Integer 0–100 (occupiedUnits / totalUnits * 100). Zero if totalUnits is 0.
- **averageVacancyDays**: For units vacant at `asOfDate`, average days since last lease end; 0 if none.
- **units[].status**: `"occupied"` if the unit has an active lease spanning `asOfDate`; otherwise `"vacant"`.
- **units[].unitNumber**: Unit identifier (e.g. "101", "A-2") for display.
- **units[].propertyName**: Property name for display; no extra lookup needed.

---

## Tenants Report

**Path**: `GET /api/v1/reports/tenants`

**Description**: List of tenants (users with leases in the company) with per-tenant aggregates (active leases, total paid, outstanding, credit balance, last payment/invoice dates) and summary counts (tenants with balance, with credit).

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `propertyId` | UUID | No | — | Only tenants with at least one lease under this property. |
| `status` | string | No | — | `active`: has at least one ACTIVE lease; `past`: no active lease. |
| `balanceStatus` | string | No | — | `owing`: outstandingBalance > 0; `credit`: creditBalance > 0; `settled`: no outstanding and no credit. |

### Scenarios

#### 1. No query params (all tenants)

**Request**: `GET /api/v1/reports/tenants`

**Behavior**: All tenants who have at least one lease in the company; no status or balance filter.

---

#### 2. Filter by property

**Request**: `GET /api/v1/reports/tenants?propertyId=<uuid>`

**Behavior**: Only tenants who have a lease on a unit in the given property.

---

#### 3. Filter by status (active or past)

**Request**: `GET /api/v1/reports/tenants?status=active`

**Behavior**: Only tenants with at least one ACTIVE lease.

**Request**: `GET /api/v1/reports/tenants?status=past`

**Behavior**: Only tenants with no active lease (expired/terminated only).

---

#### 4. Filter by balance status

**Request**: `GET /api/v1/reports/tenants?balanceStatus=owing`

**Behavior**: Only tenants with outstanding balance > 0.

**Request**: `GET /api/v1/reports/tenants?balanceStatus=credit`

**Behavior**: Only tenants with credit balance > 0.

**Request**: `GET /api/v1/reports/tenants?balanceStatus=settled`

**Behavior**: Only tenants with no outstanding and no credit.

---

#### 5. Combined filters

**Request**: `GET /api/v1/reports/tenants?propertyId=<uuid>&status=active&balanceStatus=owing`

**Behavior**: Tenants with an active lease in that property and with outstanding balance > 0.

---

### Response Shape

```json
{
  "success": true,
  "data": {
    "tenantsWithBalance": 5,
    "tenantsWithCredit": 2,
    "tenants": [
      {
        "tenantId": "uuid",
        "name": "John Doe",
        "activeLeaseCount": 1,
        "totalPaid": 120000,
        "outstandingBalance": 5000,
        "creditBalance": 0,
        "lastPaymentDate": "2026-01-15",
        "lastInvoiceDate": "2026-01-31"
      }
    ]
  }
}
```

- **tenantsWithBalance**: Count of tenants in the list with `outstandingBalance > 0`.
- **tenantsWithCredit**: Count with `creditBalance > 0`.
- Dates are YYYY-MM-DD or `null` when not applicable.

---

## Properties Report

**Path**: `GET /api/v1/reports/properties`

**Description**: Per-property metrics (units, occupancy, monthly rent potential, monthly collected, outstanding) plus an overall summary across the returned properties.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `propertyId` | UUID | No | — | Return only this property (single-property report). |

### Scenarios

#### 1. No query params (all properties)

**Request**: `GET /api/v1/reports/properties`

**Behavior**: All active properties in the company; each with its metrics; summary is the sum across all.

---

#### 2. Single property

**Request**: `GET /api/v1/reports/properties?propertyId=<uuid>`

**Behavior**: One property in `properties` array; `summary` reflects that single property.

---

### Response Shape

```json
{
  "success": true,
  "data": {
    "properties": [
      {
        "propertyId": "uuid",
        "name": "Building A",
        "totalUnits": 20,
        "occupiedUnits": 18,
        "vacantUnits": 2,
        "occupancyRate": 90,
        "monthlyRentPotential": 500000,
        "monthlyCollected": 450000,
        "outstandingBalance": 10000
      }
    ],
    "summary": {
      "totalUnits": 50,
      "occupiedUnits": 45,
      "vacantUnits": 5,
      "occupancyRate": 90,
      "monthlyRentPotential": 1200000,
      "monthlyCollected": 1100000,
      "outstandingBalance": 25000
    }
  }
}
```

- **monthlyRentPotential**: Sum of active-lease monthly rent for that property.
- **monthlyCollected**: Sum of payments in the **current calendar month** for leases in that property.
- **summary**: Totals over all items in `properties`; occupancyRate = total occupied / total units.

---

## Response Format

All successful responses:

```json
{
  "success": true,
  "data": { ... }
}
```

- No pagination on report endpoints; they return full aggregates/lists for the applied filters.
- Numeric amounts are raw numbers (e.g. `480000`), not formatted strings.
- Date strings are ISO date only: `YYYY-MM-DD`.

---

## Empty Data Behavior

When there is no data for the applied filters:

- **Financial**: `totalInvoiced`, `totalCollected`, `outstandingBalance`, etc. are `0`; `byMonth`, `byProperty`, `byPaymentMethod` are `[]`.
- **Occupancy**: `totalUnits`/`occupiedUnits`/`vacantUnits` = 0, `occupancyRate` = 0, `averageVacancyDays` = 0, `units` = `[]`.
- **Tenants**: `tenantsWithBalance`/`tenantsWithCredit` = 0, `tenants` = `[]`.
- **Properties**: `properties` = `[]`, `summary` has all numeric fields 0 and `occupancyRate` 0.

The API does **not** return 404 or 500 for empty result sets.

---

## Error Handling

| HTTP | Code / Cause | Response |
|------|----------------|----------|
| 400 | Missing company context (e.g. super admin without company) | `Company context is required for reports. Select a company first.` |
| 400 | Invalid query param (e.g. invalid UUID, invalid date format) | `VALIDATION_ERROR` with field-level messages. |
| 401 | Not authenticated | Standard auth error. |
| 403 | Not COMPANY_ADMIN or MANAGER, or no company access | Access denied. |
| 500 | Server/DB error (e.g. missing DB column) | `INTERNAL_SERVER_ERROR`; check `details.originalError` in response. |

---

## Scenarios Quick Reference

| Endpoint | No params | With params | Typical use |
|----------|-----------|-------------|-------------|
| **Financial** | Current month, all properties, default currency | `startDate`, `endDate`, `propertyId`, `currency` | Dashboard totals; date range + optional property/currency |
| **Occupancy** | Today, all properties | `asOfDate`, `propertyId` | Snapshot for one date and/or one property |
| **Tenants** | All tenants in company | `propertyId`, `status`, `balanceStatus` | Lists filtered by property/status/balance |
| **Properties** | All properties + summary | `propertyId` (single property) | Portfolio overview or single-property drill-down |

---

## Date and validation notes

- **Financial** `startDate` / `endDate`: Optional. If omitted, first/last day of **current month** (server time) is used. When provided, must be `YYYY-MM-DD`.
- **Occupancy** `asOfDate`: Optional. If omitted, **today** (server date) is used. When provided, must be `YYYY-MM-DD`.
- Query params are sent as query strings for GET (e.g. `?startDate=2026-01-01&endDate=2026-12-31`). Sending the same names in the request body of a GET has no effect; the API uses query only.
