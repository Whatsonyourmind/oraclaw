/**
 * usageTracker.ts
 *
 * Lightweight in-memory usage aggregation for the OraClaw public API.
 *
 * Purpose: answer "is anyone actually using this?" without a full analytics
 * pipeline. Tracks per-request metadata on every authenticated or free-tier
 * call and exposes a snapshot for an admin endpoint.
 *
 * Persistence: optional JSON snapshot to disk on a 60s interval, loaded on
 * boot. Disk path is /tmp by default which is ephemeral on Render — the
 * snapshot survives within-session but not across container restarts. Good
 * enough for a first observability pass; not a substitute for a real
 * time-series DB.
 */
import { promises as fs } from "fs";
import path from "path";

export interface UsageSnapshot {
  startedAt: string;
  lastUpdated: string;
  totalRequests: number;
  totalErrors: number;
  byTier: Record<string, number>;
  byBillingPath: Record<string, number>;
  byRoute: Record<string, number>;
  byStatusClass: Record<string, number>;
  uniqueKeyIds: string[];
  uniqueKeyIdCount: number;
  dailyBuckets: Record<string, number>;
  lastRequest?: {
    timestamp: string;
    route: string;
    tier: string;
    billingPath: string;
    status: number;
  };
}

interface InternalState {
  startedAt: string;
  totalRequests: number;
  totalErrors: number;
  byTier: Map<string, number>;
  byBillingPath: Map<string, number>;
  byRoute: Map<string, number>;
  byStatusClass: Map<string, number>;
  uniqueKeyIds: Set<string>;
  dailyBuckets: Map<string, number>;
  lastRequest?: UsageSnapshot["lastRequest"];
}

function createEmptyState(): InternalState {
  return {
    startedAt: new Date().toISOString(),
    totalRequests: 0,
    totalErrors: 0,
    byTier: new Map(),
    byBillingPath: new Map(),
    byRoute: new Map(),
    byStatusClass: new Map(),
    uniqueKeyIds: new Set(),
    dailyBuckets: new Map(),
  };
}

/**
 * Normalize a request URL to a route template so `/api/v1/optimize/bandit`
 * and `/api/v1/optimize/bandit?batch=1` both bucket together. Also drops
 * query strings and collapses any unknown numeric path segments to `:n`.
 */
function normalizeRoute(url: string): string {
  const base = url.split("?")[0];
  return base.replace(/\/\d+(?=\/|$)/g, "/:n");
}

function classifyStatus(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "1xx";
}

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function trimDailyBuckets(buckets: Map<string, number>, maxDays = 30): void {
  if (buckets.size <= maxDays) return;
  const sortedKeys = Array.from(buckets.keys()).sort();
  const toDrop = sortedKeys.length - maxDays;
  for (let i = 0; i < toDrop; i++) {
    buckets.delete(sortedKeys[i]);
  }
}

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Create a usage tracker. Callers pass an optional snapshot path and persist
 * interval; both are optional and defaulted.
 */
export function createUsageTracker(options: {
  snapshotPath?: string;
  persistIntervalMs?: number;
  logger?: { info: (msg: unknown, label?: string) => void; warn: (msg: unknown, label?: string) => void };
} = {}) {
  const snapshotPath = options.snapshotPath ?? path.join(process.env.TMPDIR ?? "/tmp", "oraclaw-usage.json");
  const persistIntervalMs = options.persistIntervalMs ?? 60_000;
  const logger = options.logger ?? { info: () => {}, warn: () => {} };

  let state = createEmptyState();
  let persistTimer: NodeJS.Timeout | undefined;
  let dirty = false;

  async function load(): Promise<void> {
    try {
      const raw = await fs.readFile(snapshotPath, "utf8");
      const parsed = JSON.parse(raw) as UsageSnapshot;
      state = {
        startedAt: parsed.startedAt ?? new Date().toISOString(),
        totalRequests: parsed.totalRequests ?? 0,
        totalErrors: parsed.totalErrors ?? 0,
        byTier: new Map(Object.entries(parsed.byTier ?? {})),
        byBillingPath: new Map(Object.entries(parsed.byBillingPath ?? {})),
        byRoute: new Map(Object.entries(parsed.byRoute ?? {})),
        byStatusClass: new Map(Object.entries(parsed.byStatusClass ?? {})),
        uniqueKeyIds: new Set(parsed.uniqueKeyIds ?? []),
        dailyBuckets: new Map(Object.entries(parsed.dailyBuckets ?? {})),
        lastRequest: parsed.lastRequest,
      };
      logger.info({ path: snapshotPath, totalRequests: state.totalRequests }, "usage-tracker-loaded");
    } catch (err: unknown) {
      // Missing file or parse error = fresh start, not an error condition.
      const code = (err as { code?: string })?.code;
      if (code !== "ENOENT") {
        logger.warn({ err, path: snapshotPath }, "usage-tracker-load-failed");
      }
    }
  }

  async function persist(): Promise<void> {
    if (!dirty) return;
    try {
      const snap = getSnapshot();
      await fs.writeFile(snapshotPath, JSON.stringify(snap, null, 2), "utf8");
      dirty = false;
    } catch (err: unknown) {
      logger.warn({ err, path: snapshotPath }, "usage-tracker-persist-failed");
    }
  }

  function record(input: {
    tier: string;
    keyId?: string;
    billingPath: string;
    route: string;
    status: number;
  }): void {
    state.totalRequests++;
    if (input.status >= 400) state.totalErrors++;
    incrementMap(state.byTier, input.tier);
    incrementMap(state.byBillingPath, input.billingPath);
    incrementMap(state.byRoute, normalizeRoute(input.route));
    incrementMap(state.byStatusClass, classifyStatus(input.status));
    incrementMap(state.dailyBuckets, todayBucket());
    trimDailyBuckets(state.dailyBuckets);
    if (input.keyId) state.uniqueKeyIds.add(input.keyId);
    state.lastRequest = {
      timestamp: new Date().toISOString(),
      route: normalizeRoute(input.route),
      tier: input.tier,
      billingPath: input.billingPath,
      status: input.status,
    };
    dirty = true;
  }

  function getSnapshot(): UsageSnapshot {
    return {
      startedAt: state.startedAt,
      lastUpdated: new Date().toISOString(),
      totalRequests: state.totalRequests,
      totalErrors: state.totalErrors,
      byTier: Object.fromEntries(state.byTier),
      byBillingPath: Object.fromEntries(state.byBillingPath),
      byRoute: Object.fromEntries(state.byRoute),
      byStatusClass: Object.fromEntries(state.byStatusClass),
      uniqueKeyIds: Array.from(state.uniqueKeyIds),
      uniqueKeyIdCount: state.uniqueKeyIds.size,
      dailyBuckets: Object.fromEntries(state.dailyBuckets),
      lastRequest: state.lastRequest,
    };
  }

  function startPersistLoop(): void {
    if (persistTimer) return;
    persistTimer = setInterval(() => {
      void persist();
    }, persistIntervalMs);
    // Do not keep the process alive just for the persist timer.
    if (typeof persistTimer.unref === "function") persistTimer.unref();
  }

  function stopPersistLoop(): void {
    if (persistTimer) {
      clearInterval(persistTimer);
      persistTimer = undefined;
    }
  }

  function reset(): void {
    state = createEmptyState();
    dirty = true;
  }

  return {
    load,
    persist,
    record,
    getSnapshot,
    startPersistLoop,
    stopPersistLoop,
    reset,
  };
}

export type UsageTracker = ReturnType<typeof createUsageTracker>;
