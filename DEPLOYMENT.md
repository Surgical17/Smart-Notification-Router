# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- GitHub repository set up with GitHub Actions
- Domain name (optional, for production)

## Environment Variables

Create a `.env` file in the project root (or set in your deployment environment):

```env
# Database
DATABASE_URL=file:/app/data/db.sqlite

# Authentication (REQUIRED - change this!)
AUTH_SECRET=your-super-secret-key-change-this-in-production
AUTH_URL=https://your-domain.com

# Node Environment
NODE_ENV=production
```

### Generating AUTH_SECRET

```bash
# Generate a secure random secret
openssl rand -base64 32
```

## Docker Deployment

### Local Development

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The application will be available at `http://localhost:3000`

### Production Deployment

1. **Update docker-compose.yml**:
   - Set AUTH_SECRET environment variable
   - Update AUTH_URL to your domain
   - Configure volume mount for persistent data

2. **Build and Deploy**:
```bash
docker-compose up -d --build
```

3. **First-Time Setup**:
   - Navigate to `https://your-domain.com/register`
   - Create your admin account (only one user allowed)
   - After registration, the signup page will be disabled

## GitHub Actions (Automated Build)

### Setup

1. **Add secrets to GitHub repository**:
   - `DOCKERHUB_USERNAME` - Your Docker Hub username
   - `DOCKERHUB_TOKEN` - Docker Hub access token

2. **Create `.github/workflows/docker-build.yml`**:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main, master ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKERHUB_USERNAME }}/smartnotificationrouter
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Automated Deployment

After pushing to GitHub:
1. GitHub Actions automatically builds the Docker image
2. Image is pushed to Docker Hub
3. Pull the latest image on your server:

```bash
docker pull your-username/smartnotificationrouter:latest
docker-compose up -d
```

## Server Setup

### Nginx Reverse Proxy (Recommended)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Database Management

### Backup

```bash
# Create backup
docker-compose exec notification-router sh -c "cp /app/data/db.sqlite /app/data/backup-$(date +%Y%m%d).sqlite"

# Copy backup to host
docker cp notification-router:/app/data/backup-20260123.sqlite ./backups/
```

### Restore

```bash
# Stop container
docker-compose down

# Replace database
cp ./backups/backup-20260123.sqlite ./data/db.sqlite

# Start container
docker-compose up -d
```

## Health Checks

The application includes built-in health checks:

```bash
# Check if app is running
curl http://localhost:3000/api/health
```

## Monitoring

### Docker Logs

```bash
# View all logs
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# View specific service
docker-compose logs -f notification-router
```

### Application Logs

Logs are output to Docker stdout/stderr and can be viewed with:

```bash
docker logs notification-router --follow
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs notification-router

# Check if port 3000 is already in use
lsof -i :3000  # or: netstat -tulpn | grep 3000

# Rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

### Database locked error

```bash
# Stop container
docker-compose down

# Fix permissions
sudo chown -R 1001:1001 ./data

# Restart
docker-compose up -d
```

### Reset database

```bash
# Stop container
docker-compose down

# Remove database
rm ./data/db.sqlite

# Start container (will create new database)
docker-compose up -d

# Register first user again
```

## Security Best Practices

1. **Change AUTH_SECRET**: Never use the default secret
2. **Use HTTPS**: Always use SSL/TLS in production
3. **Firewall**: Only expose port 80/443 to the internet
4. **Regular Updates**: Keep Docker images updated
5. **Backup Database**: Regular automated backups
6. **Monitor Logs**: Set up log monitoring and alerts

## Scaling

### Horizontal Scaling

Not recommended - the application uses SQLite which doesn't support multiple writers. For scaling:

1. Migrate to PostgreSQL
2. Use load balancer
3. Share session storage (Redis)

### Vertical Scaling

- Increase Docker container resources
- Allocate more CPU/RAM

```yaml
services:
  notification-router:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

### Database Migration

Migrations run automatically on container start via:
```bash
npx prisma db push
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/smartnotificationrouter/issues
- Documentation: https://github.com/yourusername/smartnotificationrouter

