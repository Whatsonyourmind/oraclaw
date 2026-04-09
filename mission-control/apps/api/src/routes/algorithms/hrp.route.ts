/**
 * Hierarchical Risk Parity (HRP) — HTTP API
 *
 * Stateless portfolio-allocation endpoint over
 * `services/oracle/algorithms/hrp`. Callers POST a returns matrix +
 * asset ids and get back normalised weights, the cluster tree, and the
 * quasi-diagonal asset order. There is no server-side state to persist:
 * HRP is a one-shot deterministic calculation (modulo numerical noise)
 * so the route scales horizontally behind any load balancer.
 *
 * Mounted endpoints (all under /v1/hrp):
 *   POST /allocate — run the full HRP pipeline and return weights + tree
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { computeHRP } from "../../services/oracle/algorithms/hrp";

// ── Zod Schemas ─────────────────────────────────────────────

const AllocateBodySchema = z
  .object({
    returns: z
      .array(z.array(z.number().finite()).min(1))
      .min(1, "Returns matrix must have at least one time period"),
    assetIds: z
      .array(z.string().min(1))
      .min(1, "assetIds must contain at least one asset"),
  })
  .refine(
    (b) => b.returns.every((row) => row.length === b.assetIds.length),
    {
      message: "Every row of `returns` must have length === assetIds.length",
      path: ["returns"],
    },
  );

// ── Helpers ─────────────────────────────────────────────────

/**
 * Shared Zod → 400 helper. Returns parsed data on success, otherwise
 * writes a structured error payload and returns `null` so the handler
 * can short-circuit.
 */
function parseOr400<T>(
  reply: FastifyReply,
  schema: z.ZodType<T>,
  body: unknown,
): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    reply.status(400);
    reply.send({
      error: "invalid_request",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return null;
  }
  return parsed.data;
}

/**
 * Runs an algorithm operation that may throw domain errors and converts
 * them to 400 responses so clients don't see 500s for bad inputs.
 */
function runOr400<T>(reply: FastifyReply, fn: () => T): T | null {
  try {
    return fn();
  } catch (err) {
    reply.status(400);
    reply.send({
      error: "algorithm_error",
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Route plugin ────────────────────────────────────────────

export async function hrpRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /v1/hrp/allocate — full HRP pipeline in one shot.
  fastify.post(
    "/v1/hrp/allocate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseOr400(reply, AllocateBodySchema, request.body);
      if (!body) return;

      const result = runOr400(reply, () =>
        computeHRP({ returns: body.returns, assetIds: body.assetIds }),
      );
      if (!result) return;

      return {
        weights: result.weights,
        clusterTree: result.clusterTree,
        quasiDiagOrder: result.quasiDiagOrder,
        algorithm: "hierarchical-risk-parity",
      };
    },
  );
}

export default hrpRoutes;
