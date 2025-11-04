const { createServer } = require('https')
const { parse } = require('url')
const next = require('next')
const fs = require('fs')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0' // Listen on all interfaces for network access
const port = process.env.PORT || 3000

// Check if certificate files exist
const keyPath = path.join(__dirname, 'localhost-key.pem')
const certPath = path.join(__dirname, 'localhost.pem')

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('❌ SSL certificates not found!')
  console.error('Please run: mkcert -install && mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1')
  console.error('Or run: pnpm setup:https')
  process.exit(1)
}

// SSL certificate paths
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
}

// Initialize Next.js app
// Note: To use Turbopack, run "next dev --turbo" directly
// Custom servers don't support the turbo flag, but HMR still works
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Handle WebSocket upgrades gracefully
  // Next.js HMR WebSocket connections may not work with custom HTTPS servers
  // We'll gracefully reject upgrade requests to prevent crashes
  server.on('upgrade', (req, socket) => {
    // For HMR endpoints, gracefully close the connection
    // Next.js will fall back to polling if WebSocket fails
    if (req.url && req.url.includes('/_next/')) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }
    // For other WebSocket connections, reject
    socket.write('HTTP/1.1 501 Not Implemented\r\n\r\n')
    socket.destroy()
  })

  server.once('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  server.listen(port, hostname, () => {
    const os = require('os')
    const networkInterfaces = os.networkInterfaces()
    let localIp = 'localhost'
    
    // Find first non-internal IPv4 address
    for (const interfaceName of Object.keys(networkInterfaces)) {
      const addresses = networkInterfaces[interfaceName]
      if (addresses) {
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            localIp = addr.address
            break
          }
        }
        if (localIp !== 'localhost') break
      }
    }
    
    console.log('')
    console.log('🚀 Server ready!')
    console.log(`📍 https://localhost:${port}`)
    console.log(`📍 https://127.0.0.1:${port}`)
    if (localIp !== 'localhost') {
      console.log(`📍 https://${localIp}:${port}`)
    }
    console.log('')
    console.log('✅ Microphone access enabled via HTTPS')
    console.log('✅ Network access enabled')
    console.log('')
  })
})
