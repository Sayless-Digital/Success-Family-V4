# Stream Registration Toggle Instructions

This document explains how to toggle the registration requirement for joining live streams.

## Current Status: Registration ENABLED (Required)

Currently, **users must register (and pay) before joining live streams**. This ensures proper access control and payment processing.

---

## How to Re-enable Registration Requirement

To require users to register (and pay) before joining streams, follow these steps:

### Step 1: Update Stream Page Access Control

**File:** `src/app/[slug]/events/[eventId]/stream/page.tsx`

**Lines 67-71:** Uncomment the registration check

**Change from:**
```typescript
// TEMPORARILY DISABLED: Allow anyone to join live streams
// if (!isOwner && !isRegistered && event.status === 'scheduled') {
//   notFound() // Can't join if not registered and event isn't live yet
// }
```

**Change to:**
```typescript
if (!isOwner && !isRegistered && event.status === 'scheduled') {
  notFound() // Can't join if not registered and event isn't live yet
}
```

### Step 2: Update Join Button Visibility

**File:** `src/app/[slug]/events/events-view.tsx`

**Line 1009:** Add back the `isRegistered` condition

**Change from:**
```typescript
{!isOwner && event.status === 'live' && onJoinStream && (
  <Button
    size="sm"
    onClick={onJoinStream}
    className="bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
  >
    <Play className="h-4 w-4 mr-2" />
    Join Stream
  </Button>
)}
```

**Change to:**
```typescript
{!isOwner && event.status === 'live' && isRegistered && onJoinStream && (
  <Button
    size="sm"
    onClick={onJoinStream}
    className="bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
  >
    <Play className="h-4 w-4 mr-2" />
    Join Stream
  </Button>
)}
```

---

## Verification

After making these changes:

1. **Registered users:** Can see "Join Stream" button on live events
2. **Unregistered users:** Cannot see "Join Stream" button on live events
3. **Everyone:** Can see "Register" button on scheduled events
4. **Event owners:** Can always join their own streams

---

## Points Costs

When registration is enabled:

- **Creating an event:** Owner pays `streamStartCost` points upfront
- **Registering for event:** User pays `streamJoinCost` points upfront (transferred to owner)
- **Cancelling event:** Owner and all registered users receive full refunds
- **Cancelling registration:** User receives full refund

Default costs are configured in `platform_settings` table.

---

## Testing Checklist

- [ ] Unregistered user cannot see "Join Stream" button
- [ ] Unregistered user can see "Register" button with point cost
- [ ] After registration, user can see "Join Stream" button
- [ ] Event owner can always join their stream
- [ ] Registration costs points correctly
- [ ] Refunds work when cancelling

---

## Support

For issues or questions, refer to:
- `docs/README.md` - Main documentation
- `docs/MIGRATIONS.md` - Database schema
- `SETUP.md` - Environment setup