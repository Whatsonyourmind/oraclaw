/**
 * OraClaw API Server — Lightweight entry point for production deployment.
 * Only loads the public API routes (no OODA orchestration, no integrations).
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import publicApiRoutes from "./routes/oracle/api-public";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(publicApiRoutes);

  // Health check at root
  app.get("/health", async () => ({ status: "ok", service: "oraclaw-api" }));

  const port = Number(process.env.PORT) || 3001;
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`OraClaw API running on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
