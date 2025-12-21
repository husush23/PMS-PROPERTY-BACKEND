# Property API Documentation

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

This documentation covers all property management API endpoints for the Property Management System. The property system supports:

- Creating and managing properties
- Advanced filtering and search capabilities
- Company-scoped property access
- Property details including location, amenities, and images
- Automatic unit counting from the Units relation
- Soft delete functionality

**Important**: All routes require JWT Bearer token authentication and company context (unless you're a super admin). Properties are scoped to companies, and users can only access properties from companies they belong to.

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

### Property Ownership

Properties belong to companies:
- Each property must have a `companyId` (the company that owns it)
- Users can only view properties from companies they belong to
- Super admins can view and manage all properties across all companies

### Property Types

Properties can be one of the following types (from `PropertyType` enum):

- **APARTMENT**: Apartment building or complex
- **HOUSE**: Single-family or multi-family house
- **COMMERCIAL**: Commercial property
- **CONDO**: Condominium
- **TOWNHOUSE**: Townhouse property
- **MIXED_USE**: Mixed-use property

### Property Statuses

Properties can have the following statuses (from `PropertyStatus` enum):

- **AVAILABLE**: Property is available for use (default)
- **OCCUPIED**: Property is currently occupied
- **MAINTENANCE**: Property is under maintenance
- **UNAVAILABLE**: Property is unavailable

### Unit Counting

The `numberOfUnits` field is automatically computed from the Units relation:
- When fetching a single property (`GET /properties/:id`), the system counts active units for that property
- The count includes only units where `isActive: true`
- This provides real-time accuracy of unit counts
- The `totalUnits` field can be manually set as a target/capacity value

### Soft Delete

Properties use soft delete:
- Deleting a property sets `isActive: false`
- Deleted properties are filtered out from list queries (only `isActive: true` properties are shown)
- This allows for recovery and maintains data integrity

### Company-Scoped Access

All property operations respect company boundaries:
- Regular users see only properties from their company(s)
- Super admins can access all properties
- Filtering by `companyId` is available for super admins

---

## API Routes

### 1. Create Property

**Endpoint**: `POST /api/v1/properties`  
**Authentication**: Required (JWT + Company context)  
**Description**: Create a new property. The property will be associated with the specified company.

**Required Permissions**: COMPANY_ADMIN or MANAGER (or Super Admin)

#### Request Body

**Minimum Required Fields**:
```json
{
  "name": "Sunset Apartments",
  "companyId": "123e4567-e89b-12d3-a456-426614174000",
  "propertyType": "APARTMENT"
}
```

**Full Example with Optional Fields**:
```json
{
  "name": "Sunset Apartments",
  "companyId": "123e4567-e89b-12d3-a456-426614174000",
  "propertyType": "APARTMENT",
  "status": "AVAILABLE",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "United States",
  "phone": "+1234567890",
  "email": "property@example.com",
  "description": "A beautiful apartment complex in the heart of the city",
  "latitude": 40.7128,
  "longitude": -74.006,
  "yearBuilt": 2020,
  "squareFootage": 50000,
  "floors": 5,
  "parkingSpaces": 20,
  "totalUnits": 50,
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

#### Request Body Schema

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | Min 2 characters | Property name |
| `companyId` | UUID | Yes | Valid UUID | Company ID that owns the property |
| `propertyType` | enum | Yes | PropertyType enum | Property type (APARTMENT, HOUSE, COMMERCIAL, CONDO, TOWNHOUSE, MIXED_USE) |
| `status` | enum | No | PropertyStatus enum | Property status (default: AVAILABLE) |
| `address` | string | No | - | Street address |
| `city` | string | No | - | City |
| `state` | string | No | - | State or Province |
| `zipCode` | string | No | - | ZIP or Postal code |
| `country` | string | No | - | Country |
| `phone` | string | No | - | Contact phone number |
| `email` | string | No | Valid email | Contact email address |
| `description` | string | No | - | Property description |
| `latitude` | number | No | Valid latitude | Latitude coordinate |
| `longitude` | number | No | Valid longitude | Longitude coordinate |
| `yearBuilt` | number | No | Integer, >= 1800 | Year the property was built |
| `squareFootage` | number | No | Integer, >= 0 | Total square footage |
| `floors` | number | No | Integer, >= 0 | Number of floors |
| `parkingSpaces` | number | No | Integer, >= 0 | Number of parking spaces |
| `totalUnits` | number | No | Integer, >= 0 | Total number of units (can be auto-counted from Units table) |
| `images` | string[] | No | Array of URLs | Array of image URLs |

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174000",
    "propertyType": "APARTMENT",
    "status": "AVAILABLE",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "United States",
    "phone": "+1234567890",
    "email": "property@example.com",
    "description": "A beautiful apartment complex in the heart of the city",
    "latitude": 40.7128,
    "longitude": -74.006,
    "yearBuilt": 2020,
    "squareFootage": 50000,
    "floors": 5,
    "parkingSpaces": 20,
    "totalUnits": 50,
    "numberOfUnits": 0,
    "images": ["https://example.com/image1.jpg"],
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Property created successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **403 Forbidden**: Insufficient permissions (not COMPANY_ADMIN or MANAGER)
- **404 Not Found**: Company not found

#### Example Request
```bash
curl -X POST http://localhost:8000/api/v1/properties \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174000",
    "propertyType": "APARTMENT",
    "city": "New York",
    "state": "NY"
  }'
```

---

### 2. List Properties

**Endpoint**: `GET /api/v1/properties`  
**Authentication**: Required (JWT + Company context)  
**Description**: Get a paginated list of properties with filtering, search, and sorting capabilities.

**Required Permissions**: Company member (can view properties from their company)

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 10 | Items per page (1-100) |
| `search` | string | No | - | Search by property name, address, or city |
| `status` | enum | No | - | Filter by property status |
| `propertyType` | enum | No | - | Filter by property type |
| `city` | string | No | - | Filter by city |
| `state` | string | No | - | Filter by state |
| `companyId` | UUID | No | - | Filter by company ID (super admin only) |
| `sortBy` | string | No | createdAt | Sort field (name, createdAt, status, city) |
| `sortOrder` | string | No | DESC | Sort order (ASC, DESC) |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Sunset Apartments",
      "companyId": "123e4567-e89b-12d3-a456-426614174000",
      "propertyType": "APARTMENT",
      "status": "AVAILABLE",
      "city": "New York",
      "state": "NY",
      "numberOfUnits": 45,
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
curl -X GET "http://localhost:8000/api/v1/properties" \
  -H "Authorization: Bearer <token>"
```

**With Filtering**:
```bash
curl -X GET "http://localhost:8000/api/v1/properties?status=AVAILABLE&propertyType=APARTMENT&city=New York&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

**With Search**:
```bash
curl -X GET "http://localhost:8000/api/v1/properties?search=Sunset&sortBy=name&sortOrder=ASC" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Property by ID

**Endpoint**: `GET /api/v1/properties/:id`  
**Authentication**: Required (JWT + Company context)  
**Description**: Get detailed information about a specific property by ID.

**Required Permissions**: Company member (must belong to property's company)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Property ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Sunset Apartments",
    "companyId": "123e4567-e89b-12d3-a456-426614174000",
    "propertyType": "APARTMENT",
    "status": "AVAILABLE",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "United States",
    "phone": "+1234567890",
    "email": "property@example.com",
    "description": "A beautiful apartment complex in the heart of the city",
    "latitude": 40.7128,
    "longitude": -74.006,
    "yearBuilt": 2020,
    "squareFootage": 50000,
    "floors": 5,
    "parkingSpaces": 20,
    "totalUnits": 50,
    "numberOfUnits": 45,
    "images": ["https://example.com/image1.jpg"],
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Note**: The `numberOfUnits` field is automatically computed by counting active units for this property.

#### Error Responses
- **404 Not Found**: Property not found or user doesn't have access

#### Example Request
```bash
curl -X GET http://localhost:8000/api/v1/properties/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

---

### 4. Update Property

**Endpoint**: `PATCH /api/v1/properties/:id`  
**Authentication**: Required (JWT + Company context)  
**Description**: Update property information. All fields are optional (partial update).

**Required Permissions**: COMPANY_ADMIN or MANAGER (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Property ID |

#### Request Body
Any combination of updatable fields (all optional):
```json
{
  "name": "Updated Property Name",
  "status": "MAINTENANCE",
  "description": "Updated description",
  "phone": "+1987654321",
  "isActive": true
}
```

#### Request Body Schema
All fields from `CreatePropertyDto` are optional, plus:
- `isActive` (boolean): Set property active/inactive status

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Updated Property Name",
    // ... all property fields
  },
  "message": "Property updated successfully"
}
```

#### Error Responses
- **400 Bad Request**: Validation failed
- **403 Forbidden**: Insufficient permissions (not COMPANY_ADMIN or MANAGER)
- **404 Not Found**: Property not found

#### Example Request
```bash
curl -X PATCH http://localhost:8000/api/v1/properties/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "MAINTENANCE",
    "description": "Currently under renovation"
  }'
```

---

### 5. Delete Property

**Endpoint**: `DELETE /api/v1/properties/:id`  
**Authentication**: Required (JWT + Company context)  
**Description**: Delete a property. This performs a soft delete (sets `isActive: false`).

**Required Permissions**: COMPANY_ADMIN only (or Super Admin)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Property ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Property deleted successfully"
}
```

**Note**: The property is soft-deleted (isActive set to false). It will no longer appear in list queries but can be recovered if needed.

#### Error Responses
- **403 Forbidden**: Only company administrators can delete properties
- **404 Not Found**: Property not found

#### Example Request
```bash
curl -X DELETE http://localhost:8000/api/v1/properties/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

---

## Use Cases & Flow Diagrams

### Use Case 1: Creating a New Property

**Scenario**: A property manager wants to add a new apartment building to the system.

**Steps**:
1. Manager calls `POST /api/v1/properties` with required fields (name, companyId, propertyType)
2. System validates permissions (user must be COMPANY_ADMIN or MANAGER)
3. System validates company exists and user has access
4. System creates property with default status (AVAILABLE) and isActive (true)
5. Property is created and returned with auto-generated ID
6. Manager can now add units to this property

---

### Use Case 2: Searching Properties

**Scenario**: A user wants to find all available apartment buildings in New York.

**Steps**:
1. User calls `GET /api/v1/properties?status=AVAILABLE&propertyType=APARTMENT&city=New York`
2. System filters properties by status, type, and city
3. System returns paginated list of matching properties
4. User can navigate through pages if results exceed limit

---

### Use Case 3: Viewing Property Details

**Scenario**: A user clicks on a property to see full details.

**Steps**:
1. User calls `GET /api/v1/properties/:id`
2. System validates user has access to property's company
3. System counts active units for the property
4. System returns complete property details including computed numberOfUnits

---

## Permissions & Access Control

### Permission Matrix

| Action | COMPANY_ADMIN | MANAGER | Other Roles | Super Admin |
|--------|---------------|---------|-------------|-------------|
| Create property | ✅ | ✅ | ❌ | ✅ |
| View properties | ✅ | ✅ | ✅ | ✅ |
| Update property | ✅ | ✅ | ❌ | ✅ |
| Delete property | ✅ | ❌ | ❌ | ✅ |

### Notes

- **Create Property**: COMPANY_ADMIN and MANAGER can create properties for their company.
- **View Properties**: All company members can view properties from their company.
- **Update Property**: COMPANY_ADMIN and MANAGER can update property details.
- **Delete Property**: Only COMPANY_ADMIN can delete properties (soft delete).
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
  "path": "/api/v1/properties"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `PROPERTY_NOT_FOUND` | 404 | The property doesn't exist or user doesn't have access |
| `VALIDATION_ERROR` | 400 | Request validation failed (check error details) |
| `INSUFFICIENT_PERMISSIONS` | 403 | User doesn't have required permissions |
| `COMPANY_NOT_FOUND` | 404 | Company doesn't exist (when creating property) |

### Handling Errors

Always check the `success` field in the response:

```javascript
if (!response.success) {
  const errorCode = response.error.code;
  const errorMessage = response.error.message;
  
  switch (errorCode) {
    case 'PROPERTY_NOT_FOUND':
      // Show message: "Property not found"
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

### Create Property

```javascript
const createProperty = async (propertyData) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8000/api/v1/properties', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(propertyData),
  });

  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.error.message);
  }
};

// Usage
const newProperty = await createProperty({
  name: 'Sunset Apartments',
  companyId: '123e4567-e89b-12d3-a456-426614174000',
  propertyType: 'APARTMENT',
  city: 'New York',
  state: 'NY',
});
```

### List Properties with Filters

```javascript
const getProperties = async (filters = {}) => {
  const token = localStorage.getItem('token');
  
  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.page) queryParams.append('page', filters.page);
  if (filters.limit) queryParams.append('limit', filters.limit);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.propertyType) queryParams.append('propertyType', filters.propertyType);
  if (filters.city) queryParams.append('city', filters.city);
  if (filters.state) queryParams.append('state', filters.state);
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
  
  const url = `http://localhost:8000/api/v1/properties?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      properties: data.data,
      pagination: data.pagination,
    };
  } else {
    throw new Error(data.error.message);
  }
};

// Usage
const { properties, pagination } = await getProperties({
  status: 'AVAILABLE',
  propertyType: 'APARTMENT',
  city: 'New York',
  page: 1,
  limit: 20,
});
```

### Get Property by ID

```javascript
const getProperty = async (propertyId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/properties/${propertyId}`,
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

### Update Property

```javascript
const updateProperty = async (propertyId, updates) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/properties/${propertyId}`,
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
const updated = await updateProperty('123e4567-e89b-12d3-a456-426614174000', {
  status: 'MAINTENANCE',
  description: 'Under renovation',
});
```

### Delete Property

```javascript
const deleteProperty = async (propertyId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/properties/${propertyId}`,
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

const PropertyList = () => {
  const [properties, setProperties] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    propertyType: '',
    search: '',
    page: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProperties();
  }, [filters]);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const result = await getProperties(filters);
      setProperties(result.properties);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <input
          type="text"
          placeholder="Search properties..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
        >
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {properties.map((property) => (
            <div key={property.id}>
              <h3>{property.name}</h3>
              <p>{property.city}, {property.state}</p>
              <p>Status: {property.status}</p>
              <p>Units: {property.numberOfUnits}</p>
            </div>
          ))}
        </div>
      )}

      {pagination && (
        <div>
          <button
            disabled={pagination.page === 1}
            onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Best Practices

### Property Creation

- **Required fields**: Always provide name, companyId, and propertyType
- **Location data**: Include address details for better searchability
- **Coordinates**: Provide latitude/longitude for mapping features
- **Images**: Use high-quality images hosted on reliable CDN

### Filtering and Search

- **Pagination**: Always use pagination for large lists (default limit: 10)
- **Search**: Use search parameter for name/address/city searches
- **Combining filters**: Multiple filters can be combined for precise results
- **Sorting**: Use sortBy and sortOrder for consistent ordering

### Performance

- **List queries**: Only fetch necessary fields in list views
- **Detail queries**: Use detail endpoint for full property information
- **Pagination**: Respect page limits (max 100 items per page)
- **Caching**: Cache property lists when appropriate

### Data Management

- **Unit counts**: Use `numberOfUnits` for display, `totalUnits` for capacity
- **Soft delete**: Understand that delete is soft (isActive: false)
- **Updates**: Use PATCH for partial updates, not full replacements
- **Validation**: Validate data on frontend before sending to API

### Error Handling

- **404 errors**: Handle property not found gracefully
- **403 errors**: Show appropriate messages for permission issues
- **Validation errors**: Display field-specific validation messages
- **Network errors**: Implement retry logic for network failures

---

## Quick Reference

| Route | Method | Auth Required | Purpose | Required Role |
|-------|--------|---------------|---------|---------------|
| `/properties` | POST | Yes | Create property | COMPANY_ADMIN, MANAGER |
| `/properties` | GET | Yes | List properties | Company member |
| `/properties/:id` | GET | Yes | Get property details | Company member |
| `/properties/:id` | PATCH | Yes | Update property | COMPANY_ADMIN, MANAGER |
| `/properties/:id` | DELETE | Yes | Delete property | COMPANY_ADMIN |

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

