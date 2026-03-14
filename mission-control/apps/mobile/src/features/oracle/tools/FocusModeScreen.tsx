/**
 * FocusModeScreen Component
 * Focus session UI for ORACLE deep work assistant
 *
 * Features:
 * - Large timer display
 * - Current task focus
 * - Do Not Disturb indicator
 * - Quick break button
 * - Session stats
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
  Modal,
  Vibration,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';
import { oracleStyles } from '../theme';

const { width, height } = Dimensions.get('window');

// Types
type SessionStatus = 'idle' | 'focusing' | 'break' | 'paused' | 'completed';
type SoundType = 'none' | 'white_noise' | 'brown_noise' | 'rain' | 'forest' | 'cafe' | 'ocean' | 'focus_music';

interface FocusSession {
  id: string;
  status: SessionStatus;
  target_duration_minutes: number;
  elapsed_seconds: number;
  task_title?: string;
  sound_type: SoundType;
  interruptions: number;
  focus_score: number;
  start_time: string;
}

interface FocusStats {
  today_focus_minutes: number;
  today_sessions: number;
  current_streak: number;
  average_score: number;
}

// Sound options
const SOUND_OPTIONS: { type: SoundType; label: string; icon: string }[] = [
  { type: 'none', label: 'Silence', icon: 'volume-mute' },
  { type: 'white_noise', label: 'White Noise', icon: 'radio' },
  { type: 'brown_noise', label: 'Brown Noise', icon: 'radio' },
  { type: 'rain', label: 'Rain', icon: 'rainy' },
  { type: 'forest', label: 'Forest', icon: 'leaf' },
  { type: 'cafe', label: 'Cafe', icon: 'cafe' },
  { type: 'ocean', label: 'Ocean', icon: 'water' },
  { type: 'focus_music', label: 'Focus Music', icon: 'musical-notes' },
];

// Duration options (minutes)
const DURATION_OPTIONS = [15, 25, 30, 45, 60, 90];

// Circular Progress Component
interface CircularProgressProps {
  progress: number; // 0-1
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor = '#333',
  children,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={styles.circularContainer}>
        {/* Background circle */}
        <View
          style={[
            styles.circularBackground,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: backgroundColor,
            },
          ]}
        />
        {/* Progress arc - simplified without SVG */}
        <View
          style={[
            styles.progressRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: 'transparent',
              borderRightColor: progress > 0.25 ? color : 'transparent',
              borderBottomColor: progress > 0.5 ? color : 'transparent',
              borderLeftColor: progress > 0.75 ? color : 'transparent',
              transform: [{ rotate: `${progress * 360 - 90}deg` }],
            },
          ]}
        />
      </View>
      <View style={styles.circularContent}>{children}</View>
    </View>
  );
};

// Timer Display Component
interface TimerDisplayProps {
  session: FocusSession;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onBreak: () => void;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  session,
  onPause,
  onResume,
  onEnd,
  onBreak,
}) => {
  const progress = session.elapsed_seconds / (session.target_duration_minutes * 60);
  const remainingSeconds = Math.max(0, session.target_duration_minutes * 60 - session.elapsed_seconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (session.status === 'focusing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [session.status]);

  const getStatusColor = () => {
    switch (session.status) {
      case 'focusing':
        return ORACLE_COLORS.act;
      case 'break':
        return ORACLE_COLORS.observe;
      case 'paused':
        return '#FFD700';
      default:
        return '#888';
    }
  };

  return (
    <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
      <CircularProgress
        progress={Math.min(1, progress)}
        size={280}
        strokeWidth={12}
        color={getStatusColor()}
      >
        <View style={styles.timerContent}>
          <Text style={[styles.timerText, { color: getStatusColor() }]}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
          <Text style={styles.statusText}>
            {session.status === 'focusing' ? 'FOCUSING' :
             session.status === 'break' ? 'BREAK' :
             session.status === 'paused' ? 'PAUSED' : ''}
          </Text>
          {session.task_title && (
            <Text style={styles.taskText} numberOfLines={1}>
              {session.task_title}
            </Text>
          )}
        </View>
      </CircularProgress>

      {/* Controls */}
      <View style={styles.controlsRow}>
        {session.status === 'focusing' && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={onPause}>
              <Ionicons name="pause" size={28} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.breakButton]}
              onPress={onBreak}
            >
              <Ionicons name="cafe" size={24} color="#FFF" />
              <Text style={styles.breakButtonText}>Break</Text>
            </TouchableOpacity>
          </>
        )}
        {session.status === 'paused' && (
          <TouchableOpacity style={styles.controlButton} onPress={onResume}>
            <Ionicons name="play" size={28} color="#FFF" />
          </TouchableOpacity>
        )}
        {session.status === 'break' && (
          <TouchableOpacity style={styles.controlButton} onPress={onResume}>
            <Ionicons name="play" size={24} color="#FFF" />
            <Text style={styles.controlButtonText}>Resume</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={onEnd}>
          <Ionicons name="stop" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// Session Stats Component
interface SessionStatsProps {
  session: FocusSession;
  stats: FocusStats;
}

const SessionStats: React.FC<SessionStatsProps> = ({ session, stats }) => {
  return (
    <View style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="flame" size={20} color="#FF6B6B" />
          <Text style={styles.statValue}>{session.focus_score}</Text>
          <Text style={styles.statLabel}>Focus Score</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="flash" size={20} color="#FFD700" />
          <Text style={styles.statValue}>{session.interruptions}</Text>
          <Text style={styles.statLabel}>Interruptions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time" size={20} color={ORACLE_COLORS.observe} />
          <Text style={styles.statValue}>{stats.today_focus_minutes}m</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={20} color={ORACLE_COLORS.act} />
          <Text style={styles.statValue}>{stats.current_streak}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>
    </View>
  );
};

// Start Session Modal
interface StartSessionModalProps {
  visible: boolean;
  onStart: (duration: number, task?: string, sound?: SoundType) => void;
  onDismiss: () => void;
}

const StartSessionModal: React.FC<StartSessionModalProps> = ({
  visible,
  onStart,
  onDismiss,
}) => {
  const [duration, setDuration] = useState(25);
  const [task, setTask] = useState('');
  const [sound, setSound] = useState<SoundType>('none');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Start Focus Session</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Duration Selection */}
          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.durationOptions}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.durationButton,
                  duration === d && styles.durationButtonActive,
                ]}
                onPress={() => setDuration(d)}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    duration === d && styles.durationButtonTextActive,
                  ]}
                >
                  {d}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sound Selection */}
          <Text style={styles.sectionLabel}>Background Sound</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.soundOptions}
          >
            {SOUND_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.type}
                style={[
                  styles.soundButton,
                  sound === s.type && styles.soundButtonActive,
                ]}
                onPress={() => setSound(s.type)}
              >
                <Ionicons
                  name={s.icon as any}
                  size={24}
                  color={sound === s.type ? ORACLE_COLORS.act : '#888'}
                />
                <Text
                  style={[
                    styles.soundButtonText,
                    sound === s.type && styles.soundButtonTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Start Button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => onStart(duration, task || undefined, sound)}
          >
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.startButtonText}>Start Focusing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// DND Indicator
const DNDIndicator: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <View style={styles.dndIndicator}>
      <Ionicons name="moon" size={14} color="#9B59B6" />
      <Text style={styles.dndText}>Do Not Disturb Active</Text>
    </View>
  );
};

// Main Component
export const FocusModeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [session, setSession] = useState<FocusSession | null>(null);
  const [stats, setStats] = useState<FocusStats>({
    today_focus_minutes: 45,
    today_sessions: 2,
    current_streak: 5,
    average_score: 85,
  });
  const [showStartModal, setShowStartModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Timer effect
  useEffect(() => {
    if (session?.status === 'focusing') {
      timerRef.current = setInterval(() => {
        setSession((prev) => {
          if (!prev) return null;

          const newElapsed = prev.elapsed_seconds + 1;

          // Check if session completed
          if (newElapsed >= prev.target_duration_minutes * 60) {
            Vibration.vibrate([0, 500, 200, 500]);
            Alert.alert(
              'Focus Session Complete!',
              `Great work! You focused for ${prev.target_duration_minutes} minutes.`,
              [{ text: 'Done', onPress: () => handleEndSession() }]
            );
            return { ...prev, elapsed_seconds: newElapsed, status: 'completed' };
          }

          return { ...prev, elapsed_seconds: newElapsed };
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [session?.status]);

  const handleStartSession = (duration: number, task?: string, sound?: SoundType) => {
    const newSession: FocusSession = {
      id: Date.now().toString(),
      status: 'focusing',
      target_duration_minutes: duration,
      elapsed_seconds: 0,
      task_title: task,
      sound_type: sound || 'none',
      interruptions: 0,
      focus_score: 100,
      start_time: new Date().toISOString(),
    };

    setSession(newSession);
    setShowStartModal(false);
  };

  const handlePauseSession = () => {
    if (session) {
      setSession({ ...session, status: 'paused' });
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleResumeSession = () => {
    if (session) {
      setSession({ ...session, status: 'focusing' });
    }
  };

  const handleEndSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (session) {
      const focusMinutes = Math.floor(session.elapsed_seconds / 60);
      setStats((prev) => ({
        ...prev,
        today_focus_minutes: prev.today_focus_minutes + focusMinutes,
        today_sessions: prev.today_sessions + 1,
      }));
    }

    setSession(null);
  };

  const handleTakeBreak = () => {
    if (session) {
      setSession({ ...session, status: 'break' });
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Auto-resume after 5 minutes
      setTimeout(() => {
        Alert.alert('Break Over', 'Ready to continue focusing?', [
          { text: 'End Session', onPress: handleEndSession, style: 'cancel' },
          { text: 'Continue', onPress: handleResumeSession },
        ]);
      }, 5 * 60 * 1000);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Focus Mode</Text>
        <DNDIndicator isActive={session?.status === 'focusing'} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {session ? (
          <>
            {/* Active Session */}
            <TimerDisplay
              session={session}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onEnd={handleEndSession}
              onBreak={handleTakeBreak}
            />

            {/* Session Stats */}
            <SessionStats session={session} stats={stats} />

            {/* Sound Indicator */}
            {session.sound_type !== 'none' && (
              <View style={styles.soundIndicator}>
                <Ionicons
                  name={SOUND_OPTIONS.find((s) => s.type === session.sound_type)?.icon as any || 'musical-notes'}
                  size={16}
                  color={ORACLE_COLORS.observe}
                />
                <Text style={styles.soundIndicatorText}>
                  {SOUND_OPTIONS.find((s) => s.type === session.sound_type)?.label}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Idle State */}
            <View style={styles.idleContainer}>
              <View style={styles.idleCircle}>
                <Ionicons name="flash" size={64} color={ORACLE_COLORS.act} />
              </View>
              <Text style={styles.idleTitle}>Ready to Focus?</Text>
              <Text style={styles.idleSubtitle}>
                Start a focus session to enter deep work mode
              </Text>

              <TouchableOpacity
                style={styles.startSessionButton}
                onPress={() => setShowStartModal(true)}
              >
                <Ionicons name="play" size={24} color="#000" />
                <Text style={styles.startSessionButtonText}>Start Session</Text>
              </TouchableOpacity>
            </View>

            {/* Today's Stats */}
            <View style={styles.todayStats}>
              <Text style={styles.todayStatsTitle}>Today's Progress</Text>
              <View style={styles.todayStatsRow}>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{stats.today_focus_minutes}</Text>
                  <Text style={styles.todayStatLabel}>minutes focused</Text>
                </View>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{stats.today_sessions}</Text>
                  <Text style={styles.todayStatLabel}>sessions</Text>
                </View>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{stats.average_score}%</Text>
                  <Text style={styles.todayStatLabel}>avg score</Text>
                </View>
              </View>
            </View>

            {/* Quick Start Options */}
            <View style={styles.quickStart}>
              <Text style={styles.quickStartTitle}>Quick Start</Text>
              <View style={styles.quickStartOptions}>
                {[25, 45, 60].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={styles.quickStartButton}
                    onPress={() => handleStartSession(mins)}
                  >
                    <Text style={styles.quickStartButtonText}>{mins}m</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </Animated.View>

      {/* Start Session Modal */}
      <StartSessionModal
        visible={showStartModal}
        onStart={handleStartSession}
        onDismiss={() => setShowStartModal(false)}
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
  dndIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D1F3D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  dndText: {
    fontSize: 12,
    color: '#9B59B6',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  circularContainer: {
    position: 'absolute',
  },
  circularBackground: {
    position: 'absolute',
  },
  progressRing: {
    position: 'absolute',
  },
  circularContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContent: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 56,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 8,
  },
  taskText: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 8,
    maxWidth: 180,
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  controlButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  breakButton: {
    width: 100,
    backgroundColor: '#2D3748',
  },
  breakButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: '#3D2020',
  },
  statsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginTop: 32,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  soundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    alignSelf: 'center',
  },
  soundIndicatorText: {
    fontSize: 14,
    color: ORACLE_COLORS.observe,
    fontWeight: '500',
  },
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  idleCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: ORACLE_COLORS.act,
  },
  idleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 24,
  },
  idleSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  startSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    marginTop: 32,
    gap: 8,
  },
  startSessionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  todayStats: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  todayStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  todayStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  todayStat: {
    alignItems: 'center',
  },
  todayStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
  },
  todayStatLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  quickStart: {
    marginTop: 24,
  },
  quickStartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  quickStartOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStartButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  quickStartButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    marginTop: 16,
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
  },
  durationButtonActive: {
    backgroundColor: `${ORACLE_COLORS.act}20`,
    borderColor: ORACLE_COLORS.act,
  },
  durationButtonText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  durationButtonTextActive: {
    color: ORACLE_COLORS.act,
  },
  soundOptions: {
    marginTop: 4,
  },
  soundButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0a0a0a',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 80,
  },
  soundButtonActive: {
    backgroundColor: `${ORACLE_COLORS.act}20`,
    borderColor: ORACLE_COLORS.act,
  },
  soundButtonText: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
  },
  soundButtonTextActive: {
    color: ORACLE_COLORS.act,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
    gap: 8,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
});

export default FocusModeScreen;
