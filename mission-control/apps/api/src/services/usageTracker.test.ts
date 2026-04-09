import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { createUsageTracker } from "./usageTracker";

describe("usageTracker", () => {
  let tmpPath: string;

  beforeEach(async () => {
    tmpPath = path.join(os.tmpdir(), `oraclaw-usage-test-${Date.now()}-${Math.random()}.json`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignore missing file
    }
  });

  it("starts with zero totals on a fresh load", async () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    await tracker.load();
    const snap = tracker.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.uniqueKeyIdCount).toBe(0);
    expect(snap.byTier).toEqual({});
  });

  it("records requests and aggregates by tier, route, and status", () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/optimize/bandit", status: 200 });
    tracker.record({ tier: "growth", keyId: "key_abc", billingPath: "stripe", route: "/api/v1/optimize/bandit", status: 200 });
    tracker.record({ tier: "growth", keyId: "key_abc", billingPath: "stripe", route: "/api/v1/solve/constraints", status: 400 });
    tracker.record({ tier: "starter", keyId: "key_xyz", billingPath: "stripe", route: "/api/v1/detect/anomaly", status: 200 });

    const snap = tracker.getSnapshot();
    expect(snap.totalRequests).toBe(4);
    expect(snap.totalErrors).toBe(1);
    expect(snap.byTier).toEqual({ free: 1, growth: 2, starter: 1 });
    expect(snap.byBillingPath).toEqual({ free: 1, stripe: 3 });
    expect(snap.byRoute["/api/v1/optimize/bandit"]).toBe(2);
    expect(snap.byRoute["/api/v1/solve/constraints"]).toBe(1);
    expect(snap.byStatusClass["2xx"]).toBe(3);
    expect(snap.byStatusClass["4xx"]).toBe(1);
    expect(snap.uniqueKeyIdCount).toBe(2);
    expect(snap.uniqueKeyIds.sort()).toEqual(["key_abc", "key_xyz"]);
    expect(snap.lastRequest?.route).toBe("/api/v1/detect/anomaly");
    expect(snap.lastRequest?.tier).toBe("starter");
  });

  it("normalizes numeric path segments into :n", () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/missions/42", status: 200 });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/missions/99", status: 200 });
    const snap = tracker.getSnapshot();
    expect(snap.byRoute["/api/v1/missions/:n"]).toBe(2);
    expect(snap.byRoute["/api/v1/missions/42"]).toBeUndefined();
  });

  it("strips query strings before bucketing", () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/optimize/bandit?debug=1", status: 200 });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/optimize/bandit", status: 200 });
    const snap = tracker.getSnapshot();
    expect(snap.byRoute["/api/v1/optimize/bandit"]).toBe(2);
  });

  it("buckets requests by day", () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/optimize/bandit", status: 200 });
    const snap = tracker.getSnapshot();
    const today = new Date().toISOString().slice(0, 10);
    expect(snap.dailyBuckets[today]).toBe(1);
  });

  it("persists and reloads state from disk", async () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    tracker.record({ tier: "growth", keyId: "key_abc", billingPath: "stripe", route: "/api/v1/optimize/bandit", status: 200 });
    tracker.record({ tier: "growth", keyId: "key_abc", billingPath: "stripe", route: "/api/v1/detect/anomaly", status: 200 });
    await tracker.persist();

    const reloaded = createUsageTracker({ snapshotPath: tmpPath });
    await reloaded.load();
    const snap = reloaded.getSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.byTier["growth"]).toBe(2);
    expect(snap.uniqueKeyIdCount).toBe(1);
    expect(snap.uniqueKeyIds).toEqual(["key_abc"]);
  });

  it("handles missing snapshot file as a clean start", async () => {
    const tracker = createUsageTracker({ snapshotPath: path.join(os.tmpdir(), `never-exists-${Date.now()}.json`) });
    await tracker.load();
    const snap = tracker.getSnapshot();
    expect(snap.totalRequests).toBe(0);
  });

  it("reset clears all state", () => {
    const tracker = createUsageTracker({ snapshotPath: tmpPath });
    tracker.record({ tier: "free", billingPath: "free", route: "/api/v1/optimize/bandit", status: 200 });
    expect(tracker.getSnapshot().totalRequests).toBe(1);
    tracker.reset();
    expect(tracker.getSnapshot().totalRequests).toBe(0);
    expect(tracker.getSnapshot().uniqueKeyIdCount).toBe(0);
  });
});
