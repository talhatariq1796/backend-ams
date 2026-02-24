# AMS — Project Structure & Permissions Reference

This document gives you a **detailed map of what the project does** and **how access is currently controlled**, so you can design a **permission structure** where:
- Roles have defined permissions
- You can **grant any permission to any user** (override role)
- **Admins can update role permissions** from the admin side
- **Admins can allow/revoke specific permissions per user**

---

## 1. Current roles (backend)

| Role        | Description |
|------------|-------------|
| `admin`    | Full company-wide access; can manage config, users, teams, departments, attendance, leave stats, events, suggestions, todos, logs; can approve any leave/remote/work-hours. |
| `teamLead` | Lead of one or more teams; can approve leave/remote/work-hours for **team members only**; can view team members and team-scoped data. |
| `employee` | Basic user; can mark own attendance, apply leave/remote/work-hours, view own data and what’s shared (e.g. documents, events). |

**Note:** There is no separate `hr` or `superAdmin` in the **backend**; they are implied (e.g. HR = admin-level, Super Admin = future multi-company layer). All authorization today is **role-based** inside controllers/services (no permission table yet).

---

## 2. High-level project structure (what’s happening)

- **Auth:** JWT via `authenticateToken` middleware; `req.user` has `_id`, `role`, and other profile fields. No route-level permission middleware—only `authenticateToken` on protected routes; **role checks are inside controllers/services**.
- **Helpers:** `checkUserAuthorization(req.user)` = user must exist. `isAdmin(req.user)` = must be `admin`. `isAdminOrTeamLead(req.user)` = `admin` or `teamLead`.
- **Scoping:** Team leads are restricted to their **team(s)** (e.g. leave/remote/work-hours approval, team members list). Admins see **company-wide** data. Employees see **own** data (and shared content).

Below is the **full action inventory** and current “who can do it,” then a **suggested permission model**.

---

## 3. Full API / action inventory (current behavior)

Each row is an **action** (API or logical capability). **Who can** = current rule in code (Admin / TeamLead / Employee / Any auth / Public).

### 3.1 User & auth

| Action | Method + Route (or description) | Who can |
|--------|---------------------------------|--------|
| Register user | POST `/api/user/create` | **Public** (no auth) |
| Login | POST `/api/user/login` | Public |
| Refresh token | POST `/api/user/refresh-token` | Public (body has refresh_token) |
| Forgot password | POST `/api/user/forgot-password` | Public |
| Reset password | PUT `/api/user/reset-password/:token` | Public |
| Change password | PUT `/api/user/change-password` | **Any auth** |
| Get current user | GET `/api/user` | Any auth |
| Update own profile | PUT `/api/user/update` | Any auth (own only) |
| Get all users | GET `/api/users` | **Admin** |
| Get employees (list) | GET `/api/users/employees` | Any auth (service filters by role/team) |
| Get single employee | GET `/api/users/employee/:employeeId` | **Admin** |
| Delete user | DELETE `/api/user/:userId` | **Admin** or **self** |
| Change user activation | PUT `/api/users/change-activation-status/:userId` | **Admin** |
| Update user (by admin) | PUT `/api/user/:userId` | **Admin** |
| Get admins list | GET `/api/users/admins` | **Admin** |
| Update user role | PUT `/api/users/update-role/:userId` | **Admin** |
| Count employees | GET `/api/users/employees/count` | **Admin** |

### 3.2 Department

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create department | POST `/api/department` | **Admin** |
| Get all departments | GET `/api/departments` | **Admin** |
| Get department by ID | GET `/api/departments/:departmentId` | **Admin** |
| Get department stats | GET `/api/department-stats` | **Admin** |
| Update department | PUT `/api/departments/:departmentId` | **Admin** |
| Delete department | DELETE `/api/departments/:departmentId` | **Admin** |

### 3.3 Team

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create team | POST `/api/team` | **Admin** |
| Get all teams | GET `/api/teams` | Any auth (service: admin/hr get by teamId; teamLead own teams; employee own team) |
| Get team by ID | GET `/api/teams/:teamId` | Any auth (scoped by role) |
| Get team leads | GET `/api/teams/:teamId/leads` | Any auth (scoped) |
| Get all team leads (dropdown) | GET `/api/team-leads` | Any auth |
| Get team members | GET `/api/teams/:teamId/members` | Any auth (scoped: admin/hr need teamId; teamLead own teams; employee own team) |
| Update team | PUT `/api/teams/:teamId` | **Admin** |
| Delete team | DELETE `/api/teams/:teamId` | **Admin** |
| Add member to team | PUT `/api/teams/:teamId/members` | **Admin** |
| Remove member from team | DELETE `/api/teams/:teamId/members/:memberId` | **Admin** |

### 3.4 Attendance

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Mark attendance (check-in/out) | POST `/api/attendance/mark` | **Any auth** (own only; service uses req.user) |
| Admin mark attendance | POST `/api/attendance/admin-mark` | **Admin** |
| Admin edit attendance | PUT `/api/attendance/admin-edit` | **Admin** |
| Get attendance records | GET `/api/attendance` | Any auth (employee must pass own `employee_id`; admin can filter by user/department/employment) |
| Get today’s attendance | GET `/api/attendance/today` | Any auth (service scopes by user/role) |
| Get attendance history | GET `/api/attendance/history` | Any auth (service: admin can filter by dept/employment; others scoped) |
| Get monthly attendance | GET `/api/attendance/month-history` | Any auth (scoped) |
| Get attendance stats | GET `/api/attendance/stats` | Any auth (scoped) |
| Get status by date | GET `/api/attendance/status-by-date` | Any auth |
| Get today stats | GET `/api/attendance/today-stats` | Any auth (scoped) |
| Download attendance report | POST `/api/attendance/download-report` | Any auth (service: admin can pick user_id; others own) |

### 3.5 Leave

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Apply leave | POST `/api/leave/apply` | Any auth (admin can apply for another user via body) |
| Update leave status (approve/reject) | PUT `/api/leave/:leave_id/status` | **Admin or TeamLead** (team lead only for team members) |
| Edit leave | PUT `/api/leave/edit_leave/:leave_id` | Any auth (service: owner or admin; team lead can edit team’s pending) |
| Delete leave | DELETE `/api/leave/:leave_id` | Any auth (service: owner or admin; pending only for non-admin) |
| Get leave requests | GET `/api/leaves/requests` | **Admin or TeamLead** (team lead sees team only) |
| Get leave stats | GET `/api/leaves/stats` | Any auth (scoped by role) |
| Get leave types | GET `/api/leaves/types` | Any auth |
| Get pending leave count | GET `/api/leaves/pending-count` | Any auth (count scoped by role) |

### 3.6 Working hours (config + requests)

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create working-hours request | POST `/api/working-hours/request` | Any auth |
| Get my requests | GET `/api/all-working-hours/request/` | Any auth |
| Get requests by user | GET `/api/working-hours/request/user/:userId` | Any auth (service: admin or team lead for team member) |
| Delete request | DELETE `/api/working-hours/request/:id` | Owner or **Admin** (pending only for non-admin) |
| Update status (approve/reject) | PUT `/api/working-hours/request/:id` | **Admin or TeamLead** (team lead for team) |
| Get pending count | GET `/api/working-hours/pending-count` | Any auth (scoped) |
| Admin edit request | PATCH `/api/working-hours/request/admin-edit/:id` | **Admin** |
| User edit request | PATCH `/api/working-hours/request/user-edit/:id` | Owner (pending only) |
| Get user working hours | GET `/api/user-working-hours/:userId` | Any auth (service scopes) |
| Update multiple users’ working hours | PUT `/api/update-multiple-user-working-hours` | **Admin** (implied by usage) |
| Upsert user working hours | PUT `/api/user-working-hours/upadte/:userId` | Any auth (service: admin or self) |
| Reset working hours | PUT `/api/reset-working-hours` | **Admin** (implied) |

### 3.7 Remote work

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create remote-work request | POST `/api/remote-work/request` | Any auth |
| Get remote-work requests | GET `/api/remote-work/requests` | Any auth (service: admin all; team lead team) |
| Get approved by date | GET `/api/remote-work/approved` | Any auth |
| Edit own request | PUT `/api/remote-work/edit/:request_id` | Owner (pending) |
| Update status (approve/reject) | PUT `/api/remote-work/update/:request_id` | **Admin or TeamLead** (team) |
| Delete request | DELETE `/api/remote-work/delete/:request_id` | Owner or **Admin** (admin can delete any; others pending only) |
| Get pending count | GET `/api/remote-work/pending-count` | Any auth (scoped) |
| Assign remote work to users | PUT `/api/remote-work/update-multiple-user` | **Admin** (bulk assign) |
| Admin update request | PUT `/api/remote-work/admin-update/:request_id` | **Admin** |

### 3.8 Meeting room

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create booking | POST `/api/book-meeting-room` | Any auth |
| Get filtered bookings | GET `/api/meeting-room-bookings/filter` | Any auth |
| Update booking | PUT `/api/meeting-room-bookings/:id` | Owner or **Admin** (service) |
| Delete booking | DELETE `/api/meeting-room-bookings/:id` | Any auth (service: owner or admin) |
| Get upcoming | GET `/api/meeting-room-bookings/upcoming` | Any auth |

### 3.9 Events & calendar

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create event | POST `/api/create-event` | **Admin** |
| Edit event | PUT `/api/event/:eventId` | **Admin** or owner (service) |
| Get events (filtered) | GET `/api/events` | Any auth (service: admin all; others by team/department) |
| Get categories | GET `/api/event/categories` | Any auth |
| Delete event | DELETE `/api/event/delete` | **Admin** |
| Get celebrations | GET `/api/celebrations` | **Admin** |
| Add public holidays | POST `/api/event/add-public-holidays` | **Admin** |
| Get today celebrations | GET `/api/celebrations/today` | Any auth (scoped) |

### 3.10 Suggestions / posts

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create suggestion | POST `/api/suggestion/create` | Any auth |
| Get user suggestions | GET `/api/suggestions/user/:userId` | Any auth |
| Edit suggestion | PUT `/api/suggestion/:suggestionId` | **Admin** or post owner (service) |
| Delete suggestion | DELETE `/api/suggestion/:suggestionId` | **Admin** or post owner |
| Get all suggestions | GET `/api/suggestions` | **Admin** |
| Get categories | GET `/api/suggestions/categories` | Any auth |
| Respond to suggestion | PUT `/api/suggestions/respond/:suggestionId` | **Admin** |
| Edit response | PUT `/api/suggestions/edit-response/:suggestionId` | **Admin** |
| Delete response | DELETE `/api/suggestions/delete-response/:suggestionId` | **Admin** |
| Not responded count | GET `/api/suggestion/not-responded-count` | **Admin or TeamLead** (scoped) |
| Toggle like | PATCH `/api/suggestions/:suggestionId/toggle-like` | Any auth |
| Add comment | POST `/api/suggestions/:suggestionId/comments` | Any auth |
| Delete comment | DELETE `.../comments/:commentId` | **Admin** or comment owner |
| Edit comment | PUT `.../comments/:commentId` | **Admin** or comment owner |
| Get likes | GET `/api/suggestions/:suggestionId/likes` | Any auth |
| Get comments | GET `.../comments` | Any auth |
| Get visible suggestions | GET `/api/suggestions/visible` | Any auth (visibility + admin filter in service) |

### 3.11 Config / office

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Get config | GET `/api/get-config` | Any auth |
| Update config | PUT `/api/update-config` | **Admin** |
| Create config | POST `/api/create-config` | **Admin** |
| Get allowed IPs | GET `/api/allowed-ips` | Any auth |
| Add/update allowed IP | POST `/api/allowed-ips` | **Admin** |
| Delete allowed IP | DELETE `/api/allowed-ips/:name` | **Admin** |
| Toggle IP check | PUT `/api/toggle-ip-check` | **Admin** |
| Get signup status | GET `/api/signup-status` | Public |

### 3.12 Leave stats

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Get my leave stats | GET `/api/leave-stats` | Any auth (own or team lead for team; admin for any) |
| Get all leave stats | GET `/api/leave-stats/all` | **Admin** |
| Update leave stats | PUT `/api/leave-stats/:user_id` | **Admin** |
| Sync all leave stats | POST `/api/leave-stats/sync` | **Admin** |
| Edit leave stats | PATCH `/api/leave-stats/:user_id` or `/api/leave-stats` | **Admin** |

### 3.13 Documents

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Upload document | POST `/api/document/upload` | Any auth (no role check; visibility in body) |
| Update document | PUT `/api/document/:id` | Any auth (no owner check in controller/service) |
| Delete document | DELETE `/api/document/:id` | Any auth (no owner check) |
| Fetch documents | GET `/api/documents` | Any auth (admin: filter by visibility; others: public + own department) |
| Get document types | GET `/api/documents/types` | Any auth |
| Get visibilities | GET `/api/documents/visibilities` | Any auth |

### 3.14 Tickets

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create ticket | POST `/api/tickets` | Any auth |
| Get tickets | GET `/api/tickets` | Any auth (service: admin all; others created_by or assigned_to) |
| Assign ticket | PATCH `/api/tickets/:ticket_id/assign` | **Admin** (service) |
| Update ticket status | PATCH `/api/tickets/:ticket_id/status` | Admin / creator / assignee (service) |
| Edit ticket | PUT `/api/tickets/:ticket_id` | Admin / creator (service) |
| Delete ticket | DELETE `/api/tickets/:ticket_id` | **Admin** (service) |
| Get status count | GET `/api/tickets/status-count` | Any auth (filtered by role) |

### 3.15 Bugs

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Report bug | POST `/api/bugs/report-bug` | Any auth |
| Get all bugs | GET `/api/bugs` | Any auth (no role filter in controller) |
| Update bug status | PATCH `/api/bugs/:id/status` | Any auth (no role check) |
| Delete bug | DELETE `/api/bugs/:id` | Any auth (no role check) |

### 3.16 Admin todos

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Create todo | POST `/api/admin/todo` | **Admin** |
| Get todos | GET `/api/admin/todos` | **Admin** |
| Update todo status | PATCH `/api/admin/todo/:id` | **Admin** |
| Delete todo | DELETE `/api/admin/todo/:id` | **Admin** |

### 3.17 Notifications & logs

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Get my notifications | GET `/api/user-notifications/` | Any auth (own only) |
| Mark all read | PUT `/api/read-all` | Any auth (own) |
| Mark multiple read | PUT `/api/read-notifications` | Any auth (own) |
| Has unread | GET `/api/notifications/has-unread` | Any auth |
| Send test to all | POST `/api/notifications/test-all` | Any auth (no admin check in controller) |
| Get logs | GET `/api/logs` | **Admin** |

### 3.18 Request dashboard & recent requests

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Get dashboard counts | GET `/api/request-dashboard-counts` | Any auth (counts scoped by role in services) |
| Get recent requests | GET `/api/recent-requests` | Any auth (admin all; team lead team) |

### 3.19 Storage

| Action | Method + Route | Who can |
|--------|----------------|--------|
| Upload single/multiple | POST `/api/upload/single`, `/upload/multiple`, etc. | No auth on these routes (consider adding) |

---

## 4. Summary: current permission pattern

- **Admin-only:** Config CRUD, allowed IPs, departments CRUD, teams CRUD (create/update/delete, add/remove members), admin mark/edit attendance, leave stats (all/sync/edit), events create/delete/add holidays, suggestions respond/edit/delete response, admin todos, logs, get all users/employee/count/admins, update user/role/activation, delete other users.
- **Admin or TeamLead:** Leave/remote/work-hours approve-reject (team lead only for their team), get leave/remote/work-hours requests and counts (team lead team-scoped), get team-leads list, get not-responded suggestions count (scoped).
- **Admin or owner:** Edit/delete own leave (and team lead can edit team’s pending), delete user (self), edit event (creator), edit/delete suggestion (creator), edit/delete comment (creator), meeting room update/delete (owner), ticket edit (creator).
- **Any authenticated:** Everything else (mark own attendance, apply leave/remote/work-hours, get own data, documents by visibility, tickets by created/assigned, etc.).

---

## 5. Suggested permission structure (for your design)

So that you can **draw the permissions structure**, **assign permissions to roles**, **allow any permission to any user**, and **let admin update role permissions**, below is a concrete model.

### 5.1 Permission model (conceptual)

- **Permissions** = list of **actions** (e.g. `attendance.mark`, `attendance.admin_mark`, `leave.apply`, `leave.approve`, `config.update`, `user.update_role`, …). You can derive the list from Section 3 (one permission per action or group related actions).
- **Roles** = e.g. `admin`, `teamLead`, `employee` (and later `hr`, `superAdmin`). Each role has a **set of permissions** (stored in DB, editable by admin).
- **User** = has one **role** (as now) plus an optional **per-user permission overrides**:  
  - **Grant:** extra permissions (e.g. give an employee `leave.approve` for their team).  
  - **Revoke:** remove a permission that their role would have (e.g. remove `suggestion.respond` from one admin).

**Effective permission** for a user = (role permissions ∪ user granted permissions) ∖ user revoked permissions.

### 5.2 Data structure (example)

- **Role**
  - `_id`, `name`, `description`
  - `permissions`: `["attendance.mark", "leave.apply", "leave.approve", ...]`  
  (Admin UI: “Edit role permissions” updates this array.)

- **User** (existing plus)
  - `role`: ref to Role (or keep current string enum for backward compatibility).
  - `permission_grants`: `["leave.approve", "attendance.admin_mark"]`  // extra permissions
  - `permission_revokes`: `["suggestion.respond"]`  // remove these from role

- **Permission registry** (static or in DB)
  - List of all permission keys and labels, e.g.  
    `{ "attendance.mark": "Mark own attendance", "attendance.admin_mark": "Mark attendance for others", ... }`  
  So admin UI can show checkboxes per permission for “Role permissions” and “User overrides”.

### 5.3 How you’d use it

1. **Draw the permissions structure**
   - One node per **permission** (or per **feature** with sub-permissions).
   - For each **role**, mark which permissions it has (from Section 3 “Who can” → default role permissions).
   - Example: `admin` = all; `teamLead` = approve (team-scoped) + view team; `employee` = own actions only.

2. **Role permissions editable by admin**
   - Screen “Edit role” → select role → list all permissions with checkboxes (or tree by module).
   - Save updates `Role.permissions` in DB. All users with that role get the new set (subject to their overrides).

3. **Grant/revoke for a user**
   - Screen “Edit user” → same permission list plus:
     - “Additional permissions” (grants): e.g. allow this employee to approve leave for their team.
     - “Revoked permissions” (revokes): e.g. remove “Send test notifications” from this admin.
   - Save to `User.permission_grants` and `User.permission_revokes`.

4. **Authorization in code**
   - Replace direct `isAdmin()` / `isAdminOrTeamLead()` checks with a single helper, e.g.  
     `requirePermission(req.user, 'leave.approve')`  
   - Helper loads user’s effective permissions (role + grants − revokes), then checks if the required permission is in the set. For **scoped** permissions (e.g. “approve leave for my team”), keep your existing team-membership checks after the permission check.

### 5.4 Mapping current behavior to permission keys (example)

You can define one permission per “who can” row in Section 3, e.g.:

- `user.create`, `user.list`, `user.view`, `user.update`, `user.delete`, `user.activate`, `user.update_role`
- `department.create`, `department.list`, `department.view`, `department.update`, `department.delete`, `department.stats`
- `team.create`, `team.list`, `team.view`, `team.update`, `team.delete`, `team.members_add`, `team.members_remove`
- `attendance.mark`, `attendance.admin_mark`, `attendance.admin_edit`, `attendance.list`, `attendance.download_report`
- `leave.apply`, `leave.approve`, `leave.edit`, `leave.delete`, `leave.list`, `leave.stats`
- `working_hours.request`, `working_hours.approve`, `working_hours.admin_edit`, `working_hours.list`, `working_hours.bulk_update`
- `remote_work.request`, `remote_work.approve`, `remote_work.delete`, `remote_work.admin_assign`
- `meeting_room.create`, `meeting_room.update`, `meeting_room.delete`, `meeting_room.list`
- `event.create`, `event.edit`, `event.delete`, `event.add_holidays`, `event.list`
- `suggestion.create`, `suggestion.edit`, `suggestion.delete`, `suggestion.respond`, `suggestion.list`
- `config.view`, `config.update`, `config.create`, `config.ips_manage`
- `leave_stats.view_own`, `leave_stats.view_all`, `leave_stats.update`, `leave_stats.sync`
- `document.upload`, `document.update`, `document.delete`, `document.list`
- `ticket.create`, `ticket.list`, `ticket.assign`, `ticket.update`, `ticket.delete`
- `bug.report`, `bug.list`, `bug.update_status`, `bug.delete`
- `todo.create`, `todo.list`, `todo.update`, `todo.delete`
- `logs.list`
- `notification.test_all` (optional, for “Send test to all”)

You can then:
- **Default admin role** = all of the above.
- **Default teamLead** = subset (e.g. leave/remote/work-hours approve for team, team list, suggestion count, etc.).
- **Default employee** = own-only and shared-view permissions.
- **Per-user:** add/remove any of these keys in `permission_grants` / `permission_revokes`.

---

## 6. Next steps (implementation)

1. **Define the full permission list** from Section 3 (and group by module for UI).
2. **Add collections/fields:** Role (with `permissions`), User (`permission_grants`, `permission_revokes`).
3. **Build middleware or helper** `requirePermission(user, permission)` using effective permissions.
4. **Replace** each `isAdmin()` / `isAdminOrTeamLead()` and role check with `requirePermission(req.user, 'permission.key')` (and keep team-scoping where needed).
5. **Admin UI:** “Role management” (edit role permissions), “User management” (edit user role + grants/revokes).

This document gives you the **full picture of what is happening** in the project and a **clear structure** so you can draw the permissions model and implement role-based + per-user permissions with admin-manageable role permissions.
