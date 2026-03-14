import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  Signal,
  SignalCluster,
  StrategicContext,
  StrategicHorizon,
  Correlation,
  DecisionOption,
  SimulationResult,
  CriticalPath,
  ExecutionPlan,
  ExecutionStep,
  CopilotSuggestion,
  Lesson,
  HorizonType,
  SignalType,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// FREE TIER: Google Gemini API
// Limits: 15 requests/minute, free quota resets daily
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  // ============================================================================
  // ORACLE OBSERVE MODULE METHODS
  // ============================================================================

  /**
   * Radar scan to detect signals from calendar, tasks, emails, and patterns
   * Story 4.1
   */
  async radarScan(input: {
    calendar: any[];
    tasks: any[];
    emails: any[];
    patterns: any[];
  }): Promise<Partial<Signal>[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE, an intelligence system that scans data sources to detect signals.
Analyze the following data and identify signals that require attention:

Calendar Events: ${JSON.stringify(input.calendar)}
Tasks: ${JSON.stringify(input.tasks)}
Emails: ${JSON.stringify(input.emails)}
Historical Patterns: ${JSON.stringify(input.patterns)}

Detect signals such as:
- Deadline conflicts or risks
- Scheduling conflicts
- Opportunities (time windows, synergies)
- Anomalies from normal patterns
- Dependencies between items
- Resource constraints

Return JSON array:
[
  {
    "signal_type": "deadline|conflict|opportunity|risk|anomaly|pattern|dependency|resource",
    "title": "signal title",
    "description": "detailed description",
    "urgency": "critical|high|medium|low",
    "impact": "critical|high|medium|low",
    "confidence": 0.85,
    "source_data": {"relevant": "data"},
    "related_entity_type": "task|event|email",
    "related_entity_id": "id if applicable"
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to parse radar scan:', error);
      return this.getFallbackSignals();
    }
  }

  /**
   * Detect anomalies by comparing baseline patterns to current state
   * Story 4.2
   */
  async detectAnomalies(input: {
    baseline: Record<string, any>;
    currentState: Record<string, any>;
    sensitivityLevel?: 'low' | 'medium' | 'high';
  }): Promise<Array<{ description: string; severity: ImpactLevel; confidence: number; zScore?: number }>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's anomaly detection system.
Compare baseline patterns against current state to identify deviations.

Baseline Patterns: ${JSON.stringify(input.baseline)}
Current State: ${JSON.stringify(input.currentState)}
Sensitivity Level: ${input.sensitivityLevel || 'medium'}

Detect anomalies using z-score concepts:
- Low sensitivity: |z| > 3 (only extreme deviations)
- Medium sensitivity: |z| > 2
- High sensitivity: |z| > 1.5

Return JSON array:
[
  {
    "description": "what is anomalous",
    "severity": "critical|high|medium|low",
    "confidence": 0.8,
    "zScore": 2.5,
    "baselineValue": "expected",
    "currentValue": "observed"
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to detect anomalies:', error);
      return [];
    }
  }

  /**
   * Cluster related signals together
   * Story 4.3
   */
  async clusterSignals(signals: Partial<Signal>[]): Promise<Array<{
    label: string;
    summary: string;
    signal_ids: string[];
    combined_urgency: UrgencyLevel;
    combined_impact: ImpactLevel;
    confidence: number;
  }>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's signal clustering system.
Group related signals together based on semantic similarity, shared entities, or causal relationships.

Signals: ${JSON.stringify(signals)}

Return JSON array of clusters:
[
  {
    "label": "cluster name",
    "summary": "why these signals are related",
    "signal_indices": [0, 2, 5],
    "combined_urgency": "critical|high|medium|low",
    "combined_impact": "critical|high|medium|low",
    "confidence": 0.85
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const clusters = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
      // Map indices to IDs if signals have IDs
      return clusters.map((c: any) => ({
        ...c,
        signal_ids: c.signal_indices.map((i: number) => signals[i]?.id || `signal-${i}`),
      }));
    } catch (error) {
      console.error('Failed to cluster signals:', error);
      return [];
    }
  }

  // ============================================================================
  // ORACLE ORIENT MODULE METHODS
  // ============================================================================

  /**
   * Generate strategic context from signals
   * Story 4.4
   */
  async generateOrientation(input: {
    signals: Partial<Signal>[];
    userContext: Record<string, any>;
  }): Promise<Partial<StrategicContext>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's strategic orientation system.
Synthesize signals into a coherent strategic context.

Signals: ${JSON.stringify(input.signals)}
User Context: ${JSON.stringify(input.userContext)}

Return JSON:
{
  "situation_summary": "1-2 paragraph overview of current situation",
  "key_factors": [
    {"factor": "factor name", "importance": 0.9, "trend": "improving|stable|declining"}
  ],
  "recommendations": [
    {"action": "what to do", "priority": "critical|high|medium|low", "rationale": "why"}
  ],
  "constraints": [
    {"description": "constraint", "type": "time|resource|dependency|policy|other"}
  ],
  "assumptions": [
    {"description": "assumption made", "confidence": 0.8}
  ],
  "confidence": 0.85
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to generate orientation:', error);
      return this.getFallbackContext();
    }
  }

  /**
   * Create multi-horizon plans
   * Story 4.5
   */
  async planHorizons(input: {
    context: Partial<StrategicContext>;
    constraints: Record<string, any>;
  }): Promise<Record<HorizonType, Partial<StrategicHorizon>>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's multi-horizon planning system.
Create plans for each time horizon based on the strategic context.

Context: ${JSON.stringify(input.context)}
Constraints: ${JSON.stringify(input.constraints)}

Return JSON with plans for each horizon:
{
  "immediate": {
    "horizon_type": "immediate",
    "goals": [{"description": "goal", "priority": 0.9, "measurable_outcome": "metric"}],
    "actions": [{"description": "action", "priority": "high", "estimated_effort": "1 hour"}],
    "dependencies": [{"description": "dependency", "blocking": true}],
    "risks": [{"description": "risk", "likelihood": 0.3, "impact": "high"}],
    "opportunities": [{"description": "opportunity", "potential_value": "high"}],
    "confidence": 0.9
  },
  "today": { ... similar structure ... },
  "week": { ... similar structure ... },
  "month": { ... similar structure ... }
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to plan horizons:', error);
      return this.getFallbackHorizons();
    }
  }

  /**
   * Discover correlations between entities
   * Story 4.6
   */
  async discoverCorrelations(input: {
    entities: Array<{ type: string; id: string; data: any }>;
    history: any[];
  }): Promise<Partial<Correlation>[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's correlation discovery system.
Find relationships between entities based on data and history.

Entities: ${JSON.stringify(input.entities)}
Historical Data: ${JSON.stringify(input.history)}

Return JSON array of correlations:
[
  {
    "source_entity_type": "type",
    "source_entity_id": "id",
    "target_entity_type": "type",
    "target_entity_id": "id",
    "correlation_type": "causal|temporal|semantic|dependency|conflict|synergy",
    "strength": 0.75,
    "direction": "forward|backward|bidirectional",
    "description": "description of relationship",
    "evidence": [{"description": "evidence", "source": "where from", "weight": 0.8}],
    "confidence": 0.8
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to discover correlations:', error);
      return [];
    }
  }

  // ============================================================================
  // ORACLE DECIDE MODULE METHODS
  // ============================================================================

  /**
   * Generate decision options
   * Story 4.7
   */
  async generateDecisionOptions(input: {
    context: string;
    constraints: Record<string, any>;
    criteria?: Array<{ name: string; weight: number }>;
  }): Promise<Partial<DecisionOption>[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's decision option generator.
Generate 3-5 distinct approaches for this decision.

Decision Context: ${input.context}
Constraints: ${JSON.stringify(input.constraints)}
Evaluation Criteria: ${JSON.stringify(input.criteria || [])}

Return JSON array of 3-5 options:
[
  {
    "title": "option name",
    "description": "detailed description",
    "pros": [{"point": "advantage", "weight": 0.8}],
    "cons": [{"point": "disadvantage", "weight": 0.6}],
    "estimated_outcomes": {
      "best_case": "scenario",
      "worst_case": "scenario",
      "most_likely": "scenario",
      "metrics": {"cost": 1000, "time_days": 5}
    },
    "resource_requirements": {
      "time": "2 weeks",
      "cost": 5000,
      "people": 3,
      "dependencies": ["dep1", "dep2"]
    },
    "risks": [{"description": "risk", "likelihood": 0.3, "impact": "medium"}],
    "confidence": 0.75,
    "is_recommended": false
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const options = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
      // Mark highest scoring as recommended
      if (options.length > 0) {
        options[0].is_recommended = true;
      }
      return options;
    } catch (error) {
      console.error('Failed to generate options:', error);
      return this.getFallbackOptions();
    }
  }

  /**
   * Simulate outcomes for an option (assist Monte Carlo)
   * Story 4.8
   */
  async simulateOutcomes(input: {
    option: Partial<DecisionOption>;
    scenarios: Record<string, any>;
  }): Promise<{
    factors: Array<{ name: string; distribution: string; params: number[] }>;
    interactions: string[];
    confidence: number;
  }> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's simulation parameter generator.
Define probability distributions for Monte Carlo simulation.

Option: ${JSON.stringify(input.option)}
Scenarios: ${JSON.stringify(input.scenarios)}

Return JSON with simulation parameters:
{
  "factors": [
    {"name": "cost", "distribution": "normal|lognormal|uniform|triangular", "params": [100, 20]},
    {"name": "duration", "distribution": "triangular", "params": [5, 7, 14]},
    {"name": "success_rate", "distribution": "beta", "params": [8, 2]}
  ],
  "interactions": [
    "if cost > 150 then duration increases by 20%",
    "success_rate decreases with duration"
  ],
  "confidence": 0.75
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to simulate outcomes:', error);
      return { factors: [], interactions: [], confidence: 0.5 };
    }
  }

  /**
   * Analyze critical execution path
   * Story 4.9
   */
  async analyzeCriticalPath(input: {
    steps: Array<{ name: string; duration: number; dependencies: string[] }>;
    resources: string[];
  }): Promise<Partial<CriticalPath>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's critical path analyzer.
Identify the critical path and bottlenecks in execution.

Steps: ${JSON.stringify(input.steps)}
Available Resources: ${JSON.stringify(input.resources)}

Return JSON:
{
  "steps": [
    {"id": "step-1", "name": "name", "duration_hours": 4, "dependencies": [], "resources": ["r1"]}
  ],
  "dependencies": [
    {"from_step": "step-1", "to_step": "step-2", "type": "finish_to_start"}
  ],
  "bottlenecks": [
    {"step_id": "step-3", "reason": "why bottleneck", "severity": "high"}
  ],
  "total_duration_hours": 24,
  "critical_sequence": ["step-1", "step-3", "step-5"],
  "parallel_tracks": [
    {"track_id": "track-a", "steps": ["step-2", "step-4"]}
  ],
  "risk_points": [
    {"step_id": "step-3", "risk": "risk description", "mitigation": "how to mitigate"}
  ],
  "confidence": 0.8
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to analyze critical path:', error);
      return { steps: [], critical_sequence: [], confidence: 0.5 };
    }
  }

  // ============================================================================
  // ORACLE ACT MODULE METHODS
  // ============================================================================

  /**
   * Generate execution plan from decision
   * Story 4.10
   */
  async generateExecutionPlan(input: {
    decision: { title: string; description: string };
    selectedOption: Partial<DecisionOption>;
  }): Promise<{
    title: string;
    description: string;
    steps: Partial<ExecutionStep>[];
    confidence: number;
  }> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's execution plan generator.
Create a detailed step-by-step action plan.

Decision: ${JSON.stringify(input.decision)}
Selected Option: ${JSON.stringify(input.selectedOption)}

Return JSON:
{
  "title": "plan title",
  "description": "plan overview",
  "steps": [
    {
      "step_number": 1,
      "title": "step title",
      "description": "detailed instructions",
      "priority": "critical|high|medium|low",
      "completion_criteria": [
        {"description": "how to know step is done", "met": false}
      ],
      "dependencies": [{"step_id": "previous-step", "type": "required"}],
      "estimated_duration_minutes": 60,
      "assigned_to": "role or person"
    }
  ],
  "confidence": 0.85
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to generate execution plan:', error);
      return { title: 'Execution Plan', description: '', steps: [], confidence: 0.5 };
    }
  }

  /**
   * Get copilot guidance during execution
   * Story 4.11
   */
  async getCopilotGuidance(input: {
    plan: { title: string; steps: Partial<ExecutionStep>[] };
    currentStep: Partial<ExecutionStep>;
    progress: { completed: number; total: number; blockers: string[] };
  }): Promise<{
    suggestions: CopilotSuggestion[];
    health_assessment: { overall: 'healthy' | 'at_risk' | 'critical'; issues: string[]; positives: string[] };
    predictions: { completion_likelihood: number; estimated_delay_hours?: number; risk_factors: string[] };
  }> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's execution copilot.
Provide real-time guidance and assessment.

Plan: ${JSON.stringify(input.plan)}
Current Step: ${JSON.stringify(input.currentStep)}
Progress: ${JSON.stringify(input.progress)}

Return JSON:
{
  "suggestions": [
    {
      "type": "guidance|warning|optimization|encouragement|pivot|escalation",
      "content": "suggestion text",
      "priority": "critical|high|medium|low",
      "action_required": true,
      "suggested_action": "specific action to take",
      "rationale": "why this suggestion",
      "confidence": 0.85
    }
  ],
  "health_assessment": {
    "overall": "healthy|at_risk|critical",
    "issues": ["issue 1", "issue 2"],
    "positives": ["positive 1"]
  },
  "predictions": {
    "completion_likelihood": 0.75,
    "estimated_delay_hours": 2,
    "risk_factors": ["risk 1", "risk 2"]
  }
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to get copilot guidance:', error);
      return {
        suggestions: [],
        health_assessment: { overall: 'healthy', issues: [], positives: [] },
        predictions: { completion_likelihood: 0.7, risk_factors: [] },
      };
    }
  }

  /**
   * Capture learning from execution outcomes
   * Story 4.12
   */
  async captureLearning(input: {
    plan: { title: string; steps: Partial<ExecutionStep>[] };
    outcome: { type: string; summary: string; success_factors: string[]; failure_factors: string[] };
  }): Promise<Partial<Lesson>[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are ORACLE's learning capture system.
Extract lessons from the execution outcome for future use.

Plan: ${JSON.stringify(input.plan)}
Outcome: ${JSON.stringify(input.outcome)}

Return JSON array of lessons:
[
  {
    "learning_type": "pattern|anti_pattern|insight|best_practice|pitfall|heuristic",
    "title": "lesson title",
    "description": "detailed description",
    "pattern": {
      "trigger": "when this pattern applies",
      "context": "situational context",
      "action": "what to do",
      "result": "expected outcome"
    },
    "context_tags": ["tag1", "tag2"],
    "applicability": {
      "domains": ["planning", "execution"],
      "scenarios": ["time pressure", "resource constraints"],
      "constraints": ["when not to apply"]
    },
    "confidence": 0.8
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to capture learning:', error);
      return [];
    }
  }

  // ============================================================================
  // ORACLE FALLBACK METHODS
  // ============================================================================

  private getFallbackSignals(): Partial<Signal>[] {
    return [{
      signal_type: 'opportunity',
      title: 'Review pending items',
      description: 'Consider reviewing your pending tasks and calendar',
      urgency: 'low',
      impact: 'low',
      confidence: 0.3,
    }];
  }

  private getFallbackContext(): Partial<StrategicContext> {
    return {
      situation_summary: 'Unable to fully analyze context',
      key_factors: [],
      recommendations: [],
      constraints: [],
      assumptions: [],
      confidence: 0.3,
    };
  }

  private getFallbackHorizons(): Record<HorizonType, Partial<StrategicHorizon>> {
    const base = {
      goals: [],
      actions: [],
      dependencies: [],
      risks: [],
      opportunities: [],
      confidence: 0.3,
    };
    return {
      immediate: { horizon_type: 'immediate', ...base },
      today: { horizon_type: 'today', ...base },
      week: { horizon_type: 'week', ...base },
      month: { horizon_type: 'month', ...base },
    };
  }

  private getFallbackOptions(): Partial<DecisionOption>[] {
    return [{
      title: 'Option A',
      description: 'Default option',
      pros: [],
      cons: [],
      confidence: 0.3,
      is_recommended: true,
    }];
  }

  async generateBriefing(input: {
    calendar: any[];
    tasks: any[];
    recentIntel: any[];
    priorities: string[];
  }) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `You are MISSION CONTROL's tactical intelligence assistant.
Generate a concise briefing based on:
Calendar: ${JSON.stringify(input.calendar)}
Tasks: ${JSON.stringify(input.tasks)}
Recent Intel: ${JSON.stringify(input.recentIntel)}

Focus on: ${input.priorities.join(', ')}

Return JSON format:
{
  "summary": "1-2 sentence overview",
  "confidence": 0.85,
  "needs_user_confirmation": false,
  "priorities": [
    {"title": "priority title", "urgency": "high|medium|low", "confidence": 0.9}
  ],
  "time_windows": [
    {"start": "2:00 PM", "end": "4:00 PM", "purpose": "why free"}
  ],
  "recommended_actions": [
    {"description": "action", "effort": "low|medium|high", "confidence": 0.8}
  ],
  "delegation_opportunities": [
    {"task": "what to delegate", "to_who": "suggestion", "confidence": 0.7}
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return this.getFallbackBriefing();
    }
  }

  async extractIntel(imageBase64: string, extractionTypes: string[]) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
    
    const prompt = `Extract intelligence from this image. Focus on: ${extractionTypes.join(', ')}

Return JSON:
{
  "overlays": [
    {"x": 100, "y": 50, "width": 200, "height": 30, "text": "extracted text", "confidence": 0.9, "type": "field|risk|entity"}
  ],
  "structured": {
    "fields": {},
    "entities": [],
    "risks": []
  },
  "actions": [
    {"type": "task|reminder|event", "confidence": 0.8, "description": "what to do"}
  ],
  "confidence": 0.85
}`;

    const imagePart = {
      inlineData: {
        data: imageBase64.split(',')[1], // Remove data:image/jpeg;base64, prefix
        mimeType: 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to parse intel extraction:', error);
      return this.getFallbackExtraction();
    }
  }

  async analyzeTranscript(transcript: string) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `Analyze this meeting transcript for actionable intelligence:

${transcript}

Return JSON:
{
  "summary": "meeting overview",
  "decisions": [
    {"description": "decision made", "owner": "person responsible", "deadline": "date", "confidence": 0.8}
  ],
  "risks": [
    {"description": "risk identified", "mitigation": "how to address", "confidence": 0.7}
  ],
  "follow_ups": [
    {"type": "email|task|reminder", "recipient": "who to send to", "content": "message content", "confidence": 0.9}
  ],
  "confidence": 0.8
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error) {
      console.error('Failed to parse transcript analysis:', error);
      return this.getFallbackDebrief();
    }
  }

  // FREE TIER FALLBACKS - These work even if we hit rate limits
  private getFallbackBriefing() {
    return {
      summary: "Calendar and tasks review completed",
      confidence: 0.5,
      needs_user_confirmation: true,
      priorities: [
        { title: "Review pending tasks", urgency: "medium", confidence: 0.6 }
      ],
      time_windows: [],
      recommended_actions: [],
      delegation_opportunities: []
    };
  }

  private getFallbackExtraction() {
    return {
      overlays: [],
      structured: { fields: {}, entities: [], risks: [] },
      actions: [],
      confidence: 0.3
    };
  }

  private getFallbackDebrief() {
    return {
      summary: "Transcript processed",
      decisions: [],
      risks: [],
      follow_ups: [],
      confidence: 0.3
    };
  }
}

// Singleton instance for free tier usage
export const geminiService = new GeminiService();