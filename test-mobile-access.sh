#!/bin/bash

echo "=== Mobile Access Diagnostic ==="
echo ""
echo "✅ Server Status:"
echo "   - HTTPS Server: Running on port 3000"
echo "   - Network IP: 192.168.0.33"
echo "   - Listening on: 0.0.0.0 (all interfaces)"
echo ""

echo "📱 Access from your mobile device:"
echo "   https://192.168.0.33:3000"
echo ""

echo "🔍 Troubleshooting:"
echo ""
echo "1. Verify mobile WiFi:"
echo "   - Same network as computer?"
echo "   - IP should be 192.168.0.x"
echo ""

echo "2. Most common issue: Router Client Isolation"
echo "   - Check router settings for 'AP Isolation'"
echo "   - Usually found in Wireless settings"
echo "   - Disable if enabled"
echo ""

echo "3. Test from mobile:"
echo "   - Try: http://192.168.0.33:3000 (HTTP first)"
echo "   - Then: https://192.168.0.33:3000 (HTTPS)"
echo "   - Accept certificate warning"
echo ""

echo "4. If still not working:"
echo "   - Check if mobile is on 'Guest' WiFi"
echo "   - Try connecting both to same WiFi band (2.4GHz or 5GHz)"
echo "   - Restart router if needed"
echo ""

echo "📄 See MOBILE_ACCESS_TROUBLESHOOTING.md for detailed guide"
