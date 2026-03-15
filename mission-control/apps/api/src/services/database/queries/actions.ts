/**
 * Action/Execution Plan Database Queries
 * CRUD for oracle execution plans and steps (ACT phase)
 */

import { db } from '../client.js';

export interface ExecutionPlanRow {
  id: string;
  decision_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  health_score: number;
  progress_percentage: number;
  total_steps: number;
  completed_steps: number;
  blocked_steps: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export const actionQueries = {
  async createPlan(userId: string, data: {
    decision_id?: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<ExecutionPlanRow | null> {
    // Check if table exists (graceful degradation)
    try {
      const result = await db.query<ExecutionPlanRow>(
        `INSERT INTO actions (mission_id, type, title, description, metadata, status)
         VALUES ($1, 'task', $2, $3, $4, 'pending')
         RETURNING id, mission_id as decision_id, title, description, status, metadata, created_at`,
        [data.decision_id || null, data.title, data.description || null, JSON.stringify(data.metadata || {})]
      );
      if (result.rows[0]) {
        return {
          ...result.rows[0],
          user_id: userId,
          health_score: 1.0,
          progress_percentage: 0,
          total_steps: 0,
          completed_steps: 0,
          blocked_steps: 0,
          updated_at: result.rows[0].created_at,
          started_at: null,
          completed_at: null,
        };
      }
    } catch {
      // Table might not exist yet
    }
    return null;
  },

  async getPlanById(id: string, userId: string): Promise<ExecutionPlanRow | null> {
    try {
      const result = await db.query<any>(
        'SELECT * FROM actions WHERE id = $1',
        [id]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        decision_id: row.mission_id,
        user_id: userId,
        title: row.title,
        description: row.description,
        status: row.status,
        health_score: 1.0,
        progress_percentage: row.status === 'completed' ? 100 : 0,
        total_steps: 0,
        completed_steps: 0,
        blocked_steps: 0,
        metadata: row.metadata || {},
        created_at: row.created_at,
        updated_at: row.created_at,
        started_at: null,
        completed_at: row.completed_at,
      };
    } catch {
      return null;
    }
  },

  async listPlans(userId: string, status?: string, limit = 50): Promise<ExecutionPlanRow[]> {
    try {
      if (status) {
        const result = await db.query<any>(
          "SELECT * FROM actions WHERE type = 'task' AND status = $1 ORDER BY created_at DESC LIMIT $2",
          [status, limit]
        );
        return result.rows.map((row: any) => ({
          id: row.id,
          decision_id: row.mission_id,
          user_id: userId,
          title: row.title,
          description: row.description,
          status: row.status,
          health_score: 1.0,
          progress_percentage: 0,
          total_steps: 0,
          completed_steps: 0,
          blocked_steps: 0,
          metadata: row.metadata || {},
          created_at: row.created_at,
          updated_at: row.created_at,
          started_at: null,
          completed_at: row.completed_at,
        }));
      }
      const result = await db.query<any>(
        "SELECT * FROM actions WHERE type = 'task' ORDER BY created_at DESC LIMIT $1",
        [limit]
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        decision_id: row.mission_id,
        user_id: userId,
        title: row.title,
        description: row.description,
        status: row.status,
        health_score: 1.0,
        progress_percentage: 0,
        total_steps: 0,
        completed_steps: 0,
        blocked_steps: 0,
        metadata: row.metadata || {},
        created_at: row.created_at,
        updated_at: row.created_at,
        started_at: null,
        completed_at: row.completed_at,
      }));
    } catch {
      return [];
    }
  },

  async updatePlanStatus(id: string, status: string): Promise<boolean> {
    try {
      const result = await db.query(
        'UPDATE actions SET status = $2 WHERE id = $1',
        [id, status]
      );
      return result.rowCount > 0;
    } catch {
      return false;
    }
  },
};
