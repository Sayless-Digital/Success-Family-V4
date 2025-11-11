# Inbound Webhook Setup Guide

## Overview

The webhook endpoint for receiving emails from Inbound is located at:
```
https://yourdomain.com/api/emails/webhook
```

## Headers - Not Required

**You do NOT need to manually add headers in the Inbound dashboard.**

Inbound automatically sends the following headers with every webhook request:

- `content-type`: `application/json`
- `user-agent`: `InboundEmail-Webhook/1.0`
- `x-webhook-event`: `email.received`
- `x-endpoint-id`: The endpoint ID
- `x-webhook-timestamp`: Timestamp of the webhook
- `x-email-id`: The email ID
- `x-message-id`: The message ID

These headers are sent automatically - no configuration needed.

## Webhook Configuration in Inbound

### Basic Setup (No Headers Required)

1. **URL**: Set the webhook URL to:
   ```
   https://successfamily.online/api/emails/webhook
   ```

2. **Format**: Select `Inbound` format

3. **Headers**: Leave empty (no custom headers needed)

4. **Test**: Use the "Test Webhook" button to verify it works

### Optional: Security (Recommended for Production)

If you want to secure your webhook, you can optionally:

#### Option 1: Webhook Secret (Simplest)

1. Generate a random secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to your `.env` file:
   ```env
   INBOUND_WEBHOOK_SECRET=your-generated-secret-here
   ```

3. In Inbound dashboard, add a custom header:
   - Header name: `X-Inbound-Secret`
   - Header value: `your-generated-secret-here`

4. Uncomment the webhook secret verification in `src/app/api/emails/webhook/route.ts`

#### Option 2: Verification Token (More Secure)

1. In Inbound dashboard, configure a verification token in your endpoint settings
2. Use the `verifyWebhook` function from `@inboundemail/sdk` to verify requests

## Testing the Webhook

### 1. Test Locally (Development)

```bash
# Test the GET endpoint (should return JSON)
curl https://localhost:3000/api/emails/webhook

# Test with a sample payload
curl -X POST https://localhost:3000/api/emails/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "email.received",
    "email": {
      "id": "test-123",
      "recipient": "test@successfamily.online",
      "subject": "Test Email",
      "from": {
        "addresses": [{"address": "sender@example.com", "name": "Sender"}]
      },
      "to": {
        "addresses": [{"address": "test@successfamily.online", "name": null}]
      },
      "cleanedContent": {
        "html": "<p>Test</p>",
        "text": "Test"
      }
    }
  }'
```

### 2. Test in Production

Use the "Test Webhook" button in the Inbound dashboard. It should return a 200 status with:
```json
{
  "success": true,
  "message": "Email received and stored"
}
```

## Troubleshooting

### 404 Error

If you get a 404 error:
1. Make sure the route is deployed to production
2. Rebuild the application: `pnpm build`
3. Verify the URL is correct: `https://successfamily.online/api/emails/webhook`
4. Check that the route file exists: `src/app/api/emails/webhook/route.ts`

### 401 Unauthorized

If you get a 401 error:
1. Check if `INBOUND_WEBHOOK_SECRET` is set in your `.env` file
2. Verify the secret matches in both the `.env` file and Inbound dashboard
3. If you don't want to use a secret, make sure the verification code is commented out

### Email Not Stored

If the webhook returns 200 but emails aren't stored:
1. Check the server logs for errors
2. Verify the user email exists in the `user_emails` table
3. Check that the email address matches exactly (case-sensitive)
4. Verify the database connection is working

## Webhook Payload Structure

The webhook receives a payload in this format:

```json
{
  "event": "email.received",
  "timestamp": "2024-01-12T10:00:00Z",
  "email": {
    "id": "email-id",
    "recipient": "user@successfamily.online",
    "subject": "Email Subject",
    "from": {
      "text": "Sender Name <sender@example.com>",
      "addresses": [
        {
          "name": "Sender Name",
          "address": "sender@example.com"
        }
      ]
    },
    "to": {
      "text": "user@successfamily.online",
      "addresses": [
        {
          "name": null,
          "address": "user@successfamily.online"
        }
      ]
    },
    "cleanedContent": {
      "html": "<p>HTML content</p>",
      "text": "Text content"
    }
  },
  "endpoint": {
    "id": "endpoint-id",
    "name": "Endpoint Name",
    "type": "webhook"
  }
}
```

## Next Steps

1. **Verify Domain**: Make sure `successfamily.online` is verified in your Inbound dashboard
2. **Test Webhook**: Use the "Test Webhook" button in Inbound dashboard
3. **Send Test Email**: Send an email to a personalized email address and verify it appears in the inbox
4. **Monitor Logs**: Check server logs for any errors or issues

