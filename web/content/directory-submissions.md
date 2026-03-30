# OraClaw MCP Server — Directory Submissions Tracker

**Package**: [@oraclaw/mcp-server](https://www.npmjs.com/package/@oraclaw/mcp-server) v1.0.1
**GitHub**: https://github.com/Whatsonyourmind/oraclaw
**Install**: `npx @oraclaw/mcp-server`
**Date**: 2026-03-30

---

## Official Registries

| Directory | Status | URL |
|-----------|--------|-----|
| **Official MCP Registry** | PUBLISHED | `io.github.Whatsonyourmind/oraclaw` via mcp-publisher CLI |
| **mcpservers.org** (wong2) | SUBMITTED | https://mcpservers.org/submit (form submitted successfully) |
| **mcp.so** | SUBMITTED | https://mcp.so/my-servers/319f8799-6275-426a-80d3-75a16bfe51b2/edit |

## Web Directories (Manual Required)

| Directory | Status | Notes |
|-----------|--------|-------|
| **Smithery.ai** | SKIPPED | Requires remote HTTP MCP server URL; OraClaw uses stdio transport |
| **Glama.ai** | PENDING | Requires account creation at https://glama.ai — may auto-index from official MCP registry |
| **PulseMCP** | PENDING | Should auto-discover from official MCP registry |

## GitHub Issues (Awesome Lists)

| Repository | Stars | Status | URL |
|------------|-------|--------|-----|
| **hesreallyhim/awesome-claude-code** | 34,510 | ISSUE CREATED | https://github.com/hesreallyhim/awesome-claude-code/issues/1254 |
| **rohitg00/awesome-claude-code-toolkit** | 957 | ISSUE CREATED | https://github.com/rohitg00/awesome-claude-code-toolkit/issues/168 |
| **travisvn/awesome-claude-skills** | 10,137 | ISSUE CREATED | https://github.com/travisvn/awesome-claude-skills/issues/459 |
| **ccplugins/awesome-claude-code-plugins** | 656 | ISSUE CREATED | https://github.com/ccplugins/awesome-claude-code-plugins/issues/121 |
| **VoltAgent/awesome-claude-code-subagents** | 15,687 | ISSUE CREATED | https://github.com/VoltAgent/awesome-claude-code-subagents/issues/155 |
| **TensorBlock/awesome-mcp-servers** | 593 | ISSUE CREATED | https://github.com/TensorBlock/awesome-mcp-servers/issues/270 |
| **jqueryscript/awesome-claude-code** | 227 | ISSUE CREATED | https://github.com/jqueryscript/awesome-claude-code/issues/154 |
| **LangGPT/awesome-claude-code** | 205 | ISSUE CREATED | https://github.com/LangGPT/awesome-claude-code/issues/26 |
| **toolsdk-ai/toolsdk-mcp-registry** | 169 | ISSUE CREATED | https://github.com/toolsdk-ai/toolsdk-mcp-registry/issues/225 |

## API Directories

| Repository | Stars | Status | URL |
|------------|-------|--------|-----|
| **foss42/awesome-generative-ai-apis** | 212 | ISSUE CREATED | https://github.com/foss42/awesome-generative-ai-apis/issues/367 |
| **ai-collection/ai-collection** | 8,837 | ISSUE CREATED | https://github.com/ai-collection/ai-collection/issues/1219 |
| **TonnyL/Awesome_APIs** | 12,885 | SKIPPED | Repository archived (read-only) |

## Fork PRs (Branches Ready)

| Repository | Stars | Status | Branch |
|------------|-------|--------|--------|
| **appcypher/awesome-mcp-servers** | 5,327 | BRANCH READY | `Whatsonyourmind:add-oraclaw` (PR blocked by repo permissions) |
| **hesreallyhim/awesome-claude-code** | 34,510 | BRANCH READY | `Whatsonyourmind:add-oraclaw-mcp` |
| **rohitg00/awesome-claude-code-toolkit** | 957 | BRANCH READY | `Whatsonyourmind:add-oraclaw-mcp` |
| **travisvn/awesome-claude-skills** | 10,137 | BRANCH READY | `Whatsonyourmind:add-oraclaw-mcp` |

## Not Applicable

| Directory | Reason |
|-----------|--------|
| **Smithery.ai** | Requires hosted/remote HTTP MCP server (OraClaw is stdio) |
| **Docker MCP Registry** | Requires Docker image (OraClaw is npm-based) |
| **jaw9c/awesome-remote-mcp-servers** | Remote servers only (OraClaw is stdio) |
| **rohitg00/awesome-devops-mcp-servers** | DevOps-focused, not applicable |

## npm Package Update

- Added `mcpName` field to `package.json` for official MCP registry compatibility
- Published v1.0.1 with `mcpName: "io.github.Whatsonyourmind/oraclaw"`
- Created `server.json` for `mcp-publisher` CLI

---

## Summary

- **3** official registries (MCP Registry, mcpservers.org, mcp.so)
- **11** GitHub issues across awesome lists and directories
- **4** fork branches ready for PRs
- **Total reach**: ~90,000+ combined stars across target repositories
