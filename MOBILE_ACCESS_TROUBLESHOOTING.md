# Mobile Access Troubleshooting Guide

## Issue: ERR_ADDRESS_UNREACHABLE on Mobile Device

### Server Configuration ✅
- Server listening on: `0.0.0.0:3000` (all interfaces)
- Network IP: `192.168.0.33`
- Certificate includes IP: `192.168.0.33`
- Firewall: Inactive (not blocking)

### Troubleshooting Steps

#### 1. Verify Mobile Device is on Same Network
On your mobile device:
- Go to WiFi settings
- Check you're connected to the same WiFi network as your computer
- Note the IP address (should be `192.168.0.x`)

#### 2. Check for WiFi Client Isolation
Some routers have "AP Isolation" or "Client Isolation" enabled, which prevents devices from communicating with each other:
- Log into your router (usually `192.168.0.1` or `192.168.1.1`)
- Look for settings like:
  - "AP Isolation"
  - "Client Isolation"
  - "Wireless Isolation"
- Disable this feature if enabled

#### 3. Test Network Connectivity
From your computer, try pinging your mobile device:
```bash
# First, find your mobile's IP address from WiFi settings
# Then ping it:
ping 192.168.0.XXX
```

#### 4. Try HTTP First (for testing)
If you can access the computer's IP but get certificate errors:
1. Stop the current server
2. Try accessing via HTTP first: `http://192.168.0.33:3000`
3. This will help identify if it's a certificate issue

#### 5. Accept Self-Signed Certificate on Mobile
When you first visit `https://192.168.0.33:3000`:
- You'll see a security warning
- Click "Advanced" or "Details"
- Click "Proceed to [IP]" or "Accept Risk"
- The certificate warning is expected with self-signed certificates

#### 6. Clear Mobile Browser Cache
Sometimes the browser caches connection failures:
- Clear browser cache and cookies
- Try in private/incognito mode
- Try a different browser app

### Alternative: Use ngrok for Testing
If local network access continues to fail, use ngrok for temporary HTTPS access:
```bash
# Install ngrok
npm install -g ngrok

# Start server (in another terminal)
pnpm dev

# Create tunnel
ngrok http 3000
```

### Common Router Issues
- **Guest WiFi**: If mobile is on "Guest" network, it usually can't access local devices
- **5GHz vs 2.4GHz**: Some routers isolate between bands - connect both devices to same band
- **Mesh Networks**: Some mesh systems isolate between nodes

### Testing from Computer
Test the HTTPS connection from your computer first:
```bash
curl -k https://192.168.0.33:3000
```

This should return the HTML of your site. If this fails, there's a server configuration issue.

### Next Steps
1. Verify mobile is on same network (192.168.0.x)
2. Check router for client isolation
3. Try accessing `http://192.168.0.33:3000` first
4. Accept certificate warning if HTTPS
5. Check if mobile can ping `192.168.0.33`
