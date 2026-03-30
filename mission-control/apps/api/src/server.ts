/**
 * OraClaw API Server — Production entry point with full billing stack.
 *
 * Loads public API routes plus all billing/auth/payment hooks.
 * Gracefully degrades when env vars are missing (freemium mode).
 *
 * Hook execution order for /api/v1/* requests:
 *   1. @fastify/rate-limit (onRequest) -- free tier IP limiting
 *   2. x402 payment (preHandler) -- checks PAYMENT-SIGNATURE, sets billingPath='x402'
 *   3. Unkey auth (preHandler) -- skips if billingPath already set
 *   4. Rate limit headers (onSend) -- X-RateLimit-* response headers
 *   5. Stripe meter (onResponse) -- only fires when billingPath='stripe'
 *   6. x402 settlement (onResponse) -- only fires when billingPath='x402' and 2xx
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";

// Public API routes
import publicApiRoutes from "./routes/oracle/api-public";

// Batch endpoint (DX-04)
import batchRoute from "./routes/oracle/api-batch";

// Billing routes (subscribe + portal + webhook)
import { subscribeRoutes } from "./routes/billing/subscribe";
import { portalRoutes } from "./routes/billing/portal";
import { webhookRoutes } from "./routes/billing/webhook";

// AI discovery route
import { llmsTxtRoute } from "./routes/llms-txt";

// Auth middleware
import { createAuthMiddleware, rateLimitHeadersHook } from "./middleware/auth";

// Hooks
import { createMeterUsageHook } from "./hooks/meter-usage";
import { registerFreeTierRateLimit } from "./hooks/free-tier-rate-limit";
import { createX402PaymentHook } from "./hooks/x402-payment";
import { createX402SettleHook } from "./hooks/x402-settle";

// RFC 9457 Problem Details
import { sendProblem, ProblemTypes } from "./utils/problem-details";

// ── Graceful service initialization ─────────────────────────

/**
 * Safely create Unkey client. Returns null if UNKEY_ROOT_KEY is not set.
 */
function initUnkey(): import("@unkey/api").Unkey | null {
  const rootKey = process.env.UNKEY_ROOT_KEY;
  if (!rootKey) {
    console.warn("[BOOT] UNKEY_ROOT_KEY not set -- Unkey auth disabled, all requests treated as free tier");
    return null;
  }
  try {
    const { Unkey } = require("@unkey/api");
    return new Unkey({ rootKey });
  } catch (err) {
    console.warn("[BOOT] Failed to initialize Unkey client:", err);
    return null;
  }
}

/**
 * Safely create Stripe client. Returns null if STRIPE_SECRET_KEY is not set.
 */
function initStripe(): import("stripe").default | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey === "sk_test_placeholder") {
    console.warn("[BOOT] STRIPE_SECRET_KEY not set -- Stripe metered billing disabled");
    return null;
  }
  try {
    const Stripe = require("stripe").default || require("stripe");
    return new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
  } catch (err) {
    console.warn("[BOOT] Failed to initialize Stripe client:", err);
    return null;
  }
}

/**
 * Safely initialize x402 resource server. Returns null if packages or config missing.
 */
async function initX402(logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void }): Promise<unknown> {
  const walletAddress = process.env.RECEIVING_WALLET_ADDRESS;
  if (!walletAddress) {
    logger.warn("[BOOT] RECEIVING_WALLET_ADDRESS not set -- x402 payments disabled");
    return null;
  }
  try {
    const { x402ResourceServer, HTTPFacilitatorClient } = await import("@x402/core/server");
    const { ExactEvmScheme } = await import("@x402/evm/exact/server");

    const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
    const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
    const server = new x402ResourceServer(facilitatorClient);
    const network = (process.env.X402_NETWORK || "eip155:84532") as `${string}:${string}`;
    server.register(network, new ExactEvmScheme());
    await server.initialize();
    logger.info("[BOOT] x402 payment system initialized");
    return server;
  } catch (err) {
    logger.warn({ err }, "[BOOT] x402 payment system not available (packages missing or facilitator unreachable)");
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const isProd = process.env.NODE_ENV === "production";

  const app = Fastify({
    logger: isProd
      ? { level: "info" }
      : true,
    requestTimeout: 30_000,
    keepAliveTimeout: 72_000,
    connectionTimeout: 10_000,
    bodyLimit: 10 * 1024 * 1024, // 10MB for batch requests
  });

  // ── Core plugins ────────────────────────────────────────

  await app.register(compress, { global: true });
  await app.register(cors, { origin: true, credentials: true });

  // ── Free-tier rate limiting (must be before routes) ─────

  await registerFreeTierRateLimit(app);

  // ── Initialize billing services ─────────────────────────

  const unkeyClient = initUnkey();
  const stripeClient = initStripe();
  const x402Server = await initX402(app.log);

  const walletAddress = process.env.RECEIVING_WALLET_ADDRESS;
  const x402PricePerCall = process.env.X402_PRICE_PER_CALL || "$0.001";
  const x402Network = process.env.X402_NETWORK || "eip155:84532";

  // ── Hook 1: x402 payment verification (preHandler) ──────
  // Runs BEFORE Unkey auth. If valid x402 payment, sets billingPath='x402' and skips auth.

  app.addHook("preHandler", async (request, reply) => {
    if (x402Server && walletAddress && request.url.startsWith("/api/v1/")) {
      const handler = createX402PaymentHook(
        x402Server as any,
        walletAddress,
        x402PricePerCall,
        x402Network,
      );
      await handler(request, reply);
    }
  });

  // ── Hook 2: Unkey API key auth (preHandler) ─────────────
  // Skipped if billingPath already set by x402 payment hook.
  // If Unkey is not initialized, all requests are treated as free tier.

  if (unkeyClient) {
    const unkeyAuthHandler = createAuthMiddleware(unkeyClient);
    app.addHook("preHandler", async (request, reply) => {
      if (request.url.startsWith("/api/v1/") && !request.billingPath) {
        await unkeyAuthHandler(request, reply);
      }
    });
  } else {
    // No Unkey -- set all requests to free tier
    app.addHook("preHandler", async (request) => {
      if (request.url.startsWith("/api/v1/") && !request.billingPath) {
        request.tier = "free";
        request.billingPath = "free";
      }
    });
  }

  // ── Hook 3: Rate limit headers on all responses (onSend) ─

  app.addHook("onSend", rateLimitHeadersHook);

  // ── Hook 4: Stripe metered billing (onResponse) ─────────
  // Only emits usage events when Stripe is configured.

  if (stripeClient) {
    const meterUsage = createMeterUsageHook(
      stripeClient,
      process.env.STRIPE_METER_EVENT_NAME || "api_calls",
    );
    app.addHook("onResponse", async (request, reply) => {
      if (request.url.startsWith("/api/v1/")) {
        await meterUsage(request, reply);
      }
    });

    // Batch metering: emit usage at 50% rate for batch requests
    app.addHook("onResponse", async (request, reply) => {
      if (
        request.url.startsWith("/api/v1/") &&
        request.isBatchRequest &&
        request.billingPath === "stripe" &&
        request.stripeCustomerId &&
        reply.statusCode < 400
      ) {
        const batchEventName = process.env.STRIPE_BATCH_METER_EVENT_NAME || "api_calls_batch";
        stripeClient.billing.meterEvents
          .create({
            event_name: batchEventName,
            payload: {
              stripe_customer_id: request.stripeCustomerId,
              value: String(request.batchSize || 0),
            },
            identifier: `${request.id}-batch-${Date.now()}`,
          })
          .catch((err) => {
            request.log.error({ err }, "Stripe batch meter event failed");
          });
      }
    });
  }

  // ── Hook 5: x402 settlement (onResponse) ────────────────
  // Fire-and-forget USDC settlement after successful x402-paid requests.

  if (x402Server) {
    app.addHook("onResponse", async (request, reply) => {
      if (request.url.startsWith("/api/v1/")) {
        const settleHandler = createX402SettleHook(x402Server as any);
        await settleHandler(request, reply);
      }
    });
  }

  // ── Routes ──────────────────────────────────────────────

  // Public API routes (all 14+ algorithm endpoints)
  await app.register(publicApiRoutes);

  // Batch endpoint
  await app.register(batchRoute);

  // Billing routes (subscribe + portal + webhook)
  await app.register(subscribeRoutes, { prefix: "/api/v1/billing" });
  await app.register(portalRoutes, { prefix: "/api/v1/billing" });
  await app.register(webhookRoutes, { prefix: "/api/v1/billing" });

  // AI discovery (llms.txt)
  await app.register(llmsTxtRoute);

  // ── Health check ────────────────────────────────────────

  app.get("/health", async () => ({
    status: "ok",
    service: "oraclaw-api",
    mode: unkeyClient ? "authenticated" : "freemium",
    billing: {
      unkey: !!unkeyClient,
      stripe: !!stripeClient,
      x402: !!x402Server,
    },
    timestamp: new Date().toISOString(),
  }));

  // ── RFC 9457 Global Error Handler ───────────────────────

  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
    app.log.error(error);

    const status = error.statusCode || 500;

    if (error.validation) {
      return sendProblem(reply, 400, ProblemTypes.VALIDATION, "Validation Error", error.message);
    }

    if (status === 429) {
      return sendProblem(reply, 429, ProblemTypes.RATE_LIMITED, "Rate limit exceeded", "Too many requests. Please try again later.", { "retry-after": 60 });
    }

    if (status === 404) {
      return sendProblem(reply, 404, ProblemTypes.NOT_FOUND, "Not Found", error.message);
    }

    return sendProblem(reply, 500, ProblemTypes.INTERNAL, "Internal Server Error", "An unexpected error occurred. Please try again.");
  });

  // ── Graceful shutdown ───────────────────────────────────

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ── Start server ────────────────────────────────────────

  const port = Number(process.env.PORT) || 3001;
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
    app.log.info(`OraClaw API running on ${host}:${port}`);
    app.log.info(`Auth: ${unkeyClient ? "Unkey enabled" : "FREEMIUM (no Unkey)"}`);
    app.log.info(`Billing: ${stripeClient ? "Stripe enabled" : "disabled"}`);
    app.log.info(`Payments: ${x402Server ? "x402 USDC enabled" : "disabled"}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
