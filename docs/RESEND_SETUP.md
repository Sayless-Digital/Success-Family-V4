# Resend Email Setup Guide

This guide covers setting up Resend for both sending and receiving emails (optional) with the Success Family platform.

## Prerequisites

- Resend account ([sign up here](https://resend.com))
- Domain ownership and DNS access
- Production deployment URL

## Part 1: Sending Emails (Required)

### Step 1: Get Your API Key

1. Log in to [Resend Dashboard](https://resend.com/api-keys)
2. Click "Create API Key"
3. Give it a name (e.g., "Success Family Production")
4. Copy the API key

### Step 2: Configure Environment

Add to your `.env.local` or production environment:

```env
RESEND_API_KEY=re_your_api_key_here
```

### Step 3: Verify Domain (Production)

For production email sending:

1. Go to [Domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain: `successfamily.online`
4. Add the DNS records shown (SPF, DKIM, etc.)
5. Wait for verification (usually 24-48 hours)

**Note:** For testing/development, you can use Resend's sandbox domain without verification, but emails will only be sent to verified addresses.

## Part 2: Receiving Emails (Optional)

If you want users to have personalized email addresses (e.g., `john.doe@successfamily.online`), set up inbound email routing.

### Step 1: Configure Wildcard Domain Route

1. Go to [Inbound Emails](https://resend.com/inbound) in Resend Dashboard
2. Click on your verified domain
3. Click "Add Inbound Route"
4. Set up wildcard route:
   - **Match**: `*@successfamily.online` (matches ALL addresses)
   - **Forward to**: Your webhook URL (see Step 2)

### Step 2: Configure Webhook

Set your webhook endpoint URL:

```
https://yourdomain.com/api/emails/webhook
```

**Important:** 
- Must be HTTPS (not HTTP)
- Must be publicly accessible
- The platform's webhook endpoint is already set up at `/api/emails/webhook`

### Step 3: Subscribe to Events

Make sure the following event is enabled:
- ✅ `email.received` - Triggered when an email is received

### Step 4: Test Receiving

1. Send a test email to any address `@yourdomain.com`
2. Check your application logs to see if the webhook was received
3. Check the `user_email_messages` table to confirm storage

## How It Works

### Sending Emails

```typescript
import { sendEmail } from '@/lib/email'

await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Welcome to Success Family</p>',
  from: 'Success Family <hello@successfamily.online>'
})
```

All email templates in `src/lib/email.ts` work automatically.

### Receiving Emails

1. **User gets personalized email**: `john.doe@successfamily.online`
2. **Email is stored** in database (`user_emails` table)
3. **Someone sends email** to `john.doe@successfamily.online`
4. **Resend catches it** via wildcard route `*@successfamily.online`
5. **Webhook fires** with email data to your `/api/emails/webhook`
6. **Platform stores it** in `user_email_messages` table
7. **User sees it** in their inbox

## Webhook Payload Structure

When an email is received, Resend sends:

```json
{
  "type": "email.received",
  "created_at": "2024-01-01T00:00:00.000Z",
  "data": {
    "email_id": "abc123",
    "from": "sender@example.com",
    "to": ["john.doe@successfamily.online"],
    "subject": "Email subject",
    "html": "<p>Email HTML content</p>",
    "text": "Email text content"
  }
}
```

The webhook at `src/app/api/emails/webhook/route.ts` handles this automatically.

## Key Differences from Inbound

| Feature | Inbound (Old) | Resend (New) |
|---------|--------------|--------------|
| Email Address Creation | API call per address | Wildcard route (one-time setup) |
| Management | Managed in Inbound dashboard | Managed in your database only |
| Endpoint Updates | Required when URL changes | Not needed (set once) |
| Complexity | Higher | Lower |
| API Calls | Many | Few |

## Troubleshooting

### Emails Not Sending

1. Check `RESEND_API_KEY` is set correctly
2. Verify domain is verified in Resend dashboard (for production)
3. Check Resend dashboard logs for delivery status
4. Ensure "from" address uses your verified domain

### Emails Not Receiving

1. Verify wildcard inbound route is configured: `*@yourdomain.com`
2. Check webhook URL is correct and publicly accessible
3. Test webhook with Resend's webhook test feature
4. Check application logs for webhook errors
5. Verify DNS MX records are configured for inbound email

### Webhook Errors

Common issues:
- **401 Unauthorized**: Check if webhook signature verification is enabled
- **404 Not Found**: Verify webhook URL is correct
- **500 Server Error**: Check application logs for errors
- **Timeout**: Webhook processing takes too long (must respond within 30s)

## Rate Limits & Pricing

Resend Free Tier:
- **3,000 emails/month** for free
- Unlimited team members
- Full API access

After free tier:
- **Pay as you go**: $1 per 1,000 emails
- Volume discounts available

No limit on receiving emails via webhooks.

## Security Best Practices

1. **API Key Security**
   - Store API key in environment variables only
   - Never commit to version control
   - Rotate keys periodically

2. **Webhook Security** (Optional)
   - Verify webhook signatures from Resend
   - Use HTTPS only
   - Implement rate limiting on webhook endpoint

3. **Email Validation**
   - Validate sender addresses
   - Scan for spam/malicious content
   - Implement user-level filtering

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Webhook Documentation](https://resend.com/docs/dashboard/webhooks)
- [Inbound Email Guide](https://resend.com/docs/dashboard/receiving/introduction)

## Support

For issues specific to Resend:
- [Resend Support](https://resend.com/support)
- [Resend Discord](https://resend.com/discord)

For platform-specific issues:
- Check application logs
- Review `docs/EMAIL_SYSTEM.md`
- Contact development team