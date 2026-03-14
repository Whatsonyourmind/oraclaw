/**
 * EnergyLogger Component
 * Energy and mood tracking input for ORACLE
 *
 * Features:
 * - Slider or emoji picker
 * - Quick note option
 * - Trend sparkline
 * - Suggestions based on energy
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width } = Dimensions.get('window');

// Types
type MoodType = 'energized' | 'focused' | 'calm' | 'happy' | 'motivated' |
  'neutral' | 'tired' | 'stressed' | 'anxious' | 'frustrated' | 'sad' | 'overwhelmed';

interface EnergyEntry {
  id: string;
  energy_level: number;
  mood: MoodType;
  notes?: string;
  timestamp: string;
}

interface EnergySuggestion {
  icon: string;
  title: string;
  description: string;
  type: 'action' | 'info';
}

// Constants
const MOOD_OPTIONS: { type: MoodType; emoji: string; label: string; color: string }[] = [
  { type: 'energized', emoji: '🔥', label: 'Energized', color: '#FF6B6B' },
  { type: 'focused', emoji: '🎯', label: 'Focused', color: '#2196F3' },
  { type: 'calm', emoji: '😌', label: 'Calm', color: '#4CAF50' },
  { type: 'happy', emoji: '😊', label: 'Happy', color: '#FFD700' },
  { type: 'motivated', emoji: '💪', label: 'Motivated', color: '#9C27B0' },
  { type: 'neutral', emoji: '😐', label: 'Neutral', color: '#888' },
  { type: 'tired', emoji: '😴', label: 'Tired', color: '#607D8B' },
  { type: 'stressed', emoji: '😰', label: 'Stressed', color: '#FF9800' },
  { type: 'anxious', emoji: '😟', label: 'Anxious', color: '#E91E63' },
  { type: 'frustrated', emoji: '😤', label: 'Frustrated', color: '#F44336' },
  { type: 'sad', emoji: '😢', label: 'Sad', color: '#3F51B5' },
  { type: 'overwhelmed', emoji: '🤯', label: 'Overwhelmed', color: '#795548' },
];

const ENERGY_LABELS = ['Very Low', 'Low', 'Below Average', 'Average', 'Good', 'Very Good', 'High', 'Very High', 'Peak', 'Maximum'];

// Energy Slider Component
interface EnergySliderProps {
  value: number;
  onChange: (value: number) => void;
}

const EnergySlider: React.FC<EnergySliderProps> = ({ value, onChange }) => {
  const getColor = (level: number) => {
    if (level <= 3) return '#FF6B6B';
    if (level <= 5) return '#FF9800';
    if (level <= 7) return '#FFD700';
    return ORACLE_COLORS.act;
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelLeft}>Low</Text>
        <Text style={[styles.sliderValue, { color: getColor(value) }]}>{value}</Text>
        <Text style={styles.sliderLabelRight}>High</Text>
      </View>
      <View style={styles.sliderTrack}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.sliderDot,
              level <= value && { backgroundColor: getColor(value) },
              level === value && styles.sliderDotActive,
            ]}
            onPress={() => onChange(level)}
          />
        ))}
      </View>
      <Text style={styles.sliderLabel}>{ENERGY_LABELS[value - 1]}</Text>
    </View>
  );
};

// Mood Picker Component
interface MoodPickerProps {
  selected: MoodType | null;
  onSelect: (mood: MoodType) => void;
}

const MoodPicker: React.FC<MoodPickerProps> = ({ selected, onSelect }) => {
  return (
    <View style={styles.moodPicker}>
      <Text style={styles.sectionTitle}>How are you feeling?</Text>
      <View style={styles.moodGrid}>
        {MOOD_OPTIONS.map((mood) => (
          <TouchableOpacity
            key={mood.type}
            style={[
              styles.moodOption,
              selected === mood.type && { backgroundColor: `${mood.color}20`, borderColor: mood.color },
            ]}
            onPress={() => onSelect(mood.type)}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text style={[styles.moodLabel, selected === mood.type && { color: mood.color }]}>
              {mood.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Trend Sparkline Component
interface SparklineProps {
  data: number[];
  color?: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color = ORACLE_COLORS.observe }) => {
  const maxValue = Math.max(...data, 10);
  const height = 40;

  return (
    <View style={styles.sparkline}>
      {data.map((value, index) => {
        const barHeight = (value / maxValue) * height;
        return (
          <View
            key={index}
            style={[
              styles.sparklineBar,
              {
                height: barHeight,
                backgroundColor: index === data.length - 1 ? color : `${color}60`,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

// Suggestion Card Component
interface SuggestionCardProps {
  suggestion: EnergySuggestion;
  onPress?: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, onPress }) => {
  return (
    <TouchableOpacity style={styles.suggestionCard} onPress={onPress}>
      <View style={styles.suggestionIcon}>
        <Ionicons name={suggestion.icon as any} size={24} color={ORACLE_COLORS.observe} />
      </View>
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
        <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
      </View>
      {suggestion.type === 'action' && (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );
};

// Recent Entries Component
interface RecentEntriesProps {
  entries: EnergyEntry[];
}

const RecentEntries: React.FC<RecentEntriesProps> = ({ entries }) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <View style={styles.recentEntries}>
      <Text style={styles.sectionTitle}>Today's Log</Text>
      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No entries yet today</Text>
      ) : (
        entries.map((entry) => {
          const moodConfig = MOOD_OPTIONS.find((m) => m.type === entry.mood);
          return (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
              <View style={styles.entryEnergy}>
                <View
                  style={[
                    styles.energyBadge,
                    { backgroundColor: entry.energy_level > 5 ? `${ORACLE_COLORS.act}30` : '#FF6B6B30' },
                  ]}
                >
                  <Text
                    style={[
                      styles.energyBadgeText,
                      { color: entry.energy_level > 5 ? ORACLE_COLORS.act : '#FF6B6B' },
                    ]}
                  >
                    {entry.energy_level}/10
                  </Text>
                </View>
              </View>
              <Text style={styles.entryMood}>{moodConfig?.emoji}</Text>
              {entry.notes && (
                <Text style={styles.entryNotes} numberOfLines={1}>
                  {entry.notes}
                </Text>
              )}
            </View>
          );
        })
      )}
    </View>
  );
};

// Stats Card Component
interface StatsCardProps {
  averageEnergy: number;
  commonMood: MoodType;
  trendData: number[];
}

const StatsCard: React.FC<StatsCardProps> = ({ averageEnergy, commonMood, trendData }) => {
  const moodConfig = MOOD_OPTIONS.find((m) => m.type === commonMood);

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Average Energy</Text>
          <Text style={styles.statValue}>{averageEnergy.toFixed(1)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Common Mood</Text>
          <View style={styles.moodStat}>
            <Text style={styles.statMoodEmoji}>{moodConfig?.emoji}</Text>
            <Text style={styles.statMoodLabel}>{moodConfig?.label}</Text>
          </View>
        </View>
      </View>
      <View style={styles.trendSection}>
        <Text style={styles.trendLabel}>7-Day Trend</Text>
        <Sparkline data={trendData} />
      </View>
    </View>
  );
};

// Main Component
export const EnergyLogger: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [energyLevel, setEnergyLevel] = useState(5);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [entries, setEntries] = useState<EnergyEntry[]>([
    { id: '1', energy_level: 7, mood: 'focused', timestamp: '2026-02-01T09:00:00Z' },
    { id: '2', energy_level: 5, mood: 'neutral', timestamp: '2026-02-01T13:00:00Z' },
  ]);
  const [isLogging, setIsLogging] = useState(false);

  const trendData = [6, 7, 5, 6, 8, 7, 6];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const getSuggestions = (): EnergySuggestion[] => {
    if (energyLevel <= 3) {
      return [
        { icon: 'cafe', title: 'Take a break', description: 'Low energy - consider a short rest or snack', type: 'action' },
        { icon: 'water', title: 'Stay hydrated', description: 'Drink some water to boost energy', type: 'action' },
        { icon: 'walk', title: 'Light movement', description: 'A short walk can help increase alertness', type: 'action' },
      ];
    } else if (energyLevel >= 8) {
      return [
        { icon: 'flash', title: 'Peak performance time', description: 'Great time for challenging tasks', type: 'info' },
        { icon: 'code-working', title: 'Deep work', description: 'Your energy is optimal for focused work', type: 'action' },
      ];
    }
    return [
      { icon: 'checkmark-circle', title: 'Good energy level', description: 'You\'re in a balanced state', type: 'info' },
    ];
  };

  const handleLogEnergy = () => {
    if (!selectedMood) {
      return;
    }

    setIsLogging(true);

    const newEntry: EnergyEntry = {
      id: Date.now().toString(),
      energy_level: energyLevel,
      mood: selectedMood,
      notes: notes || undefined,
      timestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      setEntries([newEntry, ...entries]);
      setSelectedMood(null);
      setNotes('');
      setEnergyLevel(5);
      setIsLogging(false);
    }, 500);
  };

  const suggestions = getSuggestions();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Energy Log</Text>
        <TouchableOpacity>
          <Ionicons name="analytics-outline" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView style={[styles.content, { opacity: fadeAnim }]}>
        {/* Energy Slider */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Energy Level</Text>
          <EnergySlider value={energyLevel} onChange={setEnergyLevel} />
        </View>

        {/* Mood Picker */}
        <View style={styles.card}>
          <MoodPicker selected={selectedMood} onSelect={setSelectedMood} />
        </View>

        {/* Notes Section */}
        <TouchableOpacity
          style={styles.notesToggle}
          onPress={() => setShowNotes(!showNotes)}
        >
          <Ionicons
            name={showNotes ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#888"
          />
          <Text style={styles.notesToggleText}>
            {showNotes ? 'Hide notes' : 'Add a note (optional)'}
          </Text>
        </TouchableOpacity>

        {showNotes && (
          <View style={styles.notesContainer}>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How are you feeling? What's affecting your energy?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* Log Button */}
        <TouchableOpacity
          style={[
            styles.logButton,
            !selectedMood && styles.logButtonDisabled,
          ]}
          onPress={handleLogEnergy}
          disabled={!selectedMood || isLogging}
        >
          {isLogging ? (
            <Text style={styles.logButtonText}>Logging...</Text>
          ) : (
            <>
              <Ionicons name="add-circle" size={24} color="#000" />
              <Text style={styles.logButtonText}>Log Energy</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Suggestions */}
        <View style={styles.suggestionsSection}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {suggestions.map((suggestion, index) => (
            <SuggestionCard key={index} suggestion={suggestion} />
          ))}
        </View>

        {/* Stats */}
        <StatsCard
          averageEnergy={6.2}
          commonMood="focused"
          trendData={trendData}
        />

        {/* Recent Entries */}
        <RecentEntries entries={entries} />

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
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
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  sliderContainer: {
    alignItems: 'center',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  sliderLabelLeft: {
    fontSize: 14,
    color: '#888',
  },
  sliderLabelRight: {
    fontSize: 14,
    color: '#888',
  },
  sliderValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  sliderLabel: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  sliderDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  sliderDotActive: {
    transform: [{ scale: 1.3 }],
    borderWidth: 2,
    borderColor: '#FFF',
  },
  moodPicker: {},
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moodOption: {
    width: (width - 80) / 4,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  notesToggleText: {
    fontSize: 14,
    color: '#888',
  },
  notesContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  notesInput: {
    minHeight: 80,
    padding: 12,
    fontSize: 15,
    color: '#FFF',
    textAlignVertical: 'top',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  logButtonDisabled: {
    backgroundColor: '#333',
  },
  logButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  suggestionsSection: {
    marginBottom: 20,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${ORACLE_COLORS.observe}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  suggestionDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
  },
  moodStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statMoodEmoji: {
    fontSize: 28,
  },
  statMoodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  trendSection: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 16,
  },
  trendLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    gap: 4,
  },
  sparklineBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  recentEntries: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  entryTime: {
    fontSize: 14,
    color: '#888',
    width: 60,
  },
  entryEnergy: {},
  energyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  energyBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  entryMood: {
    fontSize: 20,
  },
  entryNotes: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
});

export default EnergyLogger;
