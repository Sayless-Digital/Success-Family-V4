# Sidebar Navigation Architecture

This document describes the context-aware sidebar navigation system in the Success Family platform.

## Overview

The sidebar navigation adapts based on the current context to show relevant navigation options. This follows the same pattern as the admin panel for consistency.

## Navigation Contexts

### 1. Base Navigation (Default)
**Shown on:** Homepage, /communities, /create-community, /settings, and other non-context pages

**Items:**
- Home
- Communities
- Settings

### 2. Community Context Navigation
**Shown on:** Any community page (dynamic route `/[slug]`)

**Items:**
- **Back to Communities** - Returns to communities list
- **Community Home** - Main community page (`/[slug]`)
- **Messages** - Community messages (`/[slug]/messages`)
- **Events** - Community events (`/[slug]/events`)
- **Analytics** - Community analytics (`/[slug]/analytics`)
- **Community Settings** - Community settings (`/[slug]/settings`)

**Detection Logic:**
- Checks if pathname doesn't match known non-community routes
- Extracts community slug from the first URL segment
- Only shows when on an actual community route

### 3. Admin Context Navigation
**Shown on:** Any route starting with `/admin`

**Items:**
- **Back to Site** - Returns to homepage
- Dashboard
- Bank Accounts
- Subscription Plans
- Manage Users
- Payments
- Roles & Permissions
- Database
- Reports
- Platform Settings

**Detection Logic:**
- Checks if user has `admin` role
- Checks if pathname starts with `/admin`
- Only shows when both conditions are true

## Implementation Details

### File Location
`src/components/layout/global-sidebar.tsx`

### Key Functions

#### Route Detection
```typescript
const isOnCommunityRoute = React.useMemo(() => {
  const nonCommunityRoutes = ['/', '/communities', '/create-community', '/settings', '/admin']
  return !nonCommunityRoutes.some(route => pathname === route || pathname.startsWith(route + '/')) && 
         !pathname.startsWith('/admin')
}, [pathname])
```

#### Community Slug Extraction
```typescript
const communitySlug = React.useMemo(() => {
  if (isOnCommunityRoute) {
    const segments = pathname.split('/').filter(Boolean)
    return segments[0] // The first segment is the community slug
  }
  return null
}, [pathname, isOnCommunityRoute])
```

#### Dynamic Link Building
```typescript
const href = item.isDynamic && communitySlug 
  ? `/${communitySlug}${item.href === '#' ? '' : '/' + item.href}`
  : item.href
```

### Navigation Item Structure

```typescript
interface NavigationItem {
  icon: IconComponent
  label: string
  href: string
  isDynamic?: boolean  // For community context links that need slug
}
```

## Design Principles

1. **Context Awareness**: Navigation adapts to the current page context
2. **Consistency**: Same pattern for admin, community, and base contexts
3. **Clear Hierarchy**: "Back" button shows how to exit current context
4. **Dynamic Routing**: Community links are dynamically built with the slug
5. **Non-intrusive**: Base navigation is minimal, context adds relevant items

## Adding New Navigation Contexts

To add a new context (e.g., user profile navigation):

1. Define navigation items array:
```typescript
const profileNavigationItems = [
  { icon: User, label: "My Profile", href: "/profile" },
  { icon: Settings, label: "Edit Profile", href: "/profile/edit" },
  // ...
]
```

2. Add detection logic:
```typescript
const isOnProfileRoute = pathname.startsWith('/profile')
```

3. Add conditional rendering in the JSX:
```typescript
{showAdminMenu ? (
  // Admin nav
) : showCommunityMenu ? (
  // Community nav
) : isOnProfileRoute ? (
  // Profile nav
) : (
  // Base nav
)}
```

## Testing

To test each context:

1. **Base Navigation**: Visit `/`, `/communities`, `/create-community`
2. **Community Context**: Visit any community page like `/tech-innovators`
3. **Admin Context**: Visit `/admin` (requires admin role)

## Related Files

- `src/components/layout/global-sidebar.tsx` - Main sidebar component
- `src/components/layout/global-layout.tsx` - Layout wrapper
- `src/components/layout/global-header.tsx` - Header component
- `src/components/layout/index.ts` - Layout exports

