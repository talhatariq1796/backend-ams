# Manager Scope Updates - Pending Counts & Recent Requests

## Overview

Updated all pending count endpoints and recent requests endpoint to support **manager role** filtering. Managers now see pending requests and recent activities only from their managed teams, while admins continue to see all.

---

## Updated Endpoints

### 1. **GET /api/leaves/pending-count**

**Purpose**: Get count of pending leave requests

**Role Behavior**:
- **Admin**: Sees all pending leave requests
- **Manager**: Sees pending requests only from members of their managed teams
- **Team Lead**: Sees pending requests only from members of their led teams
- **Employee**: Sees their own pending requests

**Code Updated**: `src/services/requests/leave.service.js`
- Function: `GetPendingLeavesCountService(user)`
- Change: Added manager role handling with team lookup via `Teams.find({ managers: user._id })`

**Example**:
```bash
curl -X GET "http://localhost:8000/api/leaves/pending-count" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"

Response:
{
  "success": true,
  "data": {
    "count": 5  # Only from manager's teams
  }
}
```

---

### 2. **GET /api/remote-work/pending-count**

**Purpose**: Get count of pending remote work requests

**Role Behavior**:
- **Admin**: Sees all pending remote work requests
- **Manager**: Sees pending requests only from members of their managed teams
- **Team Lead**: Sees pending requests only from members of their led teams
- **Employee**: Sees their own pending requests

**Code Updated**: `src/services/requests/remotework.service.js`
- Function: `GetPendingRemoteWorkCountService(user)`
- Change: Added manager role handling

---

### 3. **GET /api/working-hours/pending-count**

**Purpose**: Get count of pending working hours requests

**Role Behavior**:
- **Admin**: Sees all pending working hours requests
- **Manager**: Sees pending requests only from members of their managed teams
- **Team Lead**: Sees pending requests only from members of their led teams
- **Employee**: Sees their own pending requests

**Code Updated**: `src/services/requests/workinghours.service.js`
- Function: `GetPendingWorkingHoursCountService(user)`
- Change: Added manager role handling

---

### 4. **GET /api/recent-requests?scope=team**

**Purpose**: Get recent requests from team members

**Parameters**:
- `scope` (optional): `"self"` (default) or `"team"`

**Role Behavior**:

#### Admin
```bash
GET /api/recent-requests?scope=team
```
- Returns recent requests from all users in system

#### Manager
```bash
GET /api/recent-requests?scope=team
```
- Returns recent requests from members of their managed teams (excluding themselves)
- Error if manager has no team members: `"No team members found for this manager"`

#### Team Lead
```bash
GET /api/recent-requests?scope=team
```
- Returns recent requests from members of their led teams (excluding themselves)

#### Employee
```bash
GET /api/recent-requests?scope=self
```
- Returns only their own recent requests

**Code Updated**: `src/services/requests/recentRequest.service.js`
- Function: `getRecentRequestsService(userInfo, scope)`
- Change: Added manager role handling before teamLead check

**Example**:
```bash
# Manager viewing their team's recent requests
curl -X GET "http://localhost:8000/api/recent-requests?scope=team" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"

Response:
{
  "success": true,
  "data": [
    {
      "type": "leave",
      "status": "pending",
      "createdAt": "2026-02-17T07:30:00Z",
      "requestId": "req_id",
      "start_date": "2026-02-20",
      "end_date": "2026-02-22",
      "user": {
        "_id": "user_id",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@company.com",
        "employee_id": "WB-001",
        "designation": "Developer"
      }
    }
  ]
}
```

---

## Implementation Details

### Logic Flow

**For each endpoint, the logic follows this pattern**:

```
1. Admin → No filter (get all)
2. Manager → Get teams where managers includes user_id
           → Extract all member IDs from those teams
           → Filter to those members (excluding self)
3. Team Lead → Get teams where leads includes user_id
              → Extract all member IDs from those teams
              → Filter to those members (excluding self)
4. Employee → Only self
```

### Key Code Pattern

```javascript
// Manager handling
if (user.role === "manager") {
  const teamsManagedByUser = await Teams.find({ managers: user._id }).select("members");
  
  let memberIds = [];
  teamsManagedByUser.forEach((team) => {
    if (team.members?.length) {
      memberIds.push(...team.members.map((id) => new mongoose.Types.ObjectId(id)));
    }
  });
  
  memberIds = [...new Set(memberIds.map((id) => id.toString()))]
    .map((id) => new mongoose.Types.ObjectId(id))
    .filter((id) => id.toString() !== user._id.toString());
  
  filter.user = { $in: memberIds };  // or filter.user_id or filter.userId
}
```

### Duplicate Handling

The code handles:
- ✅ Duplicate member IDs across multiple teams
- ✅ Self-exclusion (manager doesn't see themselves in team members)
- ✅ Empty teams/no members

---

## Files Modified

| File | Function | Change |
|------|----------|--------|
| `src/services/requests/leave.service.js` | `GetPendingLeavesCountService` | Added manager role handling |
| `src/services/requests/remotework.service.js` | `GetPendingRemoteWorkCountService` | Added manager role handling |
| `src/services/requests/workinghours.service.js` | `GetPendingWorkingHoursCountService` | Added manager role handling |
| `src/services/requests/recentRequest.service.js` | `getRecentRequestsService` | Added manager role handling |

---

## Testing Scenarios

### Scenario 1: Manager checking pending leaves
```bash
# Manager with ID: manager_id_1
# Manages teams: team_1, team_2
# Team members: 5 employees

GET /api/leaves/pending-count
Authorization: Bearer <MANAGER_TOKEN>

Expected: Returns count of pending leaves from 5 employees only
```

### Scenario 2: Admin checking all pending leaves
```bash
GET /api/leaves/pending-count
Authorization: Bearer <ADMIN_TOKEN>

Expected: Returns count of ALL pending leaves in system
```

### Scenario 3: Manager viewing team's recent requests
```bash
GET /api/recent-requests?scope=team
Authorization: Bearer <MANAGER_TOKEN>

Expected: Returns last 6 recent requests from team members
         (Excludes manager's own requests)
```

### Scenario 4: Manager with no managed teams
```bash
GET /api/recent-requests?scope=team
Authorization: Bearer <MANAGER_NO_TEAMS_TOKEN>

Expected: Error 404 - "No team members found for this manager"
```

---

## Compatibility

- ✅ Backward compatible with existing team lead functionality
- ✅ Admin role unaffected (still sees all)
- ✅ Employee role unaffected (still sees own only)
- ✅ No database schema changes required

---

## Next Steps

1. **Restart application**: `npm run dev`
2. **Test with manager token**: Call endpoints with manager authorization
3. **Verify filtering**: Confirm managers see only their team members' requests
4. **Test edge cases**: 
   - Manager with no teams
   - Manager with inactive members
   - Multiple teams managed

---

**Last Updated**: February 17, 2026  
**Status**: ✅ Implemented
