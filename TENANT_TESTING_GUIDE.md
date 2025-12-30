# Tenant Module Testing Guide

## Prerequisites

- Server running with tenant module registered
- Valid JWT token for a COMPANY_ADMIN or MANAGER user
- Company ID available (from JWT context or explicitly provided)

## Setup

1. **Login as Company Admin/Manager**:
```bash
POST /api/v1/auth/login
{
  "email": "admin@example.com",
  "password": "password"
}
```

2. **Select Company** (if needed):
```bash
POST /api/v1/auth/select-company
{
  "companyId": "your-company-id"
}
```

## Test Scenarios

### 1. Invite Tenant (Creates User + Tenant Profile)

**Endpoint**: `POST /api/v1/tenants/invite`

**Request**:
```json
{
  "email": "tenant@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1234567891"
}
```

**Expected**:
- Status: `201 Created`
- Response: `{ "success": true, "message": "Tenant invitation sent successfully" }`
- User created with `isActive: false`
- TenantProfile created with `status: PENDING`
- Email sent with invitation link

**Verify**:
- Check database: `tenant_profiles` table should have new entry
- Check email inbox for invitation email

---

### 2. Accept Tenant Invitation

**Endpoint**: `POST /api/v1/tenants/accept-invitation`

**Prerequisites**: 
- **No authentication required** (public endpoint, token-based security)
- Use token from invitation email
- Token must be valid and not expired

**Request**:
```json
{
  "token": "invitation-token-from-email",
  "password": "SecurePassword123!"
}
```

**Expected**:
- Status: `200 OK`
- User created (if doesn't exist) or updated (if exists)
- User `isActive` set to `true`
- Password set/updated
- Invitation status set to `ACCEPTED`
- Tenant profile and UserCompany relationship properly linked
- Tenant can now login with the invitation email and password

**Note**: The user account is created/updated based on the invitation email, regardless of who accepts it. The token provides the security.

---

### 3. Create Tenant Directly

**Endpoint**: `POST /api/v1/tenants`

**Prerequisites**: 
- User can exist or not exist
- Password field is optional

**Request Options**:

**Option A: With Password (Direct Creation - User Can Login Immediately)**
```json
{
  "email": "new-tenant@example.com",
  "password": "SecurePassword123!",
  "name": "Jane Smith",
  "phone": "+1987654321",
  "address": "123 Main St",
  "city": "New York"
}
```

**Expected (Password Provided)**:
- Status: `201 Created`
- If user doesn't exist:
  - User created with `isActive: true` (active immediately)
  - Password set to provided value
  - TenantProfile created with status `PENDING`
  - UserCompany relationship created with TENANT role
  - **No invitation sent** - user can login immediately
- If user exists:
  - User password updated to provided value
  - User `isActive` set to `true` (activated)
  - TenantProfile created with status `PENDING`
  - UserCompany relationship created with TENANT role
  - **No invitation sent**

**Option B: Without Password (Invitation Flow)**
```json
{
  "email": "new-tenant@example.com",
  "name": "Jane Smith",
  "phone": "+1987654321"
}
```

**Expected (No Password)**:
- Status: `201 Created`
- If user doesn't exist:
  - User created with `isActive: false` (inactive state)
  - Temporary password generated (not usable)
  - TenantProfile created with status `PENDING`
  - UserCompany relationship created with TENANT role
  - Invitation automatically created and email sent
  - Tenant must accept invitation and set password to activate account
- If user exists:
  - TenantProfile created with status `PENDING`
  - UserCompany relationship created with TENANT role
  - No invitation sent (user already exists)

---

### 4. List Tenants (Admin/Manager View)

**Endpoint**: `GET /api/v1/tenants?companyId=xxx&page=1&limit=10`

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 10, max: 100)
- `search` (optional) - searches email, name, phone
- `status` (optional) - PENDING, ACTIVE, FORMER
- `sortBy` (optional) - name, email, createdAt, status, joinedAt
- `sortOrder` (optional) - ASC, DESC

**Example**:
```bash
GET /api/v1/tenants?search=john&status=PENDING&sortBy=name&sortOrder=ASC
```

**Expected**:
- Status: `200 OK`
- Returns paginated list of tenants
- Admins/Managers see all tenants in company

---

### 5. List Tenants (Tenant Self-View)

**Test as Tenant User**:
1. Login as tenant
2. Call `GET /api/v1/tenants`

**Expected**:
- Status: `200 OK`
- Returns only the tenant's own profile
- `pagination.total` = 1

---

### 6. Get Single Tenant

**Endpoint**: `GET /api/v1/tenants/:id`

**Admin/Manager**:
- Can view any tenant in their company

**Tenant**:
- Can only view own profile (`/tenants/:own-id`)
- Gets `403 Forbidden` if trying to view another tenant

**Expected**:
- Status: `200 OK`
- Full tenant details including user info

---

### 7. Update Tenant

**Endpoint**: `PATCH /api/v1/tenants/:id`

**Request**:
```json
{
  "phone": "+1555555555",
  "address": "456 New St",
  "notes": "Updated contact info",
  "tags": ["preferred", "pet_owner"]
}
```

**Access Control**:
- Tenant can update own profile
- Admin/Manager can update any tenant in company

**Expected**:
- Status: `200 OK`
- Returns updated tenant data

---

### 8. Delete Tenant (Soft Delete)

**Endpoint**: `DELETE /api/v1/tenants/:id`

**Access Control**: Only COMPANY_ADMIN/MANAGER

**Expected**:
- Status: `200 OK`
- TenantProfile status set to `FORMER`
- UserCompany relationship `isActive` set to `false`
- User entity remains (not deleted)

---

## Error Scenarios

### Test Duplicate Tenant Prevention

**Attempt**: Invite same email twice to same company

**Expected**: `409 Conflict`
```json
{
  "errorCode": "TENANT_ALREADY_EXISTS",
  "message": "This user is already a tenant in this company."
}
```

---

### Test Invalid Invitation Token

**Request**: `POST /api/v1/tenants/accept-invitation` with invalid token (no auth required)

**Expected**: `404 Not Found` or `400 Bad Request`
```json
{
  "errorCode": "TENANT_INVITATION_NOT_FOUND" | "TENANT_INVITATION_EXPIRED"
}
```

**Note**: This endpoint is public - no authentication token needed, only the invitation token.

---

### Test Tenant Accessing Other Tenant Data

**Test**: Tenant tries to access another tenant's profile

**Request**: `GET /api/v1/tenants/other-tenant-id` (as tenant user)

**Expected**: `403 Forbidden`
```json
{
  "errorCode": "CAN_ONLY_VIEW_OWN_TENANT_DATA",
  "message": "You can only view your own tenant information."
}
```

---

### Test Missing Company Context

**Request**: `GET /api/v1/tenants` without companyId in JWT or query

**Expected**: `400 Bad Request`
```json
{
  "errorCode": "COMPANY_CONTEXT_REQUIRED",
  "message": "Please select a company to continue."
}
```

---


## Quick Test Checklist

- [ ] Invite new tenant (creates user with isActive: false)
- [ ] Accept tenant invitation (public endpoint, no auth needed, sets password, activates account)
- [ ] Create tenant directly with password (user created active, can login immediately)
- [ ] Create tenant directly without password (automatically creates inactive user and sends invitation)
- [ ] Create tenant directly with existing user and password (updates password, activates user)
- [ ] Create tenant directly with existing user without password (no invitation sent)
- [ ] List tenants (admin sees all, tenant sees only self)
- [ ] Get tenant details (access control works)
- [ ] Update tenant (self and admin updates)
- [ ] Delete tenant (soft delete, status = FORMER)
- [ ] Test duplicate prevention (409 error)
- [ ] Test expired invitation (400 error)
- [ ] Test tenant accessing other tenant data (403 error)
- [ ] Test missing company context (400 error)

## Status Flow Testing

1. **Create Tenant** → Status should be `PENDING` (no lease yet)
2. **Create Lease** (future) → Status should update to `ACTIVE`
3. **End Lease** (future) → Status should update to `FORMER`

## Database Verification

After operations, verify in database:

```sql
-- Check tenant profile
SELECT * FROM tenant_profiles WHERE "userId" = 'user-id';

-- Check user company relationship
SELECT * FROM user_companies WHERE "userId" = 'user-id' AND "role" = 'TENANT';

-- Check invitation
SELECT * FROM tenant_invitations WHERE "email" = 'tenant@example.com';

-- Check user
SELECT id, email, "isActive" FROM users WHERE email = 'tenant@example.com';
```

## Notes

- **Accept Invitation**: This endpoint is **public** (no authentication required). Security is provided by the invitation token. The user account is created/updated based on the invitation email.
- **Create Tenant**: 
  - **With Password**: User is created/updated as active (`isActive: true`) and can login immediately. No invitation sent.
  - **Without Password**: 
    - If user doesn't exist: System automatically creates user in inactive state (`isActive: false`) and sends invitation email. Tenant must accept invitation and set password to activate.
    - If user exists: Tenant profile is created directly, no invitation sent.
- Password must be at least 8 characters long (if provided)
- Tenant invitations expire after 7 days
- Tenant status updates will be automatic when Lease module is integrated
- All tenant operations are company-scoped
- Super admin bypasses all access restrictions
