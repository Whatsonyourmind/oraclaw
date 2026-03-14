/**
 * ImpactBreakdown Component
 * Multi-dimensional impact visualization with radar charts and scenarios
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { ORACLE_COLORS, getUrgencyColor, getImpactColor } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

export type ImpactDimension = 'time' | 'cost' | 'quality' | 'scope' | 'team';

export interface DimensionalScore {
  dimension: ImpactDimension;
  score: number;
  weight: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: Array<{
    name: string;
    contribution: number;
    description: string;
  }>;
}

export interface RippleEffect {
  id: string;
  affectedEntityType: string;
  affectedEntityName: string;
  impactType: 'direct' | 'indirect';
  impactLevel: string;
  propagationDepth: number;
  probability: number;
  description: string;
}

export interface StakeholderImpact {
  stakeholderId: string;
  stakeholderName: string;
  role: string;
  impactLevel: string;
  impactTypes: string[];
  sentimentImpact: 'positive' | 'negative' | 'neutral';
  actionRequired: boolean;
  recommendedAction?: string;
  notificationPriority: 'immediate' | 'high' | 'normal' | 'low';
}

export interface ScenarioOutcome {
  name: string;
  description: string;
  probability: number;
  dimensions: Record<ImpactDimension, number>;
  totalImpact: number;
  timeToRealization: string;
  keyRisks: string[];
  keyBenefits: string[];
}

export interface ImpactAnalysis {
  signalId: string;
  signalTitle: string;
  overallImpact: {
    score: number;
    level: string;
    confidence: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  dimensions: DimensionalScore[];
  rippleEffects: RippleEffect[];
  stakeholderImpacts: StakeholderImpact[];
  scenarios: {
    bestCase: ScenarioOutcome;
    expectedCase: ScenarioOutcome;
    worstCase: ScenarioOutcome;
  };
  recommendations: Array<{
    priority: number;
    action: string;
    expectedImpactReduction: number;
    effort: 'low' | 'medium' | 'high';
    timeframe: string;
  }>;
}

export interface ImpactBreakdownProps {
  analysis: ImpactAnalysis;
  onDimensionPress?: (dimension: ImpactDimension) => void;
  onStakeholderPress?: (stakeholder: StakeholderImpact) => void;
  onScenarioPress?: (scenario: ScenarioOutcome) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = SCREEN_WIDTH - 64;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = RADAR_SIZE / 2 - 40;

const DIMENSION_LABELS: Record<ImpactDimension, string> = {
  time: 'Time',
  cost: 'Cost',
  quality: 'Quality',
  scope: 'Scope',
  team: 'Team',
};

const DIMENSION_ICONS: Record<ImpactDimension, string> = {
  time: 'time-outline',
  cost: 'cash-outline',
  quality: 'ribbon-outline',
  scope: 'resize-outline',
  team: 'people-outline',
};

const DIMENSION_COLORS: Record<ImpactDimension, string> = {
  time: '#00BFFF',
  cost: '#FFD700',
  quality: '#FF6B6B',
  scope: '#FF9500',
  team: '#00FF88',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ImpactBreakdown: React.FC<ImpactBreakdownProps> = ({
  analysis,
  onDimensionPress,
  onStakeholderPress,
  onScenarioPress,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<'best' | 'expected' | 'worst'>('expected');
  const [expandedDimension, setExpandedDimension] = useState<ImpactDimension | null>(null);

  // Calculate radar polygon points
  const radarPoints = useMemo(() => {
    const dimensions = analysis.dimensions;
    const angleStep = (2 * Math.PI) / dimensions.length;

    const points = dimensions.map((dim, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const radius = (dim.score / 100) * RADAR_RADIUS;
      const x = RADAR_CENTER + radius * Math.cos(angle);
      const y = RADAR_CENTER + radius * Math.sin(angle);
      return { x, y, dimension: dim };
    });

    return points;
  }, [analysis.dimensions]);

  // Render radar chart
  const renderRadarChart = () => {
    const dimensions = analysis.dimensions;
    const angleStep = (2 * Math.PI) / dimensions.length;
    const levels = [20, 40, 60, 80, 100];

    return (
      <View style={styles.radarContainer}>
        <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
          {/* Background circles */}
          {levels.map((level) => (
            <Circle
              key={level}
              cx={RADAR_CENTER}
              cy={RADAR_CENTER}
              r={(level / 100) * RADAR_RADIUS}
              fill="transparent"
              stroke="#333333"
              strokeWidth={1}
              strokeDasharray={level === 100 ? undefined : '4,4'}
            />
          ))}

          {/* Axis lines */}
          {dimensions.map((_, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const x2 = RADAR_CENTER + RADAR_RADIUS * Math.cos(angle);
            const y2 = RADAR_CENTER + RADAR_RADIUS * Math.sin(angle);
            return (
              <Line
                key={index}
                x1={RADAR_CENTER}
                y1={RADAR_CENTER}
                x2={x2}
                y2={y2}
                stroke="#444444"
                strokeWidth={1}
              />
            );
          })}

          {/* Data polygon */}
          <Polygon
            points={radarPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={ORACLE_COLORS.observe}
            fillOpacity={0.3}
            stroke={ORACLE_COLORS.observe}
            strokeWidth={2}
          />

          {/* Data points */}
          {radarPoints.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={6}
              fill={DIMENSION_COLORS[point.dimension.dimension]}
              onPress={() => onDimensionPress?.(point.dimension.dimension)}
            />
          ))}

          {/* Labels */}
          {dimensions.map((dim, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const labelRadius = RADAR_RADIUS + 25;
            const x = RADAR_CENTER + labelRadius * Math.cos(angle);
            const y = RADAR_CENTER + labelRadius * Math.sin(angle);
            return (
              <G key={dim.dimension}>
                <SvgText
                  x={x}
                  y={y}
                  fill={DIMENSION_COLORS[dim.dimension]}
                  fontSize={11}
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {DIMENSION_LABELS[dim.dimension]}
                </SvgText>
                <SvgText
                  x={x}
                  y={y + 14}
                  fill="#888888"
                  fontSize={10}
                  textAnchor="middle"
                >
                  {Math.round(dim.score)}%
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Render dimension details
  const renderDimensionDetails = (dim: DimensionalScore) => {
    const isExpanded = expandedDimension === dim.dimension;

    return (
      <TouchableOpacity
        key={dim.dimension}
        style={[
          styles.dimensionCard,
          isExpanded && styles.dimensionCardExpanded,
          { borderLeftColor: DIMENSION_COLORS[dim.dimension] },
        ]}
        onPress={() => setExpandedDimension(isExpanded ? null : dim.dimension)}
      >
        <View style={styles.dimensionHeader}>
          <View style={styles.dimensionInfo}>
            <Ionicons
              name={DIMENSION_ICONS[dim.dimension] as any}
              size={18}
              color={DIMENSION_COLORS[dim.dimension]}
            />
            <Text style={styles.dimensionName}>
              {DIMENSION_LABELS[dim.dimension]}
            </Text>
          </View>

          <View style={styles.dimensionScore}>
            <Text
              style={[
                styles.dimensionScoreValue,
                { color: DIMENSION_COLORS[dim.dimension] },
              ]}
            >
              {Math.round(dim.score)}
            </Text>
            <Text style={styles.dimensionScoreUnit}>/100</Text>
          </View>

          <View style={styles.dimensionTrend}>
            <Ionicons
              name={
                dim.trend === 'increasing'
                  ? 'trending-up'
                  : dim.trend === 'decreasing'
                  ? 'trending-down'
                  : 'remove-outline'
              }
              size={16}
              color={
                dim.trend === 'increasing'
                  ? '#FF4444'
                  : dim.trend === 'decreasing'
                  ? '#00FF88'
                  : '#888888'
              }
            />
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666666"
          />
        </View>

        {isExpanded && (
          <View style={styles.dimensionFactors}>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    { width: `${dim.confidence * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.confidenceValue}>
                {Math.round(dim.confidence * 100)}%
              </Text>
            </View>

            <Text style={styles.factorsTitle}>Contributing Factors</Text>
            {dim.factors.map((factor, idx) => (
              <View key={idx} style={styles.factorItem}>
                <View style={styles.factorBar}>
                  <View
                    style={[
                      styles.factorFill,
                      {
                        width: `${factor.contribution}%`,
                        backgroundColor: DIMENSION_COLORS[dim.dimension],
                      },
                    ]}
                  />
                </View>
                <View style={styles.factorInfo}>
                  <Text style={styles.factorName}>{factor.name}</Text>
                  <Text style={styles.factorValue}>+{factor.contribution}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render waterfall chart for ripple effects
  const renderRippleEffects = () => {
    const sortedEffects = [...analysis.rippleEffects].sort(
      (a, b) => a.propagationDepth - b.propagationDepth
    );

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RIPPLE EFFECTS</Text>

        {sortedEffects.map((effect, index) => {
          const indent = effect.propagationDepth * 16;
          const impactColor =
            effect.impactLevel === 'critical'
              ? '#FF4444'
              : effect.impactLevel === 'high'
              ? '#FF9500'
              : effect.impactLevel === 'medium'
              ? '#FFD700'
              : '#00FF88';

          return (
            <View
              key={effect.id}
              style={[styles.rippleCard, { marginLeft: indent }]}
            >
              <View style={styles.rippleConnector}>
                {index > 0 && (
                  <>
                    <View style={styles.rippleLine} />
                    <View style={styles.rippleDot} />
                  </>
                )}
              </View>

              <View style={styles.rippleContent}>
                <View style={styles.rippleHeader}>
                  <Text style={styles.rippleEntity}>{effect.affectedEntityName}</Text>
                  <View
                    style={[
                      styles.rippleImpactBadge,
                      { backgroundColor: impactColor },
                    ]}
                  >
                    <Text style={styles.rippleImpactText}>
                      {effect.impactType.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.rippleDescription}>{effect.description}</Text>

                <View style={styles.rippleStats}>
                  <View style={styles.rippleStat}>
                    <Text style={styles.rippleStatLabel}>Probability</Text>
                    <Text style={styles.rippleStatValue}>
                      {Math.round(effect.probability * 100)}%
                    </Text>
                  </View>
                  <View style={styles.rippleStat}>
                    <Text style={styles.rippleStatLabel}>Depth</Text>
                    <Text style={styles.rippleStatValue}>
                      Level {effect.propagationDepth}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render stakeholder impact cards
  const renderStakeholderImpacts = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>STAKEHOLDER IMPACT</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {analysis.stakeholderImpacts.map((stakeholder) => {
          const priorityColor =
            stakeholder.notificationPriority === 'immediate'
              ? '#FF4444'
              : stakeholder.notificationPriority === 'high'
              ? '#FF9500'
              : stakeholder.notificationPriority === 'normal'
              ? '#00BFFF'
              : '#666666';

          return (
            <TouchableOpacity
              key={stakeholder.stakeholderId}
              style={styles.stakeholderCard}
              onPress={() => onStakeholderPress?.(stakeholder)}
            >
              <View
                style={[
                  styles.stakeholderPriority,
                  { backgroundColor: priorityColor },
                ]}
              />

              <View style={styles.stakeholderAvatar}>
                <Ionicons name="person-outline" size={20} color="#FFFFFF" />
              </View>

              <Text style={styles.stakeholderName}>
                {stakeholder.stakeholderName}
              </Text>
              <Text style={styles.stakeholderRole}>{stakeholder.role}</Text>

              <View style={styles.stakeholderImpacts}>
                {stakeholder.impactTypes.slice(0, 2).map((type) => (
                  <View key={type} style={styles.stakeholderImpactTag}>
                    <Text style={styles.stakeholderImpactText}>{type}</Text>
                  </View>
                ))}
                {stakeholder.impactTypes.length > 2 && (
                  <Text style={styles.stakeholderMore}>
                    +{stakeholder.impactTypes.length - 2}
                  </Text>
                )}
              </View>

              {stakeholder.actionRequired && (
                <View style={styles.actionRequired}>
                  <Ionicons name="alert-circle" size={12} color="#FF6B6B" />
                  <Text style={styles.actionRequiredText}>Action Needed</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // Render scenario comparison
  const renderScenarios = () => {
    const scenarios = {
      best: analysis.scenarios.bestCase,
      expected: analysis.scenarios.expectedCase,
      worst: analysis.scenarios.worstCase,
    };

    const currentScenario = scenarios[selectedScenario];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SCENARIO ANALYSIS</Text>

        {/* Scenario Tabs */}
        <View style={styles.scenarioTabs}>
          <TouchableOpacity
            style={[
              styles.scenarioTab,
              selectedScenario === 'best' && styles.scenarioTabActive,
              selectedScenario === 'best' && { borderColor: '#00FF88' },
            ]}
            onPress={() => setSelectedScenario('best')}
          >
            <Text
              style={[
                styles.scenarioTabText,
                selectedScenario === 'best' && { color: '#00FF88' },
              ]}
            >
              Best Case
            </Text>
            <Text style={styles.scenarioTabProb}>
              {Math.round(scenarios.best.probability * 100)}%
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.scenarioTab,
              selectedScenario === 'expected' && styles.scenarioTabActive,
              selectedScenario === 'expected' && { borderColor: '#FFD700' },
            ]}
            onPress={() => setSelectedScenario('expected')}
          >
            <Text
              style={[
                styles.scenarioTabText,
                selectedScenario === 'expected' && { color: '#FFD700' },
              ]}
            >
              Expected
            </Text>
            <Text style={styles.scenarioTabProb}>
              {Math.round(scenarios.expected.probability * 100)}%
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.scenarioTab,
              selectedScenario === 'worst' && styles.scenarioTabActive,
              selectedScenario === 'worst' && { borderColor: '#FF4444' },
            ]}
            onPress={() => setSelectedScenario('worst')}
          >
            <Text
              style={[
                styles.scenarioTabText,
                selectedScenario === 'worst' && { color: '#FF4444' },
              ]}
            >
              Worst Case
            </Text>
            <Text style={styles.scenarioTabProb}>
              {Math.round(scenarios.worst.probability * 100)}%
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scenario Details */}
        <View style={styles.scenarioDetails}>
          <Text style={styles.scenarioDescription}>
            {currentScenario.description}
          </Text>

          <View style={styles.scenarioMetric}>
            <Text style={styles.scenarioMetricLabel}>Total Impact</Text>
            <Text style={styles.scenarioMetricValue}>
              {Math.round(currentScenario.totalImpact)}
            </Text>
          </View>

          <View style={styles.scenarioMetric}>
            <Text style={styles.scenarioMetricLabel}>Time to Realization</Text>
            <Text style={styles.scenarioMetricValue}>
              {currentScenario.timeToRealization}
            </Text>
          </View>

          {currentScenario.keyRisks.length > 0 && (
            <View style={styles.scenarioList}>
              <Text style={styles.scenarioListTitle}>Key Risks</Text>
              {currentScenario.keyRisks.map((risk, idx) => (
                <View key={idx} style={styles.scenarioListItem}>
                  <Ionicons name="warning-outline" size={14} color="#FF6B6B" />
                  <Text style={styles.scenarioListText}>{risk}</Text>
                </View>
              ))}
            </View>
          )}

          {currentScenario.keyBenefits.length > 0 && (
            <View style={styles.scenarioList}>
              <Text style={styles.scenarioListTitle}>Key Benefits</Text>
              {currentScenario.keyBenefits.map((benefit, idx) => (
                <View key={idx} style={styles.scenarioListItem}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#00FF88" />
                  <Text style={styles.scenarioListText}>{benefit}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overall Impact Header */}
      <View style={styles.header}>
        <View style={styles.overallScore}>
          <Text style={styles.overallScoreValue}>
            {analysis.overallImpact.score}
          </Text>
          <Text style={styles.overallScoreUnit}>/100</Text>
        </View>
        <View style={styles.overallInfo}>
          <Text style={styles.signalTitle}>{analysis.signalTitle}</Text>
          <View style={styles.overallBadges}>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: getImpactColor(analysis.overallImpact.level) },
              ]}
            >
              <Text style={styles.levelBadgeText}>
                {analysis.overallImpact.level.toUpperCase()}
              </Text>
            </View>
            <View style={styles.trendBadge}>
              <Ionicons
                name={
                  analysis.overallImpact.trend === 'increasing'
                    ? 'trending-up'
                    : analysis.overallImpact.trend === 'decreasing'
                    ? 'trending-down'
                    : 'remove-outline'
                }
                size={14}
                color={
                  analysis.overallImpact.trend === 'increasing'
                    ? '#FF4444'
                    : analysis.overallImpact.trend === 'decreasing'
                    ? '#00FF88'
                    : '#888888'
                }
              />
              <Text style={styles.trendText}>{analysis.overallImpact.trend}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Radar Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IMPACT DIMENSIONS</Text>
        {renderRadarChart()}
      </View>

      {/* Dimension Details */}
      <View style={styles.section}>
        {analysis.dimensions.map(renderDimensionDetails)}
      </View>

      {/* Ripple Effects */}
      {renderRippleEffects()}

      {/* Stakeholder Impacts */}
      {renderStakeholderImpacts()}

      {/* Scenario Analysis */}
      {renderScenarios()}

      {/* Recommendations */}
      <View style={[styles.section, { marginBottom: 32 }]}>
        <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
        {analysis.recommendations.map((rec, idx) => (
          <View key={idx} style={styles.recommendationCard}>
            <View style={styles.recommendationPriority}>
              <Text style={styles.recommendationPriorityText}>#{rec.priority}</Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationAction}>{rec.action}</Text>
              <View style={styles.recommendationMeta}>
                <View style={styles.recommendationTag}>
                  <Text style={styles.recommendationTagText}>
                    {rec.effort} effort
                  </Text>
                </View>
                <Text style={styles.recommendationTimeframe}>
                  {rec.timeframe}
                </Text>
              </View>
              <View style={styles.recommendationImpact}>
                <Text style={styles.recommendationImpactLabel}>
                  Expected reduction:
                </Text>
                <Text style={styles.recommendationImpactValue}>
                  -{rec.expectedImpactReduction}%
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  overallScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 16,
  },
  overallScoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: ORACLE_COLORS.observe,
  },
  overallScoreUnit: {
    fontSize: 18,
    color: '#666666',
    marginLeft: 2,
  },
  overallInfo: {
    flex: 1,
  },
  signalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  overallBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 11,
    color: '#888888',
    textTransform: 'capitalize',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 12,
  },
  radarContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  dimensionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  dimensionCardExpanded: {
    backgroundColor: '#222222',
  },
  dimensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  dimensionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  dimensionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dimensionScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 12,
  },
  dimensionScoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dimensionScoreUnit: {
    fontSize: 12,
    color: '#666666',
  },
  dimensionTrend: {
    marginRight: 8,
  },
  dimensionFactors: {
    padding: 12,
    paddingTop: 0,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 11,
    color: '#888888',
    width: 70,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    marginHorizontal: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 11,
    color: '#FFFFFF',
    width: 35,
    textAlign: 'right',
  },
  factorsTitle: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 8,
  },
  factorItem: {
    marginBottom: 8,
  },
  factorBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 4,
  },
  factorFill: {
    height: '100%',
    borderRadius: 2,
  },
  factorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factorName: {
    fontSize: 11,
    color: '#CCCCCC',
  },
  factorValue: {
    fontSize: 11,
    color: '#888888',
  },
  rippleCard: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  rippleConnector: {
    width: 20,
    alignItems: 'center',
  },
  rippleLine: {
    width: 2,
    height: 30,
    backgroundColor: '#333333',
    marginTop: -20,
  },
  rippleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666666',
  },
  rippleContent: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    marginLeft: 8,
  },
  rippleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rippleEntity: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rippleImpactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rippleImpactText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  rippleDescription: {
    fontSize: 12,
    color: '#AAAAAA',
    marginBottom: 8,
  },
  rippleStats: {
    flexDirection: 'row',
    gap: 16,
  },
  rippleStat: {},
  rippleStatLabel: {
    fontSize: 10,
    color: '#666666',
  },
  rippleStatValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stakeholderCard: {
    width: 140,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  stakeholderPriority: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  stakeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stakeholderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 2,
  },
  stakeholderRole: {
    fontSize: 11,
    color: '#888888',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  stakeholderImpacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  stakeholderImpactTag: {
    backgroundColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stakeholderImpactText: {
    fontSize: 9,
    color: '#CCCCCC',
  },
  stakeholderMore: {
    fontSize: 10,
    color: '#666666',
  },
  actionRequired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  actionRequiredText: {
    fontSize: 10,
    color: '#FF6B6B',
  },
  scenarioTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  scenarioTab: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  scenarioTabActive: {
    backgroundColor: '#222222',
  },
  scenarioTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  scenarioTabProb: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  scenarioDetails: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  scenarioDescription: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginBottom: 16,
  },
  scenarioMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  scenarioMetricLabel: {
    fontSize: 12,
    color: '#888888',
  },
  scenarioMetricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scenarioList: {
    marginTop: 12,
  },
  scenarioListTitle: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 8,
  },
  scenarioListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  scenarioListText: {
    flex: 1,
    fontSize: 12,
    color: '#CCCCCC',
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  recommendationPriority: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recommendationPriorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  recommendationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recommendationTag: {
    backgroundColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recommendationTagText: {
    fontSize: 10,
    color: '#CCCCCC',
    textTransform: 'capitalize',
  },
  recommendationTimeframe: {
    fontSize: 10,
    color: '#888888',
  },
  recommendationImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendationImpactLabel: {
    fontSize: 11,
    color: '#888888',
  },
  recommendationImpactValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00FF88',
  },
});

export default ImpactBreakdown;
