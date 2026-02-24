# Manager Attendance Endpoints

## Overview
Managers can view today's attendance for their team members with filtering, searching, and get attendance summaries. Two separate APIs available:
- **Detailed API**: Returns attendance data + counts (with pagination)
- **Summary API**: Returns counts only (quick overview)

---

## 1. Get Today's Team Attendance (Detailed)

### Endpoint
```
GET /api/attendance/manager/today
```

### Authorization
- ✅ Manager (sees their team's attendance)
- ✅ Admin (can see any team's attendance)
- ❌ Employee
- ❌ Team Lead

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `team_id` | ObjectId | Filter by specific team (MongoDB ID) | `team_id=687a4ef241802f2a7a3c3a18` |
| `status` | string | Filter by status: `all`, `present`, `remote`, `awaiting`, `leave`, `half-day`, `late` | `status=present` |
| `search` | string | Search by employee name or employee_id | `search=John` |
| `page` | number | Pagination page (default: 1) | `page=1` |
| `limit` | number | Records per page (default: 10) | `limit=20` |

### Example Requests

```bash
# Get all team's attendance today
GET /api/attendance/manager/today?page=1&limit=10
Authorization: Bearer <MANAGER_TOKEN>

# Get specific team's attendance
GET /api/attendance/manager/today?team_id=687a4ef241802f2a7a3c3a18&page=1&limit=10
Authorization: Bearer <MANAGER_TOKEN>

# Filter by status
GET /api/attendance/manager/today?team_id=687a4ef241802f2a7a3c3a18&status=remote&limit=10
Authorization: Bearer <MANAGER_TOKEN>

# Search by name
GET /api/attendance/manager/today?team_id=687a4ef241802f2a7a3c3a18&search=John&page=1&limit=10
Authorization: Bearer <MANAGER_TOKEN>

# Combined filters
GET /api/attendance/manager/today?team_id=687a4ef241802f2a7a3c3a18&status=present&search=Tech&page=1&limit=15
Authorization: Bearer <MANAGER_TOKEN>
```

### Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today's team attendance fetched successfully",
  "data": {
    "data": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "user_name": "John Doe",
        "employee_id": "WB-001",
        "designation": "Senior Developer",
        "role": "employee",
        "team": "Tech Team",
        "status": "present",
        "check_in": "2026-02-17T09:00:00.000Z",
        "check_out": "2026-02-17T18:00:00.000Z",
        "date": "2026-02-17T00:00:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439014",
        "user_name": "Jane Smith",
        "employee_id": "WB-002",
        "designation": "Product Manager",
        "role": "employee",
        "team": "Product Team",
        "status": "remote",
        "check_in": "2026-02-17T08:30:00.000Z",
        "check_out": "2026-02-17T17:30:00.000Z",
        "date": "2026-02-17T00:00:00.000Z"
      }
    ],
    "counts": {
      "total": 15,
      "present": 10,
      "remote": 3,
      "awaiting": 2,
      "leave": 0,
      "half-day": 0,
      "late": 0
    },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "pages": 2
    }
  }
}
```

### Response Fields

#### Attendance Record
- `_id`: Attendance record ID
- `user_name`: Full name of employee
- `employee_id`: Employee ID
- `designation`: Job designation
- `role`: User role (employee, etc.)
- `team`: Team name
- `status`: Attendance status (present, remote, awaiting, leave, half-day, late)
- `check_in`: Check-in timestamp
- `check_out`: Check-out timestamp
- `date`: Attendance date

#### Counts
- `total`: Total attendance records
- `present`: Present count
- `remote`: Working remotely count
- `awaiting`: Awaiting status count
- `leave`: On leave count
- `half-day`: Half-day count
- `late`: Marked late count

#### Pagination
- `page`: Current page
- `limit`: Records per page
- `total`: Total records
- `pages`: Total pages

---

## 2. Get Today's Attendance Summary (Counts Only)

### Endpoint
```
GET /api/attendance/manager/summary
```

### Authorization
- ✅ Manager (gets their team summary)
- ✅ Admin (gets any team summary)
- ❌ Employee
- ❌ Team Lead

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `team_id` | ObjectId | Filter by specific team (MongoDB ID) | `team_id=687a4ef241802f2a7a3c3a18` |

### Example Requests

```bash
# Get summary for all manager's teams
GET /api/attendance/manager/summary
Authorization: Bearer <MANAGER_TOKEN>

# Get summary for specific team
GET /api/attendance/manager/summary?team_id=687a4ef241802f2a7a3c3a18
Authorization: Bearer <MANAGER_TOKEN>
```

### Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today's attendance summary fetched successfully",
  "data": {
    "total_members": 25,
    "present": 18,
    "remote": 4,
    "awaiting": 2,
    "leave": 1,
    "half-day": 0,
    "late": 0
  }
}
```

### Response Fields
- `total_members`: Total count of team members
- `present`: Present count
- `remote`: Working remotely count
- `awaiting`: Awaiting status count
- `leave`: On leave count
- `half-day`: Half-day count
- `late`: Marked late count

---

## 3. Available Status Values

```
present    - Employee is present
remote     - Working remotely
awaiting   - Status awaiting confirmation
leave      - On approved leave
half-day   - Marked as half-day
late       - Marked late
```

---

## 4. API Comparison

| Feature | `/manager/today` | `/manager/summary` |
|---------|-----------------|------------------|
| Returns attendance data | ✅ Yes | ❌ No |
| Returns counts | ✅ Yes | ✅ Yes |
| Pagination support | ✅ Yes | ❌ No |
| Search support | ✅ Yes | ❌ No |
| Status filter | ✅ Yes | ❌ No |
| Team filter | ✅ Yes | ✅ Yes |
| Response size | Large | Small |
| Use case | Detailed view | Quick overview |

---

## 5. Use Cases

### Use Case 1: Get Quick Attendance Count
```bash
curl -X GET "http://localhost:8000/api/attendance/manager/summary" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```
**Result**: Quick overview of today's attendance counts

---

### Use Case 2: View Team's Detailed Attendance
```bash
curl -X GET "http://localhost:8000/api/attendance/manager/today?team_id=687a4ef241802f2a7a3c3a18&page=1&limit=10" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```
**Result**: Attendance records for specific team with pagination

---

### Use Case 3: Filter Remote Workers
```bash
curl -X GET "http://localhost:8000/api/attendance/manager/today?status=remote" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```
**Result**: All remote workers from manager's teams

---

### Use Case 4: Search Specific Employee
```bash
curl -X GET "http://localhost:8000/api/attendance/manager/today?search=John&team_id=687a4ef241802f2a7a3c3a18&page=1&limit=10" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```
**Result**: Attendance for employees named "John" in specific team

---

### Use Case 5: Check Awaiting Attendance
```bash
curl -X GET "http://localhost:8000/api/attendance/manager/today?status=awaiting&limit=20" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```
**Result**: All employees with awaiting status

---

## 6. Team Selection

Managers can filter by specific team using `team_id`:

```bash
# Get all manager's teams
GET /api/attendance/manager/today

# Get specific team only
GET /api/attendance/manager/today?team_id=687a4ef241802f2a7a3c3a18
```

**Validation**:
- Manager can only filter their managed teams
- Admin can filter any team
- Invalid team_id returns 403 error for managers, 404 for invalid teams

---

## 7. Error Responses

### Unauthorized Manager
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Only managers and admins can access this"
}
```

### No Teams Found
```json
{
  "success": false,
  "statusCode": 404,
  "message": "No teams found for this manager"
}
```

### Invalid Team for Manager
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't manage this team"
}
```

### Team Not Found (Admin)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Team not found"
}
```

---

## 8. Notes

- **Two Separate APIs**: Use `/manager/summary` for quick counts, `/manager/today` for detailed data
- **Team Filtering**: Both APIs support `team_id` parameter to filter specific teams
- **Time Zone**: Uses UTC for date/time operations
- **Early Hour Logic**: If current time is before 1 AM, fetches yesterday's records
- **Pagination**: Only available on `/manager/today` endpoint
- **Search**: Case-insensitive search on first_name, last_name, employee_id
- **Performance**: Team member IDs are optimized per request

---

**Last Updated**: February 17, 2026  
**Status**: ✅ Implemented
