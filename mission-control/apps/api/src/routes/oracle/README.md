# ORACLE - Autonomous Intelligence Loop

ORACLE (Observe, Orient, Decide, Act - Learning Engine) is the core intelligence system for Mission Control. It implements the OODA loop methodology for continuous situational awareness and proactive decision support.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         OODA LOOP                               │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ OBSERVE  │───▶│  ORIENT  │───▶│  DECIDE  │───▶│   ACT    │  │
│  │ (Radar)  │    │ (Mind)   │    │ (Engine) │    │(Copilot) │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                               │         │
│       └───────────────────────────────────────────────┘         │
│                         FEEDBACK LOOP                           │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Colors
- **OBSERVE**: `#00BFFF` (Cyan) - Data collection and signal detection
- **ORIENT**: `#FFD700` (Gold) - Strategic context and horizon planning
- **DECIDE**: `#FF6B6B` (Red) - Decision analysis with Monte Carlo simulation
- **ACT**: `#00FF88` (Green) - Execution with copilot guidance

## Module Overview

### 1. OBSERVE Module (Radar)
Detects signals from multiple data sources and groups them into actionable clusters.

**Key Features:**
- Signal detection from calendar, tasks, email, financial data
- Anomaly detection with z-score analysis
- Signal clustering by semantic similarity
- Urgency and impact classification

### 2. ORIENT Module (Strategic Mind)
Synthesizes signals into strategic context with multi-horizon planning.

**Key Features:**
- Strategic context generation
- Multi-horizon planning (immediate, today, week, month)
- Correlation discovery between entities
- Risk/opportunity assessment

### 3. DECIDE Module (Decision Engine)
Analyzes decisions with multiple options and Monte Carlo simulation.

**Key Features:**
- Option generation (3-5 distinct approaches)
- Monte Carlo simulation for outcome distribution
- Critical path analysis
- Stakeholder input tracking

### 4. ACT Module (Execution Copilot)
Guides execution with real-time suggestions and progress tracking.

**Key Features:**
- Step-by-step execution plans
- Real-time copilot guidance
- Progress tracking with health score
- Learning capture from outcomes

### 5. Probability Engine
Bayesian prediction system with calibration tracking.

**Key Features:**
- Multi-factor prediction generation
- Bayesian updates from outcomes
- Brier score calibration
- Time-based confidence decay

### 6. Environment Awareness
Mobile device context for proactive intelligence.

**Key Features:**
- Location tracking
- Calendar event awareness
- Network/battery state
- Ghost actions (pre-prepared actions)

## API Endpoints

### Orchestration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oracle/status` | Get current OODA phase and state |
| GET | `/api/oracle/dashboard` | Unified dashboard data |
| GET | `/api/oracle/config` | Get configuration |
| PATCH | `/api/oracle/config` | Update configuration |
| POST | `/api/oracle/loop/start` | Start autonomous loop |
| POST | `/api/oracle/loop/pause` | Pause running loop |
| POST | `/api/oracle/loop/resume` | Resume paused loop |
| POST | `/api/oracle/loop/stop` | Stop loop completely |
| POST | `/api/oracle/phase/transition` | Manual phase transition |
| POST | `/api/oracle/trigger/:phase` | Trigger specific phase |

### OBSERVE (Radar)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/observe/scan` | Trigger radar scan |
| GET | `/api/oracle/observe/signals` | List signals |
| POST | `/api/oracle/observe/signals` | Create signal |
| PATCH | `/api/oracle/observe/signals/:id` | Update/dismiss signal |
| GET | `/api/oracle/observe/clusters` | Get signal clusters |
| POST | `/api/oracle/observe/clusters/generate` | Generate clusters |

### ORIENT (Strategic Mind)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/orient/generate` | Generate strategic context |
| GET | `/api/oracle/orient/contexts` | List contexts |
| GET | `/api/oracle/orient/contexts/:id` | Get specific context |
| GET | `/api/oracle/orient/horizons` | Get horizon plans |
| POST | `/api/oracle/orient/horizons/all` | Generate all horizons |
| POST | `/api/oracle/orient/correlations` | Discover correlations |
| GET/POST | `/api/oracle/orient/assessments` | Risk/opportunity assessments |

### DECIDE (Decision Engine)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/decide/decisions` | Create decision |
| GET | `/api/oracle/decide/decisions` | List decisions |
| GET | `/api/oracle/decide/decisions/:id` | Get decision |
| POST | `/api/oracle/decide/decisions/:id/options` | Generate options |
| POST | `/api/oracle/decide/decisions/:id/options/:optionId/simulate` | Run Monte Carlo |
| GET | `/api/oracle/decide/decisions/:id/critical-path` | Critical path analysis |
| PATCH | `/api/oracle/decide/decisions/:id/select` | Select option |

### ACT (Execution Copilot)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/act/plans` | Create execution plan |
| GET | `/api/oracle/act/plans` | List plans |
| GET | `/api/oracle/act/plans/:id` | Get plan details |
| GET | `/api/oracle/act/plans/:id/steps` | Get plan steps |
| PATCH | `/api/oracle/act/plans/:id/steps/:stepId` | Update step status |
| POST | `/api/oracle/act/plans/:id/copilot` | Get copilot guidance |
| POST | `/api/oracle/act/plans/:id/blockers` | Report blocker |
| POST | `/api/oracle/act/plans/:id/outcome` | Record outcome |

### PROBABILITY
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/probability/predict` | Generate prediction |
| GET | `/api/oracle/probability/predictions` | List predictions |
| POST | `/api/oracle/probability/predictions/:id/outcome` | Record outcome |
| GET | `/api/oracle/probability/calibration` | Get calibration state |

### ENVIRONMENT
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/environment/snapshot` | Capture environment |
| GET | `/api/oracle/environment/graph` | Get context graph |
| GET | `/api/oracle/environment/ghost-actions` | List ghost actions |
| POST | `/api/oracle/environment/ghost-actions/:id/execute` | Execute ghost action |

## Mobile Store Usage

### Radar Store (OBSERVE)
```typescript
import { useRadarStore } from '@/store/oracle/radarStore';

const { signals, isScanning, startScan, dismissSignal } = useRadarStore();

// Trigger scan
await startScan(['calendar', 'tasks']);

// Get critical signals
const critical = useRadarStore.getState().criticalSignals;
```

### Orient Store (ORIENT)
```typescript
import { useOrientStore } from '@/store/oracle/orientStore';

const { currentContext, horizons, generateContext } = useOrientStore();

// Generate context from signals
await generateContext(signalIds);
```

### Decide Store (DECIDE)
```typescript
import { useDecideStore } from '@/store/oracle/decideStore';

const { currentDecision, options, runSimulation, selectOption } = useDecideStore();

// Run Monte Carlo simulation
await runSimulation(optionId, { iterations: 1000 });
```

### Act Store (ACT)
```typescript
import { useActStore } from '@/store/oracle/actStore';

const { currentPlan, completeStep, getCopilotGuidance } = useActStore();

// Complete current step
await completeStep(stepId, { duration: 25, notes: 'Done!' });
```

### Environment Hooks
```typescript
import { useEnvironmentContext } from '@/hooks/useEnvironment';

const { location, calendar, network, battery, refresh } = useEnvironmentContext({
  enableLocation: true,
  enableCalendar: true,
});
```

## Environment Setup

### 1. API Server
```bash
cd apps/api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure environment variables:
# - SUPABASE_URL
# - SUPABASE_KEY
# - GOOGLE_AI_API_KEY (for Gemini)

# Start development server
npm run dev
```

### 2. Database Migration
```bash
# Run the ORACLE migration
psql $DATABASE_URL < database/migrations/001_oracle_tables.sql
```

### 3. Mobile App
```bash
cd apps/mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start
```

### 4. Generate Demo Data
```bash
cd apps/api
npm run seed:oracle
```

## Testing

### Unit Tests
```bash
cd apps/api

# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Files
- `src/services/oracle/monteCarlo.test.ts` - Monte Carlo simulation tests
- `src/services/oracle/probability.test.ts` - Probability engine tests
- `src/routes/oracle/oracle.integration.test.ts` - API integration tests

### Key Test Categories
1. **Distribution Tests**: Normal, uniform, triangular, beta, exponential
2. **Bayesian Update Tests**: Prior updates, posterior calculations
3. **Calibration Tests**: Brier score, bucket accuracy
4. **Integration Tests**: Full OODA loop flow

## Configuration Options

### OracleConfig
```typescript
interface OracleConfig {
  scan_interval_minutes: number;       // Default: 15
  auto_orient_enabled: boolean;        // Default: true
  auto_decide_threshold: number;       // Default: 0.8
  auto_execute_enabled: boolean;       // Default: false
  ghost_action_approval_mode: 'always_ask' | 'auto_approve' | 'never';
  proactivity_level: 'low' | 'medium' | 'high';
  attention_budget: AttentionBudget;
  notification_preferences: NotificationPreferences;
}
```

### Attention Budget
```typescript
interface AttentionBudget {
  total_daily_budget: number;          // Default: 100
  category_budgets: Record<string, number>;
  interruption_threshold: number;      // 0-1, default: 0.7
  focus_mode_active: boolean;
}
```

## Background Sync (Mobile)

The mobile app includes background task registration for periodic ORACLE sync:

```typescript
import { registerOracleBackgroundTask } from '@/services/oracleBackgroundTask';

// Register on app start
await registerOracleBackgroundTask();
```

**Sync Conditions:**
- Minimum 15-minute interval
- Battery level > 20%
- Network connectivity available
- Not in low power mode

## Notification Channels (Android)

| Channel | Importance | Use Case |
|---------|------------|----------|
| `oracle-signals-critical` | HIGH | Urgent signals |
| `oracle-signals-high` | DEFAULT | High priority signals |
| `oracle-signals-medium` | LOW | Standard signals |
| `oracle-ghost-actions` | DEFAULT | Ghost action approval |
| `oracle-copilot` | LOW | Execution guidance |
| `oracle-system` | MIN | System notifications |

## Services

### MonteCarloService
```typescript
import { monteCarloService } from '@/services/oracle/monteCarlo';

const result = await monteCarloService.runSimulation(
  [
    { name: 'revenue', distribution: { type: 'normal', params: [1000, 100] } },
    { name: 'cost', distribution: { type: 'uniform', params: [500, 700] } },
  ],
  (samples) => samples.revenue - samples.cost,
  { iterations: 1000 }
);
```

### ProbabilityEngineService
```typescript
import { probabilityEngineService } from '@/services/oracle/probability';

const prediction = probabilityEngineService.generatePrediction(
  [
    { name: 'velocity', value: 0.8, weight: 0.4, direction: 'positive' },
    { name: 'blockers', value: 0.3, weight: 0.3, direction: 'negative' },
  ],
  { alpha: 5, beta: 3 } // Bayesian prior
);
```

### OracleCacheService
```typescript
import { oracleCacheService } from '@/services/oracle/cache';

// Cache with category-based TTL
oracleCacheService.setByCategory('predictions', 'key', data);
const cached = oracleCacheService.getByCategory('predictions', 'key');

// Get or set pattern
const value = await oracleCacheService.getOrSetByCategory(
  'simulations',
  'key',
  async () => computeExpensiveValue()
);
```

## Best Practices

1. **Start with OBSERVE**: Always begin the loop with a radar scan
2. **Use Ghost Actions**: Pre-prepare common actions for quick execution
3. **Monitor Calibration**: Check Brier score to ensure predictions are well-calibrated
4. **Respect Attention Budget**: Don't over-notify users
5. **Capture Learnings**: Always record outcomes for continuous improvement

## Troubleshooting

### Common Issues

1. **Loop not starting**: Check if already running with `/api/oracle/status`
2. **No signals detected**: Verify data sources are configured
3. **Simulation timeout**: Reduce iteration count or check factor complexity
4. **Background sync not working**: Check battery/network conditions

### Debug Endpoints
- `GET /api/oracle/health` - Subsystem health check
- `GET /api/oracle/history` - Recent OODA loop history

---

## Phase 3: Advanced Features

### Analytics Dashboard

The analytics system tracks ORACLE performance and user engagement.

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/analytics/event` | Track single event |
| POST | `/api/oracle/analytics/event/batch` | Track multiple events |
| GET | `/api/oracle/analytics/dashboard` | Get aggregated metrics |
| GET | `/api/oracle/analytics/predictions` | Prediction accuracy over time |
| GET | `/api/oracle/analytics/engagement` | User engagement stats |
| GET | `/api/oracle/analytics/health` | System health metrics |

**Event Types:**
- `observe_scan`, `signal_created`, `signal_dismissed`
- `decision_made`, `option_selected`, `simulation_run`
- `prediction_made`, `prediction_resolved`
- `ghost_action_approved`, `ghost_action_executed`

### Webhook System

Configure webhooks to receive real-time notifications of ORACLE events.

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/webhooks` | Register new webhook |
| GET | `/api/oracle/webhooks` | List all webhooks |
| PATCH | `/api/oracle/webhooks/:id` | Update webhook |
| DELETE | `/api/oracle/webhooks/:id` | Remove webhook |
| POST | `/api/oracle/webhooks/:id/test` | Send test payload |
| GET | `/api/oracle/webhooks/:id/deliveries` | Delivery history |

**Webhook Payload Structure:**
```json
{
  "event_id": "evt-123",
  "event_type": "signal.created",
  "timestamp": "2026-01-31T12:00:00Z",
  "data": { ... },
  "signature": "sha256=..."
}
```

**Signature Verification:**
Webhooks include HMAC-SHA256 signature in the `X-ORACLE-Signature` header.

### Pattern Learning

ORACLE learns from user behavior to provide personalized recommendations.

**Pattern Types:**
- `temporal` - Time-of-day and day-of-week patterns
- `sequential` - Action sequence patterns
- `behavioral` - Context-based habits
- `routine` - Regular recurring activities
- `correlation` - Co-occurrence patterns

**Providing Feedback:**
Users can confirm or reject pattern suggestions to improve accuracy.

### Voice Commands

Voice interface for hands-free ORACLE interaction.

**Supported Commands:**
| Command | Aliases | Action |
|---------|---------|--------|
| scan | radar, observe | Start radar scan |
| decide | decision, choose | Open decision engine |
| plan | execute, act | View execution plans |
| status | dashboard, overview | Get current status |
| help | commands | List available commands |
| create | add, new | Create new signal |
| stop | cancel, nevermind | Cancel current operation |

**Voice Command Format:**
```
"scan for signals"
"show status"
"create deadline signal"
"decide about [context]"
```

### Natural Language Query

Ask ORACLE questions in natural language.

**API Endpoint:**
```
POST /api/oracle/query
{
  "query": "What's my status today?",
  "conversation_id": "optional-for-context"
}
```

**Query Types:**
- Status queries: "What's my current status?"
- Prediction queries: "What are my predictions for this week?"
- Recommendation queries: "What should I focus on?"
- History queries: "Show my decision history"
- Analytics queries: "How am I doing this month?"

### Scenario Planning

What-if analysis for exploring different decision outcomes.

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/scenarios` | Create scenario |
| GET | `/api/oracle/scenarios` | List scenarios |
| GET | `/api/oracle/scenarios/:id/full` | Get full state |
| POST | `/api/oracle/scenarios/:id/variables` | Add variable |
| PATCH | `/api/oracle/scenarios/variables/:id` | Update variable |
| POST | `/api/oracle/scenarios/:id/sensitivity` | Run analysis |
| POST | `/api/oracle/scenarios/compare` | Compare scenarios |

**Sensitivity Analysis Types:**
- `tornado` - Variable impact ranking
- `spider` - Multi-percentage analysis
- `monte_carlo` - Probabilistic simulation

### Data Export

Export ORACLE data in various formats.

**API Endpoint:**
```
GET /api/oracle/export/:type?format=json&start_date=2026-01-01
```

**Export Types:**
- `decisions` - Decision history with options and outcomes
- `predictions` - Prediction history with accuracy
- `analytics` - Usage metrics and performance
- `journal` - Decision journal entries
- `signals` - Signal history
- `scenarios` - Scenario analysis data
- `all` - Complete ORACLE data

**Formats:**
- `json` - Structured JSON for backup/import
- `csv` - Spreadsheet compatible
- `pdf` - Formatted report (markdown)

**Options:**
- `anonymize=true` - Remove/hash personal identifiers
- `start_date` / `end_date` - Date range filtering

### Collaborative Decisions

Multi-user decision support for teams.

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/collab/:id/invite` | Invite collaborator |
| POST | `/api/oracle/collab/:id/votes` | Cast vote |
| GET | `/api/oracle/collab/:id/aggregation` | Get vote totals |
| POST | `/api/oracle/collab/:id/comments` | Add comment |
| POST | `/api/oracle/collab/:id/share` | Create share link |

**Collaborator Roles:**
- `owner` - Full control
- `editor` - Can modify options and vote
- `voter` - Can vote and comment
- `viewer` - Read-only access

**Vote Types:**
- `approve` - Support option
- `reject` - Oppose option
- `abstain` - No preference

### Decision Journal

Track and reflect on past decisions.

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/oracle/journal` | Create entry |
| GET | `/api/oracle/journal` | List entries |
| POST | `/api/oracle/journal/:id/outcome` | Record outcome |
| POST | `/api/oracle/journal/:id/reflection` | Add reflection |
| GET | `/api/oracle/journal/stats` | Get statistics |
| GET | `/api/oracle/journal/export` | Export journal |

**Outcome Statuses:**
- `pending` - Awaiting outcome
- `success` - Decision succeeded
- `partial` - Mixed results
- `failure` - Decision failed
- `cancelled` - Decision cancelled
- `unknown` - Outcome unclear

### Settings

Customize ORACLE behavior.

**Setting Categories:**
1. **Proactivity** - Control assistance level
   - `minimal` - Only respond when asked
   - `balanced` - Proactive suggestions
   - `aggressive` - Continuous monitoring

2. **Notifications** - Configure alert types
   - By signal urgency (critical/high/medium/low)
   - Ghost actions, copilot, predictions
   - Quiet hours configuration

3. **Confidence Thresholds**
   - Low confidence threshold (default: 0.5)
   - High confidence threshold (default: 0.8)
   - Show/hide low confidence predictions

4. **Data Retention**
   - Retention period (30-365 days)
   - Auto-archive settings

5. **Appearance**
   - Theme (dark/light/system)
   - OODA color schemes (default/colorblind/high-contrast)

6. **Privacy**
   - Analytics opt-in/out
   - Crash reporting
   - Anonymous usage sharing

### Widget Support

Home screen widgets for quick ORACLE status.

**Widget Sizes:**
- **Small** - Current phase + top signal
- **Medium** - Phase + 3 signals + quick action
- **Large** - Mini dashboard

**Deep Links:**
Widgets support deep linking to specific screens:
- `oracle://dashboard`
- `oracle://radar?signalId=X`
- `oracle://decide?decisionId=X`

---

## Phase 3 Mobile Screens

| Screen | File | Description |
|--------|------|-------------|
| AnalyticsDashboard | `analytics/AnalyticsDashboard.tsx` | Performance metrics |
| PredictionAccuracyChart | `analytics/PredictionAccuracyChart.tsx` | Accuracy trends |
| WebhookSettings | `settings/WebhookSettings.tsx` | Webhook management |
| SmartScheduler | `scheduling/SmartScheduler.tsx` | Optimal time slots |
| DecisionJournal | `journal/DecisionJournal.tsx` | Journal entries |
| CollaborativeDecision | `collab/CollaborativeDecision.tsx` | Team decisions |
| VoiceOracle | `voice/VoiceOracle.tsx` | Voice interface |
| OracleChat | `chat/OracleChat.tsx` | NL query chat |
| ScenarioPlanner | `scenarios/ScenarioPlanner.tsx` | What-if analysis |
| ExportCenter | `export/ExportCenter.tsx` | Data export |
| OracleSettings | `settings/OracleSettings.tsx` | Full settings |

---

## Running Tests

```bash
# Run all ORACLE tests
npm run test

# Run Phase 3 integration tests
npm run test -- phase3.integration

# Run with coverage
npm run test:coverage
```
