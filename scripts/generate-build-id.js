#!/usr/bin/env node

// Generate a unique build ID based on timestamp
const buildId = Date.now().toString()
process.env.NEXT_PUBLIC_BUILD_ID = buildId

// Write to .env.local for Next.js to pick up
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = `NEXT_PUBLIC_BUILD_ID=${buildId}\n`

// Append or update the build ID in .env.local
if (fs.existsSync(envPath)) {
  const existing = fs.readFileSync(envPath, 'utf8')
  const lines = existing.split('\n')
  const filtered = lines.filter(line => !line.startsWith('NEXT_PUBLIC_BUILD_ID='))
  fs.writeFileSync(envPath, [...filtered, `NEXT_PUBLIC_BUILD_ID=${buildId}`].join('\n'))
} else {
  fs.writeFileSync(envPath, envContent)
}

console.log(`Generated build ID: ${buildId}`)

// Export for use in build process
module.exports = buildId









