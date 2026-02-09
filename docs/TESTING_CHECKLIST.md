# G3-Tornado User Management - Testing Checklist

## Prerequisites
1. Run the migration: `supabase/migrations/004_user_management_system.sql` on your Supabase project
2. Deploy to Vercel (automatic on push to main)

## Test Cases

### Task Filtering by User
- [ ] Create a regular user (non-admin)
- [ ] Link user to an owner via Admin Panel
- [ ] Log in as that user
- [ ] Verify user only sees tasks assigned to their linked owner
- [ ] Verify user sees tasks mentioning their owner name in description
- [ ] Log in as admin
- [ ] Verify admin sees ALL tasks

### User-Owner Linking
- [ ] Go to Admin Panel → Users tab
- [ ] Select an owner from the "Linked Owner" dropdown for a user
- [ ] Verify the link persists after page refresh
- [ ] Change link to different owner
- [ ] Remove link (select "Not linked")
- [ ] Verify changes are reflected immediately

### Admin Impersonation
- [ ] Go to Admin Panel → Users tab
- [ ] Click "👤 Login as" button for a user
- [ ] Verify new tab opens
- [ ] Verify purple banner appears at top
- [ ] Verify task list shows only that user's tasks
- [ ] Click "Exit Impersonation" button
- [ ] Verify banner disappears
- [ ] Check Activity Log for impersonation entry

### Distributed User Creation
#### Owners
- [ ] As regular user, click "+ Add Owner" (or find add owner UI)
- [ ] Add a new owner with name, email, phone
- [ ] Verify owner appears in list
- [ ] Check Activity Log - should show who created it

#### Vendors
- [ ] Go to Admin Panel → Vendors tab
- [ ] Click "+ Add Vendor"
- [ ] Add vendor with name, company, email, phone
- [ ] Verify vendor appears in list
- [ ] Check Activity Log - should show who created it

#### User Invites
- [ ] Go to Admin Panel → Users tab
- [ ] Click "+ Invite User"
- [ ] Enter email and optionally select owner to link
- [ ] Click "Create Invite"
- [ ] Verify invite URL is generated
- [ ] Check Activity Log for invite entry

### Activity Log
- [ ] Go to Admin Panel → Activity Log tab
- [ ] Verify all recent actions are logged
- [ ] Verify "Created By" column shows correct user
- [ ] Verify timestamps are correct
- [ ] Click "Delete" on an owner entry
- [ ] Verify owner is deleted
- [ ] Verify deletion is logged in activity log

### Admin Panel UI
- [ ] Verify all tabs render correctly (Users, Projects, Owners, Vendors, Activity Log)
- [ ] Verify tab counts are accurate
- [ ] Verify dark mode works on all tabs
- [ ] Test on mobile viewport

### Edge Cases
- [ ] Try to access /admin as non-admin user → should redirect
- [ ] Try impersonation API directly as non-admin → should fail
- [ ] Create owner with duplicate name → should show error
- [ ] Invite already-existing user → should show error

## Database Verification
Run these queries in Supabase SQL Editor:

```sql
-- Check new tables exist
SELECT * FROM vendors LIMIT 5;
SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10;
SELECT * FROM impersonation_sessions ORDER BY created_at DESC LIMIT 5;
SELECT * FROM pending_invites LIMIT 5;

-- Check columns added to existing tables
SELECT id, name, created_by, created_by_email FROM owners LIMIT 5;

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('tasks', 'vendors', 'activity_log', 'impersonation_sessions');
```

## Notes
- Impersonation sessions expire after 1 hour
- User invites expire after 7 days
- Activity log preserves `created_by_email` even if user is deleted
- All delete actions are logged before execution
