# Changelog

All notable changes to this project will be documented in this file.

## [0.6.3] - 2026-01-26

### Fixed - TypeScript Build Errors

#### 🔧 Type Safety Improvements
- Resolved all implicit `any` type errors that prevented production builds under strict type checking
- Added explicit type annotations to array method callbacks (`.map()`, `.filter()`, `.reduce()`) across multiple files
- Exported `NotificationResult` interface from notification dispatcher for external use
- Replaced `any` types in field correlation engine with proper Prisma-inferred types
- Added type cast for correlation state status field to match union type definition
- Added local interfaces (`RecentLog`, `WebhookLog`, etc.) for improved component type safety

**Files Modified:**
- `src/lib/correlation-engine.ts` - Fixed reduce callback types and status union type cast
- `src/lib/field-correlation-engine.ts` - Replaced `any` with Prisma-inferred types
- `src/lib/notification-dispatcher.ts` - Exported `NotificationResult` interface
- `src/app/(dashboard)/dashboard/page.tsx` - Added `RecentLog` interface
- `src/app/(dashboard)/dashboard/channels/page.tsx` - Added `Channel` type annotations
- `src/app/(dashboard)/dashboard/logs/page.tsx` - Added `WebhookLog` type annotation
- `src/app/(dashboard)/dashboard/webhooks/[id]/page.tsx` - Added `Rule` and `CorrelationRule` types
- `src/app/api/webhook/[uniqueUrl]/route.ts` - Added `NotificationResult` import and types
- `src/components/rules/unified-rule-builder.tsx` - Added type guards and explicit types
- `src/components/rules/rule-builder.tsx` - Added type guards and explicit types

### Technical Details

#### TypeScript Patterns Applied
- Used type inference from Prisma: `type FieldCorrelationRule = NonNullable<Awaited<ReturnType<typeof prisma.fieldCorrelationRule.findFirst>>>`
- Type guards with predicates: `(c: Condition | ConditionGroup): c is Condition => "field" in c`
- Explicit reduce callback typing: `(acc: Record<string, number>, item: { status: string; _count: number }) => {...}`
- Union type casting for Prisma string fields: `status: s.status as "waiting" | "completed" | "timeout"`

#### Build Compatibility
- Compatible with Next.js 16.1.2 (Turbopack)
- Prisma 6.19.2
- Full TypeScript strict mode compliance

### Breaking Changes
- None! All changes are internal type improvements

---

## [0.52.0] - 2026-01-23

### Added - Field-Based Correlation System

#### 🔗 Field-Based Correlation Rules
- New correlation type that tracks notifications within the SAME webhook based on field values
- Created `FieldCorrelationRule` model for defining field-based correlations
- Created `FieldCorrelationState` model for tracking active field correlations
- Built field correlation engine (`src/lib/field-correlation-engine.ts`) with:
  - Track notifications by field value (e.g., "server" field with values "server-a", "server-b")
  - Wait for all expected field values within a time window
  - Trigger success actions when all values received
  - Trigger timeout actions when time expires before all values arrive
  - Automatic cleanup of expired correlation states
- Added correlation rule API endpoints:
  - `GET /api/webhooks/{id}/correlation-rules` - List correlation rules for a webhook
  - `POST /api/webhooks/{id}/correlation-rules` - Create correlation rule
  - `GET /api/correlation-rules/{id}` - Get correlation rule details
  - `PATCH /api/correlation-rules/{id}` - Update correlation rule
  - `DELETE /api/correlation-rules/{id}` - Delete correlation rule
- Integrated field correlation processing into webhook receiver
- Special variables available in correlation actions:
  - `{{_correlation.sources}}` - List of sources that reported
  - `{{_correlation.received}}` - Field values received
  - `{{_correlation.missing}}` - Field values missing (timeout only)
  - `{{_correlation.timeElapsed}}` - Time elapsed since first notification

#### 🎨 Complete UI for Field Correlation
- Added "Correlation" tab to webhook detail page
- Created comprehensive correlation rule builder component with:
  - Field selection (which field to correlate on)
  - Expected values configuration (which values to wait for)
  - Time window configuration (minutes)
  - Match conditions (apply to all notifications)
  - Success action configuration (channels, message templates, priority)
  - Optional timeout action configuration
  - Priority and debounce settings
- Visual indicators for correlation rule status
- Edit and delete functionality for correlation rules
- Empty state with helpful prompts

#### 🌐 Smart Router Channel Type
- Added explicit "Smart Router" channel type for router-to-router communication
- Dedicated icon (Network) and configuration UI
- Validation for router webhook URLs
- Dispatches notifications as proper webhook payloads

**Files Created:**
- `src/lib/field-correlation-engine.ts` - Field correlation processing logic
- `src/components/rules/correlation-rule-builder.tsx` - UI component for creating/editing correlation rules
- `src/app/api/webhooks/[id]/correlation-rules/route.ts` - List and create endpoints
- `src/app/api/correlation-rules/[id]/route.ts` - CRUD endpoints for individual rules

**Files Modified:**
- `prisma/schema.prisma` - Added FieldCorrelationRule and FieldCorrelationState models
- `src/app/api/webhook/[uniqueUrl]/route.ts` - Added field correlation processing
- `src/app/(dashboard)/dashboard/webhooks/[id]/page.tsx` - Added correlation tab and UI
- `src/app/(dashboard)/dashboard/channels/page.tsx` - Added smart_router channel type
- `src/lib/validations/channel.ts` - Added smart_router validation
- `src/lib/notification-dispatcher.ts` - Added smart_router dispatch handling
- `package.json` - Updated version to 0.52.0

### Technical Details

#### Database Schema Changes
```sql
-- New tables
CREATE TABLE FieldCorrelationRule (
  id TEXT PRIMARY KEY,
  webhookId TEXT NOT NULL,
  name TEXT NOT NULL,
  correlationField TEXT NOT NULL,
  expectedValues TEXT NOT NULL,
  timeWindowMs INTEGER NOT NULL,
  matchConditions TEXT NOT NULL,
  successActions TEXT NOT NULL,
  timeoutActions TEXT,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  debounceMs INTEGER DEFAULT 0,
  ruleType TEXT DEFAULT 'correlation',
  lastTriggered DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhookId) REFERENCES Webhook(id) ON DELETE CASCADE
);

CREATE TABLE FieldCorrelationState (
  id TEXT PRIMARY KEY,
  correlationRuleId TEXT NOT NULL,
  correlationKey TEXT NOT NULL,
  receivedValues TEXT NOT NULL,
  pendingValues TEXT NOT NULL,
  firstReceivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL,
  status TEXT DEFAULT 'waiting',
  actionTriggered BOOLEAN DEFAULT false,
  actionResult TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (correlationRuleId) REFERENCES FieldCorrelationRule(id) ON DELETE CASCADE
);

CREATE INDEX idx_field_correlation_state ON FieldCorrelationState(correlationRuleId, status, expiresAt);
CREATE INDEX idx_field_correlation_key ON FieldCorrelationState(correlationKey, status);
```

#### API Endpoints Added
- `GET /api/webhooks/{id}/correlation-rules`
- `POST /api/webhooks/{id}/correlation-rules`
- `GET /api/correlation-rules/{id}`
- `PATCH /api/correlation-rules/{id}`
- `DELETE /api/correlation-rules/{id}`

#### Breaking Changes
- None! All changes are backward compatible

### Migration Required

```bash
# Run this to apply database changes
npx prisma generate
npx prisma db push
```

### Use Cases

**Server Sync Monitoring:**
- Track when multiple servers report the same event
- Example: Both "server-a" and "server-b" report "System1 is down"
- If both report within 5 minutes → confirm outage
- If timeout → possible network partition or DNS issue

**Multi-Source Verification:**
- Wait for confirmation from multiple monitoring sources
- Reduce false positives from single-source alerts
- Aggregate data from distributed sensors

### Dependencies
No new dependencies added - all features built with existing stack.

---

## [2.0.0] - 2026-01-23

### Added - Major Feature Release

#### 🎯 Configurable Match Modes
- Added `matchMode` field to Webhook model
  - `first_match`: Stop after first matching rule (default, backward compatible)
  - `all_matches`: Evaluate and trigger all matching rules
- Updated webhook API endpoints to support match mode configuration
- Updated webhook route handler to respect match mode setting
- Multiple rules can now trigger in a single webhook call (when using `all_matches`)
- Match mode is configurable per webhook via API or UI

**Files Modified:**
- `prisma/schema.prisma` - Added matchMode field to Webhook model
- `src/app/api/webhook/[uniqueUrl]/route.ts` - Updated rule evaluation logic
- `src/lib/validations/webhook.ts` - Added matchMode to schemas

#### 🔗 Multi-Webhook Correlation System
- Created `CorrelationRule` model for defining webhook correlations
- Created `CorrelationState` model for tracking active correlations
- Built correlation engine (`src/lib/correlation-engine.ts`) with:
  - Source webhook tracking (initiates correlation)
  - Target webhook tracking (completes correlation)
  - Time window support (1s to 24 hours)
  - Automatic timeout handling
  - Configurable timeout actions
- Added correlation rule API endpoints:
  - `GET /api/correlations` - List all correlation rules
  - `POST /api/correlations` - Create correlation rule
  - `GET /api/correlations/{id}` - Get correlation details
  - `PUT /api/correlations/{id}` - Update correlation rule
  - `DELETE /api/correlations/{id}` - Delete correlation rule
  - `GET /api/correlations/{id}/states` - View correlation states
- Integrated correlation processing into webhook receiver
- Special payload structure for correlation actions:
  - `source` - First webhook payload
  - `target` - Second webhook payload
  - `_correlation` - Metadata (time elapsed, rule info, etc.)

**Files Created:**
- `src/lib/correlation-engine.ts` - Correlation processing logic
- `src/lib/validations/correlation.ts` - Validation schemas
- `src/app/api/correlations/route.ts` - List and create endpoints
- `src/app/api/correlations/[id]/route.ts` - CRUD endpoints
- `src/app/api/correlations/[id]/states/route.ts` - States endpoint

**Files Modified:**
- `prisma/schema.prisma` - Added CorrelationRule and CorrelationState models
- `src/app/api/webhook/[uniqueUrl]/route.ts` - Added correlation processing

#### 🌐 Enhanced Router-to-Router Communication
- Documented existing webhook channel type for router chaining
- Added examples for common patterns:
  - Fan-out distribution
  - Escalation chains
  - Aggregation patterns
- Provided best practices for preventing infinite loops
- Added header-based source tracking recommendations

#### 📚 Documentation
- Created `FEATURES.md` - Comprehensive feature documentation
  - Detailed explanation of match modes
  - Multi-webhook correlation guide
  - Router chaining patterns and examples
  - API reference
  - Best practices and troubleshooting
- Created `SETUP_GUIDE.md` - Step-by-step setup instructions
  - Migration guide
  - Testing procedures for each feature
  - Production deployment checklist
  - Monitoring recommendations
- Updated `README.md` - Added new features section with links

### Technical Details

#### Database Schema Changes
```sql
-- Webhook table
ALTER TABLE Webhook ADD COLUMN matchMode TEXT DEFAULT 'first_match';

-- New tables
CREATE TABLE CorrelationRule (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  sourceWebhookId TEXT NOT NULL,
  targetWebhookId TEXT NOT NULL,
  timeWindowMs INTEGER DEFAULT 300000,
  actions TEXT NOT NULL,
  timeoutActions TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (sourceWebhookId) REFERENCES Webhook(id) ON DELETE CASCADE,
  FOREIGN KEY (targetWebhookId) REFERENCES Webhook(id) ON DELETE CASCADE
);

CREATE TABLE CorrelationState (
  id TEXT PRIMARY KEY,
  correlationRuleId TEXT NOT NULL,
  sourceWebhookId TEXT NOT NULL,
  sourcePayload TEXT NOT NULL,
  sourceReceivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  targetWebhookId TEXT,
  targetPayload TEXT,
  targetReceivedAt DATETIME,
  status TEXT DEFAULT 'waiting',
  expiresAt DATETIME NOT NULL,
  actionTriggered BOOLEAN DEFAULT false,
  actionResult TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (correlationRuleId) REFERENCES CorrelationRule(id) ON DELETE CASCADE
);

CREATE INDEX idx_correlation_state ON CorrelationState(correlationRuleId, status, expiresAt);
```

#### API Endpoints Added
- `GET /api/correlations`
- `POST /api/correlations`
- `GET /api/correlations/{id}`
- `PUT /api/correlations/{id}`
- `DELETE /api/correlations/{id}`
- `GET /api/correlations/{id}/states`

#### Breaking Changes
- None! All changes are backward compatible
- Existing webhooks default to `first_match` mode
- Existing functionality remains unchanged

### Migration Required

```bash
# Run this to apply database changes
npx prisma generate
npx prisma migrate dev --name add_correlation_and_match_mode
```

### Dependencies
No new dependencies added - all features built with existing stack.

---

## [1.0.0] - Initial Release

### Added
- Webhook management system
- Conditional rule engine with AND/OR logic
- Multi-channel notification support
- Apprise integration
- User authentication with Auth.js
- Dashboard interface
- Debouncing system
- Server state tracking
- Docker deployment support
