/**
 * Decision Database Queries
 * CRUD operations for oracle_decisions and related tables
 */

import { db } from '../client.js';

export interface DecisionRow {
  id: string;
  context_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  decision_type: string;
  status: string;
  urgency: string;
  deadline: string | null;
  selected_option_id: string | null;
  decision_rationale: string | null;
  confidence: number;
  constraints: any[];
  criteria: any[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface DecisionOptionRow {
  id: string;
  decision_id: string;
  title: string;
  description: string | null;
  pros: any[];
  cons: any[];
  estimated_outcomes: Record<string, any>;
  resource_requirements: Record<string, any>;
  risks: any[];
  confidence: number;
  score: number | null;
  rank: number | null;
  is_recommended: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const decisionQueries = {
  async create(userId: string, data: {
    context_id?: string;
    title: string;
    description?: string;
    decision_type?: string;
    urgency?: string;
    deadline?: string;
    confidence?: number;
    constraints?: any[];
    criteria?: any[];
    metadata?: Record<string, any>;
  }): Promise<DecisionRow | null> {
    const result = await db.query<DecisionRow>(
      `INSERT INTO oracle_decisions (user_id, context_id, title, description, decision_type, urgency, deadline, confidence, constraints, criteria, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        data.context_id || null,
        data.title,
        data.description || null,
        data.decision_type || 'general',
        data.urgency || 'medium',
        data.deadline || null,
        data.confidence || 0.5,
        JSON.stringify(data.constraints || []),
        JSON.stringify(data.criteria || []),
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0] || null;
  },

  async getById(id: string, userId: string): Promise<DecisionRow | null> {
    const result = await db.query<DecisionRow>(
      'SELECT * FROM oracle_decisions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  },

  async listByUser(userId: string, status?: string, limit = 50): Promise<DecisionRow[]> {
    if (status) {
      const result = await db.query<DecisionRow>(
        'SELECT * FROM oracle_decisions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3',
        [userId, status, limit]
      );
      return result.rows;
    }
    const result = await db.query<DecisionRow>(
      'SELECT * FROM oracle_decisions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  },

  async update(id: string, userId: string, data: Partial<DecisionRow>): Promise<DecisionRow | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 3;

    if (data.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(data.title); }
    if (data.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(data.description); }
    if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }
    if (data.urgency !== undefined) { fields.push(`urgency = $${paramIndex++}`); values.push(data.urgency); }
    if (data.confidence !== undefined) { fields.push(`confidence = $${paramIndex++}`); values.push(data.confidence); }
    if (data.selected_option_id !== undefined) { fields.push(`selected_option_id = $${paramIndex++}`); values.push(data.selected_option_id); }
    if (data.decision_rationale !== undefined) { fields.push(`decision_rationale = $${paramIndex++}`); values.push(data.decision_rationale); }
    if (data.metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(JSON.stringify(data.metadata)); }

    if (fields.length === 0) return null;

    const result = await db.query<DecisionRow>(
      `UPDATE oracle_decisions SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, ...values]
    );
    return result.rows[0] || null;
  },

  async selectOption(decisionId: string, userId: string, optionId: string, rationale?: string): Promise<DecisionRow | null> {
    const result = await db.query<DecisionRow>(
      `UPDATE oracle_decisions SET selected_option_id = $3, decision_rationale = $4, status = 'decided', decided_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [decisionId, userId, optionId, rationale || null]
    );
    return result.rows[0] || null;
  },

  // Decision Options
  async createOption(decisionId: string, data: {
    title: string;
    description?: string;
    pros?: any[];
    cons?: any[];
    estimated_outcomes?: Record<string, any>;
    resource_requirements?: Record<string, any>;
    risks?: any[];
    confidence?: number;
    rank?: number;
    is_recommended?: boolean;
    metadata?: Record<string, any>;
  }): Promise<DecisionOptionRow | null> {
    const result = await db.query<DecisionOptionRow>(
      `INSERT INTO oracle_decision_options (decision_id, title, description, pros, cons, estimated_outcomes, resource_requirements, risks, confidence, rank, is_recommended, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        decisionId,
        data.title,
        data.description || null,
        JSON.stringify(data.pros || []),
        JSON.stringify(data.cons || []),
        JSON.stringify(data.estimated_outcomes || {}),
        JSON.stringify(data.resource_requirements || {}),
        JSON.stringify(data.risks || []),
        data.confidence || 0.5,
        data.rank || null,
        data.is_recommended || false,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0] || null;
  },

  async getOptions(decisionId: string): Promise<DecisionOptionRow[]> {
    const result = await db.query<DecisionOptionRow>(
      'SELECT * FROM oracle_decision_options WHERE decision_id = $1 ORDER BY rank ASC NULLS LAST',
      [decisionId]
    );
    return result.rows;
  },
};
