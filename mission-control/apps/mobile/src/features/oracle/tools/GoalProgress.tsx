/**
 * GoalProgress Component
 * Goal tracking and progress visualization for ORACLE
 *
 * Features:
 * - Goal cards with progress bars
 * - Key results breakdown
 * - Milestone timeline
 * - Reflection prompts
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width } = Dimensions.get('window');

// Types
type GoalStatus = 'active' | 'completed' | 'paused' | 'at_risk';
type GoalType = 'objective' | 'key_result' | 'milestone';
type GoalTimeframe = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface KeyResult {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  progress: number;
}

interface Milestone {
  id: string;
  title: string;
  due_date: string;
  completed: boolean;
  completed_date?: string;
}

interface Reflection {
  id: string;
  date: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  type: GoalType;
  timeframe: GoalTimeframe;
  progress: number;
  color: string;
  icon: string;
  key_results: KeyResult[];
  milestones: Milestone[];
  parent_goal_id?: string;
  due_date: string;
  created_at: string;
  reflections: Reflection[];
}

interface GoalStats {
  total_goals: number;
  completed: number;
  on_track: number;
  at_risk: number;
  average_progress: number;
}

// Constants
const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; icon: string }> = {
  active: { label: 'Active', color: '#4CAF50', icon: 'play-circle' },
  completed: { label: 'Completed', color: '#2196F3', icon: 'checkmark-circle' },
  paused: { label: 'Paused', color: '#FF9800', icon: 'pause-circle' },
  at_risk: { label: 'At Risk', color: '#F44336', icon: 'alert-circle' },
};

const TIMEFRAME_LABELS: Record<GoalTimeframe, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  quarterly: 'This Quarter',
  yearly: 'This Year',
};

const REFLECTION_PROMPTS = [
  "What's one thing you learned while working on this goal?",
  "What obstacles have you faced? How did you overcome them?",
  "What would you do differently if starting over?",
  "How does this goal align with your bigger vision?",
  "What support or resources do you need to succeed?",
  "What small win can you celebrate today?",
];

// Mock data
const MOCK_GOALS: Goal[] = [
  {
    id: '1',
    title: 'Launch MVP Product',
    description: 'Successfully launch the minimum viable product to early adopters',
    status: 'active',
    type: 'objective',
    timeframe: 'quarterly',
    progress: 65,
    color: '#2196F3',
    icon: 'rocket',
    due_date: '2024-03-31',
    created_at: '2024-01-01',
    key_results: [
      { id: 'kr1', title: 'Complete core features', current_value: 8, target_value: 10, unit: 'features', progress: 80 },
      { id: 'kr2', title: 'Onboard beta users', current_value: 45, target_value: 100, unit: 'users', progress: 45 },
      { id: 'kr3', title: 'Achieve user satisfaction', current_value: 4.2, target_value: 4.5, unit: 'rating', progress: 93 },
    ],
    milestones: [
      { id: 'm1', title: 'Design complete', due_date: '2024-01-15', completed: true, completed_date: '2024-01-14' },
      { id: 'm2', title: 'Alpha release', due_date: '2024-02-01', completed: true, completed_date: '2024-02-03' },
      { id: 'm3', title: 'Beta launch', due_date: '2024-02-28', completed: false },
      { id: 'm4', title: 'Public launch', due_date: '2024-03-31', completed: false },
    ],
    reflections: [
      { id: 'r1', date: '2024-02-10', content: 'Making good progress on user feedback integration', sentiment: 'positive' },
    ],
  },
  {
    id: '2',
    title: 'Improve Fitness',
    description: 'Build consistent exercise habits and improve overall health',
    status: 'active',
    type: 'objective',
    timeframe: 'monthly',
    progress: 78,
    color: '#E91E63',
    icon: 'fitness',
    due_date: '2024-02-29',
    created_at: '2024-02-01',
    key_results: [
      { id: 'kr4', title: 'Weekly workouts', current_value: 3.5, target_value: 4, unit: 'sessions/week', progress: 87 },
      { id: 'kr5', title: 'Daily steps', current_value: 8500, target_value: 10000, unit: 'steps', progress: 85 },
      { id: 'kr6', title: 'Sleep hours', current_value: 6.8, target_value: 8, unit: 'hours', progress: 85 },
    ],
    milestones: [
      { id: 'm5', title: 'Establish routine', due_date: '2024-02-07', completed: true },
      { id: 'm6', title: 'Hit first target', due_date: '2024-02-14', completed: true },
      { id: 'm7', title: 'One month streak', due_date: '2024-02-29', completed: false },
    ],
    reflections: [],
  },
  {
    id: '3',
    title: 'Learn New Skills',
    description: 'Complete advanced certifications and expand technical knowledge',
    status: 'at_risk',
    type: 'objective',
    timeframe: 'quarterly',
    progress: 35,
    color: '#9C27B0',
    icon: 'school',
    due_date: '2024-03-31',
    created_at: '2024-01-01',
    key_results: [
      { id: 'kr7', title: 'Complete courses', current_value: 1, target_value: 3, unit: 'courses', progress: 33 },
      { id: 'kr8', title: 'Practice hours', current_value: 20, target_value: 60, unit: 'hours', progress: 33 },
      { id: 'kr9', title: 'Build projects', current_value: 1, target_value: 2, unit: 'projects', progress: 50 },
    ],
    milestones: [
      { id: 'm8', title: 'Start first course', due_date: '2024-01-15', completed: true },
      { id: 'm9', title: 'Complete first cert', due_date: '2024-02-15', completed: false },
      { id: 'm10', title: 'Complete all certs', due_date: '2024-03-31', completed: false },
    ],
    reflections: [
      { id: 'r2', date: '2024-02-05', content: 'Need to allocate more time for studying', sentiment: 'negative' },
    ],
  },
];

// Progress Bar Component
interface ProgressBarProps {
  progress: number;
  color: string;
  height?: number;
  showLabel?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color, height = 8, showLabel = false }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarTrack, { height }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              height,
              backgroundColor: color,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.progressLabel, { color }]}>{Math.round(progress)}%</Text>
      )}
    </View>
  );
};

// Goal Card Component
interface GoalCardProps {
  goal: Goal;
  onPress: () => void;
  expanded?: boolean;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, onPress, expanded = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const statusConfig = STATUS_CONFIG[goal.status];

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const completedMilestones = goal.milestones.filter((m) => m.completed).length;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.goalCard, { borderLeftColor: goal.color }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconContainer, { backgroundColor: `${goal.color}20` }]}>
            <Ionicons name={goal.icon as any} size={24} color={goal.color} />
          </View>
          <View style={styles.goalHeaderInfo}>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <View style={styles.goalMeta}>
              <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
                <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
              <Text style={styles.timeframeText}>{TIMEFRAME_LABELS[goal.timeframe]}</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color="#666" />
        </View>

        {/* Progress */}
        <View style={styles.goalProgress}>
          <ProgressBar progress={goal.progress} color={goal.color} height={10} showLabel />
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Ionicons name="flag" size={14} color="#888" />
            <Text style={styles.quickStatText}>
              {completedMilestones}/{goal.milestones.length} milestones
            </Text>
          </View>
          <View style={styles.quickStat}>
            <Ionicons name="list" size={14} color="#888" />
            <Text style={styles.quickStatText}>
              {goal.key_results.length} key results
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Key Results Section
interface KeyResultsSectionProps {
  keyResults: KeyResult[];
  goalColor: string;
}

const KeyResultsSection: React.FC<KeyResultsSectionProps> = ({ keyResults, goalColor }) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Key Results</Text>
      {keyResults.map((kr) => (
        <View key={kr.id} style={styles.keyResultItem}>
          <View style={styles.keyResultHeader}>
            <Text style={styles.keyResultTitle}>{kr.title}</Text>
            <Text style={[styles.keyResultValue, { color: goalColor }]}>
              {kr.current_value}/{kr.target_value} {kr.unit}
            </Text>
          </View>
          <ProgressBar progress={kr.progress} color={goalColor} height={6} />
        </View>
      ))}
    </View>
  );
};

// Milestone Timeline Component
interface MilestoneTimelineProps {
  milestones: Milestone[];
  goalColor: string;
}

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ milestones, goalColor }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Milestones</Text>
      <View style={styles.timeline}>
        {milestones.map((milestone, index) => (
          <View key={milestone.id} style={styles.timelineItem}>
            {/* Connector line */}
            {index > 0 && (
              <View
                style={[
                  styles.timelineConnector,
                  milestones[index - 1].completed && { backgroundColor: goalColor },
                ]}
              />
            )}

            {/* Node */}
            <View
              style={[
                styles.timelineNode,
                milestone.completed && { backgroundColor: goalColor, borderColor: goalColor },
              ]}
            >
              {milestone.completed && <Ionicons name="checkmark" size={12} color="#FFF" />}
            </View>

            {/* Content */}
            <View style={styles.timelineContent}>
              <Text style={[styles.milestoneTitle, milestone.completed && styles.milestoneTitleCompleted]}>
                {milestone.title}
              </Text>
              <Text style={styles.milestoneDate}>
                {milestone.completed && milestone.completed_date
                  ? `Completed ${formatDate(milestone.completed_date)}`
                  : `Due ${formatDate(milestone.due_date)}`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Reflection Prompt Component
interface ReflectionPromptProps {
  goalId: string;
  onSubmit: (reflection: string) => void;
}

const ReflectionPrompt: React.FC<ReflectionPromptProps> = ({ goalId, onSubmit }) => {
  const [prompt, setPrompt] = useState('');
  const [reflection, setReflection] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Get random prompt
    const randomPrompt = REFLECTION_PROMPTS[Math.floor(Math.random() * REFLECTION_PROMPTS.length)];
    setPrompt(randomPrompt);
  }, []);

  const handleSubmit = () => {
    if (reflection.trim()) {
      onSubmit(reflection.trim());
      setReflection('');
      setIsExpanded(false);
    }
  };

  return (
    <View style={styles.reflectionContainer}>
      <TouchableOpacity
        style={styles.reflectionHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.reflectionHeaderLeft}>
          <Ionicons name="bulb" size={20} color="#FFD700" />
          <Text style={styles.reflectionTitle}>Reflect</Text>
        </View>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.reflectionContent}>
          <Text style={styles.reflectionPrompt}>{prompt}</Text>
          <TextInput
            style={styles.reflectionInput}
            value={reflection}
            onChangeText={setReflection}
            placeholder="Write your thoughts..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.reflectionSubmit, !reflection.trim() && styles.reflectionSubmitDisabled]}
            onPress={handleSubmit}
            disabled={!reflection.trim()}
          >
            <Text style={styles.reflectionSubmitText}>Save Reflection</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Goal Detail Modal
interface GoalDetailModalProps {
  goal: Goal | null;
  visible: boolean;
  onDismiss: () => void;
  onAddReflection: (goalId: string, reflection: string) => void;
}

const GoalDetailModal: React.FC<GoalDetailModalProps> = ({ goal, visible, onDismiss, onAddReflection }) => {
  if (!goal) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.goalIconContainer, { backgroundColor: `${goal.color}20` }]}>
                <Ionicons name={goal.icon as any} size={24} color={goal.color} />
              </View>
              <View>
                <Text style={styles.modalTitle}>{goal.title}</Text>
                <Text style={styles.modalSubtitle}>{goal.description}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Overall Progress */}
            <View style={styles.overallProgress}>
              <Text style={styles.overallProgressLabel}>Overall Progress</Text>
              <View style={styles.overallProgressValue}>
                <Text style={[styles.overallProgressPercent, { color: goal.color }]}>
                  {Math.round(goal.progress)}%
                </Text>
              </View>
              <ProgressBar progress={goal.progress} color={goal.color} height={12} />
            </View>

            {/* Key Results */}
            <KeyResultsSection keyResults={goal.key_results} goalColor={goal.color} />

            {/* Milestones */}
            <MilestoneTimeline milestones={goal.milestones} goalColor={goal.color} />

            {/* Past Reflections */}
            {goal.reflections.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Past Reflections</Text>
                {goal.reflections.map((r) => (
                  <View key={r.id} style={styles.pastReflection}>
                    <View style={styles.pastReflectionHeader}>
                      <Ionicons
                        name={
                          r.sentiment === 'positive' ? 'happy' :
                          r.sentiment === 'negative' ? 'sad' : 'ellipse'
                        }
                        size={16}
                        color={
                          r.sentiment === 'positive' ? '#4CAF50' :
                          r.sentiment === 'negative' ? '#F44336' : '#888'
                        }
                      />
                      <Text style={styles.pastReflectionDate}>{r.date}</Text>
                    </View>
                    <Text style={styles.pastReflectionContent}>{r.content}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Add Reflection */}
            <ReflectionPrompt
              goalId={goal.id}
              onSubmit={(reflection) => onAddReflection(goal.id, reflection)}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Stats Summary Component
interface StatsSummaryProps {
  stats: GoalStats;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats }) => {
  return (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.completed}/{stats.total_goals}</Text>
        <Text style={styles.statLabel}>Completed</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.on_track}</Text>
        <Text style={styles.statLabel}>On Track</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: '#F44336' }]}>{stats.at_risk}</Text>
        <Text style={styles.statLabel}>At Risk</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: ORACLE_COLORS.act }]}>{Math.round(stats.average_progress)}%</Text>
        <Text style={styles.statLabel}>Avg Progress</Text>
      </View>
    </View>
  );
};

// Main Component
export const GoalProgress: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [goals, setGoals] = useState<Goal[]>(MOCK_GOALS);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | GoalTimeframe>('all');

  const stats: GoalStats = {
    total_goals: goals.length,
    completed: goals.filter((g) => g.status === 'completed').length,
    on_track: goals.filter((g) => g.status === 'active' && g.progress >= 50).length,
    at_risk: goals.filter((g) => g.status === 'at_risk').length,
    average_progress: goals.reduce((acc, g) => acc + g.progress, 0) / goals.length,
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleGoalPress = useCallback((goal: Goal) => {
    setSelectedGoal(goal);
    setShowDetailModal(true);
  }, []);

  const handleAddReflection = useCallback((goalId: string, reflection: string) => {
    setGoals((prevGoals) =>
      prevGoals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              reflections: [
                ...g.reflections,
                {
                  id: Date.now().toString(),
                  date: new Date().toISOString().split('T')[0],
                  content: reflection,
                  sentiment: 'neutral' as const,
                },
              ],
            }
          : g
      )
    );
    // Update selected goal for modal
    setSelectedGoal((prev) =>
      prev?.id === goalId
        ? {
            ...prev,
            reflections: [
              ...prev.reflections,
              {
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0],
                content: reflection,
                sentiment: 'neutral' as const,
              },
            ],
          }
        : prev
    );
    Alert.alert('Saved', 'Your reflection has been saved!');
  }, []);

  const filteredGoals = goals.filter((g) => {
    if (filter === 'all') return true;
    return g.timeframe === filter;
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Goals</Text>
        <TouchableOpacity
          style={styles.addHeaderButton}
          onPress={() => Alert.alert('Add Goal', 'Goal creation coming soon!')}
        >
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
        }
      >
        {/* Stats Summary */}
        <StatsSummary stats={stats} />

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {(['all', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All Goals' : TIMEFRAME_LABELS[f as GoalTimeframe]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Goals List */}
        <View style={styles.goalsList}>
          {filteredGoals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>No goals for this timeframe</Text>
              <Text style={styles.emptySubtext}>Set meaningful goals to track your progress</Text>
            </View>
          ) : (
            filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => handleGoalPress(goal)}
              />
            ))
          )}
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Goal Setting Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={20} color="#FFD700" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>OKR Framework</Text>
              <Text style={styles.tipText}>
                Set 3-5 key results per objective. Each key result should be measurable and time-bound.
              </Text>
            </View>
          </View>
          <View style={styles.tipCard}>
            <Ionicons name="trending-up" size={20} color="#4CAF50" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Regular Check-ins</Text>
              <Text style={styles.tipText}>
                Review your goals weekly. Small consistent updates lead to big achievements.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Goal Detail Modal */}
      <GoalDetailModal
        goal={selectedGoal}
        visible={showDetailModal}
        onDismiss={() => setShowDetailModal(false)}
        onAddReflection={handleAddReflection}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  addHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORACLE_COLORS.act,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  filterContainer: {
    gap: 8,
    marginBottom: 16,
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  filterChipActive: {
    backgroundColor: ORACLE_COLORS.act,
    borderColor: ORACLE_COLORS.act,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  filterChipTextActive: {
    color: '#000',
  },
  goalsList: {
    marginBottom: 20,
  },
  goalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeaderInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  goalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeframeText: {
    fontSize: 12,
    color: '#666',
  },
  goalProgress: {
    marginTop: 16,
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarTrack: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
  },
  quickStats: {
    flexDirection: 'row',
    gap: 16,
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickStatText: {
    fontSize: 12,
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  keyResultItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  keyResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  keyResultTitle: {
    fontSize: 14,
    color: '#FFF',
    flex: 1,
  },
  keyResultValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeline: {
    paddingLeft: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 9,
    top: -16,
    width: 2,
    height: 16,
    backgroundColor: '#333',
  },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#444',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 14,
    color: '#FFF',
  },
  milestoneTitleCompleted: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  milestoneDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reflectionContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  reflectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  reflectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reflectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  reflectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  reflectionPrompt: {
    fontSize: 14,
    color: '#CCC',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 20,
  },
  reflectionInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#FFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reflectionSubmit: {
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  reflectionSubmitDisabled: {
    opacity: 0.5,
  },
  reflectionSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  pastReflection: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  pastReflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pastReflectionDate: {
    fontSize: 12,
    color: '#666',
  },
  pastReflectionContent: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
  },
  tipsSection: {
    marginBottom: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  overallProgress: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  overallProgressLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  overallProgressValue: {
    marginBottom: 12,
  },
  overallProgressPercent: {
    fontSize: 48,
    fontWeight: 'bold',
  },
});

export default GoalProgress;
