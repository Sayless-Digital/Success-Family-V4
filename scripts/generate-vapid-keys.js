#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications
 * 
 * Usage:
 *   node scripts/generate-vapid-keys.js
 * 
 * This script generates VAPID (Voluntary Application Server Identification) keys
 * that are used to authenticate your server with browser push services.
 */

const webpush = require('web-push')

try {
  const vapidKeys = webpush.generateVAPIDKeys()
  
  console.log('\n✅ VAPID keys generated successfully!\n')
  console.log('Add these to your .env.local file:\n')
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
  console.log(`VAPID_EMAIL=hello@successfamily.online\n`)
  console.log('⚠️  Keep the private key SECRET - never commit it to version control!\n')
} catch (error) {
  console.error('❌ Error generating VAPID keys:', error.message)
  process.exit(1)
}


