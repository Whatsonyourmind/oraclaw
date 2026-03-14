/**
 * ORACLE Offline-First Sync Engine
 * Stories sync-1, sync-2, sync-3
 *
 * sync-1 Features:
 * - Local SQLite/WatermelonDB for offline storage
 * - Sync queue for pending operations
 * - Conflict resolution strategies
 * - Background sync when online
 * - Sync progress indicator
 *
 * sync-2 Features:
 * - Version tracking for local DB
 * - Migration scripts runner
 * - Rollback capability
 * - Migration on app update
 *
 * sync-3 Features:
 * - Sync scope selector (all, recent, favorites)
 * - Storage usage indicator
 * - Clear offline data option
 * - Sync on WiFi only toggle
 */

import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus, Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncEntityType = 'signal' | 'decision' | 'step' | 'plan' | 'ghost_action';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';
export type ConflictResolution = 'local_wins' | 'server_wins' | 'merge' | 'manual';
export type SyncScope = 'all' | 'recent' | 'favorites';

export interface SyncOperation {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperationType;
  data: any;
  timestamp: number;
  status: SyncStatus;
  retry_count: number;
  error?: string;
  conflict_data?: any;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current_operation?: string;
  is_syncing: boolean;
  last_sync?: Date;
  next_sync?: Date;
}

export interface SyncSettings {
  enabled: boolean;
  scope: SyncScope;
  wifi_only: boolean;
  auto_sync_interval_minutes: number;
  max_retry_count: number;
  conflict_resolution: ConflictResolution;
  sync_on_app_foreground: boolean;
}

export interface StorageStats {
  total_bytes: number;
  used_bytes: number;
  signals_count: number;
  decisions_count: number;
  steps_count: number;
  plans_count: number;
  pending_operations: number;
}

export interface MigrationScript {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
  down: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  SYNC_SETTINGS: 'oracle_sync_settings',
  LAST_SYNC: 'oracle_last_sync',
  DB_VERSION: 'oracle_db_version',
} as const;

const DB_NAME = 'oracle_offline.db';
const CURRENT_DB_VERSION = 1;

const DEFAULT_SETTINGS: SyncSettings = {
  enabled: true,
  scope: 'recent',
  wifi_only: false,
  auto_sync_interval_minutes: 15,
  max_retry_count: 3,
  conflict_resolution: 'server_wins',
  sync_on_app_foreground: true,
};

// ============================================================================
// MIGRATION SCRIPTS
// ============================================================================

const MIGRATIONS: MigrationScript[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db) => {
      await db.execAsync(`
        -- Sync queue
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          data TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          error TEXT,
          conflict_data TEXT
        );

        -- Local signals cache
        CREATE TABLE IF NOT EXISTS signals (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          is_favorite INTEGER DEFAULT 0,
          local_modified INTEGER DEFAULT 0,
          server_modified INTEGER DEFAULT 0,
          synced_at INTEGER
        );

        -- Local decisions cache
        CREATE TABLE IF NOT EXISTS decisions (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          is_favorite INTEGER DEFAULT 0,
          local_modified INTEGER DEFAULT 0,
          server_modified INTEGER DEFAULT 0,
          synced_at INTEGER
        );

        -- Local execution steps cache
        CREATE TABLE IF NOT EXISTS steps (
          id TEXT PRIMARY KEY,
          plan_id TEXT,
          data TEXT NOT NULL,
          local_modified INTEGER DEFAULT 0,
          server_modified INTEGER DEFAULT 0,
          synced_at INTEGER
        );

        -- Local execution plans cache
        CREATE TABLE IF NOT EXISTS plans (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          is_favorite INTEGER DEFAULT 0,
          local_modified INTEGER DEFAULT 0,
          server_modified INTEGER DEFAULT 0,
          synced_at INTEGER
        );

        -- Local ghost actions cache
        CREATE TABLE IF NOT EXISTS ghost_actions (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          local_modified INTEGER DEFAULT 0,
          server_modified INTEGER DEFAULT 0,
          synced_at INTEGER
        );

        -- Metadata
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_signals_favorite ON signals(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_decisions_favorite ON decisions(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_steps_plan ON steps(plan_id);
      `);
    },
    down: async (db) => {
      await db.execAsync(`
        DROP TABLE IF EXISTS sync_queue;
        DROP TABLE IF EXISTS signals;
        DROP TABLE IF EXISTS decisions;
        DROP TABLE IF EXISTS steps;
        DROP TABLE IF EXISTS plans;
        DROP TABLE IF EXISTS ghost_actions;
        DROP TABLE IF EXISTS metadata;
      `);
    },
  },
];

// ============================================================================
// OFFLINE SYNC SERVICE
// ============================================================================

class OfflineSyncService {
  private db: SQLite.SQLiteDatabase | null = null;
  private settings: SyncSettings = DEFAULT_SETTINGS;
  private isOnline = true;
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private progress: SyncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    is_syncing: false,
  };
  private listeners: Set<(progress: SyncProgress) => void> = new Set();
  private serverSyncFn?: (operations: SyncOperation[]) => Promise<SyncOperation[]>;

  constructor() {
    this.initialize();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync(DB_NAME);

      // Load settings
      await this.loadSettings();

      // Run migrations
      await this.runMigrations();

      // Setup network listener
      NetInfo.addEventListener(this.handleNetworkChange.bind(this));

      // Setup app state listener
      AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      // Initial network check
      const netState = await NetInfo.fetch();
      this.handleNetworkChange(netState);

      console.log('[OfflineSync] Initialized');
    } catch (error) {
      console.error('[OfflineSync] Initialization failed:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.SYNC_SETTINGS);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('[OfflineSync] Failed to load settings:', error);
    }
  }

  async saveSettings(settings: Partial<SyncSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await SecureStore.setItemAsync(
      STORAGE_KEYS.SYNC_SETTINGS,
      JSON.stringify(this.settings)
    );
  }

  // --------------------------------------------------------------------------
  // Migration System
  // --------------------------------------------------------------------------

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    const currentVersion = await this.getDbVersion();
    console.log(`[OfflineSync] Current DB version: ${currentVersion}`);

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[OfflineSync] Running migration: ${migration.name}`);
        try {
          await migration.up(this.db);
          await this.setDbVersion(migration.version);
        } catch (error) {
          console.error(`[OfflineSync] Migration ${migration.name} failed:`, error);
          throw error;
        }
      }
    }
  }

  private async getDbVersion(): Promise<number> {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.DB_VERSION);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  private async setDbVersion(version: number): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.DB_VERSION, version.toString());
  }

  async rollbackMigration(toVersion: number): Promise<void> {
    if (!this.db) return;

    const currentVersion = await this.getDbVersion();
    console.log(`[OfflineSync] Rolling back from ${currentVersion} to ${toVersion}`);

    const migrationsToRollback = MIGRATIONS
      .filter(m => m.version > toVersion && m.version <= currentVersion)
      .reverse();

    for (const migration of migrationsToRollback) {
      console.log(`[OfflineSync] Rolling back: ${migration.name}`);
      try {
        await migration.down(this.db);
        await this.setDbVersion(migration.version - 1);
      } catch (error) {
        console.error(`[OfflineSync] Rollback ${migration.name} failed:`, error);
        throw error;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Network & App State
  // --------------------------------------------------------------------------

  private handleNetworkChange(state: NetInfoState): void {
    const wasOnline = this.isOnline;
    this.isOnline = state.isConnected === true;

    console.log(`[OfflineSync] Network: ${this.isOnline ? 'online' : 'offline'}`);

    // Check WiFi-only setting
    if (this.settings.wifi_only && state.type !== 'wifi') {
      console.log('[OfflineSync] WiFi-only mode, not syncing on cellular');
      return;
    }

    // Sync when coming back online
    if (!wasOnline && this.isOnline && this.settings.enabled) {
      this.syncToServer();
    }
  }

  private handleAppStateChange(state: AppStateStatus): void {
    if (state === 'active' && this.settings.sync_on_app_foreground && this.isOnline) {
      console.log('[OfflineSync] App foregrounded, syncing...');
      this.syncToServer();
    }
  }

  // --------------------------------------------------------------------------
  // Sync Queue Operations
  // --------------------------------------------------------------------------

  async queueOperation(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperationType,
    data: any
  ): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const op: SyncOperation = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entity_type: entityType,
      entity_id: entityId,
      operation,
      data,
      timestamp: Date.now(),
      status: 'pending',
      retry_count: 0,
    };

    await this.db.runAsync(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, data, timestamp, status, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [op.id, op.entity_type, op.entity_id, op.operation, JSON.stringify(op.data), op.timestamp, op.status, op.retry_count]
    );

    // Also update local cache
    await this.updateLocalCache(entityType, entityId, data, operation);

    // Try to sync immediately if online
    if (this.isOnline && this.settings.enabled) {
      this.syncToServer();
    }

    console.log(`[OfflineSync] Queued ${operation} for ${entityType}:${entityId}`);
    return op.id;
  }

  private async updateLocalCache(
    entityType: SyncEntityType,
    entityId: string,
    data: any,
    operation: SyncOperationType
  ): Promise<void> {
    if (!this.db) return;

    const table = this.getTableName(entityType);
    const now = Date.now();

    if (operation === 'delete') {
      await this.db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [entityId]);
    } else {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${table} (id, data, local_modified)
         VALUES (?, ?, ?)`,
        [entityId, JSON.stringify(data), now]
      );
    }
  }

  private getTableName(entityType: SyncEntityType): string {
    const tables: Record<SyncEntityType, string> = {
      signal: 'signals',
      decision: 'decisions',
      step: 'steps',
      plan: 'plans',
      ghost_action: 'ghost_actions',
    };
    return tables[entityType];
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    if (!this.db) return [];

    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY timestamp ASC`
    );

    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data),
      conflict_data: row.conflict_data ? JSON.parse(row.conflict_data) : undefined,
    }));
  }

  // --------------------------------------------------------------------------
  // Sync to Server
  // --------------------------------------------------------------------------

  setServerSyncFunction(fn: (operations: SyncOperation[]) => Promise<SyncOperation[]>): void {
    this.serverSyncFn = fn;
  }

  async syncToServer(): Promise<void> {
    if (this.isSyncing || !this.isOnline || !this.settings.enabled) {
      return;
    }

    if (!this.serverSyncFn) {
      console.warn('[OfflineSync] No server sync function configured');
      return;
    }

    this.isSyncing = true;
    console.log('[OfflineSync] Starting sync to server...');

    try {
      const pending = await this.getPendingOperations();
      if (pending.length === 0) {
        console.log('[OfflineSync] No pending operations');
        return;
      }

      this.updateProgress({ total: pending.length, completed: 0, failed: 0, is_syncing: true });

      // Send to server
      const results = await this.serverSyncFn(pending);

      // Process results
      let completed = 0;
      let failed = 0;

      for (const result of results) {
        if (result.status === 'completed') {
          await this.markOperationComplete(result.id);
          completed++;
        } else if (result.status === 'conflict') {
          await this.handleConflict(result);
          failed++;
        } else if (result.status === 'failed') {
          await this.markOperationFailed(result.id, result.error || 'Unknown error');
          failed++;
        }

        this.updateProgress({ completed, failed });
      }

      // Update last sync time
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      this.updateProgress({ is_syncing: false, last_sync: new Date() });
      console.log(`[OfflineSync] Sync complete: ${completed} succeeded, ${failed} failed`);
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
      this.updateProgress({ is_syncing: false });
    } finally {
      this.isSyncing = false;
    }
  }

  private async markOperationComplete(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
      [id]
    );
  }

  private async markOperationFailed(id: string, error: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `UPDATE sync_queue SET status = 'failed', error = ?, retry_count = retry_count + 1 WHERE id = ?`,
      [error, id]
    );
  }

  // --------------------------------------------------------------------------
  // Conflict Resolution
  // --------------------------------------------------------------------------

  private async handleConflict(operation: SyncOperation): Promise<void> {
    if (!this.db) return;

    console.log(`[OfflineSync] Conflict for ${operation.entity_type}:${operation.entity_id}`);

    switch (this.settings.conflict_resolution) {
      case 'local_wins':
        // Keep local, retry sync
        await this.db.runAsync(
          `UPDATE sync_queue SET status = 'pending', retry_count = 0 WHERE id = ?`,
          [operation.id]
        );
        break;

      case 'server_wins':
        // Accept server version, discard local
        await this.db.runAsync(
          `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
          [operation.id]
        );
        if (operation.conflict_data) {
          await this.updateLocalCache(
            operation.entity_type,
            operation.entity_id,
            operation.conflict_data,
            'update'
          );
        }
        break;

      case 'merge':
        // Merge local and server data
        const merged = this.mergeData(operation.data, operation.conflict_data);
        await this.db.runAsync(
          `UPDATE sync_queue SET data = ?, status = 'pending' WHERE id = ?`,
          [JSON.stringify(merged), operation.id]
        );
        break;

      case 'manual':
        // Mark for manual resolution
        await this.db.runAsync(
          `UPDATE sync_queue SET status = 'conflict', conflict_data = ? WHERE id = ?`,
          [JSON.stringify(operation.conflict_data), operation.id]
        );
        break;
    }
  }

  private mergeData(local: any, server: any): any {
    // Simple merge strategy: server wins for conflicts, merge arrays
    if (!server) return local;
    if (!local) return server;

    const merged = { ...server };
    for (const key of Object.keys(local)) {
      if (Array.isArray(local[key]) && Array.isArray(server[key])) {
        // Merge arrays, keeping unique items
        merged[key] = [...new Set([...local[key], ...server[key]])];
      } else if (typeof local[key] === 'object' && typeof server[key] === 'object') {
        merged[key] = this.mergeData(local[key], server[key]);
      } else if (server[key] === undefined) {
        merged[key] = local[key];
      }
    }
    return merged;
  }

  async resolveConflictManually(operationId: string, resolution: 'local' | 'server' | 'custom', customData?: any): Promise<void> {
    if (!this.db) return;

    const row = await this.db.getFirstAsync<any>(
      `SELECT * FROM sync_queue WHERE id = ?`,
      [operationId]
    );

    if (!row) return;

    if (resolution === 'local') {
      await this.db.runAsync(
        `UPDATE sync_queue SET status = 'pending', retry_count = 0 WHERE id = ?`,
        [operationId]
      );
    } else if (resolution === 'server') {
      const conflictData = row.conflict_data ? JSON.parse(row.conflict_data) : null;
      if (conflictData) {
        await this.updateLocalCache(row.entity_type, row.entity_id, conflictData, 'update');
      }
      await this.db.runAsync(
        `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
        [operationId]
      );
    } else if (resolution === 'custom' && customData) {
      await this.db.runAsync(
        `UPDATE sync_queue SET data = ?, status = 'pending' WHERE id = ?`,
        [JSON.stringify(customData), operationId]
      );
    }
  }

  // --------------------------------------------------------------------------
  // Local Cache Query
  // --------------------------------------------------------------------------

  async getLocalData<T>(entityType: SyncEntityType, entityId: string): Promise<T | null> {
    if (!this.db) return null;

    const table = this.getTableName(entityType);
    const row = await this.db.getFirstAsync<any>(
      `SELECT data FROM ${table} WHERE id = ?`,
      [entityId]
    );

    return row ? JSON.parse(row.data) : null;
  }

  async getAllLocalData<T>(entityType: SyncEntityType, options?: {
    favorites_only?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<T[]> {
    if (!this.db) return [];

    const table = this.getTableName(entityType);
    let query = `SELECT data FROM ${table}`;
    const params: any[] = [];

    if (options?.favorites_only) {
      query += ' WHERE is_favorite = 1';
    }

    query += ' ORDER BY local_modified DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
      if (options?.offset) {
        query += ` OFFSET ${options.offset}`;
      }
    }

    const rows = await this.db.getAllAsync<any>(query, params);
    return rows.map(row => JSON.parse(row.data));
  }

  async setFavorite(entityType: SyncEntityType, entityId: string, isFavorite: boolean): Promise<void> {
    if (!this.db) return;

    const table = this.getTableName(entityType);
    await this.db.runAsync(
      `UPDATE ${table} SET is_favorite = ? WHERE id = ?`,
      [isFavorite ? 1 : 0, entityId]
    );
  }

  // --------------------------------------------------------------------------
  // Storage Management
  // --------------------------------------------------------------------------

  async getStorageStats(): Promise<StorageStats> {
    if (!this.db) {
      return {
        total_bytes: 0,
        used_bytes: 0,
        signals_count: 0,
        decisions_count: 0,
        steps_count: 0,
        plans_count: 0,
        pending_operations: 0,
      };
    }

    const countQuery = async (table: string): Promise<number> => {
      const row = await this.db!.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      return row?.count || 0;
    };

    const [signals, decisions, steps, plans, pending] = await Promise.all([
      countQuery('signals'),
      countQuery('decisions'),
      countQuery('steps'),
      countQuery('plans'),
      countQuery("sync_queue WHERE status IN ('pending', 'failed')"),
    ]);

    // Estimate storage size (rough calculation)
    const pageSize = 4096; // SQLite default page size
    const row = await this.db.getFirstAsync<{ page_count: number }>(
      `PRAGMA page_count`
    );
    const usedBytes = (row?.page_count || 0) * pageSize;

    return {
      total_bytes: 50 * 1024 * 1024, // 50MB limit
      used_bytes: usedBytes,
      signals_count: signals,
      decisions_count: decisions,
      steps_count: steps,
      plans_count: plans,
      pending_operations: pending,
    };
  }

  async clearOfflineData(entityType?: SyncEntityType): Promise<void> {
    if (!this.db) return;

    console.log(`[OfflineSync] Clearing offline data: ${entityType || 'all'}`);

    if (entityType) {
      const table = this.getTableName(entityType);
      await this.db.runAsync(`DELETE FROM ${table}`);
      await this.db.runAsync(
        `DELETE FROM sync_queue WHERE entity_type = ? AND status = 'completed'`,
        [entityType]
      );
    } else {
      await this.db.runAsync(`DELETE FROM signals`);
      await this.db.runAsync(`DELETE FROM decisions`);
      await this.db.runAsync(`DELETE FROM steps`);
      await this.db.runAsync(`DELETE FROM plans`);
      await this.db.runAsync(`DELETE FROM ghost_actions`);
      await this.db.runAsync(`DELETE FROM sync_queue WHERE status = 'completed'`);
    }

    // Vacuum to reclaim space
    await this.db.runAsync(`VACUUM`);
  }

  // --------------------------------------------------------------------------
  // Progress & Listeners
  // --------------------------------------------------------------------------

  private updateProgress(update: Partial<SyncProgress>): void {
    this.progress = { ...this.progress, ...update };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.progress);
    }
  }

  addProgressListener(listener: (progress: SyncProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getProgress(): SyncProgress {
    return this.progress;
  }

  getSettings(): SyncSettings {
    return this.settings;
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // --------------------------------------------------------------------------
  // Auto-Sync Timer
  // --------------------------------------------------------------------------

  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (this.settings.auto_sync_interval_minutes > 0) {
      const intervalMs = this.settings.auto_sync_interval_minutes * 60 * 1000;
      this.syncTimer = setInterval(() => {
        this.syncToServer();
      }, intervalMs);

      console.log(`[OfflineSync] Auto-sync started: every ${this.settings.auto_sync_interval_minutes} minutes`);
    }
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[OfflineSync] Auto-sync stopped');
    }
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const offlineSyncService = new OfflineSyncService();

export {
  OfflineSyncService,
  STORAGE_KEYS as OFFLINE_SYNC_STORAGE_KEYS,
  MIGRATIONS,
  DEFAULT_SETTINGS as DEFAULT_SYNC_SETTINGS,
};

export default offlineSyncService;
