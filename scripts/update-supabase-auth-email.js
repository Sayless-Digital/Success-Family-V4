#!/usr/bin/env node

/**
 * Updates the Supabase "Confirm signup" auth email template using the Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=xxxx SUPABASE_PROJECT_REF=yyyy node scripts/update-supabase-auth-email.js
 *
 * Required environment variables:
 *   - SUPABASE_ACCESS_TOKEN: Personal access token with "Auth" scope.
 *   - SUPABASE_PROJECT_REF:  Project reference (found in the Supabase dashboard URL).
 */

const fs = require('fs')
const path = require('path')

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = process.env.SUPABASE_PROJECT_REF

  if (!accessToken) {
    console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.')
    process.exit(1)
  }

  if (!projectRef) {
    console.error('Missing SUPABASE_PROJECT_REF environment variable.')
    process.exit(1)
  }

  const templatePath = path.resolve(__dirname, '../supabase/templates/confirm-signup.html')

  if (!fs.existsSync(templatePath)) {
    console.error(`Email template not found at ${templatePath}`)
    process.exit(1)
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf8')
  const subject = 'Confirm your Success Family account'

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      mailer_subjects_confirmation: subject,
      mailer_templates_confirmation_content: templateHtml,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Failed to update Supabase email template.')
    console.error(errorText)
    process.exit(1)
  }

  console.log('Supabase confirmation email template updated successfully.')
}

main().catch((error) => {
  console.error('An unexpected error occurred while updating the email template.')
  console.error(error)
  process.exit(1)
})

