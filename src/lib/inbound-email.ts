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
    const { data: domainsResponse, error: domainsError } = await inbound.domains.list()
    
    if (domainsError) {
      console.warn('Failed to list domains:', domainsError)
      return null
    }

    // Extract domains array from response
    // Response structure can be: { data: DomainWithStats[] } or DomainWithStats[] directly
    let domains: any[] = []
    if (Array.isArray(domainsResponse)) {
      domains = domainsResponse
    } else if (domainsResponse?.data && Array.isArray(domainsResponse.data)) {
      domains = domainsResponse.data
    }

    console.log(`[Inbound] Found ${domains.length} domains, looking for: ${domainName}`)

    // Find domain matching the domain name
    const domain = domains.find((d: any) => {
      const dName = d.domain || d.name || d.domainName
      const matches = dName && (dName.toLowerCase() === domainName.toLowerCase())
      if (matches) {
        console.log(`[Inbound] Found domain: ${dName} with ID: ${d.id}`)
      }
      return matches
    })

    if (!domain) {
      console.warn(`[Inbound] Domain ${domainName} not found. Available domains:`, domains.map((d: any) => d.domain || d.name || d.domainName))
    }

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
    console.log(`[Inbound] Creating endpoint for ${email} with webhook URL: ${webhookUrl}`)
    
    // Verify that the client has the required methods
    if (!inbound.endpoints || typeof inbound.endpoints.create !== 'function') {
      throw new Error('Inbound SDK client does not have endpoints.create method. Please check SDK version and initialization.')
    }
    
    const { data: endpointData, error: endpointError } = await inbound.endpoints.create({
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
      console.error('[Inbound] Endpoint creation error:', endpointError)
      console.error('[Inbound] Endpoint data:', endpointData)
      let errorMsg: string
      const err = endpointError as unknown
      if (typeof err === 'string') {
        errorMsg = err
      } else if (err && typeof err === 'object' && 'toString' in err && typeof err.toString === 'function') {
        errorMsg = err.toString()
      } else {
        errorMsg = JSON.stringify(err) || 'Failed to create endpoint'
      }
      throw new Error(errorMsg)
    }

    const endpointId = endpointData.id || (endpointData as any).id
    console.log(`[Inbound] Endpoint created with ID: ${endpointId}`)

    // Then, create the email address linked to the endpoint using the SDK
    console.log(`[Inbound] Creating email address ${email} with domainId: ${domainId}, endpointId: ${endpointId}`)
    
    // Verify that the client has the required methods
    if (!inbound.emailAddresses || typeof inbound.emailAddresses.create !== 'function') {
      throw new Error('Inbound SDK client does not have emailAddresses.create method. Please check SDK version and initialization.')
    }
    
    const { data: addressData, error: addressError } = await inbound.emailAddresses.create({
      address: email,
      domainId: domainId,
      endpointId: endpointId,
      isActive: true,
    })

    if (addressError || !addressData) {
      console.error('[Inbound] Address creation error:', addressError)
      console.error('[Inbound] Address data:', addressData)
      // Clean up endpoint if address creation fails
      if (endpointId) {
        try {
          console.log(`[Inbound] Cleaning up endpoint: ${endpointId}`)
          await inbound.endpoints.delete(endpointId)
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
        errorMsg = JSON.stringify(err) || 'Failed to create address'
      }
      throw new Error(errorMsg)
    }

    const addressId = addressData.id || (addressData as any).id
    console.log(`[Inbound] Email address created with ID: ${addressId}`)

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
 * Update an existing endpoint's webhook URL
 * @param endpointId The endpoint ID to update
 * @param webhookUrl The new webhook URL
 * @param userId The user ID to include in webhook headers
 * @returns Updated endpoint data
 */
export async function updateInboundEndpoint(
  endpointId: string,
  webhookUrl: string,
  userId: string
) {
  const inbound = getInboundClient()
  
  try {
    console.log(`[Inbound] Updating endpoint ${endpointId} with webhook URL: ${webhookUrl}`)
    
    if (!inbound.endpoints || typeof inbound.endpoints.update !== 'function') {
      throw new Error('Inbound SDK client does not have endpoints.update method.')
    }
    
    // First, try to get the existing endpoint to preserve other settings
    let existingConfig: any = {
      url: webhookUrl,
      headers: {
        'X-User-Id': userId,
      },
      timeout: 30,
      retryAttempts: 3,
    }
    
    try {
      const { data: existingEndpoint } = await inbound.endpoints.get(endpointId)
      if (existingEndpoint && existingEndpoint.config) {
        // Preserve existing config and update URL and headers
        existingConfig = {
          ...existingEndpoint.config,
          url: webhookUrl,
          headers: {
            ...(existingEndpoint.config.headers || {}),
            'X-User-Id': userId,
          },
        }
      }
    } catch (getError) {
      // If we can't get the endpoint, just use the default config
      console.warn('[Inbound] Could not fetch existing endpoint, using default config:', getError)
    }
    
    // Update the endpoint with the new URL
    const { data: endpointData, error: endpointError } = await inbound.endpoints.update(endpointId, {
      config: existingConfig,
    })

    if (endpointError || !endpointData) {
      console.error('[Inbound] Endpoint update error:', endpointError)
      let errorMsg: string
      const err = endpointError as unknown
      if (typeof err === 'string') {
        errorMsg = err
      } else if (err && typeof err === 'object' && 'toString' in err && typeof err.toString === 'function') {
        errorMsg = err.toString()
      } else {
        errorMsg = JSON.stringify(err) || 'Failed to update endpoint'
      }
      throw new Error(errorMsg)
    }

    console.log(`[Inbound] Endpoint updated successfully: ${endpointId}`)
    return endpointData
  } catch (error: any) {
    console.error('Error updating Inbound endpoint:', error)
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
      const { error: addressError } = await inbound.emailAddresses.delete(addressId)
      if (addressError) {
        console.error('Error deleting address:', addressError)
      }
    }

    // Delete the endpoint using the SDK
    if (endpointId) {
      const { error: endpointError } = await inbound.endpoints.delete(endpointId)
      if (endpointError) {
        console.error('Error deleting endpoint:', endpointError)
      }
    }
  } catch (error: any) {
    console.error('Error deleting Inbound email address:', error)
    // Don't throw - cleanup errors are not critical
  }
}

