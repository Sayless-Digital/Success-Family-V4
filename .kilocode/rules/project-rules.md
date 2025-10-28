---
alwaysApply: true
---
# Success Family Platform - Cursor Rules

## 🚨 MANDATORY PRE-ANALYSIS REQUIREMENTS

Before making ANY change, you MUST:

1. **Analyze the exact codebase architecture** by examining:
   - File structure in `src/` directory
   - Import patterns and dependencies
   - Existing component implementations
   - Configuration files (tailwind.config.ts, components.json, tsconfig.json)
   - Environment setup (src/lib/env.ts, .env structure)

2. **Trace all dependencies** for any component or function you're modifying:
   - Check `src/lib/` utilities and their usage patterns
   - Verify Supabase client configurations (src/lib/supabase.ts, src/lib/supabase-server.ts)
   - Examine existing TypeScript types in `src/types/`
   - Review proxy implementation in `src/proxy.ts` (Next.js 16 convention)

3. **Understand the specific implementation context**:
   - This is a Next.js 16 App Router project with Turbopack
   - Uses Tailwind CSS v4.1.16 with @tailwindcss/postcss plugin
   - Implements shadcn/ui components with class-variance-authority
   - Uses Supabase for database, auth, and storage
   - Includes Resend API for email functionality
   - Environment variables are validated through src/lib/env.ts

## 🎯 ARCHITECTURAL PATTERNS TO FOLLOW

### File Structure Conventions
```
src/
├── app/                    # Next.js App Router (pages, layouts, globals.css)
├── components/
│   └── ui/                # shadcn/ui components ONLY
├── lib/                   # Utility functions and configurations
│   ├── env.ts            # Environment validation (MANDATORY to use)
│   ├── supabase.ts       # Client-side Supabase
│   ├── supabase-server.ts # Server-side Supabase
│   ├── utils.ts          # cn() utility for class merging
│   └── email.ts          # Resend email functionality
├── types/                 # TypeScript definitions
└── proxy.ts               # Supabase auth proxy (Next.js 16)
```

### Component Development Rules

1. **ALWAYS use shadcn/ui components** from `src/components/ui/`
   - Import pattern: `import { Button } from "@/components/ui/button"`
   - Use existing variants and props, don't create custom ones
   - Extend with `className` prop using `cn()` utility

2. **ALWAYS use global styles** from `src/app/globals.css`
   - Use CSS custom properties: `hsl(var(--primary))`, `hsl(var(--background))`, etc.
   - **NEVER use hardcoded colors** (no `bg-blue-500`, `text-red-600`, etc.)
   - Use semantic color variables: `text-foreground`, `bg-background`, `text-muted-foreground`
   - **CRITICAL**: Due to Aurora background animations, purple/primary colors are NOT VISIBLE
   - **ALWAYS use white colors** for icons and backgrounds: `text-white/70`, `bg-white/10`, `border-white/20`
   - **NEVER use** `text-primary`, `bg-primary`, `border-primary`, or `from-primary/to-primary` gradients on UI elements
   - Use `bg-white/10` instead of `bg-primary/20` for subtle backgrounds
   - Use `text-white/70` or `text-white/80` for icons and text
   - Maintain dark/light mode compatibility with CSS variables

3. **NEVER use emojis in UI** - ALWAYS use Lucide React icons instead
   - Import from `lucide-react`: `import { Mail, CheckCircle2, ArrowRight } from "lucide-react"`
   - Use appropriate icons for visual indicators
   - Maintain consistent icon sizing (typically `h-4 w-4` or `h-5 w-5`)
   - **CRITICAL**: Icons MUST be white for visibility: `text-white/70` or `text-white/80`

4. **Color Visibility Requirements** (MANDATORY):
   - The app uses Aurora animated backgrounds with purple/blue tones
   - **Transparent primary colors are NOT visible** on Aurora backgrounds (e.g., `text-primary`, `bg-primary/20`, `border-primary/30`)
   - **Solid primary colors ARE visible** and can be used (e.g., `bg-primary`, `from-primary to-primary/70`)
   - **ALL icons**: Use `text-white/70` or `text-white/80` - NEVER `text-primary` or `text-primary/xx`
   - **Transparent backgrounds**: Use `bg-white/10` - NEVER `bg-primary/20`, `bg-primary/30`, etc.
   - **Transparent borders**: Use `border-white/20` - NEVER `border-primary/30`, `border-primary/20`, etc.
   - **Avatar fallbacks**: Can use solid primary gradient: `bg-gradient-to-br from-primary to-primary/70`
   - **Community logos**: Can use solid primary gradient: `bg-gradient-to-br from-primary to-primary/70`
   - Only use transparent primary colors for elements that won't be visible against Aurora

5. **ALWAYS use validated environment variables**:
   ```typescript
   import { env } from '@/lib/env'
   // Use env.NEXT_PUBLIC_SUPABASE_URL, not process.env directly
   ```

6. **ALWAYS use the cn() utility** for className merging:
   ```typescript
   import { cn } from '@/lib/utils'
   className={cn("base-classes", conditionalClasses, className)}
   ```

### Supabase Integration Patterns

1. **Client-side operations**: Use `src/lib/supabase.ts`
   ```typescript
   import { supabase } from '@/lib/supabase'
   ```

2. **Server-side operations**: Use `src/lib/supabase-server.ts`
   ```typescript
   import { createServerSupabaseClient } from '@/lib/supabase-server'
   const supabase = await createServerSupabaseClient()
   ```

3. **Type safety**: Use types from `src/types/index.ts`
   ```typescript
   import { User, Community, Post } from '@/types'
   ```

4. **Database Migrations**: ALWAYS run migrations immediately using Supabase MCP
   - First, get the correct project_id: `list_projects` tool
   - Then apply migration: `apply_migration` tool with project_id, name, and SQL query
   - Never assume migrations will be run manually - execute them immediately
   - Save migration SQL files in project root for documentation
   - Use descriptive migration names (e.g., "create_users_table_with_auth")

5. **SPA-like Navigation**: ALWAYS use Next.js Link for client-side navigation
   - Import Link from `next/link`: `import Link from "next/link"`
   - Use Link with Button asChild pattern: `<Button asChild><Link href="/path">Text</Link></Button>`
   - Link works in both Server Components (default) and Client Components
   - Prefer Server Components when possible - only use `"use client"` for interactivity
   - Client Components needed when using: useState, useEffect, useRouter, custom hooks
   - Server Components preferred for: data fetching, SEO, initial load performance
   - Never use `<a href>` - always use `<Link href>` for internal navigation

### Styling and UI Rules

1. **Tailwind CSS v4 patterns**:
   - **ALWAYS use CSS custom properties** from `globals.css` for colors
   - Available colors: `--primary`, `--secondary`, `--accent`, `--muted`, `--destructive`, `--foreground`, `--background`, `--border`, `--ring`
   - Use semantic utilities: `bg-primary`, `text-foreground`, `border-border`, etc.
   - Use opacity modifiers for transparency: `bg-primary/10`, `border-primary/20`
   - Use `@layer base` for global styles
   - Maintain responsive design patterns with mobile-first approach

2. **shadcn/ui component patterns**:
   - Use `class-variance-authority` for variant management
   - Implement proper TypeScript interfaces
   - Use `React.forwardRef` for ref forwarding
   - Export both component and variants
   - Extend with `className` prop for customization

3. **Design consistency**:
   - Keep designs clean and minimal
   - Use Lucide React icons - NEVER emojis
   - Maintain consistent spacing (p-4, p-6, gap-2, gap-4, space-y-2, space-y-4)
   - Use established border radius values (`rounded-md`, `rounded-lg`)
   - Follow the design system's typography scale
   - Ensure dark/light mode compatibility
   - **ALWAYS verify icon and text visibility** against Aurora backgrounds
   - Use white-based colors for all decorative elements (avatars, badges, icons, cards)

4. **Global style integration**:
   - Always import `src/app/globals.css` in layout
   - Use established CSS custom properties
   - Maintain consistency with existing design system
   - Never override theme colors with hardcoded values

## 🔍 MANDATORY ANALYSIS CHECKLIST

Before implementing any change, verify:

- [ ] **File structure**: Does this follow the established `src/` organization?
- [ ] **Import patterns**: Are imports using the correct `@/` alias?
- [ ] **Component usage**: Am I using existing shadcn/ui components?
- [ ] **Styling approach**: Am I using global styles and CSS custom properties?
- [ ] **Environment variables**: Am I using `env` from `src/lib/env.ts`?
- [ ] **Type safety**: Am I using types from `src/types/`?
- [ ] **Supabase integration**: Am I using the correct client (client vs server)?
- [ ] **Utility functions**: Am I using `cn()` for className merging?
- [ ] **Navigation**: Am I using `<Link href>` instead of `<a href>` for internal links?
- [ ] **Color visibility**: Are my icons and backgrounds white-based for Aurora visibility?
- [ ] **Primary colors**: Am I avoiding `text-primary`, `bg-primary/xx`, and primary gradients on UI elements?

## 🚫 FORBIDDEN PATTERNS

1. **NEVER** use `process.env` directly - always use `env` from `src/lib/env.ts`
2. **NEVER** create custom UI components when shadcn/ui equivalents exist
3. **NEVER** use hardcoded colors - always use CSS custom properties (e.g., NO `bg-blue-500`, YES `bg-primary`)
   - **EXCEPTION**: Never use transparent primary colors (`text-primary`, `bg-primary/xx`, `border-primary/xx`) for UI elements due to Aurora visibility issues
   - **SOLID primary colors ARE OK**: `bg-primary`, `from-primary to-primary/70` for logos, avatar fallbacks
   - **ALWAYS use white for transparent**: `bg-white/10`, `border-white/20`, `text-white/70` for icons and subtle backgrounds
4. **NEVER** use emojis in UI - always use Lucide React icons
5. **NEVER** bypass the established file structure
6. **NEVER** create duplicate utility functions
7. **NEVER** use different Supabase client patterns than established ones
8. **NEVER** hardcode theme values that should use CSS variables
9. **NEVER** use `<a href>` for internal navigation - always use `<Link href>` from next/link

## 📋 IMPLEMENTATION WORKFLOW

1. **Analyze existing code** in the target area
2. **Check for existing patterns** in similar components
3. **Verify dependencies** and import requirements
4. **Use established utilities** (cn, env, supabase clients)
5. **Follow naming conventions** from existing code
6. **Run database migrations immediately** if schema changes are needed (use Supabase MCP)
7. **Test with existing build system** (pnpm dev, pnpm build)
8. **Maintain type safety** throughout

## 🎨 DESIGN SYSTEM REQUIREMENTS

- **Colors**: Use CSS custom properties from `globals.css`
- **Typography**: Use Inter font from `layout.tsx`
- **Spacing**: Follow Tailwind spacing scale
- **Components**: Use shadcn/ui variants and patterns
- **Responsive**: Mobile-first approach with Tailwind breakpoints
- **Accessibility**: Maintain ARIA patterns from shadcn/ui

## 🔧 DEVELOPMENT COMMANDS

- `pnpm dev` - Development with Turbopack
- `pnpm build` - Production build
- `pnpm lint` - ESLint checking
- `pnpm start` - Production server

## 📚 CRITICAL DOCUMENTATION

- **Setup**: See `SETUP.md` for environment configuration
- **Architecture**: See `README.md` for project overview
- **Components**: See `components.json` for shadcn/ui config
- **Styling**: See `tailwind.config.ts` for theme configuration

## 🎨 CURRENT IMPLEMENTATION DETAILS

### Page Structure & Components
- **Homepage**: Fast Aurora animation (speed=1.5), hero-style landing page with CTAs
- **All Other Pages**: Slow Aurora animation (speed=0.3) for subtle background movement
- **Communities List**: Public page showing all active communities with search functionality
- **Community Details**: Public-facing with owner-only sections for subscription/billing info
- **Profile Page**: Public profile at `/profile/[username]` showing user stats and info (no role badge for regular users)
- **Account Page**: User profile editing with password change, profile picture upload, username availability checking
- **Members Page**: Community-specific members listing at `/[slug]/members` with search
- **Sidebar Navigation**: Context-aware - shows different items for admin, community, and base navigation
- **Header**: Communities dropdown with user's communities, visible on all screen sizes

### Navigation Patterns
- **Sidebar**: Context-aware navigation (base, community, admin)
- **Community Context**: Only shows in sidebar when on community route (`/[slug]/*`)
- **Members Link**: Added to community navigation, routes to `/[slug]/members`
- **Mobile Overlay**: Blur-only backdrop when sidebar is open on mobile

### Styling Conventions
- **Page Headers**: Use `PageHeader` component for consistent sizing (`text-2xl sm:text-3xl md:text-4xl`)
- **Avatar Borders**: Use `border-4 border-white/20` for profile pictures
- **White Colors**: All icons use `text-white/70` or `text-white/80` for visibility
- **Backgrounds**: Use `bg-white/10` for subtle backgrounds instead of primary colors
- **Cards**: No borders (`border-0`) for cleaner look

### Username Navigation
- **Usernames only**: Only `@username` text is clickable/linkable, not full names
- **Profile Links**: All usernames link to `/profile/[username]`
- **Hover Effects**: Usernames highlight with white on hover

---

**REMEMBER**: This codebase has specific architectural decisions and patterns. Always analyze the existing implementation before making changes. Do not assume standard patterns - verify the actual implementation in this specific project.
