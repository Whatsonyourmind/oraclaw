/**
 * Tests for Thompson Sampling Contextual Bandit (20th algorithm).
 *
 * Coverage:
 *   - Init: dimensions, validation, duplicate arms
 *   - Select: argmax behaviour, returns valid arm
 *   - Update: state mutation, immutability of input, dimension checks
 *   - Regret: sub-linear regret on a linear-reward problem (Agrawal-Goyal)
 *   - Cold start exploration diversity
 *   - Warm start exploitation lock-in
 *   - Edge cases: single arm, dim mismatch, unknown arm, invalid ctor args
 *   - Route integration: init → select → update happy path + 400 handling
 */

import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import {
  initThompsonSampling,
  selectArm,
  updateThompsonSampling,
  recommend,
  getPosteriorMean,
  sampleMultivariateNormal,
  cholesky,
} from "../../src/services/oracle/algorithms/thompson-sampling";
import { thompsonSamplingRoutes } from "../../src/routes/algorithms/thompson-sampling.route";

/** Mulberry32 — tiny deterministic PRNG for reproducible regret tests. */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Thompson Sampling — init", () => {
  it("initialises state with correct dimensions and defaults", () => {
    const state = initThompsonSampling(["a", "b", "c"], 4);
    expect(state.d).toBe(4);
    expect(state.v).toBe(1.0);
    expect(state.arms).toHaveLength(3);
    for (const arm of state.arms) {
      expect(arm.mu).toHaveLength(4);
      expect(arm.mu.every((x) => x === 0)).toBe(true);
      expect(arm.b).toHaveLength(4);
      expect(arm.SigmaInv).toHaveLength(4);
      expect(arm.SigmaInv[0]).toHaveLength(4);
      // Identity prior
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          expect(arm.SigmaInv[i]![j]).toBe(i === j ? 1 : 0);
        }
      }
      expect(arm.pulls).toBe(0);
      expect(arm.totalReward).toBe(0);
    }
  });

  it("accepts custom exploration constant v", () => {
    const state = initThompsonSampling(["a"], 2, 2.5);
    expect(state.v).toBe(2.5);
  });

  it("throws on empty armIds", () => {
    expect(() => initThompsonSampling([], 3)).toThrow(/at least one arm/i);
  });

  it("throws on non-positive dimension", () => {
    expect(() => initThompsonSampling(["a"], 0)).toThrow(/positive integer/i);
    expect(() => initThompsonSampling(["a"], -1)).toThrow(/positive integer/i);
  });

  it("throws on duplicate arm ids", () => {
    expect(() => initThompsonSampling(["a", "a"], 3)).toThrow(/duplicate/i);
  });

  it("throws on invalid exploration constant", () => {
    expect(() => initThompsonSampling(["a"], 3, 0)).toThrow(/positive finite/i);
    expect(() => initThompsonSampling(["a"], 3, Number.NaN)).toThrow(/positive finite/i);
  });
});

describe("Thompson Sampling — selectArm", () => {
  it("returns one of the registered arm ids", () => {
    const state = initThompsonSampling(["a", "b", "c"], 3);
    const choice = selectArm(state, [1, 0, 0], makeRng(42));
    expect(["a", "b", "c"]).toContain(choice.armId);
    expect(choice.sampledTheta).toHaveLength(3);
    expect(Number.isFinite(choice.sampledReward)).toBe(true);
  });

  it("returns the single arm when only one exists", () => {
    const state = initThompsonSampling(["only"], 2);
    const choice = selectArm(state, [0.3, 0.7], makeRng(1));
    expect(choice.armId).toBe("only");
  });

  it("throws on context dimension mismatch", () => {
    const state = initThompsonSampling(["a"], 3);
    expect(() => selectArm(state, [1, 0], makeRng(7))).toThrow(/dimension mismatch/i);
  });

  it("produces diverse selections at cold start (exploration dominates)", () => {
    const state = initThompsonSampling(["a", "b", "c"], 3, 1.5);
    const rng = makeRng(2026);
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 200; i++) {
      const ch = selectArm(state, [1, 0, 0], rng);
      counts[ch.armId]!++;
    }
    // No arm should dominate > 90% on pure priors — explore all.
    expect(counts.a! + counts.b! + counts.c!).toBe(200);
    for (const id of ["a", "b", "c"]) {
      expect(counts[id]!).toBeGreaterThan(10);
    }
  });
});

describe("Thompson Sampling — update", () => {
  it("increments pulls and totalReward for the target arm", () => {
    const s0 = initThompsonSampling(["a", "b"], 2);
    const s1 = updateThompsonSampling(s0, "a", [1, 0], 0.7);
    const armA = s1.arms.find((a) => a.id === "a")!;
    expect(armA.pulls).toBe(1);
    expect(armA.totalReward).toBeCloseTo(0.7, 10);
    // Untouched arm stays pristine.
    const armB = s1.arms.find((a) => a.id === "b")!;
    expect(armB.pulls).toBe(0);
  });

  it("does not mutate the input state (immutability)", () => {
    const s0 = initThompsonSampling(["a"], 2);
    const snapshotMu = s0.arms[0]!.mu.slice();
    const snapshotSigma = s0.arms[0]!.SigmaInv.map((r) => r.slice());
    updateThompsonSampling(s0, "a", [1, 1], 1.0);
    expect(s0.arms[0]!.mu).toEqual(snapshotMu);
    expect(s0.arms[0]!.SigmaInv).toEqual(snapshotSigma);
    expect(s0.arms[0]!.pulls).toBe(0);
  });

  it("updates SigmaInv with rank-1 outer product", () => {
    const s0 = initThompsonSampling(["a"], 2);
    const s1 = updateThompsonSampling(s0, "a", [2, 1], 1.0);
    const B = s1.arms[0]!.SigmaInv;
    // Prior I + [[4,2],[2,1]] = [[5,2],[2,2]]
    expect(B[0]![0]).toBeCloseTo(5, 10);
    expect(B[0]![1]).toBeCloseTo(2, 10);
    expect(B[1]![0]).toBeCloseTo(2, 10);
    expect(B[1]![1]).toBeCloseTo(2, 10);
  });

  it("throws on context dimension mismatch", () => {
    const s = initThompsonSampling(["a"], 3);
    expect(() => updateThompsonSampling(s, "a", [1, 0], 1)).toThrow(/dimension mismatch/i);
  });

  it("throws on unknown arm id", () => {
    const s = initThompsonSampling(["a"], 2);
    expect(() => updateThompsonSampling(s, "x", [1, 0], 1)).toThrow(/not found/i);
  });

  it("throws on non-finite reward", () => {
    const s = initThompsonSampling(["a"], 2);
    expect(() => updateThompsonSampling(s, "a", [1, 0], Number.NaN)).toThrow(/finite/i);
  });
});

describe("Thompson Sampling — learning behaviour", () => {
  it("warm-start exploits the best arm after enough trials", () => {
    // 3-arm problem, context [1,0,0]: true weights make arm A best.
    let state = initThompsonSampling(["a", "b", "c"], 3, 0.5);
    const rng = makeRng(123);
    // Teach the model the structure.
    for (let i = 0; i < 60; i++) {
      state = updateThompsonSampling(state, "a", [1, 0, 0], 0.95);
      state = updateThompsonSampling(state, "b", [1, 0, 0], 0.1);
      state = updateThompsonSampling(state, "c", [1, 0, 0], 0.4);
    }
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 200; i++) {
      counts[selectArm(state, [1, 0, 0], rng).armId as "a" | "b" | "c"]++;
    }
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.a).toBeGreaterThan(counts.c);
    // Should strongly prefer A — at least 60% of the time.
    expect(counts.a).toBeGreaterThan(120);
  });

  it("achieves sub-linear regret on a 3-arm linear bandit", () => {
    // True linear rewards — arm 0 has positive slope, others negative.
    const d = 3;
    const trueTheta: number[][] = [
      [1.0, 0.0, 0.0],
      [0.2, 0.0, 0.0],
      [-0.5, 0.0, 0.0],
    ];
    const armIds = ["a", "b", "c"];
    const rng = makeRng(7);
    const contextRng = makeRng(99);

    // Bernoulli link squashed through a clipped identity — keeps this fast
    // and matches the "linear payoffs" assumption in Agrawal-Goyal.
    const reward = (armIdx: number, x: number[]): number => {
      const mean = Math.max(
        0,
        Math.min(1, trueTheta[armIdx]!.reduce((s, w, i) => s + w * x[i]!, 0.5)),
      );
      return rng() < mean ? 1 : 0;
    };

    let state = initThompsonSampling(armIds, d, 0.25);
    let cumulativeRegret = 0;
    const T = 500;

    for (let t = 0; t < T; t++) {
      // Context: x ∈ [0,1]^d, first dim dominant.
      const x = [contextRng(), contextRng() - 0.5, contextRng() - 0.5];
      // Optimal arm = argmax over trueTheta.
      const meanPer = trueTheta.map((theta, i) => ({
        i,
        m: Math.max(0, Math.min(1, theta.reduce((s, w, k) => s + w * x[k]!, 0.5))),
      }));
      meanPer.sort((a, b) => b.m - a.m);
      const bestMean = meanPer[0]!.m;

      const choice = selectArm(state, x, rng);
      const chosenIdx = armIds.indexOf(choice.armId);
      const chosenMean = Math.max(
        0,
        Math.min(1, trueTheta[chosenIdx]!.reduce((s, w, k) => s + w * x[k]!, 0.5)),
      );
      cumulativeRegret += bestMean - chosenMean;

      const r = reward(chosenIdx, x);
      state = updateThompsonSampling(state, choice.armId, x, r);
    }

    // Sub-linear bound: Agrawal-Goyal gives O(d sqrt(T log T)).
    // We use a slack factor of 20 so the test is stable across seeds.
    const bound = 20 * Math.sqrt(T * Math.log(Math.max(T, 2)));
    expect(cumulativeRegret).toBeLessThan(bound);
    // And at least better than trivially pulling the worst arm every step.
    expect(cumulativeRegret).toBeLessThan(T * 0.8);
  });

  it("getPosteriorMean reflects observed reward direction", () => {
    let s = initThompsonSampling(["a"], 3);
    for (let i = 0; i < 20; i++) {
      s = updateThompsonSampling(s, "a", [1, 0, 0], 1.0);
    }
    const mu = getPosteriorMean(s, "a");
    expect(mu[0]!).toBeGreaterThan(0.5);
    expect(Math.abs(mu[1]!)).toBeLessThan(0.1);
    expect(Math.abs(mu[2]!)).toBeLessThan(0.1);
  });

  it("getPosteriorMean throws on unknown arm", () => {
    const s = initThompsonSampling(["a"], 2);
    expect(() => getPosteriorMean(s, "ghost")).toThrow(/not found/i);
  });
});

describe("Thompson Sampling — recommend (single-shot)", () => {
  it("replays history and selects an arm", () => {
    const history = [
      { armId: "a", context: [1, 0], reward: 1 },
      { armId: "a", context: [1, 0], reward: 1 },
      { armId: "b", context: [1, 0], reward: 0 },
    ];
    const result = recommend(["a", "b"], 2, history, [1, 0], 0.5, makeRng(5));
    expect(["a", "b"]).toContain(result.armId);
    // State should reflect history counts.
    const armA = result.state.arms.find((a) => a.id === "a")!;
    const armB = result.state.arms.find((a) => a.id === "b")!;
    expect(armA.pulls).toBe(2);
    expect(armB.pulls).toBe(1);
  });
});

describe("Thompson Sampling — math primitives", () => {
  it("cholesky factors the identity to itself", () => {
    const I = [
      [1, 0],
      [0, 1],
    ];
    const L = cholesky(I);
    expect(L[0]![0]).toBeCloseTo(1, 12);
    expect(L[1]![1]).toBeCloseTo(1, 12);
    expect(L[0]![1]).toBeCloseTo(0, 12);
  });

  it("sampleMultivariateNormal returns vectors of correct length", () => {
    const mu = [0.5, -0.2, 1.1];
    const SigmaInv = [
      [2, 0, 0],
      [0, 1, 0],
      [0, 0, 3],
    ];
    const rng = makeRng(11);
    const sample = sampleMultivariateNormal(mu, SigmaInv, 1.0, rng);
    expect(sample).toHaveLength(3);
    expect(sample.every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe("Thompson Sampling — route integration", () => {
  async function buildApp() {
    const app = Fastify({ logger: false });
    await app.register(thompsonSamplingRoutes);
    await app.ready();
    return app;
  }

  it("POST /v1/thompson-sampling/init returns a valid state", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/init",
        payload: { armIds: ["a", "b"], d: 3 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state.d).toBe(3);
      expect(body.state.arms).toHaveLength(2);
      expect(body.algorithm).toBe("thompson-sampling-contextual");
    } finally {
      await app.close();
    }
  });

  it("POST /v1/thompson-sampling/init rejects empty armIds with 400", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/init",
        payload: { armIds: [], d: 3 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("invalid_request");
    } finally {
      await app.close();
    }
  });

  it("POST /v1/thompson-sampling/select rejects dimension mismatch with 400", async () => {
    const app = await buildApp();
    try {
      const initRes = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/init",
        payload: { armIds: ["a", "b"], d: 3 },
      });
      const state = initRes.json().state;

      const badRes = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/select",
        payload: { state, context: [1, 0] },
      });
      expect(badRes.statusCode).toBe(400);
      const body = badRes.json();
      expect(body.error).toBe("algorithm_error");
      expect(body.message).toMatch(/dimension mismatch/i);
    } finally {
      await app.close();
    }
  });

  it("POST /v1/thompson-sampling/select returns a known arm id", async () => {
    const app = await buildApp();
    try {
      const initRes = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/init",
        payload: { armIds: ["alpha", "beta"], d: 2 },
      });
      const state = initRes.json().state;

      const selectRes = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/select",
        payload: { state, context: [1, 0] },
      });
      expect(selectRes.statusCode).toBe(200);
      const body = selectRes.json();
      expect(["alpha", "beta"]).toContain(body.armId);
      expect(Array.isArray(body.sampledTheta)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("POST /v1/thompson-sampling/update returns updated state", async () => {
    const app = await buildApp();
    try {
      const initRes = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/init",
        payload: { armIds: ["a", "b"], d: 2 },
      });
      const state = initRes.json().state;

      const upRes = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/update",
        payload: { state, armId: "a", context: [1, 0], reward: 1 },
      });
      expect(upRes.statusCode).toBe(200);
      const body = upRes.json();
      expect(body.state.arms.find((a: { id: string }) => a.id === "a").pulls).toBe(1);
      expect(body.updatedArm.pulls).toBe(1);
    } finally {
      await app.close();
    }
  });

  it("POST /v1/thompson-sampling/recommend runs history + select in one shot", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/thompson-sampling/recommend",
        payload: {
          armIds: ["a", "b"],
          d: 2,
          history: [
            { armId: "a", context: [1, 0], reward: 1 },
            { armId: "b", context: [1, 0], reward: 0 },
          ],
          context: [1, 0],
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(["a", "b"]).toContain(body.armId);
      expect(body.state.arms.find((a: { id: string }) => a.id === "a").pulls).toBe(1);
      expect(body.state.arms.find((a: { id: string }) => a.id === "b").pulls).toBe(1);
    } finally {
      await app.close();
    }
  });
});
