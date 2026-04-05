# Dify Plugin Research — Apr 5, 2026

## Key Findings

**Format:** YAML manifests + Python implementation. Package as `.difypkg`.

**Structure:**
```
oraclaw-plugin/
├── manifest.yaml              # Plugin config (version, author, permissions)
├── provider/
│   └── oraclaw.yaml           # Credentials (API key as secret-input)
├── tools/
│   ├── optimize_bandit.yaml   # Tool schema (params, output)
│   ├── solve_constraints.yaml
│   ├── analyze_graph.yaml
│   ├── detect_anomaly.yaml
│   └── predict_forecast.yaml
├── providers/
│   └── oraclaw.py             # Credential validation (test API call)
├── tools/
│   └── oraclaw_tools.py       # Tool classes (HTTP to OraClaw API)
├── _assets/icon.svg
├── README.md
├── privacy.md
└── requirements.txt           # dify_plugin, requests
```

**Auth:** `credentials_for_provider` with `type: secret-input` for API key. Encrypted automatically.

**Tool implementation:** Python class extending `dify_plugin.Tool`, uses `yield ToolInvokeMessage()`.

**Publishing:** Fork langgenius/dify-plugins, add plugin dir, submit PR. Review within 1 week.

**CLI:** `dify-plugin-daemon` from GitHub releases. Commands: `init`, `start` (debug), `publish` (package).

**Tags:** PRODUCTIVITY, UTILITIES, BUSINESS, FINANCE are relevant for OraClaw.

## Build Plan (US-502)

1. Install dify-plugin-daemon CLI
2. `dify-plugin-cli plugin init` → scaffold
3. Create provider YAML with ORACLAW_API_KEY credential
4. Create 5 tool YAMLs (bandit, constraints, graph, anomaly, forecast)
5. Implement Python tool classes that call OraClaw REST API
6. Test in debug mode
7. Package and submit PR to langgenius/dify-plugins
