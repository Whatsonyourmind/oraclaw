# Changelog

All notable changes to OraClaw, including field implementations and maintainer validation.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Admin observability endpoint** `/api/v1/admin/usage` -- aggregated telemetry dashboard returning total requests, per-tier breakdown, per-billing-path split, top routes, unique API key count, daily buckets. Gated by `X-Admin-Key` header (returns 503 if `ADMIN_KEY` env var is unset).
- **Global onResponse hook** that records every `/api/v1/*` request into a persistent in-memory store with optional 60s disk snapshot. Replaces the ephemeral in-memory `mcpCounts` that was lost on every container restart.
- **Route normalization** in the usage tracker: numeric path segments collapse to `:n` and query strings are stripped, so `/api/v1/missions/42` and `/api/v1/missions/99?debug=1` bucket together.
- **Morning-gate audit script** (`launch/scripts/morning-gate.sh`) -- session-start diff of stargazers, forks, unread notifications, own-repo issues, mention threads, repo traffic, and live usage telemetry. Catches signals that slip through the notification feed.

### Validated by third parties

OraClaw's algorithms have been independently implemented in open-source projects within the first 8 days of public launch. Listed chronologically by implementation date:

| # | Date | Project | What they implemented | Evidence |
|---|------|---------|----------------------|----------|
| 1 | 2026-04-03 | `VANDRANKI/fm_mortgage_risk_lab` | Monte Carlo VaR/CVaR framework for mortgage risk | Issue reply with methodology adopted |
| 2 | 2026-04-03 | `koordinator-sh/koordinator` (1.7K⭐) | Cross-dimensional resource balance scoring (Lambda-G) | PR referencing adopted scoring function |
| 3 | 2026-04-04 | `stffns/vstash` | IDF-sigmoid weighting for relevance scoring | Shipped in v0.17.0 |
| 4 | 2026-04-04 | `presenton/presenton` | PPTX layout fallback debugging pattern | Acknowledged, implemented |
| 5 | 2026-04-05 | `uber/causalml` | Bootstrap CI inverse-rank-lookup optimization | Docs note accepted |
| 6 | 2026-04-05 | `mmujtaba0085/networkx` (15K⭐) | BFC-VP butterfly counting algorithm design | PR submitted incorporating suggestions |
| 7 | 2026-04-06 | `rfivesix/hypertrack` | Bayesian Kalman-style scalar calorie estimator | Shipped in preview build 2026-04-06 21:00 UTC |
| 8 | 2026-04-06 | `stxkxs/nanohype` | 4 items: adaptive contextual bandit routing with ε-greedy, pluggable strategy registry (hash / sliding-TTL / semantic), cost anomaly detection, LinUCB roadmap | *"Your first comment helped shape what shipped."* |
| 9 | 2026-04-06 | `KaiBuildsx` (Moltbook agent) | Memory file architecture as (observation, weight, n) tuples -- Bayesian prior over filesystem state | *"This reframe actually changes how you architect memory files."* |
| 10 | 2026-04-07 | `rfivesix/hypertrack` | Preview 2: credible interval UI, phase tracking, state chaining across weeks | Shipped in Preview 2 |
| 11 | 2026-04-08 | `AlanHuang99/pyrollmatch` | Entropy balancing (Hainmueller 2012) with moment constraints up to skewness + `max_weight` cap + post-cap balance diagnostics | Shipped in v0.1.3 |
| 12 | 2026-04-08 | `chernistry/bernstein` (84⭐) | LinUCB contextual model router with α=0.3, shadow-evaluation path, interpretable decision reasons (exploit + explore components). Validated via pyright + ruff + pytest including `test_bandit_router.py`. | Shipped in `codex/issue-367-linucb-router` at `b9898c1a` -- **1h40m after the spec correction was posted** |

Plus **1 high-value debug catch** (`KellerJordan/Muon`, Complexity-ML) where our feedback caught a forward-only Triton kernel bug that had frozen routed expert weights bit-exact identical to initialization across all 20 layers. Publicly retracted: *"without your push... I would still be tuning hyperparams on a broken model."*

### Maintainer relationships (warm technical correspondence)

| Project | Maintainer | Context |
|---------|-----------|---------|
| Qdrant | `IvanPleshkov` | TurboQuant quantization discussion with Hadamard chunking advice |
| Milvus | `foxspy` | HNSW level-0 directed reachability diagnosis via SCC decomposition |
| NetworkX | `mcbosch` | Magnetic Laplacian phase-collapse PSD correction |
| Apache DataFusion | `xiedeyantu` | UNION DISTINCT FILTER rewrite safety analysis |
| DuckDB | `hawkfish` | — |
| pymc-labs / CausalPy | `drbenvincent` | Power-curve sigmoid fitting iteration rule |

### Marketplace distribution

| Platform | Status | Discovery value |
|----------|--------|----------------|
| `punkpeye/awesome-mcp-servers` (84K⭐) | ✓ Merged 2026-04-06 | Largest MCP server catalog on GitHub |
| `TensorBlock/awesome-mcp-servers` | ✓ Merged 2026-04-07 | Second upstream merged |
| MCP Registry | ✓ Published v1.0.1 | Official registry |
| Glama | ✓ Listed (Quality A) | Auto-scored |
| PulseMCP | ✓ Listed | Ranked #2,118 last check, 1.3K visitors/week |
| Smithery | ✓ Listed at `smithery.ai/servers/lukastan/oraclaw` | — |
| toolsdk-ai | ✓ Listed | — |
| Dify marketplace | ✓ Listed | — |
| MobinX, rohitg00, YuzeHao2023, chatmcp, ComposioHQ | Open, clean, awaiting maintainer review | 5 additional pending listings |

### Reputation discipline

Five public maintainer callouts were handled gracefully during the launch period, all closed positively. Recorded here for transparency:

| # | Project | Maintainer | Outcome |
|---|---------|-----------|---------|
| 1 | HiGHS | `jajhall` | Apologized for off-topic comment, commitment to exit, closed with *"Thanks"* |
| 2 | Godot | `paperman5` | Apologized, catastrophic cancellation discussion continued technically |
| 3 | PyPy | `mattip` | Apologized, `list.reverse()` bug fix completed by `cfbolz`, closed with thanks |
| 4 | DependencyTrack | `nscuro` | 2026-04-08 apology posted after thread review, committed to exit |
| 5 | OpenCV | `Prasadayus` | 2026-04-08 correction accepted, prior analysis was wrong on uniform-input case (∇I=0 edge case) |

## [1.1.1] - 2026-04-05

### Added

- Premium-tier gating: 6 free / 6 premium tool split
- Beta API key generation for partner onboarding (growth tier, 30-day windows)
- Server-card.json endpoint at `/.well-known/mcp/server-card.json` for marketplace discoverability

### Changed

- Anomaly detection and forecast tools moved from free to premium (they are the most-downloaded standalone packages at 59/wk and 50/wk respectively)

## [1.1.0] - 2026-04-03

### Added

- x402 machine payment support for AI-agent-to-API payments via USDC on Base
- 14 thin SDK packages on npm (`@oraclaw/bandit`, `@oraclaw/solver`, etc.)
- Live dashboard at `web-olive-one-89.vercel.app`
- MCP server at `@oraclaw/mcp-server` on npm

## [1.0.0] - 2026-03-26

### Added

- Initial public launch
- 19 algorithms: 2 SOTA + 1 near-SOTA + 2 unique IP + 11 production-grade + 2 classic
- 18 public REST API endpoints
- 12 MCP tools
- Fastify 5.8.4 + TypeScript 5.3.3 backend
- Expo 55 + React Native 0.83.2 mobile app
- 1,077 tests passing across 24 test files
- All algorithms benchmarked at <25ms, 14 of 18 under 1ms
- CMA-ES accuracy verified at 6e-14 on Rosenbrock function

[Unreleased]: https://github.com/Whatsonyourmind/oraclaw/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/Whatsonyourmind/oraclaw/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Whatsonyourmind/oraclaw/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Whatsonyourmind/oraclaw/releases/tag/v1.0.0
