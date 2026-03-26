# OraClaw API — Full Endpoint Test Results
**Date**: March 26, 2026 02:30 CET
**Server**: localhost:3001 (tsx apps/api/src/server.ts)
**Status**: ALL 17 ENDPOINTS PASSING

## Results Summary

| # | Endpoint | Status | Key Result |
|---|----------|--------|------------|
| 1 | POST /optimize/bandit | PASS | UCB1 selected "Homepage V3", score 1.42 |
| 2 | POST /optimize/contextual-bandit | PASS | LinUCB selected "Email Campaign", reward 0.82 |
| 3 | POST /optimize/evolve | PASS | GA converged gen 38, fitness 5/5 |
| 4 | POST /optimize/cmaes | PASS | 3D optimization in 5ms, 100 iterations |
| 5 | POST /simulate/montecarlo | PASS | Mean $99,838, StdDev $14,933, 5K iterations |
| 6 | POST /simulate/scenario | PASS | 3 scenarios, +57% bull / -17% bear |
| 7 | POST /solve/schedule | PASS | 3/3 tasks assigned, score 21 |
| 8 | POST /solve/constraints | PASS | LP optimal $5,529, 79ms solve |
| 9 | POST /analyze/graph | PASS | PageRank: DB highest (0.34), bottleneck detected |
| 10 | POST /analyze/risk | PASS | VaR 0.81%, CVaR 1.21%, 95% confidence |
| 11 | POST /predict/bayesian | PASS | Prior 0.3 → Posterior 0.4 |
| 12 | POST /predict/ensemble | PASS | Consensus 0.726, agreement 0.917 |
| 13 | POST /predict/forecast | PASS | Holt-Winters: 158→175 trend, 6 steps |
| 14 | POST /detect/anomaly | PASS | Found outlier at idx 6 (z=2.97) |
| 15 | POST /score/convergence | PASS | Score 0.849, 3-source agreement |
| 16 | POST /score/calibration | PASS | Brier 0.117, log score 0.388 |
| 17 | POST /plan/pathfind | PASS | Path: start→factory→customer, cost 20, 3 alternatives |

## Correct Request Formats (for SDK/MCP/docs)

### /simulate/montecarlo
```json
{
  "distribution": "normal",
  "params": {"mean": 100000, "stddev": 15000},
  "simulations": 5000
}
```

### /simulate/scenario
```json
{
  "baseCase": {"revenue": 100000, "costs": 75000},
  "scenarios": [
    {"name": "Bull", "variables": {"revenue": 180000, "costs": 95000}},
    {"name": "Bear", "variables": {"revenue": 65000, "costs": 80000}}
  ]
}
```

### /solve/schedule
```json
{
  "tasks": [
    {"id": "t1", "name": "Report", "durationMinutes": 120, "priority": 9, "energyRequired": "high"}
  ],
  "slots": [
    {"id": "morning", "startTime": 1774487105000, "durationMinutes": 180, "energyLevel": "high"}
  ]
}
```

### /score/convergence
```json
{
  "sources": [
    {"id": "src1", "name": "Source 1", "probability": 0.72, "confidence": 0.9, "lastUpdated": 1774487105000}
  ]
}
```

### /plan/pathfind
```json
{
  "nodes": [{"id": "A", "cost": 0}],
  "edges": [{"from": "A", "to": "B", "cost": 5}],
  "start": "A",
  "end": "B",
  "kPaths": 3
}
```

### /predict/ensemble
```json
{
  "predictions": [
    {"modelId": "m1", "prediction": 0.75, "confidence": 0.9}
  ],
  "method": "weighted-voting"
}
```

### /predict/forecast
Requires 20+ data points:
```json
{
  "data": [100,105,102,110,...],
  "steps": 6,
  "method": "holt-winters"
}
```

## Pricing Endpoint
GET /api/v1/pricing — returns tier info and rates
GET /api/v1/usage — returns usage stats for authenticated user
