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

// Pre-built email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Success Family!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to Success Family, ${name}!</h1>
        <p>We're excited to have you join our community of success-driven individuals.</p>
        <p>Get ready to connect, learn, and grow with like-minded people on their journey to success.</p>
        <a href="${env.NEXT_PUBLIC_APP_URL}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Get Started</a>
      </div>
    `,
  }),
  
  passwordReset: (resetLink: string) => ({
    subject: 'Reset Your Password - Success Family',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset Request</h1>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        <a href="${resetLink}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
      </div>
    `,
  }),
}
