#!/bin/bash

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "mkcert is not installed. Installing..."
    
    # Install mkcert (Linux)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Please install mkcert manually:"
        echo "  Ubuntu/Debian: sudo apt install libnss3-tools"
        echo "  Then: curl -JLO 'https://dl.filippo.io/mkcert/latest?for=linux/amd64'"
        echo "  chmod +x mkcert-v*-linux-amd64"
        echo "  sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert"
        echo ""
        echo "Or visit: https://github.com/FiloSottile/mkcert#installation"
        exit 1
    fi
    
    # Install mkcert (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install mkcert
        else
            echo "Please install mkcert: brew install mkcert"
            exit 1
        fi
    fi
    
    # Install mkcert (Windows)
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo "Please install mkcert:"
        echo "  choco install mkcert"
        echo "  Or download from: https://github.com/FiloSottile/mkcert/releases"
        exit 1
    fi
fi

# Install local CA
echo "Installing local CA..."
mkcert -install

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || echo "")

# Generate certificate for localhost and network IP
if [ -n "$LOCAL_IP" ]; then
    echo "Generating SSL certificate for localhost and network IP ($LOCAL_IP)..."
    mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1 $LOCAL_IP
else
    echo "Generating SSL certificate for localhost..."
    mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
    echo "⚠️  Could not detect local IP. To add network access later, run:"
    echo "   mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1 YOUR_IP_ADDRESS"
fi

echo ""
echo "✅ HTTPS setup complete!"
echo "Certificate files created:"
echo "  - localhost-key.pem"
echo "  - localhost.pem"
echo ""
echo "You can now run: pnpm dev:https"

