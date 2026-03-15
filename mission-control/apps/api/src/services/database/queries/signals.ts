/**
 * Signal Database Queries
 * CRUD for oracle_signals (OBSERVE phase)
 */

import { db } from '../client.js';

export interface SignalRow {
  id: string;
  user_id: string;
  data_source_id: string | null;
  signal_type: string;
  title: string;
  description: string | null;
  urgency: string;
  impact: string;
  confidence: number;
  status: string;
  source_data: Record<string, any>;
  related_entity_type: string | null;
  related_entity_id: string | null;
  expires_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const signalQueries = {
  async create(userId: string, data: {
    data_source_id?: string;
    signal_type: string;
    title: string;
    description?: string;
    urgency: string;
    impact: string;
    confidence?: number;
    source_data?: Record<string, any>;
    related_entity_type?: string;
    related_entity_id?: string;
    expires_at?: string;
    metadata?: Record<string, any>;
  }): Promise<SignalRow | null> {
    try {
      const result = await db.query<SignalRow>(
        `INSERT INTO oracle_signals (user_id, data_source_id, signal_type, title, description, urgency, impact, confidence, status, source_data, related_entity_type, related_entity_id, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          userId,
          data.data_source_id || null,
          data.signal_type,
          data.title,
          data.description || null,
          data.urgency,
          data.impact,
          data.confidence || 0.5,
          JSON.stringify(data.source_data || {}),
          data.related_entity_type || null,
          data.related_entity_id || null,
          data.expires_at || null,
          JSON.stringify(data.metadata || {}),
        ]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  },

  async getById(id: string, userId: string): Promise<SignalRow | null> {
    try {
      const result = await db.query<SignalRow>(
        'SELECT * FROM oracle_signals WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  },

  async list(userId: string, filters?: {
    status?: string;
    signal_type?: string;
    urgency?: string;
    limit?: number;
    offset?: number;
  }): Promise<SignalRow[]> {
    try {
      const conditions = ['user_id = $1'];
      const values: any[] = [userId];
      let paramIndex = 2;

      if (filters?.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }
      if (filters?.signal_type) {
        conditions.push(`signal_type = $${paramIndex++}`);
        values.push(filters.signal_type);
      }
      if (filters?.urgency) {
        conditions.push(`urgency = $${paramIndex++}`);
        values.push(filters.urgency);
      }

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const result = await db.query<SignalRow>(
        `SELECT * FROM oracle_signals WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...values, limit, offset]
      );
      return result.rows;
    } catch {
      return [];
    }
  },

  async update(id: string, userId: string, data: Partial<SignalRow>): Promise<SignalRow | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 3;

      if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }
      if (data.urgency !== undefined) { fields.push(`urgency = $${paramIndex++}`); values.push(data.urgency); }
      if (data.impact !== undefined) { fields.push(`impact = $${paramIndex++}`); values.push(data.impact); }
      if (data.confidence !== undefined) { fields.push(`confidence = $${paramIndex++}`); values.push(data.confidence); }
      if (data.metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(JSON.stringify(data.metadata)); }

      if (fields.length === 0) return null;

      const result = await db.query<SignalRow>(
        `UPDATE oracle_signals SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId, ...values]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  },

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'DELETE FROM oracle_signals WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return result.rowCount > 0;
    } catch {
      return false;
    }
  },
};
