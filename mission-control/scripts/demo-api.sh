#!/bin/bash
# ============================================================
# OraClaw API Demo — curl examples for all 17 endpoints
# ============================================================
# Usage:
#   bash scripts/demo-api.sh                    # localhost:3001
#   bash scripts/demo-api.sh https://oraclaw.dev  # production
# ============================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3001}"
PASS=0
FAIL=0

echo "============================================================"
echo "  OraClaw API Demo"
echo "  Target: $BASE_URL"
echo "============================================================"
echo ""

run_test() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="${4:-}"

  echo "--- $name ---"
  echo "  $method $endpoint"

  local status
  if [ "$method" = "GET" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    if [ "$status" = "200" ]; then
      echo "  OK ($status)"
      curl -s "$BASE_URL$endpoint" | head -c 300
      echo ""
      PASS=$((PASS + 1))
    else
      echo "  FAIL ($status)"
      FAIL=$((FAIL + 1))
    fi
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
    if [ "$status" = "200" ]; then
      echo "  OK ($status)"
      curl -s -X POST "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data" | head -c 300
      echo ""
      PASS=$((PASS + 1))
    else
      echo "  FAIL ($status)"
      FAIL=$((FAIL + 1))
    fi
  fi
  echo ""
}

# ── 1. Health Check ────────────────────────────────────────
run_test "Health Check" "GET" "/api/v1/health"

# ── 2. Pricing ─────────────────────────────────────────────
run_test "Pricing" "GET" "/api/v1/pricing"

# ── 3. Multi-Armed Bandit ──────────────────────────────────
run_test "Bandit (UCB1)" "POST" "/api/v1/optimize/bandit" '{
  "arms": [
    {"id": "a", "name": "Variant A", "pulls": 100, "totalReward": 35},
    {"id": "b", "name": "Variant B", "pulls": 80, "totalReward": 32},
    {"id": "c", "name": "Variant C", "pulls": 50, "totalReward": 22}
  ],
  "algorithm": "ucb1"
}'

# ── 4. Contextual Bandit ──────────────────────────────────
run_test "Contextual Bandit" "POST" "/api/v1/optimize/contextual-bandit" '{
  "arms": [
    {"id": "deep-work", "name": "Deep Work"},
    {"id": "quick-tasks", "name": "Quick Tasks"}
  ],
  "context": [0.8, 0.9, 0.2],
  "history": [
    {"armId": "deep-work", "reward": 0.9, "context": [0.3, 0.9, 0.1]},
    {"armId": "quick-tasks", "reward": 0.7, "context": [0.8, 0.3, 0.9]}
  ]
}'

# ── 5. Constraint Solver ──────────────────────────────────
run_test "Constraint Solver" "POST" "/api/v1/solve/constraints" '{
  "direction": "maximize",
  "objective": {"ads": 2.5, "content": 1.8, "events": 3.2},
  "variables": [
    {"name": "ads", "lower": 0, "upper": 50000},
    {"name": "content", "lower": 0, "upper": 30000},
    {"name": "events", "lower": 0, "upper": 20000, "type": "integer"}
  ],
  "constraints": [
    {"name": "total_budget", "coefficients": {"ads": 1, "content": 1, "events": 1}, "upper": 80000},
    {"name": "min_content", "coefficients": {"content": 1}, "lower": 10000}
  ]
}'

# ── 6. Schedule Optimizer ──────────────────────────────────
run_test "Schedule Optimizer" "POST" "/api/v1/solve/schedule" '{
  "tasks": [
    {"id": "report", "name": "Q1 Report", "durationMinutes": 120, "priority": 9, "energyRequired": "high"},
    {"id": "emails", "name": "Clear Inbox", "durationMinutes": 30, "priority": 3, "energyRequired": "low"}
  ],
  "slots": [
    {"id": "morning", "startTime": 1711350000, "durationMinutes": 120, "energyLevel": "high"},
    {"id": "late-pm", "startTime": 1711369800, "durationMinutes": 30, "energyLevel": "low"}
  ]
}'

# ── 7. Decision Graph ─────────────────────────────────────
run_test "Decision Graph" "POST" "/api/v1/analyze/graph" '{
  "nodes": [
    {"id": "auth", "type": "action", "label": "Build Auth", "urgency": "critical", "confidence": 0.8, "impact": 0.9, "timestamp": 1711350000000},
    {"id": "payments", "type": "action", "label": "Stripe", "urgency": "high", "confidence": 0.6, "impact": 0.8, "timestamp": 1711350000000},
    {"id": "launch", "type": "goal", "label": "Launch", "urgency": "critical", "confidence": 0.5, "impact": 1.0, "timestamp": 1711350000000}
  ],
  "edges": [
    {"source": "auth", "target": "payments", "type": "enables", "weight": 0.9},
    {"source": "payments", "target": "launch", "type": "enables", "weight": 0.9}
  ],
  "sourceGoal": "auth",
  "targetGoal": "launch"
}'

# ── 8. Convergence Scoring ─────────────────────────────────
run_test "Convergence Scoring" "POST" "/api/v1/score/convergence" '{
  "sources": [
    {"id": "poly", "name": "Polymarket", "probability": 0.67, "volume": 5000000, "lastUpdated": 1711350000000},
    {"id": "kalshi", "name": "Kalshi", "probability": 0.72, "volume": 3000000, "lastUpdated": 1711350000000},
    {"id": "meta", "name": "Metaculus", "probability": 0.63, "lastUpdated": 1711350000000}
  ]
}'

# ── 9. Calibration Scoring ─────────────────────────────────
run_test "Calibration Scoring" "POST" "/api/v1/score/calibration" '{
  "predictions": [0.80, 0.65, 0.30, 0.90, 0.55, 0.10],
  "outcomes": [1, 1, 0, 1, 0, 0]
}'

# ── 10. Monte Carlo Simulation ─────────────────────────────
run_test "Monte Carlo" "POST" "/api/v1/simulate/montecarlo" '{
  "distribution": "normal",
  "params": {"mean": 100000, "stddev": 25000},
  "iterations": 1000
}'

# ── 11. Genetic Algorithm ──────────────────────────────────
run_test "Genetic Algorithm" "POST" "/api/v1/optimize/evolve" '{
  "populationSize": 30,
  "maxGenerations": 50,
  "geneLength": 3,
  "bounds": {"min": 0, "max": 100},
  "fitnessWeights": [0.5, 0.3, 0.2]
}'

# ── 12. Bayesian Inference ─────────────────────────────────
run_test "Bayesian" "POST" "/api/v1/predict/bayesian" '{
  "prior": 0.5,
  "evidence": [
    {"factor": "market_data", "weight": 0.3, "value": 0.75},
    {"factor": "expert_opinion", "weight": 0.2, "value": 0.60},
    {"factor": "base_rate", "weight": 0.5, "value": 0.40}
  ]
}'

# ── 13. Ensemble Consensus ─────────────────────────────────
run_test "Ensemble" "POST" "/api/v1/predict/ensemble" '{
  "predictions": [
    {"modelId": "claude", "prediction": 0.72, "confidence": 0.85, "historicalAccuracy": 0.78},
    {"modelId": "gpt", "prediction": 0.68, "confidence": 0.80, "historicalAccuracy": 0.74},
    {"modelId": "gemini", "prediction": 0.45, "confidence": 0.70, "historicalAccuracy": 0.65}
  ]
}'

# ── 14. Scenario Planning ─────────────────────────────────
run_test "Scenario" "POST" "/api/v1/simulate/scenario" '{
  "scenarios": [
    {"name": "Aggressive", "variables": {"spend": 100000, "price": 29, "team": 10}},
    {"name": "Conservative", "variables": {"spend": 30000, "price": 49, "team": 5}}
  ],
  "baseCase": {"spend": 50000, "price": 39, "team": 6}
}'

# ── 15. A* Pathfinding ────────────────────────────────────
run_test "Pathfinding" "POST" "/api/v1/plan/pathfind" '{
  "nodes": [
    {"id": "start", "cost": 0},
    {"id": "mid", "cost": 3},
    {"id": "end", "cost": 0}
  ],
  "edges": [
    {"from": "start", "to": "mid", "cost": 5},
    {"from": "mid", "to": "end", "cost": 3}
  ],
  "start": "start",
  "end": "end"
}'

# ── 16. Time Series Forecast ──────────────────────────────
run_test "Forecast" "POST" "/api/v1/predict/forecast" '{
  "data": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
  "steps": 3,
  "method": "holt-winters",
  "seasonLength": 4
}'

# ── 17. Anomaly Detection ─────────────────────────────────
run_test "Anomaly Detection" "POST" "/api/v1/detect/anomaly" '{
  "data": [1, 2, 3, 100, 2, 3, 1],
  "method": "zscore",
  "threshold": 2.0
}'

# ── 18. CMA-ES Optimization ──────────────────────────────
run_test "CMA-ES" "POST" "/api/v1/optimize/cmaes" '{
  "dimension": 2,
  "objectiveWeights": [1.0, 0.5],
  "maxIterations": 100
}'

# ── 19. Portfolio Risk ────────────────────────────────────
run_test "Portfolio Risk" "POST" "/api/v1/analyze/risk" '{
  "weights": [0.6, 0.4],
  "returns": [
    [0.01, -0.02, 0.03, 0.01, -0.01],
    [0.02, 0.01, -0.01, 0.02, 0.00]
  ],
  "confidence": 0.95
}'

# ── 20. Batch (multiple algorithms in one call) ──────────
run_test "Batch" "POST" "/api/v1/batch" '{
  "calls": [
    {"algorithm": "score/calibration", "params": {"predictions": [0.9, 0.7], "outcomes": [1, 0]}},
    {"algorithm": "detect/anomaly", "params": {"data": [1, 2, 100, 2, 1], "method": "zscore"}}
  ]
}'

# ── Summary ────────────────────────────────────────────────
echo "============================================================"
echo "  RESULTS: $PASS passed, $FAIL failed out of $((PASS + FAIL)) endpoints"
echo "============================================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
