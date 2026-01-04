# Super Admin User Management

Complete CRUD operations for managing users system-wide (super admin only).

## Endpoints

### Create User
```
POST /api/v1/admin/users
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "companyId": "optional-company-uuid",
  "role": "TENANT"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": { "id": "...", "email": "...", "name": "..." },
  "message": "User created successfully"
}
```

---

### Update User
```
PUT /api/v1/admin/users/:id
PATCH /api/v1/admin/users/:id
```

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "password": "NewPassword123!",
  "name": "Updated Name"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { "id": "...", "email": "...", "name": "..." },
  "message": "User updated successfully"
}
```

---

### Delete User
```
DELETE /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id?hard=true
```

- **Soft delete (default)**: Deactivates user (`isActive: false`)
- **Hard delete**: Permanently removes user from database (use `?hard=true`)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

**Note:** Cannot delete last super admin.

---

## List Users
```
GET /api/v1/admin/users?page=1&limit=10&search=john&isSuperAdmin=false
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `search` - Search by email or name
- `isSuperAdmin` - Filter by super admin status

---

## Get User by ID
```
GET /api/v1/admin/users/:id
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { "id": "...", "email": "...", "name": "...", "isSuperAdmin": false }
}
```

---

## Notes

- All endpoints require super admin authentication
- Email is automatically normalized to lowercase
- Passwords are hashed before storage
- Email uniqueness is validated on create/update
- Company assignment is optional during user creation


