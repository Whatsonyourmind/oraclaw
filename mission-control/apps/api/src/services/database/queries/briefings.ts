/**
 * Briefing Database Queries
 * CRUD for briefings table
 */

import { db } from '../client.js';

export interface BriefingRow {
  id: string;
  user_id: string;
  date: string;
  summary: string;
  priorities: any;
  time_windows: any;
  recommended_actions: any;
  delegation_opportunities: any;
  confidence: number;
  created_at: string;
}

export const briefingQueries = {
  async create(userId: string, data: {
    date: string;
    summary: string;
    priorities: any;
    time_windows?: any;
    recommended_actions?: any;
    delegation_opportunities?: any;
    confidence?: number;
  }): Promise<BriefingRow | null> {
    try {
      const result = await db.query<BriefingRow>(
        `INSERT INTO briefings (user_id, date, summary, priorities, time_windows, recommended_actions, delegation_opportunities, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          data.date,
          data.summary,
          JSON.stringify(data.priorities),
          JSON.stringify(data.time_windows || []),
          JSON.stringify(data.recommended_actions || []),
          JSON.stringify(data.delegation_opportunities || []),
          data.confidence || 0.8,
        ]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  },

  async getByDate(userId: string, date: string): Promise<BriefingRow | null> {
    try {
      const result = await db.query<BriefingRow>(
        'SELECT * FROM briefings WHERE user_id = $1 AND date = $2 ORDER BY created_at DESC LIMIT 1',
        [userId, date]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  },

  async listRecent(userId: string, limit = 7): Promise<BriefingRow[]> {
    try {
      const result = await db.query<BriefingRow>(
        'SELECT * FROM briefings WHERE user_id = $1 ORDER BY date DESC LIMIT $2',
        [userId, limit]
      );
      return result.rows;
    } catch {
      return [];
    }
  },
};
