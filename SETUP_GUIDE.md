# Setup Guide for New Features

This guide will help you set up and test the new dynamic features in your Smart Notification Router.

## Prerequisites

- Node.js and npm installed
- Existing Smart Notification Router installation
- Database backup (recommended before migration)

## Step 1: Database Migration

The new features require database schema changes. Follow these steps:

### 1.1 Generate and Apply Migration

```bash
# Navigate to project directory
cd smartnotificationrouter

# Generate Prisma client with new schema
npx prisma generate

# Create migration (in development)
npx prisma migrate dev --name add_correlation_and_match_mode

# OR apply migration (in production)
npx prisma migrate deploy
```

### 1.2 Verify Migration

```bash
# Check migration status
npx prisma migrate status

# Open Prisma Studio to verify new tables
npx prisma studio
```

You should see:
- `matchMode` field in `Webhook` table
- New `CorrelationRule` table
- New `CorrelationState` table

## Step 2: Testing Match Modes

### 2.1 Test First Match Mode (Default)

This is the existing behavior - backward compatible.

**Create a test webhook:**

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "name": "First Match Test",
    "matchMode": "first_match"
  }'
```

**Create multiple rules with different priorities:**

```bash
# High priority rule
curl -X POST http://localhost:3000/api/webhooks/{webhookId}/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Priority Rule",
    "priority": 100,
    "conditions": {
      "logic": "AND",
      "conditions": [
        {
          "field": "severity",
          "operator": "equals",
          "value": "critical"
        }
      ]
    },
    "actions": {
      "channelIds": ["your-channel-id"],
      "messageTemplate": "CRITICAL: {{message}}",
      "priority": "urgent"
    }
  }'

# Low priority rule
curl -X POST http://localhost:3000/api/webhooks/{webhookId}/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Low Priority Rule",
    "priority": 10,
    "conditions": {
      "logic": "AND",
      "conditions": [
        {
          "field": "severity",
          "operator": "equals",
          "value": "critical"
        }
      ]
    },
    "actions": {
      "channelIds": ["your-channel-id"],
      "messageTemplate": "Alert: {{message}}",
      "priority": "normal"
    }
  }'
```

**Test it:**

```bash
# Send test payload
curl -X POST http://localhost:3000/api/webhook/{uniqueUrl} \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "critical",
    "message": "Test alert"
  }'
```

**Expected:** Only the high priority rule triggers (first match wins).

### 2.2 Test All Matches Mode

**Update webhook to all_matches:**

```bash
curl -X PATCH http://localhost:3000/api/webhooks/{webhookId} \
  -H "Content-Type: application/json" \
  -d '{
    "matchMode": "all_matches"
  }'
```

**Send the same test payload:**

```bash
curl -X POST http://localhost:3000/api/webhook/{uniqueUrl} \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "critical",
    "message": "Test alert"
  }'
```

**Expected:** Both rules trigger (all matching rules fire).

## Step 3: Testing Multi-Webhook Correlation

### 3.1 Create Two Webhooks

**Webhook A (Source):**

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Server A Status"
  }'
```

**Webhook B (Target):**

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Server B Status"
  }'
```

**Save both webhook IDs and unique URLs for next steps.**

### 3.2 Create a Notification Channel

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Slack Channel",
    "type": "slack",
    "config": {
      "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    }
  }'
```

**Save the channel ID.**

### 3.3 Create a Correlation Rule

```bash
curl -X POST http://localhost:3000/api/correlations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Server Sync Check",
    "description": "Alert when both servers come online within 5 minutes",
    "sourceWebhookId": "webhook-a-id",
    "targetWebhookId": "webhook-b-id",
    "timeWindowMs": 300000,
    "actions": {
      "channelIds": ["your-channel-id"],
      "messageTemplate": "✅ Both servers synchronized!\n\nServer A: {{source.server}}\nServer B: {{target.server}}\nTime elapsed: {{_correlation.timeElapsed}}ms",
      "titleTemplate": "Servers Synchronized",
      "priority": "normal"
    },
    "timeoutActions": {
      "channelIds": ["your-channel-id"],
      "messageTemplate": "⚠️ Server B did not respond within 5 minutes!\n\nServer A: {{source.server}}",
      "titleTemplate": "Sync Timeout",
      "priority": "high"
    },
    "enabled": true
  }'
```

### 3.4 Test the Correlation

**Step 1: Send payload to Server A (source):**

```bash
curl -X POST http://localhost:3000/api/webhook/{webhook-a-url} \
  -H "Content-Type: application/json" \
  -d '{
    "server": "server-a",
    "status": "online",
    "timestamp": "2026-01-23T10:00:00Z"
  }'
```

**Step 2: Check correlation state:**

```bash
curl -X GET http://localhost:3000/api/correlations/{correlationId}/states
```

**Expected:** You should see a correlation state with `status: "waiting"`.

**Step 3: Send payload to Server B (target) within 5 minutes:**

```bash
curl -X POST http://localhost:3000/api/webhook/{webhook-b-url} \
  -H "Content-Type: application/json" \
  -d '{
    "server": "server-b",
    "status": "online",
    "timestamp": "2026-01-23T10:02:00Z"
  }'
```

**Expected:**
- Correlation state status changes to `"completed"`
- Success notification is sent to your channel
- Notification includes data from both webhooks

### 3.5 Test Timeout Behavior

**Step 1: Send payload to Server A:**

```bash
curl -X POST http://localhost:3000/api/webhook/{webhook-a-url} \
  -H "Content-Type: application/json" \
  -d '{
    "server": "server-a",
    "status": "online"
  }'
```

**Step 2: Wait 6+ minutes (beyond the 5-minute window)**

**Expected:**
- Correlation state status changes to `"timeout"`
- Timeout notification is sent to your channel

## Step 4: Testing Router-to-Router Communication

### 4.1 Setup Two Router Instances

For testing, you can use:
- Two separate deployments
- One production and one local instance
- Same instance with different webhooks (for testing only)

### 4.2 Configure Router A to Forward

**On Router A, create a webhook channel pointing to Router B:**

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Forward to Router B",
    "type": "webhook",
    "config": {
      "url": "https://router-b.example.com/api/webhook/{router-b-webhook-url}",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "X-Source-Router": "router-a"
      }
    }
  }'
```

**Create a forwarding rule on Router A:**

```bash
curl -X POST http://localhost:3000/api/webhooks/{webhookId}/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Forward High Priority",
    "conditions": {
      "logic": "AND",
      "conditions": [
        {
          "field": "priority",
          "operator": "equals",
          "value": "high"
        }
      ]
    },
    "actions": {
      "channelIds": ["webhook-channel-to-router-b"],
      "messageTemplate": "{{_json}}",
      "priority": "high"
    }
  }'
```

### 4.3 Test the Chain

**Send a test payload to Router A:**

```bash
curl -X POST http://localhost:3000/api/webhook/{router-a-url} \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "high",
    "message": "Test forwarding",
    "source": "external-system"
  }'
```

**Expected:**
- Router A receives the webhook
- Router A evaluates the rule
- Router A forwards to Router B
- Router B receives and processes the webhook

**Verify on Router B:**

```bash
# Check Router B's webhook logs
curl -X GET https://router-b.example.com/api/webhooks/{webhookId}/logs
```

## Step 5: Common Issues and Solutions

### Migration Fails

**Error:** `Migration failed to apply`

**Solution:**
```bash
# Reset the database (CAUTION: This deletes data)
npx prisma migrate reset

# Or manually fix migration conflicts
npx prisma migrate resolve --rolled-back {migration-name}
```

### Correlation Not Triggering

**Issue:** Sent both webhooks but correlation didn't trigger

**Check:**
1. Verify both webhooks are enabled
2. Check correlation rule is enabled
3. Ensure target webhook was sent within time window
4. Check for errors in correlation states:
   ```bash
   curl -X GET http://localhost:3000/api/correlations/{id}/states
   ```

### Match Mode Not Working

**Issue:** All rules firing in first_match mode

**Check:**
```bash
# Verify webhook match mode
curl -X GET http://localhost:3000/api/webhooks/{webhookId}
# Look for "matchMode" field in response
```

**Fix:**
```bash
curl -X PATCH http://localhost:3000/api/webhooks/{webhookId} \
  -d '{"matchMode": "first_match"}'
```

### Router Chain Not Working

**Issue:** Forwarded webhook not received

**Check:**
1. Verify webhook channel URL is correct
2. Test URL directly:
   ```bash
   curl -X POST {target-router-url} \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```
3. Check Router A's logs for send errors
4. Check Router B's logs for received webhooks

## Step 6: Production Deployment

### 6.1 Pre-Deployment Checklist

- [ ] Database backup completed
- [ ] Migration tested in staging
- [ ] Existing webhooks tested post-migration
- [ ] New features tested in staging
- [ ] Documentation reviewed by team

### 6.2 Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm install

# 3. Run migration
npx prisma migrate deploy

# 4. Rebuild application
npm run build

# 5. Restart application
npm run start

# or with PM2
pm2 restart smartnotificationrouter
```

### 6.3 Post-Deployment Verification

```bash
# 1. Check application health
curl http://localhost:3000/api/health

# 2. Verify database schema
npx prisma studio

# 3. Test existing webhooks still work
# Send test payload to existing webhook

# 4. Check logs for errors
tail -f logs/application.log
```

## Step 7: Monitoring

### Key Metrics to Monitor

1. **Correlation States:**
   - Number of waiting correlations
   - Completion rate
   - Timeout rate

2. **Match Mode Performance:**
   - Rule evaluation time in all_matches mode
   - Number of rules triggered per webhook

3. **Router Chain Health:**
   - Forward success rate
   - Latency between routers
   - Failed forwards

### Monitoring Queries

```bash
# Count waiting correlations
curl -X GET http://localhost:3000/api/correlations/{id}/states?status=waiting

# Check webhook logs for errors
curl -X GET http://localhost:3000/api/webhooks/{id}/logs?status=failed

# Monitor correlation completion rate
# (Completed / Total) * 100
```

## Need Help?

- Review the [FEATURES.md](FEATURES.md) documentation
- Check application logs for detailed error messages
- Test with simple payloads before complex scenarios
- Use Prisma Studio to inspect database state: `npx prisma studio`

---

**Congratulations!** Your Smart Notification Router now has dynamic rule matching, multi-webhook correlation, and router-to-router communication capabilities.
