# AMS Permissions — Mermaid Flowcharts & Class Diagram

Use these Mermaid code blocks in any Mermaid-compatible viewer (e.g. GitHub, Notion, Mermaid Live Editor, or VS Code Mermaid extension) to draw the permission model.

---

## 1. Flowchart: Admin updates a role’s permissions

Shows how an admin changes which permissions a role has. All users with that role get the new set (subject to their per-user grants/revokes).

```mermaid
flowchart TD
    subgraph Admin["Admin actions"]
        A1[Admin opens Role Management]
        A2[Selects a role e.g. Team Lead]
        A3[Sees list of all permissions from Permission Registry]
        A4[Checks/unchecks permissions for this role]
        A5[Clicks Save]
    end

    subgraph Backend["Backend"]
        B1[API: Update Role Permissions]
        B2[Validate: requester has role.update_permissions]
        B3[Load Role by id]
        B4[Replace Role.permissions with new set]
        B5[Save Role to DB]
    end

    subgraph Result["Result"]
        R1[All users with this role now have new default permissions]
        R2[Each user's effective permissions = role + grants - revokes]
    end

    A1 --> A2 --> A3 --> A4 --> A5
    A5 --> B1 --> B2
    B2 -->|Authorized| B3 --> B4 --> B5
    B2 -->|Forbidden| DENY[403 Forbidden]
    B5 --> R1 --> R2
```

---

## 2. Flowchart: Admin grants or revokes permissions for a user

Shows how an admin gives a user extra permissions (beyond their role) or revokes some of their role’s permissions.

```mermaid
flowchart TD
    subgraph Admin["Admin actions"]
        A1[Admin opens User Management / Edit User]
        A2[Selects a user]
        A3[Sees user's role and current effective permissions]
        A4{What to change?}
        A5a[Add permissions to permission_grants]
        A5b[Add permissions to permission_revokes]
        A6[Clicks Save]
    end

    subgraph Backend["Backend"]
        B1[API: Update User Permissions]
        B2[Validate: requester has user.update_permissions]
        B3[Load User by id]
        B4[Update User.permission_grants and/or User.permission_revokes]
        B5[Save User to DB]
    end

    subgraph Result["Result"]
        R1[User now has extra permissions from grants]
        R2[User no longer has revoked permissions even if role has them]
        R3[Effective = role permissions ∪ grants ∖ revokes]
    end

    A1 --> A2 --> A3 --> A4
    A4 -->|Allow more| A5a
    A4 -->|Restrict more| A5b
    A5a --> A6
    A5b --> A6
    A6 --> B1 --> B2
    B2 -->|Authorized| B3 --> B4 --> B5
    B2 -->|Forbidden| DENY[403 Forbidden]
    B5 --> R1 --> R2 --> R3
```

---

## 3. Flowchart: User performs an action — permission check

Shows how the system decides whether a user can perform an action (e.g. approve leave). It uses effective permissions (role + grants − revokes).

```mermaid
flowchart TD
    subgraph Request["Request"]
        R1[User requests action e.g. Approve Leave]
        R2[Request includes auth token]
    end

    subgraph Auth["Authentication"]
        A1[Authenticate token → get User]
        A2[User valid?]
    end

    subgraph Effective["Compute effective permissions"]
        E1[Load User's Role]
        E2[Get Role.permissions → base set]
        E3[Add User.permission_grants]
        E4[Remove User.permission_revokes]
        E5[Effective permissions = base ∪ grants ∖ revokes]
    end

    subgraph Check["Authorization"]
        C1[Required permission e.g. leave.approve]
        C2[Required permission in effective set?]
        C3[Optional: scope check e.g. is target in my team?]
    end

    subgraph Outcome["Outcome"]
        O1[Allow: execute action]
        O2[Deny: 403 Forbidden]
    end

    R1 --> R2 --> A1 --> A2
    A2 -->|No| O2
    A2 -->|Yes| E1 --> E2 --> E3 --> E4 --> E5
    E5 --> C1 --> C2
    C2 -->|No| O2
    C2 -->|Yes| C3
    C3 -->|Fail or N/A| O2
    C3 -->|Pass| O1
```

---

## 4. Flowchart: High-level permission flows (overview)

Single diagram summarizing: who can change what, and how a user’s allowed actions are determined.

```mermaid
flowchart LR
    subgraph Definitions["Definitions"]
        PR[Permission Registry<br/>all permission keys]
        R[Role<br/>permissions: list]
        U[User<br/>role, grants, revokes]
    end

    subgraph AdminUpdates["Admin updates"]
        AR[Admin updates Role permissions]
        AU[Admin updates User grants/revokes]
    end

    subgraph Usage["When user acts"]
        E[Effective permissions<br/>= role ∪ grants ∖ revokes]
        P[Permission check]
        A[Allow / Deny]
    end

    PR --> R
    R --> U
    PR --> U
    Admin([Admin]) --> AR
    Admin --> AU
    AR --> R
    AU --> U
    U --> E --> P --> A
    P --> PR
```

---

## 5. Class diagram: Permissions, roles, and users

Shows the main entities and how effective permissions are derived. Methods are the main operations you’d implement.

```mermaid
classDiagram
    class PermissionRegistry {
        <<singleton or static>>
        +String[] getAllKeys()
        +String getLabel(key)
        +String getModule(key)
    }

    class Permission {
        +String key
        +String label
        +String module
    }

    class Role {
        +ObjectId _id
        +String name
        +String description
        +String[] permissions
        +addPermission(key)
        +removePermission(key)
        +setPermissions(keys)
        +hasPermission(key)
    }

    class User {
        +ObjectId _id
        +ObjectId roleId
        +String[] permission_grants
        +String[] permission_revokes
        +getEffectivePermissions()
        +hasPermission(key)
        +can(requiredPermission)
    }

    class PermissionService {
        +getEffectivePermissions(user)
        +hasPermission(user, key)
        +requirePermission(user, key)
    }

    class RoleService {
        +getRole(id)
        +updateRolePermissions(roleId, permissions)
        +getPermissionsForRole(roleId)
    }

    class UserPermissionService {
        +grantPermission(userId, key)
        +revokePermission(userId, key)
        +getUserGrants(userId)
        +getUserRevokes(userId)
    }

    PermissionRegistry "1" --> "*" Permission : defines
    Role "1" --> "*" Permission : has many
    User "1" --> "1" Role : has one
    User "1" --> "*" Permission : permission_grants
    User "1" --> "*" Permission : permission_revokes

    PermissionService ..> User : uses
    PermissionService ..> Role : uses
    PermissionService ..> PermissionRegistry : uses
    RoleService ..> Role : manages
    UserPermissionService ..> User : manages
```

---

## 6. Class diagram: Detailed (with effective permission formula)

Same idea as above, with the effective-permission formula and relationships spelled out.

```mermaid
classDiagram
    direction TB

    class PermissionRegistry {
        keys: String[]
        getLabel(key): String
        getModule(key): String
    }

    class Role {
        _id: ObjectId
        name: String
        description: String
        permissions: String[]
        hasPermission(key): boolean
    }

    class User {
        _id: ObjectId
        roleId: ObjectId
        permission_grants: String[]
        permission_revokes: String[]
        getEffectivePermissions(): String[]
        hasPermission(key): boolean
    }

    class EffectivePermissionLogic {
        <<formula>>
        effective = (Role.permissions ∪ User.permission_grants) ∖ User.permission_revokes
        userCan(key): true if key in effective
    }

    Role "1" -- "0..*" User : users have one role
    User "0..*" -- "0..*" PermissionRegistry : grants reference keys
    User "0..*" -- "0..*" PermissionRegistry : revokes reference keys
    Role "0..*" -- "0..*" PermissionRegistry : permissions reference keys
    EffectivePermissionLogic .. Role : uses
    EffectivePermissionLogic .. User : uses
    EffectivePermissionLogic .. PermissionRegistry : validates keys
```

---

## 7. Flowchart: “Admin allows more permissions than role” (grant path)

Focus on the case: user has a role (e.g. Employee) with a fixed set; admin gives that user extra permissions (e.g. `leave.approve`).

```mermaid
flowchart TD
    subgraph Initial["Initial state"]
        U[User: role = Employee]
        R[Role Employee: attendance.mark, leave.apply, ...]
        E1[User effective = only role permissions]
    end

    subgraph AdminGrants["Admin grants extra"]
        A[Admin: Edit User Permissions]
        G[Add leave.approve to permission_grants]
        S[Save User]
    end

    subgraph NewState["New state"]
        U2[User: role = Employee, permission_grants = leave.approve]
        E2[Effective = role permissions ∪ leave.approve]
        ACT[User can now Approve Leave even though role does not include it]
    end

    U --> R --> E1
    A --> G --> S
    E1 --> AdminGrants
    S --> U2 --> E2 --> ACT
```

---

## 8. Entity relationship (roles, users, permissions)

Useful to see how Role, User, and the permission lists relate at the data level.

```mermaid
erDiagram
    PERMISSION_REGISTRY ||--o{ ROLE_PERMISSIONS : "defines keys"
    ROLE ||--o{ ROLE_PERMISSIONS : "has"
    ROLE ||--o{ USER : "assigned to"
    USER ||--o{ USER_GRANTS : "has"
    USER ||--o{ USER_REVOKES : "has"
    PERMISSION_REGISTRY ||--o{ USER_GRANTS : "key"
    PERMISSION_REGISTRY ||--o{ USER_REVOKES : "key"

    PERMISSION_REGISTRY {
        string key PK
        string label
        string module
    }

    ROLE {
        ObjectId _id PK
        string name
        string description
    }

    ROLE_PERMISSIONS {
        ObjectId role_id FK
        string permission_key
    }

    USER {
        ObjectId _id PK
        ObjectId role_id FK
        string permission_grants_array
        string permission_revokes_array
    }

    USER_GRANTS {
        ObjectId user_id FK
        string permission_key
    }

    USER_REVOKES {
        ObjectId user_id FK
        string permission_key
    }
```

---

## 9. Sequence: Admin updates role permissions → user’s next request

Shows the order of operations: admin saves new role permissions, then the next time a user with that role makes a request, they get the new effective set.

```mermaid
sequenceDiagram
    participant Admin
    participant UI
    participant API
    participant DB
    participant UserReq
    participant Auth

    Admin->>UI: Edit Role "Team Lead" permissions
    UI->>API: PUT /roles/:id/permissions
    API->>API: Check admin has role.update_permissions
    API->>DB: Update Role.permissions
    DB-->>API: OK
    API-->>UI: 200 OK

    Note over UserReq,Auth: Later: user with role Team Lead makes a request

    UserReq->>Auth: Request with token (e.g. Approve Leave)
    Auth->>DB: Load User + Role
    DB-->>Auth: User, Role.permissions, User.permission_grants, User.permission_revokes
    Auth->>Auth: effective = role.permissions ∪ grants ∖ revokes
    Auth->>Auth: leave.approve in effective?
    Auth-->>UserReq: Allow (200) or Deny (403)
```

---

## 10. Sequence: Admin grants user an extra permission → user uses it

Shows admin adding a permission to a user’s `permission_grants`, then that user successfully performing the action.

```mermaid
sequenceDiagram
    participant Admin
    participant UI
    participant API
    participant DB
    participant Employee
    participant API2
    participant Auth

    Admin->>UI: Edit User (Employee John)
    UI->>UI: Add "leave.approve" to Additional Permissions
    Admin->>UI: Save
    UI->>API: PATCH /users/:id/permissions { grants: [leave.approve] }
    API->>API: Check admin has user.update_permissions
    API->>DB: Update User.permission_grants
    DB-->>API: OK
    API-->>UI: 200 OK

    Note over Employee,Auth: John (Employee) tries to approve leave

    Employee->>API2: PUT /leave/:id/status (approve)
    API2->>Auth: requirePermission(user, leave.approve)
    Auth->>DB: Load User + Role
    DB-->>Auth: User (role=Employee), Role.permissions, User.permission_grants
    Auth->>Auth: effective = role ∪ grants ∖ revokes → includes leave.approve
    Auth-->>API2: OK
    API2->>API2: Optional: scope check (is leave in my team?)
    API2->>DB: Update leave status
    API2-->>Employee: 200 OK
```

---

## How to use

- **Flowcharts (1–4, 7):** Permission flows and “who can change what.”
- **Class diagrams (5–6):** Data model and services (Role, User, effective permissions).
- **ER (8):** Tables/collections and relationships.
- **Sequences (9–10):** Step-by-step for “admin updates role” and “admin grants user → user uses it.”

Copy any code block into [Mermaid Live Editor](https://mermaid.live) or your docs to render the diagrams.
