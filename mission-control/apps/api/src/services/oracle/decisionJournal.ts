/**
 * ORACLE Decision Journal Service
 * Story adv-17 - Track and review past decisions with reflections
 */

import type {
  DecisionJournalEntry,
  JournalAttachment,
  JournalFollowup,
  JournalSearchFilters,
  JournalStats,
  JournalExport,
  JournalOutcomeStatus,
  JournalCategory,
  JournalImportance,
  JournalTimePressure,
  JournalFollowupType,
} from '@mission-control/shared-types';
import { oracleCacheService, cacheKey, hashObject } from './cache';

// Cache TTLs
const JOURNAL_CACHE_TTL = {
  entry: 5 * 60 * 1000, // 5 minutes
  list: 2 * 60 * 1000, // 2 minutes
  stats: 10 * 60 * 1000, // 10 minutes
  search: 1 * 60 * 1000, // 1 minute
};

// Types for service operations
interface CreateJournalEntryParams {
  user_id: string;
  decision_id?: string;
  title: string;
  situation: string;
  options_considered?: string[];
  chosen_option?: string;
  reasoning?: string;
  category?: JournalCategory;
  importance?: JournalImportance;
  tags?: string[];
  time_pressure?: JournalTimePressure;
  deliberation_time_hours?: number;
  emotional_state_before?: string;
  stress_level?: number;
  confidence_in_decision?: number;
  stakeholders_involved?: string[];
  stakeholders_affected?: string[];
  is_private?: boolean;
  metadata?: Record<string, any>;
}

interface UpdateJournalEntryParams {
  title?: string;
  situation?: string;
  options_considered?: string[];
  chosen_option?: string;
  reasoning?: string;
  outcome_status?: JournalOutcomeStatus;
  outcome_description?: string;
  outcome_date?: string;
  reflection?: string;
  lessons_learned?: string[];
  would_decide_differently?: boolean;
  alternative_considered?: string;
  tags?: string[];
  category?: JournalCategory;
  importance?: JournalImportance;
  emotional_state_after?: string;
  is_private?: boolean;
  is_favorite?: boolean;
  metadata?: Record<string, any>;
}

interface JournalListParams {
  user_id: string;
  limit?: number;
  offset?: number;
  sort_by?: 'decision_date' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

interface CreateFollowupParams {
  journal_id: string;
  user_id: string;
  followup_type: JournalFollowupType;
  scheduled_date: string;
  notes?: string;
}

export class DecisionJournalService {
  // In-memory stores for demo (would use Supabase in production)
  private entries: DecisionJournalEntry[] = [];
  private attachments: JournalAttachment[] = [];
  private followups: JournalFollowup[] = [];

  // =====================================================
  // JOURNAL ENTRY CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new journal entry
   */
  async createEntry(params: CreateJournalEntryParams): Promise<DecisionJournalEntry> {
    const now = new Date().toISOString();

    const entry: DecisionJournalEntry = {
      id: crypto.randomUUID(),
      user_id: params.user_id,
      decision_id: params.decision_id,
      title: params.title,
      situation: params.situation,
      options_considered: params.options_considered,
      chosen_option: params.chosen_option,
      reasoning: params.reasoning,
      outcome_status: 'pending',
      tags: params.tags || [],
      category: params.category || 'other',
      importance: params.importance || 'moderate',
      time_pressure: params.time_pressure,
      deliberation_time_hours: params.deliberation_time_hours,
      emotional_state_before: params.emotional_state_before,
      stress_level: params.stress_level,
      confidence_in_decision: params.confidence_in_decision,
      stakeholders_involved: params.stakeholders_involved,
      stakeholders_affected: params.stakeholders_affected,
      decision_date: now,
      is_private: params.is_private ?? true,
      is_favorite: false,
      metadata: params.metadata || {},
      created_at: now,
      updated_at: now,
    };

    // In production: await supabase.from('oracle_decision_journal').insert(entry);
    this.entries.push(entry);

    // Invalidate caches
    this.invalidateUserCache(params.user_id);

    // Auto-create a followup reminder to review outcome
    await this.createFollowup({
      journal_id: entry.id,
      user_id: params.user_id,
      followup_type: 'review_outcome',
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week later
      notes: 'Check in on the outcome of this decision',
    });

    return entry;
  }

  /**
   * Get a journal entry by ID
   */
  async getEntry(entryId: string, userId: string): Promise<DecisionJournalEntry | null> {
    const cacheKeyStr = cacheKey('journal_entry', entryId);

    const cached = oracleCacheService.get<DecisionJournalEntry>(cacheKeyStr);
    if (cached && cached.user_id === userId) {
      return cached;
    }

    // In production: await supabase.from('oracle_decision_journal').select('*').eq('id', entryId).eq('user_id', userId).single();
    const entry = this.entries.find(e => e.id === entryId && e.user_id === userId);

    if (entry) {
      oracleCacheService.set(cacheKeyStr, entry, JOURNAL_CACHE_TTL.entry);
    }

    return entry || null;
  }

  /**
   * Update a journal entry
   */
  async updateEntry(
    entryId: string,
    userId: string,
    updates: UpdateJournalEntryParams
  ): Promise<DecisionJournalEntry | null> {
    const entryIndex = this.entries.findIndex(e => e.id === entryId && e.user_id === userId);
    if (entryIndex === -1) return null;

    const entry = this.entries[entryIndex];
    const updatedEntry: DecisionJournalEntry = {
      ...entry,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_decision_journal').update(updates).eq('id', entryId).eq('user_id', userId);
    this.entries[entryIndex] = updatedEntry;

    // Invalidate caches
    oracleCacheService.delete(cacheKey('journal_entry', entryId));
    this.invalidateUserCache(userId);

    return updatedEntry;
  }

  /**
   * Delete a journal entry
   */
  async deleteEntry(entryId: string, userId: string): Promise<boolean> {
    const entryIndex = this.entries.findIndex(e => e.id === entryId && e.user_id === userId);
    if (entryIndex === -1) return false;

    // In production: await supabase.from('oracle_decision_journal').delete().eq('id', entryId).eq('user_id', userId);
    this.entries.splice(entryIndex, 1);

    // Also delete related attachments and followups
    this.attachments = this.attachments.filter(a => a.journal_id !== entryId);
    this.followups = this.followups.filter(f => f.journal_id !== entryId);

    // Invalidate caches
    oracleCacheService.delete(cacheKey('journal_entry', entryId));
    this.invalidateUserCache(userId);

    return true;
  }

  /**
   * List journal entries for a user
   */
  async listEntries(params: JournalListParams): Promise<DecisionJournalEntry[]> {
    const {
      user_id,
      limit = 50,
      offset = 0,
      sort_by = 'decision_date',
      sort_order = 'desc',
    } = params;

    // In production: await supabase.from('oracle_decision_journal')
    //   .select('*').eq('user_id', user_id).order(sort_by, { ascending: sort_order === 'asc' })
    //   .range(offset, offset + limit - 1);
    let entries = this.entries.filter(e => e.user_id === user_id);

    // Sort
    entries.sort((a, b) => {
      const aVal = a[sort_by] || '';
      const bVal = b[sort_by] || '';
      const comparison = aVal.localeCompare(bVal);
      return sort_order === 'desc' ? -comparison : comparison;
    });

    // Paginate
    return entries.slice(offset, offset + limit);
  }

  // =====================================================
  // SEARCH AND FILTER
  // =====================================================

  /**
   * Search journal entries with advanced filters
   */
  async searchEntries(
    userId: string,
    filters: JournalSearchFilters
  ): Promise<DecisionJournalEntry[]> {
    const cacheKeyStr = cacheKey('journal_search', userId, hashObject(filters));

    const cached = oracleCacheService.get<DecisionJournalEntry[]>(cacheKeyStr);
    if (cached) return cached;

    let entries = this.entries.filter(e => e.user_id === userId);

    // Apply filters
    if (filters.query) {
      const query = filters.query.toLowerCase();
      entries = entries.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.situation.toLowerCase().includes(query) ||
        e.reasoning?.toLowerCase().includes(query) ||
        e.reflection?.toLowerCase().includes(query) ||
        e.outcome_description?.toLowerCase().includes(query)
      );
    }

    if (filters.categories?.length) {
      entries = entries.filter(e => filters.categories!.includes(e.category));
    }

    if (filters.tags?.length) {
      entries = entries.filter(e =>
        filters.tags!.some(tag => e.tags.includes(tag))
      );
    }

    if (filters.outcome_status?.length) {
      entries = entries.filter(e => filters.outcome_status!.includes(e.outcome_status));
    }

    if (filters.importance?.length) {
      entries = entries.filter(e => filters.importance!.includes(e.importance));
    }

    if (filters.date_from) {
      entries = entries.filter(e => e.decision_date >= filters.date_from!);
    }

    if (filters.date_to) {
      entries = entries.filter(e => e.decision_date <= filters.date_to!);
    }

    if (filters.favorites_only) {
      entries = entries.filter(e => e.is_favorite);
    }

    if (filters.has_reflection) {
      entries = entries.filter(e => e.reflection && e.reflection.length > 0);
    }

    if (filters.has_outcome) {
      entries = entries.filter(e => e.outcome_status !== 'pending');
    }

    // Sort by decision date descending
    entries.sort((a, b) => b.decision_date.localeCompare(a.decision_date));

    oracleCacheService.set(cacheKeyStr, entries, JOURNAL_CACHE_TTL.search);
    return entries;
  }

  /**
   * Get all unique tags for a user
   */
  async getUserTags(userId: string): Promise<string[]> {
    const entries = this.entries.filter(e => e.user_id === userId);
    const tagSet = new Set<string>();
    entries.forEach(e => e.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }

  // =====================================================
  // OUTCOME TRACKING
  // =====================================================

  /**
   * Record the outcome of a decision
   */
  async recordOutcome(
    entryId: string,
    userId: string,
    outcome: {
      status: JournalOutcomeStatus;
      description: string;
      date?: string;
    }
  ): Promise<DecisionJournalEntry | null> {
    return this.updateEntry(entryId, userId, {
      outcome_status: outcome.status,
      outcome_description: outcome.description,
      outcome_date: outcome.date || new Date().toISOString(),
    });
  }

  /**
   * Add reflection to a journal entry
   */
  async addReflection(
    entryId: string,
    userId: string,
    reflection: {
      text: string;
      lessons_learned?: string[];
      would_decide_differently?: boolean;
      alternative_considered?: string;
      emotional_state_after?: string;
    }
  ): Promise<DecisionJournalEntry | null> {
    return this.updateEntry(entryId, userId, {
      reflection: reflection.text,
      lessons_learned: reflection.lessons_learned,
      would_decide_differently: reflection.would_decide_differently,
      alternative_considered: reflection.alternative_considered,
      emotional_state_after: reflection.emotional_state_after,
    });
  }

  // =====================================================
  // ATTACHMENTS
  // =====================================================

  /**
   * Add an attachment to a journal entry
   */
  async addAttachment(
    journalId: string,
    userId: string,
    attachment: {
      file_name: string;
      file_type: 'image' | 'document' | 'link' | 'note';
      file_path?: string;
      description?: string;
    }
  ): Promise<JournalAttachment> {
    // Verify entry exists and belongs to user
    const entry = await this.getEntry(journalId, userId);
    if (!entry) {
      throw new Error('Journal entry not found');
    }

    const newAttachment: JournalAttachment = {
      id: crypto.randomUUID(),
      journal_id: journalId,
      user_id: userId,
      file_name: attachment.file_name,
      file_type: attachment.file_type,
      file_path: attachment.file_path,
      description: attachment.description,
      created_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_journal_attachments').insert(newAttachment);
    this.attachments.push(newAttachment);

    return newAttachment;
  }

  /**
   * Get attachments for a journal entry
   */
  async getAttachments(journalId: string, userId: string): Promise<JournalAttachment[]> {
    // In production: await supabase.from('oracle_journal_attachments').select('*').eq('journal_id', journalId).eq('user_id', userId);
    return this.attachments.filter(a => a.journal_id === journalId && a.user_id === userId);
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<boolean> {
    const index = this.attachments.findIndex(a => a.id === attachmentId && a.user_id === userId);
    if (index === -1) return false;

    // In production: await supabase.from('oracle_journal_attachments').delete().eq('id', attachmentId).eq('user_id', userId);
    this.attachments.splice(index, 1);
    return true;
  }

  // =====================================================
  // FOLLOWUPS
  // =====================================================

  /**
   * Create a followup reminder
   */
  async createFollowup(params: CreateFollowupParams): Promise<JournalFollowup> {
    const followup: JournalFollowup = {
      id: crypto.randomUUID(),
      journal_id: params.journal_id,
      user_id: params.user_id,
      followup_type: params.followup_type,
      scheduled_date: params.scheduled_date,
      notes: params.notes,
      is_completed: false,
      is_dismissed: false,
      created_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_journal_followups').insert(followup);
    this.followups.push(followup);

    return followup;
  }

  /**
   * Get pending followups for a user
   */
  async getPendingFollowups(userId: string): Promise<JournalFollowup[]> {
    const now = new Date().toISOString();

    // In production: await supabase.from('oracle_journal_followups')
    //   .select('*').eq('user_id', userId).eq('is_completed', false).eq('is_dismissed', false)
    //   .lte('scheduled_date', now).order('scheduled_date', { ascending: true });
    return this.followups.filter(f =>
      f.user_id === userId &&
      !f.is_completed &&
      !f.is_dismissed &&
      f.scheduled_date <= now
    ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }

  /**
   * Get upcoming followups for a user
   */
  async getUpcomingFollowups(userId: string, days: number = 7): Promise<JournalFollowup[]> {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    return this.followups.filter(f =>
      f.user_id === userId &&
      !f.is_completed &&
      !f.is_dismissed &&
      f.scheduled_date > now.toISOString() &&
      f.scheduled_date <= endDate
    ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }

  /**
   * Complete a followup
   */
  async completeFollowup(followupId: string, userId: string, notes?: string): Promise<JournalFollowup | null> {
    const index = this.followups.findIndex(f => f.id === followupId && f.user_id === userId);
    if (index === -1) return null;

    const updated: JournalFollowup = {
      ...this.followups[index],
      is_completed: true,
      completed_date: new Date().toISOString(),
      notes: notes || this.followups[index].notes,
    };

    // In production: await supabase.from('oracle_journal_followups').update({ is_completed: true, completed_date: ... }).eq('id', followupId);
    this.followups[index] = updated;

    return updated;
  }

  /**
   * Dismiss a followup
   */
  async dismissFollowup(followupId: string, userId: string): Promise<boolean> {
    const index = this.followups.findIndex(f => f.id === followupId && f.user_id === userId);
    if (index === -1) return false;

    // In production: await supabase.from('oracle_journal_followups').update({ is_dismissed: true }).eq('id', followupId);
    this.followups[index].is_dismissed = true;

    return true;
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  /**
   * Get journal statistics for a user
   */
  async getStats(userId: string): Promise<JournalStats> {
    const cacheKeyStr = cacheKey('journal_stats', userId);

    const cached = oracleCacheService.get<JournalStats>(cacheKeyStr);
    if (cached) return cached;

    const entries = this.entries.filter(e => e.user_id === userId);

    // Count by category
    const entriesByCategory: Record<JournalCategory, number> = {
      career: 0,
      financial: 0,
      health: 0,
      relationship: 0,
      project: 0,
      personal: 0,
      business: 0,
      technical: 0,
      other: 0,
    };
    entries.forEach(e => {
      entriesByCategory[e.category]++;
    });

    // Count by outcome
    const entriesByOutcome: Record<JournalOutcomeStatus, number> = {
      pending: 0,
      success: 0,
      partial: 0,
      failure: 0,
      cancelled: 0,
      unknown: 0,
    };
    entries.forEach(e => {
      entriesByOutcome[e.outcome_status]++;
    });

    // Calculate success rate (success / (success + partial + failure))
    const totalWithOutcome = entriesByOutcome.success + entriesByOutcome.partial + entriesByOutcome.failure;
    const successRate = totalWithOutcome > 0
      ? entriesByOutcome.success / totalWithOutcome
      : 0;

    // Average confidence
    const entriesWithConfidence = entries.filter(e => e.confidence_in_decision != null);
    const averageConfidence = entriesWithConfidence.length > 0
      ? entriesWithConfidence.reduce((sum, e) => sum + (e.confidence_in_decision || 0), 0) / entriesWithConfidence.length
      : 0;

    // Decisions reviewed (has reflection)
    const decisionsReviewed = entries.filter(e => e.reflection && e.reflection.length > 0).length;

    // Lessons captured
    const lessonsCaptures = entries.reduce((sum, e) => sum + (e.lessons_learned?.length || 0), 0);

    // Most common tags
    const tagCounts: Record<string, number> = {};
    entries.forEach(e => {
      e.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const mostCommonTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const stats: JournalStats = {
      total_entries: entries.length,
      entries_by_category: entriesByCategory,
      entries_by_outcome: entriesByOutcome,
      success_rate: Math.round(successRate * 100) / 100,
      average_confidence: Math.round(averageConfidence * 100) / 100,
      decisions_reviewed: decisionsReviewed,
      lessons_captured: lessonsCaptures,
      most_common_tags: mostCommonTags,
    };

    oracleCacheService.set(cacheKeyStr, stats, JOURNAL_CACHE_TTL.stats);
    return stats;
  }

  // =====================================================
  // EXPORT
  // =====================================================

  /**
   * Export journal data
   */
  async exportJournal(
    userId: string,
    format: 'json' | 'csv' | 'markdown' | 'pdf',
    filters?: JournalSearchFilters
  ): Promise<JournalExport> {
    const entries = filters
      ? await this.searchEntries(userId, filters)
      : await this.listEntries({ user_id: userId, limit: 10000 });

    // Get attachments for all entries
    const entryIds = new Set(entries.map(e => e.id));
    const attachments = this.attachments.filter(a => entryIds.has(a.journal_id));

    const stats = await this.getStats(userId);

    return {
      entries,
      attachments,
      stats,
      exported_at: new Date().toISOString(),
      format,
    };
  }

  /**
   * Export to markdown format
   */
  async exportToMarkdown(userId: string, filters?: JournalSearchFilters): Promise<string> {
    const exportData = await this.exportJournal(userId, 'markdown', filters);

    let markdown = '# Decision Journal Export\n\n';
    markdown += `Exported: ${new Date().toLocaleDateString()}\n\n`;
    markdown += `Total Entries: ${exportData.stats.total_entries}\n`;
    markdown += `Success Rate: ${Math.round(exportData.stats.success_rate * 100)}%\n\n`;
    markdown += '---\n\n';

    for (const entry of exportData.entries) {
      markdown += `## ${entry.title}\n\n`;
      markdown += `**Date:** ${new Date(entry.decision_date).toLocaleDateString()}\n`;
      markdown += `**Category:** ${entry.category}\n`;
      markdown += `**Importance:** ${entry.importance}\n`;
      markdown += `**Outcome:** ${entry.outcome_status}\n\n`;

      markdown += `### Situation\n${entry.situation}\n\n`;

      if (entry.options_considered?.length) {
        markdown += `### Options Considered\n`;
        entry.options_considered.forEach((opt, i) => {
          markdown += `${i + 1}. ${opt}\n`;
        });
        markdown += '\n';
      }

      if (entry.chosen_option) {
        markdown += `### Chosen Option\n${entry.chosen_option}\n\n`;
      }

      if (entry.reasoning) {
        markdown += `### Reasoning\n${entry.reasoning}\n\n`;
      }

      if (entry.outcome_description) {
        markdown += `### Outcome\n${entry.outcome_description}\n\n`;
      }

      if (entry.reflection) {
        markdown += `### Reflection\n${entry.reflection}\n\n`;
      }

      if (entry.lessons_learned?.length) {
        markdown += `### Lessons Learned\n`;
        entry.lessons_learned.forEach(lesson => {
          markdown += `- ${lesson}\n`;
        });
        markdown += '\n';
      }

      if (entry.tags.length) {
        markdown += `**Tags:** ${entry.tags.join(', ')}\n`;
      }

      markdown += '\n---\n\n';
    }

    return markdown;
  }

  // =====================================================
  // LINK TO ORACLE DECISIONS
  // =====================================================

  /**
   * Create journal entry from an existing ORACLE decision
   */
  async createFromDecision(
    userId: string,
    decisionId: string,
    decisionData: {
      title: string;
      situation: string;
      options: string[];
      chosen_option: string;
      reasoning?: string;
    }
  ): Promise<DecisionJournalEntry> {
    return this.createEntry({
      user_id: userId,
      decision_id: decisionId,
      title: decisionData.title,
      situation: decisionData.situation,
      options_considered: decisionData.options,
      chosen_option: decisionData.chosen_option,
      reasoning: decisionData.reasoning,
      category: 'project',
      importance: 'moderate',
    });
  }

  /**
   * Get journal entries linked to ORACLE decisions
   */
  async getEntriesForDecision(userId: string, decisionId: string): Promise<DecisionJournalEntry[]> {
    return this.entries.filter(e => e.user_id === userId && e.decision_id === decisionId);
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Invalidate user-specific caches
   */
  private invalidateUserCache(userId: string): void {
    oracleCacheService.delete(cacheKey('journal_stats', userId));
    // In a production system, we'd also invalidate list and search caches
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(entryId: string, userId: string): Promise<boolean> {
    const entry = await this.getEntry(entryId, userId);
    if (!entry) return false;

    await this.updateEntry(entryId, userId, {
      is_favorite: !entry.is_favorite,
    });

    return !entry.is_favorite;
  }

  /**
   * Get timeline view (entries grouped by month)
   */
  async getTimeline(userId: string): Promise<Record<string, DecisionJournalEntry[]>> {
    const entries = await this.listEntries({ user_id: userId, limit: 1000 });

    const timeline: Record<string, DecisionJournalEntry[]> = {};

    entries.forEach(entry => {
      const date = new Date(entry.decision_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!timeline[monthKey]) {
        timeline[monthKey] = [];
      }
      timeline[monthKey].push(entry);
    });

    return timeline;
  }
}

// Export singleton instance
export const decisionJournalService = new DecisionJournalService();
