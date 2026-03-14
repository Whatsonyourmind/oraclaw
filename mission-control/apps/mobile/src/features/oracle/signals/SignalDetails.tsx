/**
 * SignalDetails Component
 * Comprehensive signal information view with impact, relations, and history
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Signal, UrgencyLevel, ImpactLevel } from '@mission-control/shared-types';
import { ORACLE_COLORS, getUrgencyColor, getImpactColor } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

export interface SignalAction {
  id: string;
  type: 'status_change' | 'assignment' | 'comment' | 'escalation' | 'resolution';
  actor: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SignalNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  isPinned?: boolean;
}

export interface RelatedSignal {
  signal: Signal;
  relationshipType: 'causal' | 'temporal' | 'similar' | 'dependency' | 'blocking';
  strength: number;
}

export interface ImpactSummary {
  overallScore: number;
  level: string;
  dimensions: Record<string, number>;
  stakeholdersAffected: number;
  estimatedCost?: number;
  estimatedDelay?: string;
}

export interface SignalDetailsProps {
  signal: Signal;
  relatedSignals?: RelatedSignal[];
  actionHistory?: SignalAction[];
  notes?: SignalNote[];
  impactSummary?: ImpactSummary;
  onClose: () => void;
  onAcknowledge?: () => void;
  onDismiss?: () => void;
  onResolve?: () => void;
  onEscalate?: () => void;
  onAddNote?: (content: string) => void;
  onRelatedSignalPress?: (signal: Signal) => void;
  onViewImpact?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SignalDetails: React.FC<SignalDetailsProps> = ({
  signal,
  relatedSignals = [],
  actionHistory = [],
  notes = [],
  impactSummary,
  onClose,
  onAcknowledge,
  onDismiss,
  onResolve,
  onEscalate,
  onAddNote,
  onRelatedSignalPress,
  onViewImpact,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'impact' | 'related' | 'history'>('overview');
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Calculate age
  const signalAge = useMemo(() => {
    const ageMs = Date.now() - new Date(signal.created_at).getTime();
    const hours = Math.floor(ageMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  }, [signal.created_at]);

  // Handle add note
  const handleAddNote = useCallback(() => {
    if (newNote.trim()) {
      onAddNote?.(newNote.trim());
      setNewNote('');
      setIsAddingNote(false);
    }
  }, [newNote, onAddNote]);

  // Get status color
  const statusColor = useMemo(() => {
    switch (signal.status) {
      case 'active':
        return ORACLE_COLORS.observe;
      case 'acknowledged':
        return ORACLE_COLORS.orient;
      case 'resolved':
        return ORACLE_COLORS.act;
      case 'dismissed':
        return '#666666';
      default:
        return '#888888';
    }
  }, [signal.status]);

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.headerContent}>
        <View style={styles.signalTypeBadge}>
          <Text style={styles.signalTypeText}>
            {signal.signal_type.toUpperCase().replace('_', ' ')}
          </Text>
        </View>

        <Text style={styles.signalTitle}>{signal.title}</Text>

        <View style={styles.badgesRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: getUrgencyColor(signal.urgency) },
            ]}
          >
            <Text style={styles.badgeText}>{signal.urgency.toUpperCase()}</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: getImpactColor(signal.impact) },
            ]}
          >
            <Text style={styles.badgeText}>{signal.impact.toUpperCase()} IMPACT</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{signal.status}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabs}>
      {(['overview', 'impact', 'related', 'history'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Text
            style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render overview tab
  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Description */}
      {signal.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIPTION</Text>
          <Text style={styles.description}>{signal.description}</Text>
        </View>
      )}

      {/* Key Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KEY INFORMATION</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color="#888888" />
            <View style={styles.infoItemContent}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>{signalAge}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="speedometer-outline" size={16} color="#888888" />
            <View style={styles.infoItemContent}>
              <Text style={styles.infoLabel}>Confidence</Text>
              <Text style={styles.infoValue}>
                {Math.round(signal.confidence * 100)}%
              </Text>
            </View>
          </View>
          {signal.source_data?.source && (
            <View style={styles.infoItem}>
              <Ionicons name="locate-outline" size={16} color="#888888" />
              <View style={styles.infoItemContent}>
                <Text style={styles.infoLabel}>Source</Text>
                <Text style={styles.infoValue}>{signal.source_data.source}</Text>
              </View>
            </View>
          )}
          {signal.expires_at && (
            <View style={styles.infoItem}>
              <Ionicons name="alarm-outline" size={16} color="#888888" />
              <View style={styles.infoItemContent}>
                <Text style={styles.infoLabel}>Expires</Text>
                <Text style={styles.infoValue}>
                  {new Date(signal.expires_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Confidence Bar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONFIDENCE LEVEL</Text>
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${signal.confidence * 100}%`,
                  backgroundColor: getUrgencyColor(signal.urgency),
                },
              ]}
            />
          </View>
          <Text style={styles.confidencePercentage}>
            {Math.round(signal.confidence * 100)}%
          </Text>
        </View>
        <Text style={styles.confidenceNote}>
          {signal.confidence >= 0.8
            ? 'High confidence - reliable signal'
            : signal.confidence >= 0.5
            ? 'Moderate confidence - may need verification'
            : 'Low confidence - additional validation recommended'}
        </Text>
      </View>

      {/* Notes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NOTES & COMMENTS</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsAddingNote(true)}
          >
            <Ionicons name="add" size={18} color={ORACLE_COLORS.observe} />
          </TouchableOpacity>
        </View>

        {isAddingNote && (
          <View style={styles.noteInput}>
            <TextInput
              style={styles.noteTextInput}
              placeholder="Add a note..."
              placeholderTextColor="#666666"
              value={newNote}
              onChangeText={setNewNote}
              multiline
            />
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={styles.noteCancelButton}
                onPress={() => {
                  setIsAddingNote(false);
                  setNewNote('');
                }}
              >
                <Text style={styles.noteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteSaveButton,
                  !newNote.trim() && styles.noteSaveButtonDisabled,
                ]}
                onPress={handleAddNote}
                disabled={!newNote.trim()}
              >
                <Text style={styles.noteSaveText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {notes.length === 0 && !isAddingNote ? (
          <Text style={styles.emptyText}>No notes yet</Text>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              {note.isPinned && (
                <Ionicons
                  name="pin"
                  size={12}
                  color={ORACLE_COLORS.observe}
                  style={styles.pinnedIcon}
                />
              )}
              <Text style={styles.noteContent}>{note.content}</Text>
              <View style={styles.noteFooter}>
                <Text style={styles.noteAuthor}>{note.author}</Text>
                <Text style={styles.noteTime}>
                  {new Date(note.timestamp).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );

  // Render impact tab
  const renderImpact = () => (
    <View style={styles.tabContent}>
      {impactSummary ? (
        <>
          {/* Overall Impact Score */}
          <View style={styles.impactScoreContainer}>
            <View style={styles.impactScore}>
              <Text style={styles.impactScoreValue}>
                {impactSummary.overallScore}
              </Text>
              <Text style={styles.impactScoreLabel}>/100</Text>
            </View>
            <View
              style={[
                styles.impactLevelBadge,
                { backgroundColor: getImpactColor(impactSummary.level) },
              ]}
            >
              <Text style={styles.impactLevelText}>
                {impactSummary.level.toUpperCase()} IMPACT
              </Text>
            </View>
          </View>

          {/* Dimensions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>IMPACT DIMENSIONS</Text>
            {Object.entries(impactSummary.dimensions).map(([dim, score]) => (
              <View key={dim} style={styles.dimensionRow}>
                <Text style={styles.dimensionLabel}>
                  {dim.charAt(0).toUpperCase() + dim.slice(1)}
                </Text>
                <View style={styles.dimensionBar}>
                  <View
                    style={[
                      styles.dimensionFill,
                      { width: `${score}%` },
                    ]}
                  />
                </View>
                <Text style={styles.dimensionValue}>{Math.round(score)}%</Text>
              </View>
            ))}
          </View>

          {/* Impact Stats */}
          <View style={styles.impactStats}>
            <View style={styles.impactStat}>
              <Ionicons name="people-outline" size={20} color={ORACLE_COLORS.observe} />
              <Text style={styles.impactStatValue}>
                {impactSummary.stakeholdersAffected}
              </Text>
              <Text style={styles.impactStatLabel}>Stakeholders</Text>
            </View>
            {impactSummary.estimatedCost !== undefined && (
              <View style={styles.impactStat}>
                <Ionicons name="cash-outline" size={20} color={ORACLE_COLORS.orient} />
                <Text style={styles.impactStatValue}>
                  ${impactSummary.estimatedCost.toLocaleString()}
                </Text>
                <Text style={styles.impactStatLabel}>Est. Cost</Text>
              </View>
            )}
            {impactSummary.estimatedDelay && (
              <View style={styles.impactStat}>
                <Ionicons name="time-outline" size={20} color={ORACLE_COLORS.decide} />
                <Text style={styles.impactStatValue}>
                  {impactSummary.estimatedDelay}
                </Text>
                <Text style={styles.impactStatLabel}>Est. Delay</Text>
              </View>
            )}
          </View>

          {/* View Full Analysis */}
          <TouchableOpacity style={styles.viewAnalysisButton} onPress={onViewImpact}>
            <Text style={styles.viewAnalysisText}>View Full Impact Analysis</Text>
            <Ionicons name="arrow-forward" size={16} color="#000000" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color="#444444" />
          <Text style={styles.emptyStateText}>
            Impact analysis not available
          </Text>
          <TouchableOpacity style={styles.analyzeButton} onPress={onViewImpact}>
            <Text style={styles.analyzeButtonText}>Analyze Impact</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render related signals tab
  const renderRelated = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          RELATED SIGNALS ({relatedSignals.length})
        </Text>

        {relatedSignals.length === 0 ? (
          <Text style={styles.emptyText}>No related signals found</Text>
        ) : (
          relatedSignals.map((related) => (
            <TouchableOpacity
              key={related.signal.id}
              style={styles.relatedCard}
              onPress={() => onRelatedSignalPress?.(related.signal)}
            >
              <View
                style={[
                  styles.relatedIndicator,
                  { backgroundColor: getUrgencyColor(related.signal.urgency) },
                ]}
              />
              <View style={styles.relatedContent}>
                <View style={styles.relatedHeader}>
                  <Text style={styles.relatedType}>
                    {related.signal.signal_type.toUpperCase()}
                  </Text>
                  <View style={styles.relationBadge}>
                    <Text style={styles.relationText}>
                      {related.relationshipType}
                    </Text>
                  </View>
                </View>
                <Text style={styles.relatedTitle} numberOfLines={2}>
                  {related.signal.title}
                </Text>
                <View style={styles.relatedMeta}>
                  <View style={styles.relatedStrength}>
                    <Text style={styles.relatedStrengthLabel}>Strength:</Text>
                    <View style={styles.strengthBar}>
                      <View
                        style={[
                          styles.strengthFill,
                          { width: `${related.strength * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666666" />
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );

  // Render history tab
  const renderHistory = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTION HISTORY</Text>

        {actionHistory.length === 0 ? (
          <Text style={styles.emptyText}>No actions recorded yet</Text>
        ) : (
          <View style={styles.timeline}>
            {actionHistory.map((action, index) => (
              <View key={action.id} style={styles.timelineItem}>
                <View style={styles.timelineConnector}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor:
                          action.type === 'resolution'
                            ? ORACLE_COLORS.act
                            : action.type === 'escalation'
                            ? ORACLE_COLORS.decide
                            : ORACLE_COLORS.observe,
                      },
                    ]}
                  />
                  {index < actionHistory.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineActor}>{action.actor}</Text>
                    <Text style={styles.timelineTime}>
                      {new Date(action.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.timelineDescription}>
                    {action.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  // Render action buttons
  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      {signal.status === 'active' && (
        <>
          <TouchableOpacity
            style={[styles.actionButton, styles.acknowledgeButton]}
            onPress={onAcknowledge}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#000000" />
            <Text style={styles.actionButtonText}>Acknowledge</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.dismissButton]}
            onPress={onDismiss}
          >
            <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </>
      )}
      {signal.status === 'acknowledged' && (
        <>
          <TouchableOpacity
            style={[styles.actionButton, styles.resolveButton]}
            onPress={onResolve}
          >
            <Ionicons name="checkmark-done-outline" size={20} color="#000000" />
            <Text style={styles.actionButtonText}>Resolve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.escalateButton]}
            onPress={onEscalate}
          >
            <Ionicons name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
              Escalate
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderHeader()}
        {renderTabs()}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'impact' && renderImpact()}
          {activeTab === 'related' && renderRelated()}
          {activeTab === 'history' && renderHistory()}
        </ScrollView>

        {renderActionButtons()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  headerContent: {
    paddingRight: 40,
  },
  signalTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  signalTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 0.5,
  },
  signalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'capitalize',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: ORACLE_COLORS.observe,
  },
  tabText: {
    fontSize: 12,
    color: '#666666',
  },
  tabTextActive: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabContent: {},
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 12,
  },
  addButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoItemContent: {},
  infoLabel: {
    fontSize: 11,
    color: '#666666',
  },
  infoValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidencePercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    width: 40,
    textAlign: 'right',
  },
  confidenceNote: {
    fontSize: 11,
    color: '#888888',
    fontStyle: 'italic',
  },
  noteInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteTextInput: {
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  noteCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  noteCancelText: {
    fontSize: 13,
    color: '#888888',
  },
  noteSaveButton: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  noteSaveButtonDisabled: {
    opacity: 0.5,
  },
  noteSaveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  noteCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    position: 'relative',
  },
  pinnedIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  noteContent: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginBottom: 8,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noteAuthor: {
    fontSize: 11,
    color: ORACLE_COLORS.observe,
    fontWeight: '500',
  },
  noteTime: {
    fontSize: 11,
    color: '#666666',
  },
  emptyText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  impactScoreContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  impactScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  impactScoreValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: ORACLE_COLORS.observe,
  },
  impactScoreLabel: {
    fontSize: 24,
    color: '#666666',
  },
  impactLevelBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  impactLevelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dimensionLabel: {
    width: 70,
    fontSize: 12,
    color: '#888888',
  },
  dimensionBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  dimensionFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 3,
  },
  dimensionValue: {
    width: 40,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  impactStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#222222',
  },
  impactStat: {
    alignItems: 'center',
  },
  impactStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  impactStatLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
  },
  viewAnalysisButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  viewAnalysisText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
    marginBottom: 20,
  },
  analyzeButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.observe,
  },
  analyzeButtonText: {
    fontSize: 14,
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  relatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  relatedIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  relatedContent: {
    flex: 1,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  relatedType: {
    fontSize: 10,
    color: '#888888',
    marginRight: 8,
  },
  relationBadge: {
    backgroundColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  relationText: {
    fontSize: 9,
    color: '#CCCCCC',
    textTransform: 'capitalize',
  },
  relatedTitle: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 6,
  },
  relatedMeta: {},
  relatedStrength: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  relatedStrengthLabel: {
    fontSize: 10,
    color: '#666666',
    marginRight: 8,
  },
  strengthBar: {
    width: 60,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  strengthFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 2,
  },
  timeline: {},
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineConnector: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#333333',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineActor: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    fontWeight: '500',
  },
  timelineTime: {
    fontSize: 10,
    color: '#666666',
  },
  timelineDescription: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  acknowledgeButton: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  dismissButton: {
    backgroundColor: '#333333',
  },
  resolveButton: {
    backgroundColor: ORACLE_COLORS.act,
  },
  escalateButton: {
    backgroundColor: ORACLE_COLORS.decide,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
});

export default SignalDetails;
