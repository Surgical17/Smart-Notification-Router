<p align="center">
  <img src="public/SNR Logo.png" alt="Smart Notification Router" width="200" />
</p>

# Smart Notification Router

A powerful, self-hosted notification routing system built with Next.js 16, featuring intelligent rule-based routing, field correlation, and multi-channel delivery.

## ✨ Features

- **🔀 Intelligent Routing**: Dynamic rule-based notification routing with AND/OR logic
- **⏱️ Field Correlation**: Track and correlate notifications across multiple sources within time windows
- **📡 Multi-Channel Support**: Gotify, Discord, Slack, Telegram, Email, Apprise, and custom webhooks
- **🎯 Unified Rule System**:
  - Immediate rules for instant triggers
  - Correlation rules for multi-source verification
- **📊 Comprehensive Logging**: Track all webhook requests and rule triggers
- **🔐 Secure Authentication**: Single-user mode with Auth.js v5
- **🐳 Docker Ready**: Full Docker and Docker Compose support
- **⚡ High Performance**: Built on Next.js 16 with Turbopack

## 🚀 Quick Start

### Docker (Recommended)

#### Option 1: Pull from GitHub Container Registry

```bash
# Pull the latest image
docker pull ghcr.io/surgical17/smart-notification-router:main

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/prisma/dev.db \
  -e AUTH_SECRET=your-secret-key-here \
  -e AUTH_URL=http://localhost:3000 \
  -v smart-router-data:/app/prisma \
  ghcr.io/surgical17/smart-notification-router:main
```

#### Option 2: Docker Compose (with pre-built image)

```yaml
# docker-compose.yml
version: '3.8'
services:
  smart-notification-router:
    image: ghcr.io/surgical17/smart-notification-router:main
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/prisma/dev.db
      - AUTH_SECRET=your-secret-key-here
      - AUTH_URL=http://localhost:3000
    volumes:
      - smart-router-data:/app/prisma
    restart: unless-stopped

volumes:
  smart-router-data:
```

#### Option 3: Build from Source

```bash
# Clone the repository
git clone https://github.com/Surgical17/smart-notification-router.git
cd smart-notification-router

# Create environment file
cp .env.example .env
# Edit .env and set AUTH_SECRET (generate with: openssl rand -base64 32)

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at `http://localhost:3000`

### Local Development

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

## 📖 Documentation

- **[Setup Guide](./SETUP_GUIDE.md)** - Detailed setup instructions
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment with Docker and GitHub Actions
- **[Features](./FEATURES.md)** - Complete feature documentation
- **[Changelog](./CHANGELOG.md)** - Version history and changes

## 🔧 Configuration

### First-Time Setup

1. Navigate to `http://localhost:3000/register`
2. Create your admin account (only one user allowed)
3. Login and start creating webhooks and rules

### Environment Variables

```env
# Database
DATABASE_URL=file:./prisma/dev.db

# Authentication (REQUIRED)
AUTH_SECRET=your-secret-key-here
AUTH_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

## 🎯 Use Cases

### Server Monitoring
Receive alerts only when multiple monitoring systems confirm an issue:
- Nagios reports down → wait
- Zabbix confirms → wait
- Prometheus confirms → **ALERT!**

### Multi-Region Deployment Tracking
Track deployments across regions and alert when all complete:
- US-East deployed → wait
- EU-West deployed → wait
- AP-Southeast deployed → **SUCCESS!**

### Distributed System Health
Correlate health checks from multiple services:
- Database healthy → wait
- Cache healthy → wait
- API healthy → **ALL SYSTEMS GO!**

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (default), PostgreSQL compatible
- **Authentication**: Auth.js v5 (NextAuth)
- **Notifications**: Apprise CLI, Direct integrations
- **Deployment**: Docker, Docker Compose

## 📊 Architecture

```
Incoming Webhooks
    ↓
Rule Engine (Immediate Rules)
    ↓
Field Correlation Engine
    ↓
Notification Dispatcher
    ↓
Multi-Channel Delivery
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Notifications via [Apprise](https://github.com/caronc/apprise)

## 🐳 Docker Image

The official Docker image is automatically built and published via GitHub Actions on every push to `main`.

```bash
docker pull ghcr.io/surgical17/smart-notification-router:main
```

**Available tags:**
- `main` - Latest stable build from main branch
- `staging` - Development builds from staging branch

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on [GitHub](https://github.com/Surgical17/smart-notification-router/issues)
- Check the [documentation](./FEATURES.md)
---

**Version**: 0.7.0.2
**Status**: Production Ready
