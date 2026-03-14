/**
 * BriefingScreen Component
 * Main briefing view with sections and reveal animations
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';
import { BriefingCard, BriefingSectionData } from './BriefingCard';
import { BriefingTimeline, TimelineItem, CompactTimeline } from './BriefingTimeline';
import { BriefingAudio, CompactAudioPlayer } from './BriefingAudio';
import BriefingSettings, { BriefingPreferences } from './BriefingSettings';

const { width, height } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

export type BriefingType = 'morning' | 'evening' | 'weekly' | 'sitrep' | 'executive';
export type ViewMode = 'sections' | 'timeline' | 'audio';

export interface BriefingData {
  type: BriefingType;
  title: string;
  greeting?: string;
  sections: BriefingSectionData[];
  signOff?: string;
  quote?: string;
  generatedAt: string;
  audioScript?: string;
  timelineItems?: TimelineItem[];
  metadata?: {
    totalDuration?: number;
    highlights?: number;
    actionItems?: number;
  };
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_MORNING_BRIEFING: BriefingData = {
  type: 'morning',
  title: 'Morning Briefing',
  greeting: 'Good morning! Today is full of possibilities.',
  sections: [
    {
      type: 'priorities',
      title: "Today's Priorities",
      content: [
        '[CRITICAL] Complete Q4 report draft (due 5:00 PM)',
        '[HIGH] Review team proposals',
        '[MEDIUM] Update project timeline',
        'Send weekly status update',
      ],
      metadata: { count: 4, priority: 'high' },
    },
    {
      type: 'meetings',
      title: 'Scheduled Meetings',
      content: [
        '9:00 AM - Daily Standup (15 min)',
        '11:00 AM - Product Review (1 hr)',
        '2:00 PM - Client Call (30 min)',
        '4:00 PM - Team 1:1 (30 min)',
      ],
      metadata: { count: 4 },
    },
    {
      type: 'deadlines',
      title: 'Approaching Deadlines',
      content: [
        '[CRITICAL] Q4 Report - TODAY',
        '[HIGH] Budget Approval - 2 days',
        'Sprint Demo - 3 days',
      ],
      metadata: { count: 3 },
    },
    {
      type: 'risks',
      title: 'Risks to Monitor',
      content: [
        '[HIGH] Resource availability for next sprint (60% probability)',
        '[MEDIUM] API dependency on third-party service',
      ],
      metadata: { count: 2 },
    },
    {
      type: 'weather',
      title: 'Weather & Commute',
      content: 'New York: Partly Cloudy, 65F (High: 72F, Low: 58F). Great day for outdoor lunch!',
    },
    {
      type: 'recommendations',
      title: 'ORACLE Recommendations',
      content: [
        'Block 9-11 AM for Q4 report - your peak energy time',
        'Prepare client call agenda before lunch',
        'Consider walking meeting for 1:1 given good weather',
      ],
      metadata: { count: 3 },
    },
  ],
  signOff: "You've got this! Make today count.",
  quote: '"The key is not to prioritize what\'s on your schedule, but to schedule your priorities." - Stephen Covey',
  generatedAt: new Date().toISOString(),
  audioScript: `Good morning! Here is your morning briefing for ${new Date().toLocaleDateString()}.

TODAY'S PRIORITIES:
1. Critical: Complete Q4 report draft, due at 5:00 PM.
2. High priority: Review team proposals.
3. Update project timeline.
4. Send weekly status update.

MEETINGS:
You have 4 meetings scheduled today.
1. 9:00 AM, Daily Standup for 15 minutes.
2. 11:00 AM, Product Review for 1 hour.
3. 2:00 PM, Client Call for 30 minutes.
4. 4:00 PM, Team 1:1 for 30 minutes.

DEADLINES:
Critical deadline: Q4 Report is due TODAY.
Budget Approval is due in 2 days.

RECOMMENDATIONS:
Block 9 to 11 AM for Q4 report. This is your peak energy time.
Prepare client call agenda before lunch.

You've got this! Make today count.`,
  timelineItems: [
    { id: '1', type: 'task', title: 'Morning Focus Block', time: new Date().setHours(8, 0, 0, 0).toString(), status: 'upcoming', priority: 'high' },
    { id: '2', type: 'meeting', title: 'Daily Standup', time: new Date().setHours(9, 0, 0, 0).toString(), endTime: new Date().setHours(9, 15, 0, 0).toString(), status: 'completed', attendees: 5 },
    { id: '3', type: 'task', title: 'Q4 Report Work', time: new Date().setHours(9, 30, 0, 0).toString(), endTime: new Date().setHours(11, 0, 0, 0).toString(), status: 'in_progress', priority: 'critical', progress: 45 },
    { id: '4', type: 'meeting', title: 'Product Review', time: new Date().setHours(11, 0, 0, 0).toString(), endTime: new Date().setHours(12, 0, 0, 0).toString(), status: 'upcoming', location: 'Conference Room A', attendees: 8 },
    { id: '5', type: 'break', title: 'Lunch', time: new Date().setHours(12, 30, 0, 0).toString(), endTime: new Date().setHours(13, 0, 0, 0).toString(), status: 'upcoming' },
    { id: '6', type: 'meeting', title: 'Client Call', time: new Date().setHours(14, 0, 0, 0).toString(), endTime: new Date().setHours(14, 30, 0, 0).toString(), status: 'upcoming', attendees: 3 },
    { id: '7', type: 'task', title: 'Review Team Proposals', time: new Date().setHours(15, 0, 0, 0).toString(), status: 'upcoming', priority: 'high' },
    { id: '8', type: 'meeting', title: 'Team 1:1', time: new Date().setHours(16, 0, 0, 0).toString(), endTime: new Date().setHours(16, 30, 0, 0).toString(), status: 'upcoming', attendees: 2 },
    { id: '9', type: 'deadline', title: 'Q4 Report Due', time: new Date().setHours(17, 0, 0, 0).toString(), status: 'upcoming', priority: 'critical' },
  ],
  metadata: {
    totalDuration: 180000,
    highlights: 3,
    actionItems: 4,
  },
};

// ============================================================================
// Briefing Type Config
// ============================================================================

const BRIEFING_TYPE_CONFIG: Record<BriefingType, { icon: string; color: string; label: string }> = {
  morning: { icon: 'sunny', color: ORACLE_COLORS.orient, label: 'Morning' },
  evening: { icon: 'moon', color: ORACLE_COLORS.observe, label: 'Evening' },
  weekly: { icon: 'calendar', color: ORACLE_COLORS.act, label: 'Weekly' },
  sitrep: { icon: 'radio', color: '#FF6B6B', label: 'SITREP' },
  executive: { icon: 'briefcase', color: '#9C27B0', label: 'Executive' },
};

// ============================================================================
// Header Component
// ============================================================================

interface BriefingHeaderProps {
  briefing: BriefingData;
  onSettingsPress: () => void;
  onRefresh: () => void;
}

const BriefingHeader: React.FC<BriefingHeaderProps> = ({ briefing, onSettingsPress, onRefresh }) => {
  const revealAnim = useRef(new Animated.Value(0)).current;
  const typeConfig = BRIEFING_TYPE_CONFIG[briefing.type];

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const formatDate = () => {
    const date = new Date(briefing.generatedAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Animated.View
      style={[
        styles.header,
        { opacity: revealAnim, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.headerTop}>
        <View style={[styles.typeBadge, { backgroundColor: `${typeConfig.color}20` }]}>
          <Ionicons name={typeConfig.icon as any} size={16} color={typeConfig.color} />
          <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress}>
            <Ionicons name="settings-outline" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>{briefing.title}</Text>
      <Text style={styles.date}>{formatDate()}</Text>

      {briefing.greeting && (
        <Text style={styles.greeting}>{briefing.greeting}</Text>
      )}
    </Animated.View>
  );
};

// ============================================================================
// View Mode Tabs Component
// ============================================================================

interface ViewModeTabsProps {
  activeMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  hasAudio: boolean;
  hasTimeline: boolean;
}

const ViewModeTabs: React.FC<ViewModeTabsProps> = ({ activeMode, onChange, hasAudio, hasTimeline }) => {
  return (
    <View style={styles.viewModeTabs}>
      <TouchableOpacity
        style={[styles.viewModeTab, activeMode === 'sections' && styles.viewModeTabActive]}
        onPress={() => onChange('sections')}
      >
        <Ionicons
          name="list"
          size={18}
          color={activeMode === 'sections' ? ORACLE_COLORS.observe : '#888'}
        />
        <Text style={[styles.viewModeText, activeMode === 'sections' && styles.viewModeTextActive]}>
          Sections
        </Text>
      </TouchableOpacity>

      {hasTimeline && (
        <TouchableOpacity
          style={[styles.viewModeTab, activeMode === 'timeline' && styles.viewModeTabActive]}
          onPress={() => onChange('timeline')}
        >
          <Ionicons
            name="git-commit"
            size={18}
            color={activeMode === 'timeline' ? ORACLE_COLORS.observe : '#888'}
          />
          <Text style={[styles.viewModeText, activeMode === 'timeline' && styles.viewModeTextActive]}>
            Timeline
          </Text>
        </TouchableOpacity>
      )}

      {hasAudio && (
        <TouchableOpacity
          style={[styles.viewModeTab, activeMode === 'audio' && styles.viewModeTabActive]}
          onPress={() => onChange('audio')}
        >
          <Ionicons
            name="headset"
            size={18}
            color={activeMode === 'audio' ? ORACLE_COLORS.observe : '#888'}
          />
          <Text style={[styles.viewModeText, activeMode === 'audio' && styles.viewModeTextActive]}>
            Listen
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// Footer Component
// ============================================================================

interface BriefingFooterProps {
  signOff?: string;
  quote?: string;
}

const BriefingFooter: React.FC<BriefingFooterProps> = ({ signOff, quote }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
      {signOff && <Text style={styles.signOff}>{signOff}</Text>}
      {quote && (
        <View style={styles.quoteContainer}>
          <Ionicons name="chatbox-ellipses" size={16} color="#555" />
          <Text style={styles.quote}>{quote}</Text>
        </View>
      )}
    </Animated.View>
  );
};

// ============================================================================
// Main BriefingScreen Component
// ============================================================================

export const BriefingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [briefing, setBriefing] = useState<BriefingData>(MOCK_MORNING_BRIEFING);
  const [viewMode, setViewMode] = useState<ViewMode>('sections');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<BriefingPreferences | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setBriefing({ ...MOCK_MORNING_BRIEFING, generatedAt: new Date().toISOString() });
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleItemPress = (item: any, index: number) => {
    console.log('Item pressed:', item);
    // Navigate to item details or open action sheet
  };

  const handleTimelineItemPress = (item: TimelineItem) => {
    console.log('Timeline item pressed:', item);
    // Navigate to meeting/task details
  };

  const renderSectionsView = () => (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ORACLE_COLORS.observe}
        />
      }
    >
      {/* Quick Timeline Preview */}
      {briefing.timelineItems && briefing.timelineItems.length > 0 && (
        <View style={styles.timelinePreview}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Today at a Glance</Text>
            <TouchableOpacity onPress={() => setViewMode('timeline')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          <CompactTimeline
            items={briefing.timelineItems}
            maxItems={4}
            onSeeMore={() => setViewMode('timeline')}
          />
        </View>
      )}

      {/* Audio Quick Access */}
      {briefing.audioScript && (
        <CompactAudioPlayer
          briefingTitle="Listen to Briefing"
          duration={briefing.metadata?.totalDuration || 180000}
          onPress={() => setViewMode('audio')}
        />
      )}

      {/* Sections */}
      {briefing.sections.map((section, index) => (
        <BriefingCard
          key={`${section.type}-${index}`}
          section={section}
          index={index}
          initiallyExpanded={index < 2}
          highlight={section.type === 'priorities' || section.type === 'critical_issues'}
          onItemPress={(item, idx) => handleItemPress(item, idx)}
        />
      ))}

      {/* Footer */}
      <BriefingFooter signOff={briefing.signOff} quote={briefing.quote} />

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderTimelineView = () => (
    <BriefingTimeline
      items={briefing.timelineItems || []}
      showNowIndicator={true}
      onItemPress={handleTimelineItemPress}
    />
  );

  const renderAudioView = () => (
    <BriefingAudio
      script={briefing.audioScript || ''}
      briefingTitle={briefing.title}
      onComplete={() => console.log('Audio complete')}
    />
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={ORACLE_COLORS.observe} />
        <Text style={styles.loadingText}>Generating briefing...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <BriefingHeader
        briefing={briefing}
        onSettingsPress={() => setShowSettings(true)}
        onRefresh={onRefresh}
      />

      {/* View Mode Tabs */}
      <ViewModeTabs
        activeMode={viewMode}
        onChange={setViewMode}
        hasAudio={!!briefing.audioScript}
        hasTimeline={!!briefing.timelineItems?.length}
      />

      {/* Content */}
      {viewMode === 'sections' && renderSectionsView()}
      {viewMode === 'timeline' && renderTimelineView()}
      {viewMode === 'audio' && renderAudioView()}

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide">
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Briefing Settings</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <BriefingSettings
            preferences={
              preferences || {
                verbosityLevel: 'standard',
                includeWeather: true,
                includeTraffic: true,
                includeQuotes: true,
                audioEnabled: true,
                audioAutoPlay: false,
                audioSpeed: 1.0,
                timezone: 'America/New_York',
                schedules: [
                  { type: 'morning', enabled: true, time: '07:00', days: [1, 2, 3, 4, 5], notificationChannel: 'push' },
                  { type: 'evening', enabled: true, time: '18:00', days: [1, 2, 3, 4, 5], notificationChannel: 'push' },
                  { type: 'weekly', enabled: true, time: '09:00', days: [1], notificationChannel: 'email' },
                ],
              }
            }
            onUpdate={(updates) => {
              setPreferences((prev) => ({
                ...prev!,
                ...updates,
              }));
            }}
            onSave={() => {
              setShowSettings(false);
              // Save to backend
            }}
          />
        </View>
      </Modal>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  date: {
    fontSize: 15,
    color: '#888',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 16,
    color: ORACLE_COLORS.act,
    fontStyle: 'italic',
  },
  viewModeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  viewModeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#1a1a1a',
  },
  viewModeTabActive: {
    backgroundColor: `${ORACLE_COLORS.observe}20`,
  },
  viewModeText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
  },
  viewModeTextActive: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  timelinePreview: {
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 13,
    color: ORACLE_COLORS.observe,
  },
  footer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  signOff: {
    fontSize: 16,
    color: ORACLE_COLORS.act,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#555',
  },
  quote: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    lineHeight: 20,
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default BriefingScreen;
