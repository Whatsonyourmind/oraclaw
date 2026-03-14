/**
 * SignalGraph Component
 * Interactive visual relationship graph for signals
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, G, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { Signal, UrgencyLevel, ImpactLevel } from '@mission-control/shared-types';
import { ORACLE_COLORS, getUrgencyColor, getImpactColor } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

export interface GraphNode {
  id: string;
  signal: Signal;
  x: number;
  y: number;
  radius: number;
  color: string;
  isRoot: boolean;
  isDerived: boolean;
  clusterId?: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'causal' | 'temporal' | 'semantic' | 'dependency' | 'conflict' | 'synergy';
  strength: number;
  color: string;
}

export interface GraphCluster {
  id: string;
  label: string;
  nodes: string[];
  color: string;
  centerX: number;
  centerY: number;
}

export interface SignalGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: GraphCluster[];
  onNodePress: (node: GraphNode) => void;
  onClusterPress?: (cluster: GraphCluster) => void;
  selectedNodeId?: string;
  highlightedEdges?: string[];
  showLabels?: boolean;
  showClusters?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH * 2;
const GRAPH_HEIGHT = SCREEN_HEIGHT * 1.5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

const EDGE_COLORS: Record<GraphEdge['type'], string> = {
  causal: '#FF6B6B',
  temporal: '#00BFFF',
  semantic: '#FFD700',
  dependency: '#FF9500',
  conflict: '#FF4444',
  synergy: '#00FF88',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const SignalGraph: React.FC<SignalGraphProps> = ({
  nodes,
  edges,
  clusters = [],
  onNodePress,
  onClusterPress,
  selectedNodeId,
  highlightedEdges = [],
  showLabels = true,
  showClusters = true,
}) => {
  // State
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showNodeDetail, setShowNodeDetail] = useState<GraphNode | null>(null);

  // Refs
  const lastPanOffset = useRef({ x: 0, y: 0 });
  const lastScale = useRef(1);
  const pinchDistance = useRef(0);

  // Pan responder for zoom and pan
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lastPanOffset.current = panOffset;
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;

          if (touches.length === 2) {
            // Pinch to zoom
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (pinchDistance.current > 0) {
              const scale = distance / pinchDistance.current;
              const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, lastScale.current * scale));
              setZoom(newZoom);
            }
            pinchDistance.current = distance;
          } else {
            // Pan
            setPanOffset({
              x: lastPanOffset.current.x + gestureState.dx / zoom,
              y: lastPanOffset.current.y + gestureState.dy / zoom,
            });
          }
        },
        onPanResponderRelease: () => {
          lastScale.current = zoom;
          pinchDistance.current = 0;
        },
      }),
    [zoom, panOffset]
  );

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + 0.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - 0.2));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Handle cluster toggle
  const handleClusterToggle = useCallback((clusterId: string) => {
    setExpandedClusters((prev) => {
      const updated = new Set(prev);
      if (updated.has(clusterId)) {
        updated.delete(clusterId);
      } else {
        updated.add(clusterId);
      }
      return updated;
    });
  }, []);

  // Get connected edges for a node
  const getConnectedEdges = useCallback(
    (nodeId: string) => {
      return edges.filter((e) => e.sourceId === nodeId || e.targetId === nodeId);
    },
    [edges]
  );

  // Calculate visible nodes (considering collapsed clusters)
  const visibleNodes = useMemo(() => {
    if (!showClusters) return nodes;

    return nodes.filter((node) => {
      if (!node.clusterId) return true;
      return expandedClusters.has(node.clusterId);
    });
  }, [nodes, showClusters, expandedClusters]);

  // Calculate visible edges
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter(
      (e) => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId)
    );
  }, [edges, visibleNodes]);

  // Render edge
  const renderEdge = (edge: GraphEdge) => {
    const sourceNode = nodes.find((n) => n.id === edge.sourceId);
    const targetNode = nodes.find((n) => n.id === edge.targetId);

    if (!sourceNode || !targetNode) return null;

    const isHighlighted =
      highlightedEdges.includes(edge.id) ||
      edge.sourceId === selectedNodeId ||
      edge.targetId === selectedNodeId;

    const color = EDGE_COLORS[edge.type] || '#666666';
    const opacity = isHighlighted ? 1 : 0.3;
    const strokeWidth = (1 + edge.strength * 2) * (isHighlighted ? 1.5 : 1);

    return (
      <Line
        key={edge.id}
        x1={sourceNode.x}
        y1={sourceNode.y}
        x2={targetNode.x}
        y2={targetNode.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeDasharray={edge.type === 'temporal' ? '5,5' : undefined}
      />
    );
  };

  // Render node
  const renderNode = (node: GraphNode) => {
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNode;
    const connectedEdges = getConnectedEdges(node.id);
    const isConnectedToSelected = connectedEdges.some(
      (e) => e.sourceId === selectedNodeId || e.targetId === selectedNodeId
    );

    const radius = node.radius * (isSelected ? 1.3 : isHovered ? 1.1 : 1);
    const opacity = selectedNodeId && !isSelected && !isConnectedToSelected ? 0.4 : 1;

    return (
      <G key={node.id}>
        {/* Glow effect for selected/root nodes */}
        {(isSelected || node.isRoot) && (
          <Circle
            cx={node.x}
            cy={node.y}
            r={radius + 5}
            fill={node.color}
            fillOpacity={0.3}
          />
        )}

        {/* Main node circle */}
        <Circle
          cx={node.x}
          cy={node.y}
          r={radius}
          fill={node.color}
          fillOpacity={opacity}
          stroke={isSelected ? '#FFFFFF' : 'transparent'}
          strokeWidth={isSelected ? 2 : 0}
          onPress={() => onNodePress(node)}
          onLongPress={() => setShowNodeDetail(node)}
        />

        {/* Root indicator */}
        {node.isRoot && (
          <Circle
            cx={node.x}
            cy={node.y - radius - 8}
            r={4}
            fill="#FFFFFF"
          />
        )}

        {/* Label */}
        {showLabels && (isSelected || isHovered || radius > 15) && (
          <SvgText
            x={node.x}
            y={node.y + radius + 14}
            fill="#FFFFFF"
            fontSize={10}
            textAnchor="middle"
            fontWeight={isSelected ? 'bold' : 'normal'}
          >
            {node.signal.title.substring(0, 15)}
            {node.signal.title.length > 15 ? '...' : ''}
          </SvgText>
        )}
      </G>
    );
  };

  // Render cluster background
  const renderCluster = (cluster: GraphCluster) => {
    if (expandedClusters.has(cluster.id)) return null;

    const clusterNodes = nodes.filter((n) => cluster.nodes.includes(n.id));
    if (clusterNodes.length === 0) return null;

    // Calculate cluster bounds
    const minX = Math.min(...clusterNodes.map((n) => n.x)) - 30;
    const maxX = Math.max(...clusterNodes.map((n) => n.x)) + 30;
    const minY = Math.min(...clusterNodes.map((n) => n.y)) - 30;
    const maxY = Math.max(...clusterNodes.map((n) => n.y)) + 30;

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const radius = Math.max(width, height) / 2;

    return (
      <G key={cluster.id}>
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill={cluster.color}
          fillOpacity={0.15}
          stroke={cluster.color}
          strokeWidth={2}
          strokeOpacity={0.5}
          strokeDasharray="10,5"
          onPress={() => handleClusterToggle(cluster.id)}
        />
        <SvgText
          x={centerX}
          y={centerY}
          fill={cluster.color}
          fontSize={14}
          textAnchor="middle"
          fontWeight="bold"
        >
          {cluster.label}
        </SvgText>
        <SvgText
          x={centerX}
          y={centerY + 16}
          fill="#888888"
          fontSize={10}
          textAnchor="middle"
        >
          {cluster.nodes.length} signals
        </SvgText>
      </G>
    );
  };

  // Render legend
  const renderLegend = () => (
    <View style={styles.legend}>
      <Text style={styles.legendTitle}>Edge Types</Text>
      {Object.entries(EDGE_COLORS).map(([type, color]) => (
        <View key={type} style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: color }]} />
          <Text style={styles.legendText}>{type}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Graph Container */}
      <View style={styles.graphContainer} {...panResponder.panHandlers}>
        <Svg
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT - 150}
          viewBox={`${-panOffset.x - GRAPH_WIDTH / 2 / zoom} ${
            -panOffset.y - GRAPH_HEIGHT / 2 / zoom
          } ${GRAPH_WIDTH / zoom} ${GRAPH_HEIGHT / zoom}`}
        >
          <Defs>
            <RadialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.3} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* Clusters */}
          {showClusters && clusters.map(renderCluster)}

          {/* Edges */}
          {visibleEdges.map(renderEdge)}

          {/* Nodes */}
          {visibleNodes.map(renderNode)}
        </Svg>
      </View>

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={handleResetView}>
          <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      {renderLegend()}

      {/* Graph Controls */}
      <View style={styles.graphControls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            showLabels && styles.controlButtonActive,
          ]}
        >
          <Ionicons
            name="text-outline"
            size={18}
            color={showLabels ? '#000000' : '#FFFFFF'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.controlButton,
            showClusters && styles.controlButtonActive,
          ]}
        >
          <Ionicons
            name="layers-outline"
            size={18}
            color={showClusters ? '#000000' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>

      {/* Node Detail Modal */}
      <Modal
        visible={showNodeDetail !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNodeDetail(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNodeDetail(null)}
        >
          {showNodeDetail && (
            <View style={styles.nodeDetailModal}>
              <View
                style={[
                  styles.nodeDetailHeader,
                  { backgroundColor: showNodeDetail.color },
                ]}
              >
                <Text style={styles.nodeDetailType}>
                  {showNodeDetail.signal.signal_type.toUpperCase()}
                </Text>
                <TouchableOpacity onPress={() => setShowNodeDetail(null)}>
                  <Ionicons name="close" size={20} color="#000000" />
                </TouchableOpacity>
              </View>

              <View style={styles.nodeDetailContent}>
                <Text style={styles.nodeDetailTitle}>
                  {showNodeDetail.signal.title}
                </Text>

                {showNodeDetail.signal.description && (
                  <Text style={styles.nodeDetailDescription}>
                    {showNodeDetail.signal.description}
                  </Text>
                )}

                <View style={styles.nodeDetailBadges}>
                  <View
                    style={[
                      styles.nodeDetailBadge,
                      { backgroundColor: getUrgencyColor(showNodeDetail.signal.urgency) },
                    ]}
                  >
                    <Text style={styles.nodeDetailBadgeText}>
                      {showNodeDetail.signal.urgency.toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.nodeDetailBadge,
                      { backgroundColor: getImpactColor(showNodeDetail.signal.impact) },
                    ]}
                  >
                    <Text style={styles.nodeDetailBadgeText}>
                      {showNodeDetail.signal.impact.toUpperCase()} IMPACT
                    </Text>
                  </View>
                </View>

                <View style={styles.nodeDetailStats}>
                  <View style={styles.nodeDetailStat}>
                    <Text style={styles.nodeDetailStatLabel}>Confidence</Text>
                    <Text style={styles.nodeDetailStatValue}>
                      {Math.round(showNodeDetail.signal.confidence * 100)}%
                    </Text>
                  </View>
                  <View style={styles.nodeDetailStat}>
                    <Text style={styles.nodeDetailStatLabel}>Connections</Text>
                    <Text style={styles.nodeDetailStatValue}>
                      {getConnectedEdges(showNodeDetail.id).length}
                    </Text>
                  </View>
                  <View style={styles.nodeDetailStat}>
                    <Text style={styles.nodeDetailStatLabel}>Type</Text>
                    <Text style={styles.nodeDetailStatValue}>
                      {showNodeDetail.isRoot
                        ? 'Root'
                        : showNodeDetail.isDerived
                        ? 'Derived'
                        : 'Standard'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.nodeDetailButton}
                  onPress={() => {
                    onNodePress(showNodeDetail);
                    setShowNodeDetail(null);
                  }}
                >
                  <Text style={styles.nodeDetailButtonText}>View Details</Text>
                  <Ionicons name="arrow-forward" size={16} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
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
  graphContainer: {
    flex: 1,
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 12,
    padding: 8,
  },
  zoomButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    color: '#FFFFFF',
    fontSize: 10,
    textAlign: 'center',
    marginVertical: 4,
  },
  legend: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 12,
    padding: 12,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#888888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#CCCCCC',
    textTransform: 'capitalize',
  },
  graphControls: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  nodeDetailModal: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  nodeDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  nodeDetailType: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 1,
  },
  nodeDetailContent: {
    padding: 16,
  },
  nodeDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  nodeDetailDescription: {
    fontSize: 13,
    color: '#AAAAAA',
    lineHeight: 18,
    marginBottom: 12,
  },
  nodeDetailBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  nodeDetailBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nodeDetailBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  nodeDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    marginBottom: 16,
  },
  nodeDetailStat: {
    alignItems: 'center',
  },
  nodeDetailStatLabel: {
    fontSize: 10,
    color: '#888888',
    marginBottom: 4,
  },
  nodeDetailStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nodeDetailButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  nodeDetailButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
});

export default SignalGraph;
