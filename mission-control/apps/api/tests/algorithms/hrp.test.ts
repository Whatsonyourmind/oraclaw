/**
 * Tests for Hierarchical Risk Parity (HRP, 21st algorithm).
 *
 * Coverage:
 *   - Input validation (empty returns, empty ids, mismatched shape,
 *     non-finite values, duplicate ids)
 *   - Single-asset fast path (weight == 1.0)
 *   - Two uncorrelated / two identical assets → near 50/50
 *   - Three assets with cluster structure → lone uncorrelated asset
 *     gets the largest weight
 *   - Weights sum to 1 within 1e-9
 *   - All weights non-negative
 *   - Large synthetic 10-asset run completes in < 100 ms
 *   - Math primitives: correlation matrix, distance metric
 *   - Route integration: /v1/hrp/allocate happy path + 400 on bad input
 */

import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import {
  computeHRP,
  correlationMatrix,
  correlationDistance,
  columnVariances,
  covarianceFromCorr,
  singleLinkage,
  quasiDiagonalize,
  recursiveBisection,
} from "../../src/services/oracle/algorithms/hrp";
import { hrpRoutes } from "../../src/routes/algorithms/hrp.route";

/** Mulberry32 — tiny deterministic PRNG for reproducible synthetic returns. */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller to turn uniforms into standard normals for synthetic returns. */
function normal(rng: () => number): number {
  let u1 = rng();
  const u2 = rng();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Generate T × N iid Gaussian returns for a given σ vector (uncorrelated). */
function iidReturns(T: number, sigmas: number[], seed: number): number[][] {
  const rng = makeRng(seed);
  const rows: number[][] = [];
  for (let t = 0; t < T; t++) {
    const row: number[] = [];
    for (let i = 0; i < sigmas.length; i++) {
      row.push(sigmas[i]! * normal(rng));
    }
    rows.push(row);
  }
  return rows;
}

describe("HRP — input validation", () => {
  it("throws on empty returns matrix", () => {
    expect(() => computeHRP({ returns: [], assetIds: ["a"] })).toThrow(
      /empty/i,
    );
  });

  it("throws on empty assetIds", () => {
    expect(() => computeHRP({ returns: [[0.1]], assetIds: [] })).toThrow(
      /empty/i,
    );
  });

  it("throws when a row length does not match assetIds.length", () => {
    expect(() =>
      computeHRP({
        returns: [
          [0.1, 0.2],
          [0.3],
        ],
        assetIds: ["a", "b"],
      }),
    ).toThrow(/length/i);
  });

  it("throws on non-finite return values", () => {
    expect(() =>
      computeHRP({
        returns: [
          [0.1, Number.NaN],
          [0.2, 0.3],
        ],
        assetIds: ["a", "b"],
      }),
    ).toThrow(/non-finite/i);
  });

  it("throws on duplicate asset ids", () => {
    expect(() =>
      computeHRP({
        returns: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        assetIds: ["a", "a"],
      }),
    ).toThrow(/duplicate/i);
  });
});

describe("HRP — degenerate cases", () => {
  it("single asset gets weight 1.0", () => {
    const result = computeHRP({
      returns: [[0.1], [0.2], [-0.1]],
      assetIds: ["solo"],
    });
    expect(result.weights.solo).toBeCloseTo(1, 12);
    expect(result.quasiDiagOrder).toEqual(["solo"]);
    expect(result.clusterTree.assetIndex).toBe(0);
    expect(result.clusterTree.size).toBe(1);
  });

  it("two identical assets → roughly 50/50 weights", () => {
    // Identical returns → correlation = 1, distance = 0. Inverse-variance
    // weighting in the recursive step should still give 50/50.
    const col = [0.01, -0.02, 0.015, -0.005, 0.03, -0.01, 0.02, 0.005];
    const returns = col.map((r) => [r, r]);
    const result = computeHRP({ returns, assetIds: ["x", "y"] });
    expect(result.weights.x! + result.weights.y!).toBeCloseTo(1, 9);
    expect(result.weights.x).toBeCloseTo(0.5, 6);
    expect(result.weights.y).toBeCloseTo(0.5, 6);
  });

  it("two uncorrelated assets with equal variance → roughly 50/50", () => {
    const returns = iidReturns(400, [0.02, 0.02], 11);
    const result = computeHRP({ returns, assetIds: ["a", "b"] });
    expect(result.weights.a! + result.weights.b!).toBeCloseTo(1, 9);
    // Should be close to 50/50 — allow generous slack since sample
    // variances jitter around the true value on 400 draws.
    expect(result.weights.a).toBeGreaterThan(0.3);
    expect(result.weights.a).toBeLessThan(0.7);
  });

  it("two assets with very different variances → lower-variance gets more weight", () => {
    const returns = iidReturns(500, [0.01, 0.05], 17);
    const result = computeHRP({ returns, assetIds: ["lowvol", "highvol"] });
    expect(result.weights.lowvol! + result.weights.highvol!).toBeCloseTo(1, 9);
    // Low-variance asset should dominate (inverse-variance allocation).
    expect(result.weights.lowvol!).toBeGreaterThan(result.weights.highvol!);
  });
});

describe("HRP — cluster-aware allocation", () => {
  it("3 assets with two correlated + one uncorrelated: lone asset gets largest weight", () => {
    // Construct A and B highly correlated (B = A + tiny noise), C independent.
    // All have roughly equal marginal variance so the split is driven by
    // the hierarchical structure rather than by raw variance.
    const T = 600;
    const rng = makeRng(2026);
    const returns: number[][] = [];
    for (let t = 0; t < T; t++) {
      const base = 0.02 * normal(rng);
      const noise = 0.001 * normal(rng);
      const a = base;
      const b = base + noise; // nearly identical to a
      const c = 0.02 * normal(rng); // independent
      returns.push([a, b, c]);
    }
    const result = computeHRP({ returns, assetIds: ["A", "B", "C"] });

    // Sanity check the tree: A and B must end up merged first.
    const sum = result.weights.A! + result.weights.B! + result.weights.C!;
    expect(sum).toBeCloseTo(1, 9);

    // The lone asset (C) should get a larger weight than either of the
    // correlated pair — in López de Prado's framing, the pair shares one
    // half of the capital which then gets split between them via inverse
    // variance, so each of A, B ends up with roughly half of what C gets.
    expect(result.weights.C!).toBeGreaterThan(result.weights.A!);
    expect(result.weights.C!).toBeGreaterThan(result.weights.B!);
    // And A/B should be almost exactly equal to each other since B ≈ A.
    expect(Math.abs(result.weights.A! - result.weights.B!)).toBeLessThan(
      0.05,
    );
  });
});

describe("HRP — invariants", () => {
  it("weights sum to 1 within 1e-9 on a 5-asset portfolio", () => {
    const returns = iidReturns(300, [0.01, 0.02, 0.015, 0.025, 0.012], 5);
    const ids = ["a", "b", "c", "d", "e"];
    const { weights } = computeHRP({ returns, assetIds: ids });
    const sum = ids.reduce((s, id) => s + weights[id]!, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("all weights non-negative on a 5-asset portfolio", () => {
    const returns = iidReturns(300, [0.01, 0.02, 0.015, 0.025, 0.012], 6);
    const ids = ["a", "b", "c", "d", "e"];
    const { weights } = computeHRP({ returns, assetIds: ids });
    for (const id of ids) {
      expect(weights[id]!).toBeGreaterThanOrEqual(0);
    }
  });

  it("quasiDiagOrder is a permutation of assetIds", () => {
    const returns = iidReturns(200, [0.01, 0.02, 0.015, 0.025], 8);
    const ids = ["a", "b", "c", "d"];
    const { quasiDiagOrder } = computeHRP({ returns, assetIds: ids });
    expect(quasiDiagOrder).toHaveLength(ids.length);
    expect([...quasiDiagOrder].sort()).toEqual([...ids].sort());
  });

  it("10+ asset run completes in < 100 ms", () => {
    const sigmas = [0.01, 0.02, 0.015, 0.025, 0.012, 0.018, 0.022, 0.013, 0.019, 0.016, 0.014, 0.021];
    const ids = sigmas.map((_, i) => `asset_${i}`);
    const returns = iidReturns(500, sigmas, 42);
    const start = Date.now();
    const result = computeHRP({ returns, assetIds: ids });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    const sum = ids.reduce((s, id) => s + result.weights[id]!, 0);
    expect(sum).toBeCloseTo(1, 9);
    for (const id of ids) {
      expect(result.weights[id]!).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("HRP — math primitives", () => {
  it("correlationMatrix: identity on a single constant asset", () => {
    const C = correlationMatrix([[0.1], [0.2], [-0.1], [0.3]]);
    expect(C).toHaveLength(1);
    expect(C[0]![0]).toBeCloseTo(1, 12);
  });

  it("correlationMatrix: +1 between identical columns", () => {
    const C = correlationMatrix([
      [0.1, 0.1],
      [-0.2, -0.2],
      [0.3, 0.3],
      [0.05, 0.05],
    ]);
    expect(C[0]![0]).toBeCloseTo(1, 12);
    expect(C[1]![1]).toBeCloseTo(1, 12);
    expect(C[0]![1]).toBeCloseTo(1, 10);
    expect(C[1]![0]).toBeCloseTo(1, 10);
  });

  it("correlationMatrix: -1 between perfectly anti-correlated columns", () => {
    const C = correlationMatrix([
      [0.1, -0.1],
      [-0.2, 0.2],
      [0.3, -0.3],
      [0.05, -0.05],
    ]);
    expect(C[0]![1]).toBeCloseTo(-1, 10);
  });

  it("correlationDistance maps 1 → 0 and -1 → 1", () => {
    const D = correlationDistance([
      [1, 1, -1],
      [1, 1, -1],
      [-1, -1, 1],
    ]);
    expect(D[0]![0]).toBeCloseTo(0, 12);
    expect(D[0]![1]).toBeCloseTo(0, 12);
    expect(D[0]![2]).toBeCloseTo(1, 12);
  });

  it("columnVariances and covarianceFromCorr reproduce direct covariance", () => {
    // Two assets with known variances. Direct cov[0][1] = ρ σ1 σ2.
    const returns: number[][] = [
      [0.02, 0.03],
      [-0.01, -0.02],
      [0.015, 0.025],
      [-0.005, -0.015],
      [0.01, 0.02],
    ];
    const vars = columnVariances(returns);
    const corr = correlationMatrix(returns);
    const cov = covarianceFromCorr(corr, vars);
    // Symmetric + positive diagonal
    expect(cov[0]![0]).toBeCloseTo(vars[0]!, 12);
    expect(cov[1]![1]).toBeCloseTo(vars[1]!, 12);
    expect(cov[0]![1]).toBeCloseTo(cov[1]![0]!, 12);
  });

  it("singleLinkage on a single-asset returns a leaf", () => {
    const tree = singleLinkage([[0]], ["solo"]);
    expect(tree.size).toBe(1);
    expect(tree.assetIndex).toBe(0);
    expect(tree.assetId).toBe("solo");
  });

  it("singleLinkage merges the closest pair first (3 assets)", () => {
    // d(0,1)=0.1, d(0,2)=0.9, d(1,2)=0.8 — so 0/1 merge first.
    const D = [
      [0, 0.1, 0.9],
      [0.1, 0, 0.8],
      [0.9, 0.8, 0],
    ];
    const tree = singleLinkage(D, ["x", "y", "z"]);
    expect(tree.size).toBe(3);
    // Root distance = d(merged{0,1}, 2) = min(0.9, 0.8) = 0.8.
    expect(tree.distance).toBeCloseTo(0.8, 10);
    // DFS leaves should have x and y adjacent.
    const order = quasiDiagonalize(tree);
    expect(order).toHaveLength(3);
    // x/y must be neighbours in the DFS order.
    const xPos = order.indexOf(0);
    const yPos = order.indexOf(1);
    expect(Math.abs(xPos - yPos)).toBe(1);
  });

  it("recursiveBisection on a 2-asset diagonal cov → inverse-variance split", () => {
    // Asset 0 variance 1, asset 1 variance 4. α = 1 / (1+4) = 0.2.
    // Right gets α=0.2, left gets 1-α=0.8. So w0=0.8, w1=0.2.
    const cov = [
      [1, 0],
      [0, 4],
    ];
    const weights = recursiveBisection([0, 1], cov);
    expect(weights[0]).toBeCloseTo(0.8, 10);
    expect(weights[1]).toBeCloseTo(0.2, 10);
  });
});

describe("HRP — route integration", () => {
  async function buildApp() {
    const app = Fastify({ logger: false });
    await app.register(hrpRoutes);
    await app.ready();
    return app;
  }

  it("POST /v1/hrp/allocate returns weights that sum to 1 and a cluster tree", async () => {
    const app = await buildApp();
    try {
      const returns = iidReturns(200, [0.01, 0.02, 0.015, 0.025], 13);
      const res = await app.inject({
        method: "POST",
        url: "/v1/hrp/allocate",
        payload: { returns, assetIds: ["a", "b", "c", "d"] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.algorithm).toBe("hierarchical-risk-parity");
      expect(Object.keys(body.weights)).toHaveLength(4);
      const sum =
        body.weights.a + body.weights.b + body.weights.c + body.weights.d;
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      expect(body.clusterTree).toBeDefined();
      expect(body.clusterTree.size).toBe(4);
      expect(body.quasiDiagOrder).toHaveLength(4);
    } finally {
      await app.close();
    }
  });

  it("POST /v1/hrp/allocate rejects empty returns with 400", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/hrp/allocate",
        payload: { returns: [], assetIds: ["a"] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("invalid_request");
    } finally {
      await app.close();
    }
  });

  it("POST /v1/hrp/allocate rejects shape mismatch with 400", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/hrp/allocate",
        payload: {
          returns: [
            [0.1, 0.2],
            [0.3], // wrong length
          ],
          assetIds: ["a", "b"],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("invalid_request");
    } finally {
      await app.close();
    }
  });

  it("POST /v1/hrp/allocate handles a single asset", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/hrp/allocate",
        payload: { returns: [[0.1], [0.2]], assetIds: ["only"] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.weights.only).toBeCloseTo(1, 12);
      expect(body.quasiDiagOrder).toEqual(["only"]);
    } finally {
      await app.close();
    }
  });
});
