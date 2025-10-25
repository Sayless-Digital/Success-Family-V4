# 🚀 Quick Setup Guide

## 1. Set Up Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (usually takes 1-2 minutes)
3. Go to **Settings** → **API** in your Supabase dashboard
4. Copy your **Project URL** and **anon public** key

## 2. Configure Environment Variables

Your `.env` file has been created with placeholder values. Update it with your actual Supabase credentials:

```bash
# Edit the .env file
nano .env
```

Replace the placeholder values:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here

# Optional: For server-side operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. Start Development Server

```bash
pnpm dev
```

## 4. Verify Setup

- Open [http://localhost:3000](http://localhost:3000)
- You should see the Success Family Platform landing page
- No more environment variable errors!

## 🔧 Troubleshooting

### Environment Variable Error
If you see "Your project's URL and Key are required", make sure:
- Your `.env` file exists in the project root
- The values are not the placeholder text
- You've restarted the development server after updating `.env`

### Port Already in Use
If port 3000 is busy:
```bash
# Kill existing processes
pkill -f "next dev"
# Or use a different port
pnpm dev --port 3001
```

## 📚 Next Steps

1. Set up your Supabase database schema
2. Configure authentication
3. Start building your community features!

## 🆘 Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
