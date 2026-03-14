/**
 * ORACLE Activity Stream Service
 *
 * Provides comprehensive activity tracking with team and personal
 * feeds, filtered views, search, and export capabilities.
 */

import { EventEmitter } from 'events';

// Types
export interface Activity {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  actor: ActorInfo;
  action: string;
  actionVerb: string;
  target?: TargetInfo;
  context?: ContextInfo;
  metadata: ActivityMetadata;
  visibility: ActivityVisibility;
  timestamp: Date;
  teamId?: string;
}

export type ActivityType =
  | 'signal_created'
  | 'signal_updated'
  | 'signal_shared'
  | 'signal_triaged'
  | 'task_created'
  | 'task_delegated'
  | 'task_completed'
  | 'task_updated'
  | 'decision_made'
  | 'decision_updated'
  | 'comment_added'
  | 'comment_resolved'
  | 'goal_created'
  | 'goal_updated'
  | 'goal_completed'
  | 'member_joined'
  | 'member_left'
  | 'announcement_posted'
  | 'file_shared'
  | 'setting_changed'
  | 'integration_connected'
  | 'report_generated';

export type ActivityCategory =
  | 'signals'
  | 'tasks'
  | 'decisions'
  | 'collaboration'
  | 'team'
  | 'content'
  | 'system';

export interface ActorInfo {
  type: 'user' | 'system' | 'integration';
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface TargetInfo {
  type: string;
  id: string;
  name: string;
  url?: string;
  preview?: string;
}

export interface ContextInfo {
  previous?: Record<string, unknown>;
  current?: Record<string, unknown>;
  changes?: ChangeDetail[];
  relatedActivities?: string[];
  source?: string;
}

export interface ChangeDetail {
  field: string;
  from: unknown;
  to: unknown;
  displayLabel?: string;
}

export interface ActivityMetadata {
  importance: 'critical' | 'high' | 'normal' | 'low';
  tags: string[];
  duration?: number;
  ipAddress?: string;
  userAgent?: string;
  location?: GeoLocation;
}

export interface GeoLocation {
  city?: string;
  country?: string;
  timezone?: string;
}

export type ActivityVisibility = 'public' | 'team' | 'private';

export interface ActivityFeed {
  activities: Activity[];
  pagination: FeedPagination;
  summary?: FeedSummary;
  filters: AppliedFilters;
}

export interface FeedPagination {
  cursor?: string;
  hasMore: boolean;
  totalCount?: number;
  pageSize: number;
}

export interface FeedSummary {
  totalActivities: number;
  byCategory: Record<ActivityCategory, number>;
  topActors: { actor: ActorInfo; count: number }[];
  mostActiveHour: number;
  trendingTags: string[];
}

export interface AppliedFilters {
  types?: ActivityType[];
  categories?: ActivityCategory[];
  actors?: string[];
  dateRange?: { start: Date; end: Date };
  teams?: string[];
  searchQuery?: string;
  tags?: string[];
  importance?: ('critical' | 'high' | 'normal' | 'low')[];
}

export interface ActivityFeedOptions {
  cursor?: string;
  pageSize?: number;
  filters?: AppliedFilters;
  sortOrder?: 'asc' | 'desc';
  includeContext?: boolean;
  groupBy?: 'none' | 'actor' | 'target' | 'hour' | 'day';
}

export interface GroupedActivityFeed {
  groups: ActivityGroup[];
  pagination: FeedPagination;
}

export interface ActivityGroup {
  key: string;
  label: string;
  activities: Activity[];
  count: number;
  latestTimestamp: Date;
}

export interface PersonalActivityLog {
  userId: string;
  activities: Activity[];
  stats: PersonalStats;
  pagination: FeedPagination;
}

export interface PersonalStats {
  totalActions: number;
  thisWeek: number;
  mostActiveDay: string;
  topCategories: { category: ActivityCategory; count: number }[];
  streak: number;
  contributions: DailyContribution[];
}

export interface DailyContribution {
  date: Date;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface SearchOptions {
  query: string;
  filters?: AppliedFilters;
  limit?: number;
  offset?: number;
  highlight?: boolean;
}

export interface SearchResult {
  activities: ActivitySearchHit[];
  totalHits: number;
  facets: SearchFacets;
  suggestions: string[];
}

export interface ActivitySearchHit extends Activity {
  score: number;
  highlights?: {
    field: string;
    snippets: string[];
  }[];
}

export interface SearchFacets {
  categories: { value: ActivityCategory; count: number }[];
  types: { value: ActivityType; count: number }[];
  actors: { value: string; name: string; count: number }[];
  dateRanges: { label: string; count: number }[];
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  filters?: AppliedFilters;
  includeMetadata?: boolean;
  dateRange?: { start: Date; end: Date };
  maxRecords?: number;
}

export interface ExportResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  recordCount: number;
  fileSize?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ActivitySubscription {
  id: string;
  userId: string;
  filters: AppliedFilters;
  channels: ('websocket' | 'webhook' | 'email')[];
  active: boolean;
  createdAt: Date;
}

// Service Implementation
class ActivityStreamService extends EventEmitter {
  private activities: Activity[] = [];
  private subscriptions: Map<string, ActivitySubscription> = new Map();
  private exports: Map<string, ExportResult> = new Map();

  constructor() {
    super();
  }

  /**
   * Record a new activity
   */
  async recordActivity(
    activity: Omit<Activity, 'id' | 'timestamp'>
  ): Promise<Activity> {
    const newActivity: Activity = {
      ...activity,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.activities.push(newActivity);

    // Trim old activities (keep last 100k)
    if (this.activities.length > 100000) {
      this.activities = this.activities.slice(-100000);
    }

    // Notify subscribers
    await this.notifySubscribers(newActivity);

    this.emit('activity:recorded', { activity: newActivity });

    return newActivity;
  }

  /**
   * Get team activity feed
   */
  async getTeamActivityFeed(
    teamId: string,
    options: ActivityFeedOptions = {}
  ): Promise<ActivityFeed> {
    const pageSize = options.pageSize || 50;
    const sortOrder = options.sortOrder || 'desc';

    let activities = this.activities.filter(a =>
      a.teamId === teamId && a.visibility !== 'private'
    );

    // Apply filters
    if (options.filters) {
      activities = this.applyFilters(activities, options.filters);
    }

    // Sort
    activities.sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return sortOrder === 'desc' ? -diff : diff;
    });

    // Paginate
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = activities.findIndex(a => a.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedActivities = activities.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < activities.length;

    // Remove context if not requested
    if (!options.includeContext) {
      paginatedActivities.forEach(a => {
        a.context = undefined;
      });
    }

    // Generate summary
    const summary = this.generateFeedSummary(activities);

    return {
      activities: paginatedActivities,
      pagination: {
        cursor: paginatedActivities.length > 0
          ? paginatedActivities[paginatedActivities.length - 1].id
          : undefined,
        hasMore,
        totalCount: activities.length,
        pageSize,
      },
      summary,
      filters: options.filters || {},
    };
  }

  /**
   * Get grouped activity feed
   */
  async getGroupedActivityFeed(
    teamId: string,
    options: ActivityFeedOptions & { groupBy: 'actor' | 'target' | 'hour' | 'day' }
  ): Promise<GroupedActivityFeed> {
    const feed = await this.getTeamActivityFeed(teamId, {
      ...options,
      pageSize: 1000, // Get more for grouping
    });

    const groups = this.groupActivities(feed.activities, options.groupBy);

    return {
      groups,
      pagination: feed.pagination,
    };
  }

  /**
   * Get personal activity log
   */
  async getPersonalActivityLog(
    userId: string,
    options: ActivityFeedOptions = {}
  ): Promise<PersonalActivityLog> {
    const pageSize = options.pageSize || 50;

    let activities = this.activities.filter(a =>
      a.actor.id === userId
    );

    if (options.filters) {
      activities = this.applyFilters(activities, options.filters);
    }

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Calculate stats
    const stats = this.calculatePersonalStats(userId, activities);

    // Paginate
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = activities.findIndex(a => a.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedActivities = activities.slice(startIndex, startIndex + pageSize);

    return {
      userId,
      activities: paginatedActivities,
      stats,
      pagination: {
        cursor: paginatedActivities.length > 0
          ? paginatedActivities[paginatedActivities.length - 1].id
          : undefined,
        hasMore: startIndex + pageSize < activities.length,
        pageSize,
      },
    };
  }

  /**
   * Get filtered activity view
   */
  async getFilteredView(
    options: {
      teamId?: string;
      userId?: string;
      filters: AppliedFilters;
      pageSize?: number;
      cursor?: string;
    }
  ): Promise<ActivityFeed> {
    let activities = [...this.activities];

    if (options.teamId) {
      activities = activities.filter(a => a.teamId === options.teamId);
    }

    if (options.userId) {
      activities = activities.filter(a =>
        a.actor.id === options.userId ||
        a.target?.id === options.userId ||
        a.visibility === 'public'
      );
    }

    activities = this.applyFilters(activities, options.filters);

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const pageSize = options.pageSize || 50;
    let startIndex = 0;

    if (options.cursor) {
      const cursorIndex = activities.findIndex(a => a.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedActivities = activities.slice(startIndex, startIndex + pageSize);

    return {
      activities: paginatedActivities,
      pagination: {
        cursor: paginatedActivities.length > 0
          ? paginatedActivities[paginatedActivities.length - 1].id
          : undefined,
        hasMore: startIndex + pageSize < activities.length,
        totalCount: activities.length,
        pageSize,
      },
      filters: options.filters,
    };
  }

  /**
   * Search activities
   */
  async searchActivities(options: SearchOptions): Promise<SearchResult> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const query = options.query.toLowerCase();

    let activities = [...this.activities];

    if (options.filters) {
      activities = this.applyFilters(activities, options.filters);
    }

    // Simple text search
    const hits: ActivitySearchHit[] = activities
      .filter(a => {
        const searchText = [
          a.action,
          a.actor.name,
          a.target?.name,
          ...(a.metadata.tags || []),
        ].join(' ').toLowerCase();

        return searchText.includes(query);
      })
      .map(a => {
        // Calculate relevance score
        let score = 0;
        if (a.action.toLowerCase().includes(query)) score += 10;
        if (a.actor.name.toLowerCase().includes(query)) score += 5;
        if (a.target?.name?.toLowerCase().includes(query)) score += 5;
        if (a.metadata.tags?.some(t => t.toLowerCase().includes(query))) score += 3;

        return {
          ...a,
          score,
          highlights: options.highlight ? this.generateHighlights(a, query) : undefined,
        };
      })
      .sort((a, b) => b.score - a.score);

    const totalHits = hits.length;
    const paginatedHits = hits.slice(offset, offset + limit);

    // Generate facets
    const facets = this.generateSearchFacets(activities);

    // Generate suggestions
    const suggestions = this.generateSuggestions(query, activities);

    return {
      activities: paginatedHits,
      totalHits,
      facets,
      suggestions,
    };
  }

  /**
   * Export activities
   */
  async exportActivities(
    userId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const exportId = this.generateId();

    const exportResult: ExportResult = {
      id: exportId,
      status: 'pending',
      format: options.format,
      recordCount: 0,
      createdAt: new Date(),
    };

    this.exports.set(exportId, exportResult);

    // Process export asynchronously
    this.processExport(exportResult, options);

    return exportResult;
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<ExportResult | null> {
    return this.exports.get(exportId) || null;
  }

  /**
   * Subscribe to activity updates
   */
  async subscribe(
    userId: string,
    filters: AppliedFilters,
    channels: ('websocket' | 'webhook' | 'email')[]
  ): Promise<ActivitySubscription> {
    const subscription: ActivitySubscription = {
      id: this.generateId(),
      userId,
      filters,
      channels,
      active: true,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);

    this.emit('subscription:created', { subscription });

    return subscription;
  }

  /**
   * Unsubscribe from activity updates
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
      this.emit('subscription:cancelled', { subscription });
    }
  }

  /**
   * Get activity by ID
   */
  async getActivity(activityId: string): Promise<Activity | null> {
    return this.activities.find(a => a.id === activityId) || null;
  }

  /**
   * Get related activities
   */
  async getRelatedActivities(
    activityId: string,
    limit: number = 10
  ): Promise<Activity[]> {
    const activity = await this.getActivity(activityId);
    if (!activity) return [];

    // Find activities with same target or actor
    return this.activities
      .filter(a =>
        a.id !== activityId &&
        (
          (a.target?.id === activity.target?.id && activity.target?.id) ||
          (a.actor.id === activity.actor.id) ||
          a.context?.relatedActivities?.includes(activityId)
        )
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(
    options: {
      teamId?: string;
      userId?: string;
      dateRange: { start: Date; end: Date };
    }
  ): Promise<{
    total: number;
    byDay: { date: Date; count: number }[];
    byCategory: Record<ActivityCategory, number>;
    byActor: { actorId: string; actorName: string; count: number }[];
    byHour: { hour: number; count: number }[];
    trends: { metric: string; value: number; change: number }[];
  }> {
    let activities = this.activities.filter(a =>
      a.timestamp >= options.dateRange.start &&
      a.timestamp <= options.dateRange.end
    );

    if (options.teamId) {
      activities = activities.filter(a => a.teamId === options.teamId);
    }

    if (options.userId) {
      activities = activities.filter(a => a.actor.id === options.userId);
    }

    // By day
    const byDay = new Map<string, number>();
    const byCategory: Record<ActivityCategory, number> = {
      signals: 0,
      tasks: 0,
      decisions: 0,
      collaboration: 0,
      team: 0,
      content: 0,
      system: 0,
    };
    const byActor = new Map<string, { name: string; count: number }>();
    const byHour: number[] = new Array(24).fill(0);

    for (const activity of activities) {
      // By day
      const dayKey = activity.timestamp.toISOString().split('T')[0];
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);

      // By category
      byCategory[activity.category]++;

      // By actor
      const actorData = byActor.get(activity.actor.id) || { name: activity.actor.name, count: 0 };
      actorData.count++;
      byActor.set(activity.actor.id, actorData);

      // By hour
      byHour[activity.timestamp.getHours()]++;
    }

    return {
      total: activities.length,
      byDay: Array.from(byDay.entries())
        .map(([date, count]) => ({ date: new Date(date), count }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
      byCategory,
      byActor: Array.from(byActor.entries())
        .map(([actorId, data]) => ({ actorId, actorName: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byHour: byHour.map((count, hour) => ({ hour, count })),
      trends: this.calculateTrends(activities, options.dateRange),
    };
  }

  // Private methods
  private generateId(): string {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private applyFilters(activities: Activity[], filters: AppliedFilters): Activity[] {
    return activities.filter(a => {
      if (filters.types && !filters.types.includes(a.type)) return false;
      if (filters.categories && !filters.categories.includes(a.category)) return false;
      if (filters.actors && !filters.actors.includes(a.actor.id)) return false;
      if (filters.teams && a.teamId && !filters.teams.includes(a.teamId)) return false;
      if (filters.importance && !filters.importance.includes(a.metadata.importance)) return false;
      if (filters.tags && !filters.tags.some(t => a.metadata.tags.includes(t))) return false;

      if (filters.dateRange) {
        if (a.timestamp < filters.dateRange.start || a.timestamp > filters.dateRange.end) {
          return false;
        }
      }

      if (filters.searchQuery) {
        const searchText = [
          a.action,
          a.actor.name,
          a.target?.name,
          ...(a.metadata.tags || []),
        ].join(' ').toLowerCase();

        if (!searchText.includes(filters.searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  private groupActivities(
    activities: Activity[],
    groupBy: 'actor' | 'target' | 'hour' | 'day'
  ): ActivityGroup[] {
    const groups = new Map<string, ActivityGroup>();

    for (const activity of activities) {
      let key: string;
      let label: string;

      switch (groupBy) {
        case 'actor':
          key = activity.actor.id;
          label = activity.actor.name;
          break;
        case 'target':
          key = activity.target?.id || 'no-target';
          label = activity.target?.name || 'No target';
          break;
        case 'hour':
          const hour = activity.timestamp.getHours();
          key = `hour-${hour}`;
          label = `${hour}:00 - ${hour + 1}:00`;
          break;
        case 'day':
          key = activity.timestamp.toISOString().split('T')[0];
          label = activity.timestamp.toLocaleDateString();
          break;
      }

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label,
          activities: [],
          count: 0,
          latestTimestamp: activity.timestamp,
        };
        groups.set(key, group);
      }

      group.activities.push(activity);
      group.count++;
      if (activity.timestamp > group.latestTimestamp) {
        group.latestTimestamp = activity.timestamp;
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.latestTimestamp.getTime() - a.latestTimestamp.getTime());
  }

  private generateFeedSummary(activities: Activity[]): FeedSummary {
    const byCategory: Record<ActivityCategory, number> = {
      signals: 0,
      tasks: 0,
      decisions: 0,
      collaboration: 0,
      team: 0,
      content: 0,
      system: 0,
    };

    const actorCounts = new Map<string, { actor: ActorInfo; count: number }>();
    const hourCounts: number[] = new Array(24).fill(0);
    const tagCounts = new Map<string, number>();

    for (const activity of activities) {
      byCategory[activity.category]++;

      const actorData = actorCounts.get(activity.actor.id) ||
        { actor: activity.actor, count: 0 };
      actorData.count++;
      actorCounts.set(activity.actor.id, actorData);

      hourCounts[activity.timestamp.getHours()]++;

      for (const tag of activity.metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topActors = Array.from(actorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));

    const trendingTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      totalActivities: activities.length,
      byCategory,
      topActors,
      mostActiveHour,
      trendingTags,
    };
  }

  private calculatePersonalStats(userId: string, activities: Activity[]): PersonalStats {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const thisWeek = activities.filter(a => a.timestamp >= weekAgo).length;

    // Day counts
    const dayCounts = new Map<string, number>();
    for (const activity of activities) {
      const dayName = activity.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
    }

    let mostActiveDay = '';
    let maxCount = 0;
    dayCounts.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDay = day;
      }
    });

    // Category counts
    const categoryCounts = new Map<ActivityCategory, number>();
    for (const activity of activities) {
      categoryCounts.set(
        activity.category,
        (categoryCounts.get(activity.category) || 0) + 1
      );
    }

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Calculate streak
    const streak = this.calculateStreak(activities);

    // Generate contributions (last 90 days)
    const contributions = this.generateContributions(activities);

    return {
      totalActions: activities.length,
      thisWeek,
      mostActiveDay,
      topCategories,
      streak,
      contributions,
    };
  }

  private calculateStreak(activities: Activity[]): number {
    if (activities.length === 0) return 0;

    const sortedActivities = [...activities].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const activityDates = new Set(
      sortedActivities.map(a => {
        const d = new Date(a.timestamp);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );

    while (activityDates.has(currentDate.getTime())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  private generateContributions(activities: Activity[]): DailyContribution[] {
    const contributions: DailyContribution[] = [];
    const now = new Date();
    const counts = new Map<string, number>();

    // Count activities per day
    for (const activity of activities) {
      const dateKey = activity.timestamp.toISOString().split('T')[0];
      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    }

    // Generate last 90 days
    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dateKey = date.toISOString().split('T')[0];
      const count = counts.get(dateKey) || 0;

      let level: 0 | 1 | 2 | 3 | 4;
      if (count === 0) level = 0;
      else if (count <= 2) level = 1;
      else if (count <= 5) level = 2;
      else if (count <= 10) level = 3;
      else level = 4;

      contributions.push({ date, count, level });
    }

    return contributions;
  }

  private generateHighlights(
    activity: Activity,
    query: string
  ): { field: string; snippets: string[] }[] {
    const highlights: { field: string; snippets: string[] }[] = [];

    const fields = [
      { name: 'action', value: activity.action },
      { name: 'actor', value: activity.actor.name },
      { name: 'target', value: activity.target?.name || '' },
    ];

    for (const field of fields) {
      if (field.value.toLowerCase().includes(query)) {
        const index = field.value.toLowerCase().indexOf(query);
        const start = Math.max(0, index - 20);
        const end = Math.min(field.value.length, index + query.length + 20);
        const snippet = field.value.substring(start, end);

        highlights.push({
          field: field.name,
          snippets: [`...${snippet}...`],
        });
      }
    }

    return highlights;
  }

  private generateSearchFacets(activities: Activity[]): SearchFacets {
    const categoryCounts = new Map<ActivityCategory, number>();
    const typeCounts = new Map<ActivityType, number>();
    const actorCounts = new Map<string, { name: string; count: number }>();

    for (const activity of activities) {
      categoryCounts.set(
        activity.category,
        (categoryCounts.get(activity.category) || 0) + 1
      );

      typeCounts.set(
        activity.type,
        (typeCounts.get(activity.type) || 0) + 1
      );

      const actorData = actorCounts.get(activity.actor.id) ||
        { name: activity.actor.name, count: 0 };
      actorData.count++;
      actorCounts.set(activity.actor.id, actorData);
    }

    return {
      categories: Array.from(categoryCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      types: Array.from(typeCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      actors: Array.from(actorCounts.entries())
        .map(([value, data]) => ({ value, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      dateRanges: [
        { label: 'Today', count: 0 },
        { label: 'This Week', count: 0 },
        { label: 'This Month', count: 0 },
      ],
    };
  }

  private generateSuggestions(query: string, activities: Activity[]): string[] {
    const words = new Set<string>();

    for (const activity of activities) {
      const text = [
        activity.action,
        activity.actor.name,
        activity.target?.name,
        ...activity.metadata.tags,
      ].join(' ');

      for (const word of text.split(/\s+/)) {
        if (word.toLowerCase().startsWith(query.toLowerCase()) && word.length > query.length) {
          words.add(word);
        }
      }
    }

    return Array.from(words).slice(0, 5);
  }

  private async processExport(exportResult: ExportResult, options: ExportOptions): Promise<void> {
    try {
      exportResult.status = 'processing';

      let activities = [...this.activities];

      if (options.filters) {
        activities = this.applyFilters(activities, options.filters);
      }

      if (options.dateRange) {
        activities = activities.filter(a =>
          a.timestamp >= options.dateRange!.start &&
          a.timestamp <= options.dateRange!.end
        );
      }

      if (options.maxRecords && activities.length > options.maxRecords) {
        activities = activities.slice(0, options.maxRecords);
      }

      exportResult.recordCount = activities.length;

      // Generate export content based on format
      let content: string;
      switch (options.format) {
        case 'json':
          content = JSON.stringify(activities, null, 2);
          break;
        case 'csv':
          content = this.generateCSV(activities, options.includeMetadata);
          break;
        case 'pdf':
          content = 'PDF generation would go here';
          break;
        default:
          content = JSON.stringify(activities);
      }

      exportResult.fileSize = content.length;
      exportResult.status = 'completed';
      exportResult.completedAt = new Date();
      exportResult.downloadUrl = `exports/${exportResult.id}.${options.format}`;
      exportResult.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      this.emit('export:completed', { exportResult });
    } catch (error) {
      exportResult.status = 'failed';
      exportResult.error = error instanceof Error ? error.message : 'Unknown error';

      this.emit('export:failed', { exportResult });
    }
  }

  private generateCSV(activities: Activity[], includeMetadata?: boolean): string {
    const headers = [
      'id',
      'type',
      'category',
      'actor_id',
      'actor_name',
      'action',
      'target_type',
      'target_id',
      'target_name',
      'timestamp',
    ];

    if (includeMetadata) {
      headers.push('importance', 'tags');
    }

    const rows = activities.map(a => {
      const row = [
        a.id,
        a.type,
        a.category,
        a.actor.id,
        a.actor.name,
        a.action,
        a.target?.type || '',
        a.target?.id || '',
        a.target?.name || '',
        a.timestamp.toISOString(),
      ];

      if (includeMetadata) {
        row.push(a.metadata.importance, a.metadata.tags.join(';'));
      }

      return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private async notifySubscribers(activity: Activity): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;

      // Check if activity matches subscription filters
      const matches = this.applyFilters([activity], subscription.filters);
      if (matches.length === 0) continue;

      for (const channel of subscription.channels) {
        this.emit(`subscription:${channel}`, {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          activity,
        });
      }
    }
  }

  private calculateTrends(
    activities: Activity[],
    dateRange: { start: Date; end: Date }
  ): { metric: string; value: number; change: number }[] {
    // Compare with previous period
    const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
    const previousStart = new Date(dateRange.start.getTime() - periodLength);
    const previousEnd = dateRange.start;

    const previousActivities = this.activities.filter(a =>
      a.timestamp >= previousStart && a.timestamp < previousEnd
    );

    const currentCount = activities.length;
    const previousCount = previousActivities.length;
    const countChange = previousCount > 0
      ? ((currentCount - previousCount) / previousCount) * 100
      : 0;

    return [
      { metric: 'Total Activities', value: currentCount, change: countChange },
      {
        metric: 'Daily Average',
        value: currentCount / Math.max(1, Math.ceil(periodLength / (24 * 60 * 60 * 1000))),
        change: 0,
      },
      {
        metric: 'Active Users',
        value: new Set(activities.map(a => a.actor.id)).size,
        change: 0,
      },
    ];
  }
}

export const activityStreamService = new ActivityStreamService();
export default activityStreamService;
