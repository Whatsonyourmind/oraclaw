/**
 * ORACLE Comment System Service
 *
 * Provides a comprehensive commenting system for signals, tasks,
 * decisions, and other entities with threading, mentions, and reactions.
 */

import { EventEmitter } from 'events';

// Types
export interface Comment {
  id: string;
  entityType: EntityType;
  entityId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  parentId?: string;
  threadId?: string;
  mentions: Mention[];
  attachments: CommentAttachment[];
  reactions: Reaction[];
  status: CommentStatus;
  editHistory: EditEntry[];
  metadata: CommentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type EntityType =
  | 'signal'
  | 'task'
  | 'decision'
  | 'goal'
  | 'announcement'
  | 'delegation'
  | 'document';

export interface Mention {
  id: string;
  type: 'user' | 'team' | 'channel';
  name: string;
  startIndex: number;
  endIndex: number;
  notified: boolean;
}

export interface CommentAttachment {
  id: string;
  type: 'image' | 'file' | 'link' | 'code';
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  preview?: string;
}

export interface Reaction {
  emoji: string;
  users: ReactionUser[];
  count: number;
}

export interface ReactionUser {
  userId: string;
  userName: string;
  reactedAt: Date;
}

export type CommentStatus = 'active' | 'edited' | 'deleted' | 'resolved' | 'hidden';

export interface EditEntry {
  editedAt: Date;
  editedBy: string;
  previousContent: string;
  reason?: string;
}

export interface CommentMetadata {
  isResolution: boolean;
  isPinned: boolean;
  isHighlighted: boolean;
  readBy: string[];
  viewCount: number;
}

export interface CommentThread {
  id: string;
  entityType: EntityType;
  entityId: string;
  rootComment: Comment;
  replies: Comment[];
  replyCount: number;
  participants: ThreadParticipant[];
  status: 'open' | 'resolved' | 'locked';
  resolvedBy?: string;
  resolvedAt?: Date;
  lastActivityAt: Date;
}

export interface ThreadParticipant {
  userId: string;
  userName: string;
  role: 'author' | 'participant' | 'mentioned';
  commentCount: number;
  lastCommentAt: Date;
}

export interface CreateCommentRequest {
  entityType: EntityType;
  entityId: string;
  content: string;
  parentId?: string;
  attachments?: Omit<CommentAttachment, 'id'>[];
  mentionUserIds?: string[];
}

export interface UpdateCommentRequest {
  content: string;
  reason?: string;
}

export interface CommentFilter {
  entityType?: EntityType;
  entityId?: string;
  authorId?: string;
  status?: CommentStatus[];
  hasReactions?: boolean;
  hasMentions?: boolean;
  dateRange?: { start: Date; end: Date };
  searchQuery?: string;
}

export interface CommentFeed {
  comments: Comment[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface MentionSuggestion {
  type: 'user' | 'team' | 'channel';
  id: string;
  name: string;
  avatar?: string;
  relevanceScore: number;
}

export interface ActivityFeedEntry {
  id: string;
  type: ActivityType;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;
  target: {
    type: EntityType;
    id: string;
    name: string;
  };
  comment?: Comment;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | 'comment_added'
  | 'comment_edited'
  | 'comment_deleted'
  | 'comment_resolved'
  | 'reaction_added'
  | 'mention_received'
  | 'thread_replied'
  | 'thread_resolved';

export interface CommentStats {
  entityType: EntityType;
  entityId: string;
  totalComments: number;
  activeThreads: number;
  resolvedThreads: number;
  uniqueParticipants: number;
  totalReactions: number;
  mostUsedReaction: string;
  averageResponseTime: number;
  lastActivityAt: Date;
}

// Service Implementation
class CommentSystemService extends EventEmitter {
  private comments: Map<string, Comment> = new Map();
  private threads: Map<string, CommentThread> = new Map();
  private activityLog: ActivityFeedEntry[] = [];

  constructor() {
    super();
  }

  /**
   * Create a new comment
   */
  async createComment(
    userId: string,
    request: CreateCommentRequest
  ): Promise<Comment> {
    const mentions = this.parseMentions(request.content, request.mentionUserIds);

    const comment: Comment = {
      id: this.generateId(),
      entityType: request.entityType,
      entityId: request.entityId,
      content: request.content,
      authorId: userId,
      authorName: `User ${userId}`,
      parentId: request.parentId,
      threadId: request.parentId ? this.getThreadId(request.parentId) : undefined,
      mentions,
      attachments: (request.attachments || []).map(a => ({
        ...a,
        id: this.generateId(),
      })),
      reactions: [],
      status: 'active',
      editHistory: [],
      metadata: {
        isResolution: false,
        isPinned: false,
        isHighlighted: false,
        readBy: [userId],
        viewCount: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.comments.set(comment.id, comment);

    // Update or create thread
    if (request.parentId) {
      await this.addToThread(comment);
    } else {
      await this.createThread(comment);
    }

    // Notify mentioned users
    for (const mention of mentions) {
      if (!mention.notified) {
        this.emit('notification:send', {
          userId: mention.id,
          type: 'mention',
          title: 'You were mentioned',
          message: `${comment.authorName} mentioned you in a comment`,
          data: { commentId: comment.id, entityType: request.entityType, entityId: request.entityId },
        });
        mention.notified = true;
      }
    }

    // Record activity
    this.recordActivity({
      type: request.parentId ? 'thread_replied' : 'comment_added',
      actor: { id: userId, name: comment.authorName },
      action: request.parentId ? 'replied to a thread' : 'added a comment',
      target: { type: request.entityType, id: request.entityId, name: `${request.entityType} ${request.entityId}` },
      comment,
    });

    this.emit('comment:created', { comment });

    return comment;
  }

  /**
   * Edit a comment
   */
  async editComment(
    commentId: string,
    userId: string,
    update: UpdateCommentRequest
  ): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new Error('Only the author can edit this comment');
    }

    if (comment.status === 'deleted') {
      throw new Error('Cannot edit a deleted comment');
    }

    // Store edit history
    comment.editHistory.push({
      editedAt: new Date(),
      editedBy: userId,
      previousContent: comment.content,
      reason: update.reason,
    });

    // Update content
    comment.content = update.content;
    comment.mentions = this.parseMentions(update.content);
    comment.status = 'edited';
    comment.updatedAt = new Date();

    // Record activity
    this.recordActivity({
      type: 'comment_edited',
      actor: { id: userId, name: comment.authorName },
      action: 'edited a comment',
      target: { type: comment.entityType, id: comment.entityId, name: `${comment.entityType} ${comment.entityId}` },
      comment,
    });

    this.emit('comment:edited', { comment, previousContent: comment.editHistory[comment.editHistory.length - 1].previousContent });

    return comment;
  }

  /**
   * Delete a comment
   */
  async deleteComment(
    commentId: string,
    userId: string,
    reason?: string
  ): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.authorId !== userId) {
      // Check if user is admin or entity owner
      throw new Error('Not authorized to delete this comment');
    }

    comment.status = 'deleted';
    comment.content = '[Comment deleted]';
    comment.updatedAt = new Date();

    // Record activity
    this.recordActivity({
      type: 'comment_deleted',
      actor: { id: userId, name: comment.authorName },
      action: 'deleted a comment',
      target: { type: comment.entityType, id: comment.entityId, name: `${comment.entityType} ${comment.entityId}` },
    });

    this.emit('comment:deleted', { commentId, deletedBy: userId, reason });

    return comment;
  }

  /**
   * Add reaction to comment
   */
  async addReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    let reaction = comment.reactions.find(r => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, users: [], count: 0 };
      comment.reactions.push(reaction);
    }

    // Check if user already reacted with this emoji
    const existingReaction = reaction.users.find(u => u.userId === userId);
    if (!existingReaction) {
      reaction.users.push({
        userId,
        userName: `User ${userId}`,
        reactedAt: new Date(),
      });
      reaction.count++;

      // Notify comment author
      if (comment.authorId !== userId) {
        this.emit('notification:send', {
          userId: comment.authorId,
          type: 'reaction',
          title: 'New reaction',
          message: `Someone reacted ${emoji} to your comment`,
          data: { commentId },
        });
      }

      // Record activity
      this.recordActivity({
        type: 'reaction_added',
        actor: { id: userId, name: `User ${userId}` },
        action: `reacted ${emoji}`,
        target: { type: comment.entityType, id: comment.entityId, name: `${comment.entityType} ${comment.entityId}` },
        comment,
      });
    }

    comment.updatedAt = new Date();

    this.emit('comment:reaction_added', { commentId, emoji, userId });

    return comment;
  }

  /**
   * Remove reaction from comment
   */
  async removeReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    const reaction = comment.reactions.find(r => r.emoji === emoji);
    if (reaction) {
      reaction.users = reaction.users.filter(u => u.userId !== userId);
      reaction.count = reaction.users.length;

      if (reaction.count === 0) {
        comment.reactions = comment.reactions.filter(r => r.emoji !== emoji);
      }
    }

    comment.updatedAt = new Date();

    this.emit('comment:reaction_removed', { commentId, emoji, userId });

    return comment;
  }

  /**
   * Get threaded replies
   */
  async getThreadReplies(
    threadId: string,
    options: {
      page?: number;
      pageSize?: number;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<CommentFeed> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const sortOrder = options.sortOrder || 'asc';

    let replies = [...thread.replies];

    if (sortOrder === 'desc') {
      replies.reverse();
    }

    const totalItems = replies.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedReplies = replies.slice(startIndex, startIndex + pageSize);

    return {
      comments: paginatedReplies,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Resolve a comment thread
   */
  async resolveThread(
    threadId: string,
    userId: string,
    resolutionComment?: string
  ): Promise<CommentThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    thread.status = 'resolved';
    thread.resolvedBy = userId;
    thread.resolvedAt = new Date();
    thread.lastActivityAt = new Date();

    // Mark root comment as resolution if a resolution comment is provided
    if (resolutionComment) {
      const comment = await this.createComment(userId, {
        entityType: thread.entityType,
        entityId: thread.entityId,
        content: resolutionComment,
        parentId: thread.rootComment.id,
      });
      comment.metadata.isResolution = true;
    }

    // Record activity
    this.recordActivity({
      type: 'thread_resolved',
      actor: { id: userId, name: `User ${userId}` },
      action: 'resolved a thread',
      target: { type: thread.entityType, id: thread.entityId, name: `${thread.entityType} ${thread.entityId}` },
    });

    this.emit('thread:resolved', { threadId, resolvedBy: userId });

    return thread;
  }

  /**
   * Get mention suggestions
   */
  async getMentionSuggestions(
    query: string,
    context: {
      entityType: EntityType;
      entityId: string;
      userId: string;
    }
  ): Promise<MentionSuggestion[]> {
    // In a real implementation, this would query users, teams, and channels
    // that match the query and are relevant to the context
    const suggestions: MentionSuggestion[] = [
      { type: 'user', id: 'user1', name: 'Alice Johnson', relevanceScore: 95 },
      { type: 'user', id: 'user2', name: 'Bob Smith', relevanceScore: 85 },
      { type: 'team', id: 'team1', name: 'Engineering', relevanceScore: 75 },
      { type: 'channel', id: 'channel1', name: 'general', relevanceScore: 60 },
    ];

    return suggestions
      .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
  }

  /**
   * Get comments for an entity
   */
  async getEntityComments(
    entityType: EntityType,
    entityId: string,
    options: {
      page?: number;
      pageSize?: number;
      includeReplies?: boolean;
      status?: CommentStatus[];
    } = {}
  ): Promise<CommentFeed> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    let comments = Array.from(this.comments.values()).filter(c =>
      c.entityType === entityType &&
      c.entityId === entityId &&
      (!options.status || options.status.includes(c.status))
    );

    if (!options.includeReplies) {
      comments = comments.filter(c => !c.parentId);
    }

    // Sort by creation date (newest first)
    comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const totalItems = comments.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedComments = comments.slice(startIndex, startIndex + pageSize);

    return {
      comments: paginatedComments,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Get activity feed for a user
   */
  async getUserActivityFeed(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      types?: ActivityType[];
      dateRange?: { start: Date; end: Date };
    } = {}
  ): Promise<{ entries: ActivityFeedEntry[]; hasMore: boolean }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    let entries = this.activityLog.filter(entry => {
      // Include if user is actor, mentioned, or owns the entity
      const isRelevant = entry.actor.id === userId ||
        (entry.comment?.mentions.some(m => m.id === userId));

      if (!isRelevant) return false;

      if (options.types && !options.types.includes(entry.type)) {
        return false;
      }

      if (options.dateRange) {
        if (entry.timestamp < options.dateRange.start ||
            entry.timestamp > options.dateRange.end) {
          return false;
        }
      }

      return true;
    });

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = entries.slice(startIndex, startIndex + pageSize);

    return {
      entries: paginatedEntries,
      hasMore: startIndex + pageSize < entries.length,
    };
  }

  /**
   * Get comment statistics for an entity
   */
  async getCommentStats(
    entityType: EntityType,
    entityId: string
  ): Promise<CommentStats> {
    const comments = Array.from(this.comments.values()).filter(
      c => c.entityType === entityType && c.entityId === entityId
    );

    const threads = Array.from(this.threads.values()).filter(
      t => t.entityType === entityType && t.entityId === entityId
    );

    const allReactions = comments.flatMap(c => c.reactions);
    const reactionCounts = new Map<string, number>();
    allReactions.forEach(r => {
      const current = reactionCounts.get(r.emoji) || 0;
      reactionCounts.set(r.emoji, current + r.count);
    });

    let mostUsedReaction = '';
    let maxCount = 0;
    reactionCounts.forEach((count, emoji) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedReaction = emoji;
      }
    });

    const participants = new Set<string>();
    comments.forEach(c => participants.add(c.authorId));

    const lastComment = comments.length > 0
      ? comments.reduce((latest, c) =>
          c.createdAt > latest.createdAt ? c : latest
        )
      : null;

    return {
      entityType,
      entityId,
      totalComments: comments.length,
      activeThreads: threads.filter(t => t.status === 'open').length,
      resolvedThreads: threads.filter(t => t.status === 'resolved').length,
      uniqueParticipants: participants.size,
      totalReactions: allReactions.reduce((sum, r) => sum + r.count, 0),
      mostUsedReaction,
      averageResponseTime: 0, // Would calculate from thread response times
      lastActivityAt: lastComment?.createdAt || new Date(),
    };
  }

  /**
   * Mark comment as read
   */
  async markAsRead(commentId: string, userId: string): Promise<void> {
    const comment = this.comments.get(commentId);
    if (comment && !comment.metadata.readBy.includes(userId)) {
      comment.metadata.readBy.push(userId);
      comment.metadata.viewCount++;
    }
  }

  /**
   * Pin a comment
   */
  async pinComment(
    commentId: string,
    userId: string
  ): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    comment.metadata.isPinned = true;
    comment.updatedAt = new Date();

    this.emit('comment:pinned', { commentId, pinnedBy: userId });

    return comment;
  }

  /**
   * Unpin a comment
   */
  async unpinComment(
    commentId: string,
    userId: string
  ): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    comment.metadata.isPinned = false;
    comment.updatedAt = new Date();

    this.emit('comment:unpinned', { commentId, unpinnedBy: userId });

    return comment;
  }

  // Helper methods
  private generateId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseMentions(content: string, mentionUserIds?: string[]): Mention[] {
    const mentions: Mention[] = [];
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const name = match[1];
      const id = mentionUserIds?.find(uid => uid.toLowerCase() === name.toLowerCase()) || name;

      mentions.push({
        id,
        type: 'user',
        name,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        notified: false,
      });
    }

    return mentions;
  }

  private getThreadId(parentId: string): string | undefined {
    const parentComment = this.comments.get(parentId);
    return parentComment?.threadId || parentId;
  }

  private async createThread(rootComment: Comment): Promise<CommentThread> {
    const thread: CommentThread = {
      id: rootComment.id,
      entityType: rootComment.entityType,
      entityId: rootComment.entityId,
      rootComment,
      replies: [],
      replyCount: 0,
      participants: [{
        userId: rootComment.authorId,
        userName: rootComment.authorName,
        role: 'author',
        commentCount: 1,
        lastCommentAt: rootComment.createdAt,
      }],
      status: 'open',
      lastActivityAt: rootComment.createdAt,
    };

    rootComment.threadId = thread.id;
    this.threads.set(thread.id, thread);

    return thread;
  }

  private async addToThread(reply: Comment): Promise<void> {
    const threadId = reply.threadId || reply.parentId;
    if (!threadId) return;

    const thread = this.threads.get(threadId);
    if (!thread) return;

    thread.replies.push(reply);
    thread.replyCount++;
    thread.lastActivityAt = reply.createdAt;

    // Update or add participant
    const existingParticipant = thread.participants.find(p => p.userId === reply.authorId);
    if (existingParticipant) {
      existingParticipant.commentCount++;
      existingParticipant.lastCommentAt = reply.createdAt;
    } else {
      thread.participants.push({
        userId: reply.authorId,
        userName: reply.authorName,
        role: reply.mentions.some(m => m.id === reply.authorId) ? 'mentioned' : 'participant',
        commentCount: 1,
        lastCommentAt: reply.createdAt,
      });
    }
  }

  private recordActivity(entry: Omit<ActivityFeedEntry, 'id' | 'timestamp'>): void {
    this.activityLog.push({
      id: this.generateId(),
      ...entry,
      timestamp: new Date(),
    });

    // Keep only last 10000 entries
    if (this.activityLog.length > 10000) {
      this.activityLog = this.activityLog.slice(-10000);
    }
  }
}

export const commentSystemService = new CommentSystemService();
export default commentSystemService;
