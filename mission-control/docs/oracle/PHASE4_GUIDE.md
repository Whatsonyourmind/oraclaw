# ORACLE Phase 4: Real-time, Wearables & Integrations

This guide covers the features added in Phase 4 of the ORACLE System, including real-time synchronization, wearable device support, third-party integrations, offline capabilities, and security enhancements.

## Table of Contents

1. [Realtime Setup Guide](#realtime-setup-guide)
2. [Watch App Installation](#watch-app-installation)
3. [Integration Setup Guides](#integration-setup-guides)
4. [Offline Mode Documentation](#offline-mode-documentation)
5. [Security Best Practices](#security-best-practices)

---

## Realtime Setup Guide

ORACLE uses Supabase Realtime for live updates across all devices. This enables instant synchronization of signals, decisions, execution steps, and ghost actions.

### Enabling Realtime

Realtime is enabled at the database level. The following tables have realtime enabled:

- `oracle_signals`
- `oracle_decisions`
- `oracle_execution_steps`
- `oracle_ghost_actions`

### Channel Naming Convention

```
oracle:signals:{user_id}     - User's signal changes
oracle:decisions:{user_id}   - User's decision changes
oracle:steps:{user_id}       - User's execution step changes
oracle:ghost:{user_id}       - User's ghost action changes
oracle:presence:{decision_id} - Presence for collaborative decisions
```

### Using Realtime Hooks (Mobile)

```typescript
import { useOracleRealtime } from '@/hooks/useOracleRealtime';

function MyComponent() {
  const {
    signals,
    connectionStatus,
    isConnected
  } = useOracleRealtime();

  // signals will auto-update when changes occur
}
```

### Available Hooks

- `useSignalUpdates()` - Subscribe to new/updated signals
- `useDecisionUpdates()` - Subscribe to decision changes
- `useStepUpdates()` - Subscribe to execution step progress
- `useGhostActionUpdates()` - Subscribe to ghost action changes

### Connection Status Indicators

The connection status shows three states:
- 🟢 **Connected** - Real-time updates active
- 🟡 **Connecting** - Attempting to establish connection
- 🔴 **Disconnected** - Offline or connection lost

---

## Watch App Installation

### Apple Watch Setup

1. **Prerequisites**
   - iOS 15.0 or later
   - watchOS 8.0 or later
   - iPhone paired with Apple Watch

2. **Installation**
   - Open the Mission Control app on your iPhone
   - Go to Settings → Watch App
   - Tap "Install on Apple Watch"
   - Wait for installation to complete

3. **Complications**
   - Available for all watch faces
   - Shows: Current OODA phase, top signal, active plan progress
   - Refresh interval: 15 minutes minimum

4. **Features**
   - View top 3 signals
   - Approve/dismiss ghost actions
   - Mark steps complete
   - Quick scan trigger

### Wear OS Setup

1. **Prerequisites**
   - Android phone with Wear OS watch
   - Wear OS 3.0 or later

2. **Installation**
   - Open Google Play Store on your watch
   - Search for "Mission Control ORACLE"
   - Install the companion app

3. **Tiles**
   - ORACLE status tile
   - Signals summary tile
   - Current step tile

---

## Integration Setup Guides

### Google Calendar

1. Navigate to Settings → Integrations → Google Calendar
2. Tap "Connect"
3. Sign in with your Google account
4. Grant calendar access permissions
5. Select which calendars to sync

**Features:**
- Read calendar events for context
- Create events from execution plans
- Detect scheduling conflicts

### Apple Calendar (iOS Only)

1. Navigate to Settings → Integrations → Apple Calendar
2. Tap "Connect"
3. Grant calendar permissions when prompted
4. Select preferred calendars

**Features:**
- Access all device calendars
- Background refresh support
- Native EventKit integration

### Todoist

1. Navigate to Settings → Integrations → Todoist
2. Tap "Connect"
3. Authorize with your Todoist account
4. Map Todoist projects to ORACLE contexts

**Features:**
- Import tasks as signals
- Export execution steps as tasks
- Two-way completion sync
- Priority mapping

### Notion

1. Navigate to Settings → Integrations → Notion
2. Tap "Connect"
3. Authorize workspace access
4. Select pages/databases to sync

**Features:**
- Search Notion for context
- Create decision documents
- Link pages to decisions
- Database sync

### Slack

1. Navigate to Settings → Integrations → Slack
2. Tap "Connect"
3. Install the ORACLE app to your workspace
4. Select notification channels

**Features:**
- High-priority signal alerts
- Decision summaries
- Slash command: `/oracle status`
- Interactive approval buttons

### Email (Gmail/Outlook)

1. Navigate to Settings → Integrations → Email
2. Choose Gmail or Outlook
3. Authorize email access
4. Configure scan settings

**Features:**
- Scan emails for action items
- Extract signals from messages
- Send decision summaries

### Zapier

1. Visit zapier.com and create a Zap
2. Search for "ORACLE Mission Control"
3. Use your API key for authentication
4. Configure triggers and actions

**Available Triggers:**
- New signal detected
- Decision made
- Plan completed

**Available Actions:**
- Create signal
- Approve ghost action

### IFTTT

1. Visit ifttt.com
2. Search for "ORACLE" service
3. Connect your account
4. Create applets

---

## Offline Mode Documentation

ORACLE works seamlessly offline with automatic sync when connectivity returns.

### How It Works

1. **Local Storage**: Data is stored locally using SQLite
2. **Sync Queue**: Changes are queued when offline
3. **Background Sync**: Automatic sync when back online
4. **Conflict Resolution**: Smart merging of local and server changes

### Sync Settings

Navigate to Settings → Offline & Sync:

- **Sync Scope**: Choose what to sync offline
  - All data
  - Recent (last 7 days)
  - Favorites only

- **WiFi Only**: Only sync over WiFi connections

- **Storage Usage**: View offline data size

- **Clear Offline Data**: Remove all cached data

### Conflict Resolution Strategies

When the same data is modified both locally and on the server:

1. **Server Wins**: Server version takes precedence
2. **Local Wins**: Local changes take precedence
3. **Merge**: Attempt to merge changes
4. **Manual**: Prompt user to choose

### Data Migration

Local database migrations run automatically on app update. No user action required.

---

## Security Best Practices

### End-to-End Encryption

Sensitive ORACLE data can be encrypted client-side:

1. Navigate to Settings → Security → Encryption
2. Enable "Encrypt Sensitive Data"
3. Create an encryption password
4. Confirm password

**What's Encrypted:**
- Decision rationales
- Signal content
- Ghost action details
- Personal metadata

**Important:** Your encryption password cannot be recovered. Store it safely.

### Audit Logging

All ORACLE operations are logged for compliance:

- Create/Update/Delete operations
- AI queries (sanitized)
- Security events
- Integration access

**Viewing Logs:**
Navigate to Settings → Security → Audit Logs

**Retention:**
- Default: 90 days
- Configure in Settings → Security → Log Retention

**Export:**
- JSON or CSV format
- Date range selection

### Rate Limiting

API usage is limited based on your subscription tier:

| Tier | Requests/min | AI Requests/min | Batch Operations |
|------|--------------|-----------------|------------------|
| Free | 60 | 10 | 20 |
| Basic | 120 | 30 | 50 |
| Premium | 300 | 100 | 100 |
| Enterprise | 1000 | 500 | 500 |

**Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705312800
```

### Authentication Best Practices

1. **Use Strong Passwords**: Minimum 12 characters
2. **Enable 2FA**: Two-factor authentication recommended
3. **Review Sessions**: Check active sessions regularly
4. **Secure Tokens**: Never share API tokens

### Integration Security

- OAuth tokens are encrypted at rest
- Tokens are refreshed automatically
- Revoke access anytime in Settings
- Minimal permission scopes requested

---

## Troubleshooting

### Realtime Not Updating

1. Check internet connection
2. Verify connection status indicator
3. Try pulling to refresh
4. Restart the app

### Watch Not Syncing

1. Ensure watch is connected to phone
2. Check Watch app is installed
3. Verify background refresh is enabled
4. Re-pair if necessary

### Integration Connection Failed

1. Check internet connection
2. Verify account credentials
3. Re-authorize the integration
4. Check for service outages

### Offline Sync Issues

1. Check available storage
2. Verify WiFi-only setting
3. Force sync in Settings
4. Clear cache and re-sync

---

## API Reference

### Batch Endpoint

```
POST /api/oracle/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "operations": [
    {
      "id": "op1",
      "operation": "signals.list",
      "params": { "status": "active" }
    },
    {
      "id": "op2",
      "operation": "decisions.get",
      "params": { "id": "dec-123" }
    }
  ]
}
```

### Available Operations

- `signals.list`, `signals.get`, `signals.create`, `signals.update`, `signals.delete`
- `contexts.list`, `contexts.get`, `contexts.create`
- `decisions.list`, `decisions.get`, `decisions.create`, `decisions.update`
- `plans.list`, `plans.get`, `plans.create`
- `steps.list`, `steps.update`
- `ghost_actions.list`, `ghost_actions.get`, `ghost_actions.approve`, `ghost_actions.reject`
- `analytics.record`

---

## Support

For issues or questions:
- In-app: Settings → Help & Support
- Email: support@missioncontrol.app
- Documentation: docs.missioncontrol.app
