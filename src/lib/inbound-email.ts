import { env } from './env'
import { Inbound } from '@inboundemail/sdk'

// Initialize Inbound client
function getInboundClient(): Inbound {
  if (!env.INBOUND_API_KEY) {
    throw new Error('INBOUND_API_KEY is not configured')
  }
  
  return new Inbound(env.INBOUND_API_KEY)
}

/**
 * Get or find domain ID for a given domain name
 * @param domainName The domain name (e.g., "successfamily.online")
 * @returns Domain ID if found
 */
async function getDomainId(domainName: string): Promise<string | null> {
  const inbound = getInboundClient()
  
  try {
    const { data: domainsResponse, error: domainsError } = await inbound.domain.list()
    
    if (domainsError) {
      console.warn('Failed to list domains:', domainsError)
      return null
    }

    // Extract domains array from response
    // Response structure: { data: DomainWithStats[], pagination, meta }
    const domains = domainsResponse?.data || []

    // Find domain matching the domain name
    const domain = domains.find((d: any) => {
      const dName = d.domain || d.name
      return dName && (dName.toLowerCase() === domainName.toLowerCase())
    })

    return domain?.id || null
  } catch (error) {
    console.error('Error getting domain ID:', error)
    return null
  }
}

/**
 * Create an email address in Inbound
 * @param email The email address to create (e.g., "john.doe@successfamily.online")
 * @param webhookUrl The webhook URL to receive emails
 * @param userId The user ID to include in webhook headers
 * @returns Inbound address ID and endpoint ID
 */
export async function createInboundEmailAddress(
  email: string,
  webhookUrl: string,
  userId: string
) {
  const inbound = getInboundClient()
  
  try {
    // Extract domain from email
    const domainName = email.split('@')[1]
    if (!domainName) {
      throw new Error('Invalid email address format')
    }

    // Get domain ID - domain must be verified in Inbound first
    const domainId = await getDomainId(domainName)
    
    if (!domainId) {
      throw new Error(`Domain ${domainName} not found in Inbound. Please verify the domain in your Inbound dashboard first.`)
    }

    // First, create an endpoint for receiving emails using the SDK
    const { data: endpointData, error: endpointError } = await inbound.endpoint.create({
      name: `Email endpoint for ${email}`,
      type: 'webhook',
      description: `Webhook endpoint for user ${userId}`,
      config: {
        url: webhookUrl,
        headers: {
          'X-User-Id': userId,
        },
        timeout: 30,
        retryAttempts: 3,
      },
    })

    if (endpointError || !endpointData) {
      let errorMsg: string
      const err = endpointError as unknown
      if (typeof err === 'string') {
        errorMsg = err
      } else if (err && typeof err === 'object' && 'toString' in err && typeof err.toString === 'function') {
        errorMsg = err.toString()
      } else {
        errorMsg = 'Failed to create endpoint'
      }
      throw new Error(errorMsg)
    }

    const endpointId = endpointData.id

    // Then, create the email address linked to the endpoint using the SDK
    // Note: Using type assertion as Inbound SDK types may be incomplete
    const { data: addressData, error: addressError } = await (inbound as any).address.create({
      address: email,
      domainId: domainId,
      endpointId: endpointId,
      isActive: true,
    })

    if (addressError || !addressData) {
      // Clean up endpoint if address creation fails
      if (endpointId) {
        try {
          await inbound.endpoint.delete(endpointId)
        } catch (cleanupError) {
          console.error('Failed to cleanup endpoint:', cleanupError)
        }
      }
      let errorMsg: string
      const err = addressError as unknown
      if (typeof err === 'string') {
        errorMsg = err
      } else if (err && typeof err === 'object' && 'toString' in err && typeof err.toString === 'function') {
        errorMsg = err.toString()
      } else {
        errorMsg = 'Failed to create address'
      }
      throw new Error(errorMsg)
    }

    const addressId = addressData.id

    return {
      addressId,
      endpointId,
    }
  } catch (error: any) {
    console.error('Error creating Inbound email address:', error)
    throw error
  }
}

/**
 * Delete an email address from Inbound
 */
export async function deleteInboundEmailAddress(addressId: string, endpointId?: string) {
  const inbound = getInboundClient()
  
  try {
    // Delete the address using the SDK
    if (addressId) {
      // Note: Using type assertion as Inbound SDK types may be incomplete
      const { error: addressError } = await (inbound as any).address.delete(addressId)
      if (addressError) {
        console.error('Error deleting address:', addressError)
      }
    }

    // Delete the endpoint using the SDK
    if (endpointId) {
      const { error: endpointError } = await inbound.endpoint.delete(endpointId)
      if (endpointError) {
        console.error('Error deleting endpoint:', endpointError)
      }
    }
  } catch (error: any) {
    console.error('Error deleting Inbound email address:', error)
    // Don't throw - cleanup errors are not critical
  }
}

