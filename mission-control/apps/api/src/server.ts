/**
 * OraClaw API Server — Lightweight entry point for production deployment.
 * Only loads the public API routes (no OODA orchestration, no integrations).
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import publicApiRoutes from "./routes/oracle/api-public";

async function main() {
  const isProd = process.env.NODE_ENV === "production";

  const app = Fastify({
    logger: !isProd,
    requestTimeout: 30_000,
    keepAliveTimeout: 72_000,
    connectionTimeout: 10_000,
  });

  await app.register(compress, { global: true });
  await app.register(cors, { origin: true });
  await app.register(publicApiRoutes);

  // Health check at root
  app.get("/health", async () => ({ status: "ok", service: "oraclaw-api" }));

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  const port = Number(process.env.PORT) || 3001;
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`OraClaw API running on ${host}:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
