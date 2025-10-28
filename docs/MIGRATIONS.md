# Database Migrations

This document lists all database migrations in the order they should be applied.

## Migration Files

### 1. Initial Setup
**File:** `supabase/migrations/supabase-migration.sql`
**Applied:** Initial project setup
**Description:** Creates the initial users table and basic auth setup.

### 2. User Roles
**File:** `supabase/migrations/add_user_roles_migration.sql`
**Status:** ✅ Applied
**Description:** Adds role field to users table (admin, community_owner, user).

### 3. Community System
**File:** `supabase/migrations/community_system_migration.sql`
**Status:** ✅ Applied
**Description:** Creates the core tables for the community and payment system:
- `bank_accounts` - Stores payment bank account details
- `subscription_plans` - Defines available subscription plans with pricing
- `communities` - Main community table with owner and plan references
- `community_members` - Tracks community membership (owner/member roles)
- `payment_receipts` - Stores payment submissions for verification
- Creates `payment-receipts` storage bucket
- Adds RLS policies for all tables
- Creates slug generation function
- Creates automatic owner assignment trigger

**Important:** The RLS policies have been updated to prevent infinite recursion (see migration #8 below)

### 4. Remove Max Tree Limit
**File:** `supabase/migrations/remove_max_tree_migration.sql`
**Status:** ✅ Applied
**Description:** Removes the `max_tree` field from `subscription_plans` table to allow unlimited community growth.

### 5. Plan Labels and Ordering
**File:** `supabase/migrations/add_plan_tags_ordering_migration.sql`
**Status:** ✅ Applied
**Description:** 
- Adds `tags` (text array) to subscription_plans for labels like "Popular", "Preferred"
- Adds `sort_order` (integer) for custom plan ordering in UI
- Updates existing plans with default sort order

### 6. Subscription Management Fields
**Status:** ✅ Applied via Supabase MCP
**Description:** Adds subscription management fields to communities table:
- `next_billing_date` - When next payment is due
- `subscription_status` - pending/active/cancelled/expired
- `cancelled_at` - Timestamp of cancellation
- `cancellation_reason` - User-provided reason for cancellation
- Creates indexes for subscription queries
- Migrates existing communities to appropriate status

### 7. Subscriptions Table (Refactor)
**File:** `supabase/migrations/create_subscriptions_table_migration.sql`
**Status:** ✅ Applied
**Description:** Major refactor to separate subscription tracking:
- Creates new `subscriptions` table for tracking billing periods
- Each subscription period gets its own record
- Links `payment_receipts` to specific subscriptions via `subscription_id`
- Migrates existing subscription data from communities to new table
- Links existing verified payments to their subscriptions
- Enables full subscription history tracking
- Supports clean cancellations and reactivations

### 8. Fix Community Members RLS Recursion
**File:** `supabase/migrations/fix_community_members_rls_recursion.sql`
**Status:** ✅ Applied
**Description:** Fixes infinite recursion error in community_members RLS policies:
- **Problem:** The "Community owners can manage members" policy was checking the `community_members` table to verify ownership, creating infinite recursion
- **Solution:** Changed policy to check the `communities` table's `owner_id` field instead
- **Changes:**
  - Drops old "Community owners can manage members" policy
  - Creates new policy checking `communities.owner_id = auth.uid()` for UPDATE/DELETE operations
  - Creates separate INSERT policy with same check
  - Adds "Users can view their own memberships" policy
  - Updates migration file for future reference

### 9. Add Community ID to Bank Accounts
**File:** `supabase/migrations/add_community_id_to_bank_accounts.sql`
**Status:** ✅ Applied
**Description:** Enables community-specific bank accounts for payment management:
- **Purpose:** Allows communities to have their own bank accounts in addition to platform-wide accounts
- **Changes:**
  - Adds `community_id` column (nullable) to `bank_accounts` table
  - Existing accounts remain platform-wide (community_id = NULL)
  - New RLS policies:
    - Anyone can view active bank accounts (with or without community_id)
    - Admins can manage all bank accounts (platform-wide and community-specific)
    - Community owners can manage their own community's bank accounts
  - Adds index on `community_id` for efficient lookups
- **Use Case:** Allows community owners to manage their own payment accounts in the community settings

### 10. Add Community Pricing Fields
**File:** `supabase/migrations/add_community_pricing_fields.sql`
**Status:** ✅ Applied
**Description:** Enables community owners to set pricing for users to access/post to their communities:
- **Purpose:** Allows communities to monetize by charging users for access
- **Changes:**
  - Adds `pricing_enabled` (boolean) to communities table
  - Adds `pricing_type` (free, one_time, recurring) with check constraint
  - Adds `one_time_price` for one-time payment option
  - Adds `monthly_price` and `annual_price` for recurring subscription options
  - Existing communities default to free pricing
  - Adds indexes for efficient pricing queries
- **Use Case:** Community owners can set up their own pricing in settings, similar to platform subscription plans

### 11. Allow Users to Join Communities
**File:** `supabase/migrations/allow_users_to_join_communities.sql`
**Status:** ✅ Applied
**Description:** Enables users to join communities themselves through the subscription flow:
- **Purpose:** Allows subscription/join functionality for users
- **Changes:**
  - Adds RLS policy "Users can join communities as members"
  - Users can INSERT into community_members when adding themselves
  - Users can only set their own user_id
  - Users can only set role as 'member' (not 'owner')
- **Use Case:** Users can subscribe to paid communities or join free communities

## Benefits of Current Schema

### Separate Subscriptions Table
- ✅ **Complete billing history** - Every subscription period is tracked
- ✅ **Clean cancellations** - Mark as cancelled without data loss
- ✅ **Renewal tracking** - Each payment creates new subscription record
- ✅ **Easy reporting** - Query subscription metrics efficiently
- ✅ **Payment linkage** - Each payment ties to specific billing period
- ✅ **Reactivation support** - Simple to restart after cancellation

### Payment Flow
1. User creates community → Community created with `is_active = false`, `subscription_status = 'pending'`
   - Subscription record created immediately with `status = 'pending'`
   - Payment receipt created and linked to pending subscription
2. Admin verifies payment → Updates subscription to `status = 'active'`, sets billing dates, activates community
3. User cancels → Subscription marked `cancelled`, `end_date` set to `next_billing_date`
4. Subscription expires → Can be handled with cron job or manual check
5. User reactivates → Submit new payment, creates new pending subscription, repeats flow

## Running Migrations

Migrations are applied through Supabase MCP tool integration. The migration files are provided for documentation and can be re-run if needed.

To apply a migration manually:
```sql
-- Copy the contents of the migration file and run in Supabase SQL Editor
```

## Schema Overview

```
users
  ├── role (admin, community_owner, user)
  └── Auth integration

bank_accounts
  ├── community_id → communities (nullable, for community-specific accounts)
  └── Payment account details

subscription_plans
  ├── monthly_price, annual_price
  ├── tags[] (labels)
  └── sort_order

communities
  ├── owner_id → users
  ├── plan_id → subscription_plans
  ├── billing_cycle
  ├── subscription_status (from community table, for quick access)
  └── is_active

subscriptions (NEW)
  ├── community_id → communities
  ├── plan_id → subscription_plans
  ├── billing_cycle
  ├── status (pending/active/cancelled/expired)
  ├── start_date, end_date, next_billing_date
  └── cancelled_at, cancellation_reason

community_members
  ├── community_id → communities
  ├── user_id → users
  └── role (owner/member)

payment_receipts
  ├── community_id → communities
  ├── subscription_id → subscriptions (NEW)
  ├── user_id → users
  ├── plan_id → subscription_plans
  ├── bank_account_id → bank_accounts
  ├── receipt_url (storage)
  ├── status (pending/verified/rejected)
  └── verified_by, verified_at, rejection_reason
```

## Important Notes

- All tables have Row Level Security (RLS) enabled
- Community owners automatically added to `community_members` via trigger
- Payment receipts stored in `payment-receipts` storage bucket
- Slugs auto-generated from community names
- Subscriptions created only when payments verified by admin
- Cancellations don't delete data, just mark end date