/**
 * ORACLE Shared Signals Service
 *
 * Enables signal sharing between team members with granular
 * permissions, collaborative triage, and signal assignment.
 */

import { EventEmitter } from 'events';

// Types
export interface SharedSignal {
  id: string;
  signalId: string;
  signalTitle: string;
  signalType: string;
  signalPriority: 'critical' | 'high' | 'medium' | 'low';
  sharedBy: string;
  sharedAt: Date;
  shareType: 'individual' | 'team' | 'channel' | 'public';
  recipients: SharedRecipient[];
  permissions: SignalPermission;
  note?: string;
  expiresAt?: Date;
  metadata: ShareMetadata;
}

export interface SharedRecipient {
  type: 'user' | 'team' | 'channel';
  id: string;
  name: string;
  permission: PermissionLevel;
  sharedAt: Date;
  viewedAt?: Date;
  acknowledged?: boolean;
}

export type PermissionLevel = 'view' | 'comment' | 'edit' | 'full';

export interface SignalPermission {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canReassign: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export interface ShareMetadata {
  viewCount: number;
  commentCount: number;
  lastActivity?: Date;
  tags: string[];
  category?: string;
}

export interface ShareRequest {
  signalId: string;
  shareWith: {
    type: 'user' | 'team' | 'channel';
    id: string;
    permission: PermissionLevel;
  }[];
  note?: string;
  expiresIn?: number; // hours
  notifyRecipients?: boolean;
}

export interface SharedFeed {
  signals: SharedSignalWithContext[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: FeedFilters;
}

export interface SharedSignalWithContext extends SharedSignal {
  sharedByName: string;
  sharedByAvatar?: string;
  myPermission: PermissionLevel;
  unreadComments: number;
  latestComment?: Comment;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  triageStatus?: TriageStatus;
}

export interface FeedFilters {
  sharedBy?: string[];
  shareType?: ('individual' | 'team' | 'channel' | 'public')[];
  permission?: PermissionLevel[];
  priority?: ('critical' | 'high' | 'medium' | 'low')[];
  signalType?: string[];
  dateRange?: { start: Date; end: Date };
  hasUnread?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export type TriageStatus =
  | 'new'
  | 'under_review'
  | 'needs_action'
  | 'monitoring'
  | 'resolved'
  | 'dismissed';

export interface TriageAction {
  action: TriageStatus;
  signalId: string;
  notes?: string;
  assignTo?: string;
  followUpDate?: Date;
}

export interface CollaborativeTriage {
  signalId: string;
  participants: TriageParticipant[];
  currentStatus: TriageStatus;
  votes: TriageVote[];
  discussion: TriageComment[];
  consensus?: {
    status: TriageStatus;
    confidence: number;
    decidedAt: Date;
  };
}

export interface TriageParticipant {
  userId: string;
  userName: string;
  role: 'lead' | 'reviewer' | 'observer';
  joinedAt: Date;
  isActive: boolean;
}

export interface TriageVote {
  userId: string;
  userName: string;
  suggestedStatus: TriageStatus;
  confidence: number; // 1-5
  reasoning: string;
  votedAt: Date;
}

export interface TriageComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  replyTo?: string;
}

export interface SignalAssignment {
  id: string;
  signalId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Date;
  deadline?: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined';
  notes?: string;
  history: AssignmentHistoryEntry[];
}

export interface AssignmentHistoryEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
}

export interface BulkShareResult {
  successful: string[];
  failed: { signalId: string; error: string }[];
  totalProcessed: number;
}

// Service Implementation
class SharedSignalsService extends EventEmitter {
  private sharedSignals: Map<string, SharedSignal> = new Map();
  private triageSessions: Map<string, CollaborativeTriage> = new Map();
  private assignments: Map<string, SignalAssignment> = new Map();

  constructor() {
    super();
  }

  /**
   * Share a signal with team members or individuals
   */
  async shareSignal(
    userId: string,
    request: ShareRequest
  ): Promise<SharedSignal> {
    const sharedSignal: SharedSignal = {
      id: this.generateId(),
      signalId: request.signalId,
      signalTitle: `Signal ${request.signalId}`,
      signalType: 'market',
      signalPriority: 'medium',
      sharedBy: userId,
      sharedAt: new Date(),
      shareType: this.determineShareType(request.shareWith),
      recipients: request.shareWith.map(recipient => ({
        type: recipient.type,
        id: recipient.id,
        name: `Recipient ${recipient.id}`,
        permission: recipient.permission,
        sharedAt: new Date(),
      })),
      permissions: this.getPermissionsForLevel(
        Math.max(...request.shareWith.map(r => this.getPermissionOrder(r.permission)))
      ),
      note: request.note,
      expiresAt: request.expiresIn
        ? new Date(Date.now() + request.expiresIn * 60 * 60 * 1000)
        : undefined,
      metadata: {
        viewCount: 0,
        commentCount: 0,
        tags: [],
      },
    };

    this.sharedSignals.set(sharedSignal.id, sharedSignal);

    // Notify recipients
    if (request.notifyRecipients !== false) {
      for (const recipient of request.shareWith) {
        this.emit('notification:send', {
          userId: recipient.id,
          type: 'signal_shared',
          title: 'Signal Shared With You',
          message: `A signal has been shared with you`,
          data: { sharedSignalId: sharedSignal.id },
        });
      }
    }

    this.emit('signal:shared', {
      sharedSignal,
      sharedBy: userId,
      recipientCount: request.shareWith.length,
    });

    return sharedSignal;
  }

  /**
   * Update permissions for a shared signal
   */
  async updatePermissions(
    sharedSignalId: string,
    userId: string,
    recipientId: string,
    newPermission: PermissionLevel
  ): Promise<SharedSignal> {
    const sharedSignal = this.sharedSignals.get(sharedSignalId);
    if (!sharedSignal) {
      throw new Error('Shared signal not found');
    }

    if (sharedSignal.sharedBy !== userId) {
      throw new Error('Only the sharer can update permissions');
    }

    const recipient = sharedSignal.recipients.find(r => r.id === recipientId);
    if (!recipient) {
      throw new Error('Recipient not found');
    }

    recipient.permission = newPermission;

    this.emit('signal:permissions_updated', {
      sharedSignalId,
      recipientId,
      newPermission,
    });

    return sharedSignal;
  }

  /**
   * Get shared signals feed for a user
   */
  async getSharedFeed(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      filters?: FeedFilters;
      sortBy?: 'date' | 'priority' | 'activity';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<SharedFeed> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const filters = options.filters || {};

    // Get all signals shared with user
    let signals = Array.from(this.sharedSignals.values()).filter(signal => {
      // Check if user is a recipient
      const isRecipient = signal.recipients.some(r =>
        (r.type === 'user' && r.id === userId) ||
        r.type === 'team' ||
        r.type === 'channel'
      );

      // Check if user is the sharer
      const isSharer = signal.sharedBy === userId;

      return isRecipient || isSharer;
    });

    // Apply filters
    signals = this.applyFilters(signals, filters);

    // Sort signals
    signals = this.sortSignals(signals, options.sortBy || 'date', options.sortOrder || 'desc');

    // Paginate
    const totalItems = signals.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedSignals = signals.slice(startIndex, startIndex + pageSize);

    // Enrich with context
    const signalsWithContext: SharedSignalWithContext[] = paginatedSignals.map(signal => {
      const myRecipient = signal.recipients.find(r => r.id === userId);
      return {
        ...signal,
        sharedByName: `User ${signal.sharedBy}`,
        myPermission: myRecipient?.permission || 'view',
        unreadComments: 0,
      };
    });

    return {
      signals: signalsWithContext,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      filters,
    };
  }

  /**
   * Start collaborative signal triage
   */
  async startCollaborativeTriage(
    signalId: string,
    initiatorId: string,
    participants: string[]
  ): Promise<CollaborativeTriage> {
    const triage: CollaborativeTriage = {
      signalId,
      participants: [
        {
          userId: initiatorId,
          userName: `User ${initiatorId}`,
          role: 'lead',
          joinedAt: new Date(),
          isActive: true,
        },
        ...participants.map(id => ({
          userId: id,
          userName: `User ${id}`,
          role: 'reviewer' as const,
          joinedAt: new Date(),
          isActive: true,
        })),
      ],
      currentStatus: 'new',
      votes: [],
      discussion: [],
    };

    this.triageSessions.set(signalId, triage);

    // Notify participants
    for (const participantId of participants) {
      this.emit('notification:send', {
        userId: participantId,
        type: 'triage_started',
        title: 'Collaborative Triage Started',
        message: 'You have been invited to triage a signal',
        data: { signalId },
      });
    }

    this.emit('triage:started', {
      signalId,
      initiator: initiatorId,
      participantCount: participants.length + 1,
    });

    return triage;
  }

  /**
   * Submit a triage vote
   */
  async submitTriageVote(
    signalId: string,
    userId: string,
    vote: {
      suggestedStatus: TriageStatus;
      confidence: number;
      reasoning: string;
    }
  ): Promise<CollaborativeTriage> {
    const triage = this.triageSessions.get(signalId);
    if (!triage) {
      throw new Error('Triage session not found');
    }

    const isParticipant = triage.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new Error('User is not a participant in this triage');
    }

    // Remove previous vote if exists
    triage.votes = triage.votes.filter(v => v.userId !== userId);

    // Add new vote
    triage.votes.push({
      userId,
      userName: `User ${userId}`,
      suggestedStatus: vote.suggestedStatus,
      confidence: vote.confidence,
      reasoning: vote.reasoning,
      votedAt: new Date(),
    });

    // Check for consensus
    this.checkForConsensus(triage);

    this.emit('triage:vote_submitted', {
      signalId,
      userId,
      vote,
    });

    return triage;
  }

  /**
   * Add a comment to triage discussion
   */
  async addTriageComment(
    signalId: string,
    userId: string,
    content: string,
    replyTo?: string
  ): Promise<TriageComment> {
    const triage = this.triageSessions.get(signalId);
    if (!triage) {
      throw new Error('Triage session not found');
    }

    const comment: TriageComment = {
      id: this.generateId(),
      userId,
      userName: `User ${userId}`,
      content,
      createdAt: new Date(),
      replyTo,
    };

    triage.discussion.push(comment);

    this.emit('triage:comment_added', {
      signalId,
      comment,
    });

    return comment;
  }

  /**
   * Complete triage with final decision
   */
  async completeTriageWithDecision(
    signalId: string,
    leadId: string,
    finalStatus: TriageStatus,
    notes?: string
  ): Promise<CollaborativeTriage> {
    const triage = this.triageSessions.get(signalId);
    if (!triage) {
      throw new Error('Triage session not found');
    }

    const lead = triage.participants.find(p => p.userId === leadId && p.role === 'lead');
    if (!lead) {
      throw new Error('Only the triage lead can complete the session');
    }

    triage.currentStatus = finalStatus;
    triage.consensus = {
      status: finalStatus,
      confidence: this.calculateConsensusConfidence(triage.votes, finalStatus),
      decidedAt: new Date(),
    };

    this.emit('triage:completed', {
      signalId,
      finalStatus,
      consensus: triage.consensus,
    });

    return triage;
  }

  /**
   * Assign a signal to a team member
   */
  async assignSignal(
    signalId: string,
    assignerId: string,
    assigneeId: string,
    options: {
      deadline?: Date;
      priority?: 'critical' | 'high' | 'medium' | 'low';
      notes?: string;
    } = {}
  ): Promise<SignalAssignment> {
    const assignment: SignalAssignment = {
      id: this.generateId(),
      signalId,
      assignedTo: assigneeId,
      assignedBy: assignerId,
      assignedAt: new Date(),
      deadline: options.deadline,
      priority: options.priority || 'medium',
      status: 'pending',
      notes: options.notes,
      history: [
        {
          action: 'assigned',
          performedBy: assignerId,
          performedAt: new Date(),
          notes: options.notes,
        },
      ],
    };

    this.assignments.set(assignment.id, assignment);

    // Notify assignee
    this.emit('notification:send', {
      userId: assigneeId,
      type: 'signal_assigned',
      title: 'Signal Assigned to You',
      message: `A signal has been assigned to you`,
      data: { assignmentId: assignment.id, signalId },
    });

    this.emit('signal:assigned', {
      assignment,
      assigner: assignerId,
      assignee: assigneeId,
    });

    return assignment;
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(
    assignmentId: string,
    userId: string,
    status: 'accepted' | 'in_progress' | 'completed' | 'declined',
    notes?: string
  ): Promise<SignalAssignment> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    if (assignment.assignedTo !== userId) {
      throw new Error('Only the assignee can update status');
    }

    assignment.status = status;
    assignment.history.push({
      action: status,
      performedBy: userId,
      performedAt: new Date(),
      notes,
    });

    this.emit('assignment:status_updated', {
      assignmentId,
      status,
      userId,
    });

    return assignment;
  }

  /**
   * Get user's assignments
   */
  async getUserAssignments(
    userId: string,
    options: {
      status?: ('pending' | 'accepted' | 'in_progress' | 'completed' | 'declined')[];
      assignedBy?: string;
    } = {}
  ): Promise<SignalAssignment[]> {
    return Array.from(this.assignments.values()).filter(assignment => {
      const matchesUser = assignment.assignedTo === userId;
      const matchesStatus = !options.status || options.status.includes(assignment.status);
      const matchesAssigner = !options.assignedBy || assignment.assignedBy === options.assignedBy;
      return matchesUser && matchesStatus && matchesAssigner;
    });
  }

  /**
   * Bulk share signals
   */
  async bulkShareSignals(
    userId: string,
    signalIds: string[],
    shareWith: ShareRequest['shareWith'],
    note?: string
  ): Promise<BulkShareResult> {
    const successful: string[] = [];
    const failed: { signalId: string; error: string }[] = [];

    for (const signalId of signalIds) {
      try {
        await this.shareSignal(userId, {
          signalId,
          shareWith,
          note,
        });
        successful.push(signalId);
      } catch (error) {
        failed.push({
          signalId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      successful,
      failed,
      totalProcessed: signalIds.length,
    };
  }

  /**
   * Record signal view
   */
  async recordView(sharedSignalId: string, userId: string): Promise<void> {
    const sharedSignal = this.sharedSignals.get(sharedSignalId);
    if (!sharedSignal) {
      return;
    }

    sharedSignal.metadata.viewCount++;
    sharedSignal.metadata.lastActivity = new Date();

    const recipient = sharedSignal.recipients.find(r => r.id === userId);
    if (recipient && !recipient.viewedAt) {
      recipient.viewedAt = new Date();
    }

    this.emit('signal:viewed', {
      sharedSignalId,
      viewedBy: userId,
    });
  }

  /**
   * Revoke access to shared signal
   */
  async revokeAccess(
    sharedSignalId: string,
    ownerId: string,
    recipientId: string
  ): Promise<SharedSignal> {
    const sharedSignal = this.sharedSignals.get(sharedSignalId);
    if (!sharedSignal) {
      throw new Error('Shared signal not found');
    }

    if (sharedSignal.sharedBy !== ownerId) {
      throw new Error('Only the sharer can revoke access');
    }

    sharedSignal.recipients = sharedSignal.recipients.filter(r => r.id !== recipientId);

    this.emit('signal:access_revoked', {
      sharedSignalId,
      recipientId,
      revokedBy: ownerId,
    });

    return sharedSignal;
  }

  /**
   * Get triage session
   */
  async getTriageSession(signalId: string): Promise<CollaborativeTriage | null> {
    return this.triageSessions.get(signalId) || null;
  }

  // Helper methods
  private generateId(): string {
    return `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineShareType(
    recipients: ShareRequest['shareWith']
  ): 'individual' | 'team' | 'channel' | 'public' {
    if (recipients.length === 1 && recipients[0].type === 'user') {
      return 'individual';
    }
    if (recipients.some(r => r.type === 'channel')) {
      return 'channel';
    }
    if (recipients.some(r => r.type === 'team')) {
      return 'team';
    }
    return 'individual';
  }

  private getPermissionOrder(level: PermissionLevel): number {
    const order: Record<PermissionLevel, number> = {
      view: 1,
      comment: 2,
      edit: 3,
      full: 4,
    };
    return order[level];
  }

  private getPermissionsForLevel(order: number): SignalPermission {
    return {
      canView: order >= 1,
      canComment: order >= 2,
      canEdit: order >= 3,
      canReassign: order >= 4,
      canDelete: order >= 4,
      canShare: order >= 3,
    };
  }

  private applyFilters(
    signals: SharedSignal[],
    filters: FeedFilters
  ): SharedSignal[] {
    return signals.filter(signal => {
      if (filters.sharedBy && !filters.sharedBy.includes(signal.sharedBy)) {
        return false;
      }
      if (filters.shareType && !filters.shareType.includes(signal.shareType)) {
        return false;
      }
      if (filters.priority && !filters.priority.includes(signal.signalPriority)) {
        return false;
      }
      if (filters.signalType && !filters.signalType.includes(signal.signalType)) {
        return false;
      }
      if (filters.dateRange) {
        if (signal.sharedAt < filters.dateRange.start ||
            signal.sharedAt > filters.dateRange.end) {
          return false;
        }
      }
      return true;
    });
  }

  private sortSignals(
    signals: SharedSignal[],
    sortBy: 'date' | 'priority' | 'activity',
    sortOrder: 'asc' | 'desc'
  ): SharedSignal[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    return [...signals].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = a.sharedAt.getTime() - b.sharedAt.getTime();
          break;
        case 'priority':
          comparison = priorityOrder[a.signalPriority] - priorityOrder[b.signalPriority];
          break;
        case 'activity':
          const aActivity = a.metadata.lastActivity?.getTime() || 0;
          const bActivity = b.metadata.lastActivity?.getTime() || 0;
          comparison = aActivity - bActivity;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private checkForConsensus(triage: CollaborativeTriage): void {
    if (triage.votes.length < Math.ceil(triage.participants.length / 2)) {
      return; // Need at least half of participants to vote
    }

    const statusCounts = new Map<TriageStatus, number>();
    for (const vote of triage.votes) {
      const count = statusCounts.get(vote.suggestedStatus) || 0;
      statusCounts.set(vote.suggestedStatus, count + 1);
    }

    // Check for majority consensus
    const threshold = Math.ceil(triage.votes.length * 0.6);
    for (const [status, count] of statusCounts) {
      if (count >= threshold) {
        triage.consensus = {
          status,
          confidence: (count / triage.votes.length) * 100,
          decidedAt: new Date(),
        };
        triage.currentStatus = status;
        break;
      }
    }
  }

  private calculateConsensusConfidence(
    votes: TriageVote[],
    finalStatus: TriageStatus
  ): number {
    if (votes.length === 0) return 0;
    const matchingVotes = votes.filter(v => v.suggestedStatus === finalStatus);
    return (matchingVotes.length / votes.length) * 100;
  }
}

export const sharedSignalsService = new SharedSignalsService();
export default sharedSignalsService;
