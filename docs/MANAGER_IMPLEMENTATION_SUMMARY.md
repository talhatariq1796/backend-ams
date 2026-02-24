# Manager Flow Implementation - Summary of Changes

## Overview

This document summarizes all the changes made to implement the manager flow in the AMS backend. The manager role mirrors the team lead functionality with similar permissions and responsibilities.

---

## 1. Database Model Changes

### 1.1 User Model (`src/models/user.model.js`)

**Change:** Added "manager" to the role enum

```javascript
role: {
  type: String,
  enum: ["admin", "teamLead", "manager", "employee"],
  required: true,
  default: "employee",
}
```

### 1.2 Team Model (`src/models/team.model.js`)

**Change:** Added managers field to store manager references

```javascript
managers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }];
```

---

## 2. New Service Layer

### 2.1 Manager Service (`src/services/manager.service.js`)

**New File** - Contains all manager-related business logic:

- `GetAllManagersService()` - Fetch all manager users
- `GetManagedTeamsService(managerId)` - Get teams managed by a specific manager
- `GetManagedTeamMembersService(managerId)` - Get all members of managed teams
- `GetTeamManagersService(teamId)` - Get managers for a specific team
- `IsManagerOfTeamService(userId, teamId)` - Verify manager-team relationship
- `GetTeamsWhereUserIsLeadOrManagerService(userId)` - Get all teams where user is lead or manager
- `GetAllManagedMemberIdsService(userId)` - Get member IDs for permission checks

---

## 3. New Controller Layer

### 3.1 Manager Controller (`src/controllers/manager.controller.js`)

**New File** - Contains HTTP endpoint handlers:

- `GetAllManagers()` - GET /managers
- `GetManagedTeams()` - GET /managers/:managerId/teams
- `GetManagedTeamMembers()` - GET /managers/:managerId/team-members
- `GetTeamManagers()` - GET /teams/:teamId/managers
- `GetMyTeams()` - GET /my-teams (logged-in user)
- `GetMyTeamMembers()` - GET /my-team-members (logged-in user)

---

## 4. New Routes

### 4.1 Manager Routes (`src/routes/manager.routes.js`)

**New File** - All manager-related endpoints:

```javascript
GET    /managers                           - Get all managers
GET    /managers/:managerId/teams         - Get manager's teams
GET    /managers/:managerId/team-members  - Get manager's team members
GET    /teams/:teamId/managers            - Get team's managers
GET    /my-teams                           - Get current user's teams (if lead/manager)
GET    /my-team-members                    - Get current user's team members (if lead/manager)
```

---

## 5. Updated Services

### 5.1 Team Service (`src/services/team.service.js`)

#### Changes to `CreateTeamService()`:

- Added support for `managers` parameter (array of manager IDs)
- Validate all managers exist before team creation
- Include managers in team creation payload
- Return managers in team response with populated data

#### Changes to `UpdateTeamService()`:

- Added support for `managers` parameter
- Validate managers before update
- Update team's managers field in database
- Ensure managers are included in team members array
- Return managers in updated team response

### 5.2 Leave Service (`src/services/requests/leave.service.js`)

#### Changes to `GetAllLeaveRequestsService()`:

- Added manager scope logic (similar to teamLead)
- Managers can view their team's leave requests with `view_scope=team`
- Managers can view their own leaves with `view_scope=self`
- Collect all managed team members and filter leaves accordingly

#### Changes to `UpdateLeaveStatusService()`:

- Added manager role check for leave approval/rejection
- Managers can approve/reject leaves of their team members only
- Managers cannot approve their own leaves
- Similar validation as team leads

---

## 6. Main Application File

### 6.1 Index File (`src/index.js`)

**Changes:**

- Added import for ManagerRouter
- Registered manager routes: `app.use("/api", ManagerRouter)`
- Routes are loaded in correct order for proper endpoint routing

---

## 7. Architecture Decisions

### 7.1 Parallel Structure with Team Leads

- Manager functionality mirrors team lead functionality
- Both can coexist on the same team
- Same permission levels and capabilities
- Enables hierarchical team management

### 7.2 Permission Model

- Managers and Team Leads have equal permissions
- Both can approve/reject team member leaves
- Both can edit team member attendance
- Both receive team member notifications

### 7.3 Scope Parameter

The `view_scope` parameter works as follows:

- **"team"** - View/manage all team members (excluding self)
- **"self"** - View/manage only own records
- Used in leaves, attendance, and other request endpoints

---

## 8. API Endpoints Summary

### Manager Discovery

- `GET /managers` - List all managers
- `GET /teams/:teamId/managers` - Managers of a specific team

### Manager Information

- `GET /managers/:managerId/teams` - Teams managed by a manager
- `GET /managers/:managerId/team-members` - Members in manager's teams

### User Context Endpoints

- `GET /my-teams` - Current user's teams (if manager/lead)
- `GET /my-team-members` - Current user's team members (if manager/lead)

### Team Management

- `POST /team` - Create team (admin only) - now supports managers
- `PUT /teams/:teamId` - Update team (admin only) - now supports managers

### Leave Management (for Managers)

- `GET /leaves?view_scope=team` - View team's leave requests
- `PUT /leaves/:leaveId` - Approve/reject team member's leave

### Attendance Management (for Managers)

- `PUT /attendances/:attendanceId` - Edit team member's attendance
- (Uses existing attendance endpoint with role-based authorization)

---

## 9. Authorization Flows

### Leave Approval Flow

1. Employee submits leave request
2. System creates Leave record with status="pending"
3. Manager views leaves with `view_scope=team`
4. Manager approves/rejects with `PUT /leaves/:leaveId`
5. System validates manager is managing the employee's team
6. Leave record updated, notifications sent

### Attendance Edit Flow

1. System records attendance
2. Manager views team member attendance
3. Manager calls `PUT /attendances/:attendanceId`
4. System validates manager is managing the employee's team
5. Attendance record updated

### Team View Flow

1. Manager calls `GET /my-teams`
2. System queries Teams where managers field includes manager ID
3. Returns all teams with populated leads, managers, members
4. Manager can then view team-specific data

---

## 10. Notification Integration (Future Enhancement)

The following notifications should be sent to managers:

- When team member requests/updates leave
- When team member's leave is approved/rejected
- When team member checks in/out
- Department/team-wide announcements
- Team member performance notifications

**Implementation Note:** Notification service should check for both `leads` and `managers` arrays when sending team-related notifications.

---

## 11. Testing Coverage

### Unit Tests Recommended

- Manager service functions with valid/invalid IDs
- Team creation with managers
- Team updates with manager changes
- Leave approval authorization checks
- Attendance edit authorization checks

### Integration Tests Recommended

- End-to-end manager workflow
- Multiple managers on same team
- Mixed leads and managers on same team
- Cross-team scenarios

### API Tests Recommended

- All GET endpoints with various parameters
- Create/update team with managers
- Leave approval as manager
- Attendance edit as manager
- Error scenarios (unauthorized, invalid data, etc.)

---

## 12. Files Modified/Created

### New Files Created

1. `src/services/manager.service.js` - Manager business logic
2. `src/controllers/manager.controller.js` - Manager endpoints
3. `src/routes/manager.routes.js` - Manager routes
4. `docs/MANAGER_FLOW_API.md` - API documentation
5. `docs/MANAGER_FLOW_TESTING_GUIDE.md` - Testing guide

### Files Modified

1. `src/models/user.model.js` - Added "manager" role
2. `src/models/team.model.js` - Added managers field
3. `src/services/team.service.js` - Updated for managers
4. `src/services/requests/leave.service.js` - Added manager scope
5. `src/index.js` - Registered manager routes

---

## 13. Database Migration Notes

### MongoDB Schema Changes Required

1. **User Role Update**
   - Existing managers might need role set to "manager"
   - No structural changes required

2. **Team Schema Update**
   - New `managers` field automatically added
   - Existing teams will have empty managers array
   - Can be updated via team update endpoint

### Migration Script (Optional)

```javascript
// Add managers field to existing teams
db.teams.updateMany({}, { $set: { managers: [] } });

// Note: Specific managers should be added via API
```

---

## 14. Deployment Checklist

- [ ] Deploy updated models (auto-migration via Mongoose)
- [ ] Deploy service layer (manager.service.js)
- [ ] Deploy controller layer (manager.controller.js)
- [ ] Deploy routes (manager.routes.js)
- [ ] Update index.js with new routes
- [ ] Restart application
- [ ] Test all endpoints with sample data
- [ ] Update API documentation for frontend
- [ ] Notify stakeholders of new manager functionality

---

## 15. Known Limitations & Future Enhancements

### Current Limitations

- Managers cannot have sub-managers
- No manager approval hierarchy
- No escalation workflow for leave requests

### Possible Future Enhancements

1. **Manager Hierarchy** - Support multi-level manager structure
2. **Leave Escalation** - Auto-escalate to next manager if not approved
3. **Performance Analytics** - Manager dashboards with team metrics
4. **Custom Permissions** - Granular permission control for managers
5. **Delegation** - Managers can delegate approval to team leads

---

## 16. Support & Maintenance

### For Development Team

- Reference `docs/MANAGER_FLOW_API.md` for API specifications
- Use `docs/MANAGER_FLOW_TESTING_GUIDE.md` for testing
- Manager functions follow same patterns as team lead functions

### For Operations

- Monitor manager-related API endpoints for performance
- Check manager assignment during team updates
- Verify notifications are sent to managers

### For Frontend Team

- Implement manager dropdown similar to leads dropdown
- Use `/managers` endpoint for manager selection
- Implement `view_scope=team` for team member lists
- Show manager in team details

---

## Contact & Questions

For questions about implementation details or modifications needed, refer to:

- Manager Service: `src/services/manager.service.js`
- Manager Controller: `src/controllers/manager.controller.js`
- Leave Service Manager Logic: `src/services/requests/leave.service.js` (lines with "manager" role checks)
