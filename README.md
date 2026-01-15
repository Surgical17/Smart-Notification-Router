# Smart Notification Router

A full-stack notification routing application that receives webhooks from monitoring systems, applies conditional logic rules, and sends notifications to external services via Apprise.

## Features

- **Webhook Management**: Create unique webhook endpoints to receive notifications from monitoring systems (Uptime Kuma, etc.)
- **Conditional Rule Engine**: Define complex routing rules with AND/OR logic, field comparisons, and server state tracking
- **Multi-Channel Notifications**: Support for Gotify, Telegram, Discord, Slack, Email (SMTP), and custom webhooks
- **Apprise Integration**: 90+ notification services supported via Apprise
- **Dashboard**: Real-time overview of webhooks, notifications, and logs
- **Debouncing**: Prevent notification spam with configurable debounce times
- **Docker Ready**: Easy deployment with Docker and Docker Compose

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: Auth.js v5
- **UI**: shadcn/ui + Tailwind CSS
- **Notifications**: Apprise

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

### Development Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd smartnotificationrouter
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) and create an account.

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

2. Or build manually:
```bash
docker build -t notification-router .
docker run -p 3000:3000 -v ./data:/app/data notification-router
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `AUTH_SECRET` | Secret for session encryption | (required) |
| `AUTH_URL` | Application URL | `http://localhost:3000` |

### Generating AUTH_SECRET

```bash
openssl rand -base64 32
```

## Usage

### 1. Create a Webhook

Navigate to **Webhooks** and create a new webhook. You'll get a unique URL like:
```
https://your-domain.com/api/webhook/abc123xyz
```

### 2. Add Notification Channels

Go to **Channels** and add your notification destinations:
- **Gotify**: Server URL + App Token
- **Telegram**: Bot Token + Chat ID
- **Discord**: Webhook URL
- **Slack**: Webhook URL
- **Email**: SMTP settings

### 3. Create Routing Rules

On the webhook detail page, create rules with:
- **Conditions**: Define when the rule triggers (e.g., `status equals "down"`)
- **Actions**: Select channels and customize the notification message
- **Debounce**: Prevent duplicate notifications

### Example Rule

```json
{
  "conditions": {
    "logic": "AND",
    "conditions": [
      {"field": "status", "operator": "equals", "value": "down"},
      {"field": "server", "operator": "contains", "value": "production"}
    ]
  },
  "actions": {
    "channelIds": ["channel-id-1", "channel-id-2"],
    "titleTemplate": "Server Alert",
    "messageTemplate": "Server {{server}} is {{status}}",
    "priority": "high"
  }
}
```

### 4. Configure Uptime Kuma

In Uptime Kuma, add a notification with:
- **Type**: Webhook
- **URL**: Your webhook URL
- **Method**: POST

## API Endpoints

### Webhook Receiver
```
POST /api/webhook/{uniqueUrl}
```
Receives JSON payloads and triggers rule evaluation.

### Health Check
```
GET /api/health
```
Returns application health status.

## Template Variables

Use `{{variable}}` syntax in message templates:
- `{{server}}` - Server name from payload
- `{{status}}` - Status value
- `{{_metadata.receivedAt}}` - Timestamp when webhook was received
- `{{nested.field.value}}` - Access nested payload fields

## Development

```bash
# Run development server
npm run dev

# View database (Prisma Studio)
npx prisma studio

# Run linting
npm run lint

# Build for production
npm run build
```

## License

MIT
