/**
 * A* Pathfinding Algorithm
 * Story alg-4 - Critical path navigation for task dependencies
 *
 * Implements A* search with custom heuristics for finding optimal paths
 * through task dependency graphs, considering time, cost, and risk factors.
 */

/**
 * Represents a node in the graph
 */
export interface GraphNode {
  /** Unique node identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Node metadata (e.g., task properties) */
  metadata?: Record<string, unknown>;
  /** Estimated time to complete (for time heuristic) */
  estimatedTime?: number;
  /** Estimated cost (for cost heuristic) */
  estimatedCost?: number;
  /** Risk factor 0-1 (for risk heuristic) */
  riskFactor?: number;
}

/**
 * Represents an edge connecting two nodes
 */
export interface GraphEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Edge weight (cost to traverse) */
  weight: number;
  /** Time cost for traversal */
  timeCost?: number;
  /** Monetary cost for traversal */
  monetaryCost?: number;
  /** Risk associated with traversal */
  risk?: number;
  /** Edge metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Graph representation for A* search
 */
export interface Graph {
  /** All nodes in the graph */
  nodes: Map<string, GraphNode>;
  /** Adjacency list: node ID -> list of outgoing edges */
  edges: Map<string, GraphEdge[]>;
  /** Whether the graph is directed */
  directed: boolean;
}

/**
 * A* node with path cost information
 */
interface AStarNode {
  /** Node identifier */
  id: string;
  /** Cost from start (g score) */
  g: number;
  /** Heuristic estimate to goal (h score) */
  h: number;
  /** Total estimated cost f = g + h */
  f: number;
  /** Parent node for path reconstruction */
  parent: string | null;
  /** Edge used to reach this node */
  edge?: GraphEdge;
}

/**
 * Result of A* pathfinding
 */
export interface PathResult {
  /** Ordered list of node IDs in the path */
  path: string[];
  /** Edges traversed in order */
  edges: GraphEdge[];
  /** Total path cost (weighted) */
  totalCost: number;
  /** Breakdown of costs */
  costBreakdown: {
    time: number;
    money: number;
    risk: number;
    weighted: number;
  };
  /** Number of nodes explored */
  nodesExplored: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Whether a path was found */
  found: boolean;
}

/**
 * Heuristic function type
 */
export type HeuristicFunction = (current: string, goal: string, graph: Graph) => number;

/**
 * Configuration for A* search
 */
export interface AStarConfig {
  /** Weight for time in cost calculation */
  timeWeight: number;
  /** Weight for monetary cost in calculation */
  costWeight: number;
  /** Weight for risk in calculation */
  riskWeight: number;
  /** Maximum nodes to explore before giving up */
  maxNodes: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Priority queue implementation using a binary heap
 *
 * O(log n) insert and extract operations
 */
class PriorityQueue<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn: (a: T, b: T) => number) {
    this.compareFn = compareFn;
  }

  /**
   * Insert element into queue
   * O(log n) time complexity
   */
  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return minimum element
   * O(log n) time complexity
   */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;

    const min = this.heap[0];
    const last = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return min;
  }

  /**
   * Check if queue is empty
   * O(1) time complexity
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Get queue size
   * O(1) time complexity
   */
  size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compareFn(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.compareFn(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.compareFn(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

/**
 * Built-in heuristic functions
 */
export const Heuristics = {
  /**
   * Zero heuristic (Dijkstra's algorithm)
   * Guarantees optimal path but explores more nodes
   *
   * O(1) time complexity
   */
  zero: (): number => 0,

  /**
   * Time-based heuristic
   * Estimates remaining time based on average edge weight
   *
   * O(1) time complexity
   */
  time: (current: string, goal: string, graph: Graph): number => {
    const currentNode = graph.nodes.get(current);
    const goalNode = graph.nodes.get(goal);

    if (!currentNode || !goalNode) return 0;

    // Use estimated times if available
    const goalTime = goalNode.estimatedTime ?? 0;
    return goalTime;
  },

  /**
   * Cost-based heuristic
   * Estimates remaining monetary cost
   *
   * O(1) time complexity
   */
  cost: (current: string, goal: string, graph: Graph): number => {
    const currentNode = graph.nodes.get(current);
    const goalNode = graph.nodes.get(goal);

    if (!currentNode || !goalNode) return 0;

    const goalCost = goalNode.estimatedCost ?? 0;
    return goalCost;
  },

  /**
   * Risk-based heuristic
   * Estimates risk to reach goal
   *
   * O(1) time complexity
   */
  risk: (current: string, goal: string, graph: Graph): number => {
    const currentNode = graph.nodes.get(current);
    const goalNode = graph.nodes.get(goal);

    if (!currentNode || !goalNode) return 0;

    const goalRisk = goalNode.riskFactor ?? 0;
    return goalRisk;
  },

  /**
   * Combined weighted heuristic
   * Combines time, cost, and risk with configurable weights
   *
   * O(1) time complexity
   */
  weighted: (timeWeight: number, costWeight: number, riskWeight: number): HeuristicFunction => {
    return (current: string, goal: string, graph: Graph): number => {
      const timeH = Heuristics.time(current, goal, graph);
      const costH = Heuristics.cost(current, goal, graph);
      const riskH = Heuristics.risk(current, goal, graph);

      return timeWeight * timeH + costWeight * costH + riskWeight * riskH;
    };
  },
};

/**
 * A* Pathfinding Service
 *
 * Implements A* search algorithm for finding optimal paths through
 * task dependency graphs with customizable heuristics and cost functions.
 */
export class AStarPathfinder {
  private config: AStarConfig;

  /**
   * Creates a new A* pathfinder
   * @param config - Configuration options
   */
  constructor(config: Partial<AStarConfig> = {}) {
    this.config = {
      timeWeight: config.timeWeight ?? 1,
      costWeight: config.costWeight ?? 1,
      riskWeight: config.riskWeight ?? 0.5,
      maxNodes: config.maxNodes ?? 10000,
      timeoutMs: config.timeoutMs ?? 5000,
    };
  }

  /**
   * Create a new graph
   * @param directed - Whether the graph is directed
   * @returns Empty graph
   *
   * O(1) time complexity
   */
  createGraph(directed: boolean = true): Graph {
    return {
      nodes: new Map(),
      edges: new Map(),
      directed,
    };
  }

  /**
   * Add a node to the graph
   * @param graph - Graph to modify
   * @param node - Node to add
   *
   * O(1) time complexity
   */
  addNode(graph: Graph, node: GraphNode): void {
    graph.nodes.set(node.id, node);
    if (!graph.edges.has(node.id)) {
      graph.edges.set(node.id, []);
    }
  }

  /**
   * Add an edge to the graph
   * @param graph - Graph to modify
   * @param edge - Edge to add
   *
   * O(1) time complexity
   */
  addEdge(graph: Graph, edge: GraphEdge): void {
    // Add edge from source
    const sourceEdges = graph.edges.get(edge.from) ?? [];
    sourceEdges.push(edge);
    graph.edges.set(edge.from, sourceEdges);

    // For undirected graphs, add reverse edge
    if (!graph.directed) {
      const reverseEdge: GraphEdge = {
        ...edge,
        from: edge.to,
        to: edge.from,
      };
      const targetEdges = graph.edges.get(edge.to) ?? [];
      targetEdges.push(reverseEdge);
      graph.edges.set(edge.to, targetEdges);
    }
  }

  /**
   * Calculate edge cost using configured weights
   * @param edge - Edge to evaluate
   * @returns Weighted cost
   *
   * O(1) time complexity
   */
  private calculateEdgeCost(edge: GraphEdge): number {
    const timeCost = (edge.timeCost ?? edge.weight) * this.config.timeWeight;
    const moneyCost = (edge.monetaryCost ?? 0) * this.config.costWeight;
    const riskCost = (edge.risk ?? 0) * this.config.riskWeight;

    return timeCost + moneyCost + riskCost;
  }

  /**
   * Find optimal path using A* algorithm
   *
   * @param graph - Graph to search
   * @param start - Start node ID
   * @param goal - Goal node ID
   * @param heuristic - Heuristic function (default: zero)
   * @returns Path result
   *
   * O(E log V) time complexity where E = edges, V = vertices
   */
  findPath(
    graph: Graph,
    start: string,
    goal: string,
    heuristic: HeuristicFunction = Heuristics.zero
  ): PathResult {
    const startTime = Date.now();

    // Validate nodes exist
    if (!graph.nodes.has(start)) {
      return this.emptyResult(startTime, false);
    }
    if (!graph.nodes.has(goal)) {
      return this.emptyResult(startTime, false);
    }

    // Initialize data structures
    const openSet = new PriorityQueue<AStarNode>((a, b) => a.f - b.f);
    const closedSet = new Set<string>();
    const nodeMap = new Map<string, AStarNode>();

    // Add start node
    const startNode: AStarNode = {
      id: start,
      g: 0,
      h: heuristic(start, goal, graph),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);
    nodeMap.set(start, startNode);

    let nodesExplored = 0;

    while (!openSet.isEmpty()) {
      // Check timeout
      if (Date.now() - startTime > this.config.timeoutMs) {
        return this.emptyResult(startTime, false);
      }

      // Check max nodes
      if (nodesExplored >= this.config.maxNodes) {
        return this.emptyResult(startTime, false);
      }

      const current = openSet.pop()!;
      nodesExplored++;

      // Goal reached
      if (current.id === goal) {
        return this.reconstructPath(current, nodeMap, graph, nodesExplored, startTime);
      }

      // Skip if already processed
      if (closedSet.has(current.id)) {
        continue;
      }
      closedSet.add(current.id);

      // Explore neighbors
      const edges = graph.edges.get(current.id) ?? [];

      for (const edge of edges) {
        if (closedSet.has(edge.to)) {
          continue;
        }

        const tentativeG = current.g + this.calculateEdgeCost(edge);
        const existing = nodeMap.get(edge.to);

        if (!existing || tentativeG < existing.g) {
          const neighbor: AStarNode = {
            id: edge.to,
            g: tentativeG,
            h: heuristic(edge.to, goal, graph),
            f: 0,
            parent: current.id,
            edge,
          };
          neighbor.f = neighbor.g + neighbor.h;

          nodeMap.set(edge.to, neighbor);
          openSet.push(neighbor);
        }
      }
    }

    // No path found
    return this.emptyResult(startTime, false);
  }

  /**
   * Reconstruct path from goal to start
   * @param goal - Goal node
   * @param nodeMap - Map of node IDs to A* nodes
   * @param graph - Original graph
   * @param nodesExplored - Number of nodes explored
   * @param startTime - Search start time
   * @returns Path result
   *
   * O(path length) time complexity
   */
  private reconstructPath(
    goal: AStarNode,
    nodeMap: Map<string, AStarNode>,
    graph: Graph,
    nodesExplored: number,
    startTime: number
  ): PathResult {
    const path: string[] = [];
    const edges: GraphEdge[] = [];
    let totalTime = 0;
    let totalMoney = 0;
    let totalRisk = 0;

    let current: AStarNode | undefined = goal;

    while (current) {
      path.unshift(current.id);
      if (current.edge) {
        edges.unshift(current.edge);
        totalTime += current.edge.timeCost ?? current.edge.weight;
        totalMoney += current.edge.monetaryCost ?? 0;
        totalRisk += current.edge.risk ?? 0;
      }
      current = current.parent ? nodeMap.get(current.parent) : undefined;
    }

    return {
      path,
      edges,
      totalCost: goal.g,
      costBreakdown: {
        time: totalTime,
        money: totalMoney,
        risk: totalRisk,
        weighted: goal.g,
      },
      nodesExplored,
      executionTimeMs: Date.now() - startTime,
      found: true,
    };
  }

  /**
   * Create empty result for failed searches
   * @param startTime - Search start time
   * @param found - Whether path was found
   * @returns Empty path result
   *
   * O(1) time complexity
   */
  private emptyResult(startTime: number, found: boolean): PathResult {
    return {
      path: [],
      edges: [],
      totalCost: 0,
      costBreakdown: {
        time: 0,
        money: 0,
        risk: 0,
        weighted: 0,
      },
      nodesExplored: 0,
      executionTimeMs: Date.now() - startTime,
      found,
    };
  }

  /**
   * Find alternative paths (k-shortest paths)
   *
   * Uses Yen's algorithm to find k different paths.
   *
   * @param graph - Graph to search
   * @param start - Start node ID
   * @param goal - Goal node ID
   * @param k - Number of paths to find
   * @param heuristic - Heuristic function
   * @returns Array of path results
   *
   * O(k * V * (E log V)) time complexity
   */
  findAlternativePaths(
    graph: Graph,
    start: string,
    goal: string,
    k: number = 3,
    heuristic: HeuristicFunction = Heuristics.zero
  ): PathResult[] {
    const paths: PathResult[] = [];

    // Find shortest path first
    const shortestPath = this.findPath(graph, start, goal, heuristic);
    if (!shortestPath.found) {
      return paths;
    }
    paths.push(shortestPath);

    // Candidate paths
    const candidates: PathResult[] = [];

    for (let i = 1; i < k; i++) {
      const previousPath = paths[i - 1];

      // For each node in previous path (except goal)
      for (let j = 0; j < previousPath.path.length - 1; j++) {
        const spurNode = previousPath.path[j];
        const rootPath = previousPath.path.slice(0, j + 1);

        // Create modified graph
        const modifiedGraph = this.cloneGraph(graph);

        // Remove edges used by previous paths that share the same root
        for (const path of paths) {
          if (this.pathsShareRoot(path.path, rootPath)) {
            const edgeIndex = j;
            if (edgeIndex < path.edges.length) {
              this.removeEdge(modifiedGraph, path.edges[edgeIndex]);
            }
          }
        }

        // Remove root nodes (except spur node)
        for (let r = 0; r < j; r++) {
          this.removeNode(modifiedGraph, rootPath[r]);
        }

        // Find path from spur node to goal
        const spurPath = this.findPath(modifiedGraph, spurNode, goal, heuristic);

        if (spurPath.found) {
          // Combine root path with spur path
          const totalPath = [...rootPath.slice(0, -1), ...spurPath.path];
          const rootEdges = previousPath.edges.slice(0, j);
          const totalEdges = [...rootEdges, ...spurPath.edges];

          const combinedResult: PathResult = {
            path: totalPath,
            edges: totalEdges,
            totalCost: this.calculatePathCost(totalEdges),
            costBreakdown: this.calculateCostBreakdown(totalEdges),
            nodesExplored: spurPath.nodesExplored,
            executionTimeMs: spurPath.executionTimeMs,
            found: true,
          };

          // Add to candidates if not duplicate
          if (!this.isDuplicatePath(combinedResult, candidates) && !this.isDuplicatePath(combinedResult, paths)) {
            candidates.push(combinedResult);
          }
        }
      }

      if (candidates.length === 0) break;

      // Sort candidates by cost and add best to paths
      candidates.sort((a, b) => a.totalCost - b.totalCost);
      paths.push(candidates.shift()!);
    }

    return paths;
  }

  /**
   * Clone a graph
   * @param graph - Graph to clone
   * @returns Cloned graph
   *
   * O(V + E) time complexity
   */
  private cloneGraph(graph: Graph): Graph {
    const cloned: Graph = {
      nodes: new Map(graph.nodes),
      edges: new Map(),
      directed: graph.directed,
    };

    for (const [nodeId, edges] of graph.edges.entries()) {
      cloned.edges.set(nodeId, [...edges]);
    }

    return cloned;
  }

  /**
   * Remove an edge from graph
   * @param graph - Graph to modify
   * @param edge - Edge to remove
   *
   * O(degree) time complexity
   */
  private removeEdge(graph: Graph, edge: GraphEdge): void {
    const edges = graph.edges.get(edge.from);
    if (edges) {
      const index = edges.findIndex(e => e.to === edge.to);
      if (index >= 0) {
        edges.splice(index, 1);
      }
    }
  }

  /**
   * Remove a node from graph
   * @param graph - Graph to modify
   * @param nodeId - Node to remove
   *
   * O(V + E) time complexity
   */
  private removeNode(graph: Graph, nodeId: string): void {
    graph.nodes.delete(nodeId);
    graph.edges.delete(nodeId);

    // Remove edges pointing to this node
    for (const edges of graph.edges.values()) {
      for (let i = edges.length - 1; i >= 0; i--) {
        if (edges[i].to === nodeId) {
          edges.splice(i, 1);
        }
      }
    }
  }

  /**
   * Check if two paths share the same root
   * @param path1 - First path
   * @param root - Root path to check
   * @returns Whether paths share root
   *
   * O(root length) time complexity
   */
  private pathsShareRoot(path1: string[], root: string[]): boolean {
    for (let i = 0; i < root.length; i++) {
      if (path1[i] !== root[i]) return false;
    }
    return true;
  }

  /**
   * Calculate total cost of edges
   * @param edges - Edges to sum
   * @returns Total cost
   *
   * O(n) time complexity
   */
  private calculatePathCost(edges: GraphEdge[]): number {
    return edges.reduce((sum, edge) => sum + this.calculateEdgeCost(edge), 0);
  }

  /**
   * Calculate cost breakdown
   * @param edges - Edges to analyze
   * @returns Cost breakdown
   *
   * O(n) time complexity
   */
  private calculateCostBreakdown(edges: GraphEdge[]): PathResult['costBreakdown'] {
    let time = 0, money = 0, risk = 0;

    for (const edge of edges) {
      time += edge.timeCost ?? edge.weight;
      money += edge.monetaryCost ?? 0;
      risk += edge.risk ?? 0;
    }

    return {
      time,
      money,
      risk,
      weighted: this.calculatePathCost(edges),
    };
  }

  /**
   * Check if path is duplicate
   * @param path - Path to check
   * @param existing - Existing paths
   * @returns Whether path is duplicate
   *
   * O(n * path length) time complexity
   */
  private isDuplicatePath(path: PathResult, existing: PathResult[]): boolean {
    for (const existingPath of existing) {
      if (path.path.length !== existingPath.path.length) continue;

      let same = true;
      for (let i = 0; i < path.path.length; i++) {
        if (path.path[i] !== existingPath.path[i]) {
          same = false;
          break;
        }
      }

      if (same) return true;
    }
    return false;
  }

  /**
   * Dynamic replanning when a blocker is encountered
   *
   * Removes blocked edges and finds new path from current position.
   *
   * @param graph - Graph to search
   * @param current - Current position
   * @param goal - Goal node ID
   * @param blockedEdges - Edges that are blocked
   * @param heuristic - Heuristic function
   * @returns New path result
   *
   * O(E log V) time complexity
   */
  replan(
    graph: Graph,
    current: string,
    goal: string,
    blockedEdges: Array<{ from: string; to: string }>,
    heuristic: HeuristicFunction = Heuristics.zero
  ): PathResult {
    // Create modified graph without blocked edges
    const modifiedGraph = this.cloneGraph(graph);

    for (const blocked of blockedEdges) {
      const edges = modifiedGraph.edges.get(blocked.from);
      if (edges) {
        const index = edges.findIndex(e => e.to === blocked.to);
        if (index >= 0) {
          edges.splice(index, 1);
        }
      }
    }

    // Find new path
    return this.findPath(modifiedGraph, current, goal, heuristic);
  }

  /**
   * Get configuration
   * @returns Current configuration
   *
   * O(1) time complexity
   */
  getConfig(): AStarConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param config - New configuration values
   *
   * O(1) time complexity
   */
  updateConfig(config: Partial<AStarConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Factory function
export function createPathfinder(config?: Partial<AStarConfig>): AStarPathfinder {
  return new AStarPathfinder(config);
}

// Default singleton
export const astarPathfinder = new AStarPathfinder();
