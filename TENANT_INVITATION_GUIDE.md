# Tenant Invitation Guide

## Overview

The tenant invitation system uses an **email-only** approach for inviting tenants. Admins only need to provide an email address when sending invitations. All profile data (name, password, contact info, address, etc.) is collected when the tenant accepts the invitation.

This approach:
- ✅ Faster invitation process (email only)
- ✅ Works seamlessly for both existing and new users
- ✅ Avoids outdated/wrong personal data
- ✅ Follows industry standards (Slack, Notion, Google Workspace)

## API Endpoints

### 1. Invite Tenant

**Endpoint:** `POST /api/v1/tenants/invite`  
**Auth:** Required (Company Admin, Manager, or Super Admin)

**Request Body:**
```json
{
  "email": "tenant@example.com",
  "companyId": "optional-for-super-admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tenant invitation sent successfully"
}
```

**What Happens:**
1. System checks if user exists with this email
2. If user doesn't exist → creates inactive user with temporary password
3. If user exists → uses existing user
4. Creates minimal tenant profile (status: PENDING)
5. Creates UserCompany relationship (role: TENANT)
6. Sends invitation email with token

---

### 2. Accept Invitation

**Endpoint:** `POST /api/v1/tenants/accept-invitation`  
**Auth:** Public (token-based)

**Request Body:**
```json
{
  "token": "invitation-token-from-email",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "phone": "+1234567890",
  "alternativePhone": "+1234567891",
  "dateOfBirth": "1990-01-15",
  "idNumber": "123-45-6789",
  "idType": "SSN",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "United States",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1234567892",
  "emergencyContactRelationship": "Spouse",
  "notes": "Prefers first floor units",
  "tags": ["preferred", "pet_owner"],
  "emailNotifications": true,
  "smsNotifications": true
}
```

**Required Fields:**
- `token` - Invitation token from email
- `password` - Minimum 8 characters
- `name` - Minimum 2 characters

**Optional Fields:**
- All other profile fields (phone, address, emergency contact, etc.)

**Response:**
```json
{
  "success": true,
  "message": "Tenant invitation accepted successfully"
}
```

**What Happens:**
1. Validates invitation token and checks expiration
2. If user doesn't exist → creates user with name and password
3. If user exists → updates password and name (if provided), activates user
4. Updates tenant profile with all provided fields
5. Ensures UserCompany relationship exists
6. Marks invitation as accepted

---

## Scenarios

### Scenario 1: New User Invitation

**Flow:**
1. Admin invites `newuser@example.com`
2. System creates:
   - Inactive user account (no name, temporary password)
   - Minimal tenant profile (PENDING status)
   - UserCompany relationship
3. Invitation email sent
4. User clicks link, fills out form with:
   - Password
   - Name
   - Optional profile fields
5. System:
   - Creates active user with name and password
   - Updates tenant profile with all provided data
   - Activates account

---

### Scenario 2: Existing User Invitation

**Flow:**
1. Admin invites `existing@example.com` (user already in system)
2. System:
   - Uses existing user account
   - Creates minimal tenant profile for this company
   - Creates UserCompany relationship
3. Invitation email sent
4. User clicks link, fills out form
5. System:
   - Updates user password and name (if provided)
   - Activates user account
   - Updates tenant profile with provided data
   - Links tenant profile to user

---

### Scenario 3: User Already Tenant in Company

**Flow:**
1. Admin tries to invite `tenant@example.com` who is already a tenant in this company
2. System returns error:
   ```json
   {
     "success": false,
     "error": {
       "code": "TENANT_ALREADY_EXISTS",
       "message": "Tenant already exists in this company"
     }
   }
   ```

---

### Scenario 4: Expired Invitation

**Flow:**
1. User tries to accept invitation after 7 days
2. System returns error:
   ```json
   {
     "success": false,
     "error": {
       "code": "TENANT_INVITATION_EXPIRED",
       "message": "Invitation has expired"
     }
   }
   ```

---

### Scenario 5: Already Accepted Invitation

**Flow:**
1. User tries to accept same invitation twice
2. System returns error:
   ```json
   {
     "success": false,
     "error": {
       "code": "TENANT_INVITATION_ALREADY_ACCEPTED",
       "message": "Invitation has already been accepted"
     }
   }
   ```

---

## Direct Tenant Creation (Alternative)

For cases where admins want to create tenants with full data immediately (bypassing invitation), use:

**Endpoint:** `POST /api/v1/tenants`  
**Auth:** Required (Company Admin, Manager, or Super Admin)

This endpoint accepts `CreateTenantDto` with all fields and creates an active tenant immediately (if password provided) or sends invitation (if password not provided).

---

## Tenant Status Flow

```
PENDING → Tenant invited, no lease yet
   ↓
ACTIVE  → Has an active lease
   ↓
FORMER  → All leases ended
```

Status is automatically managed based on active leases, but can be manually updated by admins/managers.

---

## Permissions

### Who Can Invite Tenants?
- **Super Admin** - Can invite to any company (must provide companyId)
- **Company Admin** - Can invite to their company
- **Manager** - Can invite to their company
- **Tenant** - Cannot invite tenants

### Who Can Accept Invitations?
- Anyone with a valid invitation token (public endpoint)

---

## Best Practices

1. **Always use email-only invitations** for better UX
2. **Collect profile data on acceptance** to ensure accuracy
3. **Handle existing users gracefully** - they can update their info during acceptance
4. **Set appropriate invitation expiration** (default: 7 days)
5. **Send clear invitation emails** with instructions

---

## Error Codes

| Code | Description |
|------|-------------|
| `TENANT_ALREADY_EXISTS` | User is already a tenant in this company |
| `TENANT_INVITATION_NOT_FOUND` | Invalid invitation token |
| `TENANT_INVITATION_EXPIRED` | Invitation has expired or been cancelled |
| `TENANT_INVITATION_ALREADY_ACCEPTED` | Invitation was already accepted |
| `INSUFFICIENT_PERMISSIONS` | User doesn't have permission to invite tenants |
| `COMPANY_NOT_FOUND` | Company ID is invalid |
| `COMPANY_CONTEXT_REQUIRED` | Company ID must be provided |

