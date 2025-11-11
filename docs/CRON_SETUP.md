# Vercel Cron Setup for Recurring Billing

## Overview

The project uses Vercel Cron Jobs to handle recurring billing and payment reminders. This is simpler and more maintainable than using Supabase's pg_cron extension.

## Cron Jobs

### 1. Generate Invoices
**Endpoint:** `/api/cron/generate-invoices`
**Schedule:** Every day at 6:00 AM UTC
**Purpose:** Generate new invoices for active subscriptions whose billing date has arrived

**What it does:**
- Queries active subscriptions where `next_billing_date <= today`
- Creates new pending payment receipts with `is_recurring = true`
- Auto-generates invoice numbers via database trigger
- Sends invoice emails to users
- Updates `next_billing_date` for the next billing cycle

### 2. Payment Reminders
**Endpoint:** `/api/cron/payment-reminders`
**Schedule:** Every day at 9:00 AM UTC
**Purpose:** Send email reminders for upcoming payments

**What it does:**
- Queries pending payments due within 7 days
- Sends reminders on specific days: 7 days before, 3 days before, and on due date
- Sends appropriate email for platform or community subscriptions

## Setup Instructions

### 1. Add Environment Variable
Add this to your `.env.local` and Vercel environment variables:

```bash
CRON_SECRET=your-random-secret-key-here
```

Generate a secure random string for this value.

### 2. Deploy to Vercel
The `vercel.json` file is already configured with the cron schedules. Once deployed, Vercel will automatically set up the cron jobs.

### 3. Manual Testing

Test the endpoints locally using curl:

```bash
# Test invoice generation
curl -X GET http://localhost:3000/api/cron/generate-invoices \
  -H "Authorization: Bearer your-cron-secret"

# Test payment reminders
curl -X GET http://localhost:3000/api/cron/payment-reminders \
  -H "Authorization: Bearer your-cron-secret"
```

### 4. Viewing Cron Logs

In Vercel dashboard:
1. Go to your project
2. Navigate to **Deployments**
3. Click on a deployment
4. View **Functions** tab to see cron execution logs

## Customizing Schedules

Edit `vercel.json` to change the cron schedules:

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-invoices",
      "schedule": "0 8 * * *"  // 8 AM instead of 6 AM
    },
    {
      "path": "/api/cron/payment-reminders",
      "schedule": "0 10 * * *"  // 10 AM instead of 9 AM
    }
  ]
}
```

Common cron schedule formats:
- `0 6 * * *` - Every day at 6:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Every Monday at midnight
- `*/30 * * * *` - Every 30 minutes

## Troubleshooting

### Cron jobs not running
1. Check that `vercel.json` is deployed
2. Verify `CRON_SECRET` is set in Vercel environment variables
3. Check deployment logs for errors

### Emails not sending
1. Verify `INBOUND_API_KEY` is set correctly
2. Check Inbound dashboard for email delivery status
3. Review cron job logs for errors

### Too many/few reminders
- Adjust the reminder days array in `/api/cron/payment-reminders/route.ts`
- Currently sends at 7, 3, and 0 days

## Alternative: Supabase pg_cron

If you prefer to use Supabase's pg_cron extension instead:
1. Enable the extension: `CREATE EXTENSION IF NOT EXISTS pg_cron;`
2. Create PostgreSQL functions for invoice generation
3. Use `pg_net` to call HTTP endpoints for sending emails
4. This is more complex but keeps everything in the database

Vercel Cron is recommended for better maintainability and easier debugging.

