/**
 * ORACLE Goal Tracker Service
 * Comprehensive goal management with OKR support and hierarchical tracking
 *
 * Features:
 * - OKR (Objectives & Key Results) support
 * - Goal hierarchy (yearly > quarterly > monthly > weekly)
 * - Progress tracking
 * - Goal-to-task linking
 * - Milestone celebrations
 * - Goal reflection prompts
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type GoalTimeframe = 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'custom';
export type GoalStatus = 'not_started' | 'in_progress' | 'at_risk' | 'on_track' | 'completed' | 'abandoned';
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalCategory = 'career' | 'health' | 'finance' | 'learning' | 'relationships' | 'personal' | 'projects' | 'other';
export type KeyResultType = 'number' | 'percentage' | 'currency' | 'boolean' | 'milestone';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  timeframe: GoalTimeframe;
  priority: GoalPriority;
  status: GoalStatus;
  parent_goal_id?: string; // For hierarchical goals
  start_date: string;
  target_date: string;
  completed_date?: string;
  progress: number; // 0-100
  key_results: KeyResult[];
  milestones: Milestone[];
  linked_task_ids: string[];
  linked_habit_ids: string[];
  tags: string[];
  reflection?: GoalReflection;
  is_public: boolean;
  color?: string;
  icon?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface KeyResult {
  id: string;
  goal_id: string;
  title: string;
  description?: string;
  type: KeyResultType;
  target_value: number;
  current_value: number;
  unit?: string;
  progress: number; // 0-100
  weight: number; // Contribution to goal progress (0-1)
  due_date?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'missed';
  updates: KeyResultUpdate[];
  created_at: string;
  updated_at: string;
}

export interface KeyResultUpdate {
  id: string;
  value: number;
  notes?: string;
  timestamp: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description?: string;
  target_date: string;
  completed_date?: string;
  is_completed: boolean;
  celebration_shown: boolean;
  order: number;
  created_at: string;
}

export interface GoalReflection {
  what_went_well: string[];
  what_could_improve: string[];
  lessons_learned: string[];
  next_steps: string[];
  satisfaction_score: number; // 1-10
  would_set_again: boolean;
  reflection_date: string;
}

export interface GoalProgress {
  goal_id: string;
  date: string;
  progress: number;
  key_results_progress: Array<{
    key_result_id: string;
    progress: number;
  }>;
  notes?: string;
}

export interface GoalStats {
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  abandoned_goals: number;
  completion_rate: number;
  average_progress: number;
  goals_by_category: Record<GoalCategory, number>;
  goals_by_timeframe: Record<GoalTimeframe, number>;
  goals_at_risk: number;
  on_track_goals: number;
  upcoming_milestones: Milestone[];
  overdue_goals: Goal[];
  streak_days: number;
}

export interface ReflectionPrompt {
  id: string;
  prompt: string;
  category: 'progress' | 'obstacles' | 'learnings' | 'gratitude' | 'next_steps';
  goal_context?: string;
}

export interface GoalSuggestion {
  title: string;
  description: string;
  category: GoalCategory;
  timeframe: GoalTimeframe;
  suggested_key_results: string[];
  reason: string;
}

export interface GoalTrackerSettings {
  user_id: string;
  weekly_review_day: number; // 0-6
  weekly_review_time: string; // HH:mm
  monthly_review_day: number; // 1-28
  quarterly_review_enabled: boolean;
  reminder_enabled: boolean;
  reminder_frequency: 'daily' | 'weekly' | 'none';
  celebration_enabled: boolean;
  reflection_prompts_enabled: boolean;
  updated_at: string;
}

// Constants
const CATEGORY_COLORS: Record<GoalCategory, string> = {
  career: '#2196F3',
  health: '#E91E63',
  finance: '#4CAF50',
  learning: '#9C27B0',
  relationships: '#FF9800',
  personal: '#00BCD4',
  projects: '#3F51B5',
  other: '#607D8B',
};

const CATEGORY_ICONS: Record<GoalCategory, string> = {
  career: 'briefcase',
  health: 'heart',
  finance: 'cash',
  learning: 'school',
  relationships: 'people',
  personal: 'person',
  projects: 'folder',
  other: 'flag',
};

const CACHE_TTL = {
  goal: 30 * 1000,
  stats: 5 * 60 * 1000,
  settings: 10 * 60 * 1000,
};

const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  { id: 'p1', prompt: 'What progress have you made toward this goal this week?', category: 'progress' },
  { id: 'p2', prompt: 'What obstacles are preventing you from making more progress?', category: 'obstacles' },
  { id: 'p3', prompt: 'What have you learned while working toward this goal?', category: 'learnings' },
  { id: 'p4', prompt: 'What are you grateful for in your journey toward this goal?', category: 'gratitude' },
  { id: 'p5', prompt: 'What is one thing you can do tomorrow to move closer to this goal?', category: 'next_steps' },
  { id: 'p6', prompt: 'If you could start this goal over, what would you do differently?', category: 'learnings' },
  { id: 'p7', prompt: 'Who has helped you with this goal and how can you thank them?', category: 'gratitude' },
  { id: 'p8', prompt: 'What skills have you developed while pursuing this goal?', category: 'learnings' },
  { id: 'p9', prompt: 'Is this goal still aligned with your values and priorities?', category: 'progress' },
  { id: 'p10', prompt: 'What would achieving this goal mean for your life?', category: 'next_steps' },
];

// ============================================================================
// Goal Tracker Service
// ============================================================================

export class GoalTrackerService {
  // In-memory stores
  private goals: Map<string, Goal[]> = new Map();
  private progressHistory: Map<string, GoalProgress[]> = new Map();
  private settings: Map<string, GoalTrackerSettings> = new Map();

  // ============================================================================
  // Goal Management
  // ============================================================================

  /**
   * Create a new goal
   */
  async createGoal(
    userId: string,
    goal: Omit<Goal, 'id' | 'user_id' | 'status' | 'progress' | 'key_results' | 'milestones' | 'linked_task_ids' | 'linked_habit_ids' | 'created_at' | 'updated_at'>
  ): Promise<Goal> {
    const now = new Date().toISOString();

    const newGoal: Goal = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...goal,
      status: 'not_started',
      progress: 0,
      key_results: [],
      milestones: [],
      linked_task_ids: [],
      linked_habit_ids: [],
      color: goal.color || CATEGORY_COLORS[goal.category],
      icon: goal.icon || CATEGORY_ICONS[goal.category],
      metadata: goal.metadata || {},
      created_at: now,
      updated_at: now,
    };

    const userGoals = this.goals.get(userId) || [];
    userGoals.push(newGoal);
    this.goals.set(userId, userGoals);

    oracleCacheService.deleteByPrefix(`goal:${userId}`);

    return newGoal;
  }

  /**
   * Get all goals for a user
   */
  async getGoals(
    userId: string,
    options: {
      status?: GoalStatus;
      category?: GoalCategory;
      timeframe?: GoalTimeframe;
      parent_id?: string;
      includeCompleted?: boolean;
    } = {}
  ): Promise<Goal[]> {
    let goals = this.goals.get(userId) || [];

    if (options.status) {
      goals = goals.filter((g) => g.status === options.status);
    } else if (!options.includeCompleted) {
      goals = goals.filter((g) => g.status !== 'completed' && g.status !== 'abandoned');
    }

    if (options.category) {
      goals = goals.filter((g) => g.category === options.category);
    }

    if (options.timeframe) {
      goals = goals.filter((g) => g.timeframe === options.timeframe);
    }

    if (options.parent_id !== undefined) {
      goals = goals.filter((g) => g.parent_goal_id === options.parent_id);
    }

    return goals;
  }

  /**
   * Get a single goal
   */
  async getGoal(userId: string, goalId: string): Promise<Goal | null> {
    const goals = this.goals.get(userId) || [];
    return goals.find((g) => g.id === goalId) || null;
  }

  /**
   * Update a goal
   */
  async updateGoal(
    userId: string,
    goalId: string,
    updates: Partial<Omit<Goal, 'id' | 'user_id' | 'created_at'>>
  ): Promise<Goal | null> {
    const userGoals = this.goals.get(userId) || [];
    const goalIndex = userGoals.findIndex((g) => g.id === goalId);

    if (goalIndex === -1) {
      return null;
    }

    const updatedGoal = {
      ...userGoals[goalIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    userGoals[goalIndex] = updatedGoal;
    this.goals.set(userId, userGoals);

    oracleCacheService.deleteByPrefix(`goal:${userId}`);

    return updatedGoal;
  }

  /**
   * Delete a goal
   */
  async deleteGoal(userId: string, goalId: string): Promise<boolean> {
    const userGoals = this.goals.get(userId) || [];
    const goalIndex = userGoals.findIndex((g) => g.id === goalId);

    if (goalIndex === -1) {
      return false;
    }

    userGoals.splice(goalIndex, 1);
    this.goals.set(userId, userGoals);

    oracleCacheService.deleteByPrefix(`goal:${userId}`);

    return true;
  }

  /**
   * Complete a goal
   */
  async completeGoal(userId: string, goalId: string): Promise<Goal | null> {
    const now = new Date().toISOString();
    return this.updateGoal(userId, goalId, {
      status: 'completed',
      progress: 100,
      completed_date: now,
    });
  }

  /**
   * Abandon a goal
   */
  async abandonGoal(userId: string, goalId: string, reason?: string): Promise<Goal | null> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return null;

    return this.updateGoal(userId, goalId, {
      status: 'abandoned',
      metadata: { ...goal.metadata, abandon_reason: reason },
    });
  }

  // ============================================================================
  // Key Results
  // ============================================================================

  /**
   * Add a key result to a goal
   */
  async addKeyResult(
    userId: string,
    goalId: string,
    keyResult: Omit<KeyResult, 'id' | 'goal_id' | 'progress' | 'status' | 'updates' | 'created_at' | 'updated_at'>
  ): Promise<KeyResult> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const now = new Date().toISOString();

    const newKeyResult: KeyResult = {
      id: crypto.randomUUID(),
      goal_id: goalId,
      ...keyResult,
      progress: keyResult.type === 'boolean' ? 0 : Math.round((keyResult.current_value / keyResult.target_value) * 100),
      status: keyResult.current_value === 0 ? 'not_started' : keyResult.current_value >= keyResult.target_value ? 'completed' : 'in_progress',
      updates: [],
      created_at: now,
      updated_at: now,
    };

    goal.key_results.push(newKeyResult);
    await this.updateGoalProgress(userId, goalId);

    return newKeyResult;
  }

  /**
   * Update a key result
   */
  async updateKeyResult(
    userId: string,
    goalId: string,
    keyResultId: string,
    value: number,
    notes?: string
  ): Promise<KeyResult | null> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return null;

    const keyResult = goal.key_results.find((kr) => kr.id === keyResultId);
    if (!keyResult) return null;

    const now = new Date().toISOString();

    // Record update
    keyResult.updates.push({
      id: crypto.randomUUID(),
      value,
      notes,
      timestamp: now,
    });

    // Update current value and progress
    keyResult.current_value = value;
    keyResult.progress = keyResult.type === 'boolean'
      ? (value >= keyResult.target_value ? 100 : 0)
      : Math.min(100, Math.round((value / keyResult.target_value) * 100));

    // Update status
    if (keyResult.progress >= 100) {
      keyResult.status = 'completed';
    } else if (keyResult.due_date && new Date(keyResult.due_date) < new Date()) {
      keyResult.status = 'missed';
    } else if (keyResult.progress > 0) {
      keyResult.status = 'in_progress';
    }

    keyResult.updated_at = now;

    await this.updateGoal(userId, goalId, { key_results: goal.key_results });
    await this.updateGoalProgress(userId, goalId);

    return keyResult;
  }

  /**
   * Delete a key result
   */
  async deleteKeyResult(userId: string, goalId: string, keyResultId: string): Promise<boolean> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return false;

    const index = goal.key_results.findIndex((kr) => kr.id === keyResultId);
    if (index === -1) return false;

    goal.key_results.splice(index, 1);
    await this.updateGoal(userId, goalId, { key_results: goal.key_results });
    await this.updateGoalProgress(userId, goalId);

    return true;
  }

  // ============================================================================
  // Milestones
  // ============================================================================

  /**
   * Add a milestone to a goal
   */
  async addMilestone(
    userId: string,
    goalId: string,
    milestone: Omit<Milestone, 'id' | 'goal_id' | 'is_completed' | 'celebration_shown' | 'completed_date' | 'created_at'>
  ): Promise<Milestone> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const now = new Date().toISOString();

    const newMilestone: Milestone = {
      id: crypto.randomUUID(),
      goal_id: goalId,
      ...milestone,
      is_completed: false,
      celebration_shown: false,
      created_at: now,
    };

    goal.milestones.push(newMilestone);
    goal.milestones.sort((a, b) => a.order - b.order);

    await this.updateGoal(userId, goalId, { milestones: goal.milestones });

    return newMilestone;
  }

  /**
   * Complete a milestone
   */
  async completeMilestone(userId: string, goalId: string, milestoneId: string): Promise<{
    milestone: Milestone;
    celebration: string;
  }> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const milestone = goal.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    const now = new Date().toISOString();
    milestone.is_completed = true;
    milestone.completed_date = now;
    milestone.celebration_shown = true;

    await this.updateGoal(userId, goalId, { milestones: goal.milestones });

    // Generate celebration message
    const celebrationMessages = [
      `You reached "${milestone.title}"! Amazing progress on "${goal.title}"!`,
      `Milestone achieved! "${milestone.title}" is done! Keep the momentum going!`,
      `Congratulations! You've completed "${milestone.title}". You're one step closer to your goal!`,
      `"${milestone.title}" - DONE! You're making incredible progress!`,
    ];

    return {
      milestone,
      celebration: celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)],
    };
  }

  /**
   * Get upcoming milestones across all goals
   */
  async getUpcomingMilestones(userId: string, days: number = 7): Promise<Array<{
    milestone: Milestone;
    goal: Goal;
    daysUntil: number;
  }>> {
    const goals = await this.getGoals(userId);
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcoming: Array<{ milestone: Milestone; goal: Goal; daysUntil: number }> = [];

    for (const goal of goals) {
      for (const milestone of goal.milestones) {
        if (milestone.is_completed) continue;

        const targetDate = new Date(milestone.target_date);
        if (targetDate >= now && targetDate <= futureDate) {
          const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          upcoming.push({ milestone, goal, daysUntil });
        }
      }
    }

    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  // ============================================================================
  // Progress Tracking
  // ============================================================================

  /**
   * Update goal progress based on key results
   */
  private async updateGoalProgress(userId: string, goalId: string): Promise<void> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return;

    if (goal.key_results.length === 0) {
      return;
    }

    // Calculate weighted progress
    const totalWeight = goal.key_results.reduce((sum, kr) => sum + kr.weight, 0);
    const weightedProgress = goal.key_results.reduce(
      (sum, kr) => sum + (kr.progress * kr.weight),
      0
    );

    const progress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

    // Determine status
    let status: GoalStatus = goal.status;
    if (progress === 0) {
      status = 'not_started';
    } else if (progress >= 100) {
      status = 'completed';
    } else {
      // Check if on track
      const now = new Date();
      const start = new Date(goal.start_date);
      const target = new Date(goal.target_date);
      const totalDays = (target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      const elapsedDays = (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      const expectedProgress = (elapsedDays / totalDays) * 100;

      if (progress >= expectedProgress * 0.8) {
        status = 'on_track';
      } else if (progress >= expectedProgress * 0.5) {
        status = 'in_progress';
      } else {
        status = 'at_risk';
      }
    }

    await this.updateGoal(userId, goalId, { progress, status });

    // Record progress snapshot
    await this.recordProgress(userId, goalId, progress);
  }

  /**
   * Record progress snapshot
   */
  private async recordProgress(userId: string, goalId: string, progress: number): Promise<void> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return;

    const today = new Date().toISOString().split('T')[0];

    const progressEntry: GoalProgress = {
      goal_id: goalId,
      date: today,
      progress,
      key_results_progress: goal.key_results.map((kr) => ({
        key_result_id: kr.id,
        progress: kr.progress,
      })),
    };

    const history = this.progressHistory.get(userId) || [];

    // Update or add today's entry
    const existingIndex = history.findIndex(
      (p) => p.goal_id === goalId && p.date === today
    );

    if (existingIndex >= 0) {
      history[existingIndex] = progressEntry;
    } else {
      history.push(progressEntry);
    }

    this.progressHistory.set(userId, history);
  }

  /**
   * Get progress history for a goal
   */
  async getProgressHistory(
    userId: string,
    goalId: string,
    options: {
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<GoalProgress[]> {
    let history = (this.progressHistory.get(userId) || [])
      .filter((p) => p.goal_id === goalId);

    if (options.start_date) {
      history = history.filter((p) => p.date >= options.start_date!);
    }
    if (options.end_date) {
      history = history.filter((p) => p.date <= options.end_date!);
    }

    return history.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============================================================================
  // Goal Hierarchy
  // ============================================================================

  /**
   * Get goal hierarchy (parent with children)
   */
  async getGoalHierarchy(userId: string, goalId: string): Promise<{
    goal: Goal;
    children: Goal[];
    parent?: Goal;
  }> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const allGoals = await this.getGoals(userId, { includeCompleted: true });

    const children = allGoals.filter((g) => g.parent_goal_id === goalId);
    const parent = goal.parent_goal_id
      ? allGoals.find((g) => g.id === goal.parent_goal_id)
      : undefined;

    return { goal, children, parent };
  }

  /**
   * Get goal tree (full hierarchy from root)
   */
  async getGoalTree(userId: string, timeframe?: GoalTimeframe): Promise<Array<{
    goal: Goal;
    level: number;
    children: any[];
  }>> {
    const goals = await this.getGoals(userId, { timeframe, includeCompleted: true });

    const buildTree = (parentId: string | undefined, level: number): any[] => {
      return goals
        .filter((g) => g.parent_goal_id === parentId)
        .map((goal) => ({
          goal,
          level,
          children: buildTree(goal.id, level + 1),
        }));
    };

    return buildTree(undefined, 0);
  }

  // ============================================================================
  // Task & Habit Linking
  // ============================================================================

  /**
   * Link a task to a goal
   */
  async linkTask(userId: string, goalId: string, taskId: string): Promise<Goal | null> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return null;

    if (!goal.linked_task_ids.includes(taskId)) {
      goal.linked_task_ids.push(taskId);
      return this.updateGoal(userId, goalId, { linked_task_ids: goal.linked_task_ids });
    }

    return goal;
  }

  /**
   * Unlink a task from a goal
   */
  async unlinkTask(userId: string, goalId: string, taskId: string): Promise<Goal | null> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return null;

    goal.linked_task_ids = goal.linked_task_ids.filter((id) => id !== taskId);
    return this.updateGoal(userId, goalId, { linked_task_ids: goal.linked_task_ids });
  }

  /**
   * Link a habit to a goal
   */
  async linkHabit(userId: string, goalId: string, habitId: string): Promise<Goal | null> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return null;

    if (!goal.linked_habit_ids.includes(habitId)) {
      goal.linked_habit_ids.push(habitId);
      return this.updateGoal(userId, goalId, { linked_habit_ids: goal.linked_habit_ids });
    }

    return goal;
  }

  // ============================================================================
  // Reflections
  // ============================================================================

  /**
   * Add reflection to a goal
   */
  async addReflection(
    userId: string,
    goalId: string,
    reflection: Omit<GoalReflection, 'reflection_date'>
  ): Promise<Goal | null> {
    const fullReflection: GoalReflection = {
      ...reflection,
      reflection_date: new Date().toISOString(),
    };

    return this.updateGoal(userId, goalId, { reflection: fullReflection });
  }

  /**
   * Get reflection prompts for a goal
   */
  async getReflectionPrompts(userId: string, goalId: string): Promise<ReflectionPrompt[]> {
    const goal = await this.getGoal(userId, goalId);
    if (!goal) return [];

    // Select relevant prompts based on goal status
    let prompts = [...REFLECTION_PROMPTS];

    if (goal.status === 'at_risk') {
      prompts = prompts.filter((p) => p.category === 'obstacles' || p.category === 'next_steps');
    } else if (goal.status === 'completed') {
      prompts = prompts.filter((p) => p.category === 'learnings' || p.category === 'gratitude');
    }

    // Shuffle and take 3
    return prompts
      .map((p) => ({ ...p, goal_context: goal.title }))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get goal statistics
   */
  async getStats(userId: string): Promise<GoalStats> {
    const cacheKeyStr = cacheKey('goal_stats', userId);

    const cached = oracleCacheService.get<GoalStats>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const allGoals = await this.getGoals(userId, { includeCompleted: true });

    const activeGoals = allGoals.filter((g) =>
      !['completed', 'abandoned'].includes(g.status)
    );
    const completedGoals = allGoals.filter((g) => g.status === 'completed');
    const abandonedGoals = allGoals.filter((g) => g.status === 'abandoned');

    // Goals by category
    const goalsByCategory: Partial<Record<GoalCategory, number>> = {};
    allGoals.forEach((g) => {
      goalsByCategory[g.category] = (goalsByCategory[g.category] || 0) + 1;
    });

    // Goals by timeframe
    const goalsByTimeframe: Partial<Record<GoalTimeframe, number>> = {};
    allGoals.forEach((g) => {
      goalsByTimeframe[g.timeframe] = (goalsByTimeframe[g.timeframe] || 0) + 1;
    });

    // Goals at risk
    const goalsAtRisk = activeGoals.filter((g) => g.status === 'at_risk').length;
    const onTrackGoals = activeGoals.filter((g) => g.status === 'on_track').length;

    // Average progress
    const avgProgress = activeGoals.length > 0
      ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
      : 0;

    // Upcoming milestones
    const upcomingMilestones = (await this.getUpcomingMilestones(userId, 7))
      .map((u) => u.milestone);

    // Overdue goals
    const now = new Date().toISOString();
    const overdueGoals = activeGoals.filter((g) => g.target_date < now);

    // Calculate streak (days with goal activity)
    const history = this.progressHistory.get(userId) || [];
    let streakDays = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      if (history.some((p) => p.date === dateStr)) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    const stats: GoalStats = {
      total_goals: allGoals.length,
      active_goals: activeGoals.length,
      completed_goals: completedGoals.length,
      abandoned_goals: abandonedGoals.length,
      completion_rate: allGoals.length > 0
        ? Math.round((completedGoals.length / (completedGoals.length + abandonedGoals.length)) * 100) / 100
        : 0,
      average_progress: avgProgress,
      goals_by_category: goalsByCategory as Record<GoalCategory, number>,
      goals_by_timeframe: goalsByTimeframe as Record<GoalTimeframe, number>,
      goals_at_risk: goalsAtRisk,
      on_track_goals: onTrackGoals,
      upcoming_milestones: upcomingMilestones,
      overdue_goals: overdueGoals,
      streak_days: streakDays,
    };

    oracleCacheService.set(cacheKeyStr, stats, CACHE_TTL.stats);
    return stats;
  }

  // ============================================================================
  // Goal Suggestions
  // ============================================================================

  /**
   * Get goal suggestions based on user patterns
   */
  async getSuggestions(userId: string): Promise<GoalSuggestion[]> {
    const goals = await this.getGoals(userId, { includeCompleted: true });

    const suggestions: GoalSuggestion[] = [];

    // Check for missing categories
    const coveredCategories = new Set(goals.map((g) => g.category));
    const allCategories: GoalCategory[] = ['career', 'health', 'finance', 'learning', 'relationships', 'personal'];

    for (const category of allCategories) {
      if (!coveredCategories.has(category)) {
        const categoryTemplates = GOAL_TEMPLATES[category];
        if (categoryTemplates && categoryTemplates.length > 0) {
          const template = categoryTemplates[0];
          suggestions.push({
            title: template.title,
            description: template.description,
            category,
            timeframe: template.timeframe,
            suggested_key_results: template.keyResults,
            reason: `You don't have any ${category} goals. Consider adding one for balance.`,
          });
        }
      }
    }

    // Suggest quarterly goals if user has yearly goals
    const yearlyGoals = goals.filter((g) => g.timeframe === 'yearly' && g.status !== 'completed');
    if (yearlyGoals.length > 0 && !goals.some((g) => g.timeframe === 'quarterly')) {
      suggestions.push({
        title: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} milestone for "${yearlyGoals[0].title}"`,
        description: `Break down your yearly goal into quarterly milestones`,
        category: yearlyGoals[0].category,
        timeframe: 'quarterly',
        suggested_key_results: ['Define 3 key results for this quarter'],
        reason: 'Quarterly goals help break down yearly objectives into manageable chunks.',
      });
    }

    return suggestions.slice(0, 3);
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Get settings
   */
  async getSettings(userId: string): Promise<GoalTrackerSettings> {
    const cacheKeyStr = cacheKey('goal_settings', userId);

    const cached = oracleCacheService.get<GoalTrackerSettings>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let settings = this.settings.get(userId);

    if (!settings) {
      settings = {
        user_id: userId,
        weekly_review_day: 0, // Sunday
        weekly_review_time: '10:00',
        monthly_review_day: 1,
        quarterly_review_enabled: true,
        reminder_enabled: true,
        reminder_frequency: 'weekly',
        celebration_enabled: true,
        reflection_prompts_enabled: true,
        updated_at: new Date().toISOString(),
      };
      this.settings.set(userId, settings);
    }

    oracleCacheService.set(cacheKeyStr, settings, CACHE_TTL.settings);
    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    userId: string,
    updates: Partial<Omit<GoalTrackerSettings, 'user_id' | 'updated_at'>>
  ): Promise<GoalTrackerSettings> {
    const settings = await this.getSettings(userId);

    const updatedSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.settings.set(userId, updatedSettings);
    oracleCacheService.delete(cacheKey('goal_settings', userId));

    return updatedSettings;
  }
}

// Goal templates for suggestions
const GOAL_TEMPLATES: Record<GoalCategory, Array<{
  title: string;
  description: string;
  timeframe: GoalTimeframe;
  keyResults: string[];
}>> = {
  career: [
    {
      title: 'Get promoted to next level',
      description: 'Advance to the next level in my career',
      timeframe: 'yearly',
      keyResults: ['Complete 3 high-impact projects', 'Receive positive performance reviews', 'Develop 2 new skills'],
    },
  ],
  health: [
    {
      title: 'Improve physical fitness',
      description: 'Build a consistent exercise habit and improve overall health',
      timeframe: 'quarterly',
      keyResults: ['Exercise 3x per week', 'Lose/gain X pounds', 'Run a 5K'],
    },
  ],
  finance: [
    {
      title: 'Build emergency fund',
      description: 'Save 3-6 months of expenses for emergencies',
      timeframe: 'yearly',
      keyResults: ['Save $X per month', 'Reduce unnecessary expenses by 20%', 'Set up automatic transfers'],
    },
  ],
  learning: [
    {
      title: 'Master a new skill',
      description: 'Develop expertise in a new area',
      timeframe: 'quarterly',
      keyResults: ['Complete an online course', 'Build a portfolio project', 'Practice daily for 30 min'],
    },
  ],
  relationships: [
    {
      title: 'Strengthen key relationships',
      description: 'Invest more time in meaningful relationships',
      timeframe: 'quarterly',
      keyResults: ['Weekly quality time with family', 'Monthly meetup with friends', 'Send thoughtful messages weekly'],
    },
  ],
  personal: [
    {
      title: 'Develop a morning routine',
      description: 'Create a productive morning routine',
      timeframe: 'monthly',
      keyResults: ['Wake up at same time daily', 'Include exercise/meditation', 'No phone for first hour'],
    },
  ],
  projects: [],
  other: [],
};

// Singleton instance
export const goalTrackerService = new GoalTrackerService();
