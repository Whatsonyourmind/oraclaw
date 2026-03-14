/**
 * ORACLE Scenario Planning Service
 * Story adv-26 - What-if scenario analysis capability
 */

import type {
  Scenario,
  ScenarioVariable,
  ScenarioOutcome,
  ScenarioComparison,
  SensitivityAnalysis,
  ScenarioType,
  ScenarioStatus,
  VariableCategory,
  VariableType,
  ScenarioOutcomeType,
  RiskLevel,
  SensitivityAnalysisType,
  CreateScenarioParams,
  UpdateVariableParams,
  RunSensitivityParams,
  CompareScenarioParams,
  VariableValue,
} from '@mission-control/shared-types';
import { MonteCarloSimulator } from './monteCarlo';

// In-memory stores (would use Supabase in production)
const scenarios = new Map<string, Scenario>();
const variables = new Map<string, ScenarioVariable>();
const outcomes = new Map<string, ScenarioOutcome>();
const comparisons = new Map<string, ScenarioComparison>();
const sensitivityResults = new Map<string, SensitivityAnalysis>();

// LRU Cache for computed results
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = {
  scenario: 5 * 60 * 1000,    // 5 minutes
  sensitivity: 10 * 60 * 1000, // 10 minutes
  comparison: 5 * 60 * 1000,   // 5 minutes
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttl: number): void {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

class ScenarioPlanningService {
  // ==================== SCENARIO CRUD ====================

  async createScenario(userId: string, params: CreateScenarioParams): Promise<Scenario> {
    const id = generateId();
    const now = new Date().toISOString();

    const scenario: Scenario = {
      id,
      user_id: userId,
      decision_id: params.decision_id,
      name: params.name,
      description: params.description,
      scenario_type: params.scenario_type,
      status: 'draft',
      is_baseline: params.is_baseline || false,
      tags: params.tags || [],
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    // Copy variables from another scenario if specified
    if (params.copy_from_scenario_id) {
      const sourceVariables = this.getScenarioVariables(params.copy_from_scenario_id);
      for (const sourceVar of sourceVariables) {
        await this.addVariable(id, {
          name: sourceVar.name,
          description: sourceVar.description,
          category: sourceVar.category,
          variable_type: sourceVar.variable_type,
          current_value: sourceVar.current_value,
          baseline_value: sourceVar.baseline_value,
          min_value: sourceVar.min_value,
          max_value: sourceVar.max_value,
          step_size: sourceVar.step_size,
          options: sourceVar.options,
        });
      }
    }

    scenarios.set(id, scenario);
    return scenario;
  }

  async getScenario(scenarioId: string): Promise<Scenario | null> {
    return scenarios.get(scenarioId) || null;
  }

  async updateScenario(scenarioId: string, updates: Partial<Scenario>): Promise<Scenario | null> {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) return null;

    const updated: Scenario = {
      ...scenario,
      ...updates,
      id: scenario.id, // Prevent ID change
      user_id: scenario.user_id, // Prevent user change
      updated_at: new Date().toISOString(),
    };

    scenarios.set(scenarioId, updated);
    cache.delete(`scenario:${scenarioId}`);
    return updated;
  }

  async deleteScenario(scenarioId: string): Promise<boolean> {
    // Delete associated data
    for (const [id, variable] of variables) {
      if (variable.scenario_id === scenarioId) {
        variables.delete(id);
      }
    }
    for (const [id, outcome] of outcomes) {
      if (outcome.scenario_id === scenarioId) {
        outcomes.delete(id);
      }
    }
    for (const [id, result] of sensitivityResults) {
      if (result.scenario_id === scenarioId) {
        sensitivityResults.delete(id);
      }
    }

    cache.delete(`scenario:${scenarioId}`);
    return scenarios.delete(scenarioId);
  }

  async listScenarios(userId: string, filters?: {
    decision_id?: string;
    scenario_type?: ScenarioType;
    status?: ScenarioStatus;
  }): Promise<Scenario[]> {
    let results = Array.from(scenarios.values())
      .filter(s => s.user_id === userId);

    if (filters?.decision_id) {
      results = results.filter(s => s.decision_id === filters.decision_id);
    }
    if (filters?.scenario_type) {
      results = results.filter(s => s.scenario_type === filters.scenario_type);
    }
    if (filters?.status) {
      results = results.filter(s => s.status === filters.status);
    }

    return results.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // ==================== VARIABLE MANAGEMENT ====================

  async addVariable(scenarioId: string, params: {
    name: string;
    description?: string;
    category: VariableCategory;
    variable_type: VariableType;
    current_value: VariableValue;
    baseline_value?: VariableValue;
    min_value?: VariableValue;
    max_value?: VariableValue;
    step_size?: VariableValue;
    options?: Array<{ value: string | number; label: string }>;
  }): Promise<ScenarioVariable> {
    const id = generateId();
    const now = new Date().toISOString();

    // Calculate display order
    const existingVars = this.getScenarioVariables(scenarioId);
    const maxOrder = existingVars.reduce((max, v) => Math.max(max, v.display_order), 0);

    const variable: ScenarioVariable = {
      id,
      scenario_id: scenarioId,
      name: params.name,
      description: params.description,
      category: params.category,
      variable_type: params.variable_type,
      current_value: params.current_value,
      baseline_value: params.baseline_value || params.current_value,
      min_value: params.min_value,
      max_value: params.max_value,
      step_size: params.step_size,
      options: params.options,
      sensitivity_score: undefined,
      is_key_driver: false,
      display_order: maxOrder + 1,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    variables.set(id, variable);
    cache.delete(`scenario:${scenarioId}`);
    return variable;
  }

  async updateVariable(params: UpdateVariableParams): Promise<ScenarioVariable | null> {
    const variable = variables.get(params.variable_id);
    if (!variable) return null;

    const updated: ScenarioVariable = {
      ...variable,
      current_value: params.current_value,
      updated_at: new Date().toISOString(),
    };

    variables.set(params.variable_id, updated);
    cache.delete(`scenario:${variable.scenario_id}`);

    // Trigger outcome recalculation
    await this.recalculateOutcomes(variable.scenario_id);

    return updated;
  }

  async deleteVariable(variableId: string): Promise<boolean> {
    const variable = variables.get(variableId);
    if (variable) {
      cache.delete(`scenario:${variable.scenario_id}`);
    }
    return variables.delete(variableId);
  }

  getScenarioVariables(scenarioId: string): ScenarioVariable[] {
    return Array.from(variables.values())
      .filter(v => v.scenario_id === scenarioId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  // ==================== OUTCOME MANAGEMENT ====================

  async addOutcome(scenarioId: string, params: {
    outcome_type: ScenarioOutcomeType;
    name: string;
    description?: string;
    probability?: number;
    impact_score?: number;
    depends_on_variables?: string[];
    sensitivity_factors?: Record<string, number>;
  }): Promise<ScenarioOutcome> {
    const id = generateId();
    const now = new Date().toISOString();

    const outcome: ScenarioOutcome = {
      id,
      scenario_id: scenarioId,
      outcome_type: params.outcome_type,
      name: params.name,
      description: params.description,
      probability: params.probability,
      impact_score: params.impact_score,
      confidence: 0.7,
      depends_on_variables: params.depends_on_variables || [],
      sensitivity_factors: params.sensitivity_factors || {},
      risk_factors: [],
      success_factors: [],
      assumptions: [],
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    outcomes.set(id, outcome);
    return outcome;
  }

  getScenarioOutcomes(scenarioId: string): ScenarioOutcome[] {
    return Array.from(outcomes.values())
      .filter(o => o.scenario_id === scenarioId);
  }

  async recalculateOutcomes(scenarioId: string): Promise<void> {
    const scenarioVars = this.getScenarioVariables(scenarioId);
    const scenarioOutcomes = this.getScenarioOutcomes(scenarioId);

    for (const outcome of scenarioOutcomes) {
      if (Object.keys(outcome.sensitivity_factors).length === 0) continue;

      // Calculate new impact based on variable changes
      let impactDelta = 0;

      for (const [varId, sensitivity] of Object.entries(outcome.sensitivity_factors)) {
        const variable = scenarioVars.find(v => v.id === varId);
        if (!variable || !variable.baseline_value) continue;

        const currentVal = this.extractNumericValue(variable.current_value);
        const baseVal = this.extractNumericValue(variable.baseline_value);

        if (currentVal !== null && baseVal !== null && baseVal !== 0) {
          const percentChange = (currentVal - baseVal) / baseVal;
          impactDelta += percentChange * sensitivity * 100;
        }
      }

      // Update outcome
      const baseImpact = outcome.impact_score || 0;
      outcomes.set(outcome.id, {
        ...outcome,
        impact_score: baseImpact + impactDelta,
        updated_at: new Date().toISOString(),
      });
    }

    // Update scenario summary
    await this.updateScenarioSummary(scenarioId);
  }

  private extractNumericValue(value: VariableValue): number | null {
    if (typeof value.value === 'number') return value.value;
    if (typeof value.value === 'string') {
      const parsed = parseFloat(value.value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  async updateScenarioSummary(scenarioId: string): Promise<void> {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) return;

    const scenarioOutcomes = this.getScenarioOutcomes(scenarioId);

    // Calculate overall score (weighted average of outcome impacts)
    const primaryOutcomes = scenarioOutcomes.filter(o => o.outcome_type === 'primary');
    let overallScore = 0;
    let totalWeight = 0;

    for (const outcome of primaryOutcomes) {
      const weight = outcome.probability || 0.5;
      overallScore += (outcome.impact_score || 0) * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      overallScore /= totalWeight;
    }

    // Calculate probability of success
    const positiveOutcomes = scenarioOutcomes.filter(o =>
      o.outcome_type === 'primary' && (o.impact_score || 0) > 0
    );
    const probabilityOfSuccess = positiveOutcomes.length > 0
      ? positiveOutcomes.reduce((sum, o) => sum + (o.probability || 0), 0) / positiveOutcomes.length
      : 0.5;

    // Determine risk level
    const riskOutcomes = scenarioOutcomes.filter(o => o.outcome_type === 'risk');
    const avgRiskImpact = riskOutcomes.length > 0
      ? riskOutcomes.reduce((sum, o) => sum + Math.abs(o.impact_score || 0), 0) / riskOutcomes.length
      : 0;

    let riskLevel: RiskLevel;
    if (avgRiskImpact < 10) riskLevel = 'very_low';
    else if (avgRiskImpact < 25) riskLevel = 'low';
    else if (avgRiskImpact < 50) riskLevel = 'medium';
    else if (avgRiskImpact < 75) riskLevel = 'high';
    else riskLevel = 'very_high';

    // Generate summary
    const outcomeNames = primaryOutcomes.map(o => o.name).slice(0, 3);
    const outcomeSummary = outcomeNames.length > 0
      ? `Key outcomes: ${outcomeNames.join(', ')}`
      : 'No primary outcomes defined';

    await this.updateScenario(scenarioId, {
      overall_score: overallScore,
      probability_of_success: probabilityOfSuccess,
      risk_level: riskLevel,
      outcome_summary: outcomeSummary,
      status: 'completed',
    });

    // Compare to baseline if this isn't baseline
    if (!scenario.is_baseline && scenario.decision_id) {
      await this.compareToBaseline(scenarioId);
    }
  }

  async compareToBaseline(scenarioId: string): Promise<void> {
    const scenario = scenarios.get(scenarioId);
    if (!scenario || !scenario.decision_id) return;

    const baselineScenario = Array.from(scenarios.values())
      .find(s => s.decision_id === scenario.decision_id && s.is_baseline);

    if (!baselineScenario) return;

    const scoreDelta = (scenario.overall_score || 0) - (baselineScenario.overall_score || 0);

    const riskLevels = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
    const riskDelta = (riskLevels[scenario.risk_level || 'medium'] || 3) -
                      (riskLevels[baselineScenario.risk_level || 'medium'] || 3);

    // Find key differences in variables
    const baselineVars = this.getScenarioVariables(baselineScenario.id);
    const scenarioVars = this.getScenarioVariables(scenarioId);
    const keyDifferences: string[] = [];

    for (const sVar of scenarioVars) {
      const bVar = baselineVars.find(v => v.name === sVar.name);
      if (bVar) {
        const sVal = this.extractNumericValue(sVar.current_value);
        const bVal = this.extractNumericValue(bVar.current_value);
        if (sVal !== null && bVal !== null && sVal !== bVal) {
          const pctChange = ((sVal - bVal) / bVal) * 100;
          if (Math.abs(pctChange) >= 10) {
            keyDifferences.push(`${sVar.name}: ${pctChange > 0 ? '+' : ''}${pctChange.toFixed(0)}%`);
          }
        }
      }
    }

    await this.updateScenario(scenarioId, {
      compared_to_baseline: {
        score_delta: scoreDelta,
        risk_delta: riskDelta,
        key_differences: keyDifferences.slice(0, 5),
      },
    });
  }

  // ==================== SENSITIVITY ANALYSIS ====================

  async runSensitivityAnalysis(params: RunSensitivityParams): Promise<SensitivityAnalysis> {
    const cacheKey = `sensitivity:${params.scenario_id}:${params.analysis_type}`;
    const cached = getCached<SensitivityAnalysis>(cacheKey);
    if (cached) return cached;

    const scenarioVars = this.getScenarioVariables(params.scenario_id);
    const scenarioOutcomes = this.getScenarioOutcomes(params.scenario_id);

    const id = generateId();
    let result: SensitivityAnalysis;

    switch (params.analysis_type) {
      case 'tornado':
        result = await this.runTornadoAnalysis(id, params.scenario_id, scenarioVars, scenarioOutcomes);
        break;
      case 'spider':
        result = await this.runSpiderAnalysis(id, params.scenario_id, scenarioVars, scenarioOutcomes);
        break;
      case 'monte_carlo':
        result = await this.runMonteCarloSensitivity(id, params.scenario_id, scenarioVars, scenarioOutcomes, params.iterations);
        break;
      default:
        result = await this.runTornadoAnalysis(id, params.scenario_id, scenarioVars, scenarioOutcomes);
    }

    sensitivityResults.set(id, result);
    setCache(cacheKey, result, CACHE_TTL.sensitivity);
    return result;
  }

  private async runTornadoAnalysis(
    id: string,
    scenarioId: string,
    variables: ScenarioVariable[],
    outcomes: ScenarioOutcome[]
  ): Promise<SensitivityAnalysis> {
    const primaryOutcome = outcomes.find(o => o.outcome_type === 'primary');
    const baseOutcome = primaryOutcome?.impact_score || 0;

    const variableImpacts: Array<{
      variable_id: string;
      name: string;
      low_impact: number;
      high_impact: number;
      swing: number;
    }> = [];

    const tornadoData: Array<{
      variable_id: string;
      name: string;
      low_value: number;
      high_value: number;
      base_outcome: number;
      low_outcome: number;
      high_outcome: number;
    }> = [];

    for (const variable of variables) {
      if (variable.variable_type !== 'numeric' && variable.variable_type !== 'percentage') {
        continue;
      }

      const currentVal = this.extractNumericValue(variable.current_value) || 0;
      const minVal = variable.min_value ? (this.extractNumericValue(variable.min_value) || currentVal * 0.5) : currentVal * 0.5;
      const maxVal = variable.max_value ? (this.extractNumericValue(variable.max_value) || currentVal * 1.5) : currentVal * 1.5;

      // Calculate outcome at low and high values
      const sensitivity = primaryOutcome?.sensitivity_factors[variable.id] || 1;
      const lowOutcome = baseOutcome + ((minVal - currentVal) / currentVal) * sensitivity * 10;
      const highOutcome = baseOutcome + ((maxVal - currentVal) / currentVal) * sensitivity * 10;

      const swing = Math.abs(highOutcome - lowOutcome);

      variableImpacts.push({
        variable_id: variable.id,
        name: variable.name,
        low_impact: lowOutcome - baseOutcome,
        high_impact: highOutcome - baseOutcome,
        swing,
      });

      tornadoData.push({
        variable_id: variable.id,
        name: variable.name,
        low_value: minVal,
        high_value: maxVal,
        base_outcome: baseOutcome,
        low_outcome: lowOutcome,
        high_outcome: highOutcome,
      });
    }

    // Sort by swing (descending)
    variableImpacts.sort((a, b) => b.swing - a.swing);
    tornadoData.sort((a, b) => Math.abs(b.high_outcome - b.low_outcome) - Math.abs(a.high_outcome - a.low_outcome));

    // Update variable sensitivity scores
    for (const impact of variableImpacts) {
      const variable = variables.find(v => v.id === impact.variable_id);
      if (variable) {
        const normalizedSensitivity = Math.min(1, impact.swing / (variableImpacts[0]?.swing || 1));
        variables.set(impact.variable_id, {
          ...variable,
          sensitivity_score: normalizedSensitivity,
          is_key_driver: normalizedSensitivity > 0.7,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return {
      id,
      scenario_id: scenarioId,
      analysis_type: 'tornado',
      variable_impacts: variableImpacts,
      most_sensitive_variable_id: variableImpacts[0]?.variable_id,
      least_sensitive_variable_id: variableImpacts[variableImpacts.length - 1]?.variable_id,
      tornado_data: tornadoData,
      key_insights: this.generateTornadoInsights(variableImpacts),
      recommendations: this.generateTornadoRecommendations(variableImpacts),
      metadata: {},
      created_at: new Date().toISOString(),
    };
  }

  private async runSpiderAnalysis(
    id: string,
    scenarioId: string,
    variables: ScenarioVariable[],
    outcomes: ScenarioOutcome[]
  ): Promise<SensitivityAnalysis> {
    const primaryOutcome = outcomes.find(o => o.outcome_type === 'primary');
    const baseOutcome = primaryOutcome?.impact_score || 0;

    const percentageChanges = [-50, -25, -10, 0, 10, 25, 50];
    const variableImpacts: Array<{
      variable_id: string;
      name: string;
      low_impact: number;
      high_impact: number;
      swing: number;
    }> = [];

    const spiderData: Array<{
      variable_id: string;
      name: string;
      percentage_changes: number[];
      outcome_changes: number[];
    }> = [];

    for (const variable of variables) {
      if (variable.variable_type !== 'numeric' && variable.variable_type !== 'percentage') {
        continue;
      }

      const currentVal = this.extractNumericValue(variable.current_value) || 0;
      const sensitivity = primaryOutcome?.sensitivity_factors[variable.id] || 1;

      const outcomeChanges = percentageChanges.map(pctChange => {
        const newVal = currentVal * (1 + pctChange / 100);
        const delta = ((newVal - currentVal) / currentVal) * sensitivity * 10;
        return baseOutcome + delta;
      });

      const minOutcome = Math.min(...outcomeChanges);
      const maxOutcome = Math.max(...outcomeChanges);

      variableImpacts.push({
        variable_id: variable.id,
        name: variable.name,
        low_impact: minOutcome - baseOutcome,
        high_impact: maxOutcome - baseOutcome,
        swing: maxOutcome - minOutcome,
      });

      spiderData.push({
        variable_id: variable.id,
        name: variable.name,
        percentage_changes: percentageChanges,
        outcome_changes: outcomeChanges,
      });
    }

    variableImpacts.sort((a, b) => b.swing - a.swing);

    return {
      id,
      scenario_id: scenarioId,
      analysis_type: 'spider',
      variable_impacts: variableImpacts,
      most_sensitive_variable_id: variableImpacts[0]?.variable_id,
      least_sensitive_variable_id: variableImpacts[variableImpacts.length - 1]?.variable_id,
      spider_data: spiderData,
      key_insights: this.generateSpiderInsights(spiderData),
      recommendations: [],
      metadata: {},
      created_at: new Date().toISOString(),
    };
  }

  private async runMonteCarloSensitivity(
    id: string,
    scenarioId: string,
    variables: ScenarioVariable[],
    outcomes: ScenarioOutcome[],
    iterations: number = 1000
  ): Promise<SensitivityAnalysis> {
    const simulator = new MonteCarloSimulator();
    const primaryOutcome = outcomes.find(o => o.outcome_type === 'primary');

    // Build factors from variables
    const factors: Array<{
      name: string;
      distribution: 'normal' | 'uniform' | 'triangular';
      params: { mean?: number; std?: number; min?: number; max?: number; mode?: number };
    }> = [];

    for (const variable of variables) {
      if (variable.variable_type !== 'numeric') continue;

      const currentVal = this.extractNumericValue(variable.current_value) || 0;
      const minVal = variable.min_value ? (this.extractNumericValue(variable.min_value) || currentVal * 0.5) : currentVal * 0.5;
      const maxVal = variable.max_value ? (this.extractNumericValue(variable.max_value) || currentVal * 1.5) : currentVal * 1.5;

      factors.push({
        name: variable.name,
        distribution: 'triangular',
        params: {
          min: minVal,
          max: maxVal,
          mode: currentVal,
        },
      });
    }

    // Run simulation
    const result = simulator.run({
      factors,
      iterations,
      aggregation: 'sum',
    });

    // Calculate variable impacts based on correlation with output
    const variableImpacts = variables
      .filter(v => v.variable_type === 'numeric')
      .map(v => {
        const sensitivity = primaryOutcome?.sensitivity_factors[v.id] || 0.5;
        return {
          variable_id: v.id,
          name: v.name,
          low_impact: -result.std_deviation * sensitivity,
          high_impact: result.std_deviation * sensitivity,
          swing: result.std_deviation * sensitivity * 2,
        };
      })
      .sort((a, b) => b.swing - a.swing);

    return {
      id,
      scenario_id: scenarioId,
      analysis_type: 'monte_carlo',
      variable_impacts: variableImpacts,
      most_sensitive_variable_id: variableImpacts[0]?.variable_id,
      least_sensitive_variable_id: variableImpacts[variableImpacts.length - 1]?.variable_id,
      key_insights: [
        `Mean outcome: ${result.mean.toFixed(2)}`,
        `Standard deviation: ${result.std_deviation.toFixed(2)}`,
        `95% confidence interval: ${result.percentiles.p5.toFixed(2)} to ${result.percentiles.p95.toFixed(2)}`,
      ],
      recommendations: [],
      iterations,
      confidence_interval: 0.95,
      metadata: { simulation_result: result },
      created_at: new Date().toISOString(),
    };
  }

  private generateTornadoInsights(impacts: Array<{ name: string; swing: number }>): string[] {
    const insights: string[] = [];

    if (impacts.length > 0) {
      insights.push(`${impacts[0].name} is the most influential variable, with a swing of ${impacts[0].swing.toFixed(1)} points`);
    }

    const highImpactVars = impacts.filter(i => i.swing > impacts[0].swing * 0.5);
    if (highImpactVars.length > 1) {
      insights.push(`${highImpactVars.length} variables account for most of the outcome variability`);
    }

    const lowImpactVars = impacts.filter(i => i.swing < impacts[0].swing * 0.1);
    if (lowImpactVars.length > 0) {
      insights.push(`${lowImpactVars.length} variables have minimal impact and could be fixed`);
    }

    return insights;
  }

  private generateTornadoRecommendations(impacts: Array<{ name: string; swing: number }>): string[] {
    const recommendations: string[] = [];

    if (impacts.length > 0) {
      recommendations.push(`Focus risk mitigation efforts on ${impacts[0].name}`);
    }

    if (impacts.length > 2) {
      recommendations.push(`Monitor top 3 variables closely: ${impacts.slice(0, 3).map(i => i.name).join(', ')}`);
    }

    return recommendations;
  }

  private generateSpiderInsights(spiderData: Array<{ name: string; percentage_changes: number[]; outcome_changes: number[] }>): string[] {
    const insights: string[] = [];

    for (const data of spiderData.slice(0, 3)) {
      const maxChange = Math.max(...data.outcome_changes);
      const minChange = Math.min(...data.outcome_changes);
      const isAsymmetric = Math.abs(maxChange) > Math.abs(minChange) * 1.5 || Math.abs(minChange) > Math.abs(maxChange) * 1.5;

      if (isAsymmetric) {
        insights.push(`${data.name} shows asymmetric sensitivity - upside/downside responses differ significantly`);
      }
    }

    return insights;
  }

  // ==================== SCENARIO COMPARISON ====================

  async compareScenarios(userId: string, params: CompareScenarioParams): Promise<ScenarioComparison> {
    const id = generateId();
    const now = new Date().toISOString();

    // Get all scenarios
    const scenarioList = params.scenario_ids
      .map(id => scenarios.get(id))
      .filter((s): s is Scenario => s !== null);

    // Default comparison dimensions
    const dimensions = params.dimensions || [
      'overall_score',
      'probability_of_success',
      'risk_level',
    ];

    // Build comparison matrix
    const matrix: Record<string, Record<string, number>> = {};
    for (const scenario of scenarioList) {
      matrix[scenario.id] = {};
      for (const dim of dimensions) {
        let value = 0;
        switch (dim) {
          case 'overall_score':
            value = scenario.overall_score || 0;
            break;
          case 'probability_of_success':
            value = (scenario.probability_of_success || 0) * 100;
            break;
          case 'risk_level':
            const riskLevels = { very_low: 5, low: 4, medium: 3, high: 2, very_high: 1 };
            value = riskLevels[scenario.risk_level || 'medium'];
            break;
        }
        matrix[scenario.id][dim] = value;
      }
    }

    // Determine winner
    let winnerScenarioId: string | undefined;
    let bestScore = -Infinity;
    for (const scenario of scenarioList) {
      const totalScore = dimensions.reduce((sum, dim) => sum + (matrix[scenario.id][dim] || 0), 0);
      if (totalScore > bestScore) {
        bestScore = totalScore;
        winnerScenarioId = scenario.id;
      }
    }

    // Generate key differentiators
    const keyDifferentiators: Array<{ factor: string; scenario_id: string; advantage: string }> = [];
    for (const dim of dimensions) {
      let bestScenarioId = '';
      let bestValue = -Infinity;
      for (const scenario of scenarioList) {
        if (matrix[scenario.id][dim] > bestValue) {
          bestValue = matrix[scenario.id][dim];
          bestScenarioId = scenario.id;
        }
      }
      if (bestScenarioId) {
        const scenario = scenarioList.find(s => s.id === bestScenarioId);
        keyDifferentiators.push({
          factor: dim.replace(/_/g, ' '),
          scenario_id: bestScenarioId,
          advantage: `Best ${dim.replace(/_/g, ' ')}: ${bestValue.toFixed(1)}`,
        });
      }
    }

    // Generate trade-offs
    const tradeOffs: Array<{ scenario_a: string; scenario_b: string; description: string }> = [];
    if (scenarioList.length >= 2) {
      const s1 = scenarioList[0];
      const s2 = scenarioList[1];

      if ((s1.overall_score || 0) > (s2.overall_score || 0) &&
          (s1.probability_of_success || 0) < (s2.probability_of_success || 0)) {
        tradeOffs.push({
          scenario_a: s1.id,
          scenario_b: s2.id,
          description: `${s1.name} has higher score but lower success probability than ${s2.name}`,
        });
      }
    }

    const comparison: ScenarioComparison = {
      id,
      user_id: userId,
      name: params.name,
      description: params.description,
      scenario_ids: params.scenario_ids,
      comparison_matrix: { dimensions, scenarios: matrix },
      winner_scenario_id: winnerScenarioId,
      winner_reasoning: winnerScenarioId
        ? `${scenarioList.find(s => s.id === winnerScenarioId)?.name} has the best combined score across all dimensions`
        : undefined,
      key_differentiators: keyDifferentiators,
      trade_offs: tradeOffs,
      recommendations: this.generateComparisonRecommendations(scenarioList, keyDifferentiators),
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    comparisons.set(id, comparison);
    return comparison;
  }

  private generateComparisonRecommendations(
    scenarios: Scenario[],
    differentiators: Array<{ factor: string; scenario_id: string; advantage: string }>
  ): string {
    if (scenarios.length === 0) return 'No scenarios to compare';

    const baselineScenario = scenarios.find(s => s.is_baseline);
    const alternatives = scenarios.filter(s => !s.is_baseline);

    if (baselineScenario && alternatives.length > 0) {
      const bestAlt = alternatives.reduce((best, current) =>
        (current.overall_score || 0) > (best.overall_score || 0) ? current : best
      );

      if ((bestAlt.overall_score || 0) > (baselineScenario.overall_score || 0)) {
        return `Consider ${bestAlt.name} as it outperforms the baseline by ${((bestAlt.overall_score || 0) - (baselineScenario.overall_score || 0)).toFixed(1)} points`;
      } else {
        return `Baseline scenario remains the best option. Alternatives do not show significant improvement.`;
      }
    }

    return 'Review key differentiators to make an informed decision';
  }

  async getComparison(comparisonId: string): Promise<ScenarioComparison | null> {
    return comparisons.get(comparisonId) || null;
  }

  async listComparisons(userId: string): Promise<ScenarioComparison[]> {
    return Array.from(comparisons.values())
      .filter(c => c.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ==================== HELPER METHODS ====================

  async getFullScenarioState(scenarioId: string): Promise<{
    scenario: Scenario | null;
    variables: ScenarioVariable[];
    outcomes: ScenarioOutcome[];
    sensitivity?: SensitivityAnalysis;
  }> {
    const scenario = await this.getScenario(scenarioId);
    const scenarioVariables = this.getScenarioVariables(scenarioId);
    const scenarioOutcomes = this.getScenarioOutcomes(scenarioId);
    const sensitivity = Array.from(sensitivityResults.values())
      .find(s => s.scenario_id === scenarioId);

    return {
      scenario,
      variables: scenarioVariables,
      outcomes: scenarioOutcomes,
      sensitivity,
    };
  }

  async duplicateScenario(scenarioId: string, newName: string): Promise<Scenario | null> {
    const original = await this.getScenario(scenarioId);
    if (!original) return null;

    return this.createScenario(original.user_id, {
      name: newName,
      description: `Copy of ${original.name}`,
      scenario_type: original.scenario_type,
      decision_id: original.decision_id,
      is_baseline: false,
      tags: [...original.tags],
      copy_from_scenario_id: scenarioId,
    });
  }
}

export const scenarioPlanningService = new ScenarioPlanningService();
