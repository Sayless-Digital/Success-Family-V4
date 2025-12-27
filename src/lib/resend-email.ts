import { env } from './env'

/**
 * Resend Email Setup for Personalized Addresses
 * 
 * With Resend, you don't create individual email addresses via API.
 * Instead, you set up ONE wildcard domain route in the Resend dashboard:
 * 
 * 1. Go to Resend Dashboard → Domains → Inbound Emails
 * 2. Add domain: successfamily.online
 * 3. Set up wildcard route: *@successfamily.online
 * 4. Configure webhook URL: https://yourdomain.com/api/emails/webhook
 * 5. Subscribe to "email.received" event
 * 
 * All emails sent to ANY address @successfamily.online will hit your webhook.
 * The webhook code (api/emails/webhook/route.ts) handles routing based on recipient.
 */

/**
 * Validate email format for personalized addresses
 */
export function validatePersonalizedEmail(email: string): { valid: boolean; error?: string } {
  const domain = env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'successfamily.online'
  const expectedDomain = domain.includes('localhost') ? 'successfamily.online' : domain
  
  if (!email.includes('@')) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  const [localPart, emailDomain] = email.split('@')
  
  if (!localPart || localPart.length < 3) {
    return { valid: false, error: 'Email local part must be at least 3 characters' }
  }
  
  if (emailDomain !== expectedDomain) {
    return { valid: false, error: `Email must end with @${expectedDomain}` }
  }
  
  // Check for invalid characters
  if (!/^[a-z0-9._-]+$/i.test(localPart)) {
    return { valid: false, error: 'Email contains invalid characters. Use only letters, numbers, dots, hyphens, and underscores.' }
  }
  
  return { valid: true }
}

/**
 * Create a personalized email address (Resend approach)
 * 
 * With Resend, we don't actually "create" the address via API.
 * We just validate it and store it in the database.
 * The wildcard route in Resend will catch all emails automatically.
 * 
 * @param email The email address to set up (e.g., "john.doe@successfamily.online")
 * @returns Success status
 */
export async function setupPersonalizedEmail(email: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Validate email format
    const validation = validatePersonalizedEmail(email)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    
    // Check if Resend is configured
    if (!env.RESEND_API_KEY) {
      return { 
        success: false, 
        error: 'RESEND_API_KEY is not configured. Please add it to your environment variables.' 
      }
    }
    
    // With Resend, we don't need to create the address via API
    // The wildcard domain route will catch all emails
    // Just return success - the calling code will store in database
    console.log(`[Resend] Email ${email} is valid and will be handled by wildcard route`)
    
    return { success: true }
  } catch (error: any) {
    console.error('Error setting up personalized email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if wildcard domain is configured
 * 
 * Note: This is a manual setup step in Resend dashboard.
 * This function just checks if the API key is configured.
 */
export function isResendConfigured(): boolean {
  return !!env.RESEND_API_KEY
}

/**
 * Get setup instructions for Resend wildcard routing
 */
export function getSetupInstructions(): string {
  const domain = env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'successfamily.online'
  const actualDomain = domain.includes('localhost') ? 'successfamily.online' : domain
  const webhookUrl = env.NEXT_PUBLIC_APP_URL?.includes('localhost') 
    ? 'https://successfamily.online/api/emails/webhook'
    : `${env.NEXT_PUBLIC_APP_URL}/api/emails/webhook`
  
  return `
To receive emails with Resend, set up wildcard domain routing:

1. Go to Resend Dashboard: https://resend.com/domains
2. Click "Inbound Emails" tab
3. Add your domain: ${actualDomain}
4. Verify domain ownership (add DNS records)
5. Set up wildcard route: *@${actualDomain}
6. Configure webhook URL: ${webhookUrl}
7. Subscribe to "email.received" event

Once configured, ALL emails sent to any address @${actualDomain} will be routed to your webhook automatically. No need to create individual addresses!
  `.trim()
}