# Manager Flow API Documentation

## Overview

The manager flow mirrors the team lead functionality. Managers can be assigned to teams and have similar permissions to team leads:

- **View all leave requests** of their managed teams
- **Approve/Reject leave requests** of their team members
- **Edit attendance** of their team members (similar to team leads)
- **Receive all notifications** of their managed teams and members

## Architecture

### 1. **User Role**: Added "manager" to user roles

```javascript
role: {
  type: String,
  enum: ["admin", "teamLead", "manager", "employee"],
  required: true,
  default: "employee",
}
```

### 2. **Team Model**: Added managers field

```javascript
managers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }];
```

## Endpoints

### 1. **Get All Managers**

- **Endpoint**: `GET /managers`
- **Authentication**: Required (Bearer Token)
- **Authorization**: Any authenticated user
- **Description**: Retrieve all users with manager role
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Managers fetched successfully",
  "data": [
    {
      "_id": "user_id_1",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@company.com",
      "employee_id": "WB-123",
      "profile_picture": "url_to_image"
    }
  ]
}
```

---

### 2. **Get Managed Teams** (for a specific manager)

- **Endpoint**: `GET /managers/:managerId/teams`
- **Authentication**: Required
- **Authorization**: Any authenticated user (can view any manager's teams)
- **Parameters**:
  - `managerId` (path parameter): The ID of the manager
- **Description**: Get all teams managed by a specific manager
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Managed teams fetched successfully",
  "data": [
    {
      "_id": "team_id_1",
      "name": "Engineering Team",
      "department": {
        "_id": "dept_id",
        "name": "Engineering"
      },
      "leads": [
        {
          "_id": "lead_id",
          "first_name": "Alice",
          "last_name": "Smith"
        }
      ],
      "managers": [
        {
          "_id": "manager_id",
          "first_name": "John",
          "last_name": "Doe",
          "email": "john@company.com"
        }
      ],
      "members": [
        {
          "_id": "member_id_1",
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

### 3. **Get Managed Team Members** (for a specific manager)

- **Endpoint**: `GET /managers/:managerId/team-members`
- **Authentication**: Required
- **Authorization**: Any authenticated user
- **Parameters**:
  - `managerId` (path parameter): The ID of the manager
- **Description**: Get all team members from all teams managed by a manager
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Managed team members fetched successfully",
  "data": [
    {
      "_id": "member_id_1",
      "first_name": "Bob",
      "last_name": "Johnson",
      "email": "bob@company.com",
      "employee_id": "WB-456",
      "designation": "Senior Developer",
      "profile_picture": "url_to_image",
      "team": "team_id_1",
      "employment_status": "permanent"
    }
  ]
}
```

---

### 4. **Get Team Managers** (for a specific team)

- **Endpoint**: `GET /teams/:teamId/managers`
- **Authentication**: Required
- **Authorization**: Any authenticated user
- **Parameters**:
  - `teamId` (path parameter): The ID of the team
- **Description**: Get all managers for a specific team
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Team managers fetched successfully",
  "data": [
    {
      "_id": "manager_id_1",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@company.com"
    }
  ]
}
```

---

### 5. **Get My Teams** (logged-in user)

- **Endpoint**: `GET /my-teams`
- **Authentication**: Required
- **Authorization**: Only team leads and managers
- **Description**: Get all teams where the logged-in user is a lead or manager
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your teams fetched successfully",
  "data": [
    {
      "_id": "team_id_1",
      "name": "Engineering Team",
      "department": {
        "_id": "dept_id",
        "name": "Engineering"
      },
      "leads": [
        {
          "_id": "lead_id",
          "first_name": "Alice",
          "last_name": "Smith"
        }
      ],
      "managers": [
        {
          "_id": "manager_id",
          "first_name": "John",
          "last_name": "Doe"
        }
      ],
      "members": [
        {
          "_id": "member_id_1",
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

### 6. **Get My Team Members** (logged-in user)

- **Endpoint**: `GET /my-team-members`
- **Authentication**: Required
- **Authorization**: Only team leads and managers
- **Description**: Get all team members managed by the logged-in manager/team lead
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your team members fetched successfully",
  "data": [
    {
      "_id": "member_id_1",
      "first_name": "Bob",
      "last_name": "Johnson",
      "email": "bob@company.com",
      "employee_id": "WB-456",
      "designation": "Senior Developer",
      "profile_picture": "url_to_image",
      "team": "team_id_1",
      "employment_status": "permanent"
    }
  ]
}
```

---

### 7. **Create Team** (with managers)

- **Endpoint**: `POST /team`
- **Authentication**: Required
- **Authorization**: Admin only
- **Request Body**:

```json
{
  "name": "Engineering Team",
  "department": "<departmentId>",
  "members": ["<userId1>", "<userId2>"],
  "leads": ["<userIdA>", "<userIdB>"],
  "managers": ["<userIdC>", "<userIdD>"]
}
```

- **Description**: Create a new team with team leads and managers
- **Response**:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Team created successfully",
  "data": {
    "_id": "team_id_1",
    "name": "Engineering Team",
    "department": "dept_id",
    "leads": [
      {
        "_id": "lead_id",
        "first_name": "Alice",
        "last_name": "Smith"
      }
    ],
    "managers": [
      {
        "_id": "manager_id",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@company.com"
      }
    ],
    "members": [
      {
        "_id": "member_id_1",
        "first_name": "Bob",
        "last_name": "Johnson",
        "employee_id": "WB-456"
      }
    ]
  }
}
```

---

### 8. **Update Team** (with managers)

- **Endpoint**: `PUT /teams/:teamId`
- **Authentication**: Required
- **Authorization**: Admin only
- **Parameters**:
  - `teamId` (path parameter): The ID of the team
- **Request Body**:

```json
{
  "name": "Updated Engineering Team",
  "new_department_id": "<departmentId>",
  "members": ["<userId1>"],
  "removed_members": ["<userId2>"],
  "leads": ["<userIdA>", "<userIdB>", "<userIdC>"],
  "managers": ["<userIdD>", "<userIdE>"]
}
```

- **Description**: Update team details including leads and managers
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Team updated successfully",
  "data": {
    "_id": "team_id_1",
    "name": "Updated Engineering Team",
    "leads": [
      {
        "_id": "lead_id",
        "first_name": "Alice",
        "last_name": "Smith"
      }
    ],
    "managers": [
      {
        "_id": "manager_id",
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

### 9. **View Leave Requests** (as manager)

- **Endpoint**: `GET /leaves?view_scope=team`
- **Authentication**: Required
- **Authorization**: Manager only
- **Query Parameters**:
  - `view_scope` (required): Should be "team" to view team members' leaves or "self" for own leaves
  - `status` (optional): "pending", "approved", "rejected", or "processed"
  - `leave_type` (optional): Filter by leave type
  - `page` (optional): Pagination page (default: 1)
  - `limit` (optional): Items per page (default: 10)
- **Description**: Manager can view all leave requests of their team members with scope="team"
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leaves fetched successfully",
  "data": {
    "leaves": [
      {
        "_id": "leave_id_1",
        "user": {
          "_id": "member_id_1",
          "first_name": "Bob",
          "last_name": "Johnson",
          "employee_id": "WB-456",
          "role": "employee",
          "gender": "male",
          "designation": "Senior Developer",
          "employment_status": "permanent",
          "profile_picture": "url_to_image"
        },
        "leave_type": "annual",
        "start_date": "2026-03-01T00:00:00Z",
        "end_date": "2026-03-05T00:00:00Z",
        "total_days": 5,
        "is_half_day": false,
        "status": "pending",
        "reason": "Personal vacation",
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

### 10. **Approve/Reject Leave Request** (as manager)

- **Endpoint**: `PUT /leaves/:leaveId`
- **Authentication**: Required
- **Authorization**: Manager of the requesting employee's team
- **Parameters**:
  - `leaveId` (path parameter): The ID of the leave request
- **Request Body** (for approval):

```json
{
  "status": "approved"
}
```

- **Request Body** (for rejection):

```json
{
  "status": "rejected",
  "rejection_reason": "Team member is required for a critical project"
}
```

- **Description**: Manager can approve or reject leave requests of team members
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leave updated successfully",
  "data": {
    "_id": "leave_id_1",
    "user": {
      "_id": "member_id_1",
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
      "total_taken_leaves": 10,
      "remaining_leaves": 10
    }
  }
}
```

---

### 11. **Edit Team Member Attendance** (as manager)

- **Endpoint**: `PUT /attendances/:attendanceId`
- **Authentication**: Required
- **Authorization**: Admin, Team Lead, or Manager of the user's team
- **Parameters**:
  - `attendanceId` (path parameter): The ID of the attendance record
- **Request Body**:

```json
{
  "status": "present",
  "check_in": "2026-02-16T09:00:00Z",
  "check_out": "2026-02-16T17:00:00Z"
}
```

- **Description**: Manager can edit attendance records of their team members (same as team lead)
- **Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance updated successfully",
  "data": {
    "_id": "attendance_id_1",
    "user_id": {
      "_id": "member_id_1",
      "first_name": "Bob",
      "last_name": "Johnson",
      "employee_id": "WB-456"
    },
    "date": "2026-02-16T00:00:00Z",
    "status": "present",
    "check_in": "2026-02-16T09:00:00Z",
    "check_out": "2026-02-16T17:00:00Z",
    "production_time": "08:00"
  }
}
```

---

## Notification Flow for Managers

### Notifications sent to managers:

1. **Leave Request Notifications** - When team members request leaves
2. **Leave Approval/Rejection** - When leaves are approved/rejected
3. **Attendance Changes** - When team members check in/out
4. **Team Member Notifications** - All notifications related to team members
5. **Team Announcements** - Department or team-wide announcements

### Implementation:

- Managers receive notifications similar to team leads
- All team member notifications are broadcasted to the manager
- Notifications include `role: "manager"` in the database

---

## Permissions Summary

| Action                | Admin | Team Lead        | Manager          | Employee |
| --------------------- | ----- | ---------------- | ---------------- | -------- |
| View all leaves       | ✓     | -                | -                | -        |
| View team leaves      | ✓     | ✓ (team=true)    | ✓ (team=true)    | -        |
| View own leaves       | ✓     | ✓ (self)         | ✓ (self)         | ✓        |
| Approve/Reject leaves | ✓     | ✓ (team members) | ✓ (team members) | -        |
| Edit team attendance  | ✓     | ✓                | ✓                | -        |
| Create/Update teams   | ✓     | -                | -                | -        |
| View managed teams    | -     | ✓                | ✓                | -        |
| View team members     | -     | ✓                | ✓                | -        |

---

## Testing Flow

### Step 1: Create a Manager User

```bash
# Via user creation endpoint (already exists)
POST /users
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@company.com",
  "gender": "male",
  "role": "manager",
  ...
}
```

### Step 2: Create or Update a Team with Manager

```bash
POST /team
{
  "name": "Engineering Team",
  "department": "<dept_id>",
  "leads": ["<lead_user_id>"],
  "managers": ["<manager_user_id>"],
  "members": ["<member1_id>", "<member2_id>"]
}
```

### Step 3: Get Manager's Teams

```bash
GET /my-teams
Authorization: Bearer <manager_token>
```

### Step 4: View Team Members

```bash
GET /my-team-members
Authorization: Bearer <manager_token>
```

### Step 5: View Team's Leave Requests

```bash
GET /leaves?view_scope=team
Authorization: Bearer <manager_token>
```

### Step 6: Approve a Leave Request

```bash
PUT /leaves/<leave_id>
Authorization: Bearer <manager_token>
{
  "status": "approved"
}
```

### Step 7: Edit Team Member Attendance

```bash
PUT /attendances/<attendance_id>
Authorization: Bearer <manager_token>
{
  "status": "present",
  "check_in": "2026-02-16T09:00:00Z",
  "check_out": "2026-02-16T17:00:00Z"
}
```

---

## Notes

- Managers and Team Leads have parallel permissions
- Managers cannot approve their own leaves
- Managers can only manage teams and members assigned to them
- All notifications of team members are sent to their team's manager
- The existing team lead flow remains unchanged
- Both leads and managers can coexist on the same team
