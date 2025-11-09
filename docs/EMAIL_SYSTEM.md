# Email System Documentation

## Overview

The Success Family platform uses Resend API for sending transactional emails related to subscription and payment management. The email system covers both platform subscriptions (for creating communities) and community subscriptions (for joining communities).

## Email Templates

All email templates are defined in `src/lib/email.ts` using the `emailTemplates` object. Templates use a modern, responsive HTML design with consistent branding.

### Supabase Auth (Confirm Signup) Template

- Source file: `supabase/templates/confirm-signup.html`
- Deployment script: `pnpm update:supabase-email`
- Requires environment variables:
  - `SUPABASE_ACCESS_TOKEN` – personal access token with **Auth** scope
  - `SUPABASE_PROJECT_REF` – project reference visible in the Supabase dashboard URL

#### Updating the template

1. Make any required edits to `supabase/templates/confirm-signup.html`.
2. Run the deployment script:
   ```bash
   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... pnpm update:supabase-email
   ```
3. Confirm the new content appears in Supabase Dashboard → **Auth → Email Templates → Confirm signup**.

The script updates both the email subject (`Confirm your Success Family account`) and HTML body using the Supabase Management API. If the request fails, the script prints the API response body to help diagnose the issue.

### Template Categories

#### Platform Subscription Emails (Community Creation)
1. **platformSubscriptionRequest** - Sent when user submits payment to create a community
2. **platformPaymentVerified** - Sent when payment is verified and community becomes active
3. **platformPaymentRejected** - Sent when payment cannot be verified
4. **platformInvoiceGenerated** - Sent when new invoice is generated for recurring billing
5. **platformPaymentReminder** - Sent for payment reminders (7 days, 3 days, and on due date)

#### Community Subscription Emails (Joining Communities)
1. **communitySubscriptionRequest** - Sent to both user and community owner when subscription is requested
2. **communityPaymentVerified** - Sent to both parties when payment is verified
3. **communityPaymentRejected** - Sent to user when payment is rejected
4. **communityInvoiceGenerated** - Sent when new invoice is generated for recurring community subscription
5. **communityPaymentReminder** - Sent for payment reminders (7 days, 3 days, and on due date)

## Helper Functions

Email sending helper functions are located in `src/lib/subscription-emails.ts`. These functions handle:
- Fetching user details
- Sending appropriate email templates
- Error handling and logging

### Usage Example

```typescript
import { sendPlatformSubscriptionRequestEmail } from '@/lib/subscription-emails'

// Send email when user subscribes
await sendPlatformSubscriptionRequestEmail({
  userName: 'John Doe',
  userEmail: 'john@example.com',
  communityName: 'My Community',
  amount: 99.99,
  billingCycle: 'monthly'
})
```

## Integration Points

The email system needs to be integrated into the following flows:

### 1. Subscription Request (Both Platform and Community)
**Location:** `src/app/[slug]/community-view.tsx` (for community subscriptions) and similar for platform subscriptions

**Action:** Call the appropriate `send...RequestEmail` function after successful receipt upload

### 2. Payment Verification (Both Platform and Community)
**Location:** Admin payment verification actions

**Action:** Call `sendPlatformPaymentVerifiedEmail` or `sendCommunityPaymentVerifiedEmail` when status changes to 'verified'

### 3. Payment Rejection (Both Platform and Community)
**Location:** Admin payment rejection actions

**Action:** Call `sendPlatformPaymentRejectedEmail` or `sendCommunityPaymentRejectedEmail` when payment is rejected

### 4. Recurring Invoice Generation
**Location:** To be implemented - requires scheduled job or cron

**Action:** 
- Generate new pending payment receipts for active subscriptions
- Set `is_recurring = true` and `next_billing_date`
- Call appropriate invoice generation email

### 5. Payment Reminders
**Location:** To be implemented - requires scheduled job or cron

**Action:**
- Run daily to check `next_billing_date`
- Send reminders at 7 days, 3 days, and on due date
- Call appropriate reminder email functions

## Recurring Billing Flow

### Database Schema
New fields added to `payment_receipts` table:
- `invoice_number` - Auto-generated unique invoice ID (format: INV-YYYY-MM-######)
- `is_recurring` - Boolean flag indicating recurring subscription
- `next_billing_date` - Due date for the invoice

### Automatic Invoice Generation (To Be Implemented)

1. **Monthly Job** (e.g., using Vercel Cron, Supabase Edge Functions, or external service)
   - Query active subscriptions where `next_billing_date <= current_date`
   - For each subscription, create new `payment_receipts` record:
     - Copy community_id, user_id, plan_id, billing_cycle
     - Set `is_recurring = true`
     - Set `status = 'pending'`
     - Set `next_billing_date = current_date + billing_cycle_days`
     - Invoice number auto-generated via trigger
   - Send invoice email to user
   - Update subscription's `next_billing_date`

### Payment Reminder System (To Be Implemented)

1. **Daily Job**
   - Query pending receipts where `next_billing_date BETWEEN current_date + 7 AND current_date`
   - Calculate days until due
   - Send appropriate reminder email (7 days, 3 days, or due today)

## Environment Variables

Required environment variables (set in `.env.local`):
- `RESEND_API_KEY` - Your Resend API key
- `NEXT_PUBLIC_SITE_URL` - Base URL for email links (defaults to http://localhost:3000 in development)

## Future Enhancements

- SMS notifications for critical events
- Email preferences per user
- Notification center within the app
- Webhook support for payment status changes
- Template customization for community owners

## Notes

- All emails are sent asynchronously to prevent blocking the main flow
- Email failures are logged but don't fail the parent operation
- Consider rate limiting for production use
- Review Resend quota and pricing for high-volume scenarios

