/**
 * ORACLE Notification Hub Service
 *
 * Manages multi-channel notifications with preferences,
 * priority routing, digests, and comprehensive notification history.
 */

import { EventEmitter } from 'events';

// Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
  status: NotificationStatus;
  deliveryStatus: DeliveryStatus[];
  actions: NotificationAction[];
  groupId?: string;
  relatedNotifications?: string[];
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
  actedAt?: Date;
  dismissedAt?: Date;
}

export type NotificationType =
  | 'signal_alert'
  | 'task_delegated'
  | 'task_completed'
  | 'decision_required'
  | 'mention'
  | 'comment'
  | 'reaction'
  | 'deadline_approaching'
  | 'goal_update'
  | 'team_announcement'
  | 'system_alert'
  | 'invitation'
  | 'reminder'
  | 'digest';

export type NotificationCategory =
  | 'signals'
  | 'tasks'
  | 'decisions'
  | 'collaboration'
  | 'team'
  | 'system'
  | 'personal';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type DeliveryChannel = 'push' | 'email' | 'in_app' | 'sms' | 'slack' | 'webhook';

export type NotificationStatus =
  | 'pending'
  | 'delivered'
  | 'read'
  | 'acted'
  | 'dismissed'
  | 'expired'
  | 'failed';

export interface DeliveryStatus {
  channel: DeliveryChannel;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  actionType: 'navigate' | 'api_call' | 'dismiss' | 'snooze';
  payload?: Record<string, unknown>;
}

export interface NotificationPreferences {
  userId: string;
  globalEnabled: boolean;
  quietHours: QuietHours;
  channelPreferences: ChannelPreference[];
  categoryPreferences: CategoryPreference[];
  digestSettings: DigestSettings;
  muteSettings: MuteSettings;
  priorityOverrides: PriorityOverride[];
}

export interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timezone: string;
  allowCritical: boolean;
  daysOfWeek: number[];
}

export interface ChannelPreference {
  channel: DeliveryChannel;
  enabled: boolean;
  priority: NotificationPriority;
  categories: NotificationCategory[];
}

export interface CategoryPreference {
  category: NotificationCategory;
  enabled: boolean;
  channels: DeliveryChannel[];
  minimumPriority: NotificationPriority;
  batchable: boolean;
}

export interface DigestSettings {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  deliveryTime: string; // HH:MM
  deliveryDay?: number; // 0-6 for weekly
  channels: DeliveryChannel[];
  categories: NotificationCategory[];
  groupBy: 'category' | 'priority' | 'type';
}

export interface MuteSettings {
  mutedUntil?: Date;
  mutedCategories: NotificationCategory[];
  mutedTypes: NotificationType[];
  mutedSources: string[];
}

export interface PriorityOverride {
  type: NotificationType;
  source?: string;
  overridePriority: NotificationPriority;
  channels: DeliveryChannel[];
}

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  channels?: DeliveryChannel[];
  actions?: Omit<NotificationAction, 'id'>[];
  groupId?: string;
  expiresIn?: number; // minutes
  bypassPreferences?: boolean;
}

export interface BulkNotificationRequest {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
}

export interface NotificationGroup {
  id: string;
  userId: string;
  notifications: Notification[];
  summary: string;
  count: number;
  latestAt: Date;
  category: NotificationCategory;
}

export interface NotificationFeed {
  notifications: Notification[];
  groups: NotificationGroup[];
  unreadCount: number;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface NotificationHistory {
  notifications: Notification[];
  stats: HistoryStats;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
}

export interface HistoryStats {
  total: number;
  byStatus: Record<NotificationStatus, number>;
  byCategory: Record<NotificationCategory, number>;
  byChannel: Record<DeliveryChannel, number>;
  averageReadTime: number;
  actionRate: number;
}

export interface DigestContent {
  userId: string;
  period: { start: Date; end: Date };
  summary: DigestSummary;
  sections: DigestSection[];
  generatedAt: Date;
}

export interface DigestSummary {
  totalNotifications: number;
  criticalCount: number;
  actionRequired: number;
  highlights: string[];
}

export interface DigestSection {
  category: NotificationCategory;
  title: string;
  notifications: Notification[];
  summary: string;
}

export interface SnoozeRequest {
  notificationId?: string;
  category?: NotificationCategory;
  duration: number; // minutes
  until?: Date;
}

// Service Implementation
class NotificationHubService extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private digestQueue: Map<string, Notification[]> = new Map();

  constructor() {
    super();
    this.startDigestProcessor();
  }

  /**
   * Send a notification
   */
  async sendNotification(request: SendNotificationRequest): Promise<Notification> {
    const prefs = await this.getPreferences(request.userId);

    // Check if notification should be sent
    if (!request.bypassPreferences) {
      if (!this.shouldSendNotification(request, prefs)) {
        throw new Error('Notification blocked by user preferences');
      }
    }

    const category = this.getCategoryForType(request.type);
    const priority = request.priority || this.determinePriority(request.type, prefs);
    const channels = request.channels || this.determineChannels(request.type, priority, prefs);

    const notification: Notification = {
      id: this.generateId(),
      userId: request.userId,
      type: request.type,
      category,
      title: request.title,
      message: request.message,
      data: request.data,
      priority,
      channels,
      status: 'pending',
      deliveryStatus: channels.map(channel => ({
        channel,
        status: 'pending' as const,
      })),
      actions: (request.actions || []).map(a => ({
        ...a,
        id: this.generateId(),
      })),
      groupId: request.groupId,
      expiresAt: request.expiresIn
        ? new Date(Date.now() + request.expiresIn * 60 * 1000)
        : undefined,
      createdAt: new Date(),
    };

    this.notifications.set(notification.id, notification);

    // Check if should batch for digest
    if (this.shouldBatchForDigest(notification, prefs)) {
      await this.addToDigestQueue(notification);
    } else {
      // Deliver immediately
      await this.deliverNotification(notification);
    }

    this.emit('notification:created', { notification });

    return notification;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    request: BulkNotificationRequest
  ): Promise<{ successful: string[]; failed: { userId: string; error: string }[] }> {
    const successful: string[] = [];
    const failed: { userId: string; error: string }[] = [];

    for (const userId of request.userIds) {
      try {
        await this.sendNotification({
          userId,
          type: request.type,
          title: request.title,
          message: request.message,
          data: request.data,
          priority: request.priority,
        });
        successful.push(userId);
      } catch (error) {
        failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    let prefs = this.preferences.get(userId);
    if (!prefs) {
      prefs = this.createDefaultPreferences(userId);
      this.preferences.set(userId, prefs);
    }
    return prefs;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
    };
    this.preferences.set(userId, updated);

    this.emit('preferences:updated', { userId, preferences: updated });

    return updated;
  }

  /**
   * Get notification feed for user
   */
  async getNotificationFeed(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      categories?: NotificationCategory[];
      status?: NotificationStatus[];
      grouped?: boolean;
    } = {}
  ): Promise<NotificationFeed> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    let notifications = Array.from(this.notifications.values()).filter(n => {
      if (n.userId !== userId) return false;
      if (options.categories && !options.categories.includes(n.category)) return false;
      if (options.status && !options.status.includes(n.status)) return false;
      if (n.expiresAt && n.expiresAt < new Date()) return false;
      return true;
    });

    // Sort by created date (newest first)
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const unreadCount = notifications.filter(n =>
      n.status === 'pending' || n.status === 'delivered'
    ).length;

    // Group if requested
    let groups: NotificationGroup[] = [];
    if (options.grouped) {
      groups = this.groupNotifications(notifications);
      // For grouped view, we show groups instead of individual notifications
      notifications = [];
    }

    const totalItems = notifications.length + groups.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedNotifications = notifications.slice(startIndex, startIndex + pageSize);

    return {
      notifications: paginatedNotifications,
      groups,
      unreadCount,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Not authorized');
    }

    notification.status = 'read';
    notification.readAt = new Date();

    this.emit('notification:read', { notificationId, userId });

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(
    userId: string,
    options: { category?: NotificationCategory; before?: Date } = {}
  ): Promise<number> {
    let count = 0;

    for (const notification of this.notifications.values()) {
      if (notification.userId !== userId) continue;
      if (notification.status !== 'pending' && notification.status !== 'delivered') continue;
      if (options.category && notification.category !== options.category) continue;
      if (options.before && notification.createdAt > options.before) continue;

      notification.status = 'read';
      notification.readAt = new Date();
      count++;
    }

    this.emit('notifications:all_read', { userId, count });

    return count;
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(notificationId: string, userId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }

    notification.status = 'dismissed';
    notification.dismissedAt = new Date();

    this.emit('notification:dismissed', { notificationId, userId });
  }

  /**
   * Act on a notification
   */
  async actOnNotification(
    notificationId: string,
    userId: string,
    actionId: string
  ): Promise<{ success: boolean; result?: unknown }> {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }

    const action = notification.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error('Action not found');
    }

    notification.status = 'acted';
    notification.actedAt = new Date();

    this.emit('notification:acted', {
      notificationId,
      userId,
      action,
    });

    // Handle action based on type
    switch (action.actionType) {
      case 'dismiss':
        notification.status = 'dismissed';
        notification.dismissedAt = new Date();
        break;
      case 'snooze':
        await this.snooze({
          notificationId,
          duration: (action.payload?.duration as number) || 30,
        }, userId);
        break;
      // navigate and api_call would be handled by client
    }

    return { success: true };
  }

  /**
   * Snooze notifications
   */
  async snooze(request: SnoozeRequest, userId: string): Promise<Date> {
    const until = request.until || new Date(Date.now() + request.duration * 60 * 1000);

    const prefs = await this.getPreferences(userId);

    if (request.notificationId) {
      // Snooze specific notification
      const notification = this.notifications.get(request.notificationId);
      if (notification && notification.userId === userId) {
        // Clone and reschedule
        notification.expiresAt = until;
      }
    } else if (request.category) {
      // Snooze category
      prefs.muteSettings.mutedCategories.push(request.category);
      prefs.muteSettings.mutedUntil = until;
    }

    this.emit('notifications:snoozed', { userId, until, request });

    return until;
  }

  /**
   * Mute notifications
   */
  async mute(
    userId: string,
    options: {
      categories?: NotificationCategory[];
      types?: NotificationType[];
      sources?: string[];
      until?: Date;
    }
  ): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId);

    if (options.categories) {
      prefs.muteSettings.mutedCategories = [
        ...new Set([...prefs.muteSettings.mutedCategories, ...options.categories]),
      ];
    }

    if (options.types) {
      prefs.muteSettings.mutedTypes = [
        ...new Set([...prefs.muteSettings.mutedTypes, ...options.types]),
      ];
    }

    if (options.sources) {
      prefs.muteSettings.mutedSources = [
        ...new Set([...prefs.muteSettings.mutedSources, ...options.sources]),
      ];
    }

    if (options.until) {
      prefs.muteSettings.mutedUntil = options.until;
    }

    this.emit('notifications:muted', { userId, options });

    return prefs;
  }

  /**
   * Unmute notifications
   */
  async unmute(
    userId: string,
    options: {
      categories?: NotificationCategory[];
      types?: NotificationType[];
      sources?: string[];
      all?: boolean;
    }
  ): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId);

    if (options.all) {
      prefs.muteSettings = {
        mutedCategories: [],
        mutedTypes: [],
        mutedSources: [],
      };
    } else {
      if (options.categories) {
        prefs.muteSettings.mutedCategories = prefs.muteSettings.mutedCategories
          .filter(c => !options.categories!.includes(c));
      }

      if (options.types) {
        prefs.muteSettings.mutedTypes = prefs.muteSettings.mutedTypes
          .filter(t => !options.types!.includes(t));
      }

      if (options.sources) {
        prefs.muteSettings.mutedSources = prefs.muteSettings.mutedSources
          .filter(s => !options.sources!.includes(s));
      }
    }

    this.emit('notifications:unmuted', { userId, options });

    return prefs;
  }

  /**
   * Configure priority routing
   */
  async configurePriorityRouting(
    userId: string,
    overrides: PriorityOverride[]
  ): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId);
    prefs.priorityOverrides = overrides;

    this.emit('priority_routing:configured', { userId, overrides });

    return prefs;
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      dateRange?: { start: Date; end: Date };
      categories?: NotificationCategory[];
      channels?: DeliveryChannel[];
    } = {}
  ): Promise<NotificationHistory> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;

    let notifications = Array.from(this.notifications.values()).filter(n => {
      if (n.userId !== userId) return false;
      if (options.categories && !options.categories.includes(n.category)) return false;
      if (options.channels && !n.channels.some(c => options.channels!.includes(c))) return false;
      if (options.dateRange) {
        if (n.createdAt < options.dateRange.start || n.createdAt > options.dateRange.end) {
          return false;
        }
      }
      return true;
    });

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const stats = this.calculateHistoryStats(notifications);

    const startIndex = (page - 1) * pageSize;
    const paginatedNotifications = notifications.slice(startIndex, startIndex + pageSize);

    return {
      notifications: paginatedNotifications,
      stats,
      pagination: {
        page,
        pageSize,
        totalItems: notifications.length,
      },
    };
  }

  /**
   * Generate digest for user
   */
  async generateDigest(userId: string): Promise<DigestContent> {
    const prefs = await this.getPreferences(userId);
    const queue = this.digestQueue.get(userId) || [];

    const period = this.getDigestPeriod(prefs.digestSettings.frequency);

    const notifications = queue.filter(n =>
      n.createdAt >= period.start && n.createdAt <= period.end
    );

    const criticalCount = notifications.filter(n => n.priority === 'critical').length;
    const actionRequired = notifications.filter(n =>
      n.status === 'pending' || n.status === 'delivered'
    ).length;

    const sections: DigestSection[] = [];
    const categories = [...new Set(notifications.map(n => n.category))];

    for (const category of categories) {
      const categoryNotifications = notifications.filter(n => n.category === category);
      sections.push({
        category,
        title: this.getCategoryTitle(category),
        notifications: categoryNotifications,
        summary: `${categoryNotifications.length} ${category} notifications`,
      });
    }

    const highlights = this.generateHighlights(notifications);

    // Clear processed notifications from queue
    this.digestQueue.set(userId, queue.filter(n =>
      n.createdAt > period.end
    ));

    return {
      userId,
      period,
      summary: {
        totalNotifications: notifications.length,
        criticalCount,
        actionRequired,
        highlights,
      },
      sections,
      generatedAt: new Date(),
    };
  }

  // Private methods
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      globalEnabled: true,
      quietHours: {
        enabled: false,
        startHour: 22,
        endHour: 8,
        timezone: 'UTC',
        allowCritical: true,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
      channelPreferences: [
        { channel: 'in_app', enabled: true, priority: 'low', categories: [] },
        { channel: 'push', enabled: true, priority: 'normal', categories: [] },
        { channel: 'email', enabled: true, priority: 'high', categories: [] },
      ],
      categoryPreferences: [
        { category: 'signals', enabled: true, channels: ['in_app', 'push'], minimumPriority: 'low', batchable: true },
        { category: 'tasks', enabled: true, channels: ['in_app', 'push'], minimumPriority: 'low', batchable: true },
        { category: 'decisions', enabled: true, channels: ['in_app', 'push', 'email'], minimumPriority: 'low', batchable: false },
        { category: 'collaboration', enabled: true, channels: ['in_app'], minimumPriority: 'normal', batchable: true },
        { category: 'team', enabled: true, channels: ['in_app', 'push'], minimumPriority: 'low', batchable: true },
        { category: 'system', enabled: true, channels: ['in_app'], minimumPriority: 'high', batchable: false },
        { category: 'personal', enabled: true, channels: ['in_app', 'push'], minimumPriority: 'low', batchable: true },
      ],
      digestSettings: {
        enabled: true,
        frequency: 'daily',
        deliveryTime: '09:00',
        channels: ['email'],
        categories: ['signals', 'tasks', 'collaboration'],
        groupBy: 'category',
      },
      muteSettings: {
        mutedCategories: [],
        mutedTypes: [],
        mutedSources: [],
      },
      priorityOverrides: [],
    };
  }

  private shouldSendNotification(
    request: SendNotificationRequest,
    prefs: NotificationPreferences
  ): boolean {
    if (!prefs.globalEnabled) return false;

    // Check mute settings
    if (prefs.muteSettings.mutedUntil && prefs.muteSettings.mutedUntil > new Date()) {
      const category = this.getCategoryForType(request.type);
      if (prefs.muteSettings.mutedCategories.includes(category)) return false;
      if (prefs.muteSettings.mutedTypes.includes(request.type)) return false;
    }

    // Check quiet hours
    if (this.isQuietHours(prefs.quietHours)) {
      const priority = request.priority || 'normal';
      if (priority !== 'critical' || !prefs.quietHours.allowCritical) {
        return false;
      }
    }

    return true;
  }

  private isQuietHours(quietHours: QuietHours): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    if (!quietHours.daysOfWeek.includes(day)) return false;

    if (quietHours.startHour > quietHours.endHour) {
      // Overnight quiet hours
      return hour >= quietHours.startHour || hour < quietHours.endHour;
    } else {
      return hour >= quietHours.startHour && hour < quietHours.endHour;
    }
  }

  private getCategoryForType(type: NotificationType): NotificationCategory {
    const categoryMap: Record<NotificationType, NotificationCategory> = {
      signal_alert: 'signals',
      task_delegated: 'tasks',
      task_completed: 'tasks',
      decision_required: 'decisions',
      mention: 'collaboration',
      comment: 'collaboration',
      reaction: 'collaboration',
      deadline_approaching: 'tasks',
      goal_update: 'team',
      team_announcement: 'team',
      system_alert: 'system',
      invitation: 'collaboration',
      reminder: 'personal',
      digest: 'personal',
    };
    return categoryMap[type] || 'system';
  }

  private determinePriority(
    type: NotificationType,
    prefs: NotificationPreferences
  ): NotificationPriority {
    // Check for override
    const override = prefs.priorityOverrides.find(o => o.type === type);
    if (override) return override.overridePriority;

    // Default priorities
    const priorityMap: Record<NotificationType, NotificationPriority> = {
      signal_alert: 'high',
      task_delegated: 'normal',
      task_completed: 'low',
      decision_required: 'high',
      mention: 'normal',
      comment: 'normal',
      reaction: 'low',
      deadline_approaching: 'high',
      goal_update: 'normal',
      team_announcement: 'normal',
      system_alert: 'high',
      invitation: 'normal',
      reminder: 'normal',
      digest: 'low',
    };

    return priorityMap[type] || 'normal';
  }

  private determineChannels(
    type: NotificationType,
    priority: NotificationPriority,
    prefs: NotificationPreferences
  ): DeliveryChannel[] {
    const category = this.getCategoryForType(type);
    const catPref = prefs.categoryPreferences.find(c => c.category === category);

    if (catPref) {
      return catPref.channels.filter(channel => {
        const channelPref = prefs.channelPreferences.find(c => c.channel === channel);
        return channelPref?.enabled;
      });
    }

    // Default to in-app only
    return ['in_app'];
  }

  private shouldBatchForDigest(
    notification: Notification,
    prefs: NotificationPreferences
  ): boolean {
    if (!prefs.digestSettings.enabled) return false;
    if (!prefs.digestSettings.categories.includes(notification.category)) return false;

    const catPref = prefs.categoryPreferences.find(c => c.category === notification.category);
    if (!catPref?.batchable) return false;

    if (notification.priority === 'critical' || notification.priority === 'high') {
      return false;
    }

    return true;
  }

  private async addToDigestQueue(notification: Notification): Promise<void> {
    const queue = this.digestQueue.get(notification.userId) || [];
    queue.push(notification);
    this.digestQueue.set(notification.userId, queue);
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    for (let i = 0; i < notification.deliveryStatus.length; i++) {
      const delivery = notification.deliveryStatus[i];

      try {
        await this.deliverToChannel(notification, delivery.channel);
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
      } catch (error) {
        delivery.status = 'failed';
        delivery.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Update overall status
    const allDelivered = notification.deliveryStatus.every(d =>
      d.status === 'delivered'
    );
    const anyDelivered = notification.deliveryStatus.some(d =>
      d.status === 'delivered'
    );

    if (allDelivered || anyDelivered) {
      notification.status = 'delivered';
    } else {
      notification.status = 'failed';
    }

    this.emit('notification:delivered', { notification });
  }

  private async deliverToChannel(
    notification: Notification,
    channel: DeliveryChannel
  ): Promise<void> {
    // In a real implementation, this would integrate with actual delivery services
    switch (channel) {
      case 'push':
        this.emit('push:send', { notification });
        break;
      case 'email':
        this.emit('email:send', { notification });
        break;
      case 'in_app':
        // In-app notifications are stored and fetched via feed
        break;
      case 'sms':
        this.emit('sms:send', { notification });
        break;
      case 'slack':
        this.emit('slack:send', { notification });
        break;
      case 'webhook':
        this.emit('webhook:send', { notification });
        break;
    }
  }

  private groupNotifications(notifications: Notification[]): NotificationGroup[] {
    const groups = new Map<string, NotificationGroup>();

    for (const notification of notifications) {
      const groupKey = notification.groupId || notification.category;
      let group = groups.get(groupKey);

      if (!group) {
        group = {
          id: groupKey,
          userId: notification.userId,
          notifications: [],
          summary: '',
          count: 0,
          latestAt: notification.createdAt,
          category: notification.category,
        };
        groups.set(groupKey, group);
      }

      group.notifications.push(notification);
      group.count++;
      if (notification.createdAt > group.latestAt) {
        group.latestAt = notification.createdAt;
      }
    }

    // Generate summaries
    for (const group of groups.values()) {
      group.summary = `${group.count} ${group.category} notifications`;
    }

    return Array.from(groups.values()).sort((a, b) =>
      b.latestAt.getTime() - a.latestAt.getTime()
    );
  }

  private calculateHistoryStats(notifications: Notification[]): HistoryStats {
    const byStatus: Record<NotificationStatus, number> = {
      pending: 0,
      delivered: 0,
      read: 0,
      acted: 0,
      dismissed: 0,
      expired: 0,
      failed: 0,
    };

    const byCategory: Record<NotificationCategory, number> = {
      signals: 0,
      tasks: 0,
      decisions: 0,
      collaboration: 0,
      team: 0,
      system: 0,
      personal: 0,
    };

    const byChannel: Record<DeliveryChannel, number> = {
      push: 0,
      email: 0,
      in_app: 0,
      sms: 0,
      slack: 0,
      webhook: 0,
    };

    let totalReadTime = 0;
    let readCount = 0;
    let actedCount = 0;

    for (const notification of notifications) {
      byStatus[notification.status]++;
      byCategory[notification.category]++;

      for (const channel of notification.channels) {
        byChannel[channel]++;
      }

      if (notification.readAt) {
        totalReadTime += notification.readAt.getTime() - notification.createdAt.getTime();
        readCount++;
      }

      if (notification.status === 'acted') {
        actedCount++;
      }
    }

    return {
      total: notifications.length,
      byStatus,
      byCategory,
      byChannel,
      averageReadTime: readCount > 0 ? totalReadTime / readCount : 0,
      actionRate: notifications.length > 0 ? (actedCount / notifications.length) * 100 : 0,
    };
  }

  private getDigestPeriod(
    frequency: 'hourly' | 'daily' | 'weekly'
  ): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date(end);

    switch (frequency) {
      case 'hourly':
        start.setHours(start.getHours() - 1);
        break;
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
    }

    return { start, end };
  }

  private getCategoryTitle(category: NotificationCategory): string {
    const titles: Record<NotificationCategory, string> = {
      signals: 'Signals & Alerts',
      tasks: 'Tasks & Delegations',
      decisions: 'Decisions',
      collaboration: 'Collaboration',
      team: 'Team Updates',
      system: 'System',
      personal: 'Personal',
    };
    return titles[category];
  }

  private generateHighlights(notifications: Notification[]): string[] {
    const highlights: string[] = [];

    const critical = notifications.filter(n => n.priority === 'critical');
    if (critical.length > 0) {
      highlights.push(`${critical.length} critical notifications require attention`);
    }

    const unread = notifications.filter(n =>
      n.status === 'pending' || n.status === 'delivered'
    );
    if (unread.length > 0) {
      highlights.push(`${unread.length} unread notifications`);
    }

    return highlights;
  }

  private startDigestProcessor(): void {
    // In a real implementation, this would use a proper scheduler
    setInterval(async () => {
      for (const [userId, prefs] of this.preferences) {
        if (prefs.digestSettings.enabled) {
          const queue = this.digestQueue.get(userId);
          if (queue && queue.length > 0) {
            // Check if it's time to send digest
            const now = new Date();
            const [hour, minute] = prefs.digestSettings.deliveryTime.split(':').map(Number);

            if (now.getHours() === hour && now.getMinutes() === minute) {
              try {
                const digest = await this.generateDigest(userId);
                await this.sendNotification({
                  userId,
                  type: 'digest',
                  title: 'Your Daily Digest',
                  message: `${digest.summary.totalNotifications} notifications`,
                  data: { digest },
                  channels: prefs.digestSettings.channels,
                  bypassPreferences: true,
                });
              } catch (error) {
                console.error('Failed to send digest:', error);
              }
            }
          }
        }
      }
    }, 60000); // Check every minute
  }
}

export const notificationHubService = new NotificationHubService();
export default notificationHubService;
