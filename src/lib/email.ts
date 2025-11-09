import { env } from './env'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from = 'Success Family <noreply@successfamily.com>' }: EmailOptions) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send email: ${error}`)
  }

  return response.json()
}

// Base email template wrapper
const baseEmailTemplate = (content: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #7c3aed; margin: 0;">Success Family</h1>
    </div>
    ${content}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
      This is an automated message from Success Family. Please do not reply to this email.
    </p>
  </div>
`

// Pre-built email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Success Family!',
    html: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">Welcome to Success Family, ${name}!</h2>
      <p style="color: #374151; line-height: 1.6;">We're excited to have you join our community of success-driven individuals.</p>
      <p style="color: #374151; line-height: 1.6;">Get ready to connect, learn, and grow with like-minded people on their journey to success.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Get Started</a>
      </div>
    `),
  }),
  
  passwordReset: (resetLink: string) => ({
    subject: 'Reset Your Password - Success Family',
    html: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">Password Reset Request</h2>
      <p style="color: #374151; line-height: 1.6;">You requested to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This link will expire in 1 hour for security reasons.</p>
    `),
  }),

  // Platform subscription emails
  platformSubscriptionRequest: (userName: string, communityName: string, amount: number, billingCycle: string) => ({
    subject: `Platform Subscription Request - ${communityName}`,
    html: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">Platform Subscription Request Received</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">Your payment receipt for creating the community <strong>${communityName}</strong> has been received and is currently being reviewed.</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Billing Cycle:</strong> ${billingCycle}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">We'll notify you once your payment has been verified. This usually takes 24-48 hours.</p>
    `),
  }),

  platformPaymentVerified: (userName: string, communityName: string, amount: number) => ({
    subject: `Payment Verified - ${communityName} is now active!`,
    html: baseEmailTemplate(`
      <h2 style="color: #10b981; margin-bottom: 20px;">✓ Payment Verified</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">Great news! Your payment for <strong>${communityName}</strong> has been verified.</p>
      <div style="background: #ecfdf5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46;"><strong>Your community is now active!</strong></p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Amount paid: <strong>TTD $${amount.toFixed(2)}</strong></p>
      <p style="color: #374151; line-height: 1.6;">You can now manage your community and start growing your community.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/manage" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Manage Community</a>
      </div>
    `),
  }),

  platformPaymentRejected: (userName: string, communityName: string, reason: string) => ({
    subject: `Payment Issue - ${communityName}`,
    html: baseEmailTemplate(`
      <h2 style="color: #ef4444; margin-bottom: 20px;">Payment Verification Issue</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">Unfortunately, your payment for <strong>${communityName}</strong> could not be verified.</p>
      <div style="background: #fef2f2; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <p style="margin: 0 0 10px 0; color: #991b1b;"><strong>Reason:</strong></p>
        <p style="margin: 0; color: #7f1d1d;">${reason}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please upload a new payment receipt to continue your subscription.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Submit New Payment</a>
      </div>
    `),
  }),

  platformInvoiceGenerated: (userName: string, communityName: string, amount: number, dueDate: string) => ({
    subject: `New Invoice Due - ${communityName}`,
    html: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">New Invoice Generated</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">A new invoice has been generated for your platform subscription to <strong>${communityName}</strong>.</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #374151;"><strong>Amount Due:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please upload your payment receipt before the due date to keep your community active.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Invoice</a>
      </div>
    `),
  }),

  platformPaymentReminder: (userName: string, communityName: string, amount: number, daysUntilDue: number, dueDate: string) => ({
    subject: `Payment Reminder - ${communityName} (${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} remaining)`,
    html: baseEmailTemplate(`
      <h2 style="color: #f59e0b; margin-bottom: 20px;">Payment Reminder</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">This is a friendly reminder that your payment for <strong>${communityName}</strong> is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.</p>
      <div style="background: #fffbeb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 5px 0; color: #92400e;"><strong>Amount Due:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #92400e;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please upload your payment receipt to avoid any service interruptions.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Now</a>
      </div>
    `),
  }),

  walletTopupReminder: (userName: string, amount: number, dueDate: string, overdueDays = 0) => {
    const dueDateString = new Date(dueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    const isOverdue = overdueDays > 0
    const subject = isOverdue
      ? `Wallet Top-Up Overdue (${overdueDays} day${overdueDays !== 1 ? 's' : ''})`
      : `Wallet Top-Up Due ${dueDateString}`

    return {
      subject,
      html: baseEmailTemplate(`
        <h2 style="color: ${isOverdue ? '#ef4444' : '#7c3aed'}; margin-bottom: 20px;">
          ${isOverdue ? 'Action Required: Overdue Wallet Top-Up' : 'Wallet Top-Up Reminder'}
        </h2>
        <p style="color: #374151; line-height: 1.6;">Hi ${userName || 'there'},</p>
        <p style="color: #374151; line-height: 1.6;">
          ${isOverdue
            ? `Your mandatory wallet top-up was due on <strong>${dueDateString}</strong>. Please make a top-up of at least <strong>TTD $${amount.toFixed(
                2
              )}</strong> to keep your account in good standing.`
            : `This is a friendly reminder that your mandatory wallet top-up of <strong>TTD $${amount.toFixed(
                2
              )}</strong> is due on <strong>${dueDateString}</strong>.`
          }
        </p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${dueDateString}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> TTD $${amount.toFixed(2)}</p>
          ${isOverdue ? `<p style="margin: 5px 0; color: #991b1b;"><strong>Overdue:</strong> ${overdueDays} day${overdueDays !== 1 ? 's' : ''}</p>` : ''}
        </div>
        <p style="color: #374151; line-height: 1.6;">
          Head to your wallet to upload a bank transfer receipt. Once verified, your balance will be updated automatically.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/wallet" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Top Up Wallet</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you have already completed your top-up, you can ignore this reminder. Thank you!
        </p>
      `),
    }
  },

  // Community subscription emails
  communitySubscriptionRequest: (userName: string, communityName: string, ownerName: string, amount: number, billingCycle: string) => ({
    subject: `Subscription Request - ${communityName}`,
    ownerSubject: `New Subscription Request for ${communityName}`,
    html: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">Subscription Request Received</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">Your payment receipt to join <strong>${communityName}</strong> has been received and is currently being reviewed by the community owner.</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #374151;"><strong>Community:</strong> ${communityName}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Billing Cycle:</strong> ${billingCycle}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">The community owner will be notified to verify your payment. You'll receive another email once your access has been confirmed.</p>
    `),
    ownerHtml: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">New Subscription Request</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${ownerName},</p>
      <p style="color: #374151; line-height: 1.6;">You have a new subscription request for <strong>${communityName}</strong>.</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #374151;"><strong>Subscriber:</strong> ${userName}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Billing Cycle:</strong> ${billingCycle}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please verify the payment receipt in your community settings.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/manage/payments" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Payment</a>
      </div>
    `),
  }),

  communityPaymentVerified: (userName: string, communityName: string, ownerName: string) => ({
    subject: `Welcome to ${communityName}!`,
    ownerSubject: `Payment Verified for ${communityName}`,
    html: baseEmailTemplate(`
      <h2 style="color: #10b981; margin-bottom: 20px;">✓ Subscription Verified</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">Congratulations! Your payment has been verified and you're now a member of <strong>${communityName}</strong>.</p>
      <div style="background: #ecfdf5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46;"><strong>Your subscription is now active!</strong></p>
      </div>
      <p style="color: #374151; line-height: 1.6;">You can now access all community features and content.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/${communityName.toLowerCase().replace(/\s+/g, '-')}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Visit Community</a>
      </div>
    `),
    ownerHtml: baseEmailTemplate(`
      <h2 style="color: #10b981; margin-bottom: 20px;">✓ Payment Verified</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${ownerName},</p>
      <p style="color: #374151; line-height: 1.6;">You've successfully verified the payment from ${userName} for <strong>${communityName}</strong>.</p>
      <div style="background: #ecfdf5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46;"><strong>${userName} is now a member of your community!</strong></p>
      </div>
      <p style="color: #374151; line-height: 1.6;">They now have access to all community features and content.</p>
    `),
  }),

  communityPaymentRejected: (userName: string, communityName: string, reason: string) => ({
    subject: `Subscription Issue - ${communityName}`,
    html: baseEmailTemplate(`
      <h2 style="color: #ef4444; margin-bottom: 20px;">Payment Verification Issue</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">Unfortunately, your payment to join <strong>${communityName}</strong> could not be verified.</p>
      <div style="background: #fef2f2; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <p style="margin: 0 0 10px 0; color: #991b1b;"><strong>Reason:</strong></p>
        <p style="margin: 0; color: #7f1d1d;">${reason}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please upload a new payment receipt if you'd like to try again.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Submit New Payment</a>
      </div>
    `),
  }),

  communityInvoiceGenerated: (userName: string, communityName: string, amount: number, dueDate: string) => ({
    subject: `New Invoice - ${communityName} Subscription`,
    html: baseEmailTemplate(`
      <h2 style="color: #111827; margin-bottom: 20px;">New Invoice Generated</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">A new invoice has been generated for your subscription to <strong>${communityName}</strong>.</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #374151;"><strong>Amount Due:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please upload your payment receipt before the due date to maintain your community access.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Invoice</a>
      </div>
    `),
  }),

  communityPaymentReminder: (userName: string, communityName: string, amount: number, daysUntilDue: number, dueDate: string) => ({
    subject: `Payment Reminder - ${communityName} (${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} remaining)`,
    html: baseEmailTemplate(`
      <h2 style="color: #f59e0b; margin-bottom: 20px;">Payment Reminder</h2>
      <p style="color: #374151; line-height: 1.6;">Hi ${userName},</p>
      <p style="color: #374151; line-height: 1.6;">This is a friendly reminder that your payment for <strong>${communityName}</strong> is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.</p>
      <div style="background: #fffbeb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 5px 0; color: #92400e;"><strong>Amount Due:</strong> TTD $${amount.toFixed(2)}</p>
        <p style="margin: 5px 0; color: #92400e;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">Please upload your payment receipt to avoid any service interruptions.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Now</a>
      </div>
    `),
  }),
}
