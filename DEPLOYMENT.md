# Deployment Guide: Researcher App to GCP VM

## VM Information
- **Internal IP**: 10.128.0.2
- **External IP**: 34.136.118.181
- **Zone**: us-central1-b
- **VM Name**: researcher

## Prerequisites

### On Your Local Machine (e:\Hackathon\researcher)
- The Next.js app source code
- Two setup scripts: `setup-nginx.sh` and `setup-nextjs-service.sh`
- SSH key for GCP VM access

### On GCP VM
- Ubuntu 20.04+ operating system
- SSH access enabled
- `sudo` privileges

---

## Step 1: Connect to Your GCP VM

```bash
# Using gcloud CLI
gcloud compute ssh researcher --zone=us-central1-b

# Or using SSH directly (if you have the key)
ssh -i /path/to/your/key ubuntu@34.136.118.181
```

---

## Step 2: Copy Application Code to VM

From your local machine:

```bash
# Option A: Using gcloud
gcloud compute scp --recurse . researcher:/home/ubuntu/Hackathon/researcher --zone=us-central1-b

# Option B: Using rsync (faster for large codebases)
rsync -avz -e 'ssh -i /path/to/your/key' . ubuntu@34.136.118.181:/home/ubuntu/Hackathon/researcher

# Option C: Using scp
scp -i /path/to/your/key -r . ubuntu@34.136.118.181:/home/ubuntu/Hackathon/researcher
```

---

## Step 3: Copy and Run Setup Scripts

SSH into the VM:

```bash
gcloud compute ssh researcher --zone=us-central1-b
```

From inside the VM:

```bash
# Copy setup scripts from your app directory (they should already be there)
cd ~/Hackathon/researcher

# Make scripts executable
chmod +x setup-nginx.sh setup-nextjs-service.sh

# Step 1: Install Node.js if not present
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Step 2: Set up and start Next.js service
sudo ./setup-nextjs-service.sh

# Step 3: Configure and start Nginx
sudo ./setup-nginx.sh
```

---

## Step 4: Update Environment Variables

If your app uses environment variables (database credentials, API keys, etc.):

```bash
# On the VM, create/update .env.local
nano ~/Hackathon/researcher/.env.local

# Add production environment variables:
# DATABASE_URL=postgresql://user:pass@db-host:5432/researcher
# OPENAI_API_KEY=sk-...
# NODE_ENV=production
# NEXT_PUBLIC_APP_URL=http://34.136.118.181

# Save and exit (Ctrl+X, Y, Enter)

# Restart the Next.js service to pick up new env vars
sudo systemctl restart researcher
```

---

## Step 5: Verify Everything is Running

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Next.js service status
sudo systemctl status researcher

# Test the reverse proxy
curl http://localhost:5500/           # Should work
curl http://127.0.0.1/                # Should also work (via Nginx)

# From your local machine
curl http://34.136.118.181/           # Should load your app
```

---

## Step 6: Monitor Logs

```bash
# Next.js app logs
sudo journalctl -u researcher -f

# Nginx access logs
sudo tail -f /var/log/nginx/researcher_access.log

# Nginx error logs
sudo tail -f /var/log/nginx/researcher_error.log
```

---

## Common Issues & Troubleshooting

### Issue: "502 Bad Gateway"
**Cause**: Next.js app not running on port 5500
**Solution**:
```bash
sudo systemctl status researcher
sudo journalctl -u researcher -n 50
# If the service failed to start, check the logs above and fix any errors
sudo systemctl restart researcher
```

### Issue: "Connection refused (111)"
**Cause**: Nginx can't reach localhost:5500
**Solution**:
```bash
# Verify Next.js is listening on port 5500
sudo lsof -i :5500

# If no output, Next.js isn't running. Start it:
sudo systemctl start researcher
```

### Issue: Port 80 Already in Use
**Cause**: Another service using port 80
**Solution**:
```bash
# Find what's using port 80
sudo lsof -i :80

# Stop the conflicting service or change Nginx port in /etc/nginx/sites-available/researcher
```

### Issue: "npm: not found"
**Cause**: Node.js not installed
**Solution**:
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

### Issue: "permission denied" when running scripts
**Solution**:
```bash
chmod +x setup-nginx.sh setup-nextjs-service.sh
sudo ./setup-nginx.sh
```

---

## Step 7: (Optional) Set Up HTTPS with Let's Encrypt

Once everything is working on HTTP, secure it with HTTPS:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get a certificate (requires your domain pointing to 34.136.118.181)
sudo certbot --nginx -d your-domain.com

# Certbot will automatically update Nginx config
# Auto-renewal is enabled by default

# Check renewal status
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

Then update your `.env.local`:
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Step 8: (Optional) Set Up Automatic Backups

```bash
# Create backup script at ~/backup-researcher.sh
cat > ~/backup-researcher.sh <<'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
APP_DIR="/home/ubuntu/Hackathon/researcher"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/researcher_$TIMESTAMP.tar.gz $APP_DIR

# Keep only last 7 backups
ls -t $BACKUP_DIR/researcher_*.tar.gz | tail -n +8 | xargs rm -f

echo "Backup created: $BACKUP_DIR/researcher_$TIMESTAMP.tar.gz"
BACKUP_EOF

chmod +x ~/backup-researcher.sh

# Schedule daily backups (add to crontab)
crontab -e
# Add this line: 0 2 * * * /home/ubuntu/backup-researcher.sh
```

---

## Next Steps

1. ✅ Deploy scripts and app to VM
2. ✅ Run setup scripts
3. ✅ Verify Nginx and Next.js are running
4. ✅ Test public URL: http://34.136.118.181/
5. ⏭️ Set up domain (optional)
6. ⏭️ Configure HTTPS (optional)
7. ⏭️ Set up monitoring/alerting (optional)

---

## Quick Reference: Essential Commands

```bash
# Connect to VM
gcloud compute ssh researcher --zone=us-central1-b

# Check services
sudo systemctl status nginx
sudo systemctl status researcher

# Restart services
sudo systemctl restart nginx
sudo systemctl restart researcher

# View logs
sudo journalctl -u researcher -f
sudo tail -f /var/log/nginx/researcher_error.log

# Check ports
sudo lsof -i :80
sudo lsof -i :5500

# Reload Nginx without downtime
sudo systemctl reload nginx

# Stop services
sudo systemctl stop nginx
sudo systemctl stop researcher
```

---

## Support

If you encounter issues:
1. Check logs: `sudo journalctl -u researcher -f`
2. Test Nginx config: `sudo nginx -t`
3. Verify ports: `sudo lsof -i :80` and `sudo lsof -i :5500`
4. Check disk space: `df -h`
5. Check memory: `free -h`

