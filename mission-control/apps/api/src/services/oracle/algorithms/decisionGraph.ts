/**
 * Decision Graph — SOTA graph algorithms for decision intelligence
 * Uses graphology (full graph library) for network analysis of decisions,
 * dependencies, and influence paths.
 *
 * Enables: PageRank for signal prioritization, community detection for
 * decision clustering, shortest path for critical path analysis,
 * and centrality metrics for identifying key decision nodes.
 */

import Graph from "graphology";
import { dijkstra, bidirectional } from "graphology-shortest-path";
import pagerank from "graphology-metrics/centrality/pagerank.js";
import louvain from "graphology-communities-louvain";

// ── Types ──────────────────────────────────────────────

export interface DecisionNode {
  id: string;
  type: "decision" | "signal" | "action" | "outcome" | "constraint" | "goal";
  label: string;
  urgency: "critical" | "high" | "medium" | "low";
  confidence: number; // 0-1
  impact: number; // 0-1
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface DecisionEdge {
  source: string;
  target: string;
  type: "depends_on" | "influences" | "blocks" | "enables" | "conflicts_with" | "supports";
  weight: number; // 0-1, higher = stronger relationship
  metadata?: Record<string, unknown>;
}

export interface GraphAnalysis {
  pageRank: Record<string, number>;
  communities: Record<string, number>;
  criticalPath: string[];
  criticalPathWeight: number;
  bottlenecks: Array<{ id: string; score: number }>;
  clusters: Array<{ community: number; nodes: string[]; avgConfidence: number }>;
  totalNodes: number;
  totalEdges: number;
}

// ── Decision Graph Service ─────────────────────────────

export class DecisionGraphService {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false, allowSelfLoops: false });
  }

  addNode(node: DecisionNode): void {
    if (this.graph.hasNode(node.id)) {
      this.graph.mergeNodeAttributes(node.id, node);
    } else {
      this.graph.addNode(node.id, node);
    }
  }

  addEdge(edge: DecisionEdge): void {
    const key = `${edge.source}->${edge.target}`;
    if (this.graph.hasEdge(key)) {
      this.graph.mergeEdgeAttributes(key, edge);
    } else {
      if (!this.graph.hasNode(edge.source) || !this.graph.hasNode(edge.target)) {
        throw new Error(`Node ${edge.source} or ${edge.target} not found`);
      }
      this.graph.addEdgeWithKey(key, edge.source, edge.target, {
        ...edge,
        // For shortest path, invert weight (lower weight = stronger = shorter path)
        cost: 1 - edge.weight + 0.01,
      });
    }
  }

  removeNode(id: string): void {
    if (this.graph.hasNode(id)) {
      this.graph.dropNode(id);
    }
  }

  /**
   * Compute PageRank to identify the most influential decision nodes.
   * Higher PageRank = more nodes depend on or are influenced by this node.
   */
  computePageRank(): Record<string, number> {
    if (this.graph.order === 0) return {};
    return pagerank(this.graph, {
      alpha: 0.85,
      maxIterations: 100,
      tolerance: 1e-6,
      getEdgeWeight: (_, attrs) => (attrs as Record<string, unknown>).weight as number ?? 1,
    });
  }

  /**
   * Detect decision communities using Louvain algorithm.
   * Groups related decisions that should be considered together.
   */
  detectCommunities(): Record<string, number> {
    if (this.graph.order === 0) return {};
    // Louvain needs an undirected graph
    const undirected = this.graph.copy();
    undirected.forEachEdge((edge, attrs, source, target) => {
      if (!undirected.hasEdge(target, source)) {
        undirected.addEdge(target, source, attrs);
      }
    });
    return louvain(undirected, { resolution: 1.0 });
  }

  /**
   * Find the critical path between two nodes using Dijkstra.
   * Uses inverted weights so strongest relationships = shortest path.
   */
  findCriticalPath(source: string, target: string): { path: string[]; weight: number } | null {
    if (!this.graph.hasNode(source) || !this.graph.hasNode(target)) return null;

    try {
      const path = bidirectional(this.graph, source, target);
      if (!path || path.length === 0) return null;

      let totalWeight = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const edges = this.graph.edges(path[i]!, path[i + 1]!);
        if (edges.length > 0) {
          totalWeight += this.graph.getEdgeAttribute(edges[0]!, "weight") as number;
        }
      }

      return { path, weight: totalWeight };
    } catch {
      return null;
    }
  }

  /**
   * Identify bottleneck nodes — high in-degree + high PageRank.
   * These are decisions that block or enable many other decisions.
   */
  findBottlenecks(topN: number = 5): Array<{ id: string; score: number }> {
    const pr = this.computePageRank();
    const bottlenecks: Array<{ id: string; score: number }> = [];

    this.graph.forEachNode((node) => {
      const inDegree = this.graph.inDegree(node);
      const outDegree = this.graph.outDegree(node);
      const prScore = pr[node] ?? 0;

      // Bottleneck score = PageRank × (inDegree + 1) / (outDegree + 1)
      // High when many things flow INTO this node but few flow OUT
      const score = prScore * ((inDegree + 1) / (outDegree + 1));
      bottlenecks.push({ id: node, score });
    });

    return bottlenecks
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  /**
   * Full analysis: PageRank + communities + bottlenecks + clusters.
   */
  analyze(sourceGoal?: string, targetGoal?: string): GraphAnalysis {
    const pr = this.computePageRank();
    const communities = this.detectCommunities();
    const bottlenecks = this.findBottlenecks(10);

    // Build cluster summaries
    const clusterMap = new Map<number, string[]>();
    for (const [nodeId, community] of Object.entries(communities)) {
      if (!clusterMap.has(community)) clusterMap.set(community, []);
      clusterMap.get(community)!.push(nodeId);
    }

    const clusters = Array.from(clusterMap.entries()).map(([community, nodes]) => {
      const avgConfidence = nodes.reduce((sum, n) => {
        const attrs = this.graph.getNodeAttributes(n) as DecisionNode;
        return sum + (attrs.confidence ?? 0);
      }, 0) / nodes.length;

      return { community, nodes, avgConfidence };
    });

    // Critical path if goals provided
    let criticalPath: string[] = [];
    let criticalPathWeight = 0;
    if (sourceGoal && targetGoal) {
      const cp = this.findCriticalPath(sourceGoal, targetGoal);
      if (cp) {
        criticalPath = cp.path;
        criticalPathWeight = cp.weight;
      }
    }

    return {
      pageRank: pr,
      communities,
      criticalPath,
      criticalPathWeight,
      bottlenecks,
      clusters,
      totalNodes: this.graph.order,
      totalEdges: this.graph.size,
    };
  }

  /**
   * Get neighbors of a node (decisions that directly depend on or influence it).
   */
  getNeighbors(nodeId: string): Array<{ id: string; relationship: string; weight: number }> {
    if (!this.graph.hasNode(nodeId)) return [];

    const neighbors: Array<{ id: string; relationship: string; weight: number }> = [];

    this.graph.forEachOutEdge(nodeId, (_edge, attrs, _source, target) => {
      neighbors.push({
        id: target,
        relationship: (attrs as DecisionEdge).type,
        weight: (attrs as DecisionEdge).weight,
      });
    });

    this.graph.forEachInEdge(nodeId, (_edge, attrs, source) => {
      neighbors.push({
        id: source,
        relationship: `inverse_${(attrs as DecisionEdge).type}`,
        weight: (attrs as DecisionEdge).weight,
      });
    });

    return neighbors;
  }

  /**
   * Export graph for persistence or visualization.
   */
  exportGraph(): { nodes: DecisionNode[]; edges: DecisionEdge[] } {
    const nodes: DecisionNode[] = [];
    const edges: DecisionEdge[] = [];

    this.graph.forEachNode((_node, attrs) => {
      nodes.push(attrs as DecisionNode);
    });

    this.graph.forEachEdge((_edge, attrs) => {
      edges.push(attrs as DecisionEdge);
    });

    return { nodes, edges };
  }

  /**
   * Import graph from persistence.
   */
  importGraph(data: { nodes: DecisionNode[]; edges: DecisionEdge[] }): void {
    this.graph.clear();
    for (const node of data.nodes) {
      this.addNode(node);
    }
    for (const edge of data.edges) {
      this.addEdge(edge);
    }
  }

  get nodeCount(): number {
    return this.graph.order;
  }

  get edgeCount(): number {
    return this.graph.size;
  }
}

export function createDecisionGraph(): DecisionGraphService {
  return new DecisionGraphService();
}
