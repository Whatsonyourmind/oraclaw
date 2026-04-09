# OraClaw Registry/Marketplace PR Audit

**Last audited:** 2026-04-08 EOD
**Source of truth** for outbound marketplace PR status. Check before opening new ones.

## Summary

| Bucket | Count | Notes |
|---|---|---|
| **Merged (live discovery surface)** | 2 | punkpeye (84K ⭐), TensorBlock |
| **Open, clean, awaiting maintainer review** | 5 | MobinX, rohitg00, YuzeHao, chatmcp, ComposioHQ |
| **Open, BLOCKED (CI/checks failing)** | 1 | langgenius/dify-plugins |
| **Self-closed (recoverable — coderabbit flagged trivial issues)** | 3 | VoltAgent #360, #361, openclaw/clawhub #1449 |
| **Direct listings (already live, no PR needed)** | 6 | Glama, MCP Registry, PulseMCP, Smithery, toolsdk-ai, Dify marketplace |

## Merged (2) — use as social proof in next round of outreach

| PR | Repo | Stars | Merged | Status |
|---|---|---|---|---|
| [#3959](https://github.com/punkpeye/awesome-mcp-servers/pull/3959) | `punkpeye/awesome-mcp-servers` | **84K** | 2026-04-06 | ✓ LIVE — OraClaw entry in the largest MCP server catalog on GitHub. The single highest-leverage discovery surface we have. |
| [#281](https://github.com/TensorBlock/awesome-mcp-servers/pull/281) | `TensorBlock/awesome-mcp-servers` | ~200 | 2026-04-07 by `wilsonccccc` | ✓ LIVE — second upstream merged after we resolved the merge conflict Apr 7. |

## Open, clean, awaiting review (5) — monitor only, no action

All 5 are mergeable with zero blocking review comments. They're in the maintainers' queue and will land on their schedule, not ours. Do not bump (that's spam behavior on a new-project PR). Just check weekly.

| PR | Repo | Opened | Last update | Review comments | Mergeable |
|---|---|---|---|---|---|
| [#171](https://github.com/MobinX/awesome-mcp-list/pull/171) | `MobinX/awesome-mcp-list` | ~Apr 1 | 2026-04-03 | 0 | clean |
| [#120](https://github.com/rohitg00/awesome-devops-mcp-servers/pull/120) | `rohitg00/awesome-devops-mcp-servers` | ~Apr 1 | 2026-04-06 | 1 (coderabbit approved, "no actionable comments") | clean |
| [#130](https://github.com/YuzeHao2023/Awesome-MCP-Servers/pull/130) | `YuzeHao2023/Awesome-MCP-Servers` | ~Apr 1 | 2026-04-01 | 0 | clean |
| [#1426](https://github.com/chatmcp/mcpso/pull/1426) | `chatmcp/mcpso` | ~Apr 1 | 2026-04-01 | 0 | clean |
| [#106](https://github.com/ComposioHQ/awesome-claude-plugins/pull/106) | `ComposioHQ/awesome-claude-plugins` | ~Apr 1 | 2026-04-01 | 0 | clean |

## Open but BLOCKED (1) — investigate this week

| PR | Repo | Issue | Action |
|---|---|---|---|
| [#2248](https://github.com/langgenius/dify-plugins/pull/2248) | `langgenius/dify-plugins` | `mergeable_state = blocked`, CI check failing | Check which specific check is failing on head SHA `642f05f3`. Fix and push; do not touch until we know what is blocking. |

The only comment is from `xtaq` (Apr 6-7) pitching a frontend-designer service (`mindcore8.com` with `utm_campaign=t951_frontend_designer`). That's noise, not a review — ignore, per memory rule. The block is on CI, not on review.

## Self-closed, recoverable in ~15 min (3) — low-hanging fruit

All three were closed by us after `coderabbitai[bot]` flagged trivial consistency issues (TOC counts, badge numbers, category file sync). These are ~5-10 minute fixes each and would restore 3 more listings. **Worth reopening as a batch the next time there's a clean slot in the day for registry work, not today.**

| PR | Repo | Why closed | Fix |
|---|---|---|---|
| [#361](https://github.com/VoltAgent/awesome-openclaw-skills/pull/361) | `VoltAgent/awesome-openclaw-skills` | TOC count mismatch (line 182: "Data & Analytics (42)" vs actual 36), category file `categories/data-and-analytics.md` not updated, badge says 5212 vs 5,211 in-text | Update TOC count, sync category file, fix badge number, open fresh PR |
| [#360](https://github.com/VoltAgent/awesome-openclaw-skills/pull/360) | `VoltAgent/awesome-openclaw-skills` | Similar coderabbit issues (closed Apr 1) | Same as #361 — can be batched into one clean resubmit |
| [#1449](https://github.com/openclaw/clawhub/pull/1449) | `openclaw/clawhub` | `unstable` CI — self-closed Apr 1 without investigating the failing check | Re-check failing CI, fix root cause, resubmit |

**Do not batch-reopen as a reactive task.** These should go into the Track 2 work queue behind the patent filing. Priority: low. Value: incremental discovery surface expansion.

## Already-live listings (6) — no PR tracking, just periodic audit

| Platform | Type | Status | Notes |
|---|---|---|---|
| Glama | Auto-scraped | ✓ Live | AAA rating (needs glama.json schema kept in sync) |
| MCP Registry | Direct publish | ✓ v1.0.1 | Official registry |
| PulseMCP | Auto-scraped | ✓ Listed | Ranked #2,118 last we checked, ~1.3K visitors/week |
| Smithery | Direct listing | ✓ Live | `smithery.ai/servers/lukastan/oraclaw`, server-card.json scannable |
| toolsdk-ai | Direct listing | ✓ Live | — |
| Dify marketplace | Plugin submission | ✓ Live | Separate from the `dify-plugins` PR — this is the marketplace listing, that's the plugin PR |

## Deltas since memory last captured (Apr 6 EOD)

| Change | Previous state | Current state |
|---|---|---|
| **TensorBlock #281** | "awaiting review / MERGEABLE" | **MERGED Apr 7 15:19 by wilsonccccc** — MISSED in memory, already ~24h stale when I caught it today |
| **ComposioHQ #106** | Not tracked in memory | Open since Apr 1, clean, 0 review comments |
| **VoltAgent #360, #361, openclaw #1449** | Not tracked in memory | Self-closed Apr 1-4 over trivial coderabbit issues; recoverable |
| **dify-plugins #2248** | "open, awaiting review" | Open but `mergeable_state=blocked` — CI check failing, needs investigation |

## Recommended next actions (in priority order)

1. **[This week, ~15 min]** Investigate `dify-plugins #2248` CI block. Look at the check runs on head SHA `642f05f3` to identify the failing step. Fix and push.
2. **[Next week, ~30 min]** Batch-fix the 3 self-closed PRs (VoltAgent #360/#361 + openclaw/clawhub #1449). Address coderabbit's TOC/category/badge feedback and open fresh clean PRs.
3. **[Monitor weekly, no action]** The 5 clean-open PRs (MobinX, rohitg00, YuzeHao, chatmcp, ComposioHQ). Do not bump.
4. **[Always]** Before opening any NEW registry PR, check this doc to avoid duplicates and re-submitting something we already have pending.
