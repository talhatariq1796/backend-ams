# Manager Flow - Quick Testing Guide

## Prerequisites

- Admin token for creating users and teams
- Postman or similar API client
- Database connection to your AMS instance

## Setup Test Data

### Step 1: Create Test Users

#### 1a. Create a Manager User

```bash
POST http://localhost:8000/api/users
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "first_name": "Manager",
  "last_name": "User",
  "email": "manager@company.com",
  "gender": "male",
  "contact_number": "03001234567",
  "address": "123 Main St",
  "city": "Karachi",
  "state": "Sindh",
  "cnic": "12345-6789012-3",
  "designation": "Project Manager",
  "team": "<EXISTING_TEAM_ID>",
  "employment_status": "permanent",
  "joining_date": "2025-01-01T00:00:00Z",
  "role": "manager",
  "password": "Manager@123"
}
```

#### 1b. Create Team Member Users (if needed)

```bash
POST http://localhost:8000/api/users
Authorization: Bearer <ADMIN_TOKEN>

{
  "first_name": "Team",
  "last_name": "Member",
  "email": "member@company.com",
  "gender": "male",
  "contact_number": "03001234568",
  "address": "456 Elm St",
  "city": "Karachi",
  "state": "Sindh",
  "cnic": "12345-6789012-4",
  "designation": "Developer",
  "team": "<TEAM_ID>",
  "employment_status": "permanent",
  "joining_date": "2025-02-01T00:00:00Z",
  "role": "employee",
  "password": "Member@123"
}
```

### Step 2: Create a Team with Manager

```bash
POST http://localhost:8000/api/team
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "name": "Engineering Squad",
  "department": "<DEPARTMENT_ID>",
  "leads": ["<LEAD_USER_ID>"],
  "managers": ["<MANAGER_USER_ID>"],
  "members": ["<MEMBER_USER_ID_1>", "<MEMBER_USER_ID_2>"]
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Team created successfully",
  "data": {
    "_id": "team_123",
    "name": "Engineering Squad",
    "leads": [
      {
        "_id": "lead_id",
        "first_name": "Lead",
        "last_name": "Person"
      }
    ],
    "managers": [
      {
        "_id": "manager_id",
        "first_name": "Manager",
        "last_name": "User",
        "email": "manager@company.com"
      }
    ],
    "members": [...]
  }
}
```

### Step 3: Manager Login

```bash
POST http://localhost:8000/api/login
Content-Type: application/json

{
  "email": "manager@company.com",
  "password": "Manager@123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "<MANAGER_TOKEN>",
    "user": {
      "_id": "manager_id",
      "first_name": "Manager",
      "last_name": "User",
      "role": "manager",
      ...
    }
  }
}
```

---

## Test Cases

### Test 1: Get All Managers

```bash
GET http://localhost:8000/api/managers
Authorization: Bearer <ANY_TOKEN>
```

**Expected Response:** List of all manager users

---

### Test 2: Manager Viewing Their Teams

```bash
GET http://localhost:8000/api/my-teams
Authorization: Bearer <MANAGER_TOKEN>
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Your teams fetched successfully",
  "data": [
    {
      "_id": "team_123",
      "name": "Engineering Squad",
      "leads": [...],
      "managers": [...],
      "members": [...]
    }
  ]
}
```

---

### Test 3: Manager Viewing Team Members

```bash
GET http://localhost:8000/api/my-team-members
Authorization: Bearer <MANAGER_TOKEN>
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Your team members fetched successfully",
  "data": [
    {
      "_id": "member_id",
      "first_name": "Team",
      "last_name": "Member",
      "email": "member@company.com",
      "employee_id": "WB-001",
      "designation": "Developer",
      "employment_status": "permanent"
    }
  ]
}
```

---

### Test 4: Manager Viewing Team Member Leave Requests

#### 4a. Team Member applies for leave (as employee)

```bash
POST http://localhost:8000/api/leave
Authorization: Bearer <MEMBER_TOKEN>
Content-Type: application/json

{
  "leave_type": "annual",
  "start_date": "2026-03-01T00:00:00Z",
  "end_date": "2026-03-05T00:00:00Z",
  "total_days": 5,
  "reason": "Personal vacation"
}
```

#### 4b. Manager views team's leaves

```bash
GET http://localhost:8000/api/leaves?view_scope=team
Authorization: Bearer <MANAGER_TOKEN>
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Leaves fetched successfully",
  "data": {
    "leaves": [
      {
        "_id": "leave_123",
        "user": {
          "_id": "member_id",
          "first_name": "Team",
          "last_name": "Member",
          "employee_id": "WB-001"
        },
        "leave_type": "annual",
        "start_date": "2026-03-01T00:00:00Z",
        "end_date": "2026-03-05T00:00:00Z",
        "total_days": 5,
        "status": "pending"
      }
    ],
    "total": 1,
    "page": 1
  }
}
```

---

### Test 5: Manager Approving Leave Request

```bash
PUT http://localhost:8000/api/leaves/<LEAVE_ID>
Authorization: Bearer <MANAGER_TOKEN>
Content-Type: application/json

{
  "status": "approved"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Leave updated successfully",
  "data": {
    "_id": "leave_123",
    "user": {
      "_id": "member_id",
      "first_name": "Team",
      "last_name": "Member"
    },
    "status": "approved",
    "action_taken_by": "Manager User",
    "leave_balance": {
      "total_taken_leaves": 5,
      "remaining_leaves": 15
    }
  }
}
```

---

### Test 6: Manager Rejecting Leave Request

```bash
PUT http://localhost:8000/api/leaves/<LEAVE_ID>
Authorization: Bearer <MANAGER_TOKEN>
Content-Type: application/json

{
  "status": "rejected",
  "rejection_reason": "Critical project deadline - team member required"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Leave updated successfully",
  "data": {
    "_id": "leave_123",
    "status": "rejected",
    "rejection_reason": "Critical project deadline - team member required",
    "action_taken_by": "Manager User"
  }
}
```

---

### Test 7: Manager Cannot Approve Own Leave

```bash
# Manager creates own leave
POST http://localhost:8000/api/leave
Authorization: Bearer <MANAGER_TOKEN>

{
  "leave_type": "annual",
  "start_date": "2026-04-01T00:00:00Z",
  "end_date": "2026-04-03T00:00:00Z",
  "total_days": 3,
  "reason": "Manager's vacation"
}

# Manager tries to approve own leave
PUT http://localhost:8000/api/leaves/<OWN_LEAVE_ID>
Authorization: Bearer <MANAGER_TOKEN>

{
  "status": "approved"
}
```

**Expected Response (Error):**

```json
{
  "success": false,
  "statusCode": 403,
  "message": "You cannot approve or reject your own leave request"
}
```

---

### Test 8: Manager Editing Team Member Attendance

#### 8a. Get a member's attendance record

```bash
GET http://localhost:8000/api/attendances?userId=<MEMBER_ID>
Authorization: Bearer <MANAGER_TOKEN>
```

#### 8b. Edit attendance

```bash
PUT http://localhost:8000/api/attendances/<ATTENDANCE_ID>
Authorization: Bearer <MANAGER_TOKEN>
Content-Type: application/json

{
  "status": "present",
  "check_in": "2026-02-16T09:00:00Z",
  "check_out": "2026-02-16T17:30:00Z"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Attendance updated successfully",
  "data": {
    "_id": "attendance_123",
    "user_id": {
      "_id": "member_id",
      "first_name": "Team",
      "last_name": "Member"
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

### Test 9: Get Specific Manager's Teams

```bash
GET http://localhost:8000/api/managers/<MANAGER_ID>/teams
Authorization: Bearer <ANY_TOKEN>
```

**Expected Response:** Teams managed by that manager

---

### Test 10: Get Team's Managers

```bash
GET http://localhost:8000/api/teams/<TEAM_ID>/managers
Authorization: Bearer <ANY_TOKEN>
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Team managers fetched successfully",
  "data": [
    {
      "_id": "manager_id",
      "first_name": "Manager",
      "last_name": "User",
      "email": "manager@company.com"
    }
  ]
}
```

---

### Test 11: Update Team with New Managers

```bash
PUT http://localhost:8000/api/teams/<TEAM_ID>
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "name": "Engineering Squad",
  "leads": ["<LEAD_ID>"],
  "managers": ["<MANAGER_ID_1>", "<MANAGER_ID_2>"],
  "members": ["<MEMBER_ID_1>", "<MEMBER_ID_2>"]
}
```

**Expected Response:** Updated team with new managers

---

### Test 12: Non-Manager Cannot Approve Leaves

```bash
PUT http://localhost:8000/api/leaves/<LEAVE_ID>
Authorization: Bearer <EMPLOYEE_TOKEN>

{
  "status": "approved"
}
```

**Expected Response (Error):**

```json
{
  "success": false,
  "statusCode": 403,
  "message": "You are not authorized to approve or reject leave requests"
}
```

---

### Test 13: Manager Cannot View Other Manager's Team (Only Own)

```bash
# Manager A tries to view Manager B's teams
GET http://localhost:8000/api/managers/<OTHER_MANAGER_ID>/teams
Authorization: Bearer <MANAGER_A_TOKEN>
```

**Expected Response:** Success (any user can view any manager's teams) - This is by design for admin/support functionality

---

### Test 14: Notifications for Manager

When a team member:

- Submits a leave request
- Has their leave approved/rejected
- Checks in/out
- Gets any notification

The manager should receive a notification (via FCM/WebSocket if configured).

---

## Error Scenarios to Test

1. **Invalid Manager ID**

   ```bash
   GET http://localhost:8000/api/managers/invalid_id/teams
   ```

   Expected: 400 - Invalid manager ID

2. **Non-existent Manager**

   ```bash
   GET http://localhost:8000/api/managers/60d5ec49c1234567890abcde/teams
   ```

   Expected: 400 - Manager does not exist

3. **Non-Team Lead/Manager accessing /my-teams**

   ```bash
   GET http://localhost:8000/api/my-teams
   Authorization: Bearer <EMPLOYEE_TOKEN>
   ```

   Expected: 403 - Only team leads and managers can access this endpoint

4. **Invalid Leave Scope**
   ```bash
   GET http://localhost:8000/api/leaves?view_scope=invalid
   Authorization: Bearer <MANAGER_TOKEN>
   ```
   Expected: 400 - Invalid scope for manager

---

## Summary of New Endpoints

| Method | Endpoint                          | Auth | Role         |
| ------ | --------------------------------- | ---- | ------------ |
| GET    | /managers                         | ✓    | Any          |
| GET    | /managers/:managerId/teams        | ✓    | Any          |
| GET    | /managers/:managerId/team-members | ✓    | Any          |
| GET    | /teams/:teamId/managers           | ✓    | Any          |
| GET    | /my-teams                         | ✓    | Manager/Lead |
| GET    | /my-team-members                  | ✓    | Manager/Lead |
| GET    | /leaves?view_scope=team           | ✓    | Manager      |
| PUT    | /leaves/:leaveId                  | ✓    | Manager      |
| PUT    | /attendances/:attendanceId        | ✓    | Manager      |
| POST   | /team                             | ✓    | Admin        |
| PUT    | /teams/:teamId                    | ✓    | Admin        |

All endpoints follow the existing authentication and authorization patterns in your AMS system.
