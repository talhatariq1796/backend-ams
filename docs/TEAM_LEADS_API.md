# Team Leads API (Multiple Leads per Team)

The API uses **only** `leads` (array). There is no legacy `lead` (single) field.

## Request body

### Create team — `POST /team`

```json
{
  "name": "Engineering",
  "department": "<departmentId>",
  "members": ["<userId1>", "<userId2>"],
  "leads": ["<userIdA>", "<userIdB>"]
}
```

- **`leads`** (optional): Array of user IDs. Use an empty array `[]` for no leads. Always send an array.

### Update team — `PUT /teams/:teamId`

```json
{
  "name": "Engineering",
  "new_department_id": "<departmentId>",
  "members": ["<userId1>"],
  "removed_members": ["<userId2>"],
  "leads": ["<userIdA>", "<userIdB>", "<userIdC>"]
}
```

- **`leads`** (optional): Array of user IDs. If sent, it **replaces** the current leads. If omitted, existing leads are unchanged.

## Frontend: checkbox dropdown for leads

When assigning leads for create/edit team:

1. **Data**: Load options from `GET /team-leads` (users with role `teamLead`).
2. **Control**: Use a **multi-select** (checkbox dropdown) so the admin can select multiple leads.
3. **Value**: Store selected IDs in an array, e.g. `selectedLeadIds = ["id1", "id2"]`.
4. **Submit**:
   - Create: send `{ ..., leads: selectedLeadIds }`.
   - Update: send `{ ..., leads: selectedLeadIds }`.

Example shape for the dropdown source (from your team-leads API):

- Options: `{ _id, first_name, last_name, email }` from `GET /team-leads`.
- Display: e.g. `first_name + " " + last_name`.
- Submit: array of `_id`s as `leads`.

## Response

- Team objects include `leads: [{ _id, first_name, last_name }, ...]` (populated).
- `GET /teams/:teamId/leads` returns `data: [ lead1, lead2, ... ]` (array of lead users).
