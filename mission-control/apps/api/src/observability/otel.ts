/**
 * OpenTelemetry SDK bootstrap.
 *
 * Keep this file dependency-free at module load time: everything inside
 * `startOtel()` is wrapped in a try/catch and resolved lazily so missing
 * packages or misconfigured environments can never crash the API at boot.
 *
 * Exporters:
 *   - dev / default: ConsoleSpanExporter — prints spans to stdout
 *   - prod (OTEL_EXPORTER_OTLP_ENDPOINT set): OTLPTraceExporter (HTTP)
 *
 * Controls (env vars):
 *   - OTEL_ENABLED=false         → skip SDK entirely (useful in tests/CI)
 *   - OTEL_SERVICE_NAME          → defaults to 'oraclaw-api'
 *   - OTEL_EXPORTER_OTLP_ENDPOINT → HTTP collector URL (prod)
 */

type OtelHandle = {
  shutdown: () => Promise<void>;
} | null;

let sdkHandle: OtelHandle = null;

/**
 * Initialize the OpenTelemetry SDK. Safe to call once at process start.
 * Returns a handle whose `shutdown()` should be invoked on graceful
 * termination.
 */
export async function startOtel(): Promise<OtelHandle> {
  if (process.env.OTEL_ENABLED === "false") {
    return null;
  }
  if (sdkHandle) {
    return sdkHandle;
  }

  try {
    // Lazy-require so the rest of the app still boots if otel packages are
    // missing (e.g. during partial installs or in a minimal Docker layer).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require("@opentelemetry/sdk-node");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ConsoleSpanExporter } = require("@opentelemetry/sdk-trace-base");

    const serviceName = process.env.OTEL_SERVICE_NAME || "oraclaw-api";
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    let traceExporter: unknown = new ConsoleSpanExporter();

    // Prefer HTTP OTLP exporter in prod when an endpoint is configured.
    if (otlpEndpoint) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
        traceExporter = new OTLPTraceExporter({ url: otlpEndpoint });
      } catch {
        // Fall back silently to console exporter.
      }
    }

    const sdk = new NodeSDK({
      serviceName,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation — it's extremely noisy and rarely
          // useful for API tracing.
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();

    sdkHandle = {
      shutdown: () => sdk.shutdown().catch(() => undefined),
    };
    return sdkHandle;
  } catch (err) {
    // Never let observability crash the API.
    // eslint-disable-next-line no-console
    console.warn("[otel] SDK initialization skipped:", (err as Error).message);
    return null;
  }
}

/**
 * Build the Fastify logger options object. Uses pino-pretty in non-prod
 * for human-readable output, and plain structured JSON in prod so
 * downstream log collectors (Loki, Datadog, CloudWatch) can parse it
 * directly.
 */
export function buildLoggerOptions(): Record<string, unknown> {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    return {
      level: process.env.LOG_LEVEL || "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers[\"x-api-key\"]",
          "req.headers.cookie",
        ],
        censor: "[REDACTED]",
      },
    };
  }

  return {
    level: process.env.LOG_LEVEL || "debug",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  };
}
