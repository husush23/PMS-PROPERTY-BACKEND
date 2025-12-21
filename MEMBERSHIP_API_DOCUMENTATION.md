# Membership API Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Base Configuration](#base-configuration)
- [Core Concepts](#core-concepts)
- [API Routes](#api-routes)
- [Use Cases & Flow Diagrams](#use-cases--flow-diagrams)
- [Permissions & Access Control](#permissions--access-control)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Best Practices](#best-practices)

---

## Overview

This documentation covers all company membership management API endpoints for the Property Management System. The membership system supports:

- Email-based invitation system for adding users to companies
- Invitation acceptance flow for authenticated users
- Member listing and management
- Role management and updates
- Member removal

**Important**: All routes require JWT Bearer token authentication and company context (unless you're a super admin). Users must be members of the company to access most endpoints, with specific permissions required for certain operations.

---

## Base Configuration

### Base URL Structure
```
Base URL: http://localhost:8000/api/v1
```
*Note: The base URL may vary depending on your environment. Check with your backend team for the correct base URL.*

### API Versioning
All routes are versioned as `v1` in the URL path.

### Authentication Header Format
All routes require JWT token authentication:
```
Authorization: Bearer <your-jwt-token>
```

### Response Format
All responses follow this structure:
```json
{
  "success": true/false,
  "data": { ... },
  "message": "Response message"
}
```

---

## Core Concepts

### Invitation Flow

The membership system uses an email-based invitation workflow:

1. **Invite**: Company admin or manager sends an invitation by email
2. **Email Sent**: Invitation email is automatically sent with a unique token
3. **Accept**: User receives email, clicks link, and accepts invitation (must be authenticated)
4. **Member Added**: User becomes a member with the assigned role

### Invitation Statuses

Invitations can have the following statuses:

- **PENDING**: Invitation sent but not yet accepted
- **ACCEPTED**: Invitation has been accepted by the user
- **EXPIRED**: Invitation token has expired (after 7 days)
- **CANCELLED**: Invitation has been cancelled

### User Roles

The system supports the following user roles (from `UserRole` enum):

- **ADMIN**: System admin
- **COMPANY_ADMIN**: Company administrator (full company access)
- **MANAGER**: Property manager (can manage properties and units, invite users)
- **LANDLORD**: Landlord role
- **TENANT**: Tenant role
- **MAINTENANCE**: Maintenance staff role

### Company-Scoped Access

All membership operations are scoped to a specific company:

- Users must be members of the company to view members
- Only COMPANY_ADMIN and MANAGER roles can invite users
- Only COMPANY_ADMIN can update roles and remove members
- Super admins can perform all operations across all companies

### Invitation Tokens

- Unique UUID tokens are generated for each invitation
- Tokens expire after **7 days** from creation
- Tokens are included in invitation email URLs
- Format: `${FRONTEND_URL}/accept-invite?token=${token}`

### Multiple Invitations

For testing purposes, if an invitation is sent to an email that already has a pending invitation:

- The existing pending invitation is **updated** with a new token and expiration date
- This allows resending invitations without database cleanup
- Only one pending invitation per email per company can exist at a time

---

## API Routes

### 1. Invite User to Company

**Endpoint**: `POST /api/v1/companies/:id/invite-user`  
**Authentication**: Required (JWT + Company context)  
**Description**: Invite a user to join a company by email address. An invitation email will be sent automatically.

**Required Permissions**: COMPANY_ADMIN or MANAGER (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Company ID |

#### Request Body
```json
{
  "email": "user@example.com",
  "role": "MANAGER"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `email` | string | Yes | Valid email format | Email address of the user to invite |
| `role` | enum | Yes | UserRole enum value | Role to assign to the user in the company |

**Valid Role Values**: `ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `LANDLORD`, `TENANT`, `MAINTENANCE`

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Invitation sent successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed (invalid email or role)
- **403 Forbidden**: Insufficient permissions (not COMPANY_ADMIN or MANAGER)
- **404 Not Found**: Company not found
- **409 Conflict**: User is already a member or already invited

#### Example Request
```bash
curl -X POST http://localhost:8000/api/v1/companies/123e4567-e89b-12d3-a456-426614174000/invite-user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "role": "MANAGER"
  }'
```

---

### 2. Accept Invitation

**Endpoint**: `POST /api/v1/companies/:id/accept-invite`  
**Authentication**: Required (JWT)  
**Description**: Accept a company invitation using the invitation token. The user must be authenticated (logged in).

**Required Permissions**: Authenticated user (can accept invitations sent to their email)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Company ID |

#### Request Body
```json
{
  "token": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `token` | string | Yes | Valid UUID | Invitation token from the invitation email |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Invitation accepted successfully"
}
```

#### Error Responses
- **400 Bad Request**: 
  - Invitation expired
  - Invitation already accepted
  - Invitation already cancelled
  - Invalid token format
- **404 Not Found**: Invitation not found
- **409 Conflict**: User is already a member of the company

#### Example Request
```bash
curl -X POST http://localhost:8000/api/v1/companies/123e4567-e89b-12d3-a456-426614174000/accept-invite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

---

### 3. List Company Members

**Endpoint**: `GET /api/v1/companies/:id/members`  
**Authentication**: Required (JWT + Company context)  
**Description**: Get a list of all members in a company with their roles and membership details.

**Required Permissions**: Company member (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Company ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "MANAGER",
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "isActive": true
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "email": "admin@example.com",
      "name": "Jane Smith",
      "role": "COMPANY_ADMIN",
      "joinedAt": "2023-12-15T00:00:00.000Z",
      "isActive": true
    }
  ]
}
```

#### Response Schema
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | User unique identifier |
| `email` | string | User email address |
| `name` | string \| null | User full name |
| `role` | enum | User role in the company |
| `joinedAt` | datetime | Date when user joined the company |
| `isActive` | boolean | Whether the user is active in the company |

#### Error Responses
- **403 Forbidden**: User is not a member of this company
- **404 Not Found**: Company not found

#### Example Request
```bash
curl -X GET http://localhost:8000/api/v1/companies/123e4567-e89b-12d3-a456-426614174000/members \
  -H "Authorization: Bearer <token>"
```

---

### 4. Update Member Role

**Endpoint**: `PATCH /api/v1/companies/:id/members/:userId/role`  
**Authentication**: Required (JWT + Company context)  
**Description**: Update a member's role in the company.

**Required Permissions**: COMPANY_ADMIN only (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Company ID |
| `userId` | UUID | Yes | User ID to update |

#### Request Body
```json
{
  "role": "MANAGER"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `role` | enum | Yes | UserRole enum value | New role for the user in the company |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User role updated successfully"
}
```

#### Error Responses
- **400 Bad Request**: Invalid role value
- **403 Forbidden**: Only company administrators can update user roles
- **404 Not Found**: Company or user not found, or user is not a member

#### Example Request
```bash
curl -X PATCH http://localhost:8000/api/v1/companies/123e4567-e89b-12d3-a456-426614174000/members/223e4567-e89b-12d3-a456-426614174001/role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "MANAGER"
  }'
```

---

### 5. Remove Member from Company

**Endpoint**: `DELETE /api/v1/companies/:id/members/:userId`  
**Authentication**: Required (JWT + Company context)  
**Description**: Remove a user from the company. This operation is irreversible (user must be re-invited to rejoin).

**Required Permissions**: COMPANY_ADMIN only (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Company ID |
| `userId` | UUID | Yes | User ID to remove |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User removed from company successfully"
}
```

#### Error Responses
- **403 Forbidden**: Only company administrators can remove users
- **404 Not Found**: Company or user not found, or user is not a member

#### Example Request
```bash
curl -X DELETE http://localhost:8000/api/v1/companies/123e4567-e89b-12d3-a456-426614174000/members/223e4567-e89b-12d3-a456-426614174001 \
  -H "Authorization: Bearer <token>"
```

---

## Use Cases & Flow Diagrams

### Use Case 1: Inviting a New User

**Scenario**: A company admin wants to invite a new user to join the company.

**Steps**:
1. Admin calls `POST /api/v1/companies/:id/invite-user` with email and role
2. System validates permissions (admin must be COMPANY_ADMIN or MANAGER)
3. System checks if user is already a member
4. System creates invitation record with unique token (expires in 7 days)
5. System sends invitation email automatically
6. User receives email with acceptance link
7. User clicks link and is redirected to frontend
8. User logs in (if not already authenticated)
9. User accepts invitation via `POST /api/v1/companies/:id/accept-invite`
10. User becomes a member with assigned role

**Flow**:
```
Admin → POST /invite-user → System creates invitation → Email sent
                                                              ↓
User receives email → Clicks link → Frontend → User logs in → POST /accept-invite → Member added
```

---

### Use Case 2: Viewing Company Members

**Scenario**: A company member wants to see who is in their company.

**Steps**:
1. User calls `GET /api/v1/companies/:id/members`
2. System validates user is a member of the company
3. System returns list of all members with roles and join dates
4. Frontend displays member list

---

### Use Case 3: Changing a Member's Role

**Scenario**: A company admin wants to promote a member to manager.

**Steps**:
1. Admin calls `PATCH /api/v1/companies/:id/members/:userId/role` with new role
2. System validates admin has COMPANY_ADMIN role
3. System updates member's role
4. Member now has new permissions

---

## Permissions & Access Control

### Permission Matrix

| Action | COMPANY_ADMIN | MANAGER | Other Roles | Super Admin |
|--------|---------------|---------|-------------|-------------|
| Invite users | ✅ | ✅ | ❌ | ✅ |
| Accept invitation | ✅* | ✅* | ✅* | ✅* |
| View members | ✅ | ✅ | ✅ | ✅ |
| Update member role | ✅ | ❌ | ❌ | ✅ |
| Remove member | ✅ | ❌ | ❌ | ✅ |

*Any authenticated user can accept invitations sent to their email address

### Notes

- **Invite Users**: Only COMPANY_ADMIN and MANAGER can invite users. Other roles cannot invite.
- **Accept Invitation**: Any authenticated user can accept an invitation sent to their email, regardless of role.
- **View Members**: All company members can view the member list.
- **Update Role**: Only COMPANY_ADMIN can change member roles.
- **Remove Member**: Only COMPANY_ADMIN can remove members from the company.
- **Super Admin**: Can perform all actions across all companies without company context restrictions.

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/companies/:id/invite-user"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVITATION_NOT_FOUND` | 404 | The invitation doesn't exist or has been removed |
| `INVITATION_EXPIRED` | 400 | The invitation token has expired (after 7 days) |
| `INVITATION_ALREADY_ACCEPTED` | 400 | The invitation has already been accepted |
| `INVITATION_ALREADY_CANCELLED` | 400 | The invitation has been cancelled |
| `INVALID_INVITATION_TOKEN` | 400 | The invitation token is invalid or expired |
| `USER_ALREADY_IN_COMPANY` | 409 | User is already a member of the company |
| `USER_ALREADY_INVITED` | 409 | User has already been invited (pending invitation exists) |
| `INSUFFICIENT_PERMISSIONS` | 403 | User doesn't have required permissions |
| `COMPANY_NOT_FOUND` | 404 | Company doesn't exist or user doesn't have access |
| `NOT_COMPANY_MEMBER` | 403 | User is not a member of this company |

### Handling Errors

Always check the `success` field in the response. If `false`, handle the error appropriately:

```javascript
if (!response.success) {
  const errorCode = response.error.code;
  const errorMessage = response.error.message;
  
  switch (errorCode) {
    case 'INVITATION_EXPIRED':
      // Show message: "This invitation has expired. Please request a new one."
      break;
    case 'INSUFFICIENT_PERMISSIONS':
      // Show message: "You don't have permission to perform this action."
      break;
    // ... handle other errors
  }
}
```

---

## Code Examples

### Invite User

```javascript
const inviteUser = async (companyId, email, role) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/companies/${companyId}/invite-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email, role }),
    }
  );

  const data = await response.json();
  
  if (data.success) {
    return { success: true, message: data.message };
  } else {
    throw new Error(data.error.message);
  }
};
```

### Accept Invitation

```javascript
const acceptInvitation = async (companyId, token) => {
  const authToken = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/companies/${companyId}/accept-invite`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    }
  );

  const data = await response.json();
  
  if (data.success) {
    // User is now a member, refresh company list
    return { success: true, message: data.message };
  } else {
    throw new Error(data.error.message);
  }
};
```

### List Members

```javascript
const getCompanyMembers = async (companyId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/companies/${companyId}/members`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  
  if (data.success) {
    return data.data; // Array of members
  } else {
    throw new Error(data.error.message);
  }
};
```

### Update Member Role

```javascript
const updateMemberRole = async (companyId, userId, newRole) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/companies/${companyId}/members/${userId}/role`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ role: newRole }),
    }
  );

  const data = await response.json();
  
  if (data.success) {
    return { success: true, message: data.message };
  } else {
    throw new Error(data.error.message);
  }
};
```

### Remove Member

```javascript
const removeMember = async (companyId, userId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/companies/${companyId}/members/${userId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  
  if (data.success) {
    return { success: true, message: data.message };
  } else {
    throw new Error(data.error.message);
  }
};
```

### React Component Example (Invite User)

```typescript
import React, { useState } from 'react';

const InviteUserForm = ({ companyId }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await inviteUser(companyId, email, role);
      setMessage('Invitation sent successfully!');
      setEmail('');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="MANAGER">Manager</option>
        <option value="LANDLORD">Landlord</option>
        <option value="TENANT">Tenant</option>
        <option value="MAINTENANCE">Maintenance</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Invitation'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
};
```

---

## Best Practices

### Invitation Handling

- **Check invitation status**: Before accepting, verify the invitation hasn't expired
- **Handle expired invitations**: Show user-friendly message if invitation expired
- **Resend invitations**: For testing, the system automatically updates pending invitations when resending
- **Token security**: Never expose invitation tokens in logs or client-side code

### Permission Checks

- **Frontend validation**: Check user role before showing invite/update/remove buttons
- **Backend trust**: Always rely on backend validation - frontend checks are for UX only
- **Error handling**: Handle 403 errors gracefully with appropriate messages

### Member Management

- **Refresh member list**: After inviting or removing members, refresh the member list
- **Role updates**: Show confirmation before changing roles, especially for demotions
- **Remove confirmation**: Always confirm before removing a member (irreversible)

### Email Integration

- **Invitation URL**: Use the token from the invitation email: `${FRONTEND_URL}/accept-invite?token=${token}`
- **Email validation**: Ensure email is valid before sending invitation
- **Duplicate handling**: Check if user is already a member before inviting

### Error Handling

- **User-friendly messages**: Map error codes to user-friendly messages
- **Retry logic**: Allow retrying failed invitation sends
- **Token expiration**: Handle token expiration gracefully

---

## Quick Reference

| Route | Method | Auth Required | Purpose | Required Role |
|-------|--------|---------------|---------|---------------|
| `/companies/:id/invite-user` | POST | Yes | Invite user by email | COMPANY_ADMIN, MANAGER |
| `/companies/:id/accept-invite` | POST | Yes | Accept invitation | Authenticated user |
| `/companies/:id/members` | GET | Yes | List company members | Company member |
| `/companies/:id/members/:userId/role` | PATCH | Yes | Update member role | COMPANY_ADMIN |
| `/companies/:id/members/:userId` | DELETE | Yes | Remove member | COMPANY_ADMIN |

---

## Support

For questions or issues, please contact the backend development team or refer to the Swagger documentation at:
```
http://localhost:8000/api/docs
```

---

**Last Updated**: 12/21/2025  
**API Version**: v1  
**Documentation Version**: 1.0

