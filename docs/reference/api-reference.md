---
title: "API Reference"
description: "Complete API documentation for Vikings Event Management"
created: "2025-01-06"
last_updated: "2025-01-06"
version: "1.0.0"
tags: ["api", "reference", "endpoints", "documentation"]
related_docs: ["database-schema.md", "environment-variables.md"]
---

# API Reference

Complete API documentation for the Vikings Event Management application.

## 🔗 Base URL

```
Production: https://vikings-osm-backend.onrender.com
Development: https://vikings-osm-backend.onrender.com
Local Backend: http://localhost:3000 (if running backend locally)
```

**Note**: This is a proxy/wrapper backend that interfaces with the Online Scout Manager (OSM) API, not a direct REST API.

## 🔐 Authentication

All API endpoints require authentication via OAuth 2.0 with Online Scout Manager.

### Authentication Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Management
- **Access Token**: Required for all API calls
- **Refresh Token**: Used to obtain new access tokens
- **Token Expiry**: Access tokens expire after 1 hour
- **Automatic Refresh**: Client automatically refreshes tokens

## 📊 Events API

### Get Events List
```http
GET /get-events?sectionid={id}&termid={id}
```

**Parameters:**
- `sectionid` (required): Scout section ID
- `termid` (required): OSM term ID

**Response:**
```json
{
  "items": [
    {
      "eventid": "12345",
      "name": "Weekend Camp",
      "startdate": "2025-03-15",
      "enddate": "2025-03-17",
      "starttime": "10:00:00",
      "endtime": "16:00:00",
      "location": "Scout Camp Site",
      "notes": "Annual weekend camping trip",
      "sectionid": "123",
      "cost": "25.00"
    }
  ],
  "_rateLimitInfo": {
    "remaining": 95,
    "reset": 1641024000
  },
  "_cacheTimestamp": 1641020400000
}
```

### Get Event Attendance
```http
GET /get-event-attendance?sectionid={id}&termid={id}&eventid={id}
```

**Parameters:**
- `sectionid` (required): Scout section ID
- `termid` (required): OSM term ID
- `eventid` (required): Event ID

**Response:**
```json
{
  "items": [
    {
      "scoutid": "789",
      "firstname": "John",
      "lastname": "Doe",
      "attending": "Yes",
      "payment": "Paid",
      "notes": "Vegetarian meal required"
    }
  ],
  "_rateLimitInfo": {
    "remaining": 94,
    "reset": 1641024000
  }
}
```

### Create Event (Admin Only)
```http
POST /api/events
```

**Request Body:**
```json
{
  "title": "New Event",
  "description": "Event description",
  "start_date": "2025-03-15T10:00:00Z",
  "end_date": "2025-03-17T16:00:00Z",
  "location": "Event Location",
  "section_id": "uuid",
  "equipment_list": ["Item 1", "Item 2"],
  "medical_requirements": true
}
```

## 👥 Members API

### Get Members Grid
```http
POST /get-members-grid
```

**Request Body:**
```json
{
  "sectionid": "123",
  "termid": "456",
  "section": "beavers"
}
```

**Response:**
```json
{
  "data": {
    "members": [
      {
        "member_id": "789",
        "first_name": "John",
        "last_name": "Doe",
        "section_id": "123",
        "patrol_id": "1",
        "contact_groups": {
          "essential_information": {
            "allergies": "None",
            "medical_details": "Asthma",
            "dietary_requirements": "Vegetarian"
          }
        }
      }
    ]
  },
  "_rateLimitInfo": {
    "remaining": 93,
    "reset": 1641024000
  }
}
```

### Get Member Details
```http
GET /api/members/{member_id}
```

**Response:**
```json
{
  "id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "2010-05-15",
  "section_id": "uuid",
  "active": true,
  "contact_info": {
    "email": "john.doe@example.com",
    "phone": "+44 7700 900456",
    "address": {
      "street": "123 Main St",
      "city": "London",
      "postcode": "SW1A 1AA"
    }
  },
  "emergency_contacts": [
    {
      "name": "Jane Doe",
      "phone": "+44 7700 900123",
      "relationship": "Mother",
      "primary": true
    }
  ],
  "medical_alerts": true,
  "created_at": "2025-01-06T12:00:00Z",
  "updated_at": "2025-01-06T12:00:00Z"
}
```

## 🔧 FlexiRecords API (Custom Data)

### Get Available FlexiRecords
```http
GET /get-flexi-records?sectionid={id}&archived={y/n}
```

**Parameters:**
- `sectionid` (required): Scout section ID
- `archived` (optional): Include archived records (y/n, default: n)

**Response:**
```json
{
  "items": [
    {
      "flexirecordid": "456",
      "name": "Viking Event Mgmt",
      "archived": "0"
    }
  ]
}
```

### Get FlexiRecord Data
```http
GET /get-single-flexi-record?flexirecordid={id}&sectionid={id}&termid={id}
```

**Response:**
```json
{
  "items": [
    {
      "scoutid": "789",
      "firstname": "John",
      "lastname": "Doe",
      "f_1": "Red Group",
      "f_2": "Leader"
    }
  ]
}
```

### Record Attendance
```http
POST /api/events/{event_id}/attendance
```

**Request Body:**
```json
{
  "member_id": "uuid",
  "status": "present",
  "check_in_time": "2025-03-15T10:15:00Z",
  "notes": "Optional notes"
}
```

### Update Attendance
```http
PUT /api/events/{event_id}/attendance/{member_id}
```

**Request Body:**
```json
{
  "status": "absent",
  "check_out_time": "2025-03-15T15:30:00Z",
  "notes": "Left early due to illness"
}
```

## 🏥 Medical Data API

### Get Member Medical Info (Restricted)
```http
GET /api/members/{member_id}/medical
```

**Authorization:** Requires medical data access permissions

**Response:**
```json
{
  "member_id": "uuid",
  "medical_conditions": [
    {
      "condition": "Asthma",
      "severity": "Moderate",
      "medication": "Salbutamol inhaler",
      "action_plan": "Use inhaler if breathing difficulties"
    }
  ],
  "allergies": [
    {
      "allergen": "Nuts",
      "severity": "Severe",
      "reaction": "Anaphylaxis",
      "treatment": "EpiPen auto-injector"
    }
  ],
  "medications": [
    {
      "name": "Salbutamol",
      "dosage": "2 puffs as needed",
      "frequency": "As required"
    }
  ],
  "emergency_medical_contact": {
    "name": "Dr. Smith",
    "phone": "+44 20 7946 0958",
    "practice": "Local GP Surgery"
  },
  "last_updated": "2025-01-06T12:00:00Z"
}
```

### Emergency Medical Access
```http
POST /api/members/{member_id}/medical/emergency-access
```

**Request Body:**
```json
{
  "reason": "MEDICAL_EMERGENCY",
  "location": "Scout Camp",
  "incident_details": "Member collapsed during activity"
}
```

## 🔐 Authentication API

### Get User Startup Data
```http
GET /get-startup-data
```

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "user": {
    "userid": "123",
    "firstname": "John",
    "lastname": "Smith",
    "email": "john@example.com"
  },
  "roles": {
    "123": {
      "sectionid": 123,
      "sectionname": "Beavers",
      "permissions": {},
      "isDefault": "1"
    }
  }
}
```

### OAuth Callback
```http
GET /oauth/callback?code={code}&state={state}
```

**Parameters:**
- `code` (required): OAuth authorization code
- `state` (required): OAuth state parameter

**Response:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Trigger Manual Sync
```http
POST /api/sync/trigger
```

**Request Body:**
```json
{
  "sync_type": "full",
  "force": false
}
```

### Get Sync Conflicts
```http
GET /api/sync/conflicts
```

**Response:**
```json
{
  "conflicts": [
    {
      "id": "uuid",
      "entity_type": "member",
      "entity_id": "uuid",
      "local_version": { /* local data */ },
      "remote_version": { /* remote data */ },
      "conflict_type": "UPDATE_CONFLICT",
      "created_at": "2025-01-06T12:00:00Z"
    }
  ]
}
```

## 📊 Reports API

### Get Attendance Report
```http
GET /api/reports/attendance
```

**Parameters:**
- `section_id`: Scout section ID
- `start_date`: Report start date
- `end_date`: Report end date
- `format`: Response format (json, csv, pdf)

**Response:**
```json
{
  "report_type": "attendance",
  "period": {
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-01-31T23:59:59Z"
  },
  "summary": {
    "total_events": 8,
    "total_attendance_records": 200,
    "average_attendance": 25
  },
  "member_statistics": [
    {
      "member_id": "uuid",
      "member_name": "John Doe",
      "events_attended": 7,
      "events_missed": 1,
      "attendance_rate": 87.5
    }
  ]
}
```

## ❌ Error Responses

### Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details",
    "timestamp": "2025-01-06T12:00:00Z",
    "request_id": "uuid"
  }
}
```

### Common Error Codes

#### Authentication Errors
- `AUTH_REQUIRED` (401): Authentication required
- `AUTH_INVALID` (401): Invalid authentication token
- `AUTH_EXPIRED` (401): Authentication token expired
- `PERMISSION_DENIED` (403): Insufficient permissions

#### Client Errors
- `BAD_REQUEST` (400): Invalid request format
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (422): Request validation failed
- `RATE_LIMITED` (429): Too many requests

#### Server Errors
- `INTERNAL_ERROR` (500): Internal server error
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable
- `SYNC_ERROR` (500): Data synchronization error

## 🔄 Rate Limiting & Caching

### OSM API Rate Limits
The backend proxies requests to the Online Scout Manager API, which has its own rate limits:
- **Rate limit information** is included in response `_rateLimitInfo` object
- **Client-side queuing** prevents overwhelming the OSM API
- **200ms delays** between sequential requests

### Caching Strategy
- **Terms Data**: 30-minute TTL
- **FlexiRecord Structure**: 60-minute TTL
- **FlexiRecord Data**: 5-minute TTL
- **Shared Event Attendance**: 1-hour TTL

### Response Format
All responses include caching metadata:
```json
{
  "items": [...],
  "_rateLimitInfo": {
    "remaining": 95,
    "reset": 1641024000
  },
  "_cacheTimestamp": 1641020400000
}
```

## 📝 Pagination

### Pagination Parameters
- `limit`: Number of items per page (max: 100)
- `offset`: Number of items to skip
- `cursor`: Cursor-based pagination token (alternative to offset)

### Pagination Response
```json
{
  "data": [...],
  "pagination": {
    "total": 250,
    "limit": 50,
    "offset": 0,
    "has_more": true,
    "next_cursor": "eyJpZCI6IjEyMyJ9"
  }
}
```

## 🧪 Demo Mode

### Public Demo Access
The application supports a demo mode for public access without authentication:
- **Demo data**: Pre-loaded sample data for demonstration
- **No authentication**: Bypasses OAuth requirements
- **Separate storage**: Uses `demo_` prefixed cache keys
- **Read-only**: No write operations in demo mode

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T12:00:00Z"
}
```

---

*For database schema details, see [Database Schema](database-schema.md). For environment configuration, see [Environment Variables](environment-variables.md).*