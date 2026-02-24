# Manager Flow - Postman Collection Setup

This guide helps you create a Postman collection to test the manager flow endpoints.

## Prerequisites

1. Postman installed (or use web version)
2. API running locally or deployed
3. Admin and manager tokens from your system

## Collection Structure

Create a new collection called "AMS - Manager Flow" with the following folders and requests:

---

## 1. Setup & Authentication

### 1.1 Admin Login

```
POST {{base_url}}/api/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "AdminPassword123"
}
```

**Save response to variable:** `admin_token`

### 1.2 Manager Login

```
POST {{base_url}}/api/login
Content-Type: application/json

{
  "email": "manager@company.com",
  "password": "ManagerPassword123"
}
```

**Save response to variable:** `manager_token`

### 1.3 Employee Login (for testing)

```
POST {{base_url}}/api/login
Content-Type: application/json

{
  "email": "employee@company.com",
  "password": "EmployeePassword123"
}
```

**Save response to variable:** `employee_token`

---

## 2. Manager Discovery

### 2.1 Get All Managers

```
GET {{base_url}}/api/managers

Authorization: Bearer {{manager_token}}
```

### 2.2 Get Managers of Specific Team

```
GET {{base_url}}/api/teams/{{team_id}}/managers

Authorization: Bearer {{manager_token}}
```

### 2.3 Get All Teams Managed by Specific Manager

```
GET {{base_url}}/api/managers/{{manager_id}}/teams

Authorization: Bearer {{manager_token}}
```

### 2.4 Get Team Members Managed by Specific Manager

```
GET {{base_url}}/api/managers/{{manager_id}}/team-members

Authorization: Bearer {{manager_token}}
```

---

## 3. Logged-In User Context

### 3.1 Get My Teams (if I'm a manager)

```
GET {{base_url}}/api/my-teams

Authorization: Bearer {{manager_token}}
```

### 3.2 Get My Team Members (if I'm a manager)

```
GET {{base_url}}/api/my-team-members

Authorization: Bearer {{manager_token}}
```

---

## 4. Team Management

### 4.1 Create Team with Manager

```
POST {{base_url}}/api/team

Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "name": "Engineering Team Alpha",
  "department": "{{department_id}}",
  "leads": ["{{lead_user_id}}"],
  "managers": ["{{manager_user_id}}"],
  "members": ["{{member_user_id_1}}", "{{member_user_id_2}}"]
}
```

### 4.2 Update Team (Add/Change Manager)

```
PUT {{base_url}}/api/teams/{{team_id}}

Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "name": "Engineering Team Alpha",
  "leads": ["{{lead_user_id}}"],
  "managers": ["{{manager_user_id_1}}", "{{manager_user_id_2}}"],
  "members": ["{{member_user_id_1}}", "{{member_user_id_2}}"]
}
```

---

## 5. Leave Management

### 5.1 Employee Creates Leave Request

```
POST {{base_url}}/api/leave

Authorization: Bearer {{employee_token}}
Content-Type: application/json

{
  "leave_type": "annual",
  "start_date": "2026-03-01T00:00:00Z",
  "end_date": "2026-03-05T00:00:00Z",
  "total_days": 5,
  "reason": "Annual leave for personal time",
  "is_half_day": false
}
```

### 5.2 Manager Views Team Leaves

```
GET {{base_url}}/api/leaves?view_scope=team

Authorization: Bearer {{manager_token}}
```

**Optional Filters:**

- `?view_scope=team&status=pending` - Only pending leaves
- `?view_scope=team&leave_type=annual` - Only annual leaves
- `?view_scope=team&page=1&limit=10` - Pagination

### 5.3 Manager Approves Leave

```
PUT {{base_url}}/api/leaves/{{leave_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "approved"
}
```

### 5.4 Manager Rejects Leave

```
PUT {{base_url}}/api/leaves/{{leave_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "rejected",
  "rejection_reason": "Critical project deadline - cannot approve at this time"
}
```

### 5.5 Manager Views Own Leaves

```
GET {{base_url}}/api/leaves?view_scope=self

Authorization: Bearer {{manager_token}}
```

---

## 6. Attendance Management

### 6.1 Get Team Member Attendances

```
GET {{base_url}}/api/attendances?userId={{member_user_id}}

Authorization: Bearer {{manager_token}}
```

### 6.2 Manager Edits Attendance

```
PUT {{base_url}}/api/attendances/{{attendance_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "present",
  "check_in": "2026-02-16T09:00:00Z",
  "check_out": "2026-02-16T17:30:00Z"
}
```

### 6.3 Mark as Half Day

```
PUT {{base_url}}/api/attendances/{{attendance_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "half-day",
  "check_in": "2026-02-16T09:00:00Z",
  "check_out": "2026-02-16T13:00:00Z"
}
```

### 6.4 Mark as Leave

```
PUT {{base_url}}/api/attendances/{{attendance_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "leave"
}
```

---

## 7. Error Testing

### 7.1 Employee Cannot Approve Leaves

```
PUT {{base_url}}/api/leaves/{{leave_id}}

Authorization: Bearer {{employee_token}}
Content-Type: application/json

{
  "status": "approved"
}
```

**Expected:** 403 Unauthorized

### 7.2 Manager Cannot Approve Own Leave

```
PUT {{base_url}}/api/leaves/{{own_leave_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "approved"
}
```

**Expected:** 403 Forbidden

### 7.3 Manager Cannot Edit Non-Team Member Attendance

```
PUT {{base_url}}/api/attendances/{{other_dept_attendance_id}}

Authorization: Bearer {{manager_token}}
Content-Type: application/json

{
  "status": "present"
}
```

**Expected:** 403 Unauthorized

### 7.4 Invalid Scope

```
GET {{base_url}}/api/leaves?view_scope=invalid

Authorization: Bearer {{manager_token}}
```

**Expected:** 400 Bad Request

---

## 8. Environment Variables Setup

Create a Postman environment called "AMS Manager Testing" with these variables:

```
Variable Name          | Example Value              | Type
-----------           | ----------------           | ----
base_url              | http://localhost:8000      | string
admin_token           | <token_from_admin_login>   | string
manager_token         | <token_from_manager_login> | string
employee_token        | <token_from_emp_login>     | string
manager_id            | 507f1f77bcf86cd799439011  | string
team_id               | 507f1f77bcf86cd799439012  | string
member_user_id        | 507f1f77bcf86cd799439013  | string
leave_id              | 507f1f77bcf86cd799439014  | string
attendance_id         | 507f1f77bcf86cd799439015  | string
department_id         | 507f1f77bcf86cd799439016  | string
lead_user_id          | 507f1f77bcf86cd799439017  | string
manager_user_id       | 507f1f77bcf86cd799439018  | string
```

---

## 9. Test Execution Order

For complete end-to-end testing, execute in this order:

1. **Setup Phase**
   - Admin Login
   - Manager Login
   - Employee Login

2. **Team Setup Phase**
   - Create Team with Manager (or use existing)
   - Get My Teams (verify manager is assigned)

3. **Leave Testing Phase**
   - Employee Creates Leave
   - Manager Views Team Leaves
   - Manager Approves/Rejects Leave
   - Verify notification sent (optional)

4. **Attendance Testing Phase**
   - Get Team Member Attendances
   - Edit Attendance
   - Verify attendance updated

5. **Error Testing Phase**
   - Test unauthorized scenarios
   - Test validation errors

---

## 10. Response Validation

### Successful Manager API Response Pattern

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": { ... }
}
```

### Error Response Pattern

```json
{
  "success": false,
  "statusCode": 400|403|404|500,
  "message": "Error description"
}
```

---

## 11. Postman Scripts (Pre-request & Tests)

### Save Token to Environment (in Login requests - Tests tab)

```javascript
if (pm.response.code === 200) {
  var jsonData = pm.response.json();
  pm.environment.set("manager_token", jsonData.data.token);
}
```

### Verify Manager Teams (in Get My Teams - Tests tab)

```javascript
pm.test("Response has teams array", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.data).to.be.an("array");
});

pm.test("Each team has managers array", function () {
  var jsonData = pm.response.json();
  jsonData.data.forEach((team) => {
    pm.expect(team).to.have.property("managers");
  });
});
```

### Verify Leave Approval (in Approve Leave - Tests tab)

```javascript
pm.test("Leave status is approved", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.data.status).to.equal("approved");
});

pm.test("Action taken by has manager name", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.data.action_taken_by).to.be.a("string");
  pm.expect(jsonData.data.action_taken_by.length).to.be.greaterThan(0);
});
```

---

## 12. Export & Import

To export your collection:

1. Click the three dots (...) next to collection name
2. Click "Export"
3. Choose JSON format
4. Save file as `AMS-Manager-Flow.postman_collection.json`

To import:

1. Click "Import" button
2. Upload `AMS-Manager-Flow.postman_collection.json`
3. Select environment "AMS Manager Testing"

---

## 13. Notes & Tips

- **Variable Interpolation**: Use `{{variable_name}}` to reference environment variables
- **Response Chaining**: Save IDs from responses to use in subsequent requests
- **Debugging**: Use "Console" (bottom left) to see request/response details
- **Rate Limiting**: Be mindful of any API rate limits in your system
- **Timestamps**: Use ISO 8601 format for dates: `2026-03-01T00:00:00Z`

---

## 14. Common Issues & Solutions

### Issue: "Invalid token"

**Solution:** Re-login to get fresh token, ensure token is copied correctly

### Issue: "Manager does not exist"

**Solution:** Verify manager_id exists in database, use correct user ID

### Issue: "You can only approve leaves of team members"

**Solution:** Ensure manager is assigned to the team containing the employee

### Issue: "Cannot edit future attendance"

**Solution:** Use past dates only, max date is today

---

## 15. Additional Resources

- API Documentation: `docs/MANAGER_FLOW_API.md`
- Testing Guide: `docs/MANAGER_FLOW_TESTING_GUIDE.md`
- Implementation Summary: `docs/MANAGER_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated:** February 16, 2026
**Status:** Complete
**Version:** 1.0
