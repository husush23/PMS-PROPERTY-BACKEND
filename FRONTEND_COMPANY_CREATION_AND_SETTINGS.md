# Frontend: Create Company and Company Settings

This document describes the **Create Company** flow and how company settings are created and used. It is intended for frontend developers integrating with the PMS backend API.

## Overview

When a user creates a company via **POST /companies**, the backend:

- Creates the company and its **company_settings** in a single transaction.
- Applies **MVP default values** for settings on the backend (timezone, currency, payments, grace/late fees, automation, roles, notifications).
- Returns both **company id** and **settings id** in the response.

The frontend must **not** send or manage these default values; they are backend-owned.

---

## Create Company

**Endpoint:** `POST /api/v1/companies`

**Auth:** Bearer (JWT) or cookie `access_token`. The user may have no company yet (e.g. first-time setup).

### Request Body (CreateCompanyDto)

| Field     | Type   | Required | Description |
|----------|--------|----------|-------------|
| `name`   | string | Yes      | Company name (min 2 characters). |
| `slug`   | string | No       | URL-friendly identifier (lowercase letters, numbers, hyphens only). If omitted, the backend derives it from `name`. |
| `address`| string | No       | Company address. |
| `phone`  | string | No       | Company phone number. |
| `email`  | string | No       | Company email (must be valid if provided). |

**Example:**

```json
{
  "name": "Acme Property Management",
  "slug": "acme-property",
  "address": "123 Main St",
  "phone": "+1234567890",
  "email": "contact@acme.com"
}
```

### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-company",
    "name": "Acme Property Management",
    "slug": "acme-property",
    "address": "123 Main St",
    "phone": "+1234567890",
    "email": "contact@acme.com",
    "logo": null,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "settingsId": "uuid-of-company-settings"
  },
  "message": "Company created successfully"
}
```

- **`data.id`** – Company ID. Use for switching company context, deep links, etc.
- **`data.settingsId`** – Company settings ID; present **only** on create. Use if you need to reference settings by ID; normally you use **GET settings** by company context.

### Error Responses

| Status | Description |
|--------|-------------|
| **400** | Validation failed (e.g. invalid `name`, `slug`, or `email`). |
| **409** | Company with this slug already exists (e.g. retry with same slug). No duplicate company or settings is created. |

---

## What the Frontend Should Not Do

- **Do not** send default values for company_settings in the create-company request (there is no such body).
- **Do not** call a separate "create settings" or "init settings" endpoint after creating a company; settings are created automatically in the same transaction.
- **Do not** hardcode MVP defaults (timezone, currency, grace period, late fees, automation, etc.) in the frontend; use **GET** settings as the source of truth.

---

## Reading Settings After Company Creation

Settings are available **immediately** after create. Use one of:

- **GET /api/v1/companies/settings** – With company context (e.g. selected company / JWT `companyId`). Returns `{ success: true, data: CompanySettingsResponseDto }`.
- **GET /api/v1/settings/bootstrap** – Returns `{ settings, paymentMethods }` (recommended for app bootstrap).
- **GET /api/v1/settings/company** – Settings only.

Response `data` includes: `id`, `companyId`, `timezone`, `defaultCurrency`, `defaultGracePeriodDays`, `defaultLateFeeType`, `defaultLateFeeValue`, `lateFeeEnabled`, `allowedPaymentMethods`, payment/approval flags, automation flags, notification flags, and more. See the API docs (e.g. Swagger at `/api/docs`) for the full `CompanySettingsResponseDto` shape.

For how to **use** these settings in the UI (e.g. lease form defaults), see **FRONTEND_COMPANY_DEFAULTS_GUIDE.md**.

---

## Suggested Frontend Flow

1. User submits the create-company form with `name` (and optionally `slug`, `address`, `phone`, `email`).
2. Call **POST /api/v1/companies** with that body (no settings payload).
3. On **201**: store `data.id` (and optionally `data.settingsId`); set the current company context to `data.id`; redirect to dashboard or company-scoped view.
4. When loading the app or company-scoped screens, call **GET /api/v1/settings/bootstrap** (or **GET /api/v1/companies/settings** with company context) and use the returned settings as defaults for leases, payments, etc.
5. On **409**: show "Company with this slug already exists" and let the user change the slug or name.

---

## Summary

| Topic | Detail |
|-------|--------|
| Create company | `POST /api/v1/companies` with `name` (+ optional `slug`, `address`, `phone`, `email`). |
| Response | `data.id` (company), `data.settingsId` (settings), plus company fields. |
| Defaults | All company_settings defaults are applied by the backend; frontend does not send or manage them. |
| Settings after create | Use GET settings (e.g. `/companies/settings` or `/settings/bootstrap`) with company context; no extra "create settings" step. |
| Using settings in UI | See **FRONTEND_COMPANY_DEFAULTS_GUIDE.md**. |
