/**
 * PomodoroTimer Component
 * Pomodoro technique timer widget for ORACLE
 *
 * Features:
 * - Circular progress timer
 * - Work/break indicator
 * - Session count
 * - Sound/vibration controls
 * - Mini mode for overlay
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
  Vibration,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width } = Dimensions.get('window');

// Types
type PomodoroPhase = 'work' | 'short_break' | 'long_break';
type PomodoroStatus = 'idle' | 'working' | 'short_break' | 'long_break' | 'paused';

interface PomodoroSession {
  id: string;
  status: PomodoroStatus;
  phase: PomodoroPhase;
  current_pomodoro: number;
  total_pomodoros: number;
  work_duration: number; // minutes
  short_break_duration: number;
  long_break_duration: number;
  elapsed_seconds: number;
  task_title?: string;
}

interface PomodoroStats {
  today_pomodoros: number;
  current_chain: number;
  longest_chain: number;
  total_focus_minutes: number;
}

// Constants
const DEFAULT_WORK_DURATION = 25;
const DEFAULT_SHORT_BREAK = 5;
const DEFAULT_LONG_BREAK = 15;
const POMODOROS_BEFORE_LONG_BREAK = 4;

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  work: ORACLE_COLORS.act,
  short_break: ORACLE_COLORS.observe,
  long_break: ORACLE_COLORS.orient,
};

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: 'FOCUS',
  short_break: 'SHORT BREAK',
  long_break: 'LONG BREAK',
};

// Circular Timer Component
interface CircularTimerProps {
  progress: number;
  phase: PomodoroPhase;
  minutes: number;
  seconds: number;
  isPaused: boolean;
  size?: number;
}

const CircularTimer: React.FC<CircularTimerProps> = ({
  progress,
  phase,
  minutes,
  seconds,
  isPaused,
  size = 260,
}) => {
  const color = PHASE_COLORS[phase];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!isPaused) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      glow.start();
      return () => glow.stop();
    }
  }, [isPaused]);

  return (
    <View style={[styles.timerCircle, { width: size, height: size }]}>
      {/* Background ring */}
      <View
        style={[
          styles.timerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: '#333',
          },
        ]}
      />

      {/* Progress ring */}
      <Animated.View
        style={[
          styles.timerProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: glowAnim,
            transform: [{ rotate: `${progress * 360 - 90}deg` }],
          },
        ]}
      />

      {/* Inner content */}
      <View style={styles.timerInner}>
        <Text style={[styles.timerMinutes, { color }]}>
          {String(minutes).padStart(2, '0')}
        </Text>
        <Text style={styles.timerSeparator}>:</Text>
        <Text style={[styles.timerSeconds, { color }]}>
          {String(seconds).padStart(2, '0')}
        </Text>
      </View>

      {/* Phase label */}
      <View style={[styles.phaseLabel, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.phaseLabelText, { color }]}>
          {PHASE_LABELS[phase]}
        </Text>
      </View>

      {/* Paused indicator */}
      {isPaused && (
        <View style={styles.pausedOverlay}>
          <Ionicons name="pause" size={32} color="#FFF" />
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      )}
    </View>
  );
};

// Session Counter Component
interface SessionCounterProps {
  current: number;
  total: number;
  phase: PomodoroPhase;
}

const SessionCounter: React.FC<SessionCounterProps> = ({ current, total, phase }) => {
  const dots = Array.from({ length: total }, (_, i) => i + 1);
  const color = PHASE_COLORS[phase];

  return (
    <View style={styles.sessionCounter}>
      {dots.map((num) => (
        <View
          key={num}
          style={[
            styles.sessionDot,
            num <= current && { backgroundColor: color },
            num === current && phase === 'work' && styles.sessionDotActive,
          ]}
        >
          {num <= current && (
            <Ionicons name="checkmark" size={12} color="#000" />
          )}
        </View>
      ))}
    </View>
  );
};

// Stats Bar Component
interface StatsBarProps {
  stats: PomodoroStats;
}

const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Ionicons name="flame" size={18} color="#FF6B6B" />
        <Text style={styles.statValue}>{stats.today_pomodoros}</Text>
        <Text style={styles.statLabel}>Today</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="link" size={18} color={ORACLE_COLORS.act} />
        <Text style={styles.statValue}>{stats.current_chain}</Text>
        <Text style={styles.statLabel}>Chain</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="time" size={18} color={ORACLE_COLORS.observe} />
        <Text style={styles.statValue}>{stats.total_focus_minutes}m</Text>
        <Text style={styles.statLabel}>Focus</Text>
      </View>
    </View>
  );
};

// Break Suggestion Component
interface BreakSuggestionProps {
  visible: boolean;
  suggestion: string;
  onDismiss: () => void;
}

const BreakSuggestion: React.FC<BreakSuggestionProps> = ({
  visible,
  suggestion,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.breakSuggestion}>
      <Ionicons name="bulb" size={20} color="#FFD700" />
      <Text style={styles.breakSuggestionText}>{suggestion}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={20} color="#888" />
      </TouchableOpacity>
    </View>
  );
};

// Settings Modal
interface SettingsModalProps {
  visible: boolean;
  workDuration: number;
  shortBreak: number;
  longBreak: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onSave: (settings: {
    workDuration: number;
    shortBreak: number;
    longBreak: number;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  }) => void;
  onDismiss: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  workDuration,
  shortBreak,
  longBreak,
  soundEnabled,
  vibrationEnabled,
  onSave,
  onDismiss,
}) => {
  const [work, setWork] = useState(workDuration);
  const [short, setShort] = useState(shortBreak);
  const [long, setLong] = useState(longBreak);
  const [sound, setSound] = useState(soundEnabled);
  const [vibration, setVibration] = useState(vibrationEnabled);

  const handleSave = () => {
    onSave({
      workDuration: work,
      shortBreak: short,
      longBreak: long,
      soundEnabled: sound,
      vibrationEnabled: vibration,
    });
    onDismiss();
  };

  const DurationSelector: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
  }> = ({ label, value, onChange, min, max }) => (
    <View style={styles.durationSelector}>
      <Text style={styles.durationLabel}>{label}</Text>
      <View style={styles.durationControls}>
        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => onChange(Math.max(min, value - 5))}
        >
          <Ionicons name="remove" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.durationValue}>{value}m</Text>
        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => onChange(Math.min(max, value + 5))}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Timer Settings</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <DurationSelector
            label="Focus Duration"
            value={work}
            onChange={setWork}
            min={5}
            max={60}
          />
          <DurationSelector
            label="Short Break"
            value={short}
            onChange={setShort}
            min={1}
            max={15}
          />
          <DurationSelector
            label="Long Break"
            value={long}
            onChange={setLong}
            min={5}
            max={30}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Sound</Text>
            <TouchableOpacity
              style={[styles.toggle, sound && styles.toggleActive]}
              onPress={() => setSound(!sound)}
            >
              <View style={[styles.toggleKnob, sound && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Vibration</Text>
            <TouchableOpacity
              style={[styles.toggle, vibration && styles.toggleActive]}
              onPress={() => setVibration(!vibration)}
            >
              <View style={[styles.toggleKnob, vibration && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
export const PomodoroTimer: React.FC<{ mini?: boolean }> = ({ mini = false }) => {
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [stats, setStats] = useState<PomodoroStats>({
    today_pomodoros: 3,
    current_chain: 2,
    longest_chain: 5,
    total_focus_minutes: 75,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [breakSuggestion, setBreakSuggestion] = useState<string | null>(null);

  // Settings
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_DURATION);
  const [shortBreak, setShortBreak] = useState(DEFAULT_SHORT_BREAK);
  const [longBreak, setLongBreak] = useState(DEFAULT_LONG_BREAK);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Break suggestions
  const breakSuggestions = [
    'Stand up and stretch your body',
    'Walk to get some water',
    'Look at something far away for 20 seconds',
    'Take 5 deep breaths',
    'Step outside for fresh air',
  ];

  // Timer effect
  useEffect(() => {
    if (session && ['working', 'short_break', 'long_break'].includes(session.status)) {
      timerRef.current = setInterval(() => {
        setSession((prev) => {
          if (!prev) return null;

          const phaseDuration =
            prev.phase === 'work' ? prev.work_duration :
            prev.phase === 'short_break' ? prev.short_break_duration :
            prev.long_break_duration;

          const newElapsed = prev.elapsed_seconds + 1;

          // Phase completed
          if (newElapsed >= phaseDuration * 60) {
            if (vibrationEnabled) {
              Vibration.vibrate([0, 500, 200, 500]);
            }

            if (prev.phase === 'work') {
              // Work phase completed
              const newPomodoro = prev.current_pomodoro + 1;
              const isLongBreak = newPomodoro % POMODOROS_BEFORE_LONG_BREAK === 0;

              setStats((s) => ({
                ...s,
                today_pomodoros: s.today_pomodoros + 1,
                total_focus_minutes: s.total_focus_minutes + prev.work_duration,
                current_chain: s.current_chain + 1,
              }));

              // Show break suggestion
              setBreakSuggestion(
                breakSuggestions[Math.floor(Math.random() * breakSuggestions.length)]
              );

              return {
                ...prev,
                phase: isLongBreak ? 'long_break' : 'short_break',
                status: isLongBreak ? 'long_break' : 'short_break',
                current_pomodoro: newPomodoro,
                elapsed_seconds: 0,
              };
            } else {
              // Break completed - back to work
              return {
                ...prev,
                phase: 'work',
                status: 'working',
                elapsed_seconds: 0,
              };
            }
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
  }, [session?.status, vibrationEnabled]);

  const startSession = () => {
    setSession({
      id: Date.now().toString(),
      status: 'working',
      phase: 'work',
      current_pomodoro: 0,
      total_pomodoros: POMODOROS_BEFORE_LONG_BREAK,
      work_duration: workDuration,
      short_break_duration: shortBreak,
      long_break_duration: longBreak,
      elapsed_seconds: 0,
    });
  };

  const pauseSession = () => {
    if (session) {
      setSession({ ...session, status: 'paused' });
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeSession = () => {
    if (session) {
      const status =
        session.phase === 'work' ? 'working' :
        session.phase === 'short_break' ? 'short_break' : 'long_break';
      setSession({ ...session, status });
    }
  };

  const skipPhase = () => {
    if (!session) return;

    if (session.phase === 'work') {
      // Complete the pomodoro early
      const newPomodoro = session.current_pomodoro + 1;
      const isLongBreak = newPomodoro % POMODOROS_BEFORE_LONG_BREAK === 0;

      setSession({
        ...session,
        phase: isLongBreak ? 'long_break' : 'short_break',
        status: isLongBreak ? 'long_break' : 'short_break',
        current_pomodoro: newPomodoro,
        elapsed_seconds: 0,
      });
    } else {
      // Skip break
      setSession({
        ...session,
        phase: 'work',
        status: 'working',
        elapsed_seconds: 0,
      });
    }
    setBreakSuggestion(null);
  };

  const resetSession = () => {
    Alert.alert(
      'Reset Session',
      'Are you sure you want to reset the current session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            setSession(null);
            setBreakSuggestion(null);
          },
        },
      ]
    );
  };

  const handleSaveSettings = (settings: {
    workDuration: number;
    shortBreak: number;
    longBreak: number;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  }) => {
    setWorkDuration(settings.workDuration);
    setShortBreak(settings.shortBreak);
    setLongBreak(settings.longBreak);
    setSoundEnabled(settings.soundEnabled);
    setVibrationEnabled(settings.vibrationEnabled);
  };

  // Calculate timer values
  const phaseDuration = session
    ? session.phase === 'work' ? session.work_duration
      : session.phase === 'short_break' ? session.short_break_duration
      : session.long_break_duration
    : workDuration;

  const remainingSeconds = session
    ? Math.max(0, phaseDuration * 60 - session.elapsed_seconds)
    : phaseDuration * 60;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progress = session ? session.elapsed_seconds / (phaseDuration * 60) : 0;

  if (mini) {
    // Mini mode for overlay/widget
    return (
      <View style={styles.miniContainer}>
        <View style={styles.miniTimer}>
          <Text style={styles.miniTime}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
          <Text style={[styles.miniPhase, { color: session ? PHASE_COLORS[session.phase] : '#888' }]}>
            {session ? PHASE_LABELS[session.phase] : 'READY'}
          </Text>
        </View>
        <View style={styles.miniControls}>
          {!session ? (
            <TouchableOpacity onPress={startSession}>
              <Ionicons name="play" size={24} color={ORACLE_COLORS.act} />
            </TouchableOpacity>
          ) : session.status === 'paused' ? (
            <TouchableOpacity onPress={resumeSession}>
              <Ionicons name="play" size={24} color={ORACLE_COLORS.act} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={pauseSession}>
              <Ionicons name="pause" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pomodoro</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-outline" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Timer */}
        <CircularTimer
          progress={progress}
          phase={session?.phase || 'work'}
          minutes={minutes}
          seconds={seconds}
          isPaused={session?.status === 'paused'}
        />

        {/* Session Counter */}
        {session && (
          <SessionCounter
            current={session.current_pomodoro}
            total={session.total_pomodoros}
            phase={session.phase}
          />
        )}

        {/* Break Suggestion */}
        <BreakSuggestion
          visible={breakSuggestion !== null && session?.phase !== 'work'}
          suggestion={breakSuggestion || ''}
          onDismiss={() => setBreakSuggestion(null)}
        />

        {/* Controls */}
        <View style={styles.controls}>
          {!session ? (
            <TouchableOpacity style={styles.primaryButton} onPress={startSession}>
              <Ionicons name="play" size={28} color="#000" />
              <Text style={styles.primaryButtonText}>Start</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={skipPhase}>
                <Ionicons name="play-skip-forward" size={20} color="#FFF" />
              </TouchableOpacity>

              {session.status === 'paused' ? (
                <TouchableOpacity style={styles.primaryButton} onPress={resumeSession}>
                  <Ionicons name="play" size={28} color="#000" />
                  <Text style={styles.primaryButtonText}>Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.primaryButton} onPress={pauseSession}>
                  <Ionicons name="pause" size={28} color="#000" />
                  <Text style={styles.primaryButtonText}>Pause</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={resetSession}>
                <Ionicons name="refresh" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Info Text */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>The Pomodoro Technique</Text>
          <Text style={styles.infoText}>
            Work for {workDuration} minutes, then take a {shortBreak}-minute break.
            After {POMODOROS_BEFORE_LONG_BREAK} pomodoros, take a longer {longBreak}-minute break.
          </Text>
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        workDuration={workDuration}
        shortBreak={shortBreak}
        longBreak={longBreak}
        soundEnabled={soundEnabled}
        vibrationEnabled={vibrationEnabled}
        onSave={handleSaveSettings}
        onDismiss={() => setShowSettings(false)}
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
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  timerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  timerRing: {
    position: 'absolute',
    borderWidth: 8,
  },
  timerProgress: {
    position: 'absolute',
    borderWidth: 8,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  timerInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timerMinutes: {
    fontSize: 64,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  timerSeparator: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#888',
    marginHorizontal: 4,
  },
  timerSeconds: {
    fontSize: 64,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  phaseLabel: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  phaseLabelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  sessionCounter: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  sessionDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionDotActive: {
    transform: [{ scale: 1.1 }],
  },
  breakSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2500',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  breakSuggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#FFD700',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  secondaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginTop: 40,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  infoSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '100%',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
  miniContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  miniTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  miniPhase: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  miniControls: {
    flexDirection: 'row',
    gap: 12,
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
  durationSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  durationLabel: {
    fontSize: 16,
    color: '#FFF',
  },
  durationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  durationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValue: {
    fontSize: 18,
    fontWeight: '600',
    color: ORACLE_COLORS.act,
    minWidth: 50,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#FFF',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: ORACLE_COLORS.act,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#888',
  },
  toggleKnobActive: {
    backgroundColor: '#000',
    marginLeft: 22,
  },
  saveButton: {
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});

export default PomodoroTimer;
