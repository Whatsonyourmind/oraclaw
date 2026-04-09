/**
 * Thompson Sampling Contextual Bandit — HTTP API
 *
 * Stateless interface over `services/oracle/algorithms/thompson-sampling`.
 * Clients pass the serialised `ThompsonSamplingState` back and forth; we
 * never persist bandit state server-side, which keeps the endpoint
 * free of sticky routing concerns and makes it trivially scalable
 * behind a load balancer.
 *
 * Endpoints mounted here (all under /v1/thompson-sampling):
 *   POST /init       — construct a zero-history state
 *   POST /select     — draw an arm for the given context
 *   POST /update     — Bayesian update from an observed trial
 *   POST /recommend  — replay history + select in one shot
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  initThompsonSampling,
  selectArm,
  updateThompsonSampling,
  recommend,
  type ThompsonSamplingState,
  type ThompsonArm,
} from "../../services/oracle/algorithms/thompson-sampling";

// ── Zod Schemas ─────────────────────────────────────────────

const ArmStateSchema = z.object({
  id: z.string().min(1),
  mu: z.array(z.number()),
  SigmaInv: z.array(z.array(z.number())),
  b: z.array(z.number()),
  pulls: z.number().int().nonnegative(),
  totalReward: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

const StateSchema = z.object({
  arms: z.array(ArmStateSchema).min(1),
  d: z.number().int().positive(),
  v: z.number().positive(),
});

const InitBodySchema = z.object({
  armIds: z.array(z.string().min(1)).min(1, "At least one arm is required"),
  d: z.number().int().positive(),
  v: z.number().positive().optional(),
});

const SelectBodySchema = z.object({
  state: StateSchema,
  context: z.array(z.number()).min(1),
});

const UpdateBodySchema = z.object({
  state: StateSchema,
  armId: z.string().min(1),
  context: z.array(z.number()).min(1),
  reward: z.number(),
});

const TrialSchema = z.object({
  armId: z.string().min(1),
  context: z.array(z.number()).min(1),
  reward: z.number(),
});

const RecommendBodySchema = z.object({
  armIds: z.array(z.string().min(1)).min(1),
  d: z.number().int().positive(),
  history: z.array(TrialSchema).default([]),
  context: z.array(z.number()).min(1),
  v: z.number().positive().optional(),
});

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
 * Runs an algorithm operation that may throw domain errors (e.g. context
 * dimension mismatch) and converts them to 400 responses.
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

export async function thompsonSamplingRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /v1/thompson-sampling/init
  fastify.post(
    "/v1/thompson-sampling/init",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseOr400(reply, InitBodySchema, request.body);
      if (!body) return;

      const state = runOr400(reply, () =>
        initThompsonSampling(body.armIds, body.d, body.v),
      );
      if (!state) return;

      return { state, algorithm: "thompson-sampling-contextual" };
    },
  );

  // POST /v1/thompson-sampling/select
  fastify.post(
    "/v1/thompson-sampling/select",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseOr400(reply, SelectBodySchema, request.body);
      if (!body) return;

      const selection = runOr400(reply, () =>
        selectArm(body.state as ThompsonSamplingState, body.context),
      );
      if (!selection) return;

      return {
        armId: selection.armId,
        sampledReward: selection.sampledReward,
        sampledTheta: selection.sampledTheta,
        algorithm: "thompson-sampling-contextual",
      };
    },
  );

  // POST /v1/thompson-sampling/update
  fastify.post(
    "/v1/thompson-sampling/update",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseOr400(reply, UpdateBodySchema, request.body);
      if (!body) return;

      const next = runOr400(reply, () =>
        updateThompsonSampling(
          body.state as ThompsonSamplingState,
          body.armId,
          body.context,
          body.reward,
        ),
      );
      if (!next) return;

      const updated: ThompsonArm | undefined = next.arms.find((a) => a.id === body.armId);
      return {
        state: next,
        updatedArm: updated
          ? { id: updated.id, pulls: updated.pulls, totalReward: updated.totalReward }
          : null,
        algorithm: "thompson-sampling-contextual",
      };
    },
  );

  // POST /v1/thompson-sampling/recommend — single-shot
  fastify.post(
    "/v1/thompson-sampling/recommend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseOr400(reply, RecommendBodySchema, request.body);
      if (!body) return;

      const result = runOr400(reply, () =>
        recommend(body.armIds, body.d, body.history ?? [], body.context, body.v),
      );
      if (!result) return;

      return {
        armId: result.armId,
        sampledReward: result.sampledReward,
        state: result.state,
        algorithm: "thompson-sampling-contextual",
      };
    },
  );
}

export default thompsonSamplingRoutes;
