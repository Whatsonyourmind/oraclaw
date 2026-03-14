/**
 * HabitDashboard Component
 * Habit tracking overview for ORACLE
 *
 * Features:
 * - Habit cards with streaks
 * - Today's habits checklist
 * - Weekly heatmap
 * - Add habit flow
 */
import React, { useRef, useEffect, useState } from 'react';
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
type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'weekly';
type HabitCategory = 'health' | 'productivity' | 'learning' | 'mindfulness' | 'social' | 'other';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  time_of_day: TimeOfDay;
  current_streak: number;
  longest_streak: number;
  color: string;
  icon: string;
  completed_today: boolean;
  habit_score: number;
}

interface HabitStats {
  total_habits: number;
  completed_today: number;
  current_best_streak: number;
  weekly_completion_rate: number;
}

// Constants
const CATEGORY_CONFIG: Record<HabitCategory, { icon: string; color: string }> = {
  health: { icon: 'heart', color: '#E91E63' },
  productivity: { icon: 'rocket', color: '#2196F3' },
  learning: { icon: 'book', color: '#9C27B0' },
  mindfulness: { icon: 'leaf', color: '#4CAF50' },
  social: { icon: 'people', color: '#FF9800' },
  other: { icon: 'ellipsis-horizontal', color: '#607D8B' },
};

const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Once a week',
};

// Mock data
const MOCK_HABITS: Habit[] = [
  {
    id: '1',
    name: 'Morning Exercise',
    category: 'health',
    frequency: 'daily',
    time_of_day: 'morning',
    current_streak: 12,
    longest_streak: 21,
    color: '#E91E63',
    icon: 'fitness',
    completed_today: false,
    habit_score: 85,
  },
  {
    id: '2',
    name: 'Read for 30 min',
    category: 'learning',
    frequency: 'daily',
    time_of_day: 'evening',
    current_streak: 7,
    longest_streak: 14,
    color: '#9C27B0',
    icon: 'book',
    completed_today: true,
    habit_score: 72,
  },
  {
    id: '3',
    name: 'Meditate',
    category: 'mindfulness',
    frequency: 'daily',
    time_of_day: 'morning',
    current_streak: 5,
    longest_streak: 10,
    color: '#4CAF50',
    icon: 'leaf',
    completed_today: false,
    habit_score: 65,
  },
  {
    id: '4',
    name: 'Drink 8 glasses of water',
    category: 'health',
    frequency: 'daily',
    time_of_day: 'anytime',
    current_streak: 3,
    longest_streak: 30,
    color: '#00BCD4',
    icon: 'water',
    completed_today: true,
    habit_score: 78,
  },
];

// Habit Card Component
interface HabitCardProps {
  habit: Habit;
  onToggle: () => void;
  onPress: () => void;
}

const HabitCard: React.FC<HabitCardProps> = ({ habit, onToggle, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity style={styles.habitCard} onPress={onPress} activeOpacity={0.8}>
        <TouchableOpacity
          style={[
            styles.habitCheckbox,
            habit.completed_today && { backgroundColor: habit.color, borderColor: habit.color },
          ]}
          onPress={handleToggle}
        >
          {habit.completed_today && (
            <Ionicons name="checkmark" size={18} color="#FFF" />
          )}
        </TouchableOpacity>

        <View style={styles.habitInfo}>
          <View style={styles.habitHeader}>
            <Ionicons name={habit.icon as any} size={18} color={habit.color} />
            <Text style={[styles.habitName, habit.completed_today && styles.habitNameCompleted]}>
              {habit.name}
            </Text>
          </View>
          <View style={styles.habitMeta}>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={12} color="#FF6B6B" />
              <Text style={styles.streakText}>{habit.current_streak}</Text>
            </View>
            <Text style={styles.habitFrequency}>
              {FREQUENCY_LABELS[habit.frequency]}
            </Text>
          </View>
        </View>

        <View style={styles.habitProgress}>
          <Text style={[styles.habitScore, { color: habit.color }]}>{habit.habit_score}%</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Weekly Heatmap Component
interface WeeklyHeatmapProps {
  data: boolean[][];
  habitNames: string[];
}

const WeeklyHeatmap: React.FC<WeeklyHeatmapProps> = ({ data, habitNames }) => {
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={styles.heatmapContainer}>
      <Text style={styles.sectionTitle}>Weekly Overview</Text>

      {/* Day headers */}
      <View style={styles.heatmapHeader}>
        <View style={styles.heatmapLabelCell} />
        {dayLabels.map((day, i) => (
          <View key={i} style={styles.heatmapHeaderCell}>
            <Text style={styles.heatmapHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      {data.map((row, habitIndex) => (
        <View key={habitIndex} style={styles.heatmapRow}>
          <View style={styles.heatmapLabelCell}>
            <Text style={styles.heatmapLabel} numberOfLines={1}>
              {habitNames[habitIndex]}
            </Text>
          </View>
          {row.map((completed, dayIndex) => (
            <View key={dayIndex} style={styles.heatmapCell}>
              <View
                style={[
                  styles.heatmapDot,
                  completed && styles.heatmapDotCompleted,
                ]}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

// Stats Summary Component
interface StatsSummaryProps {
  stats: HabitStats;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats }) => {
  return (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {stats.completed_today}/{stats.total_habits}
        </Text>
        <Text style={styles.statLabel}>Today</Text>
      </View>
      <View style={styles.statCard}>
        <View style={styles.streakStatValue}>
          <Ionicons name="flame" size={20} color="#FF6B6B" />
          <Text style={styles.statValue}>{stats.current_best_streak}</Text>
        </View>
        <Text style={styles.statLabel}>Best Streak</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: ORACLE_COLORS.act }]}>
          {Math.round(stats.weekly_completion_rate)}%
        </Text>
        <Text style={styles.statLabel}>This Week</Text>
      </View>
    </View>
  );
};

// Add Habit Modal
interface AddHabitModalProps {
  visible: boolean;
  onAdd: (habit: Omit<Habit, 'id' | 'current_streak' | 'longest_streak' | 'completed_today' | 'habit_score'>) => void;
  onDismiss: () => void;
}

const AddHabitModal: React.FC<AddHabitModalProps> = ({ visible, onAdd, onDismiss }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('health');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    const config = CATEGORY_CONFIG[category];
    onAdd({
      name: name.trim(),
      category,
      frequency,
      time_of_day: timeOfDay,
      color: config.color,
      icon: config.icon,
    });

    setName('');
    setCategory('health');
    setFrequency('daily');
    setTimeOfDay('morning');
    onDismiss();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Habit</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Name Input */}
            <Text style={styles.inputLabel}>Habit Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Morning Exercise"
              placeholderTextColor="#666"
            />

            {/* Category */}
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.optionsGrid}>
              {(Object.keys(CATEGORY_CONFIG) as HabitCategory[]).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.optionButton,
                    category === cat && { backgroundColor: `${CATEGORY_CONFIG[cat].color}20`, borderColor: CATEGORY_CONFIG[cat].color },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Ionicons
                    name={CATEGORY_CONFIG[cat].icon as any}
                    size={20}
                    color={category === cat ? CATEGORY_CONFIG[cat].color : '#888'}
                  />
                  <Text style={[styles.optionText, category === cat && { color: CATEGORY_CONFIG[cat].color }]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Frequency */}
            <Text style={styles.inputLabel}>Frequency</Text>
            <View style={styles.frequencyOptions}>
              {(Object.keys(FREQUENCY_LABELS) as HabitFrequency[]).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyButton,
                    frequency === freq && styles.frequencyButtonActive,
                  ]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text style={[styles.frequencyText, frequency === freq && styles.frequencyTextActive]}>
                    {FREQUENCY_LABELS[freq]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time of Day */}
            <Text style={styles.inputLabel}>Best Time</Text>
            <View style={styles.timeOptions}>
              {(['morning', 'afternoon', 'evening', 'anytime'] as TimeOfDay[]).map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeButton,
                    timeOfDay === time && styles.timeButtonActive,
                  ]}
                  onPress={() => setTimeOfDay(time)}
                >
                  <Ionicons
                    name={
                      time === 'morning' ? 'sunny' :
                      time === 'afternoon' ? 'partly-sunny' :
                      time === 'evening' ? 'moon' : 'time'
                    }
                    size={18}
                    color={timeOfDay === time ? '#000' : '#888'}
                  />
                  <Text style={[styles.timeText, timeOfDay === time && styles.timeTextActive]}>
                    {time.charAt(0).toUpperCase() + time.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Ionicons name="add" size={24} color="#000" />
            <Text style={styles.addButtonText}>Add Habit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
export const HabitDashboard: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [habits, setHabits] = useState<Habit[]>(MOCK_HABITS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const stats: HabitStats = {
    total_habits: habits.length,
    completed_today: habits.filter((h) => h.completed_today).length,
    current_best_streak: Math.max(...habits.map((h) => h.current_streak)),
    weekly_completion_rate: 78,
  };

  // Weekly heatmap data (mock)
  const weeklyData = habits.map(() =>
    Array.from({ length: 7 }, () => Math.random() > 0.3)
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleToggleHabit = (habitId: string) => {
    setHabits(habits.map((h) =>
      h.id === habitId ? { ...h, completed_today: !h.completed_today } : h
    ));
  };

  const handleAddHabit = (newHabit: Omit<Habit, 'id' | 'current_streak' | 'longest_streak' | 'completed_today' | 'habit_score'>) => {
    const habit: Habit = {
      id: Date.now().toString(),
      ...newHabit,
      current_streak: 0,
      longest_streak: 0,
      completed_today: false,
      habit_score: 0,
    };
    setHabits([...habits, habit]);
  };

  const filteredHabits = habits.filter((h) => {
    if (filter === 'pending') return !h.completed_today;
    if (filter === 'completed') return h.completed_today;
    return true;
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Habits</Text>
        <TouchableOpacity
          style={styles.addHeaderButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
        }
      >
        {/* Stats */}
        <StatsSummary stats={stats} />

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === 'all' ? 'All' : f === 'pending' ? 'To Do' : 'Done'}
              </Text>
              {f === 'pending' && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {habits.filter((h) => !h.completed_today).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Habits List */}
        <View style={styles.habitsList}>
          {filteredHabits.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color="#444" />
              <Text style={styles.emptyText}>
                {filter === 'completed' ? 'No completed habits yet' :
                 filter === 'pending' ? 'All done for today!' :
                 'No habits yet. Add one!'}
              </Text>
            </View>
          ) : (
            filteredHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onToggle={() => handleToggleHabit(habit.id)}
                onPress={() => Alert.alert(habit.name, `Streak: ${habit.current_streak} days`)}
              />
            ))
          )}
        </View>

        {/* Weekly Heatmap */}
        <WeeklyHeatmap
          data={weeklyData}
          habitNames={habits.map((h) => h.name)}
        />

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={20} color="#FFD700" />
            <Text style={styles.tipText}>
              Stack habits together! After your morning coffee, do 5 minutes of stretching.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Add Habit Modal */}
      <AddHabitModal
        visible={showAddModal}
        onAdd={handleAddHabit}
        onDismiss={() => setShowAddModal(false)}
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
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  streakStatValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#333',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  filterTabTextActive: {
    color: '#FFF',
  },
  filterBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  habitsList: {
    marginBottom: 20,
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 14,
  },
  habitCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitInfo: {
    flex: 1,
  },
  habitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  habitNameCompleted: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  habitFrequency: {
    fontSize: 12,
    color: '#666',
  },
  habitProgress: {},
  habitScore: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  heatmapContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  heatmapHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  heatmapHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  heatmapHeaderText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  heatmapLabelCell: {
    width: 80,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heatmapLabel: {
    fontSize: 11,
    color: '#666',
  },
  heatmapCell: {
    flex: 1,
    alignItems: 'center',
  },
  heatmapDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  heatmapDotCompleted: {
    backgroundColor: ORACLE_COLORS.act,
  },
  tipsSection: {
    marginBottom: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2D2500',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#FFD700',
    lineHeight: 20,
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
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 10,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFF',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0a0a0a',
    gap: 6,
  },
  optionText: {
    fontSize: 13,
    color: '#888',
  },
  frequencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0a0a0a',
  },
  frequencyButtonActive: {
    borderColor: ORACLE_COLORS.act,
    backgroundColor: `${ORACLE_COLORS.act}20`,
  },
  frequencyText: {
    fontSize: 13,
    color: '#888',
  },
  frequencyTextActive: {
    color: ORACLE_COLORS.act,
  },
  timeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0a0a0a',
    gap: 6,
  },
  timeButtonActive: {
    borderColor: ORACLE_COLORS.act,
    backgroundColor: ORACLE_COLORS.act,
  },
  timeText: {
    fontSize: 12,
    color: '#888',
  },
  timeTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});

export default HabitDashboard;
