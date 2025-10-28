# Database Migrations

This directory contains all SQL migration files for the Success Family platform database.

## Migration Order

Migrations should be applied in the following order:

1. **supabase-migration.sql** - Initial setup (users table, auth triggers)
2. **add_user_roles_migration.sql** - Adds role field to users
3. **community_system_migration.sql** - Core community and payment tables
4. **remove_max_tree_migration.sql** - Removes max_tree limit
5. **add_plan_tags_ordering_migration.sql** - Plan tags and ordering
6. **create_subscriptions_table_migration.sql** - Subscriptions table refactor
7. **fix_community_members_rls_recursion.sql** - Fixes RLS recursion issue
8. **add_community_id_to_bank_accounts.sql** - Adds community_id to bank_accounts for community-specific payment accounts
9. **add_community_pricing_fields.sql** - Adds pricing fields to communities for community owners to charge users
10. **allow_users_to_join_communities.sql** - Allows users to add themselves as members to communities

## Applying Migrations

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of the migration file
4. Paste and run in the SQL editor

### Using Supabase MCP

Migrations are typically applied through the Supabase MCP tool during development.

## Documentation

For detailed information about each migration, see [docs/MIGRATIONS.md](../../docs/MIGRATIONS.md)

