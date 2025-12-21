# Unit API Documentation

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

This documentation covers all unit management API endpoints for the Property Management System. The unit system supports:

- Creating and managing units within properties
- Advanced filtering and search capabilities
- Property-unit relationships
- Company-scoped unit access
- Comprehensive unit details including amenities, pricing, and features
- Soft delete functionality

**Important**: All routes require JWT Bearer token authentication and company context (unless you're a super admin). Units belong to properties, which belong to companies, and users can only access units from properties in companies they belong to.

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

For paginated responses, the structure includes pagination metadata:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## Core Concepts

### Unit-Property Relationship

Units belong to properties:
- Each unit must have a `propertyId` (the property it belongs to)
- The `companyId` is automatically populated from the property if not provided
- Users can only view units from properties in companies they belong to
- Super admins can view and manage all units across all companies

### Unit Types

Units can be one of the following types (from `UnitType` enum):

- **STUDIO**: Studio apartment
- **ONE_BEDROOM**: One bedroom unit
- **TWO_BEDROOM**: Two bedroom unit
- **THREE_BEDROOM**: Three bedroom unit
- **FOUR_PLUS_BEDROOM**: Four or more bedrooms
- **SHOP**: Retail shop/space
- **COMMERCIAL**: Commercial unit
- **STORAGE**: Storage unit
- **PARKING**: Parking space
- **PENTHOUSE**: Penthouse unit

### Unit Statuses

Units can have the following statuses (from `UnitStatus` enum):

- **AVAILABLE**: Unit is available for rent
- **OCCUPIED**: Unit is currently occupied
- **MAINTENANCE**: Unit is under maintenance
- **UNAVAILABLE**: Unit is unavailable

### Lease Types

Units can have the following lease types (from `LeaseType` enum):

- **SHORT_TERM**: Short-term lease
- **LONG_TERM**: Long-term lease
- **MONTH_TO_MONTH**: Month-to-month lease

### Unique Unit Numbers

Unit numbers must be unique within a property:
- The combination of `propertyId` + `unitNumber` must be unique
- This ensures no duplicate unit numbers within the same property
- Example: Property A can have unit "101" and Property B can also have unit "101", but Property A cannot have two units both numbered "101"

### Auto-Populated Company ID

When creating a unit:
- If `companyId` is not provided, it is automatically populated from the property's `companyId`
- This ensures data consistency and simplifies the creation process
- You can explicitly provide `companyId` if needed, but it must match the property's company

### Soft Delete

Units use soft delete:
- Deleting a unit sets `isActive: false`
- Deleted units are filtered out from list queries (only `isActive: true` units are shown)
- This allows for recovery and maintains data integrity
- Unit counts for properties exclude inactive units

---

## API Routes

### 1. Create Unit

**Endpoint**: `POST /api/v1/units`  
**Authentication**: Required (JWT + Company context)  
**Description**: Create a new unit within a property. The companyId will be auto-populated from the property if not provided.

**Required Permissions**: COMPANY_ADMIN or MANAGER (or Super Admin)

#### Request Body

**Minimum Required Fields**:
```json
{
  "propertyId": "123e4567-e89b-12d3-a456-426614174000",
  "unitNumber": "101",
  "unitType": "ONE_BEDROOM",
  "monthlyRent": 1500.00
}
```

**Full Example with Optional Fields**:
```json
{
  "propertyId": "123e4567-e89b-12d3-a456-426614174000",
  "unitNumber": "101",
  "status": "AVAILABLE",
  "unitType": "ONE_BEDROOM",
  "monthlyRent": 1500.00,
  "squareFootage": 800,
  "bedrooms": 1,
  "bathrooms": 1.5,
  "depositAmount": 1500.00,
  "floorNumber": 3,
  "description": "Beautiful one-bedroom apartment with great views",
  "images": ["https://example.com/image1.jpg"],
  "features": ["balcony", "AC", "furnished"],
  "notes": "Recently renovated",
  "leaseType": "LONG_TERM",
  "hasParking": true,
  "parkingSpotNumber": "P-12",
  "petFriendly": false,
  "furnished": true,
  "utilitiesIncluded": true,
  "utilityNotes": "Water and electricity included",
  "lateFeeAmount": 50.00,
  "petDeposit": 300.00,
  "petRent": 50.00,
  "accessCode": "1234"
}
```

#### Request Body Schema

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `propertyId` | UUID | Yes | Valid UUID | Property ID that the unit belongs to |
| `companyId` | UUID | No | Valid UUID | Company ID (auto-populated from Property if not provided) |
| `unitNumber` | string | Yes | Min 1 character | Unit number or identifier (must be unique per property) |
| `status` | enum | No | UnitStatus enum | Unit status (default: AVAILABLE) |
| `unitType` | enum | Yes | UnitType enum | Unit type |
| `monthlyRent` | number | Yes | Number, >= 0, max 2 decimals | Monthly rent amount |
| `squareFootage` | number | No | Integer, >= 0 | Square footage |
| `bedrooms` | number | No | Integer, >= 0 | Number of bedrooms |
| `bathrooms` | number | No | Number, >= 0, max 1 decimal | Number of bathrooms (can include half bathrooms) |
| `depositAmount` | number | No | Number, >= 0, max 2 decimals | Security deposit amount |
| `floorNumber` | number | No | Integer | Floor number |
| `description` | string | No | - | Unit description |
| `images` | string[] | No | Array of URLs | Array of image URLs |
| `features` | string[] | No | Array of strings | Array of unit features (e.g., ["balcony", "AC"]) |
| `notes` | string | No | - | Internal notes |
| `leaseType` | enum | No | LeaseType enum | Lease type |
| `hasParking` | boolean | No | - | Has parking included |
| `parkingSpotNumber` | string | No | - | Parking spot number or identifier |
| `petFriendly` | boolean | No | - | Pet friendly |
| `furnished` | boolean | No | - | Furnished unit |
| `utilitiesIncluded` | boolean | No | - | Utilities included in rent |
| `utilityNotes` | string | No | - | Notes about utilities |
| `lateFeeAmount` | number | No | Number, >= 0, max 2 decimals | Late fee amount |
| `petDeposit` | number | No | Number, >= 0, max 2 decimals | Pet deposit amount |
| `petRent` | number | No | Number, >= 0, max 2 decimals | Additional monthly pet rent |
| `accessCode` | string | No | - | Access code or key identifier |

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "propertyId": "123e4567-e89b-12d3-a456-426614174001",
    "companyId": "123e4567-e89b-12d3-a456-426614174002",
    "unitNumber": "101",
    "status": "AVAILABLE",
    "unitType": "ONE_BEDROOM",
    "monthlyRent": 1500.00,
    "squareFootage": 800,
    "bedrooms": 1,
    "bathrooms": 1.5,
    "depositAmount": 1500.00,
    "floorNumber": 3,
    "description": "Beautiful one-bedroom apartment with great views",
    "images": ["https://example.com/image1.jpg"],
    "features": ["balcony", "AC", "furnished"],
    "notes": "Recently renovated",
    "leaseType": "LONG_TERM",
    "hasParking": true,
    "parkingSpotNumber": "P-12",
    "petFriendly": false,
    "furnished": true,
    "utilitiesIncluded": true,
    "utilityNotes": "Water and electricity included",
    "lateFeeAmount": 50.00,
    "petDeposit": 300.00,
    "petRent": 50.00,
    "accessCode": "1234",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Unit created successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **403 Forbidden**: Insufficient permissions (not COMPANY_ADMIN or MANAGER)
- **404 Not Found**: Property not found
- **409 Conflict**: Unit number already exists for this property

#### Example Request
```bash
curl -X POST http://localhost:8000/api/v1/units \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "123e4567-e89b-12d3-a456-426614174000",
    "unitNumber": "101",
    "unitType": "ONE_BEDROOM",
    "monthlyRent": 1500.00,
    "bedrooms": 1,
    "bathrooms": 1.5
  }'
```

---

### 2. List Units

**Endpoint**: `GET /api/v1/units`  
**Authentication**: Required (JWT + Company context)  
**Description**: Get a paginated list of units with filtering, search, and sorting capabilities.

**Required Permissions**: Company member (can view units from properties in their company)

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 10 | Items per page (1-100) |
| `search` | string | No | - | Search by unit number |
| `status` | enum | No | - | Filter by unit status |
| `unitType` | enum | No | - | Filter by unit type |
| `propertyId` | UUID | No | - | Filter by property ID |
| `companyId` | UUID | No | - | Filter by company ID (super admin only) |
| `minRent` | number | No | - | Minimum monthly rent |
| `maxRent` | number | No | - | Maximum monthly rent |
| `bedrooms` | number | No | - | Filter by number of bedrooms |
| `bathrooms` | number | No | - | Filter by number of bathrooms |
| `sortBy` | string | No | createdAt | Sort field (unitNumber, monthlyRent, createdAt, status) |
| `sortOrder` | string | No | DESC | Sort order (ASC, DESC) |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "propertyId": "123e4567-e89b-12d3-a456-426614174001",
      "companyId": "123e4567-e89b-12d3-a456-426614174002",
      "unitNumber": "101",
      "status": "AVAILABLE",
      "unitType": "ONE_BEDROOM",
      "monthlyRent": 1500.00,
      "bedrooms": 1,
      "bathrooms": 1.5,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

#### Example Requests

**Basic List**:
```bash
curl -X GET "http://localhost:8000/api/v1/units" \
  -H "Authorization: Bearer <token>"
```

**With Filtering**:
```bash
curl -X GET "http://localhost:8000/api/v1/units?status=AVAILABLE&unitType=ONE_BEDROOM&propertyId=123e4567-e89b-12d3-a456-426614174000&minRent=1000&maxRent=2000" \
  -H "Authorization: Bearer <token>"
```

**With Search and Sorting**:
```bash
curl -X GET "http://localhost:8000/api/v1/units?search=101&sortBy=unitNumber&sortOrder=ASC" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Unit by ID

**Endpoint**: `GET /api/v1/units/:id`  
**Authentication**: Required (JWT + Company context)  
**Description**: Get detailed information about a specific unit by ID.

**Required Permissions**: Company member (must belong to unit's property's company)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Unit ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "propertyId": "123e4567-e89b-12d3-a456-426614174001",
    "companyId": "123e4567-e89b-12d3-a456-426614174002",
    "unitNumber": "101",
    "status": "AVAILABLE",
    "unitType": "ONE_BEDROOM",
    "monthlyRent": 1500.00,
    "squareFootage": 800,
    "bedrooms": 1,
    "bathrooms": 1.5,
    "depositAmount": 1500.00,
    "floorNumber": 3,
    "description": "Beautiful one-bedroom apartment with great views",
    "images": ["https://example.com/image1.jpg"],
    "features": ["balcony", "AC", "furnished"],
    "notes": "Recently renovated",
    "leaseType": "LONG_TERM",
    "hasParking": true,
    "parkingSpotNumber": "P-12",
    "petFriendly": false,
    "furnished": true,
    "utilitiesIncluded": true,
    "utilityNotes": "Water and electricity included",
    "lateFeeAmount": 50.00,
    "petDeposit": 300.00,
    "petRent": 50.00,
    "accessCode": "1234",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Responses
- **404 Not Found**: Unit not found or user doesn't have access

#### Example Request
```bash
curl -X GET http://localhost:8000/api/v1/units/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

---

### 4. Update Unit

**Endpoint**: `PATCH /api/v1/units/:id`  
**Authentication**: Required (JWT + Company context)  
**Description**: Update unit information. All fields are optional (partial update).

**Required Permissions**: COMPANY_ADMIN or MANAGER (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Unit ID |

#### Request Body
Any combination of updatable fields (all optional):
```json
{
  "status": "OCCUPIED",
  "monthlyRent": 1600.00,
  "features": ["balcony", "AC", "furnished", "parking"],
  "notes": "Tenant moved in"
}
```

#### Request Body Schema
All fields from `CreateUnitDto` are optional, plus:
- `isActive` (boolean): Set unit active/inactive status

**Important**: When updating `unitNumber`, ensure it doesn't conflict with existing unit numbers in the same property.

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    // ... all unit fields with updated values
  },
  "message": "Unit updated successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **403 Forbidden**: Insufficient permissions (not COMPANY_ADMIN or MANAGER)
- **404 Not Found**: Unit not found
- **409 Conflict**: Unit number already exists for this property (if updating unitNumber)

#### Example Request
```bash
curl -X PATCH http://localhost:8000/api/v1/units/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "OCCUPIED",
    "monthlyRent": 1600.00,
    "features": ["balcony", "AC", "furnished", "parking"]
  }'
```

---

### 5. Delete Unit

**Endpoint**: `DELETE /api/v1/units/:id`  
**Authentication**: Required (JWT + Company context)  
**Description**: Delete a unit. This performs a soft delete (sets `isActive: false`).

**Required Permissions**: COMPANY_ADMIN only (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Unit ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Unit deleted successfully"
}
```

**Note**: The unit is soft-deleted (isActive set to false). It will no longer appear in list queries but can be recovered if needed.

#### Error Responses
- **403 Forbidden**: Only company administrators can delete units
- **404 Not Found**: Unit not found

#### Example Request
```bash
curl -X DELETE http://localhost:8000/api/v1/units/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

---

### 6. Get Units by Property

**Endpoint**: `GET /api/v1/units/by-property/:propertyId`  
**Authentication**: Required (JWT + Company context)  
**Description**: Get all units for a specific property. This is a convenience endpoint for getting all units belonging to a property.

**Required Permissions**: Company member (must belong to property's company)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | UUID | Yes | Property ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "propertyId": "123e4567-e89b-12d3-a456-426614174001",
      "unitNumber": "101",
      "status": "AVAILABLE",
      "unitType": "ONE_BEDROOM",
      "monthlyRent": 1500.00,
      // ... all unit fields
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174002",
      "propertyId": "123e4567-e89b-12d3-a456-426614174001",
      "unitNumber": "102",
      "status": "OCCUPIED",
      "unitType": "TWO_BEDROOM",
      "monthlyRent": 2000.00,
      // ... all unit fields
    }
  ]
}
```

#### Error Responses
- **404 Not Found**: Property not found or user doesn't have access

#### Example Request
```bash
curl -X GET http://localhost:8000/api/v1/units/by-property/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

---

## Use Cases & Flow Diagrams

### Use Case 1: Creating Units for a Property

**Scenario**: A property manager wants to add units to a newly created property.

**Steps**:
1. Manager calls `POST /api/v1/units` with propertyId, unitNumber, unitType, and monthlyRent
2. System validates permissions (user must be COMPANY_ADMIN or MANAGER)
3. System verifies property exists and is active
4. System auto-populates companyId from the property
5. System checks unitNumber uniqueness within the property
6. System creates unit with default status (AVAILABLE) and isActive (true)
7. Unit is created and returned with auto-generated ID

---

### Use Case 2: Finding Available Units

**Scenario**: A user wants to find all available one-bedroom units under $2000/month.

**Steps**:
1. User calls `GET /api/v1/units?status=AVAILABLE&unitType=ONE_BEDROOM&maxRent=2000`
2. System filters units by status, type, and rent range
3. System applies company scoping (user only sees units from their company's properties)
4. System returns paginated list of matching units
5. User can navigate through pages if results exceed limit

---

### Use Case 3: Viewing All Units for a Property

**Scenario**: A user wants to see all units in a specific property.

**Steps**:
1. User calls `GET /api/v1/units/by-property/:propertyId`
2. System validates user has access to the property's company
3. System returns all active units for that property
4. Frontend displays units in a list or grid view

---

### Use Case 4: Updating Unit Status

**Scenario**: A unit has been rented and needs to be marked as occupied.

**Steps**:
1. Manager calls `PATCH /api/v1/units/:id` with `{"status": "OCCUPIED"}`
2. System validates permissions
3. System updates unit status
4. Updated unit is returned

---

## Permissions & Access Control

### Permission Matrix

| Action | COMPANY_ADMIN | MANAGER | Other Roles | Super Admin |
|--------|---------------|---------|-------------|-------------|
| Create unit | ✅ | ✅ | ❌ | ✅ |
| View units | ✅ | ✅ | ✅ | ✅ |
| Update unit | ✅ | ✅ | ❌ | ✅ |
| Delete unit | ✅ | ❌ | ❌ | ✅ |

### Notes

- **Create Unit**: COMPANY_ADMIN and MANAGER can create units for properties in their company.
- **View Units**: All company members can view units from properties in their company.
- **Update Unit**: COMPANY_ADMIN and MANAGER can update unit details.
- **Delete Unit**: Only COMPANY_ADMIN can delete units (soft delete).
- **Super Admin**: Can perform all actions across all companies.

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
  "path": "/api/v1/units"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNIT_NOT_FOUND` | 404 | The unit doesn't exist or user doesn't have access |
| `UNIT_NUMBER_EXISTS` | 409 | A unit with this number already exists in this property |
| `PROPERTY_NOT_FOUND` | 404 | The property doesn't exist (when creating unit) |
| `VALIDATION_ERROR` | 400 | Request validation failed (check error details) |
| `INSUFFICIENT_PERMISSIONS` | 403 | User doesn't have required permissions |

### Handling Errors

Always check the `success` field in the response:

```javascript
if (!response.success) {
  const errorCode = response.error.code;
  const errorMessage = response.error.message;
  
  switch (errorCode) {
    case 'UNIT_NOT_FOUND':
      // Show message: "Unit not found"
      break;
    case 'UNIT_NUMBER_EXISTS':
      // Show message: "A unit with this number already exists in this property"
      break;
    case 'INSUFFICIENT_PERMISSIONS':
      // Show message: "You don't have permission to perform this action"
      break;
    // ... handle other errors
  }
}
```

---

## Code Examples

### Create Unit

```javascript
const createUnit = async (unitData) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/units', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(unitData),
  });

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.error.message);
  }
};

// Usage
const newUnit = await createUnit({
  propertyId: '123e4567-e89b-12d3-a456-426614174000',
  unitNumber: '101',
  unitType: 'ONE_BEDROOM',
  monthlyRent: 1500.00,
  bedrooms: 1,
  bathrooms: 1.5,
  squareFootage: 800,
});
```

### List Units with Filters

```javascript
const getUnits = async (filters = {}) => {
  const token = localStorage.getItem('token');
  
  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.page) queryParams.append('page', filters.page);
  if (filters.limit) queryParams.append('limit', filters.limit);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.unitType) queryParams.append('unitType', filters.unitType);
  if (filters.propertyId) queryParams.append('propertyId', filters.propertyId);
  if (filters.minRent) queryParams.append('minRent', filters.minRent);
  if (filters.maxRent) queryParams.append('maxRent', filters.maxRent);
  if (filters.bedrooms) queryParams.append('bedrooms', filters.bedrooms);
  if (filters.bathrooms) queryParams.append('bathrooms', filters.bathrooms);
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
  
  const url = `http://localhost:8000/api/v1/units?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      units: data.data,
      pagination: data.pagination,
    };
  } else {
    throw new Error(data.error.message);
  }
};

// Usage
const { units, pagination } = await getUnits({
  status: 'AVAILABLE',
  unitType: 'ONE_BEDROOM',
  propertyId: '123e4567-e89b-12d3-a456-426614174000',
  minRent: 1000,
  maxRent: 2000,
  page: 1,
  limit: 20,
});
```

### Get Units by Property

```javascript
const getUnitsByProperty = async (propertyId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/units/by-property/${propertyId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.error.message);
  }
};
```

### Update Unit

```javascript
const updateUnit = async (unitId, updates) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/units/${unitId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    }
  );

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.error.message);
  }
};

// Usage
const updated = await updateUnit('123e4567-e89b-12d3-a456-426614174000', {
  status: 'OCCUPIED',
  monthlyRent: 1600.00,
  features: ['balcony', 'AC', 'furnished', 'parking'],
});
```

### Delete Unit

```javascript
const deleteUnit = async (unitId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/units/${unitId}`,
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

### React Component Example

```typescript
import React, { useState, useEffect } from 'react';

const UnitList = ({ propertyId }) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    unitType: '',
    minRent: '',
    maxRent: '',
  });

  useEffect(() => {
    loadUnits();
  }, [propertyId, filters]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const result = await getUnits({
        propertyId,
        ...filters,
      });
      setUnits(result.units);
    } catch (error) {
      console.error('Error loading units:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
        <select
          value={filters.unitType}
          onChange={(e) => setFilters({ ...filters, unitType: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="ONE_BEDROOM">One Bedroom</option>
          <option value="TWO_BEDROOM">Two Bedroom</option>
          <option value="THREE_BEDROOM">Three Bedroom</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {units.map((unit) => (
            <div key={unit.id}>
              <h3>Unit {unit.unitNumber}</h3>
              <p>Type: {unit.unitType}</p>
              <p>Status: {unit.status}</p>
              <p>Rent: ${unit.monthlyRent}</p>
              <p>Bedrooms: {unit.bedrooms} | Bathrooms: {unit.bathrooms}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## Best Practices

### Unit Creation

- **Required fields**: Always provide propertyId, unitNumber, unitType, and monthlyRent
- **Unique unit numbers**: Ensure unit numbers are unique within the property
- **Auto-populated companyId**: Let the system auto-populate companyId from the property
- **Detailed information**: Include square footage, bedrooms, bathrooms for better searchability
- **Features array**: Use consistent feature names (e.g., "AC", "balcony", "furnished")

### Filtering and Search

- **Pagination**: Always use pagination for large lists (default limit: 10)
- **Rent ranges**: Use minRent and maxRent for price filtering
- **Property filtering**: Use propertyId to filter units by property
- **Status filtering**: Filter by status to show available/occupied units
- **Combining filters**: Multiple filters can be combined for precise results

### Performance

- **List queries**: Only fetch necessary fields in list views
- **Detail queries**: Use detail endpoint for full unit information
- **Property units**: Use `/by-property/:propertyId` endpoint for property-specific views
- **Pagination**: Respect page limits (max 100 items per page)
- **Caching**: Cache unit lists when appropriate

### Data Management

- **Unit number conflicts**: Check for existing unit numbers before creating/updating
- **Status updates**: Update unit status when units are rented or become available
- **Soft delete**: Understand that delete is soft (isActive: false)
- **Updates**: Use PATCH for partial updates, not full replacements
- **Validation**: Validate data on frontend before sending to API

### Property-Unit Relationship

- **Property context**: Always consider the property when working with units
- **Unit counts**: Unit counts in properties exclude inactive units
- **Bulk operations**: Consider using the by-property endpoint for property-specific operations

### Error Handling

- **404 errors**: Handle unit not found gracefully
- **409 conflicts**: Check for unit number conflicts before submission
- **403 errors**: Show appropriate messages for permission issues
- **Validation errors**: Display field-specific validation messages
- **Network errors**: Implement retry logic for network failures

---

## Quick Reference

| Route | Method | Auth Required | Purpose | Required Role |
|-------|--------|---------------|---------|---------------|
| `/units` | POST | Yes | Create unit | COMPANY_ADMIN, MANAGER |
| `/units` | GET | Yes | List units | Company member |
| `/units/:id` | GET | Yes | Get unit details | Company member |
| `/units/:id` | PATCH | Yes | Update unit | COMPANY_ADMIN, MANAGER |
| `/units/:id` | DELETE | Yes | Delete unit | COMPANY_ADMIN |
| `/units/by-property/:propertyId` | GET | Yes | Get units by property | Company member |

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

