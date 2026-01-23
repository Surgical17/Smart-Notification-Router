# Smart Notification Router - New Features

This document describes the enhanced features added to make the notification router more dynamic and powerful.

## Table of Contents

1. [Configurable Match Mode](#configurable-match-mode)
2. [Multi-Webhook Correlation](#multi-webhook-correlation)
3. [Router-to-Router Communication](#router-to-router-communication)

---

## 1. Configurable Match Mode

### Overview

Each webhook can now be configured with a **match mode** that determines how rules are evaluated when multiple rules match the incoming webhook payload.

### Match Modes

#### `first_match` (Default)
- **Behavior**: Stops after the first rule that matches conditions
- **Use Case**: When you want only one action to trigger, prioritized by rule priority
- **Example**: Alert escalation where you want the highest priority matching rule to trigger

```json
{
  "matchMode": "first_match"
}
```

#### `all_matches`
- **Behavior**: Evaluates ALL rules and triggers every rule that matches
- **Use Case**: When you want multiple independent notifications for the same event
- **Example**: Server monitoring where you want to notify different teams through different channels

```json
{
  "matchMode": "all_matches"
}
```

### API Usage

#### Creating a Webhook with Match Mode

```bash
POST /api/webhooks
Content-Type: application/json

{
  "name": "Multi-Team Webhook",
  "description": "Sends to all matching teams",
  "matchMode": "all_matches",
  "enabled": true
}
```

#### Updating Match Mode

```bash
PATCH /api/webhooks/{webhookId}
Content-Type: application/json

{
  "matchMode": "first_match"
}
```

### How It Works

1. When a webhook receives a payload, it evaluates rules in **priority order** (highest to lowest)
2. In `first_match` mode:
   - Stops after the first matching rule
   - Executes that rule's actions
   - Respects debounce settings
3. In `all_matches` mode:
   - Continues evaluating all rules
   - Executes all matching rules' actions
   - Skips debounced rules but continues checking others
   - Returns comma-separated rule IDs in the response

### Example Use Cases

**First Match Mode:**
```
Priority 100: If severity == "critical" → Alert on-call engineer
Priority 50:  If severity == "high" → Alert team lead
Priority 10:  If severity == "medium" → Send to team channel

Input: { "severity": "high" }
Result: Only team lead is alerted (priority 50)
```

**All Matches Mode:**
```
Priority 100: If server == "prod" → Alert DevOps team
Priority 50:  If service == "api" → Alert Backend team
Priority 10:  If region == "us-east" → Alert Regional team

Input: { "server": "prod", "service": "api", "region": "us-east" }
Result: All three teams are alerted
```

---

## 2. Multi-Webhook Correlation

### Overview

**Correlation rules** allow you to trigger actions when multiple webhooks are received from different sources within a specified time window. This is perfect for scenarios like:

- Waiting for confirmations from multiple systems
- Detecting coordinated events across services
- Multi-step workflow tracking

### Core Concepts

#### Correlation Rule
A rule that defines:
- **Source Webhook**: The first webhook that initiates the correlation
- **Target Webhook**: The second webhook to wait for
- **Time Window**: How long to wait for the target webhook (in milliseconds)
- **Actions**: What to do when both webhooks are received
- **Timeout Actions** (optional): What to do if the target webhook never arrives

#### Correlation State
An active tracking record created when the source webhook is received. It:
- Stores the source webhook payload
- Waits for the target webhook within the time window
- Tracks status: `waiting`, `completed`, or `timeout`

### API Usage

#### Create a Correlation Rule

```bash
POST /api/correlations
Content-Type: application/json

{
  "name": "Server A + Server B Sync Check",
  "description": "Alert if both servers report online within 5 minutes",
  "sourceWebhookId": "webhook-server-a-id",
  "targetWebhookId": "webhook-server-b-id",
  "timeWindowMs": 300000,
  "actions": {
    "channelIds": ["slack-channel-id"],
    "messageTemplate": "✅ Both servers are synchronized!\\n\\nServer A: {{source.server}}\\nServer B: {{target.server}}\\nTime elapsed: {{_correlation.timeElapsed}}ms",
    "titleTemplate": "Sync Successful",
    "priority": "normal"
  },
  "timeoutActions": {
    "channelIds": ["slack-channel-id"],
    "messageTemplate": "⚠️ Server B did not respond within 5 minutes!\\n\\nServer A: {{source.server}}\\nExpected: {{_correlation.expectedTargetWebhookId}}",
    "titleTemplate": "Sync Timeout",
    "priority": "high"
  },
  "enabled": true
}
```

#### List Correlation Rules

```bash
GET /api/correlations
```

#### Get Correlation Rule Details

```bash
GET /api/correlations/{correlationId}
```

#### Update Correlation Rule

```bash
PUT /api/correlations/{correlationId}
Content-Type: application/json

{
  "timeWindowMs": 600000,
  "enabled": false
}
```

#### Delete Correlation Rule

```bash
DELETE /api/correlations/{correlationId}
```

#### View Correlation States

```bash
GET /api/correlations/{correlationId}/states?status=waiting&limit=50&offset=0
```

### Payload Structure for Correlation Actions

When a correlation completes (or times out), the action receives a special payload structure:

#### Successful Correlation

```json
{
  "source": {
    // Full payload from source webhook
  },
  "target": {
    // Full payload from target webhook
  },
  "_correlation": {
    "ruleId": "correlation-rule-id",
    "ruleName": "Server A + Server B Sync Check",
    "sourceReceivedAt": "2026-01-23T10:00:00.000Z",
    "targetReceivedAt": "2026-01-23T10:02:30.000Z",
    "timeElapsed": 150000
  }
}
```

#### Timeout Correlation

```json
{
  "source": {
    // Full payload from source webhook
  },
  "_correlation": {
    "ruleId": "correlation-rule-id",
    "ruleName": "Server A + Server B Sync Check",
    "sourceReceivedAt": "2026-01-23T10:00:00.000Z",
    "timeoutAt": "2026-01-23T10:05:00.000Z",
    "expectedTargetWebhookId": "webhook-server-b-id"
  }
}
```

### Example Use Cases

#### 1. Deployment Confirmation

```
Scenario: Deploy to staging, wait for health check
- Source: Deployment webhook from CI/CD
- Target: Health check webhook from monitoring
- Window: 10 minutes
- Action: Notify team that deployment is healthy
- Timeout: Alert team that health check failed
```

#### 2. Multi-Server Coordination

```
Scenario: Primary and backup servers must both come online
- Source: Primary server online webhook
- Target: Backup server online webhook
- Window: 5 minutes
- Action: Notify that cluster is fully operational
- Timeout: Alert that backup server is not responding
```

#### 3. Payment Processing

```
Scenario: Payment initiated, wait for payment gateway confirmation
- Source: Payment request webhook
- Target: Payment confirmation webhook
- Window: 2 minutes
- Action: Send receipt to customer
- Timeout: Alert team of payment timeout
```

### How It Works

1. **Source Webhook Received**:
   - Correlation engine checks for any correlation rules with this webhook as the source
   - Creates a `CorrelationState` record with status `waiting`
   - Sets expiration time based on `timeWindowMs`

2. **Target Webhook Received**:
   - Correlation engine checks for any `waiting` correlations expecting this webhook
   - Updates the correlation state to `completed`
   - Triggers the correlation actions with combined payload

3. **Timeout Handling**:
   - Background cleanup process checks for expired correlations
   - Changes status from `waiting` to `timeout`
   - Triggers timeout actions if configured

4. **Automatic Cleanup**:
   - Expired correlations are automatically cleaned up
   - Old correlation states can be archived or deleted

---

## 3. Router-to-Router Communication

### Overview

The existing **webhook notification channel** enables you to chain multiple notification routers together, creating a distributed notification network.

### Use Cases

1. **Geographic Distribution**: Forward notifications to regional routers
2. **Service Segregation**: Route notifications between different service domains
3. **Escalation Chains**: Forward unhandled notifications to higher-tier routers
4. **Load Distribution**: Spread notification processing across multiple instances

### Setting Up Router Chaining

#### Step 1: Create a Webhook Channel

On the **sending router**, create a webhook notification channel pointing to the **receiving router**:

```bash
POST /api/channels
Content-Type: application/json

{
  "name": "Regional Router - EU",
  "type": "webhook",
  "config": {
    "url": "https://eu-router.example.com/api/webhook/abc123xyz",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer secret-token",
      "X-Source-Router": "us-central"
    }
  },
  "enabled": true
}
```

#### Step 2: Create a Rule to Forward

On the **sending router**, create a rule that forwards matching notifications:

```bash
POST /api/webhooks/{webhookId}/rules
Content-Type: application/json

{
  "name": "Forward EU Traffic",
  "conditions": {
    "logic": "AND",
    "conditions": [
      {
        "field": "region",
        "operator": "equals",
        "value": "eu"
      }
    ]
  },
  "actions": {
    "channelIds": ["webhook-channel-eu-id"],
    "messageTemplate": "{{originalPayload}}",
    "priority": "normal"
  },
  "enabled": true
}
```

#### Step 3: Receive on Target Router

The **receiving router** processes the forwarded webhook like any other webhook:
- Evaluates its own rules
- Can forward to additional routers
- Can apply region-specific logic

### Advanced Patterns

#### Fan-Out Pattern

One router distributes to multiple downstream routers:

```
                    ┌─────────────┐
                    │   Main      │
                    │   Router    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐   ┌────▼───┐   ┌────▼───┐
         │ Region │   │ Region │   │ Region │
         │  US    │   │  EU    │   │  APAC  │
         └────────┘   └────────┘   └────────┘
```

#### Escalation Chain

Unhandled notifications escalate through tiers:

```
┌─────────┐   Timeout   ┌─────────┐   Timeout   ┌─────────┐
│ Tier 1  │────────────>│ Tier 2  │────────────>│ Tier 3  │
│ Router  │             │ Router  │             │ Router  │
└─────────┘             └─────────┘             └─────────┘
```

#### Aggregation Pattern

Multiple routers forward to a central aggregator:

```
┌─────────┐
│ Service │───┐
│    A    │   │
└─────────┘   │
              │    ┌─────────────┐
┌─────────┐   │    │  Central    │
│ Service │───┼───>│ Aggregator  │
│    B    │   │    │   Router    │
└─────────┘   │    └─────────────┘
              │
┌─────────┐   │
│ Service │───┘
│    C    │
└─────────┘
```

### Preventing Infinite Loops

When chaining routers, prevent infinite loops by:

1. **Adding Source Headers**:
   ```json
   {
     "headers": {
       "X-Source-Router": "router-a",
       "X-Hop-Count": "1"
     }
   }
   ```

2. **Checking Headers in Conditions**:
   ```json
   {
     "logic": "AND",
     "conditions": [
       {
         "field": "_metadata.sourceIp",
         "operator": "not_equals",
         "value": "10.0.1.100"
       }
     ]
   }
   ```

3. **Using Hop Limits**:
   - Track hop count in forwarded payloads
   - Reject notifications exceeding a hop limit

### Example: Complete Router Chain Setup

#### Router A (Source)

```bash
# Create webhook channel to Router B
POST /api/channels
{
  "name": "Forward to Router B",
  "type": "webhook",
  "config": {
    "url": "https://router-b.example.com/api/webhook/xyz789",
    "method": "POST",
    "headers": {
      "X-Source": "router-a",
      "X-Hop": "1"
    }
  }
}

# Create rule to forward high-priority alerts
POST /api/webhooks/{webhookId}/rules
{
  "name": "Forward High Priority",
  "conditions": {
    "logic": "AND",
    "conditions": [
      {
        "field": "priority",
        "operator": "equals",
        "value": "high"
      },
      {
        "field": "_metadata.sourceIp",
        "operator": "not_equals",
        "value": "192.168.1.50"
      }
    ]
  },
  "actions": {
    "channelIds": ["webhook-channel-b"],
    "messageTemplate": "{{originalMessage}}",
    "priority": "high"
  }
}
```

#### Router B (Receiver)

Router B receives the forwarded webhook and can:
- Process it with its own rules
- Forward to Router C if needed
- Apply local notification channels

---

## Migration Guide

### Updating Existing Webhooks

Existing webhooks will automatically use `first_match` mode (backward compatible).

To enable `all_matches` mode:

```bash
PATCH /api/webhooks/{webhookId}
{
  "matchMode": "all_matches"
}
```

### Database Migration

Run the Prisma migration to add the new fields:

```bash
npx prisma migrate dev --name add_correlation_and_match_mode
```

This will:
- Add `matchMode` field to Webhook model
- Create `CorrelationRule` model
- Create `CorrelationState` model

### Testing Correlation Rules

1. Create two webhooks (source and target)
2. Create a correlation rule linking them
3. Send a payload to the source webhook
4. Check correlation states: `GET /api/correlations/{id}/states`
5. Send a payload to the target webhook within the time window
6. Verify the correlation action was triggered

---

## API Reference Summary

### Webhooks
- `GET /api/webhooks` - List webhooks
- `POST /api/webhooks` - Create webhook (include `matchMode`)
- `GET /api/webhooks/{id}` - Get webhook
- `PATCH /api/webhooks/{id}` - Update webhook (include `matchMode`)
- `DELETE /api/webhooks/{id}` - Delete webhook

### Correlation Rules
- `GET /api/correlations` - List correlation rules
- `POST /api/correlations` - Create correlation rule
- `GET /api/correlations/{id}` - Get correlation rule
- `PUT /api/correlations/{id}` - Update correlation rule
- `DELETE /api/correlations/{id}` - Delete correlation rule
- `GET /api/correlations/{id}/states` - Get correlation states

### Notification Channels
- `POST /api/channels` - Create channel (type: `webhook` for router chaining)

---

## Best Practices

### Match Mode
- Use `first_match` for escalation scenarios
- Use `all_matches` for multi-team notifications
- Always set clear rule priorities in `first_match` mode

### Correlation Rules
- Keep time windows reasonable (1-10 minutes)
- Always configure timeout actions for production systems
- Monitor correlation states to detect issues
- Use descriptive names for correlation rules

### Router Chaining
- Include source identifiers in forwarded webhooks
- Implement hop count limits to prevent infinite loops
- Use authentication headers between routers
- Monitor forwarding latency and failure rates

---

## Troubleshooting

### Correlation Not Triggering

**Check:**
1. Both webhooks are enabled
2. Correlation rule is enabled
3. Time window is sufficient
4. Source webhook was received first
5. Check correlation states for errors

### Multiple Rules Firing in first_match Mode

**Cause:** Webhook is set to `all_matches` mode

**Solution:**
```bash
PATCH /api/webhooks/{id}
{
  "matchMode": "first_match"
}
```

### Router Chain Not Working

**Check:**
1. Target webhook URL is correct
2. Target webhook is enabled
3. Network connectivity between routers
4. Authentication headers are correct
5. Check webhook logs for errors

---

## Support

For issues or questions:
1. Check webhook logs: `GET /api/webhooks/{id}/logs`
2. Check correlation states: `GET /api/correlations/{id}/states`
3. Review rule conditions and priorities
4. Test with simple payloads first
