/**
 * Signal Graph Service
 * Signal relationship mapping and dependency analysis
 */

import type {
  Signal,
  SignalCluster,
  Correlation,
  CorrelationType,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface SignalNode {
  id: string;
  signal: Signal;
  depth: number;
  isRoot: boolean;
  isDerived: boolean;
  parentIds: string[];
  childIds: string[];
  clusterId?: string;
  position?: { x: number; y: number };
  weight: number;
}

export interface SignalEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: CorrelationType;
  strength: number;
  direction: 'forward' | 'backward' | 'bidirectional';
  metadata: Record<string, any>;
}

export interface CausalChain {
  id: string;
  name: string;
  rootSignalId: string;
  signalIds: string[];
  edges: SignalEdge[];
  totalStrength: number;
  length: number;
  confidence: number;
}

export interface SignalClusterResult {
  id: string;
  label: string;
  signals: Signal[];
  centroid: Signal;
  cohesion: number;
  separationFromOthers: number;
  dominantType: string;
  dominantUrgency: UrgencyLevel;
  dominantImpact: ImpactLevel;
}

export interface TimelineCorrelation {
  signalId: string;
  correlatedSignalId: string;
  timeDeltaMs: number;
  direction: 'before' | 'after' | 'concurrent';
  frequencyCount: number;
  confidence: number;
}

export interface SignalGraphResult {
  nodes: SignalNode[];
  edges: SignalEdge[];
  clusters: SignalClusterResult[];
  causalChains: CausalChain[];
  rootSignals: Signal[];
  derivedSignals: Signal[];
  orphanSignals: Signal[];
  statistics: {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    maxDepth: number;
    clusterCount: number;
    density: number;
  };
}

// ============================================================================
// SIGNAL GRAPH SERVICE
// ============================================================================

export class SignalGraphService {
  private correlations: Correlation[] = [];
  private signalCache: Map<string, Signal> = new Map();

  /**
   * Build a complete signal dependency graph
   */
  async buildGraph(
    signals: Signal[],
    correlations: Correlation[]
  ): Promise<SignalGraphResult> {
    this.correlations = correlations;
    signals.forEach((s) => this.signalCache.set(s.id, s));

    // Build nodes
    const nodes = this.buildNodes(signals, correlations);

    // Build edges
    const edges = this.buildEdges(correlations);

    // Identify root and derived signals
    const rootSignals = this.findRootSignals(nodes);
    const derivedSignals = this.findDerivedSignals(nodes);
    const orphanSignals = this.findOrphanSignals(nodes);

    // Cluster related signals
    const clusters = this.clusterSignals(signals, correlations);

    // Find causal chains
    const causalChains = this.findCausalChains(nodes, edges);

    // Calculate statistics
    const statistics = this.calculateStatistics(nodes, edges, clusters);

    return {
      nodes,
      edges,
      clusters,
      causalChains,
      rootSignals,
      derivedSignals,
      orphanSignals,
      statistics,
    };
  }

  /**
   * Build graph nodes from signals
   */
  private buildNodes(
    signals: Signal[],
    correlations: Correlation[]
  ): SignalNode[] {
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();

    // Build parent/child relationships from correlations
    correlations.forEach((corr) => {
      if (corr.correlation_type === 'causal' || corr.correlation_type === 'dependency') {
        const sourceId = corr.source_entity_id;
        const targetId = corr.target_entity_id;

        if (!childMap.has(sourceId)) childMap.set(sourceId, []);
        if (!parentMap.has(targetId)) parentMap.set(targetId, []);

        childMap.get(sourceId)!.push(targetId);
        parentMap.get(targetId)!.push(sourceId);
      }
    });

    // Calculate depths using BFS
    const depths = this.calculateDepths(signals, parentMap);

    return signals.map((signal) => {
      const parentIds = parentMap.get(signal.id) || [];
      const childIds = childMap.get(signal.id) || [];
      const depth = depths.get(signal.id) || 0;

      return {
        id: signal.id,
        signal,
        depth,
        isRoot: parentIds.length === 0 && childIds.length > 0,
        isDerived: parentIds.length > 0,
        parentIds,
        childIds,
        weight: this.calculateNodeWeight(signal, childIds.length),
      };
    });
  }

  /**
   * Calculate node depths using BFS
   */
  private calculateDepths(
    signals: Signal[],
    parentMap: Map<string, string[]>
  ): Map<string, number> {
    const depths = new Map<string, number>();
    const signalIds = new Set(signals.map((s) => s.id));

    // Find roots (signals with no parents)
    const roots = signals.filter(
      (s) => !parentMap.has(s.id) || parentMap.get(s.id)!.length === 0
    );

    // BFS from each root
    roots.forEach((root) => {
      const queue: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        const currentDepth = depths.get(id);
        if (currentDepth === undefined || depth > currentDepth) {
          depths.set(id, depth);
        }

        // Find children by looking at correlations where this is the source
        this.correlations.forEach((corr) => {
          if (
            corr.source_entity_id === id &&
            signalIds.has(corr.target_entity_id) &&
            !visited.has(corr.target_entity_id)
          ) {
            queue.push({ id: corr.target_entity_id, depth: depth + 1 });
          }
        });
      }
    });

    // Assign depth 0 to any unvisited signals
    signals.forEach((s) => {
      if (!depths.has(s.id)) {
        depths.set(s.id, 0);
      }
    });

    return depths;
  }

  /**
   * Calculate node weight based on signal properties
   */
  private calculateNodeWeight(signal: Signal, childCount: number): number {
    const urgencyWeight = { critical: 4, high: 3, medium: 2, low: 1 }[signal.urgency] || 1;
    const impactWeight = { critical: 4, high: 3, medium: 2, low: 1 }[signal.impact] || 1;
    const childWeight = Math.log2(childCount + 1) + 1;

    return urgencyWeight * impactWeight * childWeight * signal.confidence;
  }

  /**
   * Build edges from correlations
   */
  private buildEdges(correlations: Correlation[]): SignalEdge[] {
    return correlations.map((corr) => ({
      id: corr.id,
      sourceId: corr.source_entity_id,
      targetId: corr.target_entity_id,
      type: corr.correlation_type,
      strength: corr.strength,
      direction: corr.direction,
      metadata: corr.metadata,
    }));
  }

  /**
   * Find root signals (no parents, have children)
   */
  private findRootSignals(nodes: SignalNode[]): Signal[] {
    return nodes.filter((n) => n.isRoot).map((n) => n.signal);
  }

  /**
   * Find derived signals (have parents)
   */
  private findDerivedSignals(nodes: SignalNode[]): Signal[] {
    return nodes.filter((n) => n.isDerived).map((n) => n.signal);
  }

  /**
   * Find orphan signals (no connections)
   */
  private findOrphanSignals(nodes: SignalNode[]): Signal[] {
    return nodes
      .filter((n) => n.parentIds.length === 0 && n.childIds.length === 0)
      .map((n) => n.signal);
  }

  /**
   * Cluster related signals using hierarchical clustering
   */
  clusterSignals(
    signals: Signal[],
    correlations: Correlation[]
  ): SignalClusterResult[] {
    if (signals.length === 0) return [];

    // Build similarity matrix
    const similarity = this.buildSimilarityMatrix(signals, correlations);

    // Hierarchical clustering
    const clusters = this.hierarchicalClustering(signals, similarity);

    return clusters.map((cluster, idx) => {
      const clusterSignals = cluster.map((id) => this.signalCache.get(id)!).filter(Boolean);
      const centroid = this.findCentroid(clusterSignals, similarity);

      // Calculate cluster properties
      const typeCounts: Record<string, number> = {};
      const urgencyCounts: Record<string, number> = {};
      const impactCounts: Record<string, number> = {};

      clusterSignals.forEach((s) => {
        typeCounts[s.signal_type] = (typeCounts[s.signal_type] || 0) + 1;
        urgencyCounts[s.urgency] = (urgencyCounts[s.urgency] || 0) + 1;
        impactCounts[s.impact] = (impactCounts[s.impact] || 0) + 1;
      });

      const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      const dominantUrgency = Object.entries(urgencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as UrgencyLevel || 'low';
      const dominantImpact = Object.entries(impactCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ImpactLevel || 'low';

      return {
        id: `cluster-${idx}`,
        label: this.generateClusterLabel(clusterSignals, dominantType),
        signals: clusterSignals,
        centroid,
        cohesion: this.calculateCohesion(cluster, similarity),
        separationFromOthers: this.calculateSeparation(cluster, clusters, similarity),
        dominantType,
        dominantUrgency,
        dominantImpact,
      };
    });
  }

  /**
   * Build similarity matrix based on correlations and signal properties
   */
  private buildSimilarityMatrix(
    signals: Signal[],
    correlations: Correlation[]
  ): Map<string, Map<string, number>> {
    const similarity = new Map<string, Map<string, number>>();

    // Initialize matrix
    signals.forEach((s1) => {
      const row = new Map<string, number>();
      signals.forEach((s2) => {
        if (s1.id === s2.id) {
          row.set(s2.id, 1);
        } else {
          row.set(s2.id, 0);
        }
      });
      similarity.set(s1.id, row);
    });

    // Add correlation-based similarity
    correlations.forEach((corr) => {
      const row = similarity.get(corr.source_entity_id);
      if (row) {
        const existing = row.get(corr.target_entity_id) || 0;
        row.set(corr.target_entity_id, Math.max(existing, Math.abs(corr.strength)));
      }
    });

    // Add property-based similarity
    signals.forEach((s1) => {
      signals.forEach((s2) => {
        if (s1.id === s2.id) return;

        let propSimilarity = 0;
        if (s1.signal_type === s2.signal_type) propSimilarity += 0.3;
        if (s1.urgency === s2.urgency) propSimilarity += 0.2;
        if (s1.impact === s2.impact) propSimilarity += 0.2;
        if (s1.source_data?.project_id === s2.source_data?.project_id) propSimilarity += 0.3;

        const row = similarity.get(s1.id);
        if (row) {
          const existing = row.get(s2.id) || 0;
          row.set(s2.id, Math.max(existing, propSimilarity));
        }
      });
    });

    return similarity;
  }

  /**
   * Perform hierarchical clustering
   */
  private hierarchicalClustering(
    signals: Signal[],
    similarity: Map<string, Map<string, number>>
  ): string[][] {
    if (signals.length <= 1) {
      return signals.map((s) => [s.id]);
    }

    const threshold = 0.3; // Minimum similarity to cluster
    const clusters: Set<string>[] = signals.map((s) => new Set([s.id]));

    let merged = true;
    while (merged && clusters.length > 1) {
      merged = false;
      let maxSim = threshold;
      let mergeI = -1;
      let mergeJ = -1;

      // Find closest clusters
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const sim = this.clusterSimilarity(clusters[i], clusters[j], similarity);
          if (sim > maxSim) {
            maxSim = sim;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // Merge closest clusters
      if (mergeI !== -1 && mergeJ !== -1) {
        clusters[mergeJ].forEach((id) => clusters[mergeI].add(id));
        clusters.splice(mergeJ, 1);
        merged = true;
      }
    }

    return clusters.map((c) => Array.from(c));
  }

  /**
   * Calculate similarity between two clusters (average linkage)
   */
  private clusterSimilarity(
    c1: Set<string>,
    c2: Set<string>,
    similarity: Map<string, Map<string, number>>
  ): number {
    let total = 0;
    let count = 0;

    c1.forEach((id1) => {
      c2.forEach((id2) => {
        const row = similarity.get(id1);
        if (row) {
          total += row.get(id2) || 0;
          count++;
        }
      });
    });

    return count > 0 ? total / count : 0;
  }

  /**
   * Find cluster centroid (most representative signal)
   */
  private findCentroid(
    signals: Signal[],
    similarity: Map<string, Map<string, number>>
  ): Signal {
    if (signals.length === 1) return signals[0];

    let maxAvgSim = -1;
    let centroid = signals[0];

    signals.forEach((s1) => {
      let totalSim = 0;
      signals.forEach((s2) => {
        if (s1.id !== s2.id) {
          const row = similarity.get(s1.id);
          totalSim += row?.get(s2.id) || 0;
        }
      });

      const avgSim = totalSim / (signals.length - 1);
      if (avgSim > maxAvgSim) {
        maxAvgSim = avgSim;
        centroid = s1;
      }
    });

    return centroid;
  }

  /**
   * Calculate cluster cohesion
   */
  private calculateCohesion(
    cluster: string[],
    similarity: Map<string, Map<string, number>>
  ): number {
    if (cluster.length <= 1) return 1;

    let total = 0;
    let count = 0;

    cluster.forEach((id1) => {
      cluster.forEach((id2) => {
        if (id1 !== id2) {
          const row = similarity.get(id1);
          total += row?.get(id2) || 0;
          count++;
        }
      });
    });

    return count > 0 ? total / count : 0;
  }

  /**
   * Calculate separation from other clusters
   */
  private calculateSeparation(
    cluster: string[],
    allClusters: string[][],
    similarity: Map<string, Map<string, number>>
  ): number {
    const otherSignals: string[] = [];
    allClusters.forEach((c) => {
      if (c !== cluster) {
        otherSignals.push(...c);
      }
    });

    if (otherSignals.length === 0) return 1;

    let total = 0;
    let count = 0;

    cluster.forEach((id1) => {
      otherSignals.forEach((id2) => {
        const row = similarity.get(id1);
        total += row?.get(id2) || 0;
        count++;
      });
    });

    // Separation is inverse of similarity to other clusters
    const avgSim = count > 0 ? total / count : 0;
    return 1 - avgSim;
  }

  /**
   * Generate a label for a cluster
   */
  private generateClusterLabel(signals: Signal[], dominantType: string): string {
    const typeLabels: Record<string, string> = {
      deadline: 'Deadline Signals',
      conflict: 'Conflict Signals',
      opportunity: 'Opportunities',
      risk: 'Risk Alerts',
      anomaly: 'Anomalies',
      pattern: 'Pattern Signals',
      dependency: 'Dependencies',
      resource: 'Resource Signals',
    };

    const base = typeLabels[dominantType] || 'Mixed Signals';
    return `${base} (${signals.length})`;
  }

  /**
   * Find causal chains in the graph
   */
  findCausalChains(nodes: SignalNode[], edges: SignalEdge[]): CausalChain[] {
    const causalEdges = edges.filter(
      (e) => e.type === 'causal' || e.type === 'dependency'
    );

    if (causalEdges.length === 0) return [];

    // Build adjacency list
    const adj = new Map<string, SignalEdge[]>();
    causalEdges.forEach((edge) => {
      if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
      adj.get(edge.sourceId)!.push(edge);
    });

    // Find all chains starting from root nodes
    const rootNodes = nodes.filter((n) => n.isRoot);
    const chains: CausalChain[] = [];

    rootNodes.forEach((root) => {
      const foundChains = this.findChainsFromNode(root.id, adj, nodes);
      chains.push(...foundChains);
    });

    // Sort by length and strength
    return chains.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return b.totalStrength - a.totalStrength;
    });
  }

  /**
   * Find all causal chains starting from a node
   */
  private findChainsFromNode(
    startId: string,
    adj: Map<string, SignalEdge[]>,
    nodes: SignalNode[]
  ): CausalChain[] {
    const chains: CausalChain[] = [];
    const visited = new Set<string>();

    const dfs = (
      currentId: string,
      path: string[],
      edges: SignalEdge[],
      strength: number
    ) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const outEdges = adj.get(currentId) || [];

      if (outEdges.length === 0 && path.length > 1) {
        // End of chain
        const rootSignal = this.signalCache.get(path[0]);
        chains.push({
          id: `chain-${startId}-${path.length}`,
          name: rootSignal ? `Chain from ${rootSignal.title}` : 'Causal Chain',
          rootSignalId: path[0],
          signalIds: [...path],
          edges: [...edges],
          totalStrength: strength / edges.length,
          length: path.length,
          confidence: this.calculateChainConfidence(path),
        });
      }

      outEdges.forEach((edge) => {
        dfs(
          edge.targetId,
          [...path, edge.targetId],
          [...edges, edge],
          strength + edge.strength
        );
      });

      visited.delete(currentId);
    };

    dfs(startId, [startId], [], 0);
    return chains;
  }

  /**
   * Calculate confidence for a causal chain
   */
  private calculateChainConfidence(signalIds: string[]): number {
    const signals = signalIds.map((id) => this.signalCache.get(id)).filter(Boolean) as Signal[];
    if (signals.length === 0) return 0;

    const avgConfidence =
      signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

    // Decay confidence with chain length
    const lengthPenalty = Math.pow(0.95, signalIds.length - 1);

    return avgConfidence * lengthPenalty;
  }

  /**
   * Find timeline correlations between signals
   */
  async findTimelineCorrelations(
    signals: Signal[],
    maxTimeDeltaMs: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<TimelineCorrelation[]> {
    const correlations: TimelineCorrelation[] = [];
    const signalTimes = signals.map((s) => ({
      signal: s,
      time: new Date(s.created_at).getTime(),
    }));

    // Sort by time
    signalTimes.sort((a, b) => a.time - b.time);

    // Find temporal correlations
    for (let i = 0; i < signalTimes.length; i++) {
      for (let j = i + 1; j < signalTimes.length; j++) {
        const timeDelta = signalTimes[j].time - signalTimes[i].time;

        if (timeDelta > maxTimeDeltaMs) break;

        const direction: 'before' | 'after' | 'concurrent' =
          timeDelta < 60000 ? 'concurrent' : 'after';

        // Check if signals are related by type or entity
        const s1 = signalTimes[i].signal;
        const s2 = signalTimes[j].signal;

        let confidence = 0.5;
        if (s1.signal_type === s2.signal_type) confidence += 0.2;
        if (s1.related_entity_id === s2.related_entity_id) confidence += 0.3;

        if (confidence > 0.6) {
          correlations.push({
            signalId: s1.id,
            correlatedSignalId: s2.id,
            timeDeltaMs: timeDelta,
            direction,
            frequencyCount: 1,
            confidence,
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Calculate graph statistics
   */
  private calculateStatistics(
    nodes: SignalNode[],
    edges: SignalEdge[],
    clusters: SignalClusterResult[]
  ): SignalGraphResult['statistics'] {
    const totalNodes = nodes.length;
    const totalEdges = edges.length;

    // Average degree
    const totalDegree = nodes.reduce(
      (sum, n) => sum + n.parentIds.length + n.childIds.length,
      0
    );
    const avgDegree = totalNodes > 0 ? totalDegree / totalNodes : 0;

    // Max depth
    const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);

    // Graph density
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    return {
      totalNodes,
      totalEdges,
      avgDegree,
      maxDepth,
      clusterCount: clusters.length,
      density,
    };
  }

  /**
   * Get subgraph centered on a specific signal
   */
  async getSignalSubgraph(
    signalId: string,
    signals: Signal[],
    correlations: Correlation[],
    depth: number = 2
  ): Promise<SignalGraphResult> {
    const relevantSignalIds = new Set<string>();
    relevantSignalIds.add(signalId);

    // Find connected signals up to depth
    for (let d = 0; d < depth; d++) {
      correlations.forEach((corr) => {
        if (relevantSignalIds.has(corr.source_entity_id)) {
          relevantSignalIds.add(corr.target_entity_id);
        }
        if (relevantSignalIds.has(corr.target_entity_id)) {
          relevantSignalIds.add(corr.source_entity_id);
        }
      });
    }

    const subgraphSignals = signals.filter((s) => relevantSignalIds.has(s.id));
    const subgraphCorrelations = correlations.filter(
      (c) =>
        relevantSignalIds.has(c.source_entity_id) &&
        relevantSignalIds.has(c.target_entity_id)
    );

    return this.buildGraph(subgraphSignals, subgraphCorrelations);
  }
}

// Singleton instance
export const signalGraphService = new SignalGraphService();
