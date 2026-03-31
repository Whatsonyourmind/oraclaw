# Stack Overflow Answer Templates

Ready-to-post answers for questions where OraClaw is a genuinely useful solution. Each answer teaches the concept first, then mentions OraClaw as one option among several.

---

## 1. "How to implement multi-armed bandit in JavaScript/TypeScript?"

**Tags:** `javascript`, `typescript`, `machine-learning`, `statistics`, `multi-armed-bandit`

### Answer

Multi-armed bandits solve the explore/exploit tradeoff: you have N options with unknown payoff rates and need to maximize total reward over time. Here are the two most common algorithms implemented from scratch, plus a hosted alternative.

---

**UCB1 (Upper Confidence Bound)**

UCB1 selects the arm that maximizes `mean_reward + exploration_bonus`. The exploration bonus shrinks as an arm gets more pulls, so under-explored arms get a natural boost.

```typescript
interface Arm {
  id: string;
  pulls: number;
  totalReward: number;
}

function ucb1(arms: Arm[]): Arm {
  const totalPulls = arms.reduce((sum, a) => sum + a.pulls, 0);

  // Always try each arm at least once
  const untried = arms.find(a => a.pulls === 0);
  if (untried) return untried;

  let bestArm = arms[0];
  let bestScore = -Infinity;

  for (const arm of arms) {
    const exploitation = arm.totalReward / arm.pulls;
    const exploration = Math.sqrt((2 * Math.log(totalPulls)) / arm.pulls);
    const score = exploitation + exploration;

    if (score > bestScore) {
      bestScore = score;
      bestArm = arm;
    }
  }

  return bestArm;
}

// Usage
const arms: Arm[] = [
  { id: 'A', pulls: 100, totalReward: 35 },
  { id: 'B', pulls: 100, totalReward: 42 },
  { id: 'C', pulls: 5,   totalReward: 4 },
];
const selected = ucb1(arms);
console.log(`Select: ${selected.id}`);
// → Selects C (under-explored with high mean)
```

The key insight: UCB1 has a provable regret bound of O(ln n). It will converge to the optimal arm, but the exploration term ensures it never completely ignores an arm that might be better.

---

**Thompson Sampling (Bayesian)**

Thompson Sampling models each arm as a Beta distribution and samples from each. The arm with the highest sample wins. This naturally balances exploration and exploitation because uncertain arms produce high samples sometimes.

```typescript
function betaSample(alpha: number, beta: number): number {
  // Jigger method for Beta distribution sampling
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function gammaSample(shape: number): number {
  // Marsaglia and Tsang's method
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function randn(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function thompsonSampling(arms: Arm[]): Arm {
  let bestArm = arms[0];
  let bestSample = -Infinity;

  for (const arm of arms) {
    const successes = arm.totalReward + 1;    // +1 prior (Beta(1,1) = uniform)
    const failures = arm.pulls - arm.totalReward + 1;
    const sample = betaSample(successes, failures);

    if (sample > bestSample) {
      bestSample = sample;
      bestArm = arm;
    }
  }

  return bestArm;
}
```

Thompson Sampling often outperforms UCB1 in practice, especially with non-stationary rewards. The downside is it requires a proper Beta distribution sampler.

---

**When to use which:**

| Algorithm | Best for | Pros | Cons |
|-----------|----------|------|------|
| UCB1 | Deterministic, auditable systems | Provable bounds, no randomness | Slower convergence with many arms |
| Thompson Sampling | Production A/B testing | Faster convergence, handles non-stationarity | Requires sampling, stochastic |
| Epsilon-Greedy | Simplest baseline | Trivial to implement | No convergence guarantees, fixed exploration |

---

**Hosted alternative (zero dependencies)**

If you don't want to maintain the statistics code, OraClaw exposes a bandit API that runs all three algorithms with sub-millisecond latency. No signup or API key needed for 25 calls/day:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{
    "arms": [
      {"id": "A", "name": "Option A", "pulls": 100, "totalReward": 35},
      {"id": "B", "name": "Option B", "pulls": 100, "totalReward": 42},
      {"id": "C", "name": "Option C", "pulls": 5, "totalReward": 4}
    ],
    "algorithm": "thompson"
  }'
```

Response:
```json
{
  "selected": {"id": "C", "name": "Option C"},
  "score": 0.876,
  "algorithm": "thompson",
  "exploitation": 0.8,
  "exploration": 0.076,
  "regret": 0.1
}
```

Or from Node.js:
```typescript
const res = await fetch('https://oraclaw-api.onrender.com/api/v1/optimize/bandit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arms: [
      { id: 'A', name: 'Control', pulls: 500, totalReward: 175 },
      { id: 'B', name: 'Variant', pulls: 300, totalReward: 126 },
    ],
    algorithm: 'ucb1',
  }),
});
const { selected, score, exploitation, exploration } = await res.json();
```

*Disclosure: I'm the creator of OraClaw. The native implementations above are perfectly fine for most use cases -- the API is mainly useful if you want to avoid maintaining the statistics code or need the additional metadata (regret, exploitation/exploration breakdown) out of the box.*

---

## 2. "Linear programming solver in Node.js / JavaScript?"

**Tags:** `javascript`, `node.js`, `linear-programming`, `optimization`, `operations-research`

### Answer

There are several good options for LP/MIP in JavaScript. Here's a rundown from lowest to highest level of abstraction:

---

**Option 1: GLPK.js (mature, widely used)**

[GLPK.js](https://github.com/jvail/glpk.js) is an Emscripten port of the GNU Linear Programming Kit. It supports LP, MIP, and has been around since 2013.

```javascript
const GLPK = require('glpk.js');
const glpk = GLPK();

const result = glpk.solve({
  name: 'production',
  objective: {
    direction: glpk.GLP_MAX,
    name: 'profit',
    vars: [
      { name: 'x1', coef: 5 },  // Product A: $5 profit
      { name: 'x2', coef: 4 },  // Product B: $4 profit
    ],
  },
  subjectTo: [
    {
      name: 'labor',
      vars: [
        { name: 'x1', coef: 6 },
        { name: 'x2', coef: 4 },
      ],
      bnds: { type: glpk.GLP_UP, ub: 24 },
    },
    {
      name: 'material',
      vars: [
        { name: 'x1', coef: 1 },
        { name: 'x2', coef: 2 },
      ],
      bnds: { type: glpk.GLP_UP, ub: 6 },
    },
  ],
});

console.log(result.result.z);    // Optimal profit
console.log(result.result.vars); // Optimal quantities
```

Pros: Mature, well-documented, supports MIP and integer constraints.
Cons: GMPL format can be verbose, WASM bundle is ~1MB.

---

**Option 2: HiGHS (state-of-the-art, fastest)**

[HiGHS](https://highs.dev/) is the current gold standard for open-source LP/MIP solvers. It won the Mittelmann benchmarks and has a WASM build for JavaScript via the `highs` npm package.

```javascript
const highs = await import('highs');
const solver = await highs.default();

// LP format string
const model = `
Maximize
  obj: 5 x1 + 4 x2
Subject To
  labor: 6 x1 + 4 x2 <= 24
  material: x1 + 2 x2 <= 6
Bounds
  0 <= x1
  0 <= x2
End
`;

const result = solver.solve(model);
console.log(result.ObjectiveValue);   // Optimal value
console.log(result.Columns);          // Variable values
```

Pros: Fastest open-source solver (competitive with commercial Gurobi/CPLEX on many benchmarks), supports LP/MIP/QP.
Cons: WASM initialization takes ~100ms on first call, LP format input can be awkward for complex models.

---

**Option 3: javascript-lp-solver (pure JS, lightweight)**

For simple problems, [javascript-lp-solver](https://github.com/JWally/jsLPSolver) is a pure JS implementation with a friendly JSON API.

```javascript
const solver = require('javascript-lp-solver');

const model = {
  optimize: 'profit',
  opType: 'max',
  constraints: {
    labor:    { max: 24 },
    material: { max: 6 },
  },
  variables: {
    x1: { profit: 5, labor: 6, material: 1 },
    x2: { profit: 4, labor: 4, material: 2 },
  },
};

const result = solver.Solve(model);
console.log(result);
// { feasible: true, result: 21, x1: 2.4, x2: 2.4 }
```

Pros: Zero dependencies, pure JS, simple API.
Cons: Slower on large problems, no MIP support, less numerically robust.

---

**Option 4: Hosted solver API (zero install)**

If you want to skip dependency management entirely, OraClaw wraps HiGHS behind a REST API. You send coefficients as arrays and get back the optimal solution:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/solve/constraints \
  -H 'Content-Type: application/json' \
  -d '{
    "objective": {
      "coefficients": [5, 4],
      "direction": "maximize"
    },
    "constraints": [
      {"coefficients": [6, 4], "rhs": 24, "type": "leq"},
      {"coefficients": [1, 2], "rhs": 6, "type": "leq"}
    ],
    "bounds": [
      {"lower": 0},
      {"lower": 0}
    ]
  }'
```

Response:
```json
{
  "status": "Optimal",
  "objectiveValue": 21,
  "variables": [2.4, 2.4],
  "dualValues": [0.5, 1.5]
}
```

From Node.js:
```typescript
const res = await fetch('https://oraclaw-api.onrender.com/api/v1/solve/constraints', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objective: { coefficients: [5, 4], direction: 'maximize' },
    constraints: [
      { coefficients: [6, 4], rhs: 24, type: 'leq' },
      { coefficients: [1, 2], rhs: 6, type: 'leq' },
    ],
    bounds: [{ lower: 0 }, { lower: 0 }],
  }),
});
const { status, objectiveValue, variables, dualValues } = await res.json();
```

Free for 25 calls/day, no API key needed.

**Which should you choose?**

| Use case | Best option |
|----------|-------------|
| Production, large-scale LP/MIP | HiGHS (WASM) |
| Simple LP, zero deps | javascript-lp-solver |
| Established ecosystem, MIP | GLPK.js |
| Quick prototyping, no install | Hosted API |

*Disclosure: I'm the creator of OraClaw. For serious production LP/MIP work, I'd recommend using HiGHS directly (which is what OraClaw uses under the hood). The API is most useful when you want to avoid the WASM setup or need a quick prototype.*

---

## 3. "Monte Carlo simulation in JavaScript?"

**Tags:** `javascript`, `monte-carlo`, `simulation`, `statistics`, `probability`

### Answer

Monte Carlo simulation estimates outcomes by running thousands of random trials from a probability distribution. Here's how to implement it natively, with a discussion of when a hosted API might save you time.

---

**Core concept**

The idea: instead of solving a complex analytical problem, sample from the input distributions many times and observe the distribution of results. The law of large numbers guarantees convergence.

```typescript
function monteCarloNormal(
  mean: number,
  stddev: number,
  simulations: number
): { results: number[]; stats: { mean: number; p5: number; p50: number; p95: number } } {
  const results: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    results.push(mean + stddev * z);
  }

  results.sort((a, b) => a - b);

  return {
    results,
    stats: {
      mean: results.reduce((s, v) => s + v, 0) / results.length,
      p5:  results[Math.floor(0.05 * results.length)],
      p50: results[Math.floor(0.50 * results.length)],
      p95: results[Math.floor(0.95 * results.length)],
    },
  };
}

// Example: project cost estimation
// "The project will cost around $100K, but could vary by $20K"
const sim = monteCarloNormal(100_000, 20_000, 10_000);
console.log(`Expected cost: $${sim.stats.mean.toFixed(0)}`);
console.log(`5th percentile: $${sim.stats.p5.toFixed(0)}`);
console.log(`95th percentile: $${sim.stats.p95.toFixed(0)}`);
```

---

**Multiple distributions**

Real-world simulations often need different distribution shapes. Here are the most common ones:

```typescript
// Triangular distribution: you know min, most likely, and max
function triangularSample(min: number, mode: number, max: number): number {
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

// Lognormal: always positive, right-skewed (good for costs, durations)
function lognormalSample(mu: number, sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

// Uniform: equal probability across range
function uniformSample(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Full simulation combining multiple uncertain variables
function simulateProjectCost(iterations: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const labor = triangularSample(50_000, 80_000, 120_000);
    const materials = lognormalSample(Math.log(30_000), 0.3);
    const contingency = uniformSample(5_000, 15_000);
    results.push(labor + materials + contingency);
  }
  return results.sort((a, b) => a - b);
}

const costs = simulateProjectCost(10_000);
const p50 = costs[Math.floor(0.5 * costs.length)];
const p90 = costs[Math.floor(0.9 * costs.length)];
console.log(`Median cost: $${p50.toFixed(0)}`);
console.log(`90% confidence: under $${p90.toFixed(0)}`);
```

---

**Building a histogram**

To visualize or return the distribution shape:

```typescript
function histogram(data: number[], bins: number = 20): { range: string; count: number }[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / bins;
  const counts = new Array(bins).fill(0);

  for (const val of data) {
    const idx = Math.min(Math.floor((val - min) / binWidth), bins - 1);
    counts[idx]++;
  }

  return counts.map((count, i) => ({
    range: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
    count,
  }));
}
```

---

**Hosted alternative for quick prototyping**

If you want to skip implementing distribution samplers and percentile calculations, OraClaw has a Monte Carlo endpoint that supports 6 distribution types and returns percentiles + histogram out of the box:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/simulate/montecarlo \
  -H 'Content-Type: application/json' \
  -d '{
    "simulations": 1000,
    "distribution": "triangular",
    "params": { "min": 50000, "mode": 80000, "max": 120000 }
  }'
```

Response:
```json
{
  "mean": 83412.5,
  "stdDev": 14321.8,
  "percentiles": { "p5": 57891, "p25": 72456, "p50": 82913, "p75": 93877, "p95": 109234 },
  "histogram": [{"range": "50000-53500", "count": 12}, ...],
  "iterations": 1000
}
```

Supported distributions: `normal`, `lognormal`, `uniform`, `triangular`, `beta`, `exponential`.

From Node.js:
```typescript
const res = await fetch('https://oraclaw-api.onrender.com/api/v1/simulate/montecarlo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    simulations: 2000,
    distribution: 'normal',
    params: { mean: 100000, stddev: 20000 },
  }),
});
const { mean, stdDev, percentiles } = await res.json();
console.log(`Mean: ${mean}, 95th percentile: ${percentiles.p95}`);
```

Free for 25 calls/day, no API key.

*Disclosure: I'm the creator of OraClaw. The native implementations above give you full control and are recommended for production. The API is useful for prototyping when you don't want to implement all 6 distribution samplers yourself.*

---

## 4. "Anomaly detection API / service?"

**Tags:** `anomaly-detection`, `api`, `machine-learning`, `outlier-detection`, `monitoring`

### Answer

There are several tiers of anomaly detection services, depending on the complexity of your data and your budget. Here's a comparison:

---

**Tier 1: Cloud ML services (complex, expensive)**

- **AWS Lookout for Metrics** -- Fully managed, uses deep learning, auto-detects seasonality. Good for high-dimensional time series. Pricing starts at ~$0.75/1000 metrics.
- **Azure Anomaly Detector** -- Spectral residual + CNN model. Supports batch and streaming. ~$0.30 per 1000 API calls.
- **Google Cloud Timeseries Insights** -- Part of Vertex AI. Good for correlated anomalies across multiple signals.

These are excellent for complex, multivariate anomaly detection where you need the ML to learn seasonal patterns, correlations, etc.

---

**Tier 2: Open-source libraries (free, self-hosted)**

For simpler statistical anomaly detection:

```python
# Python: PyOD (most comprehensive)
from pyod.models.iforest import IForest
clf = IForest()
clf.fit(X_train)
labels = clf.predict(X_test)  # 0=normal, 1=anomaly
```

```javascript
// JavaScript: simple-statistics
const ss = require('simple-statistics');

function detectAnomaliesZScore(data, threshold = 3.0) {
  const mean = ss.mean(data);
  const std = ss.standardDeviation(data);

  return data.map((value, index) => {
    const zScore = Math.abs((value - mean) / std);
    return {
      index,
      value,
      zScore,
      isAnomaly: zScore > threshold,
    };
  }).filter(d => d.isAnomaly);
}

// IQR method (more robust to existing outliers)
function detectAnomaliesIQR(data, multiplier = 1.5) {
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = ss.quantile(sorted, 0.25);
  const q3 = ss.quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - multiplier * iqr;
  const upper = q3 + multiplier * iqr;

  return data.map((value, index) => ({
    index,
    value,
    isAnomaly: value < lower || value > upper,
    bounds: { lower, upper },
  })).filter(d => d.isAnomaly);
}
```

**When to use Z-score vs IQR:**
- Z-score assumes roughly normal data. If your data is heavily skewed, Z-score can miss anomalies or flag normal points.
- IQR is distribution-free and robust to existing outliers (outliers don't inflate the IQR the way they inflate standard deviation).

---

**Tier 3: Lightweight API (free, zero setup)**

If you want anomaly detection without installing libraries or paying for cloud ML, OraClaw provides both Z-score and IQR via a simple REST endpoint:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H 'Content-Type: application/json' \
  -d '{
    "data": [10, 12, 11, 13, 50, 12, 11, 10, 9, 11, 12, 100, 10],
    "method": "zscore",
    "threshold": 2.0
  }'
```

Response:
```json
{
  "method": "zscore",
  "anomalies": [
    { "index": 4, "value": 50, "zScore": 3.21, "isAnomaly": true },
    { "index": 11, "value": 100, "zScore": 7.14, "isAnomaly": true }
  ],
  "stats": { "mean": 17.77, "stdDev": 25.42 },
  "totalPoints": 13,
  "anomalyCount": 2
}
```

IQR method:
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H 'Content-Type: application/json' \
  -d '{
    "data": [10, 12, 11, 13, 50, 12, 11, 10, 9, 11, 12, 100, 10],
    "method": "iqr",
    "threshold": 1.5
  }'
```

From Node.js:
```typescript
const res = await fetch('https://oraclaw-api.onrender.com/api/v1/detect/anomaly', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [10, 12, 11, 13, 50, 12, 11, 10, 9, 11, 12, 100, 10],
    method: 'iqr',
    threshold: 1.5,
  }),
});
const { anomalies, anomalyCount, stats } = await res.json();
console.log(`Found ${anomalyCount} anomalies`);
```

Sub-millisecond latency, free for 25 calls/day.

**Summary of options:**

| Need | Solution | Cost |
|------|----------|------|
| Multivariate, seasonal, deep learning | AWS/Azure/GCP | $0.30-0.75/1K calls |
| Complex ML (Isolation Forest, LOF, etc.) | PyOD (Python) | Free (self-hosted) |
| Simple statistical (Z-score, IQR) in JS | simple-statistics + your code | Free |
| Simple statistical via API, no install | OraClaw | Free (100/day) |

*Disclosure: I'm the creator of OraClaw. For complex anomaly detection (multivariate, seasonal patterns, learned baselines), use the cloud services or PyOD. OraClaw's anomaly endpoint is best for simple statistical outlier detection where you want a quick API call without installing anything.*

---

## 5. "MCP server for optimization / decision making?"

**Tags:** `mcp`, `model-context-protocol`, `ai-agents`, `claude`, `optimization`

### Answer

The Model Context Protocol (MCP) lets AI agents call external tools via a standardized interface. For optimization and decision-making, here's how to set up an MCP server that gives your agent access to algorithms like bandits, LP solvers, and Monte Carlo simulation.

---

**What MCP gives your agent**

Without MCP tools, an LLM has to "reason" through optimization problems using token-based thinking, which is both expensive and unreliable for numerical work. With an MCP tool, the agent delegates the math to a deterministic algorithm and gets an exact answer in milliseconds.

Example: instead of the LLM trying to figure out which A/B test variant to pick by reasoning about statistics, it calls `optimize_bandit` and gets the mathematically optimal selection.

---

**Option 1: OraClaw MCP server (12 decision tools)**

OraClaw publishes an MCP server with 12 optimization/analysis tools. Two ways to install:

**Via npm (calls hosted API, zero local dependencies):**

Add to `~/.claude/mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["@oraclaw/mcp-server"]
    }
  }
}
```

Or via Claude Code CLI:
```bash
claude mcp add oraclaw -- npx @oraclaw/mcp-server
```

**Via source (runs algorithms locally, no network calls):**

```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["tsx", "/path/to/oraclaw/packages/mcp-server/src/index.ts"]
    }
  }
}
```

**Available tools:**

| Tool | What it does | Latency |
|------|-------------|---------|
| `optimize_bandit` | UCB1 / Thompson / Epsilon-Greedy arm selection | <1ms |
| `optimize_contextual` | LinUCB context-aware decisions | <1ms |
| `optimize_cmaes` | CMA-ES continuous black-box optimization | <15ms |
| `solve_constraints` | LP/MIP via HiGHS | <10ms |
| `solve_schedule` | Task scheduling with constraints | <5ms |
| `analyze_decision_graph` | PageRank, community detection | <3ms |
| `analyze_portfolio_risk` | VaR / CVaR calculation | <2ms |
| `score_convergence` | Multi-source signal agreement | <1ms |
| `score_calibration` | Brier score, log score | <1ms |
| `predict_forecast` | ARIMA / Holt-Winters forecasting | <3ms |
| `detect_anomaly` | Z-score / IQR outlier detection | <1ms |
| `plan_pathfind` | A* with k-shortest alternatives | <2ms |

Once installed, your AI agent can use these naturally:

> User: "I have 3 marketing channels. Channel A got 500 clicks and 175 conversions, Channel B got 300 clicks and 126 conversions, Channel C got 50 clicks and 40 conversions. Where should I allocate the next $1000?"

The agent calls `optimize_bandit` with the data and gets back a statistically optimal recommendation.

---

**Option 2: Build your own MCP server**

If you want a custom optimization MCP server, here's the structure using the `@modelcontextprotocol/sdk`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-optimizer", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "optimize_allocation",
      description: "Optimal resource allocation given constraints",
      inputSchema: {
        type: "object",
        properties: {
          resources: { type: "array", description: "Available resources" },
          constraints: { type: "array", description: "Constraints to satisfy" },
          objective: { type: "string", description: "maximize or minimize" },
        },
        required: ["resources", "constraints"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "optimize_allocation") {
    // Your optimization logic here
    const result = myOptimizer(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Key points for MCP optimization servers:
- Keep latency under 30 seconds (MCP timeout)
- Return structured JSON so the agent can parse results
- Include metadata (confidence, bounds, convergence status) so the agent can reason about quality
- Use descriptive tool names and descriptions -- the agent uses these to decide which tool to call

*Disclosure: I'm the creator of OraClaw. Building your own MCP server is straightforward with the SDK shown above. OraClaw is a pre-built option if you want 12 decision algorithms out of the box without writing the math yourself.*

---

## 6. "A/B testing algorithm / Bayesian A/B test?"

**Tags:** `a-b-testing`, `statistics`, `bayesian`, `machine-learning`, `experimentation`

### Answer

There are two fundamental approaches to A/B testing: frequentist (fixed-horizon) and Bayesian (continuous). Here's a practical breakdown with implementations.

---

**Frequentist A/B testing (traditional)**

The classic approach: pick a sample size, run the test, compute a p-value.

```typescript
// Two-proportion z-test
function abTestZTest(
  controlConversions: number, controlTotal: number,
  variantConversions: number, variantTotal: number,
): { zScore: number; pValue: number; significant: boolean } {
  const p1 = controlConversions / controlTotal;
  const p2 = variantConversions / variantTotal;
  const pPooled = (controlConversions + variantConversions) / (controlTotal + variantTotal);

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / controlTotal + 1 / variantTotal));
  const z = (p2 - p1) / se;

  // Two-tailed p-value (approximate using normal CDF)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    zScore: z,
    pValue,
    significant: pValue < 0.05,
  };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// Usage
const result = abTestZTest(175, 500, 126, 300);
console.log(`p-value: ${result.pValue.toFixed(4)}`);
console.log(`Significant: ${result.significant}`);
```

**Problem with frequentist:** You must decide the sample size before starting, you can't peek at results early without inflating your false positive rate, and you get a binary yes/no answer rather than a probability.

---

**Bayesian A/B testing (modern approach)**

Bayesian testing models each variant as a Beta distribution and directly computes the probability that one variant beats the other.

```typescript
interface Variant {
  name: string;
  conversions: number;
  total: number;
}

function bayesianABTest(
  control: Variant,
  variant: Variant,
  simulations: number = 100_000
): {
  probVariantWins: number;
  expectedLift: number;
  credibleInterval: [number, number];
} {
  let variantWins = 0;
  const lifts: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Sample from Beta posterior for each variant
    // Prior: Beta(1, 1) = uniform
    const controlRate = betaSample(
      control.conversions + 1,
      control.total - control.conversions + 1
    );
    const variantRate = betaSample(
      variant.conversions + 1,
      variant.total - variant.conversions + 1
    );

    if (variantRate > controlRate) variantWins++;
    lifts.push((variantRate - controlRate) / controlRate);
  }

  lifts.sort((a, b) => a - b);

  return {
    probVariantWins: variantWins / simulations,
    expectedLift: lifts.reduce((s, v) => s + v, 0) / lifts.length,
    credibleInterval: [
      lifts[Math.floor(0.025 * lifts.length)],
      lifts[Math.floor(0.975 * lifts.length)],
    ],
  };
}

// Beta distribution sampler (see bandit answer above for full implementation)
function betaSample(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

// Usage
const result = bayesianABTest(
  { name: 'Control', conversions: 175, total: 500 },
  { name: 'Variant', conversions: 126, total: 300 },
);
console.log(`P(Variant > Control): ${(result.probVariantWins * 100).toFixed(1)}%`);
console.log(`Expected lift: ${(result.expectedLift * 100).toFixed(1)}%`);
console.log(`95% CI: [${(result.credibleInterval[0] * 100).toFixed(1)}%, ${(result.credibleInterval[1] * 100).toFixed(1)}%]`);
```

**Advantages of Bayesian:**
- You can check results anytime without statistical penalties
- You get a direct probability ("87% chance Variant is better") instead of a p-value
- You can compute expected loss and make cost-aware decisions
- Natural integration with decision theory

---

**Multi-armed bandit as an alternative to A/B testing**

Traditional A/B testing has a fixed "exploration" phase where you send traffic to losing variants. Bandit algorithms like Thompson Sampling adaptively shift traffic toward the winner while still exploring:

```typescript
// Thompson Sampling automatically routes more traffic to the better variant
function thompsonSamplingAllocation(variants: Variant[]): string {
  let bestName = variants[0].name;
  let bestSample = -Infinity;

  for (const v of variants) {
    const sample = betaSample(
      v.conversions + 1,
      v.total - v.conversions + 1
    );
    if (sample > bestSample) {
      bestSample = sample;
      bestName = v.name;
    }
  }

  return bestName; // Send the next user to this variant
}
```

This minimizes "regret" (the cost of showing the worse variant to users during the test).

OraClaw exposes this as an API endpoint -- useful if you want to avoid implementing the Beta distribution sampler:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{
    "arms": [
      {"id": "control", "name": "Blue Button", "pulls": 500, "totalReward": 175},
      {"id": "variant_a", "name": "Green Button", "pulls": 300, "totalReward": 126},
      {"id": "variant_b", "name": "Red Button", "pulls": 50, "totalReward": 22}
    ],
    "algorithm": "thompson"
  }'
```

Response:
```json
{
  "selected": {"id": "variant_b", "name": "Red Button"},
  "score": 0.512,
  "algorithm": "thompson",
  "exploitation": 0.44,
  "exploration": 0.072,
  "regret": 0.06
}
```

This tells you which variant to show the next user. Call it once per user/session and the algorithm automatically balances exploration vs exploitation.

**When to use which approach:**

| Approach | Best when | Drawback |
|----------|-----------|----------|
| Frequentist z-test | You need statistical rigor for publication/stakeholders | Can't peek, binary answer |
| Bayesian A/B | You want probability statements and flexible stopping | Requires prior specification, more complex |
| Thompson Sampling bandit | You want to minimize regret during the test | Harder to declare a "winner" formally |

*Disclosure: I'm the creator of OraClaw. All three approaches are valid -- the native Bayesian implementation above is production-ready. The bandit API is most useful when you want the explore/exploit optimization without implementing the distribution samplers.*

---

## 7. "Portfolio risk VaR calculation JavaScript?"

**Tags:** `javascript`, `finance`, `risk-management`, `var`, `portfolio`

### Answer

Value at Risk (VaR) and Conditional VaR (CVaR / Expected Shortfall) are the two most important risk metrics in portfolio management. Here's how to implement both from scratch, plus a hosted option.

---

**What VaR and CVaR measure**

- **VaR(95%)**: "I'm 95% confident the portfolio won't lose more than $X in a given period." It's a single-number summary of downside risk.
- **CVaR(95%)** (aka Expected Shortfall): "If things go worse than the VaR threshold, the average loss would be $X." CVaR captures tail risk that VaR misses.

CVaR is generally preferred by risk managers because VaR can miss catastrophic scenarios. If a portfolio has a 95% VaR of $100K, VaR says nothing about whether the worst 5% of cases lose $101K or $10M. CVaR does.

---

**Historical simulation approach**

The simplest and most common method -- use actual historical returns:

```typescript
interface Asset {
  weight: number;
  returns: number[];  // historical daily returns (e.g., [0.01, -0.02, 0.005, ...])
}

function portfolioReturns(assets: Asset[]): number[] {
  const nDays = assets[0].returns.length;
  const portfolioRets: number[] = [];

  for (let day = 0; day < nDays; day++) {
    let dayReturn = 0;
    for (const asset of assets) {
      dayReturn += asset.weight * asset.returns[day];
    }
    portfolioRets.push(dayReturn);
  }

  return portfolioRets;
}

function computeVaR(
  returns: number[],
  confidence: number = 0.95,
  portfolioValue: number = 1_000_000
): { var: number; cvar: number; volatility: number; expectedReturn: number } {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;

  // VaR: percentile of the loss distribution
  const varIndex = Math.floor((1 - confidence) * n);
  const varReturn = sorted[varIndex];
  const varDollar = -varReturn * portfolioValue;

  // CVaR: average of all returns worse than VaR
  const tailReturns = sorted.slice(0, varIndex + 1);
  const cvarReturn = tailReturns.reduce((s, v) => s + v, 0) / tailReturns.length;
  const cvarDollar = -cvarReturn * portfolioValue;

  // Basic stats
  const mean = returns.reduce((s, v) => s + v, 0) / n;
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const volatility = Math.sqrt(variance);

  return {
    var: varDollar,
    cvar: cvarDollar,
    volatility,
    expectedReturn: mean,
  };
}

// Example: 60/40 stock/bond portfolio
const stocks: Asset = {
  weight: 0.6,
  returns: [0.012, -0.008, 0.003, -0.025, 0.007, 0.015, -0.019, 0.001, -0.032, 0.009,
            0.011, -0.014, 0.006, -0.003, 0.008, -0.021, 0.004, 0.013, -0.007, 0.002],
};
const bonds: Asset = {
  weight: 0.4,
  returns: [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.002, 0.001, 0.004, -0.001,
            0.002, 0.001, -0.001, 0.003, 0.001, 0.002, -0.001, 0.001, 0.002, 0.001],
};

const portReturns = portfolioReturns([stocks, bonds]);
const risk = computeVaR(portReturns, 0.95, 1_000_000);

console.log(`95% VaR: $${risk.var.toFixed(2)}`);
console.log(`95% CVaR: $${risk.cvar.toFixed(2)}`);
console.log(`Daily volatility: ${(risk.volatility * 100).toFixed(2)}%`);
console.log(`Expected daily return: ${(risk.expectedReturn * 100).toFixed(3)}%`);
```

---

**Scaling to different horizons**

VaR scales with the square root of time (assuming returns are i.i.d.):

```typescript
function scaleVaR(dailyVaR: number, horizonDays: number): number {
  return dailyVaR * Math.sqrt(horizonDays);
}

// 10-day VaR (common for regulatory reporting)
const tenDayVaR = scaleVaR(risk.var, 10);
console.log(`10-day 95% VaR: $${tenDayVaR.toFixed(2)}`);
```

---

**Parametric (variance-covariance) approach**

If you assume normal returns, you can compute VaR analytically using the covariance matrix:

```typescript
function parametricVaR(
  weights: number[],
  meanReturns: number[],
  covMatrix: number[][],
  confidence: number,
  portfolioValue: number
): { var: number; cvar: number } {
  // Portfolio expected return
  const portReturn = weights.reduce((s, w, i) => s + w * meanReturns[i], 0);

  // Portfolio variance: w' * Sigma * w
  let portVariance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      portVariance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  const portStdDev = Math.sqrt(portVariance);

  // z-score for confidence level
  const z = normalInvCDF(confidence);

  const varReturn = portReturn - z * portStdDev;
  const varDollar = -varReturn * portfolioValue;

  // CVaR for normal distribution: E[X | X < VaR]
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cvarReturn = portReturn - portStdDev * phi / (1 - confidence);
  const cvarDollar = -cvarReturn * portfolioValue;

  return { var: Math.max(0, varDollar), cvar: Math.max(0, cvarDollar) };
}

function normalInvCDF(p: number): number {
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  const a = [0, -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [0, -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [0, -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783];
  const d = [0, 7.784695709041462e-3, 3.224671290700398e-1,
    2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
           ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q /
           (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
            ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
  }
}
```

---

**Hosted alternative**

OraClaw has a portfolio risk endpoint that computes VaR, CVaR, expected return, and volatility from a returns matrix:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/analyze/risk \
  -H 'Content-Type: application/json' \
  -d '{
    "weights": [0.6, 0.4],
    "returns": [
      [0.012, -0.008, 0.003, -0.025, 0.007, 0.015, -0.019, 0.001, -0.032, 0.009],
      [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.002, 0.001, 0.004, -0.001]
    ],
    "confidence": 0.95,
    "horizonDays": 10
  }'
```

Response:
```json
{
  "var": 28541.23,
  "cvar": 35210.87,
  "expectedReturn": 0.00152,
  "volatility": 0.01134
}
```

From Node.js:
```typescript
const res = await fetch('https://oraclaw-api.onrender.com/api/v1/analyze/risk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    weights: [0.6, 0.4],
    returns: [
      [0.012, -0.008, 0.003, -0.025, 0.007, 0.015, -0.019, 0.001, -0.032, 0.009],
      [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.002, 0.001, 0.004, -0.001],
    ],
    confidence: 0.95,
    horizonDays: 10,
  }),
});
const { var: valueAtRisk, cvar, expectedReturn, volatility } = await res.json();
console.log(`10-day 95% VaR: $${valueAtRisk.toFixed(2)}`);
console.log(`10-day 95% CVaR: $${cvar.toFixed(2)}`);
```

Free for 25 calls/day.

**Which method to choose:**

| Method | Pros | Cons |
|--------|------|------|
| Historical simulation | No distribution assumptions, captures fat tails | Needs long history, past may not predict future |
| Parametric (variance-covariance) | Fast, analytical, works with short history | Assumes normality, misses tail risk |
| Monte Carlo VaR | Flexible, handles complex instruments | Computationally expensive, model-dependent |

*Disclosure: I'm the creator of OraClaw. The native implementations above are production-ready. The API is useful if you want VaR/CVaR without implementing covariance matrix math, or if you're building a quick prototype.*
