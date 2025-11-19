# Authentication Setup Guide

This guide will help you complete the setup of the dialog-based authentication system for the Success Family platform.

## ✅ What Has Been Implemented

1. **Dialog Components**: Added `dialog`, `input`, `label`, and `tabs` from shadcn/ui
2. **TypeScript Types**: Updated `User` interface with new fields (username, first_name, last_name, profile_picture, bio, socials)
3. **Database Schema**: Created SQL migration for users table with triggers
4. **Auth Utilities**: Created sign-in, sign-up, and sign-out functions
5. **AuthDialog Component**: Single dialog with tabs for Sign In and Sign Up
6. **Auth Provider**: Context provider for auth state management
7. **Global Header Integration**: Updated header to show auth dialogs and user state

## 🗄️ Database Setup

### Step 1: Run the SQL Migration

You need to execute the SQL migration in your Supabase project. You have two options:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/supabase-migration.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute the migration

#### Option B: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

### What the Migration Does

The migration creates:

1. **`users` table** with the following fields:
   - `id` (UUID, references auth.users)
   - `email` (TEXT, unique)
   - `username` (TEXT, unique, auto-generated)
   - `first_name` (TEXT)
   - `last_name` (TEXT)
   - `profile_picture` (TEXT, optional)
   - `bio` (TEXT, optional)
   - `socials` (JSONB, optional)
   - `created_at` and `updated_at` (timestamps)

2. **Row Level Security (RLS) Policies**:
   - Public profiles are viewable by everyone
   - Users can insert their own profile
   - Users can update their own profile

3. **Automatic Username Generation**:
   - Function `generate_username()` creates usernames from first + last name
   - Handles duplicates by appending numbers (e.g., johndoe, johndoe1, johndoe2)

4. **Trigger Functions**:
   - `handle_new_user()` - Automatically creates user profile when someone signs up
   - `handle_updated_at()` - Updates the `updated_at` timestamp on changes

## 🧪 Testing the Authentication Flow

### 1. Start the Development Server

The server is already running on http://localhost:3001

### 2. Test Sign Up

1. Click the **"Sign Up"** button in the header
2. The AuthDialog opens with the **Sign Up** tab active
3. Fill in:
   - First Name: e.g., "John"
   - Last Name: e.g., "Doe"
   - Email: e.g., "john@example.com"
   - Password: (minimum 6 characters)
4. Click **"Sign Up"**
5. Check your email for the confirmation link (Supabase sends verification emails)
6. After confirmation, the user profile is automatically created with:
   - Username: `johndoe` (auto-generated from name)
   - All provided information stored

### 3. Test Sign In

1. Click the **"Sign In"** button in the header
2. The AuthDialog opens with the **Sign In** tab active
3. Enter your email and password
4. Click **"Sign In"**
5. Upon success:
   - Dialog closes
   - Header shows your username
   - Sign Out button appears

### 4. Test Tab Switching

1. Open the dialog with "Sign In" button - verify it opens on Sign In tab
2. Click "Sign Up" tab - verify it switches
3. Close and open with "Sign Up" button - verify it opens on Sign Up tab
4. Click "Sign In" tab - verify it switches

### 5. Test Sign Out

1. When signed in, click the **Sign Out** button
2. Verify you're signed out
3. Sign In/Sign Up buttons reappear

## 📁 File Structure

```
src/
├── components/
│   ├── auth-dialog.tsx          # Main auth dialog with tabs
│   ├── auth-provider.tsx        # Auth context provider
│   └── layout/
│       └── global-header.tsx    # Updated with auth integration
├── lib/
│   ├── auth.ts                  # Auth utility functions
│   ├── supabase.ts             # Client-side Supabase client
│   └── supabase-server.ts      # Server-side Supabase client
└── types/
    └── index.ts                # Updated User type definitions

supabase/
└── migrations/
    └── supabase-migration.sql  # Database schema and triggers
```

## 🎨 Features

### Dialog-Based Authentication
- ✅ Single dialog with tabs (no separate pages)
- ✅ Opens on correct tab based on button clicked
- ✅ Smooth transitions between tabs
- ✅ Form validation and error handling
- ✅ Loading states during authentication

### User Profile Management
- ✅ Automatic username generation from first + last name
- ✅ Duplicate username handling with numeric suffixes
- ✅ Profile picture support (field ready)
- ✅ Bio support (field ready)
- ✅ Social media links support (JSONB field ready)

### State Management
- ✅ React Context for auth state
- ✅ Automatic session persistence
- ✅ Auth state change listeners
- ✅ User profile fetching and caching

### UI/UX
- ✅ Responsive design (desktop and mobile)
- ✅ Loading indicators
- ✅ Error messages
- ✅ Success messages
- ✅ Disabled states during processing
- ✅ Shows username in header when signed in

## 🔧 Environment Variables

Make sure your `.env` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Google One Tap Requirements

1. Create (or reuse) a **Web application** OAuth client inside Google Cloud Console → APIs & Services → Credentials.
2. Add both your production domain (e.g. `https://successfamily.online`) and local HTTPS dev domain (`https://localhost:3000`) to **Authorized JavaScript origins**.
3. Add `https://successfamily.online/auth/callback` and `https://localhost:3000/auth/callback` to **Authorized redirect URIs**.
4. Copy the generated Client ID into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
5. The new One Tap prompt will automatically appear whenever a logged-out visitor already has an active Google session. If they select an account, we exchange the One Tap credential with Supabase via `signInWithIdToken`, so no extra backend work is required.

> The One Tap widget only renders on secure origins (HTTPS or `localhost`). Use `pnpm dev` (HTTPS) in development to test it.

## 🚀 Next Steps (Future Enhancements)

After basic auth is working, you can add:

1. **Profile Page**: Create a page to edit profile, add bio, upload profile picture
2. **Social Links Management**: Add UI to manage social media links
3. **Password Reset**: Add "Forgot Password" functionality
4. **Email Verification UI**: Better handling of email verification flow
5. **Profile Pictures**: Integrate Supabase Storage for profile picture uploads
6. **Username Uniqueness Check**: Real-time validation during sign-up

## 📝 Notes

- The username is automatically generated from first + last name (e.g., "John Doe" → "johndoe")
- Usernames are unique - duplicates get numbers appended (johndoe1, johndoe2, etc.)
- Email confirmation is required by default in Supabase
- All auth operations use the validated environment variables from `src/lib/env.ts`
- The auth provider automatically handles session persistence and refresh

## 🐛 Troubleshooting

### Issue: Dialog doesn't open
- Check browser console for errors
- Verify all shadcn/ui components are properly installed
- Check that AuthProvider is wrapping the app in layout.tsx

### Issue: Sign up/Sign in fails
- Verify environment variables are set correctly
- Check Supabase project settings
- Look for CORS issues in browser console
- Verify SQL migration ran successfully

### Issue: User profile not created
- Check that the trigger `on_auth_user_created` exists in Supabase
- Verify the trigger function `handle_new_user()` is working
- Check Supabase logs for errors
- Ensure RLS policies are set up correctly

### Issue: Username generation fails
- Verify `generate_username()` function exists
- Check if first_name and last_name are being passed correctly
- Look in Supabase logs for function execution errors

## ✅ Verification Checklist

- [ ] SQL migration executed successfully in Supabase
- [ ] Environment variables are set and validated
- [ ] Can open Sign In dialog by clicking "Sign In"
- [ ] Can open Sign Up dialog by clicking "Sign Up"
- [ ] Dialog opens on correct tab based on button clicked
- [ ] Can switch between tabs within the dialog
- [ ] Can sign up with first name, last name, email, password
- [ ] Receive email confirmation link
- [ ] User profile is created in users table with auto-generated username
- [ ] Can sign in with email and password
- [ ] Username displays in header when signed in
- [ ] Can sign out successfully
- [ ] Auth state persists across page refreshes

---

**Status**: Ready for testing! Run the SQL migration and start testing the auth flow.