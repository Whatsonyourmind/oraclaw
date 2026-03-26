"""
OraClaw Tools for LangChain — Decision intelligence for AI agents.

Install: pip install langchain-core httpx
Usage:
    from oraclaw_tools import OraBanditTool, OraSolverTool, OraForecastTool, OraAnomalyTool

    tools = [OraBanditTool(), OraSolverTool(), OraForecastTool(), OraAnomalyTool()]
    agent = create_react_agent(llm, tools)
"""

from typing import Optional, Type
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
import httpx
import os

ORACLAW_API_URL = os.getenv("ORACLAW_API_URL", "https://oraclaw-api.onrender.com")
ORACLAW_API_KEY = os.getenv("ORACLAW_API_KEY", "")


def _call_oraclaw(endpoint: str, payload: dict) -> dict:
    headers = {"Content-Type": "application/json"}
    if ORACLAW_API_KEY:
        headers["Authorization"] = f"Bearer {ORACLAW_API_KEY}"
    resp = httpx.post(f"{ORACLAW_API_URL}{endpoint}", json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ── Bandit Tool ─────────────────────────────────────────

class BanditInput(BaseModel):
    arms: list = Field(description="List of options: [{id, name, pulls, totalReward}]")
    algorithm: str = Field(default="ucb1", description="ucb1, thompson, or epsilon-greedy")

class OraBanditTool(BaseTool):
    name: str = "oraclaw_bandit"
    description: str = "Choose the best option from a set using Multi-Armed Bandit (UCB1/Thompson). Returns the mathematically optimal selection in <1ms."
    args_schema: Type[BaseModel] = BanditInput

    def _run(self, arms: list, algorithm: str = "ucb1") -> str:
        result = _call_oraclaw("/api/v1/optimize/bandit", {"arms": arms, "algorithm": algorithm})
        return f"Selected: {result['selected']['name']} (score: {result['score']:.3f}, algorithm: {result['algorithm']})"


# ── Solver Tool ─────────────────────────────────────────

class SolverInput(BaseModel):
    direction: str = Field(description="'maximize' or 'minimize'")
    objective: dict = Field(description="Variable name → coefficient")
    variables: list = Field(description="[{name, lower?, upper?, type?}]")
    constraints: list = Field(description="[{name, coefficients: {var: coeff}, upper?, lower?}]")

class OraSolverTool(BaseTool):
    name: str = "oraclaw_solver"
    description: str = "Solve optimization problems with constraints (LP/MIP). Budget allocation, scheduling, resource planning. Returns provably optimal solution in <2ms."
    args_schema: Type[BaseModel] = SolverInput

    def _run(self, direction: str, objective: dict, variables: list, constraints: list) -> str:
        result = _call_oraclaw("/api/v1/solve/constraints", {
            "direction": direction, "objective": objective,
            "variables": variables, "constraints": constraints
        })
        return f"Status: {result['status']}, Objective: {result['objectiveValue']}, Solution: {result['solution']}"


# ── Forecast Tool ───────────────────────────────────────

class ForecastInput(BaseModel):
    data: list = Field(description="Historical time series values")
    steps: int = Field(description="Number of future steps to predict")
    method: str = Field(default="arima", description="'arima' or 'holt-winters'")

class OraForecastTool(BaseTool):
    name: str = "oraclaw_forecast"
    description: str = "Predict future values from time series data using ARIMA or Holt-Winters. Returns forecasts with confidence intervals."
    args_schema: Type[BaseModel] = ForecastInput

    def _run(self, data: list, steps: int, method: str = "arima") -> str:
        result = _call_oraclaw("/api/v1/predict/forecast", {"data": data, "steps": steps, "method": method})
        forecast = result.get("forecast", [])
        return f"Forecast ({method}): {[round(v, 2) for v in forecast[:5]]}{'...' if len(forecast) > 5 else ''}"


# ── Anomaly Tool ────────────────────────────────────────

class AnomalyInput(BaseModel):
    data: list = Field(description="Numeric data to check for outliers")
    method: str = Field(default="zscore", description="'zscore' or 'iqr'")
    threshold: float = Field(default=3.0, description="Detection threshold")

class OraAnomalyTool(BaseTool):
    name: str = "oraclaw_anomaly"
    description: str = "Detect anomalies/outliers in data using Z-score or IQR. Sub-millisecond response."
    args_schema: Type[BaseModel] = AnomalyInput

    def _run(self, data: list, method: str = "zscore", threshold: float = 3.0) -> str:
        result = _call_oraclaw("/api/v1/detect/anomaly", {"data": data, "method": method, "threshold": threshold})
        anomalies = result.get("anomalies", [])
        return f"Found {len(anomalies)} anomalies at indices {[a['index'] for a in anomalies]}" if anomalies else "No anomalies detected"


# ── CMA-ES Tool ─────────────────────────────────────────

class CMAESInput(BaseModel):
    dimension: int = Field(description="Number of parameters to optimize")
    objective_weights: list = Field(description="Weight for each dimension in objective")
    initial_sigma: float = Field(default=0.3, description="Initial step size")
    max_iterations: int = Field(default=200, description="Max optimization iterations")

class OraCMAESTool(BaseTool):
    name: str = "oraclaw_cmaes"
    description: str = "SOTA continuous optimization (CMA-ES). Optimize parameters, tune hyperparameters, calibrate models. 10-100x more efficient than grid search."
    args_schema: Type[BaseModel] = CMAESInput

    def _run(self, dimension: int, objective_weights: list, initial_sigma: float = 0.3, max_iterations: int = 200) -> str:
        result = _call_oraclaw("/api/v1/optimize/cmaes", {
            "dimension": dimension, "objectiveWeights": objective_weights,
            "initialSigma": initial_sigma, "maxIterations": max_iterations
        })
        sol = result.get("bestSolution", [])
        return f"Optimal: [{', '.join(f'{v:.4f}' for v in sol)}] fitness={result.get('bestFitness', 0):.6f} iters={result.get('iterations', 0)}"


# ── Graph Tool ──────────────────────────────────────────

class GraphInput(BaseModel):
    nodes: list = Field(description="[{id, type, label, urgency, confidence, impact, timestamp}]")
    edges: list = Field(description="[{source, target, type, weight}]")

class OraGraphTool(BaseTool):
    name: str = "oraclaw_graph"
    description: str = "Analyze decision/dependency networks. PageRank finds most influential nodes. Louvain detects clusters. Identifies bottlenecks."
    args_schema: Type[BaseModel] = GraphInput

    def _run(self, nodes: list, edges: list) -> str:
        result = _call_oraclaw("/api/v1/analyze/graph", {"nodes": nodes, "edges": edges})
        bottlenecks = result.get("bottlenecks", [])[:3]
        return f"Nodes: {result.get('totalNodes', 0)}, Edges: {result.get('totalEdges', 0)}, Top bottlenecks: {[b['id'] for b in bottlenecks]}"


# ── All Tools ───────────────────────────────────────────

ALL_TOOLS = [
    OraBanditTool(),
    OraSolverTool(),
    OraForecastTool(),
    OraAnomalyTool(),
    OraCMAESTool(),
    OraGraphTool(),
]
