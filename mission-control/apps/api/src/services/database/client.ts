/**
 * Database Client
 * PostgreSQL connection pool with graceful degradation
 */

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Lightweight DB client interface that can work with or without pg
interface DBClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  connect(): Promise<void>;
  end(): Promise<void>;
  isConnected(): boolean;
}

// In-memory fallback implementation
class InMemoryClient implements DBClient {
  private connected = false;

  async query<T = any>(_text: string, _params?: any[]): Promise<QueryResult<T>> {
    return { rows: [] as T[], rowCount: 0 };
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async end(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// PostgreSQL pool wrapper
class PostgresClient implements DBClient {
  private pool: any;
  private connected = false;

  constructor(private config: DatabaseConfig) {}

  async connect(): Promise<void> {
    try {
      // Dynamic import of pg to avoid hard dependency
      // @ts-ignore - pg may not be installed, handled by try/catch
      const { Pool } = await import('pg');
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        host: this.config.host || 'localhost',
        port: this.config.port || 5432,
        database: this.config.database || 'oracle_db',
        user: this.config.user || 'oracle',
        password: this.config.password || 'oracle_dev',
        max: this.config.max || 20,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 5000,
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      console.log('[DB] PostgreSQL connected successfully');
    } catch (error) {
      console.warn('[DB] PostgreSQL connection failed, using in-memory fallback:', (error as Error).message);
      this.connected = false;
      throw error;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const result = await this.pool.query(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async end(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class DatabaseService {
  private client: DBClient;
  private fallback: InMemoryClient;
  private usesFallback = true;

  constructor() {
    this.fallback = new InMemoryClient();
    this.client = this.fallback;
  }

  async initialize(config?: DatabaseConfig): Promise<void> {
    const connectionString = config?.connectionString || process.env.DATABASE_URL;

    if (!connectionString && !config?.host) {
      console.log('[DB] No database configuration found, using in-memory fallback');
      this.usesFallback = true;
      return;
    }

    const pgClient = new PostgresClient({
      connectionString,
      ...config,
    });

    try {
      await pgClient.connect();
      this.client = pgClient;
      this.usesFallback = false;
    } catch {
      console.log('[DB] Falling back to in-memory storage');
      this.client = this.fallback;
      this.usesFallback = true;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (this.usesFallback) {
      return { rows: [] as T[], rowCount: 0 };
    }
    return this.client.query<T>(text, params);
  }

  isConnected(): boolean {
    return !this.usesFallback && this.client.isConnected();
  }

  isUsingFallback(): boolean {
    return this.usesFallback;
  }

  async healthCheck(): Promise<{ status: string; latency_ms: number; using_fallback: boolean }> {
    const start = Date.now();
    try {
      if (this.usesFallback) {
        return {
          status: 'fallback',
          latency_ms: 0,
          using_fallback: true,
        };
      }
      await this.client.query('SELECT 1');
      return {
        status: 'connected',
        latency_ms: Date.now() - start,
        using_fallback: false,
      };
    } catch {
      return {
        status: 'disconnected',
        latency_ms: Date.now() - start,
        using_fallback: this.usesFallback,
      };
    }
  }

  async shutdown(): Promise<void> {
    await this.client.end();
  }
}

// Singleton instance
export const db = new DatabaseService();
export default db;
