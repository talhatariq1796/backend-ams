# Business Logic Inventory for Multitenancy Migration

This document lists all business logic that needs to be moved to the database/backend configuration for multitenancy support.

---

## 1. ATTENDANCE MARKING LOGIC

### 1.1 Check-in Logic

- **Buffer Time**: Default 30 minutes after check-in time (configurable: `attendance_rules.buffer_time_minutes` or legacy `buffer_time_minutes`)
- **Late Detection**: If check-in is more than buffer time after scheduled check-in time → marked as `late`
- **On-time Detection**: Check-in within buffer time → marked as `present`
- **Remote Work Override**: If user has approved remote work, status is `remote` (bypasses IP check if `working_hours_rules.allow_remote_without_ip_check` is true)
- **IP Location Check**:
  - Enabled/disabled via `attendance_rules.enable_ip_check` or `working_hours_rules.enable_location_check`
  - Allowed cities: From `working_hours_rules.allowed_cities` array (currently empty in DB, but code uses ["lahore", "faisalabad"])
  - Suspicious organizations blocked: Controlled by `working_hours_rules.block_vpn_proxy` (list still hardcoded: ["vpn", "proxy", "digitalocean", "ovh", "contabo"])
  - Allowed IPs list from config (`allowed_ips` map)
- **Weekend Check**: Controlled by `attendance_rules.enable_weekend_checkin` (default: false, so check-in blocked on weekends)
- **Leave Override**: If user checks in on an approved leave day:
  - Full-day leave: Restores exactly 1 day to leave balance
  - Half-day leave: Handled separately
  - Creates attendance override record
  - Notification controlled by `notification_rules.notify_on_leave_override`

### 1.2 Check-out Logic

- **Production Time Calculation**: Based on check-in to check-out duration
- **Status Determination by Hours Worked** (thresholds still hardcoded, but deduction rules are configurable):
  - **< 4.5 hours**: `auto-leave` (full-day unpaid leave applied if `leave_deduction_rules.on_missing_attendance.enabled` is true)
  - **4.5-6.5 hours**: `auto-half-day` (half-day unpaid leave applied if `leave_deduction_rules.on_missing_checkout.enabled` is true) OR `half-day` (if approved half-day leave exists)
  - **6.5-8 hours**: `early-leave` (no leave applied if `attendance_rules.enable_early_leave_deduction` is false, just marked)
  - **≥ 8 hours**: `present` or `late` (based on check-in time)
- **Half-day Leave Handling**:
  - If user has approved half-day leave but works < 4.5h → upgraded to full-day leave
  - If user has approved half-day leave but works 4.5-6.5h → remains half-day
  - If user has approved half-day leave but works ≥ 8h → half-day leave removed, 0.5 days restored
- **Early Leave Tracking**:
  - Counts early leaves per month
  - Limit: `attendance_rules.max_early_leaves_per_month` (default: 5)
  - Notification: `notification_rules.notify_on_early_leave`

### 1.3 Attendance Status Types

- `present`: Full day worked, on time
- `late`: Checked in late but worked full day
- `half-day`: Approved half-day leave
- `auto-half-day`: System-generated half-day unpaid leave
- `early-leave`: Worked 6.5-8 hours (no leave applied)
- `leave`: Approved leave (annual/casual/etc.)
- `auto-leave`: System-generated full-day unpaid leave
- `remote`: Approved remote work
- `holiday`: Public holiday
- `trip`: Company trip event
- `absent`: No attendance record

---

## 2. LEAVE MANAGEMENT LOGIC

### 2.1 Leave Types

- **General Leave Types** (configurable per company):
  - `annual`: Default 10 days
  - `casual`: Default 7 days
  - `sick`: Default 7 days
  - `demise`: Default 5 days
  - `hajj/umrah`: Default 5 days
  - `marriage`: Default 5 days
  - `maternity`: Default 90 days (female only)
  - `paternity`: Default 5 days (male only)
  - `probation`: Default 3 days
  - `unpaid`: Default 10 days
- **Business Leave Types**: Separate config for business developers (same structure as general)

### 2.2 Leave Balance Calculation

- **Permanent Employees**:
  - General: `allowedLeaveForPermanentEmployees` (default: 24 days)
  - Business Developers: `allowedLeaveForPermanentBusinessDevelopers` (default: 24 days)
  - Distribution: 30% sick, 30% casual, 40% annual (from total)
  - Pro-rated if joining mid-year: `(allowedLeave * daysWorked) / 365`
- **Probation/Internship Employees**:
  - Only get `probation` leave type
  - Amount: `probation` from leave types config (default: 3 days)
  - No pro-rating
- **Leave Breakdown Exclusions**: These don't count toward `total_taken_leaves`:
  - `unpaid`
  - `demise`
  - `hajj/umrah`
  - `marriage`
  - `paternity`
  - `maternity`

### 2.3 Notice Period Violations (Policy-Based)

- **Annual/Casual Leave**:
  - 1-2 days: Requires 3 days' notice (Policy 4.1.1/4.1.3)
  - 3-5 days: Requires 14 days' notice (2 weeks)
  - 6+ days: Requires 28 days' notice (4 weeks)
- **Sick Leave**:
  - > 2 consecutive days: Requires medical certificate (Policy 4.1.2)
- **Probation Leave**:
  - 1-2 days: Requires 3 days' notice (Policy 4.2.1)
  - 3 days: Requires 7 days' notice (1 week)
- **Special Leaves** (maternity, paternity, hajj/umrah, marriage):
  - Requires 28 days' notice (4 weeks) (Policies 4.2.2-4.2.5)
- **Unpaid Leave**:
  - Same as annual/casual (Policy 4.2.7)
- **Bereavement (demise)**: No strict notice requirements
- **Admin Override**: Admins bypass notice period checks

### 2.4 Leave Application Rules

- **Overlapping Leave Prevention**: Cannot apply if overlapping approved/pending leave exists
- **Auto-leave Cleanup**: When applying new leave, deletes overlapping auto-generated leaves
- **Leave Balance Check**: Validates remaining balance before allowing application
- **Date Validation**: Cannot apply for dates more than 30 days in the past
- **Weekend Exclusion**: Leave only applies to weekdays (Monday-Friday)

### 2.5 Leave Approval/Rejection

- **Role-Based Authorization**:
  - Team Leads: Can approve/reject team members only
  - Admins: Can approve/reject anyone
  - Cannot approve own leave
- **Auto-leave Conversion**: When approved, converts `auto-leave` attendance to regular `leave`
- **Half-day Conversion**: Converts `auto-half-day` unpaid to approved leave type if applicable
- **Attendance Creation**: Creates attendance records for approved leave dates (weekdays only)

---

## 3. FINE CALCULATION LOGIC

### 3.1 Late Arrival Fine Policy

Applied monthly based on late count:

- **0-3 lates**: No fine (Rs. 0)
- **4-5 lates**: Rs. 500 per late after 3rd (e.g., 4 lates = Rs. 500, 5 lates = Rs. 1000)
- **6-10 lates**: Rs. 1000 per late (e.g., 6 lates = Rs. 6000)
- **11+ lates**: Rs. 1500 per late (e.g., 11 lates = Rs. 16500)

**Formula**:

```javascript
if (lateCount <= 3) return 0;
else if (lateCount <= 5) return (lateCount - 3) * 500;
else if (lateCount <= 10) return lateCount * 1000;
else return lateCount * 1500;
```

---

## 4. PROBATION & INTERNSHIP LOGIC

### 4.1 Leave Eligibility

- **Probation/Internship Employees**:
  - Only eligible for `probation` leave type
  - Default: 3 days per year
  - No other leave types available
- **Permanent Employees**:
  - All leave types except `probation`
  - Pro-rated leave if joining mid-year

### 4.2 Leave Balance Initialization

- Probation/Internship: Only `probation` leave in breakdown
- Permanent: Full breakdown with all leave types

---

## 5. CRON JOBS & AUTOMATED LOGIC

### 5.1 Attendance Regularization Cron

**Schedule**: Configurable via `cron_job_rules.auto_attendance_regularization.run_time` (default: "06:00") and `run_days` (default: [2,3,4,5,6] for Tue-Sat)
**Processes**: Yesterday's attendance
**Enabled**: `cron_job_rules.auto_attendance_regularization.enabled` (default: true)
**User Filter**: `cron_job_rules.auto_attendance_regularization.apply_to_active_users_only` (default: true)

**Logic Flow**:

1. **Working Day Check**: Skips if yesterday was not a working day (configurable: `working_days`, default: [1,2,3,4,5] = Mon-Fri)
2. **Public Holiday Check** (if `cron_job_rules.auto_holiday_marking` is true):
   - If public holiday → marks all users as `holiday`
   - Skips further processing
3. **Trip Event Check** (if `cron_job_rules.auto_trip_event_handling` is true):
   - If company trip on date → marks as `trip`
   - Overrides normal attendance
4. **Office Event Check** (if `cron_job_rules.auto_office_event_handling` is true):
   - If event prevents checkout (starts after 4 PM PKT or extends beyond 8 PM PKT - thresholds still hardcoded):
     - Auto-checkout at user's configured checkout time
     - Marks as `present` with full hours
   - If event during office hours → normal auto-half-day logic applies
5. **Missing Attendance (No Check-in)** (if `leave_deduction_rules.on_missing_attendance.enabled` is true):
   - Creates `auto-leave` status
   - Creates unpaid leave record (1 day if `leave_deduction_rules.on_missing_attendance.is_half_day` is false)
   - Leave type: `leave_deduction_rules.on_missing_attendance.leave_type` (default: "unpaid")
   - Deducts from leave balance
   - Sends notification (if `notification_rules.notify_on_missing_checkout` is true)
6. **Missing Check-out (Has Check-in, No Check-out)** (if `auto_checkout_rules.enabled` is true):
   - Sets checkout to `auto_checkout_rules.auto_checkout_hours_after_checkin` hours after check-in (default: 5)
   - Creates status: `auto_checkout_rules.status_on_auto_checkout` (default: "auto-half-day")
   - If `auto_checkout_rules.trigger_missing_checkout_deduction` is true and `leave_deduction_rules.on_missing_checkout.enabled` is true:
     - Creates unpaid leave record (0.5 days if `leave_deduction_rules.on_missing_checkout.is_half_day` is true)
     - Leave type: `leave_deduction_rules.on_missing_checkout.leave_type` (default: "unpaid")
     - Deducts from leave balance
   - Sends notification (if `notification_rules.notify_on_auto_checkout` is true)

### 5.2 Celebration Post Cron

**Schedule**: `0 1 * * *` (Daily at 1:00 AM UTC = 6:00 AM PKT)
**Logic**:

- Checks for birthdays and work anniversaries
- Creates celebration posts
- Sends notifications

### 5.3 Reset Expired Working Hours Cron

**Schedule**: `55 23 * * *` (Daily at 11:55 PM)
**Logic**:

- Finds working hours with `expiry_date <= today`
- Resets to default working hours from config:
  - General: `working_hours.checkin_time` and `working_hours.checkout_time`
  - Business Developers: `bd_working_hours.checkin_time` and `bd_working_hours.checkout_time`

### 5.4 Reset Token Cleaner Cron

**Schedule**: Not specified in search results (likely daily cleanup)

---

## 6. PUBLIC HOLIDAYS

### 6.1 Current Implementation

- **Source**: Calendarific API (Pakistan holidays)
- **Country Code**: `PK` (hardcoded)
- **Type**: National holidays only
- **Storage**: Stored as events with `category: "public-holiday"`
- **Auto-marking**: Cron job marks all users as `holiday` on public holidays

### 6.2 Holiday Detection

- Checks if date matches any public holiday event
- If match found, all users marked as `holiday` for that date
- Overrides normal attendance processing

---

## 7. WORKING HOURS LOGIC

### 7.1 Default Working Hours

- **General Employees**:
  - Check-in: `working_hours.checkin_time` (configurable)
  - Check-out: `working_hours.checkout_time` (configurable)
- **Business Developers**:
  - Check-in: `bd_working_hours.checkin_time` (configurable)
  - Check-out: `bd_working_hours.checkout_time` (configurable)

### 7.2 Custom Working Hours

- Users can request custom working hours
- Can be:
  - Fixed times (same check-in/check-out daily)
  - Week-based custom (different times per day of week)
- Has start date, end date, and expiry date
- Auto-resets to default when expired

### 7.3 Working Days Configuration

- Default: Monday-Friday (`[1,2,3,4,5]`)
- Configurable per company: `working_days` array
- Used by cron job to skip weekend processing

---

## 8. REMOTE WORK LOGIC

### 8.1 Remote Work Request Rules

- **Reason Length**: 10-250 characters (required)
- **Date Validation**: Start date cannot be after end date
- **Overlap Prevention**:
  - Cannot overlap with approved/pending leave
  - Cannot overlap with other approved/pending remote work
- **Status**: `pending`, `approved`, `rejected`

### 8.2 Remote Work Impact on Attendance

- **Check-in**: If approved remote work exists → bypasses IP check, marks as `remote`
- **Attendance Override**: Remote work status overrides other attendance statuses
- **Cron Job**: Remote work is checked during attendance regularization

---

## 9. ADMIN ATTENDANCE MARKING

### 9.1 Admin Mark Attendance Logic

When admin manually marks attendance:

- **Both Check-in & Check-out**:
  - < 4.5 hours → `auto-leave` (unpaid, 1 day)
  - 4.5-6.5 hours → `auto-half-day` (unpaid, 0.5 days)
  - 6.5-8 hours → `early-leave`
  - ≥ 8 hours → `present` or `late` (based on check-in time)
- **Only Check-in**:
  - Late check-in → `late`
  - On-time check-in → `present`
- **No Times**:
  - Marks as `leave` (annual, 1 day)
- **Remote Work Override**: If approved remote work exists → `remote`

### 9.2 Admin Edit Attendance Logic

- **Status = "leave"**:
  - Removes check-in/check-out
  - Creates annual leave (1 day)
- **Both Times Exist**: Same logic as check-out (hours-based status)
- **Only Check-in**: Late/on-time logic
- **No Times**: Marks as leave

---

## 10. NOTIFICATION & VIOLATION LOGIC

### 10.1 Notice Violation Notes

- Stored in `notice_violation_note` field on leave
- Does not block leave application, just records violation
- Policy references included (e.g., "Policy 4.1.1")

### 10.2 Notification Triggers

- Leave application → Notifies team lead and admins
- Leave approval/rejection → Notifies employee
- Attendance marked → Notifies user
- Auto-leave/auto-half-day → Notifies user and admins
- Leave override (attendance on leave day) → Notifies user and admins
- Holiday marking → Notifies user
- Trip/office event attendance → Notifies user

---

## 11. WORKING DAYS CALCULATION

### 11.1 Working Days in Month

- Excludes weekends (Saturday=6, Sunday=0)
- Used for monthly attendance reports
- Formula: Count all days in month except weekends

### 11.2 Working Days Between Dates

- Excludes weekends when calculating leave days
- Used for leave application validation

---

## 12. GENDER-SPECIFIC LEAVE LOGIC

### 12.1 Maternity Leave

- Only available for females
- Default: 90 days
- Filtered out for male users in available leave types

### 12.2 Paternity Leave

- Only available for males
- Default: 5 days
- Filtered out for female users in available leave types

---

## 13. BUSINESS DEVELOPER LOGIC

### 13.1 Leave Types

- Uses `business_leave_types` config instead of `general_leave_types`
- Same structure but separate configuration

### 13.2 Working Hours

- Uses `bd_working_hours` instead of `working_hours`
- Separate default check-in/check-out times

### 13.3 Leave Balance

- Uses `allowedLeaveForPermanentBusinessDevelopers` instead of `allowedLeaveForPermanentEmployees`
- Detection: User designation contains "business" (case-insensitive)

---

## 14. CONFIGURATION PARAMETERS (Currently Hardcoded/Configurable)

### 14.1 Office Config Model Fields

**Basic Configuration:**

- `company_id`: ObjectId reference to company
- `office_info`: Company information (name, business_field, email, contact, address, company_logo)
- `office_location`: Latitude and longitude
- `working_days`: Default [1,2,3,4,5] (Mon-Fri)
- `isSignup`: Boolean flag

**Working Hours:**

- `working_hours.checkin_time`: Date object (default check-in time)
- `working_hours.checkout_time`: Date object (default check-out time)
- `bd_working_hours.checkin_time`: Date object (business developer check-in)
- `bd_working_hours.checkout_time`: Date object (business developer check-out)

**Leave Configuration:**

- `general_leave_types`: Object with leave type defaults (annual, casual, sick, etc.)
- `business_leave_types`: Object with leave type defaults for business developers
- `allowedLeaveForPermanentEmployees`: Default 24
- `allowedLeaveForPermanentBusinessDevelopers`: Default 24
- `allowedLeaveForProbationInternshipEmployees`: Default 3

**IP & Location Settings:**

- `allowed_ips`: Map of allowed IP addresses (key-value pairs)
- `enable_ip_check`: Boolean, default true (legacy field, also in attendance_rules)
- `buffer_time_minutes`: Default 30 (legacy field, also in attendance_rules)

**Attendance Rules (NEW - Structured Configuration):**

- `attendance_rules.buffer_time_minutes`: Default 30
- `attendance_rules.enable_weekend_checkin`: Boolean, default false
- `attendance_rules.enable_ip_check`: Boolean, default true
- `attendance_rules.max_early_leaves_per_month`: Number, default 5
- `attendance_rules.late_checkin_threshold_minutes`: Number, default 30
- `attendance_rules.enable_early_leave_deduction`: Boolean, default true

**Auto Checkout Rules (NEW):**

- `auto_checkout_rules.enabled`: Boolean, default true
- `auto_checkout_rules.auto_checkout_hours_after_checkin`: Number, default 5
- `auto_checkout_rules.status_on_auto_checkout`: String, default "auto-half-day"
- `auto_checkout_rules.trigger_missing_checkout_deduction`: Boolean, default true

**Leave Deduction Rules (NEW):**

- `leave_deduction_rules.on_missing_attendance.enabled`: Boolean, default true
- `leave_deduction_rules.on_missing_attendance.leave_type`: String, default "unpaid"
- `leave_deduction_rules.on_missing_attendance.is_half_day`: Boolean, default false
- `leave_deduction_rules.on_missing_checkout.enabled`: Boolean, default true
- `leave_deduction_rules.on_missing_checkout.leave_type`: String, default "unpaid"
- `leave_deduction_rules.on_missing_checkout.is_half_day`: Boolean, default true
- `leave_deduction_rules.on_missing_checkout_hours_assumed`: Number, default 5

**Half Day Rules (NEW - NOTE: Values don't match code logic):**

- `half_day_rules.minimum_hours_for_full_day`: Number, default 7
- `half_day_rules.maximum_hours_for_half_day`: Number, default 5
- **⚠️ DISCREPANCY**: Code uses 4.5h (auto-leave), 6.5h (auto-half-day), 8h (full-day), but DB has 7h and 5h. These DB values are not currently used in the code.

**Working Hours Rules (NEW):**

- `working_hours_rules.enable_location_check`: Boolean, default true
- `working_hours_rules.allowed_cities`: Array of strings (default: empty, but code uses ["lahore", "faisalabad"])
- `working_hours_rules.block_vpn_proxy`: Boolean, default true
- `working_hours_rules.allow_remote_without_ip_check`: Boolean, default false
- `working_hours_rules.timezone`: String, default "Asia/Karachi"

**Cron Job Rules (NEW):**

- `cron_job_rules.auto_attendance_regularization.enabled`: Boolean, default true
- `cron_job_rules.auto_attendance_regularization.run_time`: String, default "06:00" (format: "HH:MM")
- `cron_job_rules.auto_attendance_regularization.run_days`: Array of numbers (default: empty, but code uses [2,3,4,5,6] for Tue-Sat)
- `cron_job_rules.auto_attendance_regularization.apply_to_active_users_only`: Boolean, default true
- `cron_job_rules.auto_trip_event_handling`: Boolean, default true
- `cron_job_rules.auto_office_event_handling`: Boolean, default true
- `cron_job_rules.auto_holiday_marking`: Boolean, default true

**Team Specific Rules (NEW):**

- `team_specific_rules.bd_team.custom_working_hours`: Boolean, default true

**Notification Rules (NEW):**

- `notification_rules.notify_on_late_checkin`: Boolean, default true
- `notification_rules.notify_on_early_leave`: Boolean, default true
- `notification_rules.notify_on_missing_checkout`: Boolean, default true
- `notification_rules.notify_admins_on_attendance_override`: Boolean, default true
- `notification_rules.notify_on_auto_checkout`: Boolean, default true
- `notification_rules.notify_on_leave_override`: Boolean, default true

### 14.2 Hardcoded Values (Still Need to be Configurable)

**Fine Policy (NOT YET IN DB):**

- Late fine tiers (3, 5, 10 thresholds and amounts 500, 1000, 1500)

**Hours Thresholds (PARTIALLY IN DB):**

- 4.5 hours (auto-leave threshold) - **NOT in DB, still hardcoded**
- 6.5 hours (auto-half-day threshold) - **NOT in DB, still hardcoded**
- 8 hours (full-day threshold) - **NOT in DB, still hardcoded**
- Note: `half_day_rules` has `minimum_hours_for_full_day: 7` and `maximum_hours_for_half_day: 5`, but these don't match the code logic (4.5h, 6.5h, 8h)

**IP Location Settings (PARTIALLY IN DB):**

- `working_hours_rules.allowed_cities`: Array (currently empty in DB, but code uses ["lahore", "faisalabad"])
- `working_hours_rules.block_vpn_proxy`: Boolean (in DB)
- Suspicious Organizations list: ["vpn", "proxy", "digitalocean", "ovh", "contabo"] - **NOT in DB, still hardcoded**

**Leave Distribution (NOT YET IN DB):**

- 30% sick, 30% casual, 40% annual (used for leave balance calculation)

**Office Event Thresholds (NOT YET IN DB):**

- 4 PM PKT, 8 PM PKT (times that prevent checkout)

**Public Holiday Settings (NOT YET IN DB):**

- Country Code: "PK" (Pakistan)
- API source configuration

**Notice Period Requirements (NOT YET IN DB):**

- Days for different leave types and durations (3, 14, 28 days)
- Medical certificate threshold (2 consecutive sick days)

**Early Leave Monthly Limit:**

- **NOW IN DB**: `attendance_rules.max_early_leaves_per_month` (default: 5)
- Previously tracked but not enforced

---

## 15. SUMMARY OF CONFIGURABLE BUSINESS RULES

### 15.1 Already Configured in Database ✅

1. **Buffer Time** - `attendance_rules.buffer_time_minutes`
2. **Working Days** - `working_days` array
3. **Default Working Hours** - `working_hours.checkin_time/checkout_time`
4. **Business Developer Working Hours** - `bd_working_hours.checkin_time/checkout_time`
5. **Leave Type Limits** - `general_leave_types` and `business_leave_types`
6. **Total Leave Allowed** - `allowedLeaveForPermanentEmployees`, `allowedLeaveForPermanentBusinessDevelopers`, `allowedLeaveForProbationInternshipEmployees`
7. **Early Leave Monthly Limit** - `attendance_rules.max_early_leaves_per_month`
8. **Early Leave Assumption** - `auto_checkout_rules.auto_checkout_hours_after_checkin` and `leave_deduction_rules.on_missing_checkout_hours_assumed`
9. **IP Check Settings** - `working_hours_rules.enable_location_check`, `working_hours_rules.allowed_cities`, `working_hours_rules.block_vpn_proxy`, `allowed_ips`
10. **Weekend Check-in** - `attendance_rules.enable_weekend_checkin`
11. **Auto Checkout** - `auto_checkout_rules.enabled`, `auto_checkout_rules.status_on_auto_checkout`
12. **Leave Deduction Rules** - `leave_deduction_rules` (on missing attendance/checkout)
13. **Half Day Rules** - `half_day_rules` (though values don't match code logic)
14. **Timezone** - `working_hours_rules.timezone`
15. **Cron Job Configuration** - `cron_job_rules` (enabled flags, run time, run days)
16. **Notification Preferences** - `notification_rules` (all notification toggles)
17. **Team Specific Rules** - `team_specific_rules`

### 15.2 Still Need to be Added to Database ❌

1. **Fine Policy** - Late fine tiers (thresholds: 3, 5, 10; amounts: 500, 1000, 1500)
2. **Hours Thresholds** - 4.5h (auto-leave), 6.5h (auto-half-day), 8h (full-day)
   - Note: `half_day_rules` exists but values (7h, 5h) don't match actual code logic
3. **Suspicious Organizations List** - Currently hardcoded: ["vpn", "proxy", "digitalocean", "ovh", "contabo"]
4. **Leave Distribution Percentages** - 30% sick, 30% casual, 40% annual (for balance calculation)
5. **Office Event Thresholds** - 4 PM PKT, 8 PM PKT (times that prevent checkout)
6. **Public Holiday Source** - Country code ("PK"), API configuration
7. **Notice Period Requirements** - Days for different leave types and durations (3, 14, 28 days)
8. **Medical Certificate Threshold** - 2 consecutive sick days
9. **Gender-Specific Leave Rules** - Maternity/paternity availability logic

---

## 16. CRON JOB SCHEDULES

1. **Attendance Regularization**: `0 1 * * 2-6` (Tue-Sat 1 AM UTC = 6 AM PKT)
2. **Celebration Posts**: `0 1 * * *` (Daily 1 AM UTC = 6 AM PKT)
3. **Reset Expired Working Hours**: `55 23 * * *` (Daily 11:55 PM)
4. **Reset Token Cleaner**: Schedule not found (likely daily)

---

---

## 16. CONFIGURATION DISCREPANCIES & NOTES

### 16.1 Fields in DB but Not Used in Code

- `half_day_rules.minimum_hours_for_full_day` (7) and `maximum_hours_for_half_day` (5) - Code uses 4.5h, 6.5h, 8h instead
- `attendance_rules.late_checkin_threshold_minutes` - Seems redundant with `buffer_time_minutes`

### 16.2 Fields in Code but Not in DB

- Fine policy thresholds and amounts (3, 5, 10 lates; Rs. 500, 1000, 1500)
- Hours thresholds (4.5h, 6.5h, 8h) - though `half_day_rules` exists with different values
- Suspicious organizations list (hardcoded array)
- Leave distribution percentages (30% sick, 30% casual, 40% annual)
- Office event time thresholds (4 PM PKT, 8 PM PKT)
- Public holiday country code and API settings
- Notice period requirements (3, 14, 28 days)
- Medical certificate threshold (2 consecutive sick days)

### 16.3 Legacy vs New Configuration Fields

Some fields exist in both legacy format and new structured format:

- `buffer_time_minutes` (legacy) vs `attendance_rules.buffer_time_minutes` (new)
- `enable_ip_check` (legacy) vs `attendance_rules.enable_ip_check` and `working_hours_rules.enable_location_check` (new)

**Recommendation**: Standardize on the new structured format and deprecate legacy fields.

---

## END OF INVENTORY

This inventory covers all business logic found in the attendance and leave management system. Most rules are now configurable in the database, but some hardcoded values still need to be migrated for full multitenancy support.
