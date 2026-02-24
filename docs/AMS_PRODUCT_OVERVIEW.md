# AMS — Attendance Management System

## Product Overview for Client Pitch

---

### What is it (short description)

**AMS (Attendance Management System)** is an end-to-end workforce management platform that digitizes attendance, leave, remote work, and day-to-day operations for organizations. It consists of:

- **Mobile app** — Used by employees, team leads, and managers for check-in/out, leave and remote-work requests, meeting room bookings, and notifications.
- **Web application** — Used by company **Admins** and **HR** for configuration, approvals, reports, team/department management, and company-wide controls.
- **Super Admin** — Manages multiple companies on the platform: onboarding organizations, oversight, and platform-level settings.

---

### Target users

| Segment                   | Platform              | Role                                                                                                                                                   |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Employees**             | Mobile (primary), Web | Check-in/out, apply leave & remote work, book meeting rooms, view calendar & documents                                                                 |
| **Team leads / Managers** | Mobile (primary), Web | Approve leave & remote work for their team, view team attendance, manage team members                                                                  |
| **Admins / HR**           | Web (primary)         | Configure company (working hours, leave types, IP/location rules), manage users/teams/departments, approve requests, run reports, mark/edit attendance |
| **Super Admin**           | Web                   | Manage companies using AMS, onboard new organizations, platform-level administration                                                                   |

---

### Problem it solves

- **Manual attendance & leave** — Replaces spreadsheets and paper with automated check-in/out, status rules (present, late, half-day, leave, remote, holiday), and leave balance tracking.
- **Scattered approvals** — Centralizes leave, remote work, and working-hours requests with role-based approval (team leads for their team, admins for anyone).
- **Policy compliance** — Enforces notice periods, leave types (annual, casual, sick, maternity/paternity, etc.), probation vs permanent rules, and optional location/IP checks.
- **Visibility** — Gives HR and managers real-time visibility into attendance, requests, and reports; notifies users on approvals, auto-leave, and important events.
- **Multi-company** — Super Admin layer allows one platform to serve many organizations with separate configuration per company.

---

### Features we have built

- **Attendance** — Check-in/check-out (with optional IP/location checks), buffer time for late marking, auto status (present, late, half-day, auto-leave, early-leave, remote, holiday, trip). Cron-based regularization for missing check-in/checkout and public holidays.
- **Leave management** — Multiple leave types (annual, casual, sick, demise, hajj/umrah, marriage, maternity, paternity, probation, unpaid) with configurable limits; balance calculation (including probation vs permanent); notice-period and policy checks; team-lead and admin approval.
- **Remote work** — Request and approve remote work; attendance marked as “remote” with optional bypass of IP check for approved dates.
- **Working hours** — Default company working hours; custom working-hours requests (fixed or week-based) with approval; auto-reset on expiry.
- **Teams & departments** — Departments and teams with multiple **leads** per team; assign members; role-based access (admin, HR, team lead, employee).
- **Requests & approvals** — Leave, remote work, working hours; unified request dashboard and recent requests; team leads approve their team, admins approve anyone.
- **Meeting room booking** — Book meeting rooms or online slots; recurring options; attendees and time slots.
- **Events & calendar** — Office events, trips, public holidays (e.g. Pakistan), birthdays, work anniversaries; auto holiday/trip marking in attendance; celebration posts (e.g. birthdays/anniversaries).
- **Tickets** — Support tickets (attendance, general, payroll, policy, access) with status and assignment.
- **Documents, suggestions, todos** — Document storage; suggestions/posts; admin todos.
- **Notifications** — In-app and push (Firebase) for leave, attendance, requests, events, tickets; configurable per company.
- **Reports & config** — Leave stats, attendance reports, configurable rules (buffer time, IP check, auto-checkout, leave deduction, notifications). Fine calculation for late arrivals (tiered policy).
- **Branding** — Registered companies can set their own colors/theme so the mobile and web experience reflects their brand.
- **Super Admin** — Manage multiple companies on AMS (company onboarding and platform-level management).

---

### Business value

- **Time savings** — Less manual tracking and approval chasing; automated regularization and leave balance.
- **Compliance** — Consistent application of leave policy, notice periods, and attendance rules across the organization.
- **Transparency** — Clear audit trail for attendance and leave; reports for HR and management.
- **Scalability** — One platform for many companies via Super Admin; configurable per company (working days, leave types, thresholds).
- **Employee experience** — Single mobile app for attendance, leave, remote work, and bookings; timely notifications and visibility.

---

### Platform / tech (brief)

- **Backend:** Node.js, Express, MongoDB (Mongoose).
- **Real-time:** Socket.io (admin vs user rooms).
- **Jobs:** Node-cron (attendance regularization, celebration posts, reset expired working hours, leave stats init); Bull/BullMQ + Redis for queues (e.g. leave sync, ticket creation, action tracking).
- **APIs:** REST; Swagger for API docs.
- **Storage:** OCI (object storage); file uploads (e.g. Multer).
- **Push:** Firebase (FCM) for mobile notifications.
- **Integrations:** Calendarific (public holidays, e.g. Pakistan); email (Nodemailer).
- **Frontend:** **Mobile app** — Flutter (employees, leads, managers); **Web app** — React JS (Admins, HR, Super Admin).

---

### Customization (if any)

- **Per-company configuration** — Working days, default working hours, business-developer vs general working hours; leave types and limits (permanent, probation/internship, business developers); buffer time, IP/location check, allowed cities, VPN/proxy blocking; auto-checkout and leave-deduction rules; notification toggles; cron schedule for regularization.
- **Branding** — Registered companies can set their own branding: they can choose their own colors (and related theme) so the app and web experience reflect their brand for their employees.
- **Roles** — Admin, Team Lead, Employee (and HR treated as admin-level in team/approval flows); Super Admin for multi-company.
- **Leave policy** — Notice periods, gender-specific leave (maternity/paternity), probation-only leave type; configurable fine policy for late arrivals (tiers and amounts).
- **Events** — Public holidays by country; office events and trips; categories (birthday, anniversary, office-event, trip, public-holiday, etc.).

---

_Document generated for client pitching. Reflects AMS backend and product scope as of current codebase._
