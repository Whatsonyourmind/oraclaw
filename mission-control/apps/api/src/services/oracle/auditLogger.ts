/**
 * ORACLE Audit Logger
 * Story sec-2 - Comprehensive audit logging for compliance
 *
 * Features:
 * - oracle_audit_logs table
 * - Log all create/update/delete operations
 * - Log AI queries (sanitized)
 * - Retention policy settings
 * - Export audit logs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_delete'
  | 'ai_query'
  | 'ai_response'
  | 'export'
  | 'import'
  | 'login'
  | 'logout'
  | 'password_change'
  | 'settings_change'
  | 'permission_change'
  | 'integration_connect'
  | 'integration_disconnect'
  | 'sync'
  | 'encrypt'
  | 'decrypt'
  | 'share'
  | 'unshare'
  | 'custom';

export type AuditCategory =
  | 'signal'
  | 'context'
  | 'decision'
  | 'option'
  | 'plan'
  | 'step'
  | 'ghost_action'
  | 'prediction'
  | 'pattern'
  | 'integration'
  | 'ai'
  | 'auth'
  | 'settings'
  | 'system';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogEntry {
  id?: string;
  user_id: string;
  action: AuditAction;
  category: AuditCategory;
  severity: AuditSeverity;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  old_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  request_id?: string;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
  created_at?: string;
}

export interface RetentionPolicy {
  enabled: boolean;
  retentionDays: number;
  archiveEnabled: boolean;
  archiveAfterDays: number;
  deleteAfterArchive: boolean;
}

export interface AuditQueryOptions {
  userId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'severity';
  orderDirection?: 'asc' | 'desc';
}

export interface AuditExportOptions {
  format: 'json' | 'csv';
  query?: AuditQueryOptions;
  includeMetadata?: boolean;
  sanitize?: boolean;
}

export interface AuditStats {
  totalLogs: number;
  logsByAction: Record<AuditAction, number>;
  logsByCategory: Record<AuditCategory, number>;
  logsBySeverity: Record<AuditSeverity, number>;
  successRate: number;
  periodStart: Date;
  periodEnd: Date;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  enabled: true,
  retentionDays: 90,
  archiveEnabled: true,
  archiveAfterDays: 30,
  deleteAfterArchive: false,
};

// Fields to sanitize in AI queries
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'key',
  'credential',
  'api_key',
  'access_token',
  'refresh_token',
  'private',
];

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

export class AuditLogger {
  private supabase: SupabaseClient | null = null;
  private retentionPolicy: RetentionPolicy = DEFAULT_RETENTION_POLICY;
  private buffer: AuditLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushIntervalMs = 5000;
  private maxBufferSize = 50;
  private enabled = true;

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(supabaseUrl: string, supabaseKey: string): Promise<void> {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    await this.loadRetentionPolicy();
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // --------------------------------------------------------------------------
  // Retention Policy
  // --------------------------------------------------------------------------

  private async loadRetentionPolicy(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data } = await this.supabase
        .from('oracle_system_settings')
        .select('audit_retention_policy')
        .single();

      if (data?.audit_retention_policy) {
        this.retentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...data.audit_retention_policy };
      }
    } catch {
      // Use defaults
    }
  }

  async updateRetentionPolicy(policy: Partial<RetentionPolicy>): Promise<void> {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };

    if (this.supabase) {
      await this.supabase
        .from('oracle_system_settings')
        .upsert({
          id: 'audit_retention',
          audit_retention_policy: this.retentionPolicy,
          updated_at: new Date().toISOString(),
        });
    }
  }

  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  // --------------------------------------------------------------------------
  // Logging Methods
  // --------------------------------------------------------------------------

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
    if (!this.enabled) return;

    const fullEntry: AuditLogEntry = {
      ...entry,
      created_at: new Date().toISOString(),
    };

    this.buffer.push(fullEntry);

    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Log a create operation
   */
  async logCreate(
    userId: string,
    category: AuditCategory,
    entityType: string,
    entityId: string,
    entityName: string,
    newValue: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'create',
      category,
      severity: this.getSeverityForAction('create', category),
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      new_value: this.sanitizeValue(newValue),
      metadata,
      success: true,
    });
  }

  /**
   * Log an update operation
   */
  async logUpdate(
    userId: string,
    category: AuditCategory,
    entityType: string,
    entityId: string,
    entityName: string,
    oldValue: any,
    newValue: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'update',
      category,
      severity: this.getSeverityForAction('update', category),
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_value: this.sanitizeValue(oldValue),
      new_value: this.sanitizeValue(newValue),
      metadata,
      success: true,
    });
  }

  /**
   * Log a delete operation
   */
  async logDelete(
    userId: string,
    category: AuditCategory,
    entityType: string,
    entityId: string,
    entityName: string,
    oldValue?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'delete',
      category,
      severity: this.getSeverityForAction('delete', category),
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_value: this.sanitizeValue(oldValue),
      metadata,
      success: true,
    });
  }

  /**
   * Log an AI query (sanitized)
   */
  async logAIQuery(
    userId: string,
    provider: string,
    model: string,
    prompt: string,
    response: string,
    durationMs: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'ai_query',
      category: 'ai',
      severity: success ? 'low' : 'high',
      entity_type: `${provider}/${model}`,
      old_value: this.sanitizeAIContent(prompt),
      new_value: success ? this.sanitizeAIContent(response) : undefined,
      metadata: {
        provider,
        model,
        prompt_length: prompt.length,
        response_length: response?.length || 0,
      },
      success,
      error_message: error,
      duration_ms: durationMs,
    });
  }

  /**
   * Log an error
   */
  async logError(
    userId: string,
    action: AuditAction,
    category: AuditCategory,
    entityType: string,
    errorMessage: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      category,
      severity: 'high',
      entity_type: entityType,
      success: false,
      error_message: errorMessage,
      metadata,
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    userId: string,
    action: 'login' | 'logout' | 'password_change' | 'permission_change',
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      category: 'auth',
      severity: success ? 'medium' : 'critical',
      entity_type: 'user',
      entity_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
      metadata,
    });
  }

  /**
   * Log an integration event
   */
  async logIntegrationEvent(
    userId: string,
    action: 'integration_connect' | 'integration_disconnect' | 'sync',
    integrationName: string,
    integrationId: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      category: 'integration',
      severity: success ? 'low' : 'high',
      entity_type: integrationName,
      entity_id: integrationId,
      entity_name: integrationName,
      success,
      metadata,
    });
  }

  // --------------------------------------------------------------------------
  // Sanitization
  // --------------------------------------------------------------------------

  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    const sanitized = Array.isArray(value) ? [...value] : { ...value };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeValue(sanitized[key]);
      }
    }

    return sanitized;
  }

  private sanitizeAIContent(content: string): string {
    if (!content) return content;

    let sanitized = content;

    // Remove potential sensitive patterns
    const patterns = [
      /password[=:]\s*["']?[^"'\s]+["']?/gi,
      /api[_-]?key[=:]\s*["']?[^"'\s]+["']?/gi,
      /token[=:]\s*["']?[^"'\s]+["']?/gi,
      /secret[=:]\s*["']?[^"'\s]+["']?/gi,
      /bearer\s+[a-z0-9._-]+/gi,
    ];

    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Truncate if too long
    if (sanitized.length > 1000) {
      sanitized = sanitized.slice(0, 1000) + '... [TRUNCATED]';
    }

    return sanitized;
  }

  private getSeverityForAction(action: AuditAction, category: AuditCategory): AuditSeverity {
    // High severity for deletions of important entities
    if (action === 'delete' && ['decision', 'plan'].includes(category)) {
      return 'high';
    }

    // Medium severity for creates and updates
    if (['create', 'update'].includes(action)) {
      return 'medium';
    }

    // Low severity for reads
    if (action === 'read') {
      return 'low';
    }

    return 'medium';
  }

  // --------------------------------------------------------------------------
  // Flushing
  // --------------------------------------------------------------------------

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.supabase) return;

    const toFlush = [...this.buffer];
    this.buffer = [];

    try {
      await this.supabase.from('oracle_audit_logs').insert(toFlush);
    } catch (error) {
      // Re-add to buffer on failure
      this.buffer = [...toFlush, ...this.buffer];
      console.error('Failed to flush audit logs:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  async query(options: AuditQueryOptions = {}): Promise<AuditLogEntry[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('oracle_audit_logs')
      .select('*');

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options.action) {
      query = query.eq('action', options.action);
    }
    if (options.category) {
      query = query.eq('category', options.category);
    }
    if (options.severity) {
      query = query.eq('severity', options.severity);
    }
    if (options.entityType) {
      query = query.eq('entity_type', options.entityType);
    }
    if (options.entityId) {
      query = query.eq('entity_id', options.entityId);
    }
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }
    if (options.success !== undefined) {
      query = query.eq('success', options.success);
    }

    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getStats(userId: string, periodDays: number = 30): Promise<AuditStats> {
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    const logs = await this.query({
      userId,
      startDate: periodStart,
      endDate: periodEnd,
    });

    const logsByAction: Record<string, number> = {};
    const logsByCategory: Record<string, number> = {};
    const logsBySeverity: Record<string, number> = {};
    let successCount = 0;

    for (const log of logs) {
      logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
      logsBySeverity[log.severity] = (logsBySeverity[log.severity] || 0) + 1;
      if (log.success) successCount++;
    }

    return {
      totalLogs: logs.length,
      logsByAction: logsByAction as Record<AuditAction, number>,
      logsByCategory: logsByCategory as Record<AuditCategory, number>,
      logsBySeverity: logsBySeverity as Record<AuditSeverity, number>,
      successRate: logs.length > 0 ? (successCount / logs.length) * 100 : 100,
      periodStart,
      periodEnd,
    };
  }

  // --------------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------------

  async export(options: AuditExportOptions): Promise<string> {
    const logs = await this.query(options.query || {});

    if (options.sanitize !== false) {
      // Additional sanitization for export
    }

    if (options.format === 'csv') {
      return this.exportToCsv(logs, options.includeMetadata);
    }

    return JSON.stringify(logs, null, 2);
  }

  private exportToCsv(logs: AuditLogEntry[], includeMetadata = false): string {
    const headers = [
      'id',
      'user_id',
      'action',
      'category',
      'severity',
      'entity_type',
      'entity_id',
      'entity_name',
      'success',
      'error_message',
      'duration_ms',
      'created_at',
    ];

    if (includeMetadata) {
      headers.push('metadata');
    }

    const rows = logs.map(log => {
      const row = headers.map(h => {
        const value = (log as any)[h];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/"/g, '""');
      });
      return `"${row.join('","')}"`;
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // --------------------------------------------------------------------------
  // Retention Management
  // --------------------------------------------------------------------------

  async applyRetentionPolicy(): Promise<{ deleted: number; archived: number }> {
    if (!this.supabase || !this.retentionPolicy.enabled) {
      return { deleted: 0, archived: 0 };
    }

    let deleted = 0;
    let archived = 0;

    const cutoffDate = new Date(
      Date.now() - this.retentionPolicy.retentionDays * 24 * 60 * 60 * 1000
    );

    // Archive old logs if enabled
    if (this.retentionPolicy.archiveEnabled) {
      const archiveCutoff = new Date(
        Date.now() - this.retentionPolicy.archiveAfterDays * 24 * 60 * 60 * 1000
      );

      const { data: toArchive } = await this.supabase
        .from('oracle_audit_logs')
        .select('*')
        .lt('created_at', archiveCutoff.toISOString())
        .gte('created_at', cutoffDate.toISOString());

      if (toArchive && toArchive.length > 0) {
        await this.supabase.from('oracle_audit_logs_archive').insert(toArchive);
        archived = toArchive.length;
      }
    }

    // Delete old logs
    const { count } = await this.supabase
      .from('oracle_audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    deleted = count || 0;

    return { deleted, archived };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const auditLogger = new AuditLogger();

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

export function auditMiddleware() {
  return async (req: any, res: any, next: any) => {
    const originalEnd = res.end;
    const startTime = Date.now();

    res.end = async function (...args: any[]) {
      const duration = Date.now() - startTime;

      // Only log mutating operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const userId = req.userId || 'anonymous';
        const action = req.method === 'POST' ? 'create' :
                       req.method === 'DELETE' ? 'delete' : 'update';

        await auditLogger.log({
          user_id: userId,
          action: action as AuditAction,
          category: 'system',
          severity: 'low',
          entity_type: req.path,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          request_id: req.headers['x-request-id'],
          success: res.statusCode < 400,
          error_message: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
          duration_ms: duration,
        });
      }

      originalEnd.apply(res, args);
    };

    next();
  };
}

export default auditLogger;
