# Manager Flow - Quick Reference & Endpoint Payloads

## 📋 All Endpoints at a Glance

```
Manager Discovery (Public)
  GET  /managers
  GET  /teams/:teamId/managers

Manager Information
  GET  /managers/:managerId/teams
  GET  /managers/:managerId/team-members

User Context (Authenticated)
  GET  /my-teams
  GET  /my-team-members

Team Management (Admin)
  POST /team
  PUT  /teams/:teamId

Leave Management
  GET  /leaves?view_scope=team
  PUT  /leaves/:leaveId

Attendance Management
  PUT  /attendances/:attendanceId
```

---

## 🔍 Endpoint Quick Reference

### 1️⃣ GET /managers

**Get all users with manager role**

```
Method: GET
Path: /managers
Auth: Bearer <TOKEN>
```

**Payload:** None

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Managers fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@company.com",
      "employee_id": "WB-123",
      "profile_picture": "https://..."
    }
  ]
}
```

---

### 2️⃣ GET /managers/:managerId/teams

**Get all teams managed by a manager**

```
Method: GET
Path: /managers/:managerId/teams
Auth: Bearer <TOKEN>
```

**Parameters:**

- `managerId` (required): Manager's user ID

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Managed teams fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Engineering Team",
      "department": {
        "_id": "507f1f77bcf86cd799439016",
        "name": "Engineering"
      },
      "leads": [
        {
          "_id": "507f1f77bcf86cd799439017",
          "first_name": "Alice",
          "last_name": "Smith"
        }
      ],
      "managers": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "first_name": "John",
          "last_name": "Doe",
          "email": "john@company.com"
        }
      ],
      "members": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "first_name": "Bob",
          "last_name": "Johnson",
          "employee_id": "WB-456"
        }
      ]
    }
  ]
}
```

---

### 3️⃣ GET /managers/:managerId/team-members

**Get all members in manager's teams**

```
Method: GET
Path: /managers/:managerId/team-members
Auth: Bearer <TOKEN>
```

**Parameters:**

- `managerId` (required): Manager's user ID

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Managed team members fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "first_name": "Bob",
      "last_name": "Johnson",
      "email": "bob@company.com",
      "employee_id": "WB-456",
      "designation": "Senior Developer",
      "profile_picture": "https://...",
      "team": "507f1f77bcf86cd799439012",
      "employment_status": "permanent"
    }
  ]
}
```

---

### 4️⃣ GET /teams/:teamId/managers

**Get all managers for a team**

```
Method: GET
Path: /teams/:teamId/managers
Auth: Bearer <TOKEN>
```

**Parameters:**

- `teamId` (required): Team ID

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Team managers fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@company.com"
    }
  ]
}
```

---

### 5️⃣ GET /my-teams

**Get current user's teams (if manager/lead)**

```
Method: GET
Path: /my-teams
Auth: Bearer <TOKEN>
Role: teamLead or manager
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your teams fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Engineering Team",
      "department": {
        "_id": "507f1f77bcf86cd799439016",
        "name": "Engineering"
      },
      "leads": [...],
      "managers": [...],
      "members": [...]
    }
  ]
}
```

---

### 6️⃣ GET /my-team-members

**Get current user's team members (if manager/lead)**

```
Method: GET
Path: /my-team-members
Auth: Bearer <TOKEN>
Role: teamLead or manager
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your team members fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "first_name": "Bob",
      "last_name": "Johnson",
      "email": "bob@company.com",
      "employee_id": "WB-456",
      "designation": "Senior Developer",
      "profile_picture": "https://...",
      "team": "507f1f77bcf86cd799439012",
      "employment_status": "permanent"
    }
  ]
}
```

---

### 7️⃣ POST /team

**Create team with managers**

```
Method: POST
Path: /team
Auth: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Engineering Team",
  "department": "507f1f77bcf86cd799439016",
  "leads": ["507f1f77bcf86cd799439017"],
  "managers": ["507f1f77bcf86cd799439011"],
  "members": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Team created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Engineering Team",
    "department": "507f1f77bcf86cd799439016",
    "leads": [
      {
        "_id": "507f1f77bcf86cd799439017",
        "first_name": "Alice",
        "last_name": "Smith"
      }
    ],
    "managers": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@company.com"
      }
    ],
    "members": [...]
  }
}
```

---

### 8️⃣ PUT /teams/:teamId

**Update team (add/remove managers)**

```
Method: PUT
Path: /teams/:teamId
Auth: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

**Parameters:**

- `teamId` (required): Team ID

**Request Body:**

```json
{
  "name": "Engineering Team",
  "leads": ["507f1f77bcf86cd799439017"],
  "managers": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439018"],
  "members": ["507f1f77bcf86cd799439013"]
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Team updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Engineering Team",
    "managers": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@company.com"
      },
      {
        "_id": "507f1f77bcf86cd799439018",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@company.com"
      }
    ],
    "members": [...]
  }
}
```

---

### 9️⃣ GET /leaves?view_scope=team

**Manager views team member leaves**

```
Method: GET
Path: /leaves?view_scope=team
Auth: Bearer <MANAGER_TOKEN>
Query Parameters:
  - view_scope=team (required)
  - status=pending (optional)
  - leave_type=annual (optional)
  - page=1 (optional)
  - limit=10 (optional)
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leaves fetched successfully",
  "data": {
    "leaves": [
      {
        "_id": "507f1f77bcf86cd799439019",
        "user": {
          "_id": "507f1f77bcf86cd799439013",
          "first_name": "Bob",
          "last_name": "Johnson",
          "employee_id": "WB-456",
          "role": "employee",
          "gender": "male",
          "designation": "Senior Developer",
          "employment_status": "permanent",
          "profile_picture": "https://..."
        },
        "leave_type": "annual",
        "start_date": "2026-03-01T00:00:00Z",
        "end_date": "2026-03-05T00:00:00Z",
        "total_days": 5,
        "is_half_day": false,
        "status": "pending",
        "reason": "Annual leave",
        "createdAt": "2026-02-16T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasMorePages": false
  }
}
```

---

### 🔟 PUT /leaves/:leaveId

**Manager approves/rejects leave**

```
Method: PUT
Path: /leaves/:leaveId
Auth: Bearer <MANAGER_TOKEN>
Content-Type: application/json
```

**Parameters:**

- `leaveId` (required): Leave request ID

**Request Body (Approve):**

```json
{
  "status": "approved"
}
```

**Request Body (Reject):**

```json
{
  "status": "rejected",
  "rejection_reason": "Critical project deadline"
}
```

**Response (Success):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leave updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439019",
    "user": {
      "_id": "507f1f77bcf86cd799439013",
      "first_name": "Bob",
      "last_name": "Johnson",
      "employee_id": "WB-456"
    },
    "leave_type": "annual",
    "start_date": "2026-03-01T00:00:00Z",
    "end_date": "2026-03-05T00:00:00Z",
    "total_days": 5,
    "status": "approved",
    "action_taken_by": "John Doe",
    "leave_balance": {
      "total_taken_leaves": 5,
      "remaining_leaves": 15
    }
  }
}
```

---

### 1️⃣1️⃣ PUT /attendances/:attendanceId

**Manager edits team member attendance**

```
Method: PUT
Path: /attendances/:attendanceId
Auth: Bearer <MANAGER_TOKEN>
Content-Type: application/json
```

**Parameters:**

- `attendanceId` (required): Attendance record ID

**Request Body:**

```json
{
  "status": "present",
  "check_in": "2026-02-16T09:00:00Z",
  "check_out": "2026-02-16T17:30:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "user_id": {
      "_id": "507f1f77bcf86cd799439013",
      "first_name": "Bob",
      "last_name": "Johnson",
      "email": "bob@company.com",
      "employee_id": "WB-456"
    },
    "date": "2026-02-16T00:00:00Z",
    "status": "present",
    "check_in": "2026-02-16T09:00:00Z",
    "check_out": "2026-02-16T17:30:00Z",
    "production_time": "08:30"
  }
}
```

---

## ❌ Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid manager ID"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "statusCode": 403,
  "message": "You cannot approve or reject your own leave request"
}
```

### 404 Not Found

```json
{
  "success": false,
  "statusCode": 404,
  "message": "No team members found for this manager"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## 🎯 Common Use Cases

### Use Case 1: Manager approves a leave

```
1. GET /leaves?view_scope=team
   → Get pending leaves
2. PUT /leaves/:leaveId
   → Send {"status": "approved"}
3. Verify response status is "approved"
```

### Use Case 2: Manager edits team member attendance

```
1. GET /attendances?userId=:memberId
   → Get member's attendance
2. PUT /attendances/:attendanceId
   → Send status and check times
3. Verify attendance is updated
```

### Use Case 3: Admin creates team with manager

```
1. POST /team
   → Send team data with managers array
2. Verify managers field in response
3. GET /my-teams (as manager)
   → Verify manager sees their team
```

### Use Case 4: Admin adds new manager to existing team

```
1. PUT /teams/:teamId
   → Send updated managers array
2. Verify new manager is in response
3. GET /teams/:teamId/managers
   → Confirm new manager listed
```

---

## 📊 Quick Reference Table

| Endpoint                    | Method | Auth Role    | Purpose                  |
| --------------------------- | ------ | ------------ | ------------------------ |
| /managers                   | GET    | Any          | List all managers        |
| /managers/:mid/teams        | GET    | Any          | Get manager's teams      |
| /managers/:mid/team-members | GET    | Any          | Get manager's members    |
| /teams/:tid/managers        | GET    | Any          | Get team's managers      |
| /my-teams                   | GET    | Lead/Manager | Get my teams             |
| /my-team-members            | GET    | Lead/Manager | Get my members           |
| /team                       | POST   | Admin        | Create team with manager |
| /teams/:tid                 | PUT    | Admin        | Update team manager      |
| /leaves?scope=team          | GET    | Manager      | View team leaves         |
| /leaves/:lid                | PUT    | Manager      | Approve/reject leave     |
| /attendances/:aid           | PUT    | Manager      | Edit attendance          |

---

## 🔐 Authorization Matrix

| Endpoint                 | Admin | Manager       | Lead          | Employee |
| ------------------------ | ----- | ------------- | ------------- | -------- |
| GET /managers            | ✓     | ✓             | ✓             | ✓        |
| GET /managers/:mid/teams | ✓     | ✓             | ✓             | ✓        |
| GET /my-teams            | ✓     | ✓             | ✓             | ✗        |
| GET /my-team-members     | ✓     | ✓             | ✓             | ✗        |
| GET /leaves?scope=team   | ✓     | ✓             | ✓             | ✗        |
| PUT /leaves/:lid         | ✓     | ✓ (team only) | ✓ (team only) | ✗        |
| PUT /attendances/:aid    | ✓     | ✓ (team only) | ✓ (team only) | ✗        |
| POST /team               | ✓     | ✗             | ✗             | ✗        |
| PUT /teams/:tid          | ✓     | ✗             | ✗             | ✗        |

---

**Last Updated:** February 16, 2026
**Status:** Ready for Testing & Deployment
