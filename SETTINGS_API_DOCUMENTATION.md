# Settings API Documentation

This document describes the Settings and Payment Methods APIs for the PMS backend.
All endpoints are **versioned** and require authentication.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication & Company Context

All settings endpoints require an authenticated user. The company context is taken
from the JWT payload (`companyId`). For multi-company users, select a company first:

```
POST /auth/select-company
{
  "companyId": "<uuid>"
}
```

Send cookies or a bearer token:

```
Authorization: Bearer <access_token>
```

## Company Settings

Settings are stored in a dedicated `company_settings` table (1:1 with company).
Defaults are created automatically for every company.

### GET /settings/company
Returns the current company settings. This is the canonical route in Swagger.

### GET /companies/settings (legacy)
Alias for `/settings/company` (kept for backward compatibility).

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyId": "uuid",
    "timezone": "UTC",
    "defaultCurrency": "KES",
    "defaultPaymentFrequency": "MONTHLY",
    "defaultRentDueDay": 1,
    "defaultGracePeriodDays": 0,
    "gracePeriodDays": 0,
    "defaultLateFeeType": "FIXED",
    "lateFeeType": "FIXED",
    "defaultLateFeeValue": 0,
    "lateFeeValue": 0,
    "defaultProratedFirstMonth": false,
    "defaultLeaseTerm": null,
    "defaultInvitedRole": "TENANT",
    "staffCanRecordPayments": true,
    "staffCanApprovePayments": false,
    "staffCanInviteTenants": false,
    "allowedPaymentMethods": ["CASH", "BANK", "MPESA", "CARD", "CHECK", "OTHER"],
    "requirePaymentApproval": false,
    "allowPartialPayments": true,
    "allowAdvancePayments": true,
    "requirePaymentReference": false,
    "defaultEmailNotifications": true,
    "defaultSmsNotifications": true,
    "autoGenerateRentCycles": true,
    "autoApplyCredit": true,
    "autoApplyLateFees": true,
    "lateFeeEnabled": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### PATCH /settings/company
Update company settings (partial update). This is the canonical route in Swagger.

### PATCH /companies/settings (legacy)
Alias for `/settings/company` (kept for backward compatibility).

**Body (all fields optional)**
```json
{
  "timezone": "Africa/Nairobi",
  "defaultCurrency": "KES",
  "defaultPaymentFrequency": "MONTHLY",
  "defaultRentDueDay": 5,
  "defaultGracePeriodDays": 3,
  "defaultLateFeeType": "FIXED",
  "defaultLateFeeValue": 50,
  "defaultProratedFirstMonth": false,
  "defaultLeaseTerm": 12,
  "defaultInvitedRole": "TENANT",
  "staffCanRecordPayments": true,
  "staffCanApprovePayments": false,
  "staffCanInviteTenants": false,
  "allowedPaymentMethods": ["CASH", "BANK"],
  "requirePaymentApproval": false,
  "allowPartialPayments": true,
  "allowAdvancePayments": true,
  "requirePaymentReference": false,
  "defaultEmailNotifications": true,
  "defaultSmsNotifications": true,
  "autoGenerateRentCycles": true,
  "autoApplyCredit": true,
  "autoApplyLateFees": true,
  "lateFeeEnabled": false,

  // Canonical fields (recommended)
  "gracePeriodDays": 3,
  "lateFeeType": "PERCENT",
  "lateFeeValue": 10
}
```

#### Canonical field names
Use these fields going forward:
- `gracePeriodDays`
- `lateFeeType` (FIXED | PERCENT | PERCENTAGE | NONE)
- `lateFeeValue`

#### Deprecated aliases (still supported)
- `defaultGracePeriodDays`
- `defaultLateFeeType`
- `defaultLateFeeValue`

Aliases are mapped internally to canonical fields.

---

## Payment Methods

Payment methods are stored in a single `payment_methods` table:
- **Global methods**: `isGlobal = true` (system-defined, read-only for companies)
- **Company methods**: `isGlobal = false` (custom per company)

### Ordering
Returned order is deterministic:
1. Global methods first
2. Company methods next
3. Alphabetical by `name`

### GET /payment-methods
Returns **active** global + company methods for the current company.

**Query Params**
- `includeInactive=true` (optional) – include inactive methods for admin/debug

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "companyId": null,
      "name": "Cash",
      "code": "CASH",
      "isGlobal": true,
      "providerName": null,
      "instructions": null,
      "requiresReference": false,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /payment-methods
Create a **company** payment method.

**Body**
```json
{
  "name": "M-Pesa",
  "providerName": "Safaricom",
  "instructions": "Paybill 123456, account: Invoice ID",
  "requiresReference": true
}
```

### PATCH /payment-methods/:id
Update a **company** payment method.

**Body**
```json
{
  "name": "EVC Plus",
  "providerName": "Hormuud",
  "instructions": "Reference must match invoice ID",
  "requiresReference": true,
  "isActive": true
}
```

**Notes**
- Global methods **cannot** be updated.
- Company can only update its own methods.

### DELETE /payment-methods/:id
Soft-disable a **company** payment method (`isActive = false`).

**Notes**
- Global methods **cannot** be disabled or deleted.
- Soft-disabled methods **do not** appear in payment creation dropdowns.

---

## Payment Creation (Method Reference)

Payments reference `paymentMethodId` (UUID).

### Required Field
```json
{
  "paymentMethodId": "uuid"
}
```

Legacy enum `paymentMethod` is still accepted for backward compatibility,
but new integrations should always use `paymentMethodId`.

---

## Minimum Settings (MVP)

These settings are supported and safe to use:
- `defaultCurrency`
- `allowAdvancePayments`
- `gracePeriodDays`
- `lateFeeEnabled`
- `lateFeeType`
- `lateFeeValue`

---

## Guard Behavior

All settings and payment method endpoints enforce company access:
- **Company context required** (via JWT `companyId`)
- **Company admin** required for updates
```
