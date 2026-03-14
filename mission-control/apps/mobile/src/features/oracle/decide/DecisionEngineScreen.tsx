/**
 * DecisionEngineScreen Component
 * Story 7.7 - Main decision dashboard with options and simulations
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Decision, DecisionOption } from '@mission-control/shared-types';
import { useDecideStore, useDecideSelectors } from '../../../store/oracle';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles } from '../theme';
import { OptionComparisonView } from './OptionComparisonView';
import { SimulationResultsView } from './SimulationResultsView';
import { CriticalPathDiagram } from './CriticalPathDiagram';

export const DecisionEngineScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showComparison, setShowComparison] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DecisionOption | null>(null);

  const {
    currentDecision,
    options,
    simulations,
    criticalPath,
    isAnalyzing,
    analyzeDecision,
    selectOption,
  } = useDecideStore();

  const pendingDecisions = useDecideSelectors.pendingDecisions();
  const optionsWithSimulations = useDecideSelectors.optionsWithSimulations();
  const bestOption = useDecideSelectors.bestOption();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAnalyze = async () => {
    if (currentDecision) {
      await analyzeDecision(currentDecision.id);
    }
  };

  const handleSelectOption = (option: DecisionOption) => {
    selectOption(option.id);
  };

  const getOptionStatusIcon = (option: DecisionOption): string => {
    const simulation = simulations.find((s) => s.option_id === option.id);
    if (simulation) return 'checkmark-circle';
    if (isAnalyzing) return 'sync';
    return 'ellipse-outline';
  };

  const getOptionStatusColor = (option: DecisionOption): string => {
    const simulation = simulations.find((s) => s.option_id === option.id);
    if (simulation) return ORACLE_COLORS.decide;
    return '#666666';
  };

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[oracleStyles.header, { borderBottomColor: ORACLE_COLORS.decide }]}>
        <View>
          <Text style={[oracleStyles.headerTitle, { color: ORACLE_COLORS.decide }]}>
            DECISION ENGINE
          </Text>
          <Text style={oracleStyles.headerSubtitle}>
            {pendingDecisions.length} pending decisions
          </Text>
        </View>
        <View style={[oracleStyles.phaseIndicator, { borderColor: ORACLE_COLORS.decide }]}>
          <View style={[oracleStyles.phaseDot, { backgroundColor: ORACLE_COLORS.decide }]} />
          <Text style={[oracleStyles.phaseText, { color: ORACLE_COLORS.decide }]}>
            DECIDE
          </Text>
        </View>
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Decision Card */}
        {currentDecision ? (
          <Animated.View style={[styles.decisionCard, { opacity: fadeAnim }]}>
            <View style={styles.decisionHeader}>
              <View style={styles.decisionBadge}>
                <Text style={styles.decisionBadgeText}>ACTIVE DECISION</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentDecision.status) }]}>
                <Text style={styles.statusBadgeText}>
                  {currentDecision.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.decisionTitle}>{currentDecision.title}</Text>
            {currentDecision.description && (
              <Text style={styles.decisionDescription}>
                {currentDecision.description}
              </Text>
            )}

            {/* Decision Context */}
            {currentDecision.context && (
              <View style={styles.contextSection}>
                <Text style={styles.sectionLabel}>CONTEXT</Text>
                <Text style={styles.contextText}>{currentDecision.context}</Text>
              </View>
            )}

            {/* Deadline */}
            {currentDecision.deadline && (
              <View style={styles.deadlineRow}>
                <Ionicons name="alarm-outline" size={16} color={ORACLE_COLORS.decide} />
                <Text style={styles.deadlineText}>
                  Deadline: {new Date(currentDecision.deadline).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={handleAnalyze}
                disabled={isAnalyzing}
              >
                <Ionicons
                  name={isAnalyzing ? 'sync' : 'analytics-outline'}
                  size={18}
                  color="#000000"
                />
                <Text style={styles.analyzeButtonText}>
                  {isAnalyzing ? 'ANALYZING...' : 'ANALYZE OPTIONS'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.emptyDecision}>
            <Ionicons name="git-branch-outline" size={64} color="#444444" />
            <Text style={styles.emptyTitle}>No Active Decision</Text>
            <Text style={styles.emptyText}>
              Select a pending decision or create a new one
            </Text>
          </View>
        )}

        {/* Options List */}
        {options.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OPTIONS ({options.length})</Text>
              <TouchableOpacity
                style={styles.compareButton}
                onPress={() => setShowComparison(true)}
              >
                <Ionicons name="git-compare-outline" size={16} color={ORACLE_COLORS.decide} />
                <Text style={styles.compareButtonText}>COMPARE</Text>
              </TouchableOpacity>
            </View>

            {options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  bestOption?.id === option.id && styles.optionCardBest,
                ]}
                onPress={() => setSelectedOption(option)}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.optionNumber}>
                    <Text style={styles.optionNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    {option.description && (
                      <Text style={styles.optionDescription} numberOfLines={2}>
                        {option.description}
                      </Text>
                    )}
                  </View>
                  <View style={styles.optionStatus}>
                    <Ionicons
                      name={getOptionStatusIcon(option) as any}
                      size={20}
                      color={getOptionStatusColor(option)}
                    />
                  </View>
                </View>

                {/* Score */}
                {option.score !== undefined && (
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreLabel}>Score</Text>
                    <View style={styles.scoreBar}>
                      <View
                        style={[
                          styles.scoreFill,
                          { width: `${option.score * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.scoreValue}>
                      {Math.round(option.score * 100)}
                    </Text>
                  </View>
                )}

                {/* Pros/Cons Preview */}
                <View style={styles.prosConsRow}>
                  {option.pros && option.pros.length > 0 && (
                    <View style={styles.prosCons}>
                      <Ionicons name="add-circle" size={14} color="#00FF88" />
                      <Text style={styles.prosConsText}>
                        {option.pros.length} pros
                      </Text>
                    </View>
                  )}
                  {option.cons && option.cons.length > 0 && (
                    <View style={styles.prosCons}>
                      <Ionicons name="remove-circle" size={14} color="#FF6B6B" />
                      <Text style={styles.prosConsText}>
                        {option.cons.length} cons
                      </Text>
                    </View>
                  )}
                </View>

                {/* Best Option Badge */}
                {bestOption?.id === option.id && (
                  <View style={styles.bestBadge}>
                    <Ionicons name="star" size={12} color="#000000" />
                    <Text style={styles.bestBadgeText}>RECOMMENDED</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Simulation Results for Selected Option */}
        {selectedOption && (
          <SimulationResultsView
            option={selectedOption}
            simulation={simulations.find((s) => s.option_id === selectedOption.id)}
            onClose={() => setSelectedOption(null)}
          />
        )}

        {/* Critical Path */}
        {criticalPath && (
          <CriticalPathDiagram criticalPath={criticalPath} />
        )}

        {/* Pending Decisions List */}
        {pendingDecisions.length > 0 && !currentDecision && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PENDING DECISIONS</Text>
            {pendingDecisions.map((decision) => (
              <TouchableOpacity
                key={decision.id}
                style={styles.pendingCard}
              >
                <Ionicons name="help-circle-outline" size={24} color={ORACLE_COLORS.decide} />
                <View style={styles.pendingContent}>
                  <Text style={styles.pendingTitle}>{decision.title}</Text>
                  {decision.deadline && (
                    <Text style={styles.pendingDeadline}>
                      Due: {new Date(decision.deadline).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666666" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Option Comparison Modal */}
      {showComparison && (
        <OptionComparisonView
          options={options}
          simulations={simulations}
          onClose={() => setShowComparison(false)}
          onSelect={handleSelectOption}
        />
      )}
    </View>
  );
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return '#888888';
    case 'analyzing':
      return ORACLE_COLORS.decide;
    case 'decided':
      return '#00FF88';
    case 'executed':
      return '#00BFFF';
    case 'cancelled':
      return '#FF4444';
    default:
      return '#666666';
  }
};

const styles = StyleSheet.create({
  decisionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.decide,
  },
  decisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  decisionBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  decisionBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: ORACLE_COLORS.decide,
    letterSpacing: 1,
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
  },
  decisionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  decisionDescription: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 22,
    marginBottom: 16,
  },
  contextSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  contextText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deadlineText: {
    fontSize: 13,
    color: ORACLE_COLORS.decide,
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.decide,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  analyzeButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  emptyDecision: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
  },
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
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
  },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compareButtonText: {
    fontSize: 12,
    color: ORACLE_COLORS.decide,
    fontWeight: '600',
    marginLeft: 4,
  },
  optionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  optionCardBest: {
    borderColor: ORACLE_COLORS.decide,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: '#AAAAAA',
    lineHeight: 18,
  },
  optionStatus: {
    marginLeft: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 11,
    color: '#666666',
    width: 40,
  },
  scoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  scoreFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.decide,
    borderRadius: 3,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ORACLE_COLORS.decide,
    width: 30,
    textAlign: 'right',
  },
  prosConsRow: {
    flexDirection: 'row',
  },
  prosCons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  prosConsText: {
    fontSize: 11,
    color: '#888888',
    marginLeft: 4,
  },
  bestBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.decide,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bestBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 4,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  pendingContent: {
    flex: 1,
    marginLeft: 12,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingDeadline: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
});
