/**
 * SmartScheduler Component
 * Story adv-16 - Intelligent scheduling with optimal time slots
 *
 * Features:
 * - Weekly view with optimal time slots highlighted
 * - Task drag-and-drop to suggested times
 * - Energy level indicators
 * - Conflict detection warnings
 * - One-tap schedule optimization
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
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';
import { oracleStyles } from '../theme';

const { width, height } = Dimensions.get('window');

// Types
type EnergyLevel = 'peak' | 'high' | 'moderate' | 'low' | 'rest';
type TaskCategory = 'deep_work' | 'meetings' | 'admin' | 'creative' | 'exercise' | 'rest' | 'other';

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  duration_minutes: number;
  energy_level: EnergyLevel;
  is_available: boolean;
  event?: CalendarEvent;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  category: TaskCategory;
  is_optimized?: boolean;
}

interface DaySchedule {
  date: string;
  dayName: string;
  slots: TimeSlot[];
  events: CalendarEvent[];
}

interface OptimizationSuggestion {
  event: CalendarEvent;
  suggestedSlot: TimeSlot;
  reason: string;
  energyImprovement: number;
}

// Constants
const HOUR_HEIGHT = 50;
const HOURS_TO_SHOW = 12; // 8 AM to 8 PM
const START_HOUR = 8;

const ENERGY_COLORS: Record<EnergyLevel, string> = {
  peak: '#00FF88',
  high: '#00BFFF',
  moderate: '#FFD700',
  low: '#FF8C00',
  rest: '#888888',
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  deep_work: ORACLE_COLORS.orient,
  meetings: ORACLE_COLORS.decide,
  admin: '#888888',
  creative: '#9B59B6',
  exercise: '#E91E63',
  rest: '#607D8B',
  other: '#555555',
};

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  deep_work: 'code-working-outline',
  meetings: 'people-outline',
  admin: 'document-text-outline',
  creative: 'color-palette-outline',
  exercise: 'fitness-outline',
  rest: 'cafe-outline',
  other: 'ellipsis-horizontal-outline',
};

// Mock data
const generateMockWeekSchedule = (): DaySchedule[] => {
  const days: DaySchedule[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Generate time slots with energy levels
    const slots: TimeSlot[] = [];
    const energyPattern: EnergyLevel[] = [
      'low', 'moderate', 'high', 'peak', 'peak', // 8-12
      'moderate', 'low', // 12-14 (post-lunch dip)
      'moderate', 'high', 'high', 'moderate', 'low', // 14-20
    ];

    for (let hour = START_HOUR; hour < START_HOUR + HOURS_TO_SHOW; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      slots.push({
        id: `${dateStr}-${hour}`,
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        duration_minutes: 60,
        energy_level: energyPattern[hour - START_HOUR],
        is_available: i >= 1 && i <= 5, // Weekdays only
      });
    }

    // Generate sample events for weekdays
    const events: CalendarEvent[] = [];
    if (i >= 1 && i <= 5) {
      // Standup
      if (i < 5) {
        events.push({
          id: `standup-${dateStr}`,
          title: 'Daily Standup',
          start: new Date(date.setHours(9, 0, 0, 0)).toISOString(),
          end: new Date(date.setHours(9, 15, 0, 0)).toISOString(),
          category: 'meetings',
        });
      }

      // Random events
      if (i === 1 || i === 3) {
        events.push({
          id: `focus-${dateStr}`,
          title: 'Focus Time',
          start: new Date(date.setHours(10, 0, 0, 0)).toISOString(),
          end: new Date(date.setHours(12, 0, 0, 0)).toISOString(),
          category: 'deep_work',
        });
      }

      if (i === 2 || i === 4) {
        events.push({
          id: `meeting-${dateStr}`,
          title: 'Team Meeting',
          start: new Date(date.setHours(14, 0, 0, 0)).toISOString(),
          end: new Date(date.setHours(15, 0, 0, 0)).toISOString(),
          category: 'meetings',
        });
      }

      // Lunch
      events.push({
        id: `lunch-${dateStr}`,
        title: 'Lunch',
        start: new Date(date.setHours(12, 30, 0, 0)).toISOString(),
        end: new Date(date.setHours(13, 0, 0, 0)).toISOString(),
        category: 'rest',
      });
    }

    days.push({
      date: dateStr,
      dayName: dayNames[i],
      slots,
      events,
    });
  }

  return days;
};

// Components

interface EnergyIndicatorProps {
  level: EnergyLevel;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const EnergyIndicator: React.FC<EnergyIndicatorProps> = ({
  level,
  size = 'small',
  showLabel = false,
}) => {
  const sizeMap = {
    small: 8,
    medium: 12,
    large: 16,
  };

  const dotSize = sizeMap[size];

  return (
    <View style={styles.energyIndicator}>
      <View
        style={[
          styles.energyDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: ENERGY_COLORS[level],
          },
        ]}
      />
      {showLabel && (
        <Text style={[styles.energyLabel, { color: ENERGY_COLORS[level] }]}>
          {level.charAt(0).toUpperCase() + level.slice(1)}
        </Text>
      )}
    </View>
  );
};

interface TimeSlotViewProps {
  slot: TimeSlot;
  height: number;
  onPress: (slot: TimeSlot) => void;
}

const TimeSlotView: React.FC<TimeSlotViewProps> = ({ slot, height, onPress }) => {
  const opacity = slot.is_available ? 1 : 0.5;

  return (
    <TouchableOpacity
      style={[
        styles.timeSlot,
        {
          height,
          backgroundColor: `${ENERGY_COLORS[slot.energy_level]}10`,
          borderLeftColor: ENERGY_COLORS[slot.energy_level],
          opacity,
        },
      ]}
      onPress={() => onPress(slot)}
      disabled={!slot.is_available}
    >
      <EnergyIndicator level={slot.energy_level} size="small" />
    </TouchableOpacity>
  );
};

interface EventCardProps {
  event: CalendarEvent;
  style?: any;
  onPress: (event: CalendarEvent) => void;
  isDragging?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, style, onPress, isDragging }) => {
  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  return (
    <TouchableOpacity
      style={[
        styles.eventCard,
        {
          backgroundColor: CATEGORY_COLORS[event.category],
          opacity: isDragging ? 0.7 : 1,
        },
        event.is_optimized && styles.eventOptimized,
        style,
      ]}
      onPress={() => onPress(event)}
      activeOpacity={0.8}
    >
      <View style={styles.eventContent}>
        <Ionicons
          name={CATEGORY_ICONS[event.category] as any}
          size={14}
          color="#FFFFFF"
          style={styles.eventIcon}
        />
        <Text style={styles.eventTitle} numberOfLines={1}>
          {event.title}
        </Text>
      </View>
      {duration >= 45 && (
        <Text style={styles.eventTime}>
          {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      )}
      {event.is_optimized && (
        <View style={styles.optimizedBadge}>
          <Ionicons name="sparkles" size={10} color="#FFD700" />
        </View>
      )}
    </TouchableOpacity>
  );
};

interface DayColumnProps {
  day: DaySchedule;
  isToday: boolean;
  onSlotPress: (slot: TimeSlot) => void;
  onEventPress: (event: CalendarEvent) => void;
}

const DayColumn: React.FC<DayColumnProps> = ({
  day,
  isToday,
  onSlotPress,
  onEventPress,
}) => {
  const columnWidth = (width - 60) / 7;

  const getEventPosition = (event: CalendarEvent) => {
    const startHour = new Date(event.start).getHours();
    const startMinutes = new Date(event.start).getMinutes();
    const endHour = new Date(event.end).getHours();
    const endMinutes = new Date(event.end).getMinutes();

    const top = (startHour - START_HOUR + startMinutes / 60) * HOUR_HEIGHT;
    const height = ((endHour - startHour) + (endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

    return { top, height: Math.max(height, 20) };
  };

  return (
    <View style={[styles.dayColumn, { width: columnWidth }]}>
      {/* Day header */}
      <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
        <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{day.dayName}</Text>
        <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
          {new Date(day.date).getDate()}
        </Text>
      </View>

      {/* Time slots */}
      <View style={styles.slotsContainer}>
        {day.slots.map((slot) => (
          <TimeSlotView
            key={slot.id}
            slot={slot}
            height={HOUR_HEIGHT}
            onPress={onSlotPress}
          />
        ))}

        {/* Events overlay */}
        {day.events.map((event) => {
          const position = getEventPosition(event);
          return (
            <View
              key={event.id}
              style={[
                styles.eventWrapper,
                {
                  top: position.top,
                  height: position.height,
                  left: 2,
                  right: 2,
                },
              ]}
            >
              <EventCard event={event} onPress={onEventPress} />
            </View>
          );
        })}
      </View>
    </View>
  );
};

interface TimeAxisProps {
  startHour: number;
  hoursCount: number;
}

const TimeAxis: React.FC<TimeAxisProps> = ({ startHour, hoursCount }) => {
  const hours = Array.from({ length: hoursCount }, (_, i) => startHour + i);

  return (
    <View style={styles.timeAxis}>
      <View style={styles.timeAxisHeader} />
      {hours.map((hour) => (
        <View key={hour} style={styles.timeAxisHour}>
          <Text style={styles.timeAxisText}>
            {hour % 12 || 12}{hour >= 12 ? 'PM' : 'AM'}
          </Text>
        </View>
      ))}
    </View>
  );
};

interface OptimizationModalProps {
  visible: boolean;
  suggestions: OptimizationSuggestion[];
  onApply: () => void;
  onDismiss: () => void;
  isOptimizing: boolean;
}

const OptimizationModal: React.FC<OptimizationModalProps> = ({
  visible,
  suggestions,
  onApply,
  onDismiss,
  isOptimizing,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schedule Optimization</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {isOptimizing ? (
            <View style={styles.optimizingContainer}>
              <ActivityIndicator size="large" color={ORACLE_COLORS.act} />
              <Text style={styles.optimizingText}>Analyzing your schedule...</Text>
            </View>
          ) : suggestions.length === 0 ? (
            <View style={styles.noSuggestionsContainer}>
              <Ionicons name="checkmark-circle" size={48} color={ORACLE_COLORS.act} />
              <Text style={styles.noSuggestionsText}>
                Your schedule is already well-optimized!
              </Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.suggestionsList}>
                {suggestions.map((suggestion, index) => (
                  <View key={index} style={styles.suggestionCard}>
                    <View style={styles.suggestionHeader}>
                      <Text style={styles.suggestionTitle}>{suggestion.event.title}</Text>
                      <View style={styles.energyImprovement}>
                        <Ionicons
                          name={suggestion.energyImprovement > 0 ? 'arrow-up' : 'remove'}
                          size={14}
                          color={suggestion.energyImprovement > 0 ? '#00FF88' : '#888888'}
                        />
                        <Text
                          style={[
                            styles.improvementText,
                            { color: suggestion.energyImprovement > 0 ? '#00FF88' : '#888888' },
                          ]}
                        >
                          Energy
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                    <View style={styles.suggestionTime}>
                      <Text style={styles.timeLabel}>Suggested: </Text>
                      <Text style={styles.timeValue}>
                        {new Date(suggestion.suggestedSlot.start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      <EnergyIndicator level={suggestion.suggestedSlot.energy_level} showLabel />
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.applyButton} onPress={onApply}>
                <Ionicons name="sparkles" size={20} color="#000000" />
                <Text style={styles.applyButtonText}>Apply Optimizations</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

interface AddTaskModalProps {
  visible: boolean;
  selectedSlot: TimeSlot | null;
  onAdd: (title: string, category: TaskCategory) => void;
  onDismiss: () => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
  visible,
  selectedSlot,
  onAdd,
  onDismiss,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('other');

  const handleAdd = () => {
    if (title.trim()) {
      onAdd(title.trim(), category);
      setTitle('');
      setCategory('other');
    }
  };

  const categories: TaskCategory[] = ['deep_work', 'meetings', 'admin', 'creative', 'exercise', 'other'];

  if (!selectedSlot) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.slotInfo}>
            <Text style={styles.slotTime}>
              {new Date(selectedSlot.start).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            <EnergyIndicator level={selectedSlot.energy_level} size="medium" showLabel />
          </View>

          <TextInput
            style={styles.taskInput}
            placeholder="Task title..."
            placeholderTextColor="#666666"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <Text style={styles.categoryLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive,
                  { borderColor: CATEGORY_COLORS[cat] },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Ionicons
                  name={CATEGORY_ICONS[cat] as any}
                  size={20}
                  color={category === cat ? CATEGORY_COLORS[cat] : '#888888'}
                />
                <Text
                  style={[
                    styles.categoryText,
                    category === cat && { color: CATEGORY_COLORS[cat] },
                  ]}
                >
                  {cat.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.addButton, !title.trim() && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!title.trim()}
          >
            <Ionicons name="add" size={20} color="#000000" />
            <Text style={styles.addButtonText}>Add to Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
export const SmartScheduler: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    loadSchedule();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      // In production: fetch from API
      await new Promise((resolve) => setTimeout(resolve, 500));
      setWeekSchedule(generateMockWeekSchedule());
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSchedule();
    setIsRefreshing(false);
  }, []);

  const handleSlotPress = (slot: TimeSlot) => {
    if (slot.is_available) {
      setSelectedSlot(slot);
      setShowAddTaskModal(true);
    }
  };

  const handleEventPress = (event: CalendarEvent) => {
    Alert.alert(
      event.title,
      `${new Date(event.start).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })} - ${new Date(event.end).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`,
      [
        { text: 'Edit', onPress: () => console.log('Edit event') },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete event') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleOptimize = async () => {
    setShowOptimizationModal(true);
    setIsOptimizing(true);

    try {
      // Simulate optimization
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate mock suggestions
      const mockSuggestions: OptimizationSuggestion[] = [
        {
          event: {
            id: 'meeting-1',
            title: 'Team Meeting',
            start: '2026-01-28T14:00:00.000Z',
            end: '2026-01-28T15:00:00.000Z',
            category: 'meetings',
          },
          suggestedSlot: {
            id: 'slot-1',
            start: '2026-01-28T10:00:00.000Z',
            end: '2026-01-28T11:00:00.000Z',
            duration_minutes: 60,
            energy_level: 'peak',
            is_available: true,
          },
          reason: 'Move to peak energy time for better engagement',
          energyImprovement: 2,
        },
      ];

      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimizations = () => {
    // Apply optimizations to schedule
    const updatedSchedule = weekSchedule.map((day) => ({
      ...day,
      events: day.events.map((event) => {
        const suggestion = suggestions.find((s) => s.event.id === event.id);
        if (suggestion) {
          return {
            ...event,
            start: suggestion.suggestedSlot.start,
            end: suggestion.suggestedSlot.end,
            is_optimized: true,
          };
        }
        return event;
      }),
    }));

    setWeekSchedule(updatedSchedule);
    setShowOptimizationModal(false);

    Alert.alert(
      'Schedule Optimized',
      `${suggestions.length} event(s) have been rescheduled for better energy alignment.`
    );
  };

  const handleAddTask = (title: string, category: TaskCategory) => {
    if (!selectedSlot) return;

    // Add event to schedule
    const slotDate = selectedSlot.start.split('T')[0];
    const updatedSchedule = weekSchedule.map((day) => {
      if (day.date === slotDate) {
        return {
          ...day,
          events: [
            ...day.events,
            {
              id: `new-${Date.now()}`,
              title,
              start: selectedSlot.start,
              end: selectedSlot.end,
              category,
            },
          ],
        };
      }
      return day;
    });

    setWeekSchedule(updatedSchedule);
    setShowAddTaskModal(false);
    setSelectedSlot(null);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Smart Scheduler</Text>
          <Text style={styles.headerSubtitle}>AI-Powered Time Optimization</Text>
        </View>
        <TouchableOpacity style={styles.optimizeButton} onPress={handleOptimize}>
          <Ionicons name="sparkles" size={18} color="#000000" />
          <Text style={styles.optimizeButtonText}>Optimize</Text>
        </TouchableOpacity>
      </View>

      {/* Energy Legend */}
      <View style={styles.legendContainer}>
        {Object.entries(ENERGY_COLORS).map(([level, color]) => (
          <View key={level} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{level}</Text>
          </View>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORACLE_COLORS.observe} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#00BFFF"
            />
          }
        >
          <Animated.View style={[styles.calendarContainer, { opacity: fadeAnim }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekContainer}
            >
              {/* Time axis */}
              <TimeAxis startHour={START_HOUR} hoursCount={HOURS_TO_SHOW} />

              {/* Day columns */}
              {weekSchedule.map((day) => (
                <DayColumn
                  key={day.date}
                  day={day}
                  isToday={day.date === today}
                  onSlotPress={handleSlotPress}
                  onEventPress={handleEventPress}
                />
              ))}
            </ScrollView>
          </Animated.View>
        </ScrollView>
      )}

      {/* Conflicts indicator */}
      {weekSchedule.some((day) =>
        day.events.some((event) => {
          const hour = new Date(event.start).getHours();
          const slot = day.slots.find((s) => new Date(s.start).getHours() === hour);
          return slot && ['deep_work', 'creative'].includes(event.category) && ['low', 'rest'].includes(slot.energy_level);
        })
      ) && (
        <TouchableOpacity style={styles.conflictBanner} onPress={handleOptimize}>
          <Ionicons name="warning-outline" size={20} color="#FFD700" />
          <Text style={styles.conflictText}>
            Some tasks are scheduled during low-energy times
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#FFD700" />
        </TouchableOpacity>
      )}

      {/* Modals */}
      <OptimizationModal
        visible={showOptimizationModal}
        suggestions={suggestions}
        onApply={handleApplyOptimizations}
        onDismiss={() => setShowOptimizationModal(false)}
        isOptimizing={isOptimizing}
      />

      <AddTaskModal
        visible={showAddTaskModal}
        selectedSlot={selectedSlot}
        onAdd={handleAddTask}
        onDismiss={() => {
          setShowAddTaskModal(false);
          setSelectedSlot(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  optimizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0D0D0D',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#888888',
    textTransform: 'capitalize',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
  },
  scrollContainer: {
    flex: 1,
  },
  calendarContainer: {
    paddingBottom: 20,
  },
  weekContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  timeAxis: {
    width: 44,
  },
  timeAxisHeader: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  timeAxisHour: {
    height: HOUR_HEIGHT,
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingRight: 4,
  },
  timeAxisText: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'right',
  },
  dayColumn: {
    borderLeftWidth: 1,
    borderLeftColor: '#222222',
  },
  dayHeader: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  dayHeaderToday: {
    backgroundColor: `${ORACLE_COLORS.observe}20`,
  },
  dayName: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },
  dayNameToday: {
    color: ORACLE_COLORS.observe,
  },
  dayDate: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dayDateToday: {
    color: ORACLE_COLORS.observe,
  },
  slotsContainer: {
    position: 'relative',
  },
  timeSlot: {
    borderLeftWidth: 3,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 2,
  },
  energyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  energyDot: {},
  energyLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  eventWrapper: {
    position: 'absolute',
    zIndex: 1,
  },
  eventCard: {
    flex: 1,
    borderRadius: 4,
    padding: 4,
    overflow: 'hidden',
  },
  eventOptimized: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    marginRight: 4,
  },
  eventTitle: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  eventTime: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  optimizedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#332200',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  conflictText: {
    flex: 1,
    fontSize: 13,
    color: '#FFD700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  optimizingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  optimizingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
  },
  noSuggestionsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSuggestionsText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionCard: {
    backgroundColor: '#222222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  energyImprovement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  improvementText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionReason: {
    fontSize: 13,
    color: '#AAAAAA',
    marginBottom: 12,
  },
  suggestionTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 12,
    color: '#888888',
  },
  timeValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  applyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  slotTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  taskInput: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryButton: {
    width: (width - 80) / 3,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1A1A1A',
  },
  categoryButtonActive: {
    backgroundColor: '#222222',
    borderWidth: 2,
  },
  categoryText: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});

export default SmartScheduler;
