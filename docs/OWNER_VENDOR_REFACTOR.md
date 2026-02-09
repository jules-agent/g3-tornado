# Owner/Vendor System Refactor

**Date:** February 9, 2026  
**Migration:** `005_owner_vendor_refactor.sql`

## Overview

This refactor consolidates the separate `vendors` table into the `owners` table, adding employee/vendor classification flags to provide more flexible management of internal employees and external vendors.

## Changes Summary

### Database Changes

**New columns added to `owners` table:**
- `is_up_employee` (BOOLEAN, default false) - Unplugged Performance employee
- `is_bp_employee` (BOOLEAN, default false) - Bulletproof employee
- `is_upfit_employee` (BOOLEAN, default false) - UP.FIT employee
- `is_third_party_vendor` (BOOLEAN, default false) - External vendor

**Removed:**
- `is_internal` column (replaced by explicit flags)
- `vendors` table (data migrated to owners)

**Constraints:**
- If `is_third_party_vendor = true`, all employee flags must be `false` (mutually exclusive)
- Enforced via database trigger `check_owner_flags()`

### API Changes

**Updated:**
- `POST /api/admin/owners` - Accepts new classification flags
- `PUT /api/admin/owners` - Updates classification flags
- `DELETE /api/admin/owners` - Logs classification in activity

**Removed:**
- `GET/POST/PUT/DELETE /api/vendors` - No longer needed

### UI Changes

**Admin Panel - Owners Tab:**

1. **New form fields:**
   - Checkboxes for employee companies (UP, BP, UP.FIT)
   - Checkbox for 3rd Party Vendor
   - Mutual exclusivity validation in UI

2. **Visual badges in owner list:**
   - `UP` (blue) - Unplugged Performance employee
   - `BP` (green) - Bulletproof employee
   - `UF` (purple) - UP.FIT employee
   - `Vendor` (orange) - Third party vendor

3. **Contact indicators:**
   - 📧 icon when email is present
   - 📞 icon when phone is present

**Removed:**
- Vendors tab completely removed from admin panel

## Migration Details

### Existing Data Handling

1. **Vendors → Owners:**
   - All vendors are migrated to owners with `is_third_party_vendor = true`
   - Migration skips if owner with same name already exists
   - Activity log entry created for each migration

2. **is_internal conversion:**
   - `is_internal = false` → `is_third_party_vendor = true`
   - `is_internal = true` → no flags set (admin can classify later)

3. **Activity log updates:**
   - Existing vendor-related logs get metadata note about deprecation
   - Migration creates logs with action `migrated_from_vendor`

## Usage Examples

### Creating an Employee

```json
POST /api/admin/owners
{
  "name": "John Doe",
  "email": "john@unpluggedperformance.com",
  "phone": "555-1234",
  "is_up_employee": true,
  "is_bp_employee": true,
  "is_upfit_employee": false,
  "is_third_party_vendor": false
}
```

### Creating a Vendor

```json
POST /api/admin/owners
{
  "name": "ACME Corp",
  "email": "contact@acme.com",
  "phone": "555-9999",
  "is_up_employee": false,
  "is_bp_employee": false,
  "is_upfit_employee": false,
  "is_third_party_vendor": true
}
```

## Future Enhancements

1. **Task filtering by company:** Filter gate assignments to show only UP employees, etc.
2. **Communication rules:** Different notification behavior for employees vs vendors
3. **Reporting:** Separate metrics for internal vs external work

## Rollback Procedure

If rollback is needed:

1. Re-create vendors table
2. Copy owners with `is_third_party_vendor = true` back to vendors
3. Restore `is_internal` column
4. Revert UI and API changes

**Note:** This is a one-way migration by design. The vendor table was redundant and caused confusion. Going forward, all personnel are managed in the owners table with appropriate flags.

## File Changes

```
Modified:
- supabase/migrations/005_owner_vendor_refactor.sql (NEW)
- src/app/api/admin/owners/route.ts
- src/app/api/admin/activity-log/route.ts
- src/app/(protected)/admin/page.tsx
- src/components/admin/AdminTabs.tsx

Deleted:
- src/app/api/vendors/route.ts
```
