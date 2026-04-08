# Observability

Pino structured logging + OpenTelemetry tracing for the OraClaw API.

## What's wired up

- **Pino** is Fastify's native logger. In development we route it through
  `pino-pretty` for human-readable colorized output; in production we emit
  plain JSON with sensitive headers redacted.
- **OpenTelemetry** is bootstrapped via `@opentelemetry/sdk-node` with
  `@opentelemetry/auto-instrumentations-node`, which automatically traces
  HTTP, Fastify, DNS, Net, Undici, and most common libraries.
- The SDK starts at the **top** of `src/server.ts` (before `Fastify()` is
  constructed) so auto-instrumentations can patch modules before they are
  imported by routes.

## Files

- `otel.ts`
  - `startOtel()` — initializes the SDK once. Safe to call multiple times.
    Returns a handle with `shutdown()` for graceful termination.
  - `buildLoggerOptions()` — returns the Fastify `logger` config block.
    Dev: pino-pretty transport. Prod: JSON + redaction.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `OTEL_ENABLED` | `true` | Set to `false` to skip SDK init entirely (tests, CI). |
| `OTEL_SERVICE_NAME` | `oraclaw-api` | Logical service name in traces. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | *(unset)* | HTTP OTLP collector URL. When set, uses `@opentelemetry/exporter-trace-otlp-http`. When unset, falls back to `ConsoleSpanExporter`. |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level. |
| `NODE_ENV` | — | `production` switches logger to JSON mode and trims debug output. |

## Local development

```bash
# Pretty console logs, spans printed to stdout
NODE_ENV=development npm run dev
```

## Production

```bash
# JSON logs, OTLP spans shipped to collector
NODE_ENV=production \
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.your-infra.io/v1/traces \
LOG_LEVEL=info \
node dist/index.js
```

## What's intentionally NOT here yet

- **Metrics SDK** — only tracing is wired. Metrics (counters, histograms)
  will be added alongside the Phase 2 observability milestone.
- **Request-id correlation plugin** — Fastify already injects `req.id`; a
  dedicated `X-Request-Id` plugin for cross-service correlation is tracked
  for a follow-up.
- **Log sampling / OTEL Logs SDK** — logs still flow through Pino stdout
  only. Moving to `pino-opentelemetry-transport` is the next step once a
  collector endpoint is confirmed.

## Safety model

`startOtel()` is wrapped in a try/catch and all OTEL packages are
lazy-required. If any package is missing or fails to load, the API still
boots normally — observability degrades, the service does not.
