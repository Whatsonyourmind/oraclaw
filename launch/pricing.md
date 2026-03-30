# OraClaw - Pricing

## Plans

### Free

**$0/month**

- 100 API calls per day
- All 19 algorithms included
- No authentication required
- No credit card needed
- Community support
- Best for: Trying out algorithms, prototyping, hobby projects

---

### Starter

**$9/month**

- 10,000 API calls per month
- All 19 algorithms included
- API key authentication
- Usage dashboard
- Email support
- Best for: Side projects, small apps, individual developers

---

### Growth

**$49/month**

- 100,000 API calls per month
- All 19 algorithms included
- API key authentication
- Usage dashboard + analytics
- Priority email support
- Webhook notifications
- Best for: Production apps, growing startups, AI agent platforms

---

### Scale

**$199/month**

- 1,000,000 API calls per month
- All 19 algorithms included
- API key authentication
- Full analytics + audit logs
- Priority support (24h response)
- Custom rate limits
- SLA: 99.9% uptime
- Best for: High-volume applications, enterprise integrations, multi-agent systems

---

### Enterprise

**Custom pricing**

- Unlimited API calls
- Dedicated infrastructure
- Custom algorithm development
- On-premise deployment option
- Dedicated support + SLA
- SSO/SAML integration
- Contact: luka.stanisljevic@gmail.com

---

## USDC Pay-Per-Call (x402 Protocol)

For AI agents that pay autonomously. No subscription needed. No API key needed. Agent includes USDC payment with each request via the x402 protocol on Base network.

| Algorithm Category | Price Per Call |
|--------------------|---------------|
| Calibration Scoring | $0.01 |
| Multi-Armed Bandit | $0.01 |
| Anomaly Detection | $0.02 |
| Bayesian Inference | $0.02 |
| Contextual Bandit | $0.02 |
| Convergence Scoring | $0.02 |
| A* Pathfinding | $0.03 |
| Ensemble Model | $0.05 |
| Decision Graph | $0.05 |
| Monte Carlo Simulation | $0.05 |
| Time Series Forecast | $0.05 |
| Scenario Planning | $0.08 |
| CMA-ES Optimizer | $0.10 |
| Constraint Solver (LP/MIP) | $0.10 |
| Genetic Algorithm | $0.10 |
| Portfolio Risk (VaR/CVaR) | $0.10 |
| Schedule Optimizer | $0.10 |

Receiving wallet: `0x450996401D587C8206803F544cCA74C33f6FbC93` (Base network)

---

## All Plans Include

- Access to all 19 algorithms (no feature gating)
- Sub-25ms response times
- Structured JSON responses
- MCP server compatibility
- npm SDK access (@oraclaw/*)
- MIT licensed client libraries

---

## FAQ

**Do I need an API key for the free tier?**
No. The free tier works without any authentication. Just send a request.

**Can I switch plans at any time?**
Yes. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.

**What happens if I exceed my plan limits?**
Requests return a 429 status code. Upgrade your plan or wait for the next billing period.

**Can AI agents use the subscription plans?**
Yes. Any client that includes the API key header can use subscription plans. x402 is an additional option for keyless autonomous payments.

**Is there a self-hosted option?**
Yes. OraClaw is MIT licensed. Clone the repo and run it on your own infrastructure. Enterprise customers get deployment support.

**What's the SLA?**
Free/Starter/Growth: best-effort. Scale: 99.9% uptime. Enterprise: custom SLA.
