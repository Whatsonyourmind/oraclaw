/**
 * StrategicMindScreen Component
 * Story 7.4 - Main orientation dashboard with context and horizons
 */
import React, { useState, useEffect, useRef } from 'react';
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
import type { HorizonType } from '@mission-control/shared-types';
import { useOrientStore, useOrientSelectors } from '../../../store/oracle';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles } from '../theme';
import { HorizonPlanView } from './HorizonPlanView';
import { RiskOpportunityMatrix } from './RiskOpportunityMatrix';

const HORIZON_TABS: { key: HorizonType; label: string; icon: string }[] = [
  { key: 'immediate', label: 'NOW', icon: 'flash-outline' },
  { key: 'today', label: 'TODAY', icon: 'today-outline' },
  { key: 'week', label: 'WEEK', icon: 'calendar-outline' },
  { key: 'month', label: 'MONTH', icon: 'calendar-number-outline' },
];

export const StrategicMindScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonType>('today');
  const [showMatrix, setShowMatrix] = useState(false);

  const {
    currentContext,
    horizons,
    assessments,
    isGenerating,
    generateContext,
  } = useOrientStore();

  const keyFactors = useOrientSelectors.keyFactors();
  const riskCount = useOrientSelectors.riskCount();
  const opportunityCount = useOrientSelectors.opportunityCount();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleGenerateContext = async () => {
    await generateContext([]);
  };

  const selectedHorizonData = horizons.find((h) => h.horizon_type === selectedHorizon);

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[oracleStyles.header, { borderBottomColor: ORACLE_COLORS.orient }]}>
        <View>
          <Text style={[oracleStyles.headerTitle, { color: ORACLE_COLORS.orient }]}>
            STRATEGIC MIND
          </Text>
          <Text style={oracleStyles.headerSubtitle}>
            Orientation & Planning
          </Text>
        </View>
        <View style={[oracleStyles.phaseIndicator, { borderColor: ORACLE_COLORS.orient }]}>
          <View style={[oracleStyles.phaseDot, { backgroundColor: ORACLE_COLORS.orient }]} />
          <Text style={[oracleStyles.phaseText, { color: ORACLE_COLORS.orient }]}>
            ORIENT
          </Text>
        </View>
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Context Summary */}
        <Animated.View style={[styles.contextCard, { opacity: fadeAnim }]}>
          <View style={styles.contextHeader}>
            <View style={styles.contextTitleRow}>
              <Ionicons name="compass-outline" size={24} color={ORACLE_COLORS.orient} />
              <Text style={styles.contextTitle}>Current Situation</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleGenerateContext}
              disabled={isGenerating}
            >
              <Ionicons
                name={isGenerating ? 'sync' : 'refresh-outline'}
                size={20}
                color={ORACLE_COLORS.orient}
              />
            </TouchableOpacity>
          </View>

          {currentContext ? (
            <>
              <Text style={styles.contextSummary}>
                {currentContext.situation_summary || 'Analyzing current situation...'}
              </Text>

              {/* Key Factors */}
              {keyFactors.length > 0 && (
                <View style={styles.factorsSection}>
                  <Text style={styles.factorsTitle}>KEY FACTORS</Text>
                  {keyFactors.slice(0, 4).map((factor, index) => (
                    <View key={index} style={styles.factorItem}>
                      <View style={[styles.factorDot, { backgroundColor: ORACLE_COLORS.orient }]} />
                      <Text style={styles.factorText}>{factor}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Recommendations */}
              {currentContext.recommendations && currentContext.recommendations.length > 0 && (
                <View style={styles.recommendationsSection}>
                  <Text style={styles.factorsTitle}>RECOMMENDATIONS</Text>
                  {currentContext.recommendations.slice(0, 3).map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <Ionicons name="arrow-forward-circle" size={16} color={ORACLE_COLORS.orient} />
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyContext}>
              <Ionicons name="compass-outline" size={48} color="#444444" />
              <Text style={styles.emptyContextText}>
                No strategic context generated yet.{'\n'}
                Run orientation to analyze the situation.
              </Text>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerateContext}
                disabled={isGenerating}
              >
                <Ionicons name="analytics-outline" size={18} color="#000000" />
                <Text style={styles.generateButtonText}>
                  {isGenerating ? 'GENERATING...' : 'GENERATE CONTEXT'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Risk/Opportunity Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, showMatrix && styles.statCardActive]}
            onPress={() => setShowMatrix(!showMatrix)}
          >
            <View style={styles.statHeader}>
              <Ionicons name="warning-outline" size={20} color="#FF6B6B" />
              <Text style={styles.statValue}>{riskCount}</Text>
            </View>
            <Text style={styles.statLabel}>RISKS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, showMatrix && styles.statCardActive]}
            onPress={() => setShowMatrix(!showMatrix)}
          >
            <View style={styles.statHeader}>
              <Ionicons name="sunny-outline" size={20} color="#00FF88" />
              <Text style={styles.statValue}>{opportunityCount}</Text>
            </View>
            <Text style={styles.statLabel}>OPPORTUNITIES</Text>
          </TouchableOpacity>
        </View>

        {/* Risk/Opportunity Matrix */}
        {showMatrix && (
          <RiskOpportunityMatrix assessments={assessments} />
        )}

        {/* Horizon Selector Tabs */}
        <View style={styles.horizonTabs}>
          {HORIZON_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.horizonTab,
                selectedHorizon === tab.key && styles.horizonTabActive,
              ]}
              onPress={() => setSelectedHorizon(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={selectedHorizon === tab.key ? ORACLE_COLORS.orient : '#666666'}
              />
              <Text
                style={[
                  styles.horizonTabText,
                  selectedHorizon === tab.key && styles.horizonTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Horizon Plan View */}
        <HorizonPlanView
          horizon={selectedHorizonData}
          horizonType={selectedHorizon}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  contextCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.orient,
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ORACLE_COLORS.orient,
    marginLeft: 10,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextSummary: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 16,
  },
  factorsSection: {
    marginBottom: 16,
  },
  factorsTitle: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  factorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 10,
  },
  factorText: {
    flex: 1,
    fontSize: 13,
    color: '#AAAAAA',
    lineHeight: 20,
  },
  recommendationsSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginLeft: 8,
  },
  emptyContext: {
    alignItems: 'center',
    padding: 24,
  },
  emptyContextText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 22,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.orient,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statCardActive: {
    borderWidth: 1,
    borderColor: ORACLE_COLORS.orient,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#888888',
    letterSpacing: 1,
  },
  horizonTabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  horizonTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  horizonTabActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  horizonTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 4,
  },
  horizonTabTextActive: {
    color: ORACLE_COLORS.orient,
  },
});
