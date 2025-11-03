# Voice Notes Setup

## Database Migration Required

The voice notes feature requires a database function to deduct points. You need to run the migration manually.

### Step 1: Run the Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20250103_add_voice_notes_support.sql`
4. Click **Run** to execute the migration

Or run via Supabase CLI:
```bash
supabase db push
```

### Step 2: Verify the Function

After running the migration, verify the function exists:
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'deduct_points_for_voice_notes';
```

You should see the function listed.

### Migration File Location

The migration file is located at:
`supabase/migrations/20250103_add_voice_notes_support.sql`

This creates:
- `deduct_points_for_voice_notes()` function
- Grants execute permission to authenticated users
- Handles wallet creation if needed
- Deducts points and creates transaction records


