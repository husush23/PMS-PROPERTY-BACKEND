# API Changes Summary

This document summarizes recent changes to the Property Management System backend API.

## Table of Contents
- [Authentication Improvements](#authentication-improvements)
- [Tenant Invitation Flow](#tenant-invitation-flow)
- [Super Admin User Management](#super-admin-user-management)
- [Tenant Deletion Fix](#tenant-deletion-fix)

---

## Authentication Improvements

### Bearer Token Support for API Clients

**Problem**: API testing tools (Thunder Client, Postman) couldn't authenticate because the system only used HTTP-only cookies.

**Solution**: Added support for Bearer token authentication while maintaining cookie support for browsers.

**Changes**:
- JWT strategy now accepts tokens from `Authorization: Bearer <token>` header
- Login endpoint accepts `?return_token=true` query parameter or `X-Return-Token: true` header to return tokens in response body

**Usage**:
```bash
# Login with token in response
POST /api/v1/auth/login?return_token=true
Body: { "email": "user@example.com", "password": "password" }

# Use token in subsequent requests
GET /api/v1/properties
Header: Authorization: Bearer <your-token>
```

**Files Modified**:
- `src/modules/auth/strategies/jwt.strategy.ts`
- `src/modules/auth/auth.controller.ts`

---

## Tenant Invitation Flow

### Simplified Invitation Process

**Problem**: Inviting tenants required collecting all profile data upfront, which was cumbersome.

**Solution**: Split the process into two steps:
1. **Invite**: Only requires email address
2. **Accept**: Tenant provides all profile data when accepting invitation

**Changes**:

#### Invite Endpoint (`POST /api/v1/tenants/invite`)
- Now accepts only `email` (and optional `companyId` for super admins)
- Creates minimal tenant profile with `PENDING` status
- Sends invitation email with token

**Request Body**:
```json
{
  "email": "tenant@example.com",
  "companyId": "optional-for-super-admin"
}
```

#### Accept Invitation Endpoint (`POST /api/v1/tenants/accept-invitation`)
- Now accepts full profile data including:
  - `token` (required)
  - `password` (required)
  - `name` (required)
  - All optional profile fields (phone, address, emergency contact, etc.)

**Request Body**:
```json
{
  "token": "invitation-token",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St",
  // ... other optional fields
}
```

**Files Modified**:
- `src/modules/tenant/tenant.controller.ts`
- `src/modules/tenant/tenant.service.ts`
- `src/modules/tenant/dto/accept-tenant-invite.dto.ts`
- `src/modules/tenant/dto/invite-tenant.dto.ts` (new)

---

## Super Admin User Management

### Complete CRUD Operations

**Problem**: Super admins could only view and activate/deactivate users, but couldn't create, update, or delete users system-wide.

**Solution**: Added full CRUD operations for user management.

**New Endpoints**:

#### Create User
```
POST /api/v1/admin/users
```
- Creates user with optional company assignment
- Request body: `CreateAdminUserDto` (extends `CreateUserDto` with optional `companyId` and `role`)
- Automatically assigns user to company if `companyId` provided

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "companyId": "optional-company-uuid",
  "role": "TENANT"
}
```

#### Update User
```
PUT /api/v1/admin/users/:id
PATCH /api/v1/admin/users/:id
```
- Updates user details system-wide (email, password, name)
- Validates email uniqueness
- Hashes password if updated

**Request Body**:
```json
{
  "email": "newemail@example.com",
  "password": "NewPassword123!",
  "name": "Updated Name"
}
```

#### Delete User
```
DELETE /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id?hard=true
```
- **Soft delete (default)**: Sets `isActive: false`
- **Hard delete**: Permanently removes user from database (use `?hard=true`)
- Prevents deleting last super admin

**Files Modified**:
- `src/modules/admin/admin.controller.ts`
- `src/modules/admin/admin.service.ts`
- `src/modules/admin/dto/create-admin-user.dto.ts` (new)

---

## Tenant Deletion Fix

### Proper Soft Delete Handling

**Problem**: Deleted tenants (status `FORMER` with inactive `UserCompany`) were still accessible via `GET /api/v1/tenants/:id`.

**Solution**: Added validation in `findOne` method to check if tenant was deleted.

**Changes**:
- `findOne` now checks if `UserCompany` is inactive or status is `FORMER`
- Returns `404 Not Found` for deleted tenants
- Prevents accessing deleted tenant data

**Files Modified**:
- `src/modules/tenant/tenant.service.ts`

---

## Summary of New Features

### For API Testing
- ✅ Bearer token authentication support
- ✅ Login endpoint returns tokens when requested

### For Tenant Management
- ✅ Simplified invitation process (email only)
- ✅ Profile data collection on invitation acceptance
- ✅ Proper soft delete handling

### For Super Admin
- ✅ Create users system-wide
- ✅ Update user details
- ✅ Delete users (soft/hard)
- ✅ Optional company assignment during user creation

---

## Migration Notes

### Frontend Updates Required

1. **Authentication**: If using API clients, use `?return_token=true` on login and include `Authorization: Bearer <token>` header
2. **Tenant Invitation**: Update invitation form to only collect email address
3. **Tenant Acceptance**: Update acceptance form to collect all profile fields (name, password, contact info, etc.)

### Backend Compatibility

- All changes are backward compatible
- Cookie-based authentication still works for browsers
- Existing endpoints maintain their behavior
- New endpoints are additive only

---

## Testing Recommendations

1. **Authentication**: Test with Thunder Client/Postman using Bearer tokens
2. **Tenant Invitation**: Test full flow from invite to acceptance
3. **User Management**: Test all CRUD operations as super admin
4. **Tenant Deletion**: Verify deleted tenants return 404

---

*Last Updated: January 2026*

