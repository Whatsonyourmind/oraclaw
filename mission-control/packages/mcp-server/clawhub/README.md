# ClawHub skill sources-of-truth

Corrected/canonical copies of `SKILL.md` files we publish to [ClawHub](https://clawdhub.com) under `whatsonyourmind/oraclaw-*`.

## Why this folder exists

The official skill registry at [github.com/openclaw/skills](https://github.com/openclaw/skills) is a **read-only archive** mirrored from clawdhub.com — it has `has_issues: false` and `has_discussions: false`, and doesn't accept PRs. The only way to edit a published skill is through the clawdhub.com web UI.

That makes the registry copy lossy: if we ever need to recover the "what should this SKILL.md really look like" answer, the best source is clawdhub.com's web dashboard, which is not git-backed.

This folder is our **local source-of-truth** for skill content. Every `*.SKILL.md` here is what we *want* to be live on ClawHub. If the upstream diverges, paste from here.

## Current contents

| File | Status upstream | Notes |
|---|---|---|
| `oraclaw-bandit.SKILL.md` | ❌ upstream has stale `path/to/oraclaw-mcp/index.ts` in install snippet (audited 2026-04-20) | This file has the corrected snippet using `@oraclaw/mcp-server` npm package + `claude mcp add` CLI one-liner. Contributors paste into clawdhub.com web UI to sync. |

## Sync workflow

1. Edit the local file here
2. Log in at https://clawdhub.com as `whatsonyourmind`
3. Open the matching skill → Edit → paste the full content
4. Save — the upstream mirror picks it up on next sync

## Why the current bug matters

The stale install snippet blocks every would-be user of the `oraclaw-bandit` skill — `path/to/oraclaw-mcp/index.ts` is a placeholder path that never resolves. Anyone copy-pasting hits a dead install and abandons. The install snippet is the first thing a new user runs, so fixing it is high-leverage.
