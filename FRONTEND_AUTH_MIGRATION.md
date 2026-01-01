# Frontend Authentication Migration Guide

## HTTP-Only Cookie Authentication Migration

This document provides a complete guide for migrating the frontend application from localStorage-based JWT tokens to HTTP-only cookie authentication.

---

## Overview

The backend has been migrated to use **HTTP-only cookies** for authentication instead of returning tokens in response bodies. This provides better security by:

- ✅ Protecting tokens from XSS attacks (JavaScript cannot access HTTP-only cookies)
- ✅ Automatically sending cookies with requests
- ✅ Using industry-standard security practices

---

## What Changed

### Before (localStorage)
- Tokens returned in API response body
- Frontend stored tokens in `localStorage`
- Frontend manually added `Authorization: Bearer <token>` header to requests
- Frontend manually managed token expiration

### After (HTTP-only Cookies)
- Tokens automatically set as HTTP-only cookies by backend
- Frontend **does not** store tokens (cookies are automatic)
- Frontend **does not** add Authorization headers (cookies sent automatically)
- Frontend handles token refresh via `/auth/refresh` endpoint

---

## Required Changes

### 1. Remove localStorage Token Storage

**Remove all code that stores/retrieves tokens from localStorage:**

```typescript
// ❌ REMOVE - Old code
localStorage.setItem('token', token);
const token = localStorage.getItem('token');
localStorage.removeItem('token');
```

**Replace with:**
```typescript
// ✅ Cookies are automatically handled by the browser
// No manual storage needed!
```

### 2. Enable Credentials in API Requests

**Critical:** All API requests must include credentials (cookies).

#### For Axios:

```typescript
// Global axios configuration
import axios from 'axios';

axios.defaults.withCredentials = true;

// Or per-request
axios.get('/api/v1/auth/me', {
  withCredentials: true
});
```

#### For Fetch API:

```typescript
// Global fetch configuration (if using a wrapper)
fetch('/api/v1/auth/me', {
  credentials: 'include'  // Required!
});

// Or create a fetch wrapper
const apiFetch = (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};
```

#### For Other HTTP Clients:

- **Superagent**: `.withCredentials()`
- **Request**: `credentials: 'include'` in options
- **jQuery AJAX**: `xhrFields: { withCredentials: true }`

### 3. Remove Authorization Headers

**Remove all manual Authorization headers:**

```typescript
// ❌ REMOVE - Old code
axios.get('/api/v1/properties', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

**Replace with:**
```typescript
// ✅ Cookies are sent automatically
axios.get('/api/v1/properties', {
  withCredentials: true
});
```

### 4. Update Authentication Flow

#### Login/Register Flow

**Before:**
```typescript
const response = await axios.post('/api/v1/auth/login', { email, password });
const token = response.data.data.access_token;
localStorage.setItem('token', token);
// Redirect to dashboard
```

**After:**
```typescript
const response = await axios.post('/api/v1/auth/login', 
  { email, password },
  { withCredentials: true }
);
// Cookies are automatically set by the browser
// No need to store anything!
// Redirect to dashboard
```

#### Check Authentication Status

**Before:**
```typescript
const isAuthenticated = !!localStorage.getItem('token');
```

**After:**
```typescript
// Call the /auth/me endpoint to check authentication
const checkAuth = async () => {
  try {
    const response = await axios.get('/api/v1/auth/me', {
      withCredentials: true
    });
    return response.data.success; // User is authenticated
  } catch (error) {
    return false; // Not authenticated
  }
};
```

### 5. Implement Token Refresh

When the access token expires (15 minutes), the backend will return a 401 error. Handle this by automatically refreshing the token:

```typescript
// Axios interceptor example
import axios from 'axios';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return axios(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token
        await axios.post('/api/v1/auth/refresh', {}, {
          withCredentials: true
        });
        
        // Token refreshed successfully, process queued requests
        processQueue(null);
        
        // Retry original request
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        processQueue(refreshError, null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### 6. Update Logout Flow

**Before:**
```typescript
const logout = () => {
  localStorage.removeItem('token');
  // Redirect to login
};
```

**After:**
```typescript
const logout = async () => {
  try {
    // Call logout endpoint to clear cookies on server
    await axios.post('/api/v1/auth/logout', {}, {
      withCredentials: true
    });
  } catch (error) {
    // Even if request fails, redirect to login
    console.error('Logout error:', error);
  } finally {
    // Clear any local state
    // Redirect to login
    window.location.href = '/login';
  }
};
```

---

## Complete Example: Updated Auth Hook/Service

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

// Configure axios globally
axios.defaults.withCredentials = true;

interface User {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/v1/auth/me');
      setUser(response.data.data);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/v1/auth/login', {
        email,
        password,
      });
      
      // Cookies are automatically set, no need to store tokens
      const userData = response.data.data.user;
      setUser(userData);
      setIsAuthenticated(true);
      
      return {
        success: true,
        requiresCompanySelection: response.data.data.requiresCompanySelection,
        companies: response.data.data.companies,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed',
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await axios.post('/api/v1/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  // Select company
  const selectCompany = async (companyId: string) => {
    try {
      const response = await axios.post('/api/v1/auth/select-company', {
        companyId,
      });
      setUser(response.data.data.user);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to select company',
      };
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    selectCompany,
    checkAuth,
  };
};
```

---

## API Endpoints Reference

### Authentication Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/v1/auth/register` | POST | No | Register new user (sets cookies) |
| `/api/v1/auth/login` | POST | No | Login user (sets cookies) |
| `/api/v1/auth/refresh` | POST | No* | Refresh access token (uses refresh cookie) |
| `/api/v1/auth/logout` | POST | Yes | Logout and clear cookies |
| `/api/v1/auth/me` | GET | Yes | Get current user |
| `/api/v1/auth/companies` | GET | Yes | Get user's companies |
| `/api/v1/auth/select-company` | POST | Yes | Select company (sets new cookies) |
| `/api/v1/auth/switch-company` | POST | Yes | Switch company (sets new cookies) |

*Refresh endpoint doesn't require auth header, but requires refresh token cookie

---

## Response Format

### Login/Register Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "name": "John Doe",
      "isActive": true,
      "isSuperAdmin": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "companies": [
      {
        "id": "456e7890-e89b-12d3-a456-426614174001",
        "name": "Acme Corp",
        "email": "contact@acme.com"
      }
    ],
    "requiresCompanySelection": false
  },
  "message": "User logged in successfully"
}
```

**Note:** `access_token` is **no longer** in the response. Tokens are set as HTTP-only cookies automatically.

---

## Error Handling

### 401 Unauthorized

When you receive a 401 error:

1. **First attempt**: Try refreshing the token via `/auth/refresh`
2. **If refresh succeeds**: Retry the original request
3. **If refresh fails**: Redirect to login page

### Token Refresh Flow

```typescript
// Pseudo-code for token refresh handling
if (error.status === 401) {
  try {
    await refreshToken(); // Calls /auth/refresh
    retryOriginalRequest();
  } catch {
    redirectToLogin();
  }
}
```

---

## CORS Configuration

**Important:** Ensure your frontend domain is properly configured in the backend's `CORS_ORIGIN` environment variable.

- ✅ **Correct**: `CORS_ORIGIN=http://localhost:3000` (specific domain)
- ❌ **Incorrect**: `CORS_ORIGIN=*` (wildcard doesn't work with credentials)

The backend must allow your frontend origin when using credentials.

---

## Migration Checklist

- [ ] Remove all `localStorage.setItem('token', ...)` calls
- [ ] Remove all `localStorage.getItem('token')` calls
- [ ] Remove all `localStorage.removeItem('token')` calls
- [ ] Remove all `Authorization: Bearer` headers from API requests
- [ ] Add `withCredentials: true` to all axios requests (or configure globally)
- [ ] Add `credentials: 'include'` to all fetch requests
- [ ] Update login/register handlers to not store tokens
- [ ] Update logout handler to call `/auth/logout` endpoint
- [ ] Implement automatic token refresh on 401 errors
- [ ] Update authentication check to use `/auth/me` endpoint
- [ ] Test login flow
- [ ] Test logout flow
- [ ] Test token refresh flow
- [ ] Test protected routes
- [ ] Verify cookies are being set (check browser DevTools → Application → Cookies)

---

## Testing in Browser DevTools

### Verify Cookies Are Set

1. Open Browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Navigate to **Cookies** → Your domain
4. After login, you should see:
   - `access_token` (HttpOnly, Secure, SameSite=Lax)
   - `refresh_token` (HttpOnly, Secure, SameSite=Lax)

**Note:** You cannot view the cookie values (they're HttpOnly), but you can see they exist.

### Verify Requests Include Cookies

1. Open Browser DevTools → **Network** tab
2. Make an API request
3. Click on the request
4. Go to **Headers** tab
5. Check **Request Headers** → You should see `Cookie: access_token=...; refresh_token=...`

---

## Common Issues & Solutions

### Issue: Cookies Not Being Sent

**Solution:**
- Ensure `withCredentials: true` (axios) or `credentials: 'include'` (fetch) is set
- Verify CORS_ORIGIN is configured correctly (not `*`)
- Check that the request is to the same domain or properly configured CORS domain

### Issue: 401 Errors After Login

**Solution:**
- Verify cookies are being set (check DevTools)
- Ensure credentials are included in requests
- Check that the backend CORS configuration allows your origin

### Issue: Token Refresh Not Working

**Solution:**
- Ensure refresh endpoint is called with `withCredentials: true`
- Verify refresh token cookie exists
- Check that refresh endpoint is public (doesn't require auth header)

### Issue: Logout Not Clearing Cookies

**Solution:**
- Ensure logout endpoint is called with `withCredentials: true`
- Verify logout endpoint is being called successfully
- Check browser DevTools to see if cookies are cleared

---

## Security Benefits

By using HTTP-only cookies:

1. **XSS Protection**: JavaScript cannot access tokens, preventing XSS attacks
2. **Automatic Transmission**: Cookies are sent automatically with requests
3. **Secure by Default**: Cookies can be configured with Secure, HttpOnly, and SameSite flags
4. **Industry Standard**: Used by banks, enterprise apps, and major SaaS platforms

---

## Support

If you encounter issues during migration:

1. Check browser console for errors
2. Verify cookies in DevTools → Application → Cookies
3. Check Network tab to see if cookies are being sent
4. Verify backend CORS configuration
5. Review this documentation for common issues

---

## Quick Reference

### Before (localStorage)
```typescript
// Store token
localStorage.setItem('token', token);

// Use token
axios.get('/api', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});

// Remove token
localStorage.removeItem('token');
```

### After (HTTP-only Cookies)
```typescript
// No storage needed - cookies are automatic!

// Use token (cookies sent automatically)
axios.get('/api', { withCredentials: true });

// Remove token
axios.post('/api/v1/auth/logout', {}, { withCredentials: true });
```

---

**Last Updated:** December 27, 2025  
**Backend API Version:** v1  
**Migration Status:** ✅ Backend Complete - Frontend Migration Required



