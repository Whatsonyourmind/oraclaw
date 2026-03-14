/**
 * SignalClusterView Component
 * Story 7.3 - Groups related signals visually with expandable details
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SignalCluster } from '@mission-control/shared-types';
import { useRadarStore } from '../../../store/oracle';
import { ORACLE_COLORS, getUrgencyColor } from '../theme';
import { SignalCard } from './SignalCard';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SignalClusterViewProps {
  cluster: SignalCluster;
  onPress?: () => void;
}

export const SignalClusterView: React.FC<SignalClusterViewProps> = ({
  cluster,
  onPress,
}) => {
  const [expanded, setExpanded] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const { signals } = useRadarStore();

  // Get signals that belong to this cluster
  const clusterSignals = signals.filter((s) =>
    cluster.signal_ids?.includes(s.id)
  );

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotationAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
    onPress?.();
  };

  const rotateIcon = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const urgencyColor = getUrgencyColor(cluster.urgency);
  const impactColor = getUrgencyColor(cluster.impact === 'high' ? 'high' : cluster.impact === 'medium' ? 'medium' : 'low');

  return (
    <View style={styles.container}>
      {/* Cluster Header */}
      <TouchableOpacity
        style={[styles.header, { borderLeftColor: urgencyColor }]}
        onPress={toggleExpand}
        activeOpacity={0.8}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${urgencyColor}20` }]}>
          <Ionicons name="layers-outline" size={24} color={urgencyColor} />
        </View>

        {/* Main content */}
        <View style={styles.mainContent}>
          {/* Cluster label */}
          <View style={styles.labelRow}>
            <Text style={styles.clusterLabel}>SIGNAL CLUSTER</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{cluster.signal_count} SIGNALS</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {cluster.name || cluster.theme || 'Related Signals'}
          </Text>

          {/* Theme/Summary */}
          {cluster.theme && (
            <Text style={styles.theme} numberOfLines={2}>
              {cluster.theme}
            </Text>
          )}

          {/* Metrics row */}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Urgency</Text>
              <View style={[styles.metricBadge, { backgroundColor: urgencyColor }]}>
                <Text style={styles.metricBadgeText}>
                  {cluster.urgency?.toUpperCase() || 'MEDIUM'}
                </Text>
              </View>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Impact</Text>
              <View style={[styles.metricBadge, { backgroundColor: impactColor }]}>
                <Text style={styles.metricBadgeText}>
                  {cluster.impact?.toUpperCase() || 'MEDIUM'}
                </Text>
              </View>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Confidence</Text>
              <Text style={[styles.confidenceValue, { color: ORACLE_COLORS.observe }]}>
                {Math.round((cluster.confidence || 0.7) * 100)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Expand icon */}
        <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
          <Ionicons name="chevron-down" size={20} color="#888888" />
        </Animated.View>
      </TouchableOpacity>

      {/* Expanded Content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Cluster Summary */}
          {cluster.summary && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionLabel}>CLUSTER SUMMARY</Text>
              <Text style={styles.summaryText}>{cluster.summary}</Text>
            </View>
          )}

          {/* Related Signals */}
          <View style={styles.signalsSection}>
            <Text style={styles.sectionLabel}>
              RELATED SIGNALS ({clusterSignals.length})
            </Text>
            {clusterSignals.length === 0 ? (
              <View style={styles.emptySignals}>
                <Ionicons name="radio-outline" size={32} color="#444444" />
                <Text style={styles.emptyText}>
                  Signal details not loaded
                </Text>
              </View>
            ) : (
              clusterSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="git-branch-outline" size={18} color={ORACLE_COLORS.observe} />
              <Text style={styles.actionText}>Orient</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="archive-outline" size={18} color="#888888" />
              <Text style={[styles.actionText, { color: '#888888' }]}>Archive</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mainContent: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  clusterLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
  },
  countBadge: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  countText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  theme: {
    fontSize: 12,
    color: '#AAAAAA',
    lineHeight: 18,
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    marginRight: 16,
  },
  metricLabel: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 2,
  },
  metricBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metricBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  summarySection: {
    marginBottom: 16,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  signalsSection: {
    marginBottom: 16,
  },
  emptySignals: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: ORACLE_COLORS.observe,
    marginLeft: 6,
  },
});
