# Changes/Update in AMS — Team message (copy-paste ready)

---

**Changes/Update in AMS**

The code has been updated for team leads; a team can now have **multiple leads**.

**Multiple leads per team**

- Teams can have multiple leads.
- All “is this user the lead?” checks use the **`leads`** array instead of a single `lead` field.
- The API uses **only** `leads` (array). There is no legacy `lead` (single) field.

**Tasks completed**

| Area | Change |
|------|--------|
| **Team model** (`src/models/team.model.js`) | `lead: ObjectId` → `leads: [ObjectId]` |
| **CreateTeamService** | Accepts **only** `leads` (array). Validates each lead and adds them to `members`. |
| **GetTeamByIdService** | Populates `leads` instead of `lead`. |
| **GetTeamLeadService → GetTeamLeadsService** | Returns an array of leads (or `[]`). Route: `GET /teams/:teamId/leads`. |
| **UpdateTeamService** | Accepts **only** `leads` (array). Validates leads, forbids removing current leads via `removed_members`, updates `leads` and keeps them in `members`. |
| **GetTeamMembersService** | “Teams this user leads” uses `Teams.find({ leads: requestingUserId })`. |
| **RemoveMemberFromTeamService** | If the removed user is in `team.leads`, they are removed from both `members` and `leads`. |
| **Team controller & routes** | `GetTeamLead` → `GetTeamLeads`. Route: `GET /teams/:teamId/leads`. Response: array of leads. |
| **Leave service & controller** | All “user is lead” logic uses `Teams.find({ leads: userInfo._id })`. Populates `leads`; sets `notification_to` = first lead, `moreUsers` = remaining leads so all leads are notified. |
| **RemoteWork controller & service** | Same as Leave: populate `leads`, notify all via `notification_to` + `moreUsers`, and `Teams.find({ leads: … })`. |
| **Working Hours controller & service** | Same as RemoteWork: populate `leads`, use `Teams.find({ leads: … })`. |
| **Recent Request service** | `Teams.find({ leads: userInfo._id })`. |

**API contract (create / edit team)**

- **Only** `leads` (array of user IDs) is accepted. No `lead` (single) field.
- **Create team** — body: `{ name, department, members?, leads? }`. `leads` must be an array (e.g. `[]` or `["id1", "id2"]`).
- **Update team** — body: `{ name?, new_department_id?, members?, removed_members?, leads? }`. If `leads` is sent, it **replaces** current leads; if omitted, existing leads are unchanged.

**Frontend changes needed**

1. **Edit team**: Use a **multi-select (checkbox dropdown)** for leads and send `leads: [id1, id2, ...]`.
2. **Team detail / by ID**: Treat `data.leads` as an array.
3. **GET /teams/:teamId/leads**: Expect an array of lead objects, not a single object.

---

*Zeeshan Ali, Sian Ali, Muhammad Adnan*
