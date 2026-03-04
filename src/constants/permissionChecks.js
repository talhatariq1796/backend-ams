/**
 * Maps API routes/actions to permission keys.
 * Use with requirePermission(permissionKey) middleware or checkPermission(req, permissionKey) in controllers.
 * This is the single source of truth for "which permission guards which action".
 */

export const PERMISSION_BY_ACTION = {
  // ---- Attendance ----
  "attendance.mark": "check_in", // or can_check_out – check in controller based on body.checkin
  "attendance.admin_mark": "save_all_attendance",
  "attendance.admin_edit": "can_edit_all_attendance or can_edit_team_attendance (scope: team lead = own team only)",
  "attendance.get": "view_attendance_status",
  "attendance.get_all": "view_all_attendance",
  "attendance.download_report": "export_attendance_reports",

  // ---- Leave ----
  "leave.apply": "apply_for_leave",
  "leave.update_status": "can_approve_leave_requests",
  "leave.edit": "cancel_leave_update_leave_request",
  "leave.delete": "cancel_leave_update_leave_request",
  "leave.get_requests": "view_leave_requests",
  "leave.get_stats": "view_leave_balance",
  "leave.get_types": "apply_for_leave",
  "leave.pending_count": "view_leave_requests",

  // ---- Remote work / WFH ----
  "remote_work.request": "apply_for_wfh",
  "remote_work.update_status": "approve_wfh",
  "remote_work.edit_own": "apply_for_wfh",
  "remote_work.delete": "apply_for_wfh",
  "remote_work.get_requests": "view_wfh_requests",
  "remote_work.get_approved": "view_wfh_requests",
  "remote_work.pending_count": "view_wfh_requests",
  "remote_work.admin_update": "approve_wfh",
  "remote_work.assign_users": "approve_wfh",

  // ---- Working hours ----
  "working_hours.request": "request_working_hours",
  "working_hours.get_requests": "view_working_hours_requests",
  "working_hours.get_user_requests": "view_working_hours_requests",
  "working_hours.delete": "view_working_hours_requests",
  "working_hours.update_status": "approve_working_hours_requests",
  "working_hours.admin_edit": "configure_staff_schedules",
  "working_hours.user_edit": "view_working_hours_requests",
  "working_hours.pending_count": "view_working_hours_requests",

  // ---- Config / Office ----
  "config.get": "view_attendance_status", // any authenticated can view own company config for now
  "config.update": "manage_office_config",
  "config.create": "manage_office_config",
  "config.allowed_ips": "manage_office_config",
  "config.role_permissions.get": "manage_roles",
  "config.role_permissions.update": "manage_roles",

  // ---- User / Employees ----
  "user.create": "manage_agents",
  "user.delete": "manage_agents",
  "user.update_role": "manage_roles",
  "user.list": "view_all_attendance", // or manage_agents – list employees
  "user.get_permissions": "manage_user_permissions",
  "user.update_permissions": "manage_user_permissions",

  // ---- Reports ----
  "reports.view": "view_reports",
  "reports.export_attendance": "export_attendance_reports",
  "reports.export_payroll": "export_payroll_data",
  "reports.export_time_log": "export_time_log_reports",
  "reports.audit_trail": "view_audit_trail",

  // ---- Events ----
  "event.create": "manage_office_config",
  "event.edit": "manage_office_config",
  "event.delete": "manage_office_config",
  "event.get": "view_reports",
  "event.categories": "view_reports",
  "event.celebrations": "view_reports",
  "event.add_public_holidays": "manage_office_config",

  // ---- Teams ----
  "team.create": "manage_teams",
  "team.get_all": "view_teams",
  "team.get_by_id": "view_teams",
  "team.update": "manage_teams",
  "team.delete": "manage_teams",
  "team.members": "view_team_members",
  "team.members.manage": "manage_teams",

  // ---- Departments ----
  "department.create": "manage_departments",
  "department.get_all": "view_departments",
  "department.get_by_id": "view_departments",
  "department.stats": "view_departments",
  "department.update": "manage_departments or manage_own_department (scope: own)",
  "department.delete": "manage_departments or manage_own_department (scope: own)",

  // ---- Logs ----
  "logs.get": "view_audit_trail",

  // ---- Leave stats ----
  "leave_stats.get_user": "view_leave_balance",
  "leave_stats.get_all": "manage_leave_rules",
  "leave_stats.update": "manage_leave_rules",
  "leave_stats.sync": "manage_leave_rules",
  "leave_stats.edit": "manage_leave_rules",

  // ---- Request dashboard ----
  "request_dashboard.counts": "view_request_dashboard",

  // ---- Documents ----
  "document.upload": "manage_reports",
  "document.update": "manage_reports",
  "document.delete": "manage_reports",
  "document.get": "view_reports",
  "document.types": "view_reports",
  "document.visibilities": "view_reports",

  // ---- Bug ----
  "bug.report": "report_bug",
  "bug.get_all": "view_bugs",
  "bug.update_status": "manage_bugs",
  "bug.delete": "manage_bugs",

  // ---- Ticket ----
  "ticket.create": "create_ticket",
  "ticket.get_all": "view_tickets",
  "ticket.assign": "assign_ticket",
  "ticket.update_status": "update_ticket_status",
  "ticket.edit": "edit_ticket",
  "ticket.delete": "delete_ticket",
  "ticket.status_count": "view_ticket_status_count",

  // ---- Suggestion / Community posts ----
  "suggestion.create": "create_post",
  "suggestion.get_user": "view_posts",
  "suggestion.edit": "edit_own_post or edit_any_post (controller enforces ownership)",
  "suggestion.delete": "delete_own_post or delete_any_post (controller enforces ownership)",
  "suggestion.get_all": "view_all_posts",
  "suggestion.categories": "view_post_categories",
  "suggestion.respond": "respond_to_post",
  "suggestion.toggle_like": "like_post",
  "suggestion.add_comment": "add_post_comment",
  "suggestion.get_visible": "view_posts",
  "suggestion.not_responded_count": "view_not_responded_posts_count",
  "suggestion.edit_comment": "edit_own_post_comment or edit_any_post_comment (controller enforces)",
  "suggestion.delete_comment": "delete_own_post_comment or delete_any_post_comment (controller enforces)",
  "suggestion.get_likes": "view_post_likes",
  "suggestion.get_comments": "view_post_comments",

  // ---- Admin Todo ----
  "todo.create": "configure_staff_schedules",
  "todo.get_all": "configure_staff_schedules",
  "todo.update_status": "configure_staff_schedules",
  "todo.delete": "configure_staff_schedules",

  // ---- Notifications ----
  "notification.get": "view_notifications",
  "notification.test_all": "send_test_notification",

  // ---- Recent requests ----
  "recent_requests.get": "view_recent_requests",

  // ---- Book meeting room ----
  "meeting_room.book": "can_book_meeting_room",
  "meeting_room.get_filter": "view_meeting_room_bookings",
  "meeting_room.update": "view_meeting_room_bookings",
  "meeting_room.delete": "view_meeting_room_bookings",
  "meeting_room.upcoming": "view_meeting_room_bookings",

  // ---- Working hours (config) ----
  "working_hours_config.get": "view_attendance_status",
  "working_hours_config.upsert_multiple": "configure_staff_schedules",
  "working_hours_config.upsert": "configure_staff_schedules",
  "working_hours_config.reset": "configure_staff_schedules",
};

/** Get permission key for an action (for middleware). */
export const getPermissionForAction = (action) => PERMISSION_BY_ACTION[action];
