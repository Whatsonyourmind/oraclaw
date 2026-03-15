/**
 * Mission Database Queries
 * CRUD operations for the missions table
 */

import { db } from '../client.js';

export interface MissionRow {
  id: string;
  user_id: string;
  title: string;
  priority: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const missionQueries = {
  async create(userId: string, data: {
    title: string;
    priority?: string;
    status?: string;
    metadata?: Record<string, any>;
  }): Promise<MissionRow | null> {
    const result = await db.query<MissionRow>(
      `INSERT INTO missions (user_id, title, priority, status, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, data.title, data.priority || 'medium', data.status || 'active', JSON.stringify(data.metadata || {})]
    );
    return result.rows[0] || null;
  },

  async getById(id: string, userId: string): Promise<MissionRow | null> {
    const result = await db.query<MissionRow>(
      'SELECT * FROM missions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  },

  async listByUser(userId: string, status?: string, limit = 50): Promise<MissionRow[]> {
    if (status) {
      const result = await db.query<MissionRow>(
        'SELECT * FROM missions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3',
        [userId, status, limit]
      );
      return result.rows;
    }
    const result = await db.query<MissionRow>(
      'SELECT * FROM missions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  },

  async update(id: string, userId: string, data: Partial<MissionRow>): Promise<MissionRow | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 3;

    if (data.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(data.title); }
    if (data.priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(data.priority); }
    if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }
    if (data.metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(JSON.stringify(data.metadata)); }

    if (fields.length === 0) return null;

    const result = await db.query<MissionRow>(
      `UPDATE missions SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, ...values]
    );
    return result.rows[0] || null;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM missions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rowCount > 0;
  },
};
