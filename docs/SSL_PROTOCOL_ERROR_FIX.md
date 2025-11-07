# Fixing ERR_SSL_PROTOCOL_ERROR

## Common Causes & Solutions

### 1. ✅ Using HTTP Instead of HTTPS

**Problem:** Accessing the site via `http://` instead of `https://`

**Solution:** Always use HTTPS URLs:
- ✅ `https://localhost:3000`
- ✅ `https://127.0.0.1:3000`
- ✅ `https://192.168.0.33:3000`
- ❌ `http://localhost:3000` (will cause SSL errors if server expects HTTPS)

### 2. ✅ Server Not Running with HTTPS

**Problem:** Running `pnpm dev` instead of `pnpm dev:https`

**Solution:**
```bash
# Stop current server (Ctrl+C)
# Start HTTPS server
pnpm dev:https
```

The server should output:
```
🚀 Server ready!
📍 https://localhost:3000
📍 https://127.0.0.1:3000
📍 https://192.168.0.33:3000
✅ Microphone access enabled via HTTPS
```

### 3. ✅ Browser Certificate Warning

**Problem:** Browser blocking self-signed certificate

**Solution:**
1. When you see the security warning, click **"Advanced"** or **"Show Details"**
2. Click **"Proceed to localhost (unsafe)"** or **"Accept the Risk and Continue"**
3. The browser will remember this for future visits

**Chrome/Edge:**
- Click "Advanced" → "Proceed to localhost (unsafe)"

**Firefox:**
- Click "Advanced" → "Accept the Risk and Continue"

**Safari:**
- Click "Show Details" → "visit this website" → "Visit Website"

### 4. ✅ Missing or Corrupted Certificates

**Problem:** Certificate files are missing or corrupted

**Solution:**
```bash
# Regenerate certificates
pnpm setup:https

# Or manually:
mkcert -install
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1 192.168.0.33
```

### 5. ✅ Certificate Mismatch (Wrong IP/Hostname)

**Problem:** Accessing via IP/hostname not in certificate

**Check what's in your certificate:**
```bash
openssl x509 -in localhost.pem -text -noout | grep -A 1 "Subject Alternative Name"
```

**Solution:** Regenerate certificate with your current IP:
```bash
# Get your current IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Regenerate with new IP
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1 $LOCAL_IP
```

### 6. ✅ Port Mismatch

**Problem:** Server running on different port than expected

**Check what port the server is using:**
```bash
# Server should show the port in startup message
# Default is 3000
```

**Solution:** Access the correct port:
- If server shows `https://localhost:3000`, use that exact URL
- If port is different, use that port in the URL

### 7. ✅ Mixed Content Issues

**Problem:** HTTPS page trying to load HTTP resources

**Check for mixed content:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors like "Mixed Content" or "Blocked loading..."

**Solution:** Ensure all external resources use HTTPS:
- Supabase URLs: `https://your-project.supabase.co`
- API endpoints: Use `https://` not `http://`
- Image sources: Use HTTPS URLs

### 8. ✅ Browser Cache/Certificate Store Issue

**Problem:** Browser cached old certificate or connection failure

**Solution:**
1. **Clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached Web Content
   - Safari: Develop → Empty Caches

2. **Clear SSL state:**
   - Chrome: Settings → Privacy → Clear browsing data → Advanced → Hosted app data
   - Or use incognito/private mode

3. **Restart browser completely**

### 9. ✅ Firewall Blocking Connection

**Problem:** Firewall blocking HTTPS connections

**Solution:**
```bash
# Check if port 3000 is open
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-ports  # Fedora/RHEL

# Allow port 3000 if needed
sudo ufw allow 3000/tcp  # Ubuntu/Debian
```

### 10. ✅ Verify Server is Running

**Check if server is actually running:**
```bash
# Test HTTPS connection from terminal
curl -k https://localhost:3000

# Should return HTML content
# If it fails, server isn't running or has issues
```

## Quick Diagnostic Steps

1. **Verify server is running:**
   ```bash
   pnpm dev:https
   # Should see "🚀 Server ready!" message
   ```

2. **Test from terminal:**
   ```bash
   curl -k https://localhost:3000
   # Should return HTML (the -k flag ignores cert warnings)
   ```

3. **Check certificate:**
   ```bash
   ls -la localhost*.pem
   # Should show both files exist
   ```

4. **Verify certificate validity:**
   ```bash
   openssl x509 -in localhost.pem -text -noout | grep -A 1 "Subject Alternative Name"
   # Should include localhost, 127.0.0.1, and your IP
   ```

5. **Check browser console:**
   - Open DevTools (F12)
   - Check Console and Network tabs for errors
   - Look for SSL/TLS related errors

## Still Having Issues?

If none of the above work:

1. **Try a different browser** (to rule out browser-specific issues)
2. **Use incognito/private mode** (to rule out extensions/cache)
3. **Check server logs** for any error messages
4. **Verify environment variables** in `.env` file (especially Supabase URLs)
5. **Restart the server** completely:
   ```bash
   # Kill any existing processes
   pkill -f "node server.js"
   pkill -f "next dev"
   
   # Start fresh
   pnpm dev:https
   ```

## Need Help?

- Check server logs for specific error messages
- Verify you're using `https://` not `http://`
- Ensure certificates are up to date
- Check browser console for detailed error messages



