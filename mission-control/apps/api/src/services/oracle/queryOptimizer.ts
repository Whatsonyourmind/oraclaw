/**
 * ORACLE Query Optimizer
 * Story perf-2 - Database query optimization and connection pooling
 *
 * Features:
 * - Connection pooling configuration
 * - Query plan analysis for slow queries
 * - Missing indexes identification
 * - Batch operations where possible
 * - Read replicas consideration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { performanceMonitor } from './performanceMonitor';

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  acquireRetryAttempts: number;
  acquireRetryDelayMs: number;
}

export interface QueryPlan {
  query: string;
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  estimatedRows: number;
  actualRows: number;
  executionTimeMs: number;
  planningTimeMs: number;
  usedIndexes: string[];
  possibleIndexes: string[];
  seqScanWarning: boolean;
  cost: number;
  recommendations: string[];
}

export interface SlowQuery {
  id: string;
  query: string;
  table: string;
  executionTimeMs: number;
  callCount: number;
  avgTimeMs: number;
  maxTimeMs: number;
  lastExecuted: Date;
  plan: QueryPlan | null;
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  estimatedImprovement: string;
  createStatement: string;
}

export interface BatchOperation<T = any> {
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  data: T[];
  conflictColumns?: string[];
}

export interface BatchResult {
  operation: string;
  table: string;
  successCount: number;
  errorCount: number;
  errors: Array<{ index: number; error: string }>;
  executionTimeMs: number;
}

export interface DatabaseStats {
  totalTables: number;
  totalIndexes: number;
  totalRows: Record<string, number>;
  tablesSizes: Record<string, string>;
  indexUsage: Record<string, { scans: number; tupleReads: number }>;
  cacheHitRatio: number;
  connectionCount: number;
  activeQueries: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 2,
  maxConnections: 10,
  idleTimeoutMs: 30000,
  connectionTimeoutMs: 10000,
  acquireRetryAttempts: 3,
  acquireRetryDelayMs: 1000,
};

const SLOW_QUERY_THRESHOLD_MS = 500;
const MAX_TRACKED_SLOW_QUERIES = 100;

// ============================================================================
// QUERY OPTIMIZER CLASS
// ============================================================================

export class QueryOptimizer {
  private supabase: SupabaseClient | null = null;
  private readReplica: SupabaseClient | null = null;
  private poolConfig: ConnectionPoolConfig = DEFAULT_POOL_CONFIG;
  private slowQueries: Map<string, SlowQuery> = new Map();
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();
  private pendingBatches: Map<string, BatchOperation[]> = new Map();
  private batchFlushTimer: NodeJS.Timeout | null = null;
  private batchWindowMs = 50; // Default batch window

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(
    supabaseUrl: string,
    supabaseKey: string,
    readReplicaUrl?: string,
    poolConfig?: Partial<ConnectionPoolConfig>
  ): Promise<void> {
    // Configure primary connection with pooling options
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-pool': 'true',
        },
      },
    });

    // Configure read replica if provided
    if (readReplicaUrl) {
      this.readReplica = createClient(readReplicaUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-read-replica': 'true',
          },
        },
      });
    }

    // Merge pool config
    if (poolConfig) {
      this.poolConfig = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
    }
  }

  // --------------------------------------------------------------------------
  // Connection Pooling
  // --------------------------------------------------------------------------

  getPoolConfig(): ConnectionPoolConfig {
    return { ...this.poolConfig };
  }

  async updatePoolConfig(config: Partial<ConnectionPoolConfig>): Promise<void> {
    this.poolConfig = { ...this.poolConfig, ...config };
    // Note: Actual pool reconfiguration would require reconnection
    // in production, this would be handled by the database driver
  }

  /**
   * Get client for read operations (uses replica if available)
   */
  getReadClient(): SupabaseClient {
    return this.readReplica || this.supabase!;
  }

  /**
   * Get client for write operations (always uses primary)
   */
  getWriteClient(): SupabaseClient {
    return this.supabase!;
  }

  // --------------------------------------------------------------------------
  // Query Plan Analysis
  // --------------------------------------------------------------------------

  async analyzeQuery(query: string, params?: any[]): Promise<QueryPlan> {
    if (!this.supabase) throw new Error('QueryOptimizer not initialized');

    const startTime = performance.now();

    // Execute EXPLAIN ANALYZE
    const { data: explainData, error } = await this.supabase.rpc('analyze_query', {
      query_text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
    });

    const planningTime = performance.now() - startTime;

    if (error) {
      throw new Error(`Query analysis failed: ${error.message}`);
    }

    const plan = explainData?.[0]?.['QUERY PLAN']?.[0];
    if (!plan) {
      throw new Error('No query plan returned');
    }

    // Parse query plan
    const parsedPlan = this.parseQueryPlan(query, plan, planningTime);

    // Generate recommendations
    parsedPlan.recommendations = this.generateRecommendations(parsedPlan);

    return parsedPlan;
  }

  private parseQueryPlan(query: string, plan: any, planningTime: number): QueryPlan {
    const nodeType = plan['Node Type'] || 'Unknown';
    const isSeqScan = nodeType === 'Seq Scan' || this.hasSeqScan(plan);

    // Extract table from query
    const tableMatch = query.match(/FROM\s+(\w+)/i) || query.match(/INTO\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : 'unknown';

    // Determine operation type
    let operation: QueryPlan['operation'] = 'SELECT';
    if (query.trim().toUpperCase().startsWith('INSERT')) operation = 'INSERT';
    else if (query.trim().toUpperCase().startsWith('UPDATE')) operation = 'UPDATE';
    else if (query.trim().toUpperCase().startsWith('DELETE')) operation = 'DELETE';

    return {
      query,
      table,
      operation,
      estimatedRows: plan['Plan Rows'] || 0,
      actualRows: plan['Actual Rows'] || 0,
      executionTimeMs: plan['Actual Total Time'] || 0,
      planningTimeMs: planningTime,
      usedIndexes: this.extractUsedIndexes(plan),
      possibleIndexes: [],
      seqScanWarning: isSeqScan && (plan['Actual Rows'] || 0) > 1000,
      cost: plan['Total Cost'] || 0,
      recommendations: [],
    };
  }

  private hasSeqScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') return true;
    if (plan.Plans) {
      return plan.Plans.some((p: any) => this.hasSeqScan(p));
    }
    return false;
  }

  private extractUsedIndexes(plan: any, indexes: string[] = []): string[] {
    if (plan['Index Name']) {
      indexes.push(plan['Index Name']);
    }
    if (plan.Plans) {
      plan.Plans.forEach((p: any) => this.extractUsedIndexes(p, indexes));
    }
    return indexes;
  }

  private generateRecommendations(plan: QueryPlan): string[] {
    const recommendations: string[] = [];

    if (plan.seqScanWarning) {
      recommendations.push(
        `Sequential scan detected on ${plan.table} with ${plan.actualRows} rows. Consider adding an index.`
      );
    }

    if (plan.executionTimeMs > SLOW_QUERY_THRESHOLD_MS) {
      recommendations.push(
        `Query execution time (${plan.executionTimeMs.toFixed(0)}ms) exceeds threshold. Review query structure.`
      );
    }

    if (plan.estimatedRows > 0 && plan.actualRows > 0) {
      const estimationError = Math.abs(plan.actualRows - plan.estimatedRows) / plan.estimatedRows;
      if (estimationError > 0.5) {
        recommendations.push(
          `Row estimation off by ${(estimationError * 100).toFixed(0)}%. Consider running ANALYZE on ${plan.table}.`
        );
      }
    }

    if (plan.cost > 10000) {
      recommendations.push(
        `High query cost (${plan.cost.toFixed(0)}). Consider query restructuring or index optimization.`
      );
    }

    return recommendations;
  }

  // --------------------------------------------------------------------------
  // Slow Query Tracking
  // --------------------------------------------------------------------------

  trackQuery(
    query: string,
    table: string,
    executionTimeMs: number
  ): void {
    if (executionTimeMs < SLOW_QUERY_THRESHOLD_MS) return;

    const queryHash = this.hashQuery(query);
    const existing = this.slowQueries.get(queryHash);

    if (existing) {
      existing.callCount++;
      existing.avgTimeMs =
        (existing.avgTimeMs * (existing.callCount - 1) + executionTimeMs) / existing.callCount;
      existing.maxTimeMs = Math.max(existing.maxTimeMs, executionTimeMs);
      existing.lastExecuted = new Date();
    } else {
      // Limit tracked queries
      if (this.slowQueries.size >= MAX_TRACKED_SLOW_QUERIES) {
        // Remove oldest entry
        const oldest = Array.from(this.slowQueries.entries()).sort(
          (a, b) => a[1].lastExecuted.getTime() - b[1].lastExecuted.getTime()
        )[0];
        if (oldest) {
          this.slowQueries.delete(oldest[0]);
        }
      }

      this.slowQueries.set(queryHash, {
        id: queryHash,
        query,
        table,
        executionTimeMs,
        callCount: 1,
        avgTimeMs: executionTimeMs,
        maxTimeMs: executionTimeMs,
        lastExecuted: new Date(),
        plan: null,
      });
    }
  }

  private hashQuery(query: string): string {
    // Simple hash for query deduplication
    let hash = 0;
    const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getSlowQueries(): SlowQuery[] {
    return Array.from(this.slowQueries.values()).sort(
      (a, b) => b.avgTimeMs - a.avgTimeMs
    );
  }

  async analyzeSlowQuery(queryId: string): Promise<QueryPlan | null> {
    const slowQuery = this.slowQueries.get(queryId);
    if (!slowQuery) return null;

    const plan = await this.analyzeQuery(slowQuery.query);
    slowQuery.plan = plan;
    return plan;
  }

  clearSlowQueries(): void {
    this.slowQueries.clear();
  }

  // --------------------------------------------------------------------------
  // Index Recommendations
  // --------------------------------------------------------------------------

  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    if (!this.supabase) throw new Error('QueryOptimizer not initialized');

    const recommendations: IndexRecommendation[] = [];

    // Analyze slow queries for missing indexes
    for (const slowQuery of this.slowQueries.values()) {
      if (slowQuery.plan?.seqScanWarning) {
        const columns = this.extractFilterColumns(slowQuery.query);
        if (columns.length > 0) {
          recommendations.push({
            table: slowQuery.table,
            columns,
            type: 'btree',
            reason: `Sequential scan on ${slowQuery.table} affecting ${slowQuery.callCount} queries`,
            estimatedImprovement: 'High - could reduce query time significantly',
            createStatement: this.generateIndexStatement(slowQuery.table, columns),
          });
        }
      }
    }

    // Check for common missing indexes on ORACLE tables
    const oracleTables = [
      'oracle_signals',
      'oracle_decisions',
      'oracle_execution_steps',
      'oracle_ghost_actions',
    ];

    for (const table of oracleTables) {
      const usage = await this.checkIndexUsage(table);
      if (usage && usage.unusedIndexes.length > 0) {
        // Note: This is informational, not a recommendation to add
      }
    }

    return recommendations;
  }

  private extractFilterColumns(query: string): string[] {
    const columns: string[] = [];
    const whereMatch = query.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/is);
    if (whereMatch) {
      const conditions = whereMatch[1];
      const columnMatches = conditions.matchAll(/(\w+)\s*[=<>!]/g);
      for (const match of columnMatches) {
        if (!columns.includes(match[1])) {
          columns.push(match[1]);
        }
      }
    }
    return columns;
  }

  private generateIndexStatement(table: string, columns: string[]): string {
    const indexName = `idx_${table}_${columns.join('_')}`;
    return `CREATE INDEX ${indexName} ON ${table}(${columns.join(', ')});`;
  }

  private async checkIndexUsage(table: string): Promise<{
    usedIndexes: string[];
    unusedIndexes: string[];
  } | null> {
    if (!this.supabase) return null;

    try {
      const { data } = await this.supabase.rpc('get_index_usage', { table_name: table });
      if (!data) return null;

      return {
        usedIndexes: data.filter((i: any) => i.idx_scan > 0).map((i: any) => i.indexrelname),
        unusedIndexes: data.filter((i: any) => i.idx_scan === 0).map((i: any) => i.indexrelname),
      };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Batch Operations
  // --------------------------------------------------------------------------

  setBatchWindow(windowMs: number): void {
    this.batchWindowMs = Math.max(50, Math.min(200, windowMs));
  }

  async batchInsert<T extends Record<string, any>>(
    table: string,
    data: T[]
  ): Promise<BatchResult> {
    return this.executeBatch('insert', table, data);
  }

  async batchUpdate<T extends Record<string, any>>(
    table: string,
    data: T[]
  ): Promise<BatchResult> {
    return this.executeBatch('update', table, data);
  }

  async batchUpsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    conflictColumns: string[]
  ): Promise<BatchResult> {
    return this.executeBatch('upsert', table, data, conflictColumns);
  }

  async batchDelete(
    table: string,
    ids: string[]
  ): Promise<BatchResult> {
    return this.executeBatch('delete', table, ids.map(id => ({ id })));
  }

  private async executeBatch<T>(
    operation: BatchOperation['operation'],
    table: string,
    data: T[],
    conflictColumns?: string[]
  ): Promise<BatchResult> {
    if (!this.supabase) throw new Error('QueryOptimizer not initialized');

    const startTime = performance.now();
    const results: BatchResult = {
      operation,
      table,
      successCount: 0,
      errorCount: 0,
      errors: [],
      executionTimeMs: 0,
    };

    try {
      // Chunk data for large batches
      const chunkSize = 1000;
      const chunks = this.chunkArray(data, chunkSize);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        let query;
        switch (operation) {
          case 'insert':
            query = this.supabase.from(table).insert(chunk);
            break;
          case 'update':
            // For updates, need to handle each row individually or use upsert
            for (let i = 0; i < chunk.length; i++) {
              const item = chunk[i] as Record<string, any>;
              const { id, ...rest } = item;
              const { error } = await this.supabase
                .from(table)
                .update(rest)
                .eq('id', id);

              if (error) {
                results.errorCount++;
                results.errors.push({
                  index: chunkIndex * chunkSize + i,
                  error: error.message,
                });
              } else {
                results.successCount++;
              }
            }
            continue;
          case 'upsert':
            query = this.supabase.from(table).upsert(chunk, {
              onConflict: conflictColumns?.join(','),
            });
            break;
          case 'delete':
            const ids = (chunk as any[]).map((item) => item.id);
            query = this.supabase.from(table).delete().in('id', ids);
            break;
        }

        if (query) {
          const { error } = await query;
          if (error) {
            results.errorCount += chunk.length;
            chunk.forEach((_, i) => {
              results.errors.push({
                index: chunkIndex * chunkSize + i,
                error: error.message,
              });
            });
          } else {
            results.successCount += chunk.length;
          }
        }
      }
    } catch (error) {
      results.errorCount = data.length;
      results.errors.push({
        index: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    results.executionTimeMs = performance.now() - startTime;

    // Track performance
    await performanceMonitor.recordMetric(
      'database_query',
      `batch_${operation}:${table}`,
      results.executionTimeMs,
      results.errorCount === 0,
      {
        rowCount: data.length,
        successCount: results.successCount,
        errorCount: results.errorCount,
      }
    );

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // --------------------------------------------------------------------------
  // Query Caching
  // --------------------------------------------------------------------------

  async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlMs: number = 60000
  ): Promise<T> {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      performanceMonitor.recordCacheHit('query_cache');
      return cached.result as T;
    }

    performanceMonitor.recordCacheMiss('query_cache');
    const result = await queryFn();

    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttlMs,
    });

    return result;
  }

  invalidateCache(keyPattern?: string): void {
    if (!keyPattern) {
      this.queryCache.clear();
      return;
    }

    const regex = new RegExp(keyPattern);
    for (const key of this.queryCache.keys()) {
      if (regex.test(key)) {
        this.queryCache.delete(key);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Database Statistics
  // --------------------------------------------------------------------------

  async getDatabaseStats(): Promise<DatabaseStats> {
    if (!this.supabase) throw new Error('QueryOptimizer not initialized');

    const stats: DatabaseStats = {
      totalTables: 0,
      totalIndexes: 0,
      totalRows: {},
      tablesSizes: {},
      indexUsage: {},
      cacheHitRatio: 0,
      connectionCount: 0,
      activeQueries: 0,
    };

    try {
      // Get table info
      const { data: tables } = await this.supabase.rpc('get_table_stats');
      if (tables) {
        stats.totalTables = tables.length;
        tables.forEach((t: any) => {
          if (t.relname.startsWith('oracle_')) {
            stats.totalRows[t.relname] = t.n_live_tup;
            stats.tablesSizes[t.relname] = t.total_size;
          }
        });
      }

      // Get index info
      const { data: indexes } = await this.supabase.rpc('get_index_stats');
      if (indexes) {
        stats.totalIndexes = indexes.length;
        indexes.forEach((i: any) => {
          if (i.relname.startsWith('oracle_') || i.indexrelname.includes('oracle_')) {
            stats.indexUsage[i.indexrelname] = {
              scans: i.idx_scan,
              tupleReads: i.idx_tup_read,
            };
          }
        });
      }

      // Get cache hit ratio
      const { data: cacheStats } = await this.supabase.rpc('get_cache_hit_ratio');
      if (cacheStats?.[0]) {
        stats.cacheHitRatio = parseFloat(cacheStats[0].ratio) || 0;
      }
    } catch {
      // Return partial stats on error
    }

    return stats;
  }

  // --------------------------------------------------------------------------
  // Optimized Query Helpers
  // --------------------------------------------------------------------------

  /**
   * Execute a query with automatic tracking and caching
   */
  async executeQuery<T>(
    table: string,
    queryBuilder: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
    options: {
      useReadReplica?: boolean;
      cacheKey?: string;
      cacheTtl?: number;
    } = {}
  ): Promise<T | null> {
    const { useReadReplica = false, cacheKey, cacheTtl = 60000 } = options;

    const executeQueryFn = async (): Promise<T | null> => {
      const client = useReadReplica ? this.getReadClient() : this.getWriteClient();
      const startTime = performance.now();

      const { data, error } = await queryBuilder(client);

      const executionTime = performance.now() - startTime;

      // Track query performance
      this.trackQuery(
        `${table} query`,
        table,
        executionTime
      );

      await performanceMonitor.recordMetric(
        'database_query',
        `select:${table}`,
        executionTime,
        !error,
        { useReadReplica }
      );

      if (error) throw error;
      return data;
    };

    if (cacheKey) {
      return this.cachedQuery(cacheKey, executeQueryFn, cacheTtl);
    }

    return executeQueryFn();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queryOptimizer = new QueryOptimizer();

export default queryOptimizer;
