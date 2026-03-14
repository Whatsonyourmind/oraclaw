/**
 * ORACLE Root Cause Analysis Service
 * Story smart-2 - Root Cause Analysis System
 *
 * Implements:
 * - Causal graph construction from historical data
 * - Bayesian network inference
 * - Contributing factor ranking
 * - Fix suggestion generation
 * - Verification workflow
 *
 * Time Complexity:
 * - Causal graph construction: O(n * e) where n=nodes, e=edges
 * - Bayesian inference: O(n^2) for variable elimination
 * - Factor ranking: O(f * log(f)) where f=factors
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';
import type { DetectedProblem, ProblemType } from './problemDetection';

// ============================================================================
// Types
// ============================================================================

export interface CausalNode {
  id: string;
  name: string;
  type: 'cause' | 'symptom' | 'effect' | 'factor';
  category: string;
  probability: number;
  observed?: boolean;
  observedValue?: any;
  conditionalProbabilities?: Record<string, number>;
  metadata: Record<string, any>;
}

export interface CausalEdge {
  from: string;
  to: string;
  strength: number; // 0-1, how strongly cause affects effect
  delay?: number; // Time delay in hours
  mechanism: string;
}

export interface CausalGraph {
  id: string;
  problemId: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ContributingFactor {
  id: string;
  name: string;
  category: string;
  contribution: number; // 0-1, how much this factor contributes
  confidence: number;
  evidence: string[];
  isPrimary: boolean;
  causalPath: string[];
}

export interface FixSuggestion {
  id: string;
  title: string;
  description: string;
  targetFactor: string;
  expectedImpact: number; // 0-1
  effort: 'low' | 'medium' | 'high';
  timeToImplement: string;
  priority: number;
  steps: string[];
  verificationCriteria: string[];
  risks: string[];
}

export interface RootCauseAnalysis {
  id: string;
  problemId: string;
  problem: DetectedProblem;
  rootCauses: ContributingFactor[];
  contributingFactors: ContributingFactor[];
  causalGraph: CausalGraph;
  fixSuggestions: FixSuggestion[];
  confidence: number;
  analysisMethod: string;
  timestamp: Date;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string;
}

export interface HistoricalEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  entityId: string;
  entityType: string;
  attributes: Record<string, any>;
  relatedEvents?: string[];
}

export interface BayesianNode {
  id: string;
  name: string;
  states: string[];
  parents: string[];
  cpt: number[][]; // Conditional Probability Table
}

export interface VerificationResult {
  analysisId: string;
  verified: boolean;
  feedback: string;
  actualRootCause?: string;
  correctFactors: string[];
  incorrectFactors: string[];
  timestamp: Date;
}

// Cache TTLs
const CACHE_TTL = {
  analysis: 30 * 60 * 1000, // 30 minutes
  graph: 60 * 60 * 1000, // 1 hour
  suggestions: 15 * 60 * 1000, // 15 minutes
};

// ============================================================================
// Bayesian Network Implementation
// ============================================================================

/**
 * Simple Bayesian Network for causal inference
 */
class BayesianNetwork {
  private nodes: Map<string, BayesianNode> = new Map();
  private topology: string[] = []; // Topologically sorted node IDs

  /**
   * Add a node to the network
   */
  addNode(node: BayesianNode): void {
    this.nodes.set(node.id, node);
    this.updateTopology();
  }

  /**
   * Update topological sort of nodes
   * O(n + e) using Kahn's algorithm
   */
  private updateTopology(): void {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    this.nodes.forEach((node, id) => {
      inDegree.set(id, node.parents.length);
      adjacency.set(id, []);
    });

    // Build adjacency list
    this.nodes.forEach((node) => {
      node.parents.forEach((parentId) => {
        const adj = adjacency.get(parentId);
        if (adj) adj.push(node.id);
      });
    });

    // Kahn's algorithm
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    this.topology = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      this.topology.push(node);

      const neighbors = adjacency.get(node) || [];
      neighbors.forEach((neighbor) => {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) queue.push(neighbor);
      });
    }
  }

  /**
   * Calculate probability of a node given evidence
   * Uses variable elimination algorithm
   * O(n^2) worst case
   */
  queryProbability(
    queryNodeId: string,
    queryState: number,
    evidence: Map<string, number>
  ): number {
    const node = this.nodes.get(queryNodeId);
    if (!node) return 0;

    // If we have evidence for this node, return 1 or 0
    if (evidence.has(queryNodeId)) {
      return evidence.get(queryNodeId) === queryState ? 1 : 0;
    }

    // Simple case: no parents
    if (node.parents.length === 0) {
      return node.cpt[0][queryState];
    }

    // Calculate probability using marginalization
    return this.marginalizeParents(node, queryState, evidence);
  }

  /**
   * Marginalize over parent configurations
   */
  private marginalizeParents(
    node: BayesianNode,
    queryState: number,
    evidence: Map<string, number>
  ): number {
    const parentStates = node.parents.map((parentId) => {
      const parent = this.nodes.get(parentId);
      return parent ? parent.states.length : 2;
    });

    let totalProb = 0;
    const numConfigs = parentStates.reduce((a, b) => a * b, 1);

    for (let config = 0; config < numConfigs; config++) {
      // Get parent configuration
      const parentConfig = this.indexToConfig(config, parentStates);

      // Check if this configuration is consistent with evidence
      let consistent = true;
      let configProb = 1;

      for (let i = 0; i < node.parents.length; i++) {
        const parentId = node.parents[i];
        if (evidence.has(parentId)) {
          if (evidence.get(parentId) !== parentConfig[i]) {
            consistent = false;
            break;
          }
        } else {
          // Multiply by parent probability
          const parentProb = this.queryProbability(parentId, parentConfig[i], evidence);
          configProb *= parentProb;
        }
      }

      if (consistent) {
        // Get CPT row for this parent configuration
        const cptRow = node.cpt[config] || node.cpt[0];
        totalProb += cptRow[queryState] * configProb;
      }
    }

    return totalProb;
  }

  /**
   * Convert flat index to multi-dimensional configuration
   */
  private indexToConfig(index: number, dimensions: number[]): number[] {
    const config: number[] = [];
    let remaining = index;

    for (let i = dimensions.length - 1; i >= 0; i--) {
      config.unshift(remaining % dimensions[i]);
      remaining = Math.floor(remaining / dimensions[i]);
    }

    return config;
  }

  /**
   * Find most likely explanation (diagnosis)
   * Returns the most probable configuration of causes given symptoms
   */
  findMostLikelyExplanation(
    symptoms: Map<string, number>,
    causeNodeIds: string[]
  ): Map<string, number> {
    let bestConfig = new Map<string, number>();
    let bestProb = 0;

    const causeStates = causeNodeIds.map((id) => {
      const node = this.nodes.get(id);
      return node ? node.states.length : 2;
    });

    const numConfigs = causeStates.reduce((a, b) => a * b, 1);

    for (let config = 0; config < numConfigs; config++) {
      const causeConfig = this.indexToConfig(config, causeStates);
      const evidence = new Map(symptoms);

      // Set cause configuration as evidence
      causeNodeIds.forEach((id, i) => {
        evidence.set(id, causeConfig[i]);
      });

      // Calculate probability of this configuration
      let configProb = 1;
      causeNodeIds.forEach((id, i) => {
        const node = this.nodes.get(id);
        if (node) {
          configProb *= node.cpt[0][causeConfig[i]];
        }
      });

      // Calculate likelihood of symptoms given causes
      symptoms.forEach((state, nodeId) => {
        const prob = this.queryProbability(nodeId, state, evidence);
        configProb *= prob;
      });

      if (configProb > bestProb) {
        bestProb = configProb;
        bestConfig = new Map();
        causeNodeIds.forEach((id, i) => {
          bestConfig.set(id, causeConfig[i]);
        });
      }
    }

    return bestConfig;
  }
}

// ============================================================================
// Root Cause Analysis Service
// ============================================================================

export class RootCauseAnalysisService {
  private analyses: Map<string, RootCauseAnalysis> = new Map();
  private historicalEvents: HistoricalEvent[] = [];
  private verifications: VerificationResult[] = [];

  // Common cause categories
  private causeCategories = [
    'process',
    'people',
    'technology',
    'communication',
    'resources',
    'planning',
    'external',
    'skills',
  ];

  // Causal knowledge base
  private causalKnowledge: Record<ProblemType, Array<{
    cause: string;
    category: string;
    baseProbability: number;
    mechanism: string;
  }>> = {
    schedule_overrun: [
      { cause: 'Poor estimation', category: 'planning', baseProbability: 0.7, mechanism: 'Underestimated complexity leads to delays' },
      { cause: 'Scope creep', category: 'process', baseProbability: 0.6, mechanism: 'Uncontrolled changes extend timeline' },
      { cause: 'Resource unavailability', category: 'resources', baseProbability: 0.5, mechanism: 'Missing resources slow progress' },
      { cause: 'Technical debt', category: 'technology', baseProbability: 0.4, mechanism: 'Legacy issues cause unexpected work' },
      { cause: 'Dependencies blocked', category: 'external', baseProbability: 0.5, mechanism: 'External blockers halt progress' },
    ],
    resource_conflict: [
      { cause: 'Over-allocation', category: 'planning', baseProbability: 0.7, mechanism: 'Same resource assigned to multiple tasks' },
      { cause: 'Poor visibility', category: 'communication', baseProbability: 0.5, mechanism: 'Lack of resource calendar visibility' },
      { cause: 'Skill mismatch', category: 'skills', baseProbability: 0.4, mechanism: 'Limited people with required skills' },
      { cause: 'Competing priorities', category: 'process', baseProbability: 0.6, mechanism: 'Multiple projects need same resources' },
    ],
    communication_gap: [
      { cause: 'Missing channels', category: 'communication', baseProbability: 0.5, mechanism: 'No established communication paths' },
      { cause: 'Time zone differences', category: 'people', baseProbability: 0.4, mechanism: 'Teams in different time zones miss overlap' },
      { cause: 'Tool fragmentation', category: 'technology', baseProbability: 0.5, mechanism: 'Multiple tools split conversations' },
      { cause: 'No regular syncs', category: 'process', baseProbability: 0.6, mechanism: 'Missing regular team meetings' },
    ],
    workload_imbalance: [
      { cause: 'Uneven distribution', category: 'planning', baseProbability: 0.7, mechanism: 'Tasks not distributed by capacity' },
      { cause: 'Skill concentration', category: 'skills', baseProbability: 0.5, mechanism: 'Specific skills held by few people' },
      { cause: 'No workload visibility', category: 'process', baseProbability: 0.5, mechanism: 'Managers cannot see individual loads' },
      { cause: 'Hero culture', category: 'people', baseProbability: 0.4, mechanism: 'Some team members take on too much' },
    ],
    deadline_risk: [
      { cause: 'Aggressive timeline', category: 'planning', baseProbability: 0.6, mechanism: 'Unrealistic deadlines set' },
      { cause: 'Missing dependencies', category: 'external', baseProbability: 0.5, mechanism: 'External dependencies not tracked' },
      { cause: 'Velocity decline', category: 'process', baseProbability: 0.5, mechanism: 'Team velocity dropping' },
      { cause: 'Scope increase', category: 'process', baseProbability: 0.6, mechanism: 'Scope expanded without timeline adjustment' },
    ],
    budget_anomaly: [
      { cause: 'Cost overruns', category: 'resources', baseProbability: 0.6, mechanism: 'Actual costs exceeding estimates' },
      { cause: 'Scope changes', category: 'process', baseProbability: 0.5, mechanism: 'Additional work not budgeted' },
      { cause: 'Resource rate changes', category: 'external', baseProbability: 0.4, mechanism: 'Resource costs increased' },
      { cause: 'Poor tracking', category: 'process', baseProbability: 0.5, mechanism: 'Expenses not properly tracked' },
    ],
    quality_degradation: [
      { cause: 'Rushed delivery', category: 'process', baseProbability: 0.7, mechanism: 'Speed prioritized over quality' },
      { cause: 'Missing testing', category: 'process', baseProbability: 0.6, mechanism: 'Insufficient test coverage' },
      { cause: 'Technical debt', category: 'technology', baseProbability: 0.5, mechanism: 'Accumulated shortcuts causing issues' },
      { cause: 'Skill gaps', category: 'skills', baseProbability: 0.4, mechanism: 'Team lacking necessary expertise' },
    ],
    dependency_block: [
      { cause: 'External delays', category: 'external', baseProbability: 0.7, mechanism: 'Third parties not delivering' },
      { cause: 'Unclear ownership', category: 'process', baseProbability: 0.5, mechanism: 'No clear owner for dependency' },
      { cause: 'Poor planning', category: 'planning', baseProbability: 0.5, mechanism: 'Dependencies not identified early' },
      { cause: 'Communication failure', category: 'communication', baseProbability: 0.4, mechanism: 'Status not communicated' },
    ],
  };

  // ============================================================================
  // Main Analysis API
  // ============================================================================

  /**
   * Perform root cause analysis on a detected problem
   */
  async analyzeRootCause(
    problem: DetectedProblem,
    options: {
      includeHistory?: boolean;
      maxFactors?: number;
      generateFixes?: boolean;
    } = {}
  ): Promise<RootCauseAnalysis> {
    const cacheKeyStr = cacheKey('rca', problem.id, hashObject(options));
    const cached = oracleCacheService.get<RootCauseAnalysis>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    // Build causal graph
    const causalGraph = await this.buildCausalGraph(problem);

    // Run Bayesian inference to find root causes
    const { rootCauses, contributingFactors } = await this.inferCauses(
      problem,
      causalGraph,
      options.maxFactors || 5
    );

    // Generate fix suggestions
    const fixSuggestions = options.generateFixes !== false
      ? this.generateFixSuggestions(rootCauses, contributingFactors)
      : [];

    // Calculate overall confidence
    const confidence = this.calculateAnalysisConfidence(
      rootCauses,
      contributingFactors
    );

    const analysis: RootCauseAnalysis = {
      id: `rca-${problem.id}-${Date.now()}`,
      problemId: problem.id,
      problem,
      rootCauses,
      contributingFactors,
      causalGraph,
      fixSuggestions,
      confidence,
      analysisMethod: 'bayesian_network',
      timestamp: new Date(),
      verificationStatus: 'pending',
    };

    this.analyses.set(analysis.id, analysis);
    oracleCacheService.set(cacheKeyStr, analysis, CACHE_TTL.analysis);

    return analysis;
  }

  // ============================================================================
  // Causal Graph Construction
  // ============================================================================

  /**
   * Build a causal graph for a problem
   * O(n * e) where n=nodes, e=edges
   */
  async buildCausalGraph(problem: DetectedProblem): Promise<CausalGraph> {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // Add problem as effect node
    const problemNode: CausalNode = {
      id: `problem-${problem.id}`,
      name: problem.description,
      type: 'effect',
      category: problem.type,
      probability: problem.confidence,
      observed: true,
      metadata: { problemType: problem.type },
    };
    nodes.push(problemNode);

    // Add known causes based on problem type
    const knownCauses = this.causalKnowledge[problem.type] || [];

    knownCauses.forEach((cause, index) => {
      const causeNode: CausalNode = {
        id: `cause-${index}`,
        name: cause.cause,
        type: 'cause',
        category: cause.category,
        probability: cause.baseProbability,
        metadata: { mechanism: cause.mechanism },
      };
      nodes.push(causeNode);

      // Connect cause to problem
      edges.push({
        from: causeNode.id,
        to: problemNode.id,
        strength: cause.baseProbability,
        mechanism: cause.mechanism,
      });
    });

    // Add symptom nodes from affected entities
    problem.affectedEntities.forEach((entity, index) => {
      const symptomNode: CausalNode = {
        id: `symptom-${index}`,
        name: entity,
        type: 'symptom',
        category: 'entity',
        probability: 0.8,
        observed: true,
        metadata: {},
      };
      nodes.push(symptomNode);

      // Connect problem to symptom
      edges.push({
        from: problemNode.id,
        to: symptomNode.id,
        strength: 0.8,
        mechanism: 'Problem manifests in entity',
      });
    });

    // Add contributing factor nodes based on metadata
    if (problem.metadata) {
      Object.entries(problem.metadata).forEach(([key, value], index) => {
        if (typeof value === 'number' && value > 0.5) {
          const factorNode: CausalNode = {
            id: `factor-${index}`,
            name: key,
            type: 'factor',
            category: 'metric',
            probability: value as number,
            metadata: {},
          };
          nodes.push(factorNode);

          // Connect factor to relevant causes
          const relevantCauses = nodes.filter(
            (n) => n.type === 'cause' && this.isFactorRelevant(key, n.name)
          );
          relevantCauses.forEach((causeNode) => {
            edges.push({
              from: factorNode.id,
              to: causeNode.id,
              strength: 0.5,
              mechanism: 'Factor contributes to cause',
            });
          });
        }
      });
    }

    return {
      id: `graph-${problem.id}`,
      problemId: problem.id,
      nodes,
      edges,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Check if a factor is relevant to a cause
   */
  private isFactorRelevant(factor: string, cause: string): boolean {
    const relevanceMap: Record<string, string[]> = {
      completionRatio: ['Poor estimation', 'Scope creep', 'Technical debt'],
      utilizationRate: ['Over-allocation', 'Resource unavailability'],
      communicationScore: ['Missing channels', 'No regular syncs', 'Communication failure'],
      workloadVariance: ['Uneven distribution', 'Hero culture'],
      qualityScore: ['Rushed delivery', 'Missing testing', 'Skill gaps'],
    };

    return relevanceMap[factor]?.includes(cause) || false;
  }

  // ============================================================================
  // Bayesian Inference
  // ============================================================================

  /**
   * Infer root causes and contributing factors using Bayesian network
   */
  async inferCauses(
    problem: DetectedProblem,
    graph: CausalGraph,
    maxFactors: number
  ): Promise<{
    rootCauses: ContributingFactor[];
    contributingFactors: ContributingFactor[];
  }> {
    // Build Bayesian network from causal graph
    const network = new BayesianNetwork();

    // Add nodes to network
    graph.nodes.forEach((node) => {
      const parentEdges = graph.edges.filter((e) => e.to === node.id);
      const parentIds = parentEdges.map((e) => e.from);

      // Generate CPT based on parent edges
      const cpt = this.generateCPT(node, parentEdges);

      network.addNode({
        id: node.id,
        name: node.name,
        states: ['absent', 'present'],
        parents: parentIds,
        cpt,
      });
    });

    // Set evidence from observed nodes
    const evidence = new Map<string, number>();
    graph.nodes
      .filter((n) => n.observed)
      .forEach((n) => {
        evidence.set(n.id, 1); // present
      });

    // Find cause nodes
    const causeNodeIds = graph.nodes
      .filter((n) => n.type === 'cause')
      .map((n) => n.id);

    // Find most likely explanation
    const likelyConfig = network.findMostLikelyExplanation(evidence, causeNodeIds);

    // Calculate posterior probabilities for all causes
    const posteriors: Array<{ nodeId: string; probability: number }> = [];
    causeNodeIds.forEach((nodeId) => {
      const prob = network.queryProbability(nodeId, 1, evidence);
      posteriors.push({ nodeId, probability: prob });
    });

    // Sort by probability
    posteriors.sort((a, b) => b.probability - a.probability);

    // Extract root causes (top factors above threshold)
    const rootCauses: ContributingFactor[] = [];
    const contributingFactors: ContributingFactor[] = [];

    posteriors.forEach((p, index) => {
      const node = graph.nodes.find((n) => n.id === p.nodeId);
      if (!node) return;

      const factor: ContributingFactor = {
        id: p.nodeId,
        name: node.name,
        category: node.category,
        contribution: p.probability,
        confidence: Math.min(1, p.probability + 0.1),
        evidence: this.gatherEvidence(node, graph),
        isPrimary: index < 2 && p.probability > 0.5,
        causalPath: this.traceCausalPath(p.nodeId, graph),
      };

      if (index < 2 && p.probability > 0.4) {
        rootCauses.push(factor);
      } else if (p.probability > 0.3 && contributingFactors.length < maxFactors) {
        contributingFactors.push(factor);
      }
    });

    return { rootCauses, contributingFactors };
  }

  /**
   * Generate Conditional Probability Table for a node
   */
  private generateCPT(node: CausalNode, parentEdges: CausalEdge[]): number[][] {
    if (parentEdges.length === 0) {
      // Root node - use base probability
      return [[1 - node.probability, node.probability]];
    }

    // Generate CPT based on parent combinations
    const numConfigs = Math.pow(2, parentEdges.length);
    const cpt: number[][] = [];

    for (let config = 0; config < numConfigs; config++) {
      // Calculate probability based on which parents are present
      let combinedStrength = 0;

      for (let i = 0; i < parentEdges.length; i++) {
        const parentPresent = (config >> i) & 1;
        if (parentPresent) {
          combinedStrength += parentEdges[i].strength;
        }
      }

      // Normalize and apply diminishing returns
      const probability = Math.min(0.95, combinedStrength / parentEdges.length);
      cpt.push([1 - probability, probability]);
    }

    return cpt;
  }

  /**
   * Gather evidence supporting a cause
   */
  private gatherEvidence(node: CausalNode, graph: CausalGraph): string[] {
    const evidence: string[] = [];

    // Find connected symptom nodes
    const connectedEdges = graph.edges.filter(
      (e) => e.from === node.id || e.to === node.id
    );

    connectedEdges.forEach((edge) => {
      const otherNodeId = edge.from === node.id ? edge.to : edge.from;
      const otherNode = graph.nodes.find((n) => n.id === otherNodeId);

      if (otherNode && otherNode.observed) {
        evidence.push(`${otherNode.name} observed (${edge.mechanism})`);
      }
    });

    if (node.metadata.mechanism) {
      evidence.push(node.metadata.mechanism);
    }

    return evidence;
  }

  /**
   * Trace causal path from cause to effect
   */
  private traceCausalPath(nodeId: string, graph: CausalGraph): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string): boolean => {
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const node = graph.nodes.find((n) => n.id === currentId);
      if (!node) return false;

      path.push(node.name);

      if (node.type === 'effect') return true;

      const outEdges = graph.edges.filter((e) => e.from === currentId);
      for (const edge of outEdges) {
        if (dfs(edge.to)) return true;
      }

      path.pop();
      return false;
    };

    dfs(nodeId);
    return path;
  }

  // ============================================================================
  // Fix Suggestion Generation
  // ============================================================================

  /**
   * Generate fix suggestions for identified causes
   */
  generateFixSuggestions(
    rootCauses: ContributingFactor[],
    contributingFactors: ContributingFactor[]
  ): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Generate suggestions for root causes
    rootCauses.forEach((cause, index) => {
      const suggestion = this.createFixSuggestion(cause, index + 1);
      suggestions.push(suggestion);
    });

    // Generate suggestions for top contributing factors
    contributingFactors.slice(0, 2).forEach((factor, index) => {
      const suggestion = this.createFixSuggestion(factor, rootCauses.length + index + 1);
      suggestions.push(suggestion);
    });

    // Sort by priority
    suggestions.sort((a, b) => a.priority - b.priority);

    return suggestions;
  }

  /**
   * Create a fix suggestion for a cause
   */
  private createFixSuggestion(cause: ContributingFactor, priority: number): FixSuggestion {
    const fixTemplates: Record<string, Partial<FixSuggestion>> = {
      'Poor estimation': {
        title: 'Improve Task Estimation',
        description: 'Implement structured estimation techniques to improve accuracy',
        effort: 'medium',
        timeToImplement: '2-3 sprints',
        steps: [
          'Review historical estimation data',
          'Identify patterns in under/over-estimation',
          'Implement planning poker or similar technique',
          'Track estimation accuracy over time',
          'Adjust estimates based on complexity factors',
        ],
        verificationCriteria: [
          'Estimation accuracy improved by 20%',
          'Fewer tasks exceeding estimates by >50%',
        ],
        risks: ['Initial adoption resistance', 'May take time to calibrate'],
      },
      'Scope creep': {
        title: 'Implement Scope Management',
        description: 'Establish clear scope boundaries and change control process',
        effort: 'medium',
        timeToImplement: '1-2 sprints',
        steps: [
          'Define clear project scope documentation',
          'Establish change request process',
          'Set up scope review meetings',
          'Implement impact assessment for changes',
          'Communicate scope changes to stakeholders',
        ],
        verificationCriteria: [
          'All scope changes tracked and approved',
          'Reduction in unplanned work by 30%',
        ],
        risks: ['Stakeholder pushback', 'May slow down delivery initially'],
      },
      'Over-allocation': {
        title: 'Balance Resource Allocation',
        description: 'Review and rebalance resource assignments',
        effort: 'low',
        timeToImplement: '1 week',
        steps: [
          'Audit current resource assignments',
          'Identify over-allocated resources',
          'Redistribute tasks among team',
          'Implement capacity planning',
          'Set up allocation alerts',
        ],
        verificationCriteria: [
          'No resource over 100% allocated',
          'Resource conflicts resolved',
        ],
        risks: ['May delay some tasks', 'Skill constraints'],
      },
      'Missing channels': {
        title: 'Establish Communication Framework',
        description: 'Set up proper communication channels and protocols',
        effort: 'low',
        timeToImplement: '1-2 weeks',
        steps: [
          'Identify communication gaps',
          'Select appropriate tools/channels',
          'Document communication protocols',
          'Train team on new processes',
          'Schedule regular sync meetings',
        ],
        verificationCriteria: [
          'Communication satisfaction improved',
          'Regular sync meetings established',
        ],
        risks: ['Tool fatigue', 'Meeting overhead'],
      },
      'Uneven distribution': {
        title: 'Rebalance Workload',
        description: 'Redistribute work to ensure fair allocation',
        effort: 'medium',
        timeToImplement: '1-2 weeks',
        steps: [
          'Analyze current workload distribution',
          'Identify overloaded team members',
          'Match tasks to skills and capacity',
          'Implement workload limits',
          'Monitor distribution regularly',
        ],
        verificationCriteria: [
          'Workload variance reduced by 50%',
          'No team member consistently overloaded',
        ],
        risks: ['Skill gaps may limit redistribution', 'Transition period'],
      },
    };

    const template = fixTemplates[cause.name] || {
      title: `Address ${cause.name}`,
      description: `Take action to mitigate ${cause.name}`,
      effort: 'medium',
      timeToImplement: '2-4 weeks',
      steps: [
        `Investigate ${cause.name} in detail`,
        'Identify specific contributing factors',
        'Develop targeted action plan',
        'Implement and monitor changes',
      ],
      verificationCriteria: [`${cause.name} impact reduced`],
      risks: ['Unknown factors may exist'],
    };

    return {
      id: `fix-${cause.id}-${Date.now()}`,
      targetFactor: cause.id,
      expectedImpact: cause.contribution,
      priority,
      ...template,
    } as FixSuggestion;
  }

  // ============================================================================
  // Verification Workflow
  // ============================================================================

  /**
   * Submit verification for an analysis
   */
  async verifyAnalysis(
    analysisId: string,
    verification: {
      verified: boolean;
      feedback: string;
      actualRootCause?: string;
      correctFactors?: string[];
      incorrectFactors?: string[];
    }
  ): Promise<VerificationResult> {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    const result: VerificationResult = {
      analysisId,
      verified: verification.verified,
      feedback: verification.feedback,
      actualRootCause: verification.actualRootCause,
      correctFactors: verification.correctFactors || [],
      incorrectFactors: verification.incorrectFactors || [],
      timestamp: new Date(),
    };

    // Update analysis status
    analysis.verificationStatus = verification.verified ? 'verified' : 'rejected';
    analysis.verificationNotes = verification.feedback;

    // Store verification for learning
    this.verifications.push(result);

    // Learn from verification
    if (verification.verified) {
      await this.learnFromVerification(analysis, result);
    }

    // Invalidate cache
    oracleCacheService.deleteByPrefix(`rca:${analysis.problemId}`);

    return result;
  }

  /**
   * Learn from verification to improve future analyses
   */
  private async learnFromVerification(
    analysis: RootCauseAnalysis,
    verification: VerificationResult
  ): Promise<void> {
    // Adjust probabilities in causal knowledge base
    const problemType = analysis.problem.type;
    const knownCauses = this.causalKnowledge[problemType];

    if (!knownCauses) return;

    // Boost probability of correct factors
    verification.correctFactors.forEach((factorId) => {
      const factor = analysis.rootCauses.find((f) => f.id === factorId) ||
        analysis.contributingFactors.find((f) => f.id === factorId);

      if (factor) {
        const cause = knownCauses.find((c) => c.cause === factor.name);
        if (cause) {
          cause.baseProbability = Math.min(0.95, cause.baseProbability * 1.1);
        }
      }
    });

    // Reduce probability of incorrect factors
    verification.incorrectFactors.forEach((factorId) => {
      const factor = analysis.rootCauses.find((f) => f.id === factorId) ||
        analysis.contributingFactors.find((f) => f.id === factorId);

      if (factor) {
        const cause = knownCauses.find((c) => c.cause === factor.name);
        if (cause) {
          cause.baseProbability = Math.max(0.1, cause.baseProbability * 0.9);
        }
      }
    });

    // Add actual root cause if it's new
    if (verification.actualRootCause) {
      const exists = knownCauses.some((c) => c.cause === verification.actualRootCause);
      if (!exists) {
        knownCauses.push({
          cause: verification.actualRootCause,
          category: 'learned',
          baseProbability: 0.6,
          mechanism: 'Learned from verification',
        });
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate overall confidence in the analysis
   */
  private calculateAnalysisConfidence(
    rootCauses: ContributingFactor[],
    contributingFactors: ContributingFactor[]
  ): number {
    if (rootCauses.length === 0) return 0.3;

    const avgRootCauseConfidence =
      rootCauses.reduce((sum, c) => sum + c.confidence, 0) / rootCauses.length;

    const avgFactorConfidence = contributingFactors.length > 0
      ? contributingFactors.reduce((sum, c) => sum + c.confidence, 0) /
        contributingFactors.length
      : 0.5;

    // Weight root cause confidence more heavily
    return avgRootCauseConfidence * 0.7 + avgFactorConfidence * 0.3;
  }

  /**
   * Get an analysis by ID
   */
  getAnalysis(id: string): RootCauseAnalysis | undefined {
    return this.analyses.get(id);
  }

  /**
   * Get all analyses for a problem
   */
  getAnalysesForProblem(problemId: string): RootCauseAnalysis[] {
    return Array.from(this.analyses.values()).filter(
      (a) => a.problemId === problemId
    );
  }

  /**
   * Record historical event for future analysis
   */
  recordEvent(event: HistoricalEvent): void {
    this.historicalEvents.push(event);

    // Keep only last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.historicalEvents = this.historicalEvents.filter(
      (e) => e.timestamp.getTime() > cutoff
    );
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(): {
    total: number;
    verified: number;
    rejected: number;
    accuracy: number;
  } {
    const total = this.verifications.length;
    const verified = this.verifications.filter((v) => v.verified).length;
    const rejected = total - verified;
    const accuracy = total > 0 ? verified / total : 0;

    return { total, verified, rejected, accuracy };
  }
}

// Singleton instance
export const rootCauseAnalysisService = new RootCauseAnalysisService();
