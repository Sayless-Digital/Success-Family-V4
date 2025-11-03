# HTTPS Development Setup

To enable microphone access, you need to run the dev server over HTTPS.

## Quick Setup

### 1. Install mkcert

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install libnss3-tools
curl -JLO 'https://dl.filippo.io/mkcert/latest?for=linux/amd64'
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

**macOS:**
```bash
brew install mkcert
```

**Windows:**
```bash
# Using Chocolatey
choco install mkcert

# Or download from: https://github.com/FiloSottile/mkcert/releases
```

### 2. Generate SSL Certificates

**For localhost only:**
```bash
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
```

**For localhost + network access (recommended):**
```bash
# Get your local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')  # Linux
# or
LOCAL_IP=$(ipconfig getifaddr en0)          # macOS
# or check with: ipconfig (Windows) or ifconfig

# Generate certificate with IP address
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1 $LOCAL_IP
```

This will create:
- `localhost-key.pem` (private key)
- `localhost.pem` (certificate)

**Note:** The setup script automatically detects and includes your local IP address.

### 3. Run Development Server with HTTPS

```bash
pnpm dev:https
```

Then open: **https://localhost:3000**

## Alternative: Using the Setup Script

```bash
pnpm setup:https
pnpm dev:https
```

## Notes

- The certificates are stored locally and are **not** committed to git (they're in `.gitignore`)
- Browsers will show a security warning on first visit - click "Advanced" → "Proceed to [your-ip]" (this is safe for local development)
- The microphone API requires HTTPS (or localhost) to work
- **Network Access:** The server binds to `0.0.0.0`, so you can access it from other devices on your network via your local IP address
- If your IP changes, regenerate the certificate with the new IP address

