#!/bin/bash
# ==============================================
# Next.js Service Setup Script
# ==============================================
# This script creates a systemd service to run
# the Researcher Next.js app on port 5500
#
# Usage:
#   chmod +x setup-nextjs-service.sh
#   sudo ./setup-nextjs-service.sh
# ==============================================

set -e

echo "🚀 Setting up Researcher Next.js service..."

# Determine the app directory (adjust if needed)
APP_DIR="/home/ubuntu/Hackathon/researcher"
APP_USER="ubuntu"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "⚠️  App directory not found at $APP_DIR"
    echo "   Please clone/copy the app and run this script again"
    exit 1
fi

echo "📍 App directory: $APP_DIR"

# Install dependencies if not already done
if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "📥 Installing npm dependencies..."
    cd "$APP_DIR"
    npm install
    npm run build
    echo "✅ Dependencies installed and build complete"
fi

# Create systemd service file
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/researcher.service > /dev/null <<EOF
[Unit]
Description=Researcher Next.js App
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
Environment="PORT=5500"
# Load environment variables from .env.local if it exists
EnvironmentFile=$APP_DIR/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created"

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable service to start on boot
echo "🔗 Enabling service to start on boot..."
sudo systemctl enable researcher

# Start the service
echo "🚀 Starting researcher service..."
sudo systemctl start researcher

# Check status
echo ""
sleep 2
if sudo systemctl is-active --quiet researcher; then
    echo "✅ Service is running"
else
    echo "⚠️  Service may not have started. Check logs:"
    echo "   sudo journalctl -u researcher -n 50 -f"
    exit 1
fi

echo ""
echo "=========================================="
echo "✨ Next.js service setup complete!"
echo "=========================================="
echo ""
echo "📋 Useful commands:"
echo "   sudo systemctl status researcher       # Check status"
echo "   sudo systemctl restart researcher      # Restart service"
echo "   sudo systemctl stop researcher         # Stop service"
echo "   sudo journalctl -u researcher -f       # View logs (live)"
echo "   sudo journalctl -u researcher -n 100   # Last 100 log lines"
echo ""
echo "✨ Your app should now be running on port 5500"
echo "   and accessible via Nginx at http://34.136.118.181/"
echo ""
