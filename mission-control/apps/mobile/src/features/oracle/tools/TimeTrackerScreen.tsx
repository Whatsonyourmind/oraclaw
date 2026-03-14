/**
 * TimeTrackerScreen Component
 * Time tracking UI for ORACLE
 *
 * Features:
 * - Running timer
 * - Quick entry
 * - Weekly overview
 * - Project breakdown charts
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
type EntryStatus = 'running' | 'stopped';
type BillableStatus = 'billable' | 'non_billable';

interface TimeEntry {
  id: string;
  project_name?: string;
  project_color?: string;
  task_name?: string;
  description?: string;
  status: EntryStatus;
  billable_status: BillableStatus;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
  total_hours: number;
}

interface WeekDay {
  date: string;
  dayName: string;
  hours: number;
  entries: number;
}

interface TimeStats {
  today_hours: number;
  week_hours: number;
  billable_hours: number;
  entries_today: number;
}

// Mock data
const MOCK_PROJECTS: Project[] = [
  { id: '1', name: 'Client Project A', color: '#2196F3', total_hours: 24.5 },
  { id: '2', name: 'Internal Development', color: '#4CAF50', total_hours: 18.2 },
  { id: '3', name: 'Design Work', color: '#9C27B0', total_hours: 12.8 },
  { id: '4', name: 'Meetings', color: '#FF9800', total_hours: 8.5 },
];

const MOCK_ENTRIES: TimeEntry[] = [
  {
    id: '1',
    project_name: 'Client Project A',
    project_color: '#2196F3',
    task_name: 'Feature Development',
    description: 'Implementing new dashboard',
    status: 'stopped',
    billable_status: 'billable',
    start_time: '2026-02-01T09:00:00Z',
    end_time: '2026-02-01T11:30:00Z',
    duration_seconds: 9000,
  },
  {
    id: '2',
    project_name: 'Internal Development',
    project_color: '#4CAF50',
    task_name: 'Code Review',
    status: 'stopped',
    billable_status: 'non_billable',
    start_time: '2026-02-01T13:00:00Z',
    end_time: '2026-02-01T14:00:00Z',
    duration_seconds: 3600,
  },
];

// Running Timer Component
interface RunningTimerProps {
  entry: TimeEntry;
  onStop: () => void;
  onDiscard: () => void;
}

const RunningTimer: React.FC<RunningTimerProps> = ({ entry, onStop, onDiscard }) => {
  const [elapsed, setElapsed] = useState(entry.duration_seconds);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(entry.start_time);
      const now = new Date();
      setElapsed(Math.floor((now.getTime() - start.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [entry.start_time]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Animated.View style={[styles.runningTimer, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.runningTimerHeader}>
        <View style={styles.runningIndicator}>
          <View style={styles.runningDot} />
          <Text style={styles.runningText}>TRACKING</Text>
        </View>
      </View>

      <Text style={styles.runningDuration}>{formatDuration(elapsed)}</Text>

      {entry.project_name && (
        <View style={styles.runningProject}>
          <View style={[styles.projectDot, { backgroundColor: entry.project_color }]} />
          <Text style={styles.runningProjectName}>{entry.project_name}</Text>
        </View>
      )}

      {entry.description && (
        <Text style={styles.runningDescription}>{entry.description}</Text>
      )}

      <View style={styles.runningControls}>
        <TouchableOpacity style={styles.discardButton} onPress={onDiscard}>
          <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.stopButton} onPress={onStop}>
          <Ionicons name="stop" size={24} color="#000" />
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// Quick Entry Component
interface QuickEntryProps {
  onStart: (description: string, projectId?: string) => void;
  projects: Project[];
}

const QuickEntry: React.FC<QuickEntryProps> = ({ onStart, projects }) => {
  const [description, setDescription] = useState('');
  const [showProjects, setShowProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleStart = () => {
    onStart(description, selectedProject?.id);
    setDescription('');
    setSelectedProject(null);
  };

  return (
    <View style={styles.quickEntry}>
      <View style={styles.quickEntryInput}>
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="What are you working on?"
          placeholderTextColor="#666"
        />
        <TouchableOpacity
          style={styles.projectSelector}
          onPress={() => setShowProjects(!showProjects)}
        >
          {selectedProject ? (
            <View style={[styles.projectDot, { backgroundColor: selectedProject.color }]} />
          ) : (
            <Ionicons name="folder-outline" size={20} color="#888" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Ionicons name="play" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {showProjects && (
        <View style={styles.projectDropdown}>
          {projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectOption}
              onPress={() => {
                setSelectedProject(project);
                setShowProjects(false);
              }}
            >
              <View style={[styles.projectDot, { backgroundColor: project.color }]} />
              <Text style={styles.projectOptionText}>{project.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Weekly Overview Component
interface WeeklyOverviewProps {
  days: WeekDay[];
  weeklyGoal: number;
}

const WeeklyOverview: React.FC<WeeklyOverviewProps> = ({ days, weeklyGoal }) => {
  const maxHours = Math.max(...days.map((d) => d.hours), weeklyGoal / 5);
  const totalHours = days.reduce((sum, d) => sum + d.hours, 0);
  const progress = totalHours / weeklyGoal;

  return (
    <View style={styles.weeklyOverview}>
      <View style={styles.weeklyHeader}>
        <Text style={styles.weeklyTitle}>This Week</Text>
        <Text style={styles.weeklyTotal}>
          {totalHours.toFixed(1)}h / {weeklyGoal}h
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, progress * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* Day bars */}
      <View style={styles.dayBars}>
        {days.map((day) => (
          <View key={day.date} style={styles.dayBar}>
            <View style={styles.dayBarContainer}>
              <View
                style={[
                  styles.dayBarFill,
                  { height: `${(day.hours / maxHours) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.dayBarLabel}>{day.dayName}</Text>
            <Text style={styles.dayBarHours}>{day.hours.toFixed(1)}h</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Project Breakdown Component
interface ProjectBreakdownProps {
  projects: Project[];
}

const ProjectBreakdown: React.FC<ProjectBreakdownProps> = ({ projects }) => {
  const totalHours = projects.reduce((sum, p) => sum + p.total_hours, 0);

  return (
    <View style={styles.projectBreakdown}>
      <Text style={styles.sectionTitle}>By Project</Text>

      {projects.map((project) => {
        const percentage = (project.total_hours / totalHours) * 100;
        return (
          <View key={project.id} style={styles.projectRow}>
            <View style={styles.projectInfo}>
              <View style={[styles.projectDot, { backgroundColor: project.color }]} />
              <Text style={styles.projectName}>{project.name}</Text>
            </View>
            <View style={styles.projectStats}>
              <View style={styles.projectBar}>
                <View
                  style={[
                    styles.projectBarFill,
                    { width: `${percentage}%`, backgroundColor: project.color },
                  ]}
                />
              </View>
              <Text style={styles.projectHours}>{project.total_hours.toFixed(1)}h</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// Entry Item Component
interface EntryItemProps {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}

const EntryItem: React.FC<EntryItemProps> = ({ entry, onEdit, onDelete }) => {
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity style={styles.entryItem} onPress={onEdit}>
      <View style={styles.entryLeft}>
        {entry.project_name && (
          <View style={[styles.projectDot, { backgroundColor: entry.project_color }]} />
        )}
        <View style={styles.entryDetails}>
          <Text style={styles.entryDescription} numberOfLines={1}>
            {entry.description || entry.task_name || 'No description'}
          </Text>
          <Text style={styles.entryProject}>
            {entry.project_name || 'No project'}
          </Text>
        </View>
      </View>
      <View style={styles.entryRight}>
        <Text style={styles.entryDuration}>{formatDuration(entry.duration_seconds)}</Text>
        <Text style={styles.entryTime}>
          {formatTime(entry.start_time)} - {entry.end_time ? formatTime(entry.end_time) : 'now'}
        </Text>
        {entry.billable_status === 'billable' && (
          <View style={styles.billableBadge}>
            <Ionicons name="cash-outline" size={10} color={ORACLE_COLORS.act} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Stats Summary Component
interface StatsSummaryProps {
  stats: TimeStats;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats }) => {
  return (
    <View style={styles.statsSummary}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.today_hours.toFixed(1)}h</Text>
        <Text style={styles.statLabel}>Today</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.week_hours.toFixed(1)}h</Text>
        <Text style={styles.statLabel}>This Week</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: ORACLE_COLORS.act }]}>
          {stats.billable_hours.toFixed(1)}h
        </Text>
        <Text style={styles.statLabel}>Billable</Text>
      </View>
    </View>
  );
};

// Main Component
export const TimeTrackerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>(MOCK_ENTRIES);
  const [projects] = useState<Project[]>(MOCK_PROJECTS);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');

  const stats: TimeStats = {
    today_hours: 4.5,
    week_hours: 32.5,
    billable_hours: 24.5,
    entries_today: 5,
  };

  const weekDays: WeekDay[] = [
    { date: '2026-01-27', dayName: 'Mon', hours: 8.2, entries: 6 },
    { date: '2026-01-28', dayName: 'Tue', hours: 7.5, entries: 5 },
    { date: '2026-01-29', dayName: 'Wed', hours: 6.8, entries: 4 },
    { date: '2026-01-30', dayName: 'Thu', hours: 8.0, entries: 7 },
    { date: '2026-01-31', dayName: 'Fri', hours: 2.0, entries: 2 },
    { date: '2026-02-01', dayName: 'Sat', hours: 0, entries: 0 },
    { date: '2026-02-02', dayName: 'Sun', hours: 0, entries: 0 },
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleStartTimer = (description: string, projectId?: string) => {
    const project = projects.find((p) => p.id === projectId);
    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      project_name: project?.name,
      project_color: project?.color,
      description,
      status: 'running',
      billable_status: 'billable',
      start_time: new Date().toISOString(),
      duration_seconds: 0,
    };
    setRunningEntry(newEntry);
  };

  const handleStopTimer = () => {
    if (runningEntry) {
      const now = new Date();
      const start = new Date(runningEntry.start_time);
      const duration = Math.floor((now.getTime() - start.getTime()) / 1000);

      const stoppedEntry: TimeEntry = {
        ...runningEntry,
        status: 'stopped',
        end_time: now.toISOString(),
        duration_seconds: duration,
      };

      setEntries([stoppedEntry, ...entries]);
      setRunningEntry(null);
    }
  };

  const handleDiscardTimer = () => {
    Alert.alert(
      'Discard Timer',
      'Are you sure you want to discard the current time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => setRunningEntry(null),
        },
      ]
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Time Tracker</Text>
        <TouchableOpacity>
          <Ionicons name="calendar-outline" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Running Timer or Quick Entry */}
          {runningEntry ? (
            <RunningTimer
              entry={runningEntry}
              onStop={handleStopTimer}
              onDiscard={handleDiscardTimer}
            />
          ) : (
            <QuickEntry onStart={handleStartTimer} projects={projects} />
          )}

          {/* Stats Summary */}
          <StatsSummary stats={stats} />

          {/* Tab Selector */}
          <View style={styles.tabSelector}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'today' && styles.tabActive]}
              onPress={() => setActiveTab('today')}
            >
              <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'week' && styles.tabActive]}
              onPress={() => setActiveTab('week')}
            >
              <Text style={[styles.tabText, activeTab === 'week' && styles.tabTextActive]}>
                Week
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'week' && (
            <>
              {/* Weekly Overview */}
              <WeeklyOverview days={weekDays} weeklyGoal={40} />

              {/* Project Breakdown */}
              <ProjectBreakdown projects={projects} />
            </>
          )}

          {activeTab === 'today' && (
            <>
              {/* Today's Entries */}
              <View style={styles.entriesSection}>
                <Text style={styles.sectionTitle}>Today's Entries</Text>
                {entries.map((entry) => (
                  <EntryItem
                    key={entry.id}
                    entry={entry}
                    onEdit={() => Alert.alert('Edit', 'Edit entry: ' + entry.id)}
                    onDelete={() => Alert.alert('Delete', 'Delete entry')}
                  />
                ))}
                {entries.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="time-outline" size={48} color="#444" />
                    <Text style={styles.emptyText}>No entries yet today</Text>
                    <Text style={styles.emptySubtext}>Start tracking your time above</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  runningTimer: {
    backgroundColor: '#1a2a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.act,
  },
  runningTimerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  runningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORACLE_COLORS.act,
  },
  runningText: {
    fontSize: 12,
    fontWeight: '700',
    color: ORACLE_COLORS.act,
    letterSpacing: 1,
  },
  runningDuration: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  runningProject: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  runningProjectName: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  runningDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  runningControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  discardButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3D2020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 14,
    borderRadius: 22,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  quickEntry: {
    marginBottom: 16,
  },
  quickEntryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  descriptionInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#FFF',
  },
  projectSelector: {
    padding: 8,
  },
  startButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ORACLE_COLORS.act,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  projectDropdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  projectOptionText: {
    fontSize: 14,
    color: '#FFF',
  },
  projectDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statsSummary: {
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
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#333',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#FFF',
  },
  weeklyOverview: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  weeklyTotal: {
    fontSize: 14,
    color: '#888',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.act,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: ORACLE_COLORS.act,
    width: 40,
    textAlign: 'right',
  },
  dayBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
  },
  dayBar: {
    flex: 1,
    alignItems: 'center',
  },
  dayBarContainer: {
    flex: 1,
    width: 24,
    backgroundColor: '#333',
    borderRadius: 4,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  dayBarFill: {
    width: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 4,
  },
  dayBarLabel: {
    fontSize: 11,
    color: '#888',
  },
  dayBarHours: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  projectBreakdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  projectRow: {
    marginBottom: 16,
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  projectName: {
    fontSize: 14,
    color: '#FFF',
  },
  projectStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  projectBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  projectBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  projectHours: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    width: 50,
    textAlign: 'right',
  },
  entriesSection: {
    marginTop: 4,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  entryDetails: {
    flex: 1,
  },
  entryDescription: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  entryProject: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  entryRight: {
    alignItems: 'flex-end',
  },
  entryDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  entryTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  billableBadge: {
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    marginTop: 4,
  },
});

export default TimeTrackerScreen;
