/**
 * ORACLE Scenario Planner Screen
 * Story adv-27 - What-if scenario analysis interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { ORACLE_COLORS } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface ScenarioVariable {
  id: string;
  name: string;
  description?: string;
  category: string;
  variable_type: string;
  current_value: { value: number; unit?: string };
  baseline_value?: { value: number; unit?: string };
  min_value?: { value: number };
  max_value?: { value: number };
  step_size?: { value: number };
  sensitivity_score?: number;
  is_key_driver: boolean;
}

interface Scenario {
  id: string;
  name: string;
  description?: string;
  scenario_type: string;
  status: string;
  is_baseline: boolean;
  overall_score?: number;
  probability_of_success?: number;
  risk_level?: string;
  compared_to_baseline?: {
    score_delta?: number;
    risk_delta?: number;
    key_differences?: string[];
  };
}

interface SensitivityResult {
  variable_impacts: Array<{
    variable_id: string;
    name: string;
    low_impact: number;
    high_impact: number;
    swing: number;
  }>;
  key_insights: string[];
  recommendations: string[];
}

// Mock data
const MOCK_SCENARIOS: Scenario[] = [
  {
    id: '1',
    name: 'Baseline Scenario',
    description: 'Current state projection',
    scenario_type: 'baseline',
    status: 'completed',
    is_baseline: true,
    overall_score: 65,
    probability_of_success: 0.72,
    risk_level: 'medium',
  },
  {
    id: '2',
    name: 'Aggressive Growth',
    description: 'High investment, high risk',
    scenario_type: 'optimistic',
    status: 'completed',
    is_baseline: false,
    overall_score: 82,
    probability_of_success: 0.58,
    risk_level: 'high',
    compared_to_baseline: {
      score_delta: 17,
      risk_delta: 1,
      key_differences: ['Budget +30%', 'Timeline -20%'],
    },
  },
  {
    id: '3',
    name: 'Conservative Path',
    description: 'Lower risk, steady growth',
    scenario_type: 'pessimistic',
    status: 'completed',
    is_baseline: false,
    overall_score: 55,
    probability_of_success: 0.85,
    risk_level: 'low',
    compared_to_baseline: {
      score_delta: -10,
      risk_delta: -1,
      key_differences: ['Budget -15%', 'Timeline +10%'],
    },
  },
];

const MOCK_VARIABLES: ScenarioVariable[] = [
  {
    id: 'v1',
    name: 'Budget',
    description: 'Total project budget',
    category: 'resource',
    variable_type: 'numeric',
    current_value: { value: 100000, unit: '$' },
    baseline_value: { value: 100000, unit: '$' },
    min_value: { value: 50000 },
    max_value: { value: 200000 },
    step_size: { value: 5000 },
    sensitivity_score: 0.85,
    is_key_driver: true,
  },
  {
    id: 'v2',
    name: 'Timeline',
    description: 'Project duration in months',
    category: 'timeline',
    variable_type: 'numeric',
    current_value: { value: 6, unit: 'months' },
    baseline_value: { value: 6, unit: 'months' },
    min_value: { value: 3 },
    max_value: { value: 12 },
    step_size: { value: 1 },
    sensitivity_score: 0.72,
    is_key_driver: true,
  },
  {
    id: 'v3',
    name: 'Team Size',
    description: 'Number of team members',
    category: 'human',
    variable_type: 'numeric',
    current_value: { value: 5, unit: 'people' },
    baseline_value: { value: 5, unit: 'people' },
    min_value: { value: 2 },
    max_value: { value: 15 },
    step_size: { value: 1 },
    sensitivity_score: 0.58,
    is_key_driver: false,
  },
  {
    id: 'v4',
    name: 'Risk Tolerance',
    description: 'Acceptable risk level',
    category: 'economic',
    variable_type: 'percentage',
    current_value: { value: 25, unit: '%' },
    baseline_value: { value: 25, unit: '%' },
    min_value: { value: 5 },
    max_value: { value: 50 },
    step_size: { value: 5 },
    sensitivity_score: 0.45,
    is_key_driver: false,
  },
];

const MOCK_SENSITIVITY: SensitivityResult = {
  variable_impacts: [
    { variable_id: 'v1', name: 'Budget', low_impact: -25, high_impact: 35, swing: 60 },
    { variable_id: 'v2', name: 'Timeline', low_impact: -18, high_impact: 22, swing: 40 },
    { variable_id: 'v3', name: 'Team Size', low_impact: -12, high_impact: 15, swing: 27 },
    { variable_id: 'v4', name: 'Risk Tolerance', low_impact: -8, high_impact: 10, swing: 18 },
  ],
  key_insights: [
    'Budget is the most influential variable with a 60-point swing',
    '2 variables account for 75% of outcome variability',
    'Risk Tolerance has minimal impact and could be fixed',
  ],
  recommendations: [
    'Focus risk mitigation efforts on Budget',
    'Monitor top 3 variables closely',
  ],
};

export default function ScenarioPlanner() {
  const [scenarios, setScenarios] = useState<Scenario[]>(MOCK_SCENARIOS);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [variables, setVariables] = useState<ScenarioVariable[]>(MOCK_VARIABLES);
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareScenarios, setCompareScenarios] = useState<string[]>([]);
  const [showNewScenarioModal, setShowNewScenarioModal] = useState(false);
  const [showSensitivityModal, setShowSensitivityModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Animated values for outcome recalculation
  const outcomeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Select baseline by default
    const baseline = scenarios.find(s => s.is_baseline);
    if (baseline) setSelectedScenario(baseline);
  }, []);

  const handleVariableChange = useCallback((variableId: string, value: number) => {
    setVariables(prev => prev.map(v =>
      v.id === variableId ? { ...v, current_value: { ...v.current_value, value } } : v
    ));

    // Animate outcome recalculation
    setIsCalculating(true);
    Animated.sequence([
      Animated.timing(outcomeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(outcomeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setIsCalculating(false));
  }, []);

  const runSensitivityAnalysis = useCallback(() => {
    setSensitivityResult(MOCK_SENSITIVITY);
    setShowSensitivityModal(true);
  }, []);

  const toggleCompareScenario = (scenarioId: string) => {
    setCompareScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      }
      if (prev.length >= 3) {
        Alert.alert('Limit Reached', 'You can compare up to 3 scenarios at a time');
        return prev;
      }
      return [...prev, scenarioId];
    });
  };

  const renderScenarioCard = ({ item }: { item: Scenario }) => {
    const isSelected = selectedScenario?.id === item.id;
    const isComparing = compareScenarios.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.scenarioCard,
          isSelected && styles.scenarioCardSelected,
          isComparing && styles.scenarioCardCompare,
        ]}
        onPress={() => compareMode ? toggleCompareScenario(item.id) : setSelectedScenario(item)}
      >
        {compareMode && (
          <View style={[styles.compareCheckbox, isComparing && styles.compareCheckboxChecked]}>
            {isComparing && <Text style={styles.compareCheckmark}>✓</Text>}
          </View>
        )}

        <View style={styles.scenarioHeader}>
          <View style={styles.scenarioTitleRow}>
            <Text style={styles.scenarioName}>{item.name}</Text>
            {item.is_baseline && (
              <View style={styles.baselineBadge}>
                <Text style={styles.baselineBadgeText}>BASELINE</Text>
              </View>
            )}
          </View>
          <Text style={styles.scenarioType}>{item.scenario_type}</Text>
        </View>

        {item.description && (
          <Text style={styles.scenarioDescription}>{item.description}</Text>
        )}

        <View style={styles.scenarioMetrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{item.overall_score || '--'}</Text>
            <Text style={styles.metricLabel}>Score</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {item.probability_of_success ? `${Math.round(item.probability_of_success * 100)}%` : '--'}
            </Text>
            <Text style={styles.metricLabel}>Success</Text>
          </View>
          <View style={styles.metric}>
            <RiskBadge level={item.risk_level} />
            <Text style={styles.metricLabel}>Risk</Text>
          </View>
        </View>

        {item.compared_to_baseline && !item.is_baseline && (
          <View style={styles.comparisonSection}>
            <Text style={[
              styles.scoreDelta,
              (item.compared_to_baseline.score_delta || 0) >= 0 ? styles.positive : styles.negative,
            ]}>
              {(item.compared_to_baseline.score_delta || 0) >= 0 ? '+' : ''}
              {item.compared_to_baseline.score_delta} vs baseline
            </Text>
            {item.compared_to_baseline.key_differences?.slice(0, 2).map((diff, i) => (
              <Text key={i} style={styles.difference}>{diff}</Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderVariableSlider = (variable: ScenarioVariable) => {
    const minVal = variable.min_value?.value || 0;
    const maxVal = variable.max_value?.value || 100;
    const currentVal = variable.current_value.value;
    const baselineVal = variable.baseline_value?.value || currentVal;
    const step = variable.step_size?.value || 1;

    const changePercent = baselineVal !== 0
      ? ((currentVal - baselineVal) / baselineVal) * 100
      : 0;

    return (
      <View key={variable.id} style={styles.variableContainer}>
        <View style={styles.variableHeader}>
          <View style={styles.variableNameRow}>
            <Text style={styles.variableName}>{variable.name}</Text>
            {variable.is_key_driver && (
              <View style={styles.keyDriverBadge}>
                <Text style={styles.keyDriverText}>KEY</Text>
              </View>
            )}
          </View>
          <View style={styles.variableValueContainer}>
            <Text style={styles.variableValue}>
              {variable.current_value.unit === '$' ? '$' : ''}
              {currentVal.toLocaleString()}
              {variable.current_value.unit && variable.current_value.unit !== '$' ? ` ${variable.current_value.unit}` : ''}
            </Text>
            {changePercent !== 0 && (
              <Text style={[styles.changePercent, changePercent >= 0 ? styles.positive : styles.negative]}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(0)}%
              </Text>
            )}
          </View>
        </View>

        {variable.sensitivity_score !== undefined && (
          <View style={styles.sensitivityBar}>
            <View style={[styles.sensitivityFill, { width: `${variable.sensitivity_score * 100}%` }]} />
          </View>
        )}

        <Slider
          style={styles.slider}
          minimumValue={minVal}
          maximumValue={maxVal}
          step={step}
          value={currentVal}
          onValueChange={(val) => handleVariableChange(variable.id, val)}
          minimumTrackTintColor={ORACLE_COLORS.decide}
          maximumTrackTintColor="#333"
          thumbTintColor={ORACLE_COLORS.decide}
        />

        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>
            {variable.current_value.unit === '$' ? '$' : ''}{minVal.toLocaleString()}
          </Text>
          <Text style={styles.sliderLabel}>
            {variable.current_value.unit === '$' ? '$' : ''}{maxVal.toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Scenario Planner</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.compareButton, compareMode && styles.compareButtonActive]}
            onPress={() => {
              setCompareMode(!compareMode);
              if (compareMode) setCompareScenarios([]);
            }}
          >
            <Text style={[styles.compareButtonText, compareMode && styles.compareButtonTextActive]}>
              {compareMode ? `Compare (${compareScenarios.length})` : 'Compare'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowNewScenarioModal(true)}>
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Scenarios List */}
        <Text style={styles.sectionTitle}>Scenarios</Text>
        <FlatList
          data={scenarios}
          renderItem={renderScenarioCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scenariosList}
        />

        {/* Compare View */}
        {compareMode && compareScenarios.length >= 2 && (
          <View style={styles.compareContainer}>
            <Text style={styles.sectionTitle}>Comparison</Text>
            <ComparisonChart
              scenarios={scenarios.filter(s => compareScenarios.includes(s.id))}
            />
          </View>
        )}

        {/* Variable Sliders */}
        {selectedScenario && !compareMode && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Adjust Variables</Text>
              <TouchableOpacity style={styles.sensitivityButton} onPress={runSensitivityAnalysis}>
                <Text style={styles.sensitivityButtonText}>Sensitivity</Text>
              </TouchableOpacity>
            </View>

            <Animated.View style={[
              styles.variablesContainer,
              {
                opacity: outcomeAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0.7, 1],
                }),
              },
            ]}>
              {variables.map(renderVariableSlider)}
            </Animated.View>

            {/* Real-time Outcome Preview */}
            <View style={styles.outcomePreview}>
              <Text style={styles.outcomeTitle}>Projected Outcome</Text>
              <View style={styles.outcomeMetrics}>
                <View style={styles.outcomeStat}>
                  <Text style={styles.outcomeValue}>
                    {selectedScenario.overall_score || 65}
                  </Text>
                  <Text style={styles.outcomeLabel}>Score</Text>
                </View>
                <View style={styles.outcomeStat}>
                  <Text style={styles.outcomeValue}>
                    {Math.round((selectedScenario.probability_of_success || 0.72) * 100)}%
                  </Text>
                  <Text style={styles.outcomeLabel}>Success Rate</Text>
                </View>
              </View>
              {isCalculating && (
                <Text style={styles.calculatingText}>Recalculating...</Text>
              )}
            </View>

            {/* Save Scenario Button */}
            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save as New Scenario</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Sensitivity Analysis Modal */}
      <Modal visible={showSensitivityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sensitivity Analysis</Text>
              <TouchableOpacity onPress={() => setShowSensitivityModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            {sensitivityResult && (
              <ScrollView style={styles.modalBody}>
                {/* Tornado Chart */}
                <Text style={styles.chartTitle}>Tornado Chart</Text>
                <TornadoChart impacts={sensitivityResult.variable_impacts} />

                {/* Key Insights */}
                <Text style={styles.insightsTitle}>Key Insights</Text>
                {sensitivityResult.key_insights.map((insight, i) => (
                  <View key={i} style={styles.insightItem}>
                    <Text style={styles.insightBullet}>•</Text>
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}

                {/* Recommendations */}
                <Text style={styles.insightsTitle}>Recommendations</Text>
                {sensitivityResult.recommendations.map((rec, i) => (
                  <View key={i} style={styles.insightItem}>
                    <Text style={styles.recBullet}>→</Text>
                    <Text style={styles.insightText}>{rec}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* New Scenario Modal */}
      <NewScenarioModal
        visible={showNewScenarioModal}
        onClose={() => setShowNewScenarioModal(false)}
        onSave={(name, type) => {
          const newScenario: Scenario = {
            id: `s${Date.now()}`,
            name,
            scenario_type: type,
            status: 'draft',
            is_baseline: false,
          };
          setScenarios([...scenarios, newScenario]);
          setSelectedScenario(newScenario);
          setShowNewScenarioModal(false);
        }}
      />
    </View>
  );
}

// Risk Badge Component
function RiskBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    very_low: '#00ff88',
    low: '#00bfff',
    medium: '#ffd700',
    high: '#ff8c00',
    very_high: '#ff4444',
  };

  const labels: Record<string, string> = {
    very_low: 'Very Low',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    very_high: 'Very High',
  };

  return (
    <View style={[styles.riskBadge, { backgroundColor: colors[level || 'medium'] + '33' }]}>
      <View style={[styles.riskDot, { backgroundColor: colors[level || 'medium'] }]} />
      <Text style={[styles.riskText, { color: colors[level || 'medium'] }]}>
        {labels[level || 'medium']}
      </Text>
    </View>
  );
}

// Tornado Chart Component
function TornadoChart({ impacts }: { impacts: SensitivityResult['variable_impacts'] }) {
  const maxSwing = Math.max(...impacts.map(i => i.swing));

  return (
    <View style={styles.tornadoContainer}>
      {impacts.map((impact, index) => {
        const lowWidth = (Math.abs(impact.low_impact) / maxSwing) * 100;
        const highWidth = (Math.abs(impact.high_impact) / maxSwing) * 100;

        return (
          <View key={impact.variable_id} style={styles.tornadoRow}>
            <Text style={styles.tornadoLabel}>{impact.name}</Text>
            <View style={styles.tornadoBars}>
              <View style={styles.tornadoLeft}>
                <View style={[styles.tornadoBarLow, { width: `${lowWidth}%` }]} />
              </View>
              <View style={styles.tornadoCenter} />
              <View style={styles.tornadoRight}>
                <View style={[styles.tornadoBarHigh, { width: `${highWidth}%` }]} />
              </View>
            </View>
            <Text style={styles.tornadoSwing}>{impact.swing.toFixed(0)}</Text>
          </View>
        );
      })}
      <View style={styles.tornadoLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff6b6b' }]} />
          <Text style={styles.legendText}>Negative Impact</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00ff88' }]} />
          <Text style={styles.legendText}>Positive Impact</Text>
        </View>
      </View>
    </View>
  );
}

// Comparison Chart Component
function ComparisonChart({ scenarios }: { scenarios: Scenario[] }) {
  const dimensions = ['Score', 'Success %', 'Risk'];

  return (
    <View style={styles.comparisonContainer}>
      <View style={styles.comparisonHeader}>
        <View style={styles.comparisonDimLabel} />
        {scenarios.map(s => (
          <View key={s.id} style={styles.comparisonScenarioLabel}>
            <Text style={styles.comparisonScenarioName} numberOfLines={1}>{s.name}</Text>
          </View>
        ))}
      </View>

      {dimensions.map(dim => (
        <View key={dim} style={styles.comparisonRow}>
          <Text style={styles.comparisonDim}>{dim}</Text>
          {scenarios.map(s => {
            let value = '--';
            if (dim === 'Score') value = `${s.overall_score || 0}`;
            if (dim === 'Success %') value = `${Math.round((s.probability_of_success || 0) * 100)}%`;
            if (dim === 'Risk') value = s.risk_level || 'medium';

            return (
              <View key={s.id} style={styles.comparisonCell}>
                <Text style={styles.comparisonValue}>{value}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// New Scenario Modal Component
function NewScenarioModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, type: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('alternative');

  const types = ['baseline', 'optimistic', 'pessimistic', 'alternative', 'stress_test'];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Scenario</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Scenario Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter scenario name"
              placeholderTextColor="#666"
            />

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeOptions}>
              {types.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeOption, type === t && styles.typeOptionSelected]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeOptionText, type === t && styles.typeOptionTextSelected]}>
                    {t.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={() => name.trim() && onSave(name, type)}
              disabled={!name.trim()}
            >
              <Text style={styles.createButtonText}>Create Scenario</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  compareButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  compareButtonActive: {
    backgroundColor: ORACLE_COLORS.decide,
    borderColor: ORACLE_COLORS.decide,
  },
  compareButtonText: {
    color: '#888',
    fontSize: 12,
  },
  compareButtonTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: ORACLE_COLORS.decide,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  scenariosList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  scenarioCard: {
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  scenarioCardSelected: {
    borderColor: ORACLE_COLORS.decide,
  },
  scenarioCardCompare: {
    borderColor: ORACLE_COLORS.orient,
  },
  compareCheckbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareCheckboxChecked: {
    backgroundColor: ORACLE_COLORS.orient,
    borderColor: ORACLE_COLORS.orient,
  },
  compareCheckmark: {
    color: '#000',
    fontWeight: 'bold',
  },
  scenarioHeader: {
    marginBottom: 8,
  },
  scenarioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  baselineBadge: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  baselineBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scenarioType: {
    color: '#888',
    fontSize: 12,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  scenarioDescription: {
    color: '#666',
    fontSize: 12,
    marginBottom: 12,
  },
  scenarioMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  comparisonSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  scoreDelta: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  positive: {
    color: '#00ff88',
  },
  negative: {
    color: '#ff6b6b',
  },
  difference: {
    color: '#888',
    fontSize: 11,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '500',
  },
  variablesContainer: {
    padding: 16,
  },
  variableContainer: {
    marginBottom: 24,
  },
  variableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  variableNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variableName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  keyDriverBadge: {
    backgroundColor: ORACLE_COLORS.decide + '33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  keyDriverText: {
    color: ORACLE_COLORS.decide,
    fontSize: 9,
    fontWeight: 'bold',
  },
  variableValueContainer: {
    alignItems: 'flex-end',
  },
  variableValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  changePercent: {
    fontSize: 11,
    fontWeight: '600',
  },
  sensitivityBar: {
    height: 3,
    backgroundColor: '#333',
    borderRadius: 1.5,
    marginBottom: 12,
  },
  sensitivityFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.decide,
    borderRadius: 1.5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: '#666',
    fontSize: 11,
  },
  sensitivityButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sensitivityButtonText: {
    color: ORACLE_COLORS.decide,
    fontSize: 12,
  },
  outcomePreview: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.decide + '44',
  },
  outcomeTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  outcomeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  outcomeStat: {
    alignItems: 'center',
  },
  outcomeValue: {
    color: ORACLE_COLORS.decide,
    fontSize: 28,
    fontWeight: 'bold',
  },
  outcomeLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  calculatingText: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  saveButton: {
    backgroundColor: ORACLE_COLORS.decide,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  compareContainer: {
    marginTop: 8,
  },
  comparisonContainer: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  comparisonDimLabel: {
    width: 80,
    padding: 12,
  },
  comparisonScenarioLabel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#333',
  },
  comparisonScenarioName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  comparisonRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  comparisonDim: {
    width: 80,
    padding: 12,
    color: '#888',
    fontSize: 12,
  },
  comparisonCell: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#333',
  },
  comparisonValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    color: '#888',
    fontSize: 28,
    lineHeight: 28,
  },
  modalBody: {
    padding: 16,
  },
  chartTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tornadoContainer: {
    marginBottom: 24,
  },
  tornadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tornadoLabel: {
    width: 80,
    color: '#888',
    fontSize: 12,
  },
  tornadoBars: {
    flex: 1,
    flexDirection: 'row',
    height: 20,
  },
  tornadoLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tornadoBarLow: {
    height: '100%',
    backgroundColor: '#ff6b6b',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  tornadoCenter: {
    width: 2,
    backgroundColor: '#444',
  },
  tornadoRight: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tornadoBarHigh: {
    height: '100%',
    backgroundColor: '#00ff88',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  tornadoSwing: {
    width: 40,
    textAlign: 'right',
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tornadoLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#888',
    fontSize: 11,
  },
  insightsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  insightBullet: {
    color: ORACLE_COLORS.decide,
    fontSize: 14,
    marginRight: 8,
  },
  recBullet: {
    color: ORACLE_COLORS.act,
    fontSize: 14,
    marginRight: 8,
  },
  insightText: {
    flex: 1,
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
  },
  typeOptionSelected: {
    backgroundColor: ORACLE_COLORS.decide,
  },
  typeOptionText: {
    color: '#888',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  typeOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: ORACLE_COLORS.decide,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonDisabled: {
    backgroundColor: '#333',
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
