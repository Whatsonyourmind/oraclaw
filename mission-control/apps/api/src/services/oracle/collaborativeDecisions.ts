/**
 * ORACLE Collaborative Decisions Service
 * Story adv-19 - Multi-user decision support for teams
 */

import type {
  DecisionCollaborator,
  DecisionVote,
  DecisionComment,
  DecisionShare,
  VoteAggregation,
  CollaborativeDecisionState,
  CollaboratorRole,
  CollaboratorStatus,
  VoteType,
  ShareType,
  InviteCollaboratorParams,
  CastVoteParams,
  AddCommentParams,
  CreateShareLinkParams,
} from '@mission-control/shared-types';
import { oracleCacheService, cacheKey, hashObject } from './cache';

// Cache TTLs
const COLLAB_CACHE_TTL = {
  state: 30 * 1000, // 30 seconds (real-time-ish)
  collaborators: 60 * 1000, // 1 minute
  votes: 30 * 1000, // 30 seconds
  aggregation: 15 * 1000, // 15 seconds (frequently updated)
  comments: 60 * 1000, // 1 minute
};

// Types for internal operations
interface NotifyParams {
  decision_id: string;
  event_type: 'vote_cast' | 'comment_added' | 'decision_updated' | 'collaborator_joined';
  actor_id: string;
  data: Record<string, any>;
}

export class CollaborativeDecisionsService {
  // In-memory stores for demo (would use Supabase in production)
  private collaborators: DecisionCollaborator[] = [];
  private votes: DecisionVote[] = [];
  private comments: DecisionComment[] = [];
  private shares: DecisionShare[] = [];
  private aggregations: VoteAggregation[] = [];

  // Event handlers (would be WebSocket or real-time in production)
  private eventHandlers: Map<string, Set<(event: any) => void>> = new Map();

  // =====================================================
  // COLLABORATOR MANAGEMENT
  // =====================================================

  /**
   * Invite a collaborator to a decision
   */
  async inviteCollaborator(
    inviterId: string,
    params: InviteCollaboratorParams
  ): Promise<DecisionCollaborator> {
    // Check inviter has permission
    const inviterRole = await this.getUserRole(params.decision_id, inviterId);
    if (!inviterRole || !['owner', 'editor'].includes(inviterRole)) {
      throw new Error('Insufficient permissions to invite collaborators');
    }

    // Check if already a collaborator
    const existing = this.collaborators.find(
      (c) => c.decision_id === params.decision_id && c.invited_email === params.email
    );
    if (existing) {
      throw new Error('User is already invited to this decision');
    }

    const collaborator: DecisionCollaborator = {
      id: crypto.randomUUID(),
      decision_id: params.decision_id,
      user_id: '', // Will be set when user accepts
      role: params.role,
      invited_by: inviterId,
      invited_email: params.email,
      status: 'pending',
      notify_on_vote: true,
      notify_on_comment: true,
      notify_on_update: true,
      metadata: params.message ? { invite_message: params.message } : {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_decision_collaborators').insert(collaborator);
    this.collaborators.push(collaborator);

    // Invalidate caches
    this.invalidateDecisionCache(params.decision_id);

    // Send invitation email (production would use email service)
    // await emailService.sendCollaborationInvite(params.email, params.decision_id, params.message);

    return collaborator;
  }

  /**
   * Accept a collaboration invitation
   */
  async acceptInvitation(
    userId: string,
    decisionId: string,
    inviteEmail: string
  ): Promise<DecisionCollaborator | null> {
    const index = this.collaborators.findIndex(
      (c) =>
        c.decision_id === decisionId &&
        c.invited_email === inviteEmail &&
        c.status === 'pending'
    );

    if (index === -1) return null;

    const updated: DecisionCollaborator = {
      ...this.collaborators[index],
      user_id: userId,
      status: 'accepted',
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.collaborators[index] = updated;
    this.invalidateDecisionCache(decisionId);

    // Notify other collaborators
    await this.notifyCollaborators({
      decision_id: decisionId,
      event_type: 'collaborator_joined',
      actor_id: userId,
      data: { collaborator_id: updated.id, role: updated.role },
    });

    return updated;
  }

  /**
   * Get collaborators for a decision
   */
  async getCollaborators(decisionId: string): Promise<DecisionCollaborator[]> {
    const cacheKeyStr = cacheKey('collab_collaborators', decisionId);
    const cached = oracleCacheService.get<DecisionCollaborator[]>(cacheKeyStr);
    if (cached) return cached;

    // In production: await supabase.from('oracle_decision_collaborators').select('*, user:users(*)').eq('decision_id', decisionId);
    const result = this.collaborators.filter((c) => c.decision_id === decisionId);

    oracleCacheService.set(cacheKeyStr, result, COLLAB_CACHE_TTL.collaborators);
    return result;
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(
    decisionId: string,
    collaboratorId: string,
    newRole: CollaboratorRole,
    actorId: string
  ): Promise<DecisionCollaborator | null> {
    // Check actor has permission
    const actorRole = await this.getUserRole(decisionId, actorId);
    if (actorRole !== 'owner') {
      throw new Error('Only owners can change collaborator roles');
    }

    const index = this.collaborators.findIndex(
      (c) => c.id === collaboratorId && c.decision_id === decisionId
    );
    if (index === -1) return null;

    const updated: DecisionCollaborator = {
      ...this.collaborators[index],
      role: newRole,
      updated_at: new Date().toISOString(),
    };

    this.collaborators[index] = updated;
    this.invalidateDecisionCache(decisionId);

    return updated;
  }

  /**
   * Remove a collaborator
   */
  async removeCollaborator(
    decisionId: string,
    collaboratorId: string,
    actorId: string
  ): Promise<boolean> {
    // Check actor has permission
    const actorRole = await this.getUserRole(decisionId, actorId);
    if (!actorRole || !['owner', 'editor'].includes(actorRole)) {
      throw new Error('Insufficient permissions to remove collaborators');
    }

    const index = this.collaborators.findIndex(
      (c) => c.id === collaboratorId && c.decision_id === decisionId
    );
    if (index === -1) return false;

    // Cannot remove owner
    if (this.collaborators[index].role === 'owner') {
      throw new Error('Cannot remove the decision owner');
    }

    // Update status to removed instead of deleting
    this.collaborators[index].status = 'removed';
    this.collaborators[index].updated_at = new Date().toISOString();

    this.invalidateDecisionCache(decisionId);
    return true;
  }

  /**
   * Get user's role in a decision
   */
  async getUserRole(decisionId: string, userId: string): Promise<CollaboratorRole | null> {
    const collaborator = this.collaborators.find(
      (c) =>
        c.decision_id === decisionId &&
        c.user_id === userId &&
        c.status === 'accepted'
    );
    return collaborator?.role || null;
  }

  // =====================================================
  // VOTING
  // =====================================================

  /**
   * Cast a vote on a decision option
   */
  async castVote(userId: string, params: CastVoteParams): Promise<DecisionVote> {
    // Check user can vote
    const role = await this.getUserRole(params.decision_id, userId);
    if (!role || !['owner', 'editor', 'voter'].includes(role)) {
      throw new Error('You do not have permission to vote on this decision');
    }

    // Check for existing vote
    const existingIndex = this.votes.findIndex(
      (v) =>
        v.decision_id === params.decision_id &&
        v.option_id === params.option_id &&
        v.user_id === userId
    );

    const vote: DecisionVote = {
      id: existingIndex >= 0 ? this.votes[existingIndex].id : crypto.randomUUID(),
      decision_id: params.decision_id,
      option_id: params.option_id,
      user_id: userId,
      vote_type: params.vote_type,
      preference_rank: params.preference_rank,
      weight: 1.0,
      rationale: params.rationale,
      confidence: params.confidence,
      is_final: params.is_final || false,
      finalized_at: params.is_final ? new Date().toISOString() : undefined,
      metadata: {},
      created_at: existingIndex >= 0 ? this.votes[existingIndex].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Cannot change finalized vote
      if (this.votes[existingIndex].is_final) {
        throw new Error('Cannot change a finalized vote');
      }
      this.votes[existingIndex] = vote;
    } else {
      this.votes.push(vote);
    }

    // Recalculate aggregation
    await this.recalculateAggregation(params.decision_id);

    // Invalidate caches
    this.invalidateDecisionCache(params.decision_id);

    // Notify collaborators
    await this.notifyCollaborators({
      decision_id: params.decision_id,
      event_type: 'vote_cast',
      actor_id: userId,
      data: { option_id: params.option_id, vote_type: params.vote_type },
    });

    return vote;
  }

  /**
   * Get votes for a decision
   */
  async getVotes(decisionId: string): Promise<DecisionVote[]> {
    const cacheKeyStr = cacheKey('collab_votes', decisionId);
    const cached = oracleCacheService.get<DecisionVote[]>(cacheKeyStr);
    if (cached) return cached;

    const result = this.votes.filter((v) => v.decision_id === decisionId);
    oracleCacheService.set(cacheKeyStr, result, COLLAB_CACHE_TTL.votes);
    return result;
  }

  /**
   * Get user's votes for a decision
   */
  async getUserVotes(decisionId: string, userId: string): Promise<DecisionVote[]> {
    return this.votes.filter(
      (v) => v.decision_id === decisionId && v.user_id === userId
    );
  }

  /**
   * Retract a vote (if not finalized)
   */
  async retractVote(
    decisionId: string,
    optionId: string,
    userId: string
  ): Promise<boolean> {
    const index = this.votes.findIndex(
      (v) =>
        v.decision_id === decisionId &&
        v.option_id === optionId &&
        v.user_id === userId
    );

    if (index === -1) return false;
    if (this.votes[index].is_final) {
      throw new Error('Cannot retract a finalized vote');
    }

    this.votes.splice(index, 1);
    await this.recalculateAggregation(decisionId);
    this.invalidateDecisionCache(decisionId);

    return true;
  }

  /**
   * Recalculate vote aggregation for a decision
   */
  private async recalculateAggregation(decisionId: string): Promise<void> {
    const votes = this.votes.filter((v) => v.decision_id === decisionId);

    // Group by option
    const byOption: Record<string, DecisionVote[]> = {};
    votes.forEach((v) => {
      if (!byOption[v.option_id]) byOption[v.option_id] = [];
      byOption[v.option_id].push(v);
    });

    // Calculate aggregation for each option
    for (const [optionId, optionVotes] of Object.entries(byOption)) {
      const approves = optionVotes.filter((v) => v.vote_type === 'approve');
      const rejects = optionVotes.filter((v) => v.vote_type === 'reject');
      const abstains = optionVotes.filter((v) => v.vote_type === 'abstain');

      const weightedApprove = approves.reduce((sum, v) => sum + v.weight, 0);
      const weightedReject = rejects.reduce((sum, v) => sum + v.weight, 0);

      const confidences = optionVotes
        .filter((v) => v.confidence != null)
        .map((v) => v.confidence!);
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : undefined;

      const ranks = optionVotes
        .filter((v) => v.preference_rank != null)
        .map((v) => v.preference_rank!);
      const avgRank =
        ranks.length > 0
          ? ranks.reduce((a, b) => a + b, 0) / ranks.length
          : undefined;

      const aggregation: VoteAggregation = {
        id: crypto.randomUUID(),
        decision_id: decisionId,
        option_id: optionId,
        total_votes: optionVotes.length,
        approve_count: approves.length,
        reject_count: rejects.length,
        abstain_count: abstains.length,
        weighted_approve: weightedApprove,
        weighted_reject: weightedReject,
        net_score: weightedApprove - weightedReject,
        avg_confidence: avgConfidence,
        avg_preference_rank: avgRank,
        last_calculated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update or create aggregation
      const existingIndex = this.aggregations.findIndex(
        (a) => a.decision_id === decisionId && a.option_id === optionId
      );
      if (existingIndex >= 0) {
        this.aggregations[existingIndex] = aggregation;
      } else {
        this.aggregations.push(aggregation);
      }
    }
  }

  /**
   * Get vote aggregation for a decision
   */
  async getAggregation(decisionId: string): Promise<VoteAggregation[]> {
    const cacheKeyStr = cacheKey('collab_aggregation', decisionId);
    const cached = oracleCacheService.get<VoteAggregation[]>(cacheKeyStr);
    if (cached) return cached;

    const result = this.aggregations.filter((a) => a.decision_id === decisionId);
    oracleCacheService.set(cacheKeyStr, result, COLLAB_CACHE_TTL.aggregation);
    return result;
  }

  // =====================================================
  // COMMENTS
  // =====================================================

  /**
   * Add a comment to a decision
   */
  async addComment(userId: string, params: AddCommentParams): Promise<DecisionComment> {
    // Check user can comment
    const role = await this.getUserRole(params.decision_id, userId);
    if (!role || role === 'viewer') {
      throw new Error('You do not have permission to comment on this decision');
    }

    const comment: DecisionComment = {
      id: crypto.randomUUID(),
      decision_id: params.decision_id,
      option_id: params.option_id,
      user_id: userId,
      parent_id: params.parent_id,
      content: params.content,
      content_type: params.content_type || 'text',
      mentions: params.mentions || [],
      reactions: {},
      is_edited: false,
      is_deleted: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.comments.push(comment);
    this.invalidateDecisionCache(params.decision_id);

    // Notify collaborators
    await this.notifyCollaborators({
      decision_id: params.decision_id,
      event_type: 'comment_added',
      actor_id: userId,
      data: {
        comment_id: comment.id,
        option_id: params.option_id,
        preview: params.content.substring(0, 100),
      },
    });

    return comment;
  }

  /**
   * Get comments for a decision
   */
  async getComments(decisionId: string, optionId?: string): Promise<DecisionComment[]> {
    const cacheKeyStr = cacheKey('collab_comments', decisionId, optionId || 'all');
    const cached = oracleCacheService.get<DecisionComment[]>(cacheKeyStr);
    if (cached) return cached;

    let result = this.comments.filter(
      (c) => c.decision_id === decisionId && !c.is_deleted
    );

    if (optionId) {
      result = result.filter((c) => c.option_id === optionId);
    }

    // Build threaded structure
    const threaded = this.buildCommentThread(result);

    oracleCacheService.set(cacheKeyStr, threaded, COLLAB_CACHE_TTL.comments);
    return threaded;
  }

  /**
   * Build comment thread structure
   */
  private buildCommentThread(comments: DecisionComment[]): DecisionComment[] {
    const byId: Record<string, DecisionComment> = {};
    const roots: DecisionComment[] = [];

    // Create lookup and identify roots
    comments.forEach((c) => {
      byId[c.id] = { ...c, replies: [] };
    });

    // Build tree
    comments.forEach((c) => {
      if (c.parent_id && byId[c.parent_id]) {
        byId[c.parent_id].replies = byId[c.parent_id].replies || [];
        byId[c.parent_id].replies!.push(byId[c.id]);
      } else {
        roots.push(byId[c.id]);
      }
    });

    // Sort by created_at
    roots.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return roots;
  }

  /**
   * Edit a comment
   */
  async editComment(
    commentId: string,
    userId: string,
    newContent: string
  ): Promise<DecisionComment | null> {
    const index = this.comments.findIndex(
      (c) => c.id === commentId && c.user_id === userId
    );
    if (index === -1) return null;

    const updated: DecisionComment = {
      ...this.comments[index],
      content: newContent,
      is_edited: true,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.comments[index] = updated;
    this.invalidateDecisionCache(updated.decision_id);

    return updated;
  }

  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const index = this.comments.findIndex(
      (c) => c.id === commentId && c.user_id === userId
    );
    if (index === -1) return false;

    this.comments[index].is_deleted = true;
    this.comments[index].deleted_at = new Date().toISOString();
    this.comments[index].updated_at = new Date().toISOString();

    this.invalidateDecisionCache(this.comments[index].decision_id);
    return true;
  }

  /**
   * Add reaction to a comment
   */
  async addReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<DecisionComment | null> {
    const index = this.comments.findIndex((c) => c.id === commentId);
    if (index === -1) return null;

    const reactions = { ...this.comments[index].reactions };
    if (!reactions[emoji]) reactions[emoji] = [];
    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
    }

    this.comments[index].reactions = reactions;
    this.comments[index].updated_at = new Date().toISOString();

    this.invalidateDecisionCache(this.comments[index].decision_id);
    return this.comments[index];
  }

  /**
   * Remove reaction from a comment
   */
  async removeReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<boolean> {
    const index = this.comments.findIndex((c) => c.id === commentId);
    if (index === -1) return false;

    const reactions = { ...this.comments[index].reactions };
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    }

    this.comments[index].reactions = reactions;
    this.comments[index].updated_at = new Date().toISOString();

    this.invalidateDecisionCache(this.comments[index].decision_id);
    return true;
  }

  // =====================================================
  // SHARE LINKS
  // =====================================================

  /**
   * Create a share link for a decision
   */
  async createShareLink(
    userId: string,
    params: CreateShareLinkParams
  ): Promise<DecisionShare> {
    // Check user can share
    const role = await this.getUserRole(params.decision_id, userId);
    if (!role || !['owner', 'editor'].includes(role)) {
      throw new Error('You do not have permission to share this decision');
    }

    // Generate secure token
    const token = this.generateShareToken();

    const share: DecisionShare = {
      id: crypto.randomUUID(),
      decision_id: params.decision_id,
      created_by: userId,
      share_token: token,
      share_type: params.share_type,
      requires_auth: params.requires_auth || false,
      allowed_domains: params.allowed_domains,
      max_uses: params.max_uses,
      use_count: 0,
      expires_at: params.expires_at,
      is_active: true,
      metadata: {},
      created_at: new Date().toISOString(),
      share_url: `https://oracle.missioncontrol.app/shared/${token}`,
    };

    this.shares.push(share);
    return share;
  }

  /**
   * Generate a secure share token
   */
  private generateShareToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Get share links for a decision
   */
  async getShareLinks(decisionId: string, userId: string): Promise<DecisionShare[]> {
    // Check user can view shares
    const role = await this.getUserRole(decisionId, userId);
    if (!role || !['owner', 'editor'].includes(role)) {
      return [];
    }

    return this.shares.filter((s) => s.decision_id === decisionId && s.is_active);
  }

  /**
   * Access a shared decision via token
   */
  async accessSharedDecision(token: string): Promise<{
    share: DecisionShare;
    decision_id: string;
  } | null> {
    const share = this.shares.find(
      (s) => s.share_token === token && s.is_active
    );

    if (!share) return null;

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return null;
    }

    // Check max uses
    if (share.max_uses && share.use_count >= share.max_uses) {
      return null;
    }

    // Increment use count
    share.use_count++;

    return { share, decision_id: share.decision_id };
  }

  /**
   * Deactivate a share link
   */
  async deactivateShareLink(shareId: string, userId: string): Promise<boolean> {
    const index = this.shares.findIndex((s) => s.id === shareId);
    if (index === -1) return false;

    // Check user can deactivate
    if (this.shares[index].created_by !== userId) {
      const role = await this.getUserRole(this.shares[index].decision_id, userId);
      if (role !== 'owner') {
        throw new Error('Insufficient permissions to deactivate share link');
      }
    }

    this.shares[index].is_active = false;
    return true;
  }

  // =====================================================
  // FULL STATE
  // =====================================================

  /**
   * Get full collaborative decision state
   */
  async getCollaborativeState(
    decisionId: string,
    userId: string
  ): Promise<CollaborativeDecisionState> {
    const cacheKeyStr = cacheKey('collab_state', decisionId, userId);
    const cached = oracleCacheService.get<CollaborativeDecisionState>(cacheKeyStr);
    if (cached) return cached;

    const [collaborators, votes, comments, aggregation, shares] = await Promise.all([
      this.getCollaborators(decisionId),
      this.getVotes(decisionId),
      this.getComments(decisionId),
      this.getAggregation(decisionId),
      this.getShareLinks(decisionId, userId),
    ]);

    const role = await this.getUserRole(decisionId, userId);
    const userVotes = votes.filter((v) => v.user_id === userId);

    const state: CollaborativeDecisionState = {
      decision_id: decisionId,
      collaborators,
      votes,
      comments,
      aggregation,
      shares,
      current_user_role: role || undefined,
      has_voted: userVotes.length > 0,
      can_edit: role ? ['owner', 'editor'].includes(role) : false,
      can_vote: role ? ['owner', 'editor', 'voter'].includes(role) : false,
      can_comment: role ? role !== 'viewer' : false,
    };

    oracleCacheService.set(cacheKeyStr, state, COLLAB_CACHE_TTL.state);
    return state;
  }

  // =====================================================
  // NOTIFICATIONS (Real-time in production)
  // =====================================================

  /**
   * Notify collaborators of an event
   */
  private async notifyCollaborators(params: NotifyParams): Promise<void> {
    const collaborators = await this.getCollaborators(params.decision_id);

    for (const collab of collaborators) {
      if (collab.user_id === params.actor_id) continue;
      if (collab.status !== 'accepted') continue;

      // Check notification preferences
      if (params.event_type === 'vote_cast' && !collab.notify_on_vote) continue;
      if (params.event_type === 'comment_added' && !collab.notify_on_comment) continue;
      if (params.event_type === 'decision_updated' && !collab.notify_on_update) continue;

      // Emit event (would be WebSocket/push notification in production)
      this.emitEvent(collab.user_id, {
        type: params.event_type,
        decision_id: params.decision_id,
        actor_id: params.actor_id,
        data: params.data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Subscribe to decision events
   */
  subscribe(userId: string, handler: (event: any) => void): () => void {
    if (!this.eventHandlers.has(userId)) {
      this.eventHandlers.set(userId, new Set());
    }
    this.eventHandlers.get(userId)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(userId)?.delete(handler);
    };
  }

  /**
   * Emit event to user
   */
  private emitEvent(userId: string, event: any): void {
    const handlers = this.eventHandlers.get(userId);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Invalidate caches for a decision
   */
  private invalidateDecisionCache(decisionId: string): void {
    // Delete all cached data for this decision
    oracleCacheService.delete(cacheKey('collab_collaborators', decisionId));
    oracleCacheService.delete(cacheKey('collab_votes', decisionId));
    oracleCacheService.delete(cacheKey('collab_aggregation', decisionId));
    oracleCacheService.delete(cacheKey('collab_comments', decisionId, 'all'));
    // State caches are user-specific, so we don't clear those here
  }

  /**
   * Initialize decision as collaborative (make user the owner)
   */
  async initializeCollaboration(
    decisionId: string,
    ownerId: string
  ): Promise<DecisionCollaborator> {
    // Check if already initialized
    const existing = this.collaborators.find(
      (c) => c.decision_id === decisionId && c.role === 'owner'
    );
    if (existing) {
      throw new Error('Decision already has an owner');
    }

    const owner: DecisionCollaborator = {
      id: crypto.randomUUID(),
      decision_id: decisionId,
      user_id: ownerId,
      role: 'owner',
      status: 'accepted',
      joined_at: new Date().toISOString(),
      notify_on_vote: true,
      notify_on_comment: true,
      notify_on_update: true,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.collaborators.push(owner);
    return owner;
  }
}

// Export singleton instance
export const collaborativeDecisionsService = new CollaborativeDecisionsService();
