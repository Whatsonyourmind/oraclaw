/**
 * ORACLE Productivity Analytics
 * Comprehensive productivity metrics and analysis
 */

// Types
export interface ProductivityMetrics {
  userId: string;
  period: DateRange;
  tasksCompleted: TaskCompletionMetrics;
  averageCompletionTime: CompletionTimeMetrics;
  onTimeDeliveryRate: DeliveryRateMetrics;
  focusTimePercentage: FocusMetrics;
  meetingLoad: MeetingLoadMetrics;
  contextSwitching: ContextSwitchMetrics;
  deepWorkHours: DeepWorkMetrics;
  overallScore: number;
  calculatedAt: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TaskCompletionMetrics {
  total: number;
  byDay: DailyCount[];
  byWeek: WeeklyCount[];
  byCategory: CategoryCount[];
  byPriority: PriorityCount[];
  trend: TrendInfo;
  comparison: PeriodComparison;
}

export interface DailyCount {
  date: string;
  count: number;
  breakdown?: Record<string, number>;
}

export interface WeeklyCount {
  weekStart: string;
  count: number;
  dailyAverage: number;
}

export interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

export interface PriorityCount {
  priority: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  percentage: number;
}

export interface TrendInfo {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  significance: 'significant' | 'moderate' | 'minimal';
}

export interface PeriodComparison {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  periodType: 'day' | 'week' | 'month';
}

export interface CompletionTimeMetrics {
  averageMinutes: number;
  medianMinutes: number;
  byCategory: CategoryTimeMetrics[];
  byPriority: PriorityTimeMetrics[];
  trend: TrendInfo;
  distribution: TimeDistribution;
}

export interface CategoryTimeMetrics {
  category: string;
  averageMinutes: number;
  taskCount: number;
}

export interface PriorityTimeMetrics {
  priority: string;
  averageMinutes: number;
  taskCount: number;
}

export interface TimeDistribution {
  buckets: TimeBucket[];
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
}

export interface TimeBucket {
  rangeLabel: string;
  minMinutes: number;
  maxMinutes: number;
  count: number;
  percentage: number;
}

export interface DeliveryRateMetrics {
  onTimeRate: number;
  earlyRate: number;
  lateRate: number;
  averageDaysEarly: number;
  averageDaysLate: number;
  byCategory: CategoryDeliveryRate[];
  trend: TrendInfo;
}

export interface CategoryDeliveryRate {
  category: string;
  onTimeRate: number;
  taskCount: number;
}

export interface FocusMetrics {
  totalFocusMinutes: number;
  focusPercentage: number;
  averageFocusSessionMinutes: number;
  longestFocusSessionMinutes: number;
  focusSessionCount: number;
  byDayOfWeek: DayOfWeekFocus[];
  byHour: HourlyFocus[];
  optimalFocusTime: string;
  trend: TrendInfo;
}

export interface DayOfWeekFocus {
  dayOfWeek: number;
  dayName: string;
  totalMinutes: number;
  percentage: number;
}

export interface HourlyFocus {
  hour: number;
  label: string;
  totalMinutes: number;
  sessionCount: number;
}

export interface MeetingLoadMetrics {
  totalMeetingMinutes: number;
  meetingPercentage: number;
  averageMeetingsPerDay: number;
  averageMeetingDuration: number;
  meetingsByDay: DailyMeetingLoad[];
  meetingsByType: MeetingTypeBreakdown[];
  longestMeetingFreeStretch: number;
  trend: TrendInfo;
  fragmentationScore: number;
}

export interface DailyMeetingLoad {
  date: string;
  meetingCount: number;
  totalMinutes: number;
  percentage: number;
}

export interface MeetingTypeBreakdown {
  type: string;
  count: number;
  totalMinutes: number;
  averageDuration: number;
}

export interface ContextSwitchMetrics {
  totalSwitches: number;
  averageSwitchesPerHour: number;
  averageTimeBetweenSwitches: number;
  switchesByHour: HourlySwitches[];
  costEstimate: ContextSwitchCost;
  trend: TrendInfo;
  recommendations: string[];
}

export interface HourlySwitches {
  hour: number;
  label: string;
  switchCount: number;
}

export interface ContextSwitchCost {
  estimatedLostMinutes: number;
  costPerSwitch: number;
  potentialRecovery: number;
}

export interface DeepWorkMetrics {
  totalDeepWorkMinutes: number;
  deepWorkPercentage: number;
  averageDeepWorkSessionMinutes: number;
  deepWorkSessionCount: number;
  byDayOfWeek: DayOfWeekDeepWork[];
  optimalDeepWorkTime: string;
  blocksOfDeepWork: DeepWorkBlock[];
  trend: TrendInfo;
  qualityScore: number;
}

export interface DayOfWeekDeepWork {
  dayOfWeek: number;
  dayName: string;
  totalMinutes: number;
  sessionCount: number;
}

export interface DeepWorkBlock {
  date: string;
  startTime: string;
  durationMinutes: number;
  tasksCmpleted: number;
}

// Task Data Types
export interface TaskData {
  id: string;
  userId: string;
  title: string;
  category?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
  completedAt?: Date;
  dueDate?: Date;
  estimatedMinutes?: number;
  actualMinutes?: number;
  tags: string[];
}

export interface FocusSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  taskId?: string;
  interrupted: boolean;
  interruptionCount: number;
}

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  type: 'one_on_one' | 'team' | 'external' | 'standup' | 'planning' | 'review' | 'other';
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  attendeeCount: number;
  isRecurring: boolean;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  timestamp: Date;
  activityType: string;
  contextId?: string;
}

// Productivity Analytics Service
export class ProductivityAnalytics {
  /**
   * Calculate comprehensive productivity metrics
   */
  async calculateMetrics(
    userId: string,
    period: DateRange,
    tasks: TaskData[],
    focusSessions: FocusSession[],
    meetings: Meeting[],
    activities: ActivityEvent[]
  ): Promise<ProductivityMetrics> {
    const previousPeriod = this.getPreviousPeriod(period);

    // Filter data for periods
    const currentTasks = this.filterByPeriod(tasks, period, 'completedAt');
    const previousTasks = this.filterByPeriod(tasks, previousPeriod, 'completedAt');

    const currentFocus = this.filterByPeriod(focusSessions, period, 'startTime');
    const previousFocus = this.filterByPeriod(focusSessions, previousPeriod, 'startTime');

    const currentMeetings = this.filterByPeriod(meetings, period, 'startTime');
    const previousMeetings = this.filterByPeriod(meetings, previousPeriod, 'startTime');

    const currentActivities = this.filterByPeriod(activities, period, 'timestamp');
    const previousActivities = this.filterByPeriod(activities, previousPeriod, 'timestamp');

    // Calculate all metrics
    const tasksCompleted = this.calculateTaskCompletion(currentTasks, previousTasks, period);
    const averageCompletionTime = this.calculateCompletionTime(currentTasks, previousTasks);
    const onTimeDeliveryRate = this.calculateDeliveryRate(currentTasks, previousTasks);
    const focusTimePercentage = this.calculateFocusMetrics(currentFocus, previousFocus, period);
    const meetingLoad = this.calculateMeetingLoad(currentMeetings, previousMeetings, period);
    const contextSwitching = this.calculateContextSwitching(currentActivities, previousActivities);
    const deepWorkHours = this.calculateDeepWork(currentFocus, previousFocus, currentTasks, period);

    // Calculate overall productivity score
    const overallScore = this.calculateOverallScore({
      tasksCompleted,
      averageCompletionTime,
      onTimeDeliveryRate,
      focusTimePercentage,
      meetingLoad,
      contextSwitching,
      deepWorkHours,
    });

    return {
      userId,
      period,
      tasksCompleted,
      averageCompletionTime,
      onTimeDeliveryRate,
      focusTimePercentage,
      meetingLoad,
      contextSwitching,
      deepWorkHours,
      overallScore,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate task completion metrics
   */
  private calculateTaskCompletion(
    currentTasks: TaskData[],
    previousTasks: TaskData[],
    period: DateRange
  ): TaskCompletionMetrics {
    // By day
    const byDay: DailyCount[] = [];
    const dayMap: Map<string, number> = new Map();

    currentTasks.forEach(task => {
      if (task.completedAt) {
        const dateKey = task.completedAt.toISOString().split('T')[0];
        dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + 1);
      }
    });

    dayMap.forEach((count, date) => {
      byDay.push({ date, count });
    });
    byDay.sort((a, b) => a.date.localeCompare(b.date));

    // By week
    const byWeek: WeeklyCount[] = [];
    const weekMap: Map<string, number[]> = new Map();

    currentTasks.forEach(task => {
      if (task.completedAt) {
        const weekStart = this.getWeekStart(task.completedAt);
        if (!weekMap.has(weekStart)) {
          weekMap.set(weekStart, []);
        }
        weekMap.get(weekStart)!.push(1);
      }
    });

    weekMap.forEach((days, weekStart) => {
      byWeek.push({
        weekStart,
        count: days.length,
        dailyAverage: days.length / 7,
      });
    });
    byWeek.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    // By category
    const categoryMap: Map<string, number> = new Map();
    currentTasks.forEach(task => {
      const category = task.category ?? 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
    });

    const byCategory: CategoryCount[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: (count / currentTasks.length) * 100,
    }));

    // By priority
    const priorityMap: Map<string, number> = new Map();
    currentTasks.forEach(task => {
      priorityMap.set(task.priority, (priorityMap.get(task.priority) ?? 0) + 1);
    });

    const byPriority: PriorityCount[] = (['critical', 'high', 'medium', 'low'] as const).map(priority => ({
      priority,
      count: priorityMap.get(priority) ?? 0,
      percentage: ((priorityMap.get(priority) ?? 0) / currentTasks.length) * 100,
    }));

    // Trend calculation
    const currentTotal = currentTasks.length;
    const previousTotal = previousTasks.length;
    const changePercent = previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent,
      significance: Math.abs(changePercent) > 20 ? 'significant' : Math.abs(changePercent) > 10 ? 'moderate' : 'minimal',
    };

    const comparison: PeriodComparison = {
      currentValue: currentTotal,
      previousValue: previousTotal,
      changePercent,
      periodType: 'week',
    };

    return {
      total: currentTotal,
      byDay,
      byWeek,
      byCategory,
      byPriority,
      trend,
      comparison,
    };
  }

  /**
   * Calculate average completion time metrics
   */
  private calculateCompletionTime(
    currentTasks: TaskData[],
    previousTasks: TaskData[]
  ): CompletionTimeMetrics {
    const tasksWithTime = currentTasks.filter(t => t.actualMinutes !== undefined);

    if (tasksWithTime.length === 0) {
      return {
        averageMinutes: 0,
        medianMinutes: 0,
        byCategory: [],
        byPriority: [],
        trend: { direction: 'stable', changePercent: 0, significance: 'minimal' },
        distribution: {
          buckets: [],
          percentile25: 0,
          percentile50: 0,
          percentile75: 0,
          percentile90: 0,
        },
      };
    }

    const times = tasksWithTime.map(t => t.actualMinutes!);
    const sortedTimes = [...times].sort((a, b) => a - b);

    const averageMinutes = times.reduce((a, b) => a + b, 0) / times.length;
    const medianMinutes = this.calculatePercentile(sortedTimes, 50);

    // By category
    const categoryGroups: Map<string, number[]> = new Map();
    tasksWithTime.forEach(task => {
      const category = task.category ?? 'Uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(task.actualMinutes!);
    });

    const byCategory: CategoryTimeMetrics[] = Array.from(categoryGroups.entries()).map(([category, times]) => ({
      category,
      averageMinutes: times.reduce((a, b) => a + b, 0) / times.length,
      taskCount: times.length,
    }));

    // By priority
    const priorityGroups: Map<string, number[]> = new Map();
    tasksWithTime.forEach(task => {
      if (!priorityGroups.has(task.priority)) {
        priorityGroups.set(task.priority, []);
      }
      priorityGroups.get(task.priority)!.push(task.actualMinutes!);
    });

    const byPriority: PriorityTimeMetrics[] = Array.from(priorityGroups.entries()).map(([priority, times]) => ({
      priority,
      averageMinutes: times.reduce((a, b) => a + b, 0) / times.length,
      taskCount: times.length,
    }));

    // Distribution
    const buckets: TimeBucket[] = [
      { rangeLabel: '0-15 min', minMinutes: 0, maxMinutes: 15, count: 0, percentage: 0 },
      { rangeLabel: '15-30 min', minMinutes: 15, maxMinutes: 30, count: 0, percentage: 0 },
      { rangeLabel: '30-60 min', minMinutes: 30, maxMinutes: 60, count: 0, percentage: 0 },
      { rangeLabel: '1-2 hours', minMinutes: 60, maxMinutes: 120, count: 0, percentage: 0 },
      { rangeLabel: '2-4 hours', minMinutes: 120, maxMinutes: 240, count: 0, percentage: 0 },
      { rangeLabel: '4+ hours', minMinutes: 240, maxMinutes: Infinity, count: 0, percentage: 0 },
    ];

    times.forEach(time => {
      const bucket = buckets.find(b => time >= b.minMinutes && time < b.maxMinutes);
      if (bucket) bucket.count++;
    });

    buckets.forEach(bucket => {
      bucket.percentage = (bucket.count / times.length) * 100;
    });

    const distribution: TimeDistribution = {
      buckets,
      percentile25: this.calculatePercentile(sortedTimes, 25),
      percentile50: this.calculatePercentile(sortedTimes, 50),
      percentile75: this.calculatePercentile(sortedTimes, 75),
      percentile90: this.calculatePercentile(sortedTimes, 90),
    };

    // Trend
    const previousTasksWithTime = previousTasks.filter(t => t.actualMinutes !== undefined);
    const previousAverage = previousTasksWithTime.length > 0
      ? previousTasksWithTime.reduce((sum, t) => sum + t.actualMinutes!, 0) / previousTasksWithTime.length
      : averageMinutes;

    const changePercent = previousAverage > 0
      ? ((averageMinutes - previousAverage) / previousAverage) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent < -5 ? 'up' : changePercent > 5 ? 'down' : 'stable', // Lower time is better
      changePercent: -changePercent, // Invert for display (positive = improvement)
      significance: Math.abs(changePercent) > 20 ? 'significant' : Math.abs(changePercent) > 10 ? 'moderate' : 'minimal',
    };

    return {
      averageMinutes,
      medianMinutes,
      byCategory,
      byPriority,
      trend,
      distribution,
    };
  }

  /**
   * Calculate on-time delivery rate
   */
  private calculateDeliveryRate(
    currentTasks: TaskData[],
    previousTasks: TaskData[]
  ): DeliveryRateMetrics {
    const tasksWithDeadline = currentTasks.filter(t => t.dueDate && t.completedAt);

    if (tasksWithDeadline.length === 0) {
      return {
        onTimeRate: 100,
        earlyRate: 0,
        lateRate: 0,
        averageDaysEarly: 0,
        averageDaysLate: 0,
        byCategory: [],
        trend: { direction: 'stable', changePercent: 0, significance: 'minimal' },
      };
    }

    let onTimeCount = 0;
    let earlyCount = 0;
    let lateCount = 0;
    let totalDaysEarly = 0;
    let totalDaysLate = 0;

    const categoryStats: Map<string, { onTime: number; total: number }> = new Map();

    tasksWithDeadline.forEach(task => {
      const dueDate = new Date(task.dueDate!);
      const completedDate = new Date(task.completedAt!);
      const diffDays = Math.floor((dueDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

      const category = task.category ?? 'Uncategorized';
      if (!categoryStats.has(category)) {
        categoryStats.set(category, { onTime: 0, total: 0 });
      }
      const stats = categoryStats.get(category)!;
      stats.total++;

      if (diffDays >= 0) {
        onTimeCount++;
        stats.onTime++;
        if (diffDays > 0) {
          earlyCount++;
          totalDaysEarly += diffDays;
        }
      } else {
        lateCount++;
        totalDaysLate += Math.abs(diffDays);
      }
    });

    const onTimeRate = (onTimeCount / tasksWithDeadline.length) * 100;
    const earlyRate = (earlyCount / tasksWithDeadline.length) * 100;
    const lateRate = (lateCount / tasksWithDeadline.length) * 100;

    const byCategory: CategoryDeliveryRate[] = Array.from(categoryStats.entries()).map(([category, stats]) => ({
      category,
      onTimeRate: (stats.onTime / stats.total) * 100,
      taskCount: stats.total,
    }));

    // Trend
    const previousTasksWithDeadline = previousTasks.filter(t => t.dueDate && t.completedAt);
    const previousOnTimeRate = previousTasksWithDeadline.length > 0
      ? (previousTasksWithDeadline.filter(t => {
          const dueDate = new Date(t.dueDate!);
          const completedDate = new Date(t.completedAt!);
          return completedDate <= dueDate;
        }).length / previousTasksWithDeadline.length) * 100
      : onTimeRate;

    const changePercent = previousOnTimeRate > 0
      ? ((onTimeRate - previousOnTimeRate) / previousOnTimeRate) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent,
      significance: Math.abs(changePercent) > 15 ? 'significant' : Math.abs(changePercent) > 7 ? 'moderate' : 'minimal',
    };

    return {
      onTimeRate,
      earlyRate,
      lateRate,
      averageDaysEarly: earlyCount > 0 ? totalDaysEarly / earlyCount : 0,
      averageDaysLate: lateCount > 0 ? totalDaysLate / lateCount : 0,
      byCategory,
      trend,
    };
  }

  /**
   * Calculate focus time metrics
   */
  private calculateFocusMetrics(
    currentSessions: FocusSession[],
    previousSessions: FocusSession[],
    period: DateRange
  ): FocusMetrics {
    const totalWorkMinutes = this.calculateWorkMinutesInPeriod(period);
    const totalFocusMinutes = currentSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const focusPercentage = (totalFocusMinutes / totalWorkMinutes) * 100;

    const averageFocusSessionMinutes = currentSessions.length > 0
      ? totalFocusMinutes / currentSessions.length
      : 0;

    const longestFocusSessionMinutes = currentSessions.length > 0
      ? Math.max(...currentSessions.map(s => s.durationMinutes))
      : 0;

    // By day of week
    const dayOfWeekMap: Map<number, number> = new Map();
    currentSessions.forEach(session => {
      const day = session.startTime.getDay();
      dayOfWeekMap.set(day, (dayOfWeekMap.get(day) ?? 0) + session.durationMinutes);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek: DayOfWeekFocus[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      dayName: dayNames[i],
      totalMinutes: dayOfWeekMap.get(i) ?? 0,
      percentage: ((dayOfWeekMap.get(i) ?? 0) / totalFocusMinutes) * 100,
    }));

    // By hour
    const hourMap: Map<number, { minutes: number; count: number }> = new Map();
    currentSessions.forEach(session => {
      const hour = session.startTime.getHours();
      const current = hourMap.get(hour) ?? { minutes: 0, count: 0 };
      hourMap.set(hour, {
        minutes: current.minutes + session.durationMinutes,
        count: current.count + 1,
      });
    });

    const byHour: HourlyFocus[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: this.formatHour(i),
      totalMinutes: hourMap.get(i)?.minutes ?? 0,
      sessionCount: hourMap.get(i)?.count ?? 0,
    }));

    // Find optimal focus time
    const maxFocusHour = byHour.reduce((max, h) => h.totalMinutes > max.totalMinutes ? h : max, byHour[0]);
    const optimalFocusTime = maxFocusHour.label;

    // Trend
    const previousTotalFocus = previousSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const changePercent = previousTotalFocus > 0
      ? ((totalFocusMinutes - previousTotalFocus) / previousTotalFocus) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent,
      significance: Math.abs(changePercent) > 20 ? 'significant' : Math.abs(changePercent) > 10 ? 'moderate' : 'minimal',
    };

    return {
      totalFocusMinutes,
      focusPercentage,
      averageFocusSessionMinutes,
      longestFocusSessionMinutes,
      focusSessionCount: currentSessions.length,
      byDayOfWeek,
      byHour,
      optimalFocusTime,
      trend,
    };
  }

  /**
   * Calculate meeting load metrics
   */
  private calculateMeetingLoad(
    currentMeetings: Meeting[],
    previousMeetings: Meeting[],
    period: DateRange
  ): MeetingLoadMetrics {
    const totalWorkMinutes = this.calculateWorkMinutesInPeriod(period);
    const totalMeetingMinutes = currentMeetings.reduce((sum, m) => sum + m.durationMinutes, 0);
    const meetingPercentage = (totalMeetingMinutes / totalWorkMinutes) * 100;

    const workDays = this.calculateWorkDaysInPeriod(period);
    const averageMeetingsPerDay = currentMeetings.length / workDays;
    const averageMeetingDuration = currentMeetings.length > 0
      ? totalMeetingMinutes / currentMeetings.length
      : 0;

    // By day
    const dayMap: Map<string, { count: number; minutes: number }> = new Map();
    currentMeetings.forEach(meeting => {
      const dateKey = meeting.startTime.toISOString().split('T')[0];
      const current = dayMap.get(dateKey) ?? { count: 0, minutes: 0 };
      dayMap.set(dateKey, {
        count: current.count + 1,
        minutes: current.minutes + meeting.durationMinutes,
      });
    });

    const meetingsByDay: DailyMeetingLoad[] = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      meetingCount: data.count,
      totalMinutes: data.minutes,
      percentage: (data.minutes / 480) * 100, // Assuming 8-hour workday
    }));

    // By type
    const typeMap: Map<string, { count: number; minutes: number }> = new Map();
    currentMeetings.forEach(meeting => {
      const current = typeMap.get(meeting.type) ?? { count: 0, minutes: 0 };
      typeMap.set(meeting.type, {
        count: current.count + 1,
        minutes: current.minutes + meeting.durationMinutes,
      });
    });

    const meetingsByType: MeetingTypeBreakdown[] = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      totalMinutes: data.minutes,
      averageDuration: data.minutes / data.count,
    }));

    // Calculate fragmentation score (how spread out meetings are)
    const fragmentationScore = this.calculateFragmentationScore(currentMeetings);

    // Calculate longest meeting-free stretch
    const longestMeetingFreeStretch = this.calculateLongestMeetingFreeStretch(currentMeetings);

    // Trend
    const previousTotalMinutes = previousMeetings.reduce((sum, m) => sum + m.durationMinutes, 0);
    const changePercent = previousTotalMinutes > 0
      ? ((totalMeetingMinutes - previousTotalMinutes) / previousTotalMinutes) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent < -5 ? 'up' : changePercent > 5 ? 'down' : 'stable', // Less meetings is better
      changePercent: -changePercent,
      significance: Math.abs(changePercent) > 20 ? 'significant' : Math.abs(changePercent) > 10 ? 'moderate' : 'minimal',
    };

    return {
      totalMeetingMinutes,
      meetingPercentage,
      averageMeetingsPerDay,
      averageMeetingDuration,
      meetingsByDay,
      meetingsByType,
      longestMeetingFreeStretch,
      trend,
      fragmentationScore,
    };
  }

  /**
   * Calculate context switching metrics
   */
  private calculateContextSwitching(
    currentActivities: ActivityEvent[],
    previousActivities: ActivityEvent[]
  ): ContextSwitchMetrics {
    const switches: Date[] = [];
    let lastContext: string | undefined;

    const sortedActivities = [...currentActivities].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    sortedActivities.forEach(activity => {
      if (lastContext && activity.contextId !== lastContext) {
        switches.push(activity.timestamp);
      }
      lastContext = activity.contextId;
    });

    const totalSwitches = switches.length;
    const workHours = this.calculateWorkHoursFromActivities(sortedActivities);
    const averageSwitchesPerHour = workHours > 0 ? totalSwitches / workHours : 0;

    // Time between switches
    let totalTimeBetween = 0;
    for (let i = 1; i < switches.length; i++) {
      totalTimeBetween += switches[i].getTime() - switches[i - 1].getTime();
    }
    const averageTimeBetweenSwitches = switches.length > 1
      ? totalTimeBetween / (switches.length - 1) / 60000 // Convert to minutes
      : 0;

    // By hour
    const hourMap: Map<number, number> = new Map();
    switches.forEach(switchTime => {
      const hour = switchTime.getHours();
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
    });

    const switchesByHour: HourlySwitches[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: this.formatHour(i),
      switchCount: hourMap.get(i) ?? 0,
    }));

    // Cost estimate (research suggests ~23 minutes lost per context switch)
    const costPerSwitch = 23;
    const estimatedLostMinutes = totalSwitches * costPerSwitch;
    const potentialRecovery = estimatedLostMinutes * 0.3; // Potential to recover 30%

    const costEstimate: ContextSwitchCost = {
      estimatedLostMinutes,
      costPerSwitch,
      potentialRecovery,
    };

    // Recommendations
    const recommendations: string[] = [];
    if (averageSwitchesPerHour > 5) {
      recommendations.push('Consider batching similar tasks to reduce context switches');
    }
    if (averageTimeBetweenSwitches < 15) {
      recommendations.push('Try to maintain focus for at least 25 minutes before switching tasks');
    }

    // Trend
    const previousSwitches = this.countContextSwitches(previousActivities);
    const changePercent = previousSwitches > 0
      ? ((totalSwitches - previousSwitches) / previousSwitches) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent < -5 ? 'up' : changePercent > 5 ? 'down' : 'stable',
      changePercent: -changePercent,
      significance: Math.abs(changePercent) > 20 ? 'significant' : Math.abs(changePercent) > 10 ? 'moderate' : 'minimal',
    };

    return {
      totalSwitches,
      averageSwitchesPerHour,
      averageTimeBetweenSwitches,
      switchesByHour,
      costEstimate,
      trend,
      recommendations,
    };
  }

  /**
   * Calculate deep work metrics
   */
  private calculateDeepWork(
    currentSessions: FocusSession[],
    previousSessions: FocusSession[],
    tasks: TaskData[],
    period: DateRange
  ): DeepWorkMetrics {
    // Deep work = uninterrupted focus sessions >= 45 minutes
    const deepWorkSessions = currentSessions.filter(
      s => !s.interrupted && s.durationMinutes >= 45
    );

    const totalDeepWorkMinutes = deepWorkSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalWorkMinutes = this.calculateWorkMinutesInPeriod(period);
    const deepWorkPercentage = (totalDeepWorkMinutes / totalWorkMinutes) * 100;

    const averageDeepWorkSessionMinutes = deepWorkSessions.length > 0
      ? totalDeepWorkMinutes / deepWorkSessions.length
      : 0;

    // By day of week
    const dayOfWeekMap: Map<number, { minutes: number; count: number }> = new Map();
    deepWorkSessions.forEach(session => {
      const day = session.startTime.getDay();
      const current = dayOfWeekMap.get(day) ?? { minutes: 0, count: 0 };
      dayOfWeekMap.set(day, {
        minutes: current.minutes + session.durationMinutes,
        count: current.count + 1,
      });
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek: DayOfWeekDeepWork[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      dayName: dayNames[i],
      totalMinutes: dayOfWeekMap.get(i)?.minutes ?? 0,
      sessionCount: dayOfWeekMap.get(i)?.count ?? 0,
    }));

    // Find optimal deep work time
    const hourMap: Map<number, number> = new Map();
    deepWorkSessions.forEach(session => {
      const hour = session.startTime.getHours();
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + session.durationMinutes);
    });

    let maxHour = 9;
    let maxMinutes = 0;
    hourMap.forEach((minutes, hour) => {
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        maxHour = hour;
      }
    });
    const optimalDeepWorkTime = this.formatHour(maxHour);

    // Deep work blocks
    const blocksOfDeepWork: DeepWorkBlock[] = deepWorkSessions.map(session => {
      const tasksInSession = tasks.filter(t =>
        t.completedAt &&
        t.completedAt >= session.startTime &&
        t.completedAt <= session.endTime
      );

      return {
        date: session.startTime.toISOString().split('T')[0],
        startTime: this.formatHour(session.startTime.getHours()),
        durationMinutes: session.durationMinutes,
        tasksCmpleted: tasksInSession.length,
      };
    });

    // Quality score based on session length and productivity
    const qualityScore = this.calculateDeepWorkQuality(deepWorkSessions, tasks);

    // Trend
    const previousDeepWork = previousSessions.filter(
      s => !s.interrupted && s.durationMinutes >= 45
    );
    const previousTotalMinutes = previousDeepWork.reduce((sum, s) => sum + s.durationMinutes, 0);
    const changePercent = previousTotalMinutes > 0
      ? ((totalDeepWorkMinutes - previousTotalMinutes) / previousTotalMinutes) * 100
      : 0;

    const trend: TrendInfo = {
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent,
      significance: Math.abs(changePercent) > 20 ? 'significant' : Math.abs(changePercent) > 10 ? 'moderate' : 'minimal',
    };

    return {
      totalDeepWorkMinutes,
      deepWorkPercentage,
      averageDeepWorkSessionMinutes,
      deepWorkSessionCount: deepWorkSessions.length,
      byDayOfWeek,
      optimalDeepWorkTime,
      blocksOfDeepWork,
      trend,
      qualityScore,
    };
  }

  /**
   * Calculate overall productivity score
   */
  private calculateOverallScore(metrics: {
    tasksCompleted: TaskCompletionMetrics;
    averageCompletionTime: CompletionTimeMetrics;
    onTimeDeliveryRate: DeliveryRateMetrics;
    focusTimePercentage: FocusMetrics;
    meetingLoad: MeetingLoadMetrics;
    contextSwitching: ContextSwitchMetrics;
    deepWorkHours: DeepWorkMetrics;
  }): number {
    // Weighted scoring
    const weights = {
      tasksCompleted: 0.2,
      completionEfficiency: 0.15,
      onTimeDelivery: 0.2,
      focusTime: 0.15,
      meetingBalance: 0.1,
      contextSwitching: 0.1,
      deepWork: 0.1,
    };

    // Normalize scores to 0-100
    const taskScore = Math.min(100, (metrics.tasksCompleted.total / 30) * 100); // 30 tasks/period = 100
    const efficiencyScore = Math.min(100, 100 - (metrics.averageCompletionTime.averageMinutes / 60) * 10);
    const deliveryScore = metrics.onTimeDeliveryRate.onTimeRate;
    const focusScore = metrics.focusTimePercentage.focusPercentage;
    const meetingScore = 100 - Math.min(100, metrics.meetingLoad.meetingPercentage * 2);
    const switchScore = 100 - Math.min(100, metrics.contextSwitching.averageSwitchesPerHour * 10);
    const deepWorkScore = Math.min(100, metrics.deepWorkHours.deepWorkPercentage * 5);

    const overallScore = Math.round(
      taskScore * weights.tasksCompleted +
      efficiencyScore * weights.completionEfficiency +
      deliveryScore * weights.onTimeDelivery +
      focusScore * weights.focusTime +
      meetingScore * weights.meetingBalance +
      switchScore * weights.contextSwitching +
      deepWorkScore * weights.deepWork
    );

    return Math.max(0, Math.min(100, overallScore));
  }

  // Helper methods
  private getPreviousPeriod(period: DateRange): DateRange {
    const duration = period.end.getTime() - period.start.getTime();
    return {
      start: new Date(period.start.getTime() - duration),
      end: new Date(period.end.getTime() - duration),
    };
  }

  private filterByPeriod<T extends Record<string, any>>(
    items: T[],
    period: DateRange,
    dateField: keyof T
  ): T[] {
    return items.filter(item => {
      const date = item[dateField];
      if (!date) return false;
      const d = new Date(date);
      return d >= period.start && d <= period.end;
    });
  }

  private getWeekStart(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  }

  private calculateWorkMinutesInPeriod(period: DateRange): number {
    const days = Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));
    const workDays = Math.ceil(days * (5 / 7)); // Approximate work days
    return workDays * 8 * 60; // 8 hours per work day
  }

  private calculateWorkDaysInPeriod(period: DateRange): number {
    const days = Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.ceil(days * (5 / 7));
  }

  private calculateFragmentationScore(meetings: Meeting[]): number {
    if (meetings.length === 0) return 0;

    // Group by day
    const dayGroups: Map<string, Meeting[]> = new Map();
    meetings.forEach(m => {
      const dateKey = m.startTime.toISOString().split('T')[0];
      if (!dayGroups.has(dateKey)) {
        dayGroups.set(dateKey, []);
      }
      dayGroups.get(dateKey)!.push(m);
    });

    // Calculate average gaps between meetings per day
    let totalFragmentation = 0;
    dayGroups.forEach(dayMeetings => {
      if (dayMeetings.length > 1) {
        const sorted = dayMeetings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        let gaps = 0;
        for (let i = 1; i < sorted.length; i++) {
          const gap = (sorted[i].startTime.getTime() - sorted[i - 1].endTime.getTime()) / 60000;
          if (gap > 0 && gap < 60) gaps++; // Small gaps = high fragmentation
        }
        totalFragmentation += gaps / (sorted.length - 1);
      }
    });

    return Math.min(100, (totalFragmentation / dayGroups.size) * 100);
  }

  private calculateLongestMeetingFreeStretch(meetings: Meeting[]): number {
    if (meetings.length === 0) return 480; // Full workday

    const sorted = [...meetings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    let maxStretch = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i].startTime.getTime() - sorted[i - 1].endTime.getTime()) / 60000;
      maxStretch = Math.max(maxStretch, gap);
    }

    return maxStretch;
  }

  private calculateWorkHoursFromActivities(activities: ActivityEvent[]): number {
    if (activities.length < 2) return 0;

    const first = activities[0].timestamp.getTime();
    const last = activities[activities.length - 1].timestamp.getTime();

    return (last - first) / (1000 * 60 * 60);
  }

  private countContextSwitches(activities: ActivityEvent[]): number {
    let switches = 0;
    let lastContext: string | undefined;

    const sorted = [...activities].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    sorted.forEach(activity => {
      if (lastContext && activity.contextId !== lastContext) {
        switches++;
      }
      lastContext = activity.contextId;
    });

    return switches;
  }

  private calculateDeepWorkQuality(sessions: FocusSession[], tasks: TaskData[]): number {
    if (sessions.length === 0) return 0;

    let totalQuality = 0;

    sessions.forEach(session => {
      const tasksCompleted = tasks.filter(t =>
        t.completedAt &&
        t.completedAt >= session.startTime &&
        t.completedAt <= session.endTime
      ).length;

      // Quality based on session length and tasks completed
      const lengthScore = Math.min(100, (session.durationMinutes / 90) * 100);
      const productivityScore = Math.min(100, tasksCompleted * 25);
      const interruptionPenalty = session.interrupted ? 20 : 0;

      totalQuality += (lengthScore + productivityScore) / 2 - interruptionPenalty;
    });

    return Math.max(0, Math.min(100, totalQuality / sessions.length));
  }
}

// Export singleton instance
export const productivityAnalytics = new ProductivityAnalytics();

export default ProductivityAnalytics;
