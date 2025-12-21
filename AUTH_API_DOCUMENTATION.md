# Authentication API Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Base Configuration](#base-configuration)
- [Authentication Flow](#authentication-flow)
- [API Routes](#api-routes)
- [Use Cases & Flow Diagrams](#use-cases--flow-diagrams)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)

---

## Overview

This documentation covers all authentication-related API endpoints for the Property Management System. The authentication system supports:

- User registration and login
- **Super admin authentication** (system-wide access without company context)
- Multi-company support (users can belong to multiple companies)
- Company selection and switching
- User profile management
- Password management

**Important**: All protected routes require a JWT Bearer token in the Authorization header. Super admins bypass company context requirements and have full system access.

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
For protected routes, include the JWT token in the Authorization header:
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

## Authentication Flow

### Understanding Company Context

Users can belong to multiple companies. When authenticated, the JWT token may or may not include a `companyId`:

- **Token without `companyId`**: User needs to select a company before accessing company-specific resources (unless super admin)
- **Token with `companyId`**: User is working in a specific company context and can access company-scoped data

**Super Admin Exception**: Super admins work without company context restrictions and can access all resources across all companies. Their tokens do not require `companyId`, though they can optionally select a company for company-specific views.

### Login Flow Scenarios

1. **Super Admin**: Token without `companyId` - Full system access, no company selection needed, bypasses all company guards
2. **User with 0 companies**: Token without `companyId` - No selection needed
3. **User with 1 company**: Token automatically includes `companyId` - Ready to use immediately
4. **User with multiple companies**: Token without `companyId` - User must select a company

---

## Super Admin Authentication

### What is a Super Admin?

Super admins are system administrators who have full access to the entire application without company context restrictions. They can:

- Access all companies and manage them
- View and manage all users across all companies
- Access admin-only routes at `/api/v1/admin/*`
- Bypass company context requirements
- Perform system-wide operations

### Super Admin Login Behavior

When a super admin logs in:

1. **Token**: Always receives a token **without** `companyId` (even if they belong to companies)
2. **Company Selection**: **Never required** - `requiresCompanySelection` is always `false`
3. **Access**: Immediate full system access - no company selection needed
4. **Guards**: Can bypass `CompanyAccessGuard` and all role-based restrictions
5. **Optional Company Context**: Can optionally use `/select-company` or `/switch-company` for company-specific views, but it's not required

### Super Admin User Response

All user responses include the `isSuperAdmin` boolean field:

```json
{
  "id": "...",
  "email": "admin@example.com",
  "name": "Super Admin",
  "isActive": true,
  "isSuperAdmin": true,  // ← Indicates super admin status
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Frontend Implementation Tips

- Check `user.isSuperAdmin` flag after login
- If `true`, skip company selection UI entirely
- Show admin dashboard/navigation for super admins
- Allow access to admin routes (`/api/v1/admin/*`)
- Super admins can still use company selection for company-specific views (optional)

---

## API Routes

### 1. Register User

**Endpoint**: `POST /api/v1/auth/register`  
**Authentication**: Not required (Public route)  
**Description**: Register a new user account. Creates a global account without any company association.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"  // Optional
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `email` | string | Yes | Valid email format | User email address |
| `password` | string | Yes | Minimum 6 characters | User password |
| `name` | string | No | - | User full name |

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "name": "John Doe",
      "isActive": true,
      "isSuperAdmin": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "companies": [],
    "requiresCompanySelection": false
  },
  "message": "User registered successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **409 Conflict**: User with this email already exists

---

### 2. Login User

**Endpoint**: `POST /api/v1/auth/login`  
**Authentication**: Not required (Public route)  
**Description**: Authenticate user and receive JWT token. Handles super admins, users with 0, 1, or multiple companies automatically.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `email` | string | Yes | Valid email format | User email address |
| `password` | string | Yes | Minimum 6 characters | User password |

#### Success Response (200 OK)

**Scenario A: Super Admin**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // No companyId required
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "admin@example.com",
      "name": "Super Admin",
      "isActive": true,
      "isSuperAdmin": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "companies": [], // May include companies if super admin is member
    "requiresCompanySelection": false
  },
  "message": "User logged in successfully"
}
```
*Note: Super admins always receive tokens without `companyId` and can access all resources across all companies without company selection.*

**Scenario B: User with 0 companies**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "name": "John Doe",
      "isActive": true,
      "isSuperAdmin": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "companies": [],
    "requiresCompanySelection": false
  },
  "message": "User logged in successfully"
}
```

**Scenario C: User with 1 company (auto-selected)**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // Contains companyId
    "user": { ... },
    "companies": [
      {
        "id": "company-uuid",
        "name": "ABC Realty",
        "slug": "abc-realty",
        "address": "123 Main St",
        "phone": "+1234567890",
        "email": "contact@abc.com",
        "logo": null,
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "requiresCompanySelection": false
  },
  "message": "User logged in successfully"
}
```

**Scenario D: User with multiple companies (requires selection)**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // No companyId
    "user": { ... },
    "companies": [
      {
        "id": "company-1-uuid",
        "name": "ABC Realty",
        ...
      },
      {
        "id": "company-2-uuid",
        "name": "XYZ Properties",
        ...
      }
    ],
    "requiresCompanySelection": true
  },
  "message": "Please select a company"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **401 Unauthorized**: Invalid email or password

---

### 3. Select Company

**Endpoint**: `POST /api/v1/auth/select-company`  
**Authentication**: Required (Bearer token without `companyId`)  
**Description**: Select a company after login when user has multiple companies. Generates a new token with the selected company's context.

#### When to Use
- After login when `requiresCompanySelection: true`
- Initial company selection for multi-company users

#### Request Headers
```
Authorization: Bearer <token-without-companyId>
Content-Type: application/json
```

#### Request Body
```json
{
  "companyId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `companyId` | string | Yes | Valid UUID | Company ID to select |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // Contains companyId and role
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "name": "John Doe",
      "isActive": true,
      "isSuperAdmin": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "message": "Company selected successfully"
}
```
*Note: Super admins can use this endpoint to optionally set a company context, but it's not required for access.*
```

#### Error Responses
- **401 Unauthorized**: Invalid or missing token
- **404 Not Found**: Company not found or user does not belong to company

---

### 4. Switch Company

**Endpoint**: `POST /api/v1/auth/switch-company`  
**Authentication**: Required (Bearer token with or without `companyId`)  
**Description**: Switch from current company context to a different company. Generates a new token with the new company's context.

#### When to Use
- User wants to change company context during active session
- Switching between companies without logging out

#### Request Headers
```
Authorization: Bearer <current-token>
Content-Type: application/json
```

#### Request Body
```json
{
  "companyId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `companyId` | string | Yes | Valid UUID | Company ID to switch to |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // Contains new companyId and role
    "user": { ... }
  },
  "message": "Company switched successfully"
}
```

#### Error Responses
- **401 Unauthorized**: Invalid or missing token
- **404 Not Found**: Company not found or user does not belong to company

---

### 5. Get User Companies

**Endpoint**: `GET /api/v1/auth/companies`  
**Authentication**: Required  
**Description**: Get list of all companies the authenticated user belongs to.

#### When to Use
- Display company list in company switcher UI
- Refresh company list during session
- Before showing company selection options

#### Request Headers
```
Authorization: Bearer <token>
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "ABC Realty",
      "slug": "abc-realty",
      "address": "123 Main St, City, State 12345",
      "phone": "+1234567890",
      "email": "contact@abc.com",
      "logo": null,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "another-company-uuid",
      "name": "XYZ Properties",
      ...
    }
  ]
}
```

#### Error Responses
- **401 Unauthorized**: Invalid or missing token

---

### 6. Get Current User

**Endpoint**: `GET /api/v1/auth/me`  
**Authentication**: Required  
**Description**: Get current authenticated user's profile information.

#### When to Use
- Display user information in header/profile section
- Verify authentication status
- Get user details for profile page

#### Request Headers
```
Authorization: Bearer <token>
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe",
    "isActive": true,
    "isSuperAdmin": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Responses
- **401 Unauthorized**: Invalid or missing token

---

### 7. Update Profile

**Endpoint**: `PATCH /api/v1/auth/profile`  
**Authentication**: Required  
**Description**: Update current user's profile (name and/or email).

#### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "John Updated Doe",  // Optional
  "email": "newemail@example.com"  // Optional
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | No | - | User full name |
| `email` | string | No | Valid email format | User email address |

**Note**: At least one field must be provided. Both fields are optional but at least one should be present.

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "newemail@example.com",
    "name": "John Updated Doe",
    "isActive": true,
    "isSuperAdmin": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **401 Unauthorized**: Invalid or missing token

---

### 8. Change Password

**Endpoint**: `PATCH /api/v1/auth/profile/password`  
**Authentication**: Required  
**Description**: Change current user's password.

#### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

#### Request Body Schema
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `oldPassword` | string | Yes | - | Current password |
| `newPassword` | string | Yes | Minimum 6 characters | New password |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **401 Unauthorized**: Current password is incorrect or invalid token

---

## Use Cases & Flow Diagrams

### Use Case 1: Super Admin Login

```
1. Super admin logs in
   POST /api/v1/auth/login
   → Receives token WITHOUT companyId (always)
   → requiresCompanySelection: false
   → isSuperAdmin: true
   
2. Super admin has immediate access to:
   - All admin routes (/api/v1/admin/*)
   - All companies (can view/manage all)
   - All users (can view/manage all)
   - System-wide statistics
   - Can bypass all company context requirements
   - Can optionally select company for company-specific views (not required)
```

### Use Case 2: New User Registration & First Login

```
1. User registers
   POST /api/v1/auth/register
   → Receives token without companyId
   → companies: []
   → isSuperAdmin: false
   
2. User can now:
   - Create a company (via company endpoints)
   - Join an existing company (via invitation/company endpoints)
   - Access non-company-scoped resources
```

### Use Case 3: Login with Single Company

```
1. User logs in
   POST /api/v1/auth/login
   → Receives token WITH companyId (auto-selected)
   → requiresCompanySelection: false
   
2. User is immediately ready to use the app
   → Token includes companyId and role
   → Can access all company-scoped resources
```

### Use Case 4: Login with Multiple Companies (Initial Selection)

```
1. User logs in
   POST /api/v1/auth/login
   → Receives token WITHOUT companyId
   → companies: [company1, company2, ...]
   → requiresCompanySelection: true
   
2. Frontend shows company selection UI
   → Display companies from login response
   
3. User selects a company
   POST /api/v1/auth/select-company
   Body: { companyId: "selected-company-id" }
   → Receives new token WITH companyId and role
   
4. User can now access company-scoped resources
```

### Use Case 5: Switch Company During Session

```
1. User is logged in with Company A
   → Current token has companyId: "company-a-id"
   
2. User clicks "Switch Company" in UI
   → Optionally: GET /api/v1/auth/companies (to refresh list)
   
3. User selects Company B from dropdown
   POST /api/v1/auth/switch-company
   Body: { companyId: "company-b-id" }
   → Receives new token WITH new companyId and role
   
4. App refreshes with Company B context
   → All company-scoped data updates
```

### Complete Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. REGISTRATION (New User)
   POST /auth/register
   ↓
   Token (no companyId) + companies: []
   ↓
   User can create/join companies

2. LOGIN (Existing User)
   POST /auth/login
   ↓
   ┌─────────────────────────────────────────┐
   │ Check if user is super admin            │
   └─────────────────────────────────────────┘
         │
         ├─→ Super Admin ✨
         │   → Token (no companyId) - ALWAYS
         │   → requiresCompanySelection: false
         │   → isSuperAdmin: true
         │   → Full system access immediately
         │   → Can bypass all company guards
         │
         └─→ Regular User
             ↓
             ┌─────────────────────────────────────────┐
             │ Check user's company count              │
             └─────────────────────────────────────────┘
                   │
                   ├─→ 0 companies
                   │   → Token (no companyId)
                   │   → requiresCompanySelection: false
                   │
                   ├─→ 1 company
                   │   → Token (WITH companyId + role) ✨ Auto-selected
                   │   → requiresCompanySelection: false
                   │   → Ready to use immediately
                   │
                   └─→ Multiple companies
                       → Token (no companyId)
                       → companies: [list]
                       → requiresCompanySelection: true
                       ↓
                       Show company selection UI
                       ↓
                       POST /auth/select-company
                       ↓
                       Token (WITH companyId + role)

3. WORKING IN COMPANY CONTEXT
   Token includes companyId
   ↓
   Can access company-scoped resources
   ↓
   Need to switch company?
   ↓
   POST /auth/switch-company
   ↓
   New token (WITH new companyId + role)

4. PROFILE MANAGEMENT
   GET /auth/me → Get user info
   PATCH /auth/profile → Update profile
   PATCH /auth/profile/password → Change password
```

---

## Error Handling

### Common Error Codes

| Status Code | Meaning | When It Occurs |
|-------------|---------|----------------|
| **200** | OK | Successful request |
| **201** | Created | Successful registration |
| **400** | Bad Request | Validation errors, invalid input |
| **401** | Unauthorized | Invalid credentials, expired/invalid token |
| **404** | Not Found | Resource not found (e.g., company doesn't exist or user doesn't belong to it) |
| **409** | Conflict | Email already exists (registration) |
| **500** | Internal Server Error | Server-side errors |

### Error Response Format

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "error": {
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": {
      // Additional error details if available
    }
  }
}
```

### Handling Token Expiration

When a token expires:
1. User receives **401 Unauthorized** response
2. Frontend should redirect to login page
3. User needs to login again
4. If user had multiple companies, they'll need to select company again

### Handling Company Context Errors

If a protected route requires a company context but token doesn't have `companyId`:
- **Super admins**: Bypass this check automatically - no error
- **Regular users**: API will return **403 Forbidden** with message indicating company context is required
- Frontend should check `user.isSuperAdmin` flag before prompting for company selection

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

#### Register User
```javascript
const register = async (email, password, name) => {
  const response = await fetch('http://localhost:8000/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      name, // optional
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    // Store token
    localStorage.setItem('token', data.data.access_token);
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

#### Login User
```javascript
const login = async (email, password) => {
  const response = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  
  if (data.success) {
    // Store token
    localStorage.setItem('token', data.data.access_token);
    
    // Check if user is super admin
    if (data.data.user.isSuperAdmin) {
      // Super admin - no company selection needed, full access
      return { 
        requiresSelection: false, 
        user: data.data.user, 
        isSuperAdmin: true 
      };
    }
    
    // Check if company selection is needed
    if (data.data.requiresCompanySelection) {
      // Show company selection UI with data.data.companies
      return { requiresSelection: true, companies: data.data.companies };
    }
    
    return { requiresSelection: false, user: data.data.user };
  } else {
    throw new Error(data.message);
  }
};
```

#### Select Company
```javascript
const selectCompany = async (companyId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/select-company', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId }),
  });

  const data = await response.json();
  
  if (data.success) {
    // Update token
    localStorage.setItem('token', data.data.access_token);
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

#### Switch Company
```javascript
const switchCompany = async (companyId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/switch-company', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId }),
  });

  const data = await response.json();
  
  if (data.success) {
    // Update token
    localStorage.setItem('token', data.data.access_token);
    // Refresh app data with new company context
    window.location.reload(); // or update state in your framework
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

#### Get User Companies
```javascript
const getUserCompanies = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/companies', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

#### Get Current User
```javascript
const getCurrentUser = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

#### Update Profile
```javascript
const updateProfile = async (updates) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates), // { name?: string, email?: string }
  });

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

#### Change Password
```javascript
const changePassword = async (oldPassword, newPassword) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/profile/password', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  const data = await response.json();
  
  if (data.success) {
    return true;
  } else {
    throw new Error(data.message);
  }
};
```

### React Hook Example (Complete Flow)

```typescript
import { useState, useEffect } from 'react';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [currentCompanyId, setCurrentCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('token');
  const setToken = (token: string) => localStorage.setItem('token', token);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getCurrentUser();
        setUser(userData);
        
        // Get companies
        const companiesData = await getUserCompanies();
        setCompanies(companiesData);
        
        // Extract companyId from token (you'll need to decode JWT)
        // For now, assume it's stored separately or decoded
      } catch (error) {
        // Token invalid, clear storage
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const loginData = await login(email, password);
    
    if (loginData.requiresSelection) {
      // Show company selection modal
      return { requiresCompanySelection: true, companies: loginData.companies };
    }
    
    setUser(loginData.user);
    return { requiresCompanySelection: false };
  };

  const handleSelectCompany = async (companyId: string) => {
    const authData = await selectCompany(companyId);
    setCurrentCompanyId(companyId);
    setUser(authData.user);
    return authData;
  };

  const handleSwitchCompany = async (companyId: string) => {
    const authData = await switchCompany(companyId);
    setCurrentCompanyId(companyId);
    setUser(authData.user);
    // Reload or update app state
    window.location.reload();
    return authData;
  };

  return {
    user,
    companies,
    currentCompanyId,
    loading,
    handleLogin,
    handleSelectCompany,
    handleSwitchCompany,
  };
};
```

---

## Best Practices

### Token Storage
- Store JWT token securely (consider httpOnly cookies for production)
- Never expose token in URLs or logs
- Clear token on logout

### Error Handling
- Always check `success` field in response
- Handle 401 errors by redirecting to login
- Show user-friendly error messages

### Super Admin Handling
- Check `user.isSuperAdmin` flag after login
- Super admins don't need company selection UI
- Super admins can access admin routes at `/api/v1/admin/*`
- Show appropriate UI/features based on super admin status

### Company Selection
- Check `user.isSuperAdmin` first - skip company selection if true
- Always check `requiresCompanySelection` flag after login for regular users
- Store selected company ID for UI display (not needed for super admin)
- Update token immediately after company selection/switch

### State Management
- Update user state after profile updates
- Refresh company list when needed
- Handle company switching gracefully (may need to clear/reset app state)
- Track super admin status in application state

### Security
- Never store passwords
- Always use HTTPS in production
- Validate inputs on frontend before sending to API
- Implement token refresh mechanism if available
- Super admin routes are protected by `SuperAdminGuard` - never bypass client-side

---

## Quick Reference

| Route | Method | Auth Required | Purpose | Notes |
|-------|--------|---------------|---------|-------|
| `/auth/register` | POST | No | Register new user | Creates regular user |
| `/auth/login` | POST | No | Login user | Super admin bypasses company selection |
| `/auth/select-company` | POST | Yes | Select company after login | Optional for super admin |
| `/auth/switch-company` | POST | Yes | Switch company during session | Optional for super admin |
| `/auth/companies` | GET | Yes | Get user's companies | Shows all companies for super admin |
| `/auth/me` | GET | Yes | Get current user | Includes `isSuperAdmin` flag |
| `/auth/profile` | PATCH | Yes | Update profile | Works for all users |
| `/auth/profile/password` | PATCH | Yes | Change password | Works for all users |
| `/admin/*` | Various | Yes (Super Admin) | Admin routes | Super admin only |

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

