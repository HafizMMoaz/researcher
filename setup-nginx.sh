#!/bin/bash
# ==============================================
# Nginx Setup Script for Researcher App
# ==============================================
# This script configures Nginx as a reverse proxy
# to expose localhost:5500 (Next.js app) publicly
# 
# Usage: 
#   chmod +x setup-nginx.sh
#   sudo ./setup-nginx.sh
# ==============================================

set -e

echo "🚀 Setting up Nginx reverse proxy for Researcher app..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install Nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "📥 Installing Nginx..."
    sudo apt install -y nginx
else
    echo "✅ Nginx is already installed"
fi

# Create Nginx configuration file
echo "⚙️  Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/researcher > /dev/null <<'EOF'
# Upstream Next.js app running on localhost:5500
upstream nextjs_app {
    server 127.0.0.1:5500;
    keepalive 64;
}

# HTTP server block - proxy to Next.js app
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name 34.136.118.181 _;
    
    # Logging
    access_log /var/log/nginx/researcher_access.log combined;
    error_log /var/log/nginx/researcher_error.log warn;
    
    # Proxy all requests to Next.js app
    location / {
        proxy_pass http://nextjs_app;
        proxy_http_version 1.1;
        
        # Headers for WebSocket and long-polling support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering (for streaming responses, file uploads)
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

echo "✅ Nginx configuration created"

# Enable the site (create symlink)
echo "🔗 Enabling site..."
sudo ln -sf /etc/nginx/sites-available/researcher /etc/nginx/sites-enabled/researcher

# Disable default site if it exists
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "🗑️  Disabling default site..."
    sudo rm /etc/nginx/sites-enabled/default
fi

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Configuration test passed"
else
    echo "❌ Configuration test failed! Fix errors above."
    exit 1
fi

# Start and enable Nginx
echo "🔄 Starting Nginx service..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify Nginx is running
if sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx failed to start"
    exit 1
fi

echo ""
echo "=========================================="
echo "✨ Nginx setup complete!"
echo "=========================================="
echo ""
echo "📍 Your app should now be accessible at:"
echo "   http://34.136.118.181/"
echo ""
echo "📋 Useful commands:"
echo "   sudo systemctl status nginx          # Check status"
echo "   sudo systemctl reload nginx          # Reload config"
echo "   sudo systemctl restart nginx         # Restart service"
echo "   sudo tail -f /var/log/nginx/researcher_access.log"
echo "   sudo tail -f /var/log/nginx/researcher_error.log"
echo ""
echo "⚠️  Make sure your Next.js app is running on port 5500!"
echo "   Example: npm start -- -p 5500"
echo ""
