# G3-Tornado User Management System

## Overview

This document describes the comprehensive user management and permissions system for G3-Tornado.

## Features

### 1. Task Filtering by User

Users see only tasks they're involved with:

- **Assigned Tasks**: Tasks where the user's linked owner is assigned
- **Mentioned Tasks**: Tasks where the user's linked owner name appears in description or next_step
- **Admin Override**: Admins see all tasks

**How it works:**
- Each user profile can be linked to an "owner" record
- When viewing the task list, the system filters based on task_owners assignments
- RLS (Row Level Security) policies enforce this at the database level

### 2. User-Owner Linking System

**Default Behavior:**
- New user accounts are NOT automatically linked to existing owner names
- Users must be explicitly linked by an admin

**Admin-Initiated Onboarding:**
1. Admin goes to Admin Panel → Users tab
2. Creates invite with email + pre-links to existing owner
3. User receives signup link
4. On first login, user automatically sees tasks assigned to that owner

**Manual Linking:**
- Admin can link/unlink users to owner names at any time
- Select owner from dropdown in Users tab

### 3. Admin Impersonation Feature

**Purpose:** Allows admins to see exactly what a user sees.

**How to use:**
1. Go to Admin Panel → Users tab
2. Find the user you want to impersonate
3. Click "👤 Login as" button
4. A new tab opens showing the app as that user sees it
5. Purple banner at top shows impersonation is active
6. Click "Exit Impersonation" to return to normal view

**Technical Details:**
- Creates a time-limited session (1 hour)
- Stored in `impersonation_sessions` table
- Uses token-based authentication
- All actions are logged in activity log

### 4. Distributed User Creation

**All users can:**
- Add new owners (project owners)
- Add new vendors
- Invite new users

**Admin Oversight:**
- Activity Log tab shows all created entities
- Who created each entry (audit trail)
- Admins can delete any owner/vendor/project
- Full audit history preserved

## Database Schema

### New Tables

#### `vendors`
- `id` - UUID primary key
- `name` - Unique vendor name
- `email`, `phone`, `company`, `notes` - Contact info
- `created_by` - User who created
- `created_at` - Timestamp

#### `activity_log`
- `id` - UUID primary key
- `action` - 'created', 'deleted', 'updated', 'invited', 'impersonated'
- `entity_type` - 'owner', 'vendor', 'user', 'project', 'task'
- `entity_id` - Reference to the entity
- `entity_name` - Display name for audit
- `created_by` - User who performed action
- `created_by_email` - Email (denormalized for audit preservation)
- `metadata` - JSONB for additional context
- `created_at` - Timestamp

#### `impersonation_sessions`
- `id` - UUID primary key
- `admin_id` - Admin user performing impersonation
- `target_user_id` - User being impersonated
- `token` - Unique session token
- `expires_at` - Session expiry (1 hour default)
- `created_at`, `ended_at` - Session timestamps

#### `pending_invites`
- `id` - UUID primary key
- `email` - Invited email address
- `invite_token` - Unique token for signup link
- `expires_at` - Invite expiry (7 days default)
- `invited_by` - User who sent invite
- `link_to_owner_id` - Optional owner to link on signup
- `role` - Role to assign ('user' or 'admin')
- `created_at`, `accepted_at` - Timestamps

### Schema Updates

#### `owners` table additions
- `created_by` - UUID reference to creator
- `created_by_email` - Email of creator

#### `profiles` table additions
- `invited_by` - UUID reference to inviting user

## API Endpoints

### `/api/admin/impersonate`
- `POST` - Start impersonation session
- `GET` - Check current impersonation status
- `DELETE` - End impersonation session

### `/api/admin/activity-log`
- `GET` - Fetch activity log (with optional type filter)
- `DELETE` - Delete an entity and log the deletion

### `/api/vendors`
- `GET` - List all vendors
- `POST` - Create vendor (any authenticated user)
- `PUT` - Update vendor (admin only)
- `DELETE` - Delete vendor (admin only)

### `/api/owners`
- `GET` - List all owners
- `POST` - Create owner (any authenticated user)

### `/api/users/invite`
- `POST` - Create user invite (any authenticated user)

## RLS Policies

### Tasks
- **Admins**: Full access to all tasks
- **Users**: Can only SELECT/UPDATE tasks where:
  - Their linked owner is in task_owners
  - OR their owner name appears in task description/next_step

### Owners, Vendors, Projects
- **All users**: Can SELECT
- **All users**: Can INSERT (distributed creation)
- **Admins only**: Can UPDATE/DELETE

### Activity Log
- **All users**: Can SELECT (transparency)
- **All users**: Can INSERT (via triggers/API)
- **Admins only**: Can DELETE

## Security Considerations

1. **Impersonation Audit Trail**: All impersonation sessions are logged
2. **Token Expiry**: Impersonation tokens expire after 1 hour
3. **RLS Enforcement**: Database-level security prevents unauthorized access
4. **Audit Preservation**: `created_by_email` is denormalized to preserve history even if user is deleted

## Usage Examples

### Inviting a User Linked to an Owner

```javascript
// From any authenticated user
const response = await fetch('/api/users/invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'newuser@example.com',
    linkToOwnerId: 'owner-uuid-here', // Optional
    role: 'user'
  })
});

const { signupUrl } = await response.json();
// Share signupUrl with the new user
```

### Adding an Owner

```javascript
// From any authenticated user
const response = await fetch('/api/owners', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Smith',
    email: 'john@example.com',
    phone: '555-1234',
    is_internal: true
  })
});
```

### Starting Impersonation (Admin Only)

```javascript
const response = await fetch('/api/admin/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetUserId: 'user-uuid-here'
  })
});

const { token, targetUser } = await response.json();
// Store token and open new tab
window.open(`/?impersonate=${token}`, '_blank');
```

## Testing Checklist

- [ ] User can only see tasks assigned to their linked owner
- [ ] Admin can see all tasks
- [ ] Any user can add new owners
- [ ] Any user can add new vendors
- [ ] Any user can invite new users
- [ ] Admin can link/unlink users to owners
- [ ] Admin can impersonate any user
- [ ] Impersonation shows correct user view
- [ ] Purple banner appears during impersonation
- [ ] Activity log shows all create/delete actions
- [ ] Activity log shows who performed each action
- [ ] Admin can delete entities from activity log
- [ ] Invite link works for new user signup
- [ ] Pre-linked owner is automatically assigned on signup
