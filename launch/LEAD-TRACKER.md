# OraClaw Lead Pipeline

**Last updated:** 2026-04-08 EOD (post-audit: fork check + registry PR audit + hideya reactivation rules)
**Single source of truth** -- update after every lead interaction.

## Related docs (read before engaging)

- [`REGISTRY-PR-STATUS.md`](REGISTRY-PR-STATUS.md) — all outbound marketplace PR status, check before opening new ones
- [`REACTIVATION-TRIGGERS.md`](REACTIVATION-TRIGGERS.md) — paused leads and their specific re-engagement triggers (do NOT drip-feed updates)
- [`OPERATING-RULES.md`](OPERATING-RULES.md) — banned repos, daily limits, rules that override strategy
- [`BETA-KEYS.md`](BETA-KEYS.md) — issued beta keys (gitignored content, do not post in public)

## Repo inbound signals (check weekly)

| Signal | State Apr 8 | Notes |
|---|---|---|
| Stars | 7 | Flat baseline |
| Forks | **2** | `hideya/oraclaw` (Mar 27, testing clone, no changes of their own), `hardspoon/oraclaw` (Apr 4, 1,134-repo bulk-forker, almost certainly automated) |
| Subscribers | 0 | No one watching for release updates |
| Open issues (non-bot) | 0 | **ZERO inbound bug reports in 14 days** — strongest evidence telemetry=0 is real, not a measurement gap |
| Traffic (14d) | 1,272 clones / 272 unique IPs, 346 views / 97 unique | ~40x clone-to-star ratio → almost certainly bot/registry scraping, not user traffic |
| PRs (inbound, both repos) | 0 | No community contribution yet |

## Tier 1: HOT (Active Usage or Deep Multi-Turn)

| Lead | Platform | Last Contact | Beta Key | API Calls | Next Action |
|------|----------|-------------|----------|-----------|-------------|
| **juliosuas** | GitHub #13 | Apr 5 | Issued | 0 | Follow up Apr 9 if still silent (4 days out) |
| ~~**radoxtech**~~ | GitHub diricode#537 | Apr 6 | Issued | 0 | **DECLINED (security concerns).** Closed gracefully. Do NOT re-engage. Mass-close notifications are noise. |
| **hideya** | GitHub langchain-mcp-tools-py#51 | Apr 6 | Issued | 0 | **PAUSED — wait for trigger.** See [REACTIVATION-TRIGGERS.md](REACTIVATION-TRIGGERS.md#hideya--langchain-mcp-tools-py-maintainer). Earliest re-engagement: patent filing OR arXiv preprint. Do not drip-feed updates. |
| **vstash (@stffns)** | GitHub vstash#89 | Apr 5 | Issued | 0 | **11th IMPLEMENTATION** (IDF-sigmoid weighting in v0.17.0). Awaiting reply on convergence scoring offer. |
| **heisenberg (@kamilpajak)** | GitHub heisenberg#50 | Apr 5 | Issued | 0 | Awaiting reply |
| **rfivesix (hypertrack)** | GitHub hypertrack#210 | Apr 8 | — | 0 | **12th IMPLEMENTATION** — phase-aware kcal/kg ramp shipped in 0.8.0-beta. Active multi-turn collab, model "in a very strong place" per maintainer Apr 8. |
| **stxkxs (nanohype)** | GitHub nanohype#16 | Apr 7 | — | 0 | **11th IMPLEMENTATION** — contextual bandit routing, strategy registry, cost anomaly, LinUCB roadmap all shipped. "Your input shaped a lot of what shipped." Closed positively, monitor. |
| **KaiBuildsx (Moltbook)** | Moltbook d37e32fa | Apr 7 | — | — | **11th IMPLEMENTATION** — Bayesian-prior-for-memory-files as (observation, weight, n) tuples. Closed positively. |
| **AlanHuang99 (pyrollmatch)** | GitHub pyrollmatch#5 | Apr 8 | — | 0 | **11th ship IMPLEMENTATION** — entropy balancing (`method="ebal"`) in v0.1.3. Just replied with CBPS+IPW implementation sketch for v0.1.4. |

## Tier 2: WARM (Positive Engagement, No Install Yet)

| Lead | Platform | Last Contact | Signal | Next Action |
|------|----------|-------------|--------|-------------|
| Ravenwater (T. Omtzigt) | GitHub | Apr 3 | Starred, HPC architect, 78 followers | Submit PR to universal #196 |
| koordinator @0x-auth | GitHub #2837 | Apr 4 | Deep V3 scoring, Alibaba K8s 1.7K stars | Monitor for follow-up |
| ali_muwwakkil | Dev.to | Apr 3 | MD at Colaberry, enterprise AI | Paste drafted reply |
| @oglego (linfa) | GitHub #436 | Apr 4 | Implementing sMAPE fix, 4.6K Rust ML | Monitor PR |
| @mahi-ma (darts) | GitHub #3054 | Apr 4 | Raising PR next week, 9.3K forecasting | Monitor PR |
| @paperman5 (godot) | GitHub #112705 | Apr 4 | Catastrophic cancellation fix, 109K stars | Monitor PR |
| @Tanishq-mellu (OWASP) | GitHub #4200 | Apr 4 | Implementing ranking, 409 stars | Monitor |
| @mmujtaba0085 (networkx) | GitHub #8589 | Apr 4 | Butterfly counting, 15K graph library | Monitor |
| @CatFootPrint (PyTorch) | GitHub #179111 | Apr 4 | E4M3 subnormal, 99K ML framework | Monitor |
| @Ruthwik-Data (deepeval) | GitHub #2594 | Apr 4 | Co-designed precision API, 14K RAG eval | Monitor |
| @0x-auth (kai-scheduler) | GitHub #1373 | Apr 4 | Adopted scoring suggestions, 1.2K GPU scheduler | Watch PR #1374 |
| @leomerida15 (FlowiseAI) | GitHub #5601 | Apr 4 | Building MCP skills, 51.5K agent builder | Offer testing help + beta key |
| han-sajang | Moltbook | Apr 3 | SynapseAI, integration potential | Check DMs |
| libre-coordinator | Moltbook | Apr 3 | 754 karma influencer | Keep engaging on math threads |

## New Prospects (Apr 5 — Pure Math Outreach)

| Lead | Repo | Stars | Issue | Algorithm Match | Status |
|------|------|-------|-------|-----------------|--------|
| VANDRANKI | fm_mortgage_risk_lab | 1 | #1 MC VaR | Monte Carlo + VaR/CVaR | Replied (Apr 5) |
| marcuscastelo | macroflows | 0 | #864 Diet LP | LP/MIP solver | Replied (Apr 5) |
| schmisu | airtable-demo | 0 | #7 A/B routing | Multi-Armed Bandit | Replied (Apr 5) |
| celilozknn | CMPE492-Project | 0 | #8 PageRank | Graph analytics | Replied (Apr 5) |
| ai4change-org | problems | 0 | #23 Refugee allocation | LP + A* + Anomaly | Replied (Apr 5) |

## Tier 3: MONITORING (Single Signal)

| Lead | Platform | Signal |
|------|----------|--------|
| @mittayrmalak-boop | FlowiseAI | Validated MCP approach |
| @xiedeyantu | DataFusion #8.6K | UNION DISTINCT rewrite |
| @Mizux | Google OR-Tools 13K | Confirmed v10 fix (Google maintainer) |
| @stxkxs | nanohype | Implementing LinUCB routing |
| @Camilu-png | GitHub | Implementing SA with adaptive cooling |
| @andrewgreenh | Medusa 33K | Multi-location allocation |
| @error414 | iNavFlight 4K | CPA-based avoidance |
| @hawkfish | DuckDB 27K | GROUPS framing context (core dev) |
| nchokoev | GitHub | Starred |
| ccarvalho-eng | GitHub | Starred, Elixir dev, 41 followers |
| AidanTheBandit | GitHub | Starred, young developer |

## Conversion Metrics

| Metric | Current | Target (Day 14) | Target (Day 30) |
|--------|---------|-----------------|-----------------|
| Beta keys issued | 0 | 5 | 5+ |
| API signups | 0 | 5+ | 10+ |
| External API calls | 0 | 50+ | 200+ |
| Paying customers | 0 | 0 | 1+ |
