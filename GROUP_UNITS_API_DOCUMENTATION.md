# Group-Based Unit Creation API Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Base Configuration](#base-configuration)
- [Core Concepts](#core-concepts)
- [API Routes](#api-routes)
- [Use Cases & Examples](#use-cases--examples)
- [Permissions & Access Control](#permissions--access-control)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Best Practices](#best-practices)

---

## Overview

This documentation covers the group-based unit creation feature for the Property Management System. This feature allows COMPANY_ADMIN users to create multiple units at once with shared attributes, significantly speeding up the unit setup process for properties with many similar units.

**Key Features:**
- Create multiple units in a single API call
- Auto-generate sequential unit numbers (A1, A2, A3...)
- Apply shared attributes to groups of units
- Units remain fully editable individually after creation
- Safe and isolated - does not affect existing unit CRUD operations

**Important**: 
- This feature is COMPANY_ADMIN only (super admins can also use it)
- Property must exist and belong to your company
- All routes require JWT Bearer token authentication
- Units are created as individual database records (not grouped)
- Unit numbers are automatically generated but can be edited later

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

### Group-Based Creation

Instead of creating units one by one, you can define groups of units with shared attributes:

- **Group**: A definition specifying how many units to create with specific shared attributes
- **Shared Attributes**: Fields like bedrooms, bathrooms, rent, size that apply to all units in a group
- **Individual Units**: Each unit is still created as a separate database record and can be edited independently

### Auto-Generated Unit Numbers

Unit numbers are automatically generated in the format `A1`, `A2`, `A3`, etc.:

- The system finds existing units with "A" prefix and numeric suffix
- Starts from the next available number
- If no "A" prefixed units exist, starts from A1
- If property has units like "101", "102" (non-A prefix), starts from A1
- Unit numbers can be edited individually after creation

**Example:**
- Property has existing units: A1, A2, A5
- Next group creation will start from A6

### Unit Type Derivation

If `unitType` is not specified in a group, it is automatically derived from the `bedrooms` field:

| Bedrooms | Derived UnitType |
|----------|-----------------|
| 0 or null/undefined | STUDIO |
| 1 | ONE_BEDROOM |
| 2 | TWO_BEDROOM |
| 3 | THREE_BEDROOM |
| 4+ | FOUR_PLUS_BEDROOM |

You can explicitly specify `unitType` to override this automatic derivation.

### Default Values

When creating units through groups:
- **Status**: Always set to `AVAILABLE` (cannot be changed in group creation)
- **Company ID**: Automatically populated from the property
- **Unit Numbers**: Auto-generated sequentially (A1, A2, A3...)
- **Unit Type**: Derived from bedrooms if not specified

### Relationship to Existing Features

- **Existing Unit CRUD**: Completely unchanged and unaffected
- **Manual Unit Creation**: Still available via `POST /api/v1/units`
- **Unit Editing**: All created units can be edited individually via `PATCH /api/v1/units/:id`
- **Unit Deletion**: All created units can be deleted individually via `DELETE /api/v1/units/:id`

---

## API Routes

### Create Units from Groups

**Endpoint**: `POST /api/v1/properties/:propertyId/units/groups`  
**Authentication**: Required (JWT + Company context)  
**Description**: Create multiple units at once by defining groups with shared attributes. Each unit is created as an individual record with auto-generated unit numbers.

**Required Permissions**: COMPANY_ADMIN only (or Super Admin)

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | UUID | Yes | Property ID where units will be created |

#### Request Body

**Structure:**
```json
{
  "groups": [
    {
      "count": 10,
      "bedrooms": 1,
      "bathrooms": 1,
      "rent": 500,
      "size": 50
    },
    {
      "count": 5,
      "bedrooms": 2,
      "bathrooms": 2,
      "rent": 800,
      "size": 80
    }
  ]
}
```

**Minimum Required Fields:**
```json
{
  "groups": [
    {
      "count": 10,
      "rent": 500
    }
  ]
}
```

**Full Example with Optional Fields:**
```json
{
  "groups": [
    {
      "count": 10,
      "bedrooms": 1,
      "bathrooms": 1,
      "rent": 500,
      "size": 50,
      "unitType": "ONE_BEDROOM",
      "depositAmount": 500,
      "floorNumber": 1,
      "description": "Standard one-bedroom units",
      "notes": "Group created for new building"
    },
    {
      "count": 5,
      "bedrooms": 2,
      "bathrooms": 2,
      "rent": 800,
      "size": 80,
      "unitType": "TWO_BEDROOM",
      "depositAmount": 800,
      "floorNumber": 2,
      "description": "Premium two-bedroom units",
      "notes": "Corner units with better views"
    }
  ]
}
```

#### Request Body Schema

##### Group Object (`UnitGroupDto`)

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `count` | integer | Yes | >= 1 | Number of units to create in this group |
| `rent` | number | Yes | >= 0, max 2 decimals | Monthly rent amount (maps to `monthlyRent`) |
| `bedrooms` | integer | No | >= 0 | Number of bedrooms (used to derive `unitType` if not provided) |
| `bathrooms` | number | No | >= 0, max 1 decimal | Number of bathrooms (can include half bathrooms, e.g., 1.5) |
| `size` | integer | No | >= 0 | Square footage (maps to `squareFootage`) |
| `unitType` | enum | No | UnitType enum | Unit type (if not provided, derived from `bedrooms`) |
| `depositAmount` | number | No | >= 0, max 2 decimals | Security deposit amount |
| `floorNumber` | integer | No | - | Floor number |
| `description` | string | No | - | Unit description |
| `notes` | string | No | - | Internal notes |

##### Available UnitType Values

- `STUDIO`
- `ONE_BEDROOM`
- `TWO_BEDROOM`
- `THREE_BEDROOM`
- `FOUR_PLUS_BEDROOM`
- `SHOP`
- `COMMERCIAL`
- `STORAGE`
- `PARKING`
- `PENTHOUSE`

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "createdUnits": 15,
    "propertyId": "123e4567-e89b-12d3-a456-426614174000"
  },
  "message": "Successfully created 15 unit(s)"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `createdUnits` | integer | Total number of units created across all groups |
| `propertyId` | UUID | Property ID where units were created |

---

## Use Cases & Examples

### Use Case 1: Creating Standard Units for a New Building

**Scenario**: A property manager needs to create 20 identical one-bedroom units for a new building.

**Request:**
```json
POST /api/v1/properties/123e4567-e89b-12d3-a456-426614174000/units/groups

{
  "groups": [
    {
      "count": 20,
      "bedrooms": 1,
      "bathrooms": 1,
      "rent": 1200,
      "size": 650,
      "depositAmount": 1200,
      "description": "Standard one-bedroom unit"
    }
  ]
}
```

**Result**: Creates 20 units (A1 through A20) with identical attributes.

### Use Case 2: Creating Multiple Unit Types

**Scenario**: A property has different unit types - 10 studio units, 15 one-bedroom units, and 8 two-bedroom units.

**Request:**
```json
POST /api/v1/properties/123e4567-e89b-12d3-a456-426614174000/units/groups

{
  "groups": [
    {
      "count": 10,
      "bedrooms": 0,
      "bathrooms": 1,
      "rent": 800,
      "size": 400,
      "description": "Studio units"
    },
    {
      "count": 15,
      "bedrooms": 1,
      "bathrooms": 1,
      "rent": 1200,
      "size": 650,
      "description": "One-bedroom units"
    },
    {
      "count": 8,
      "bedrooms": 2,
      "bathrooms": 2,
      "rent": 1800,
      "size": 950,
      "description": "Two-bedroom units"
    }
  ]
}
```

**Result**: Creates 33 units total:
- A1-A10: Studio units (unitType: STUDIO)
- A11-A25: One-bedroom units (unitType: ONE_BEDROOM)
- A26-A33: Two-bedroom units (unitType: TWO_BEDROOM)

### Use Case 3: Adding Units to Existing Property

**Scenario**: A property already has units A1-A50. The manager wants to add 5 more premium units.

**Request:**
```json
POST /api/v1/properties/123e4567-e89b-12d3-a456-426614174000/units/groups

{
  "groups": [
    {
      "count": 5,
      "bedrooms": 2,
      "bathrooms": 2,
      "rent": 2000,
      "size": 1100,
      "unitType": "TWO_BEDROOM",
      "depositAmount": 2000,
      "floorNumber": 10,
      "description": "Premium corner units",
      "notes": "Top floor units with better views"
    }
  ]
}
```

**Result**: Creates 5 new units (A51-A55) continuing the sequence from existing units.

### Use Case 4: Explicit Unit Type Override

**Scenario**: Creating commercial units where bedroom count doesn't apply.

**Request:**
```json
POST /api/v1/properties/123e4567-e89b-12d3-a456-426614174000/units/groups

{
  "groups": [
    {
      "count": 8,
      "rent": 2500,
      "size": 1200,
      "unitType": "COMMERCIAL",
      "description": "Ground floor commercial spaces"
    }
  ]
}
```

**Result**: Creates 8 commercial units with explicitly set unitType.

---

## Permissions & Access Control

### Permission Matrix

| Action | COMPANY_ADMIN | MANAGER | Other Roles | Super Admin |
|--------|---------------|---------|-------------|-------------|
| Create units from groups | ✅ | ❌ | ❌ | ✅ |

### Notes

- **COMPANY_ADMIN Only**: This feature is restricted to COMPANY_ADMIN role only (unlike individual unit creation which allows COMPANY_ADMIN and MANAGER)
- **Super Admin**: Super admins can use this feature across all companies
- **Property Access**: User must have access to the property's company
- **Company Context**: Requires company context in JWT token (unless super admin)

### Access Control Flow

1. System validates JWT token and extracts user information
2. System checks if user is super admin (bypasses all checks)
3. System validates property exists and is active
4. System validates property belongs to user's company
5. System validates user is COMPANY_ADMIN in that company
6. System creates units with auto-generated numbers

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
  "path": "/api/v1/properties/123.../units/groups"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `PROPERTY_NOT_FOUND` | 404 | The property doesn't exist or user doesn't have access to it |
| `INSUFFICIENT_PERMISSIONS` | 403 | User is not COMPANY_ADMIN (only COMPANY_ADMIN can use this feature) |
| `VALIDATION_ERROR` | 400 | Request validation failed (check error details) |
| `UNIT_NUMBER_EXISTS` | 409 | Generated unit number already exists (rare, indicates race condition) |

### Validation Errors

#### Invalid Count
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Count must be at least 1",
    "details": {
      "groups[0].count": "Count must be at least 1"
    }
  }
}
```

#### Invalid Rent
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Rent must be a positive number",
    "details": {
      "groups[0].rent": "Rent must be a positive number"
    }
  }
}
```

#### Missing Required Field
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Rent is required",
    "details": {
      "groups[0].rent": "Rent is required"
    }
  }
}
```

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
      // Show message: "Only company administrators can create units in groups"
      break;
    case 'VALIDATION_ERROR':
      // Show validation errors from error.details
      break;
    // ... handle other errors
  }
}
```

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

```javascript
const createUnitsFromGroups = async (propertyId, groups) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(
    `http://localhost:8000/api/v1/properties/${propertyId}/units/groups`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ groups }),
    }
  );

  const data = await response.json();
  
  if (data.success) {
    console.log(`Created ${data.data.createdUnits} units`);
    return data.data;
  } else {
    throw new Error(data.error.message);
  }
};

// Usage
try {
  const result = await createUnitsFromGroups(
    '123e4567-e89b-12d3-a456-426614174000',
    [
      {
        count: 10,
        bedrooms: 1,
        bathrooms: 1,
        rent: 500,
        size: 50,
      },
      {
        count: 5,
        bedrooms: 2,
        bathrooms: 2,
        rent: 800,
        size: 80,
      },
    ]
  );
  console.log(`Successfully created ${result.createdUnits} units`);
} catch (error) {
  console.error('Error creating units:', error.message);
}
```

### Axios Example

```javascript
import axios from 'axios';

const createUnitsFromGroups = async (propertyId, groups) => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.post(
      `/api/v1/properties/${propertyId}/units/groups`,
      { groups },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    return response.data.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      throw new Error(error.response.data.error.message);
    } else {
      // Network error
      throw new Error('Network error');
    }
  }
};
```

### React Hook Example

```javascript
import { useState } from 'react';
import axios from 'axios';

const useCreateUnitsFromGroups = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createUnits = async (propertyId, groups) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/v1/properties/${propertyId}/units/groups`,
        { groups },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      setLoading(false);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create units');
      setLoading(false);
      throw err;
    }
  };

  return { createUnits, loading, error };
};

// Usage in component
function CreateUnitsForm({ propertyId }) {
  const { createUnits, loading, error } = useCreateUnitsFromGroups();
  const [groups, setGroups] = useState([
    { count: 10, bedrooms: 1, bathrooms: 1, rent: 500, size: 50 }
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await createUnits(propertyId, groups);
      alert(`Created ${result.createdUnits} units successfully!`);
    } catch (err) {
      // Error is set in the hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Units'}
      </button>
    </form>
  );
}
```

### cURL Example

```bash
curl -X POST \
  http://localhost:8000/api/v1/properties/123e4567-e89b-12d3-a456-426614174000/units/groups \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "groups": [
      {
        "count": 10,
        "bedrooms": 1,
        "bathrooms": 1,
        "rent": 500,
        "size": 50
      },
      {
        "count": 5,
        "bedrooms": 2,
        "bathrooms": 2,
        "rent": 800,
        "size": 80
      }
    ]
  }'
```

---

## Best Practices

### 1. Batch Size Recommendations

- **Small Batches (1-20 units)**: Recommended for most use cases
- **Medium Batches (21-50 units)**: Acceptable, but consider splitting if you have many groups
- **Large Batches (51+ units)**: Consider splitting into multiple requests for better error handling

### 2. Unit Number Management

- Unit numbers are auto-generated but can be edited later
- If you need custom unit numbers, create units individually or edit them after group creation
- Auto-generated numbers (A1, A2, A3...) are sequential and continue from existing "A" prefixed units

### 3. Unit Type Specification

- **Explicit is Better**: If you know the exact unit type, specify it explicitly
- **Derivation Fallback**: Let the system derive from bedrooms for standard residential units
- **Commercial/Other Types**: Always specify `unitType` explicitly for SHOP, COMMERCIAL, STORAGE, PARKING, PENTHOUSE

### 4. Error Handling

- Always validate your request data before sending
- Handle validation errors gracefully
- Check unit creation success before proceeding
- Consider implementing retry logic for network errors

### 5. Post-Creation Actions

- After creating units, you can fetch them to verify creation
- Use `GET /api/v1/units/by-property/:propertyId` to list all units
- Edit individual units as needed using `PATCH /api/v1/units/:id`
- Unit numbers can be changed after creation if needed

### 6. Property Setup Workflow

1. **Create Property**: First create the property via `POST /api/v1/properties`
2. **Create Units in Groups**: Use this endpoint to create units efficiently
3. **Verify Creation**: Fetch units to verify they were created correctly
4. **Edit as Needed**: Make individual adjustments to units if required
5. **Set Up Leases**: Units are now ready for lease creation

### 7. Data Consistency

- All units in a group share the same attributes at creation time
- After creation, each unit is independent and can be modified separately
- Changes to one unit do not affect others in the same group
- Group definitions are not stored - only individual units exist in the database

---

## Frequently Asked Questions (FAQ)

### Q: Can I create units with different statuses?
**A**: No, all units created via groups have status `AVAILABLE`. You can update individual units after creation to change their status.

### Q: What happens if I create units in a property that already has units?
**A**: The system finds existing "A" prefixed units and continues the sequence. If property has A1-A10, new units will be A11, A12, etc.

### Q: Can I specify custom unit numbers in groups?
**A**: No, unit numbers are auto-generated. You can edit them individually after creation using the update unit endpoint.

### Q: What if a group has a very large count (e.g., 1000 units)?
**A**: The system will create all units, but consider splitting into smaller batches for better error handling and performance monitoring.

### Q: Can I use this endpoint if the property has no existing units?
**A**: Yes, the system will start from A1 if no "A" prefixed units exist.

### Q: What if the property has units with non-A prefixes (e.g., "101", "102")?
**A**: The system only considers "A" prefixed units when determining the next number. Non-A prefixed units don't affect the sequence, so it will start from A1.

### Q: Can MANAGER role use this endpoint?
**A**: No, this endpoint is COMPANY_ADMIN only. MANAGER can still create units individually via `POST /api/v1/units`.

### Q: Are groups stored in the database?
**A**: No, groups are only used for creation. Each unit is created as an individual database record.

### Q: Can I update multiple units at once?
**A**: No, unit updates must be done individually via `PATCH /api/v1/units/:id`. This endpoint is for creation only.

---

## Related Documentation

- [Unit API Documentation](./UNIT_API_DOCUMENTATION.md) - Individual unit CRUD operations
- [Property API Documentation](./PROPERTY_API_DOCUMENTATION.md) - Property management
- [Lease API Documentation](./LEASE_API_DOCUMENTATION.md) - Creating leases for units

---

## Changelog

### Version 1.0.0
- Initial release of group-based unit creation feature
- Support for creating multiple units with shared attributes
- Auto-generation of sequential unit numbers (A1, A2, A3...)
- Automatic unit type derivation from bedrooms
- COMPANY_ADMIN only access control

