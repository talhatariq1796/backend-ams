# Manager Endpoints - Authorization & Active Members

## 🔄 Unified Endpoint Behavior

The manager endpoints now intelligently handle both manager and admin access with a single set of URLs:

### GET /managers/:managerId/teams

**Purpose**: Get teams managed by a manager

**Authorization**:
- ✅ **Manager**: Can view their own teams (if :managerId matches their ID)
- ✅ **Admin**: Can view any manager's teams
- ❌ **Other Managers**: Cannot view other managers' teams
- ❌ **Employees**: Cannot access

**Request**:
```bash
GET /api/managers/69940a5cb55b4ea5e0d9208d/teams
Authorization: Bearer <TOKEN>
```

**Scenarios**:

#### Scenario 1: Manager viewing their own teams
```bash
# Token: Manager with ID = 69940a5cb55b4ea5e0d9208d
GET /api/managers/69940a5cb55b4ea5e0d9208d/teams
Authorization: Bearer <MANAGER_TOKEN>

Response: ✅ Success - Returns manager's teams
```

#### Scenario 2: Admin viewing any manager's teams
```bash
# Token: Admin
GET /api/managers/69940a5cb55b4ea5e0d9208d/teams
Authorization: Bearer <ADMIN_TOKEN>

Response: ✅ Success - Returns that manager's teams
```

#### Scenario 3: Manager trying to view other manager's teams
```bash
# Token: Manager with ID = 11111111111111111111111
GET /api/managers/69940a5cb55b4ea5e0d9208d/teams
Authorization: Bearer <OTHER_MANAGER_TOKEN>

Response: ❌ Error 403 - "You can only view your own teams"
```

---

### GET /managers/:managerId/team-members

**Purpose**: Get all active team members managed by a manager

**Authorization**:
- ✅ **Manager**: Can view their own team members (if :managerId matches their ID)
- ✅ **Admin**: Can view any manager's team members
- ❌ **Other Managers**: Cannot view other managers' team members
- ❌ **Employees**: Cannot access

**Returns**: Only members with `is_active: true`

**Request**:
```bash
GET /api/managers/69940a5cb55b4ea5e0d9208d/team-members
Authorization: Bearer <TOKEN>
```

**Scenarios**:

#### Scenario 1: Manager viewing their own team members
```bash
# Token: Manager with ID = 69940a5cb55b4ea5e0d9208d
GET /api/managers/69940a5cb55b4ea5e0d9208d/team-members
Authorization: Bearer <MANAGER_TOKEN>

Response: ✅ Success - Returns only ACTIVE members
{
  "success": true,
  "data": [
    {
      "_id": "member_id_1",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@company.com",
      "employee_id": "WB-001",
      "designation": "Developer",
      "is_active": true,
      "employment_status": "permanent"
    },
    {
      "_id": "member_id_2",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@company.com",
      "employee_id": "WB-002",
      "designation": "Designer",
      "is_active": true,
      "employment_status": "permanent"
    }
  ]
}
```

#### Scenario 2: Admin viewing any manager's team members
```bash
# Token: Admin
GET /api/managers/69940a5cb55b4ea5e0d9208d/team-members
Authorization: Bearer <ADMIN_TOKEN>

Response: ✅ Success - Returns only ACTIVE members of that manager's teams
```

#### Scenario 3: Manager trying to view other manager's team members
```bash
# Token: Manager with ID = 11111111111111111111111
GET /api/managers/69940a5cb55b4ea5e0d9208d/team-members
Authorization: Bearer <OTHER_MANAGER_TOKEN>

Response: ❌ Error 403 - "You can only view your own team members"
```

---

## 🔍 Active Members Filter

All endpoints now **automatically filter** to show only active members:

```javascript
// Database filter applied
{
  _id: { $in: memberIds },
  is_active: true  // ← Only active members
}
```

### What gets excluded:
- ❌ Inactive employees (is_active: false)
- ❌ Disabled/terminated accounts
- ❌ Archived users

### What gets included:
- ✅ Active, working employees (is_active: true)

---

## 📊 Response Examples

### ✅ Success Response (Manager or Admin)
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
      "employment_status": "permanent",
      "is_active": true
    }
  ]
}
```

### ❌ Error Response (Manager viewing other manager's data)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You can only view your own team members"
}
```

### ❌ Error Response (No active members)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "No active members found in managed teams"
}
```

---

## 🎯 Use Cases

### Use Case 1: Manager checking their team
```bash
curl -X GET "http://localhost:8000/api/managers/69940a5cb55b4ea5e0d9208d/team-members" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```
**Result**: Gets their own team's active members ✅

---

### Use Case 2: Admin auditing a manager's team
```bash
curl -X GET "http://localhost:8000/api/managers/69940a5cb55b4ea5e0d9208d/team-members" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Result**: Gets that manager's team's active members ✅

---

### Use Case 3: Manager trying to view another manager's team
```bash
curl -X GET "http://localhost:8000/api/managers/OTHER_MANAGER_ID/team-members" \
  -H "Authorization: Bearer <MANAGER_TOKEN_OF_DIFFERENT_USER>"
```
**Result**: Error 403 - Forbidden ❌

---

## 🔑 Summary Table

| Request | Token Type | Target ID | Result |
|---------|-----------|-----------|--------|
| GET /managers/:id/teams | Manager | Own ID | ✅ Success |
| GET /managers/:id/teams | Manager | Other ID | ❌ 403 |
| GET /managers/:id/teams | Admin | Any ID | ✅ Success |
| GET /managers/:id/members | Manager | Own ID | ✅ Success |
| GET /managers/:id/members | Manager | Other ID | ❌ 403 |
| GET /managers/:id/members | Admin | Any ID | ✅ Success |

---

## 💡 Implementation Notes

- **Active Member Filter**: Applied at database query level for efficiency
- **Authorization Check**: Happens before database query for security
- **Token Reuse**: Same endpoints work for both manager and admin - just pass different tokens
- **Error Messages**: Clear, user-friendly authorization error messages
- **Performance**: Single database query with optimized filters

---

**Last Updated**: February 17, 2026
**Status**: ✅ Implemented
