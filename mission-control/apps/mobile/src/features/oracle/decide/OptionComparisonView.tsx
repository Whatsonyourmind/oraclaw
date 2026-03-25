/**
 * OptionComparisonView Component
 * Story 7.8 - Side-by-side option comparison with pros/cons
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DecisionOption, SimulationResult } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width, height } = Dimensions.get('window');

interface OptionComparisonViewProps {
  options: DecisionOption[];
  simulations: SimulationResult[];
  onClose: () => void;
  onSelect: (option: DecisionOption) => void;
}

export const OptionComparisonView: React.FC<OptionComparisonViewProps> = ({
  options,
  simulations,
  onClose,
  onSelect,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ORACLE_TIMING.fadeOut,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: ORACLE_TIMING.fadeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getSimulation = (optionId: string): SimulationResult | undefined => {
    return simulations.find((s) => s.option_id === optionId);
  };

  const renderOptionColumn = (option: DecisionOption, index: number) => {
    const simulation = getSimulation(option.id);
    const isTopScorer = options.every((o) => (o.score || 0) <= (option.score || 0));

    return (
      <View key={option.id} style={styles.optionColumn}>
        {/* Header */}
        <View style={[styles.columnHeader, isTopScorer && styles.columnHeaderTop]}>
          <View style={styles.optionNumber}>
            <Text style={styles.optionNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.optionTitle} numberOfLines={2}>
            {option.title}
          </Text>
          {isTopScorer && (
            <View style={styles.topBadge}>
              <Ionicons name="trophy" size={14} color="#000000" />
            </View>
          )}
        </View>

        {/* Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={[styles.scoreValue, isTopScorer && styles.scoreValueTop]}>
            {option.score ? Math.round(option.score * 100) : '-'}
          </Text>
        </View>

        {/* Simulation Stats */}
        {simulation && (
          <View style={styles.simulationSection}>
            <Text style={styles.sectionLabel}>SIMULATION</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Mean</Text>
              <Text style={styles.statValue}>
                {simulation.mean?.toFixed(2) || '-'}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>P95</Text>
              <Text style={styles.statValue}>
                {simulation.percentiles?.p95?.toFixed(2) || '-'}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Risk</Text>
              <Text style={styles.statValue}>
                {simulation.percentiles?.p5?.toFixed(2) || '-'}
              </Text>
            </View>
          </View>
        )}

        {/* Pros */}
        <View style={styles.prosSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="add-circle" size={14} color="#00FF88" />
            <Text style={[styles.sectionLabel, { marginLeft: 4 }]}>PROS</Text>
          </View>
          {option.pros && option.pros.length > 0 ? (
            option.pros.slice(0, 3).map((pro, i) => (
              <Text key={i} style={styles.proItem} numberOfLines={2}>
                {typeof pro === 'string' ? pro : pro.point}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyText}>No pros listed</Text>
          )}
        </View>

        {/* Cons */}
        <View style={styles.consSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="remove-circle" size={14} color="#FF6B6B" />
            <Text style={[styles.sectionLabel, { marginLeft: 4 }]}>CONS</Text>
          </View>
          {option.cons && option.cons.length > 0 ? (
            option.cons.slice(0, 3).map((con, i) => (
              <Text key={i} style={styles.conItem} numberOfLines={2}>
                {typeof con === 'string' ? con : con.point}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyText}>No cons listed</Text>
          )}
        </View>

        {/* Select Button */}
        <TouchableOpacity
          style={[styles.selectButton, isTopScorer && styles.selectButtonTop]}
          onPress={() => onSelect(option)}
        >
          <Text style={styles.selectButtonText}>SELECT</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>COMPARE OPTIONS</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Comparison Grid */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {options.map((option, index) => renderOptionColumn(option, index))}
        </ScrollView>

        {/* Distribution Comparison */}
        {simulations.length >= 2 && (
          <View style={styles.distributionSection}>
            <Text style={styles.distributionTitle}>OUTCOME DISTRIBUTION</Text>
            <View style={styles.distributionChart}>
              {options.slice(0, 3).map((option, index) => {
                const simulation = getSimulation(option.id);
                if (!simulation) return null;

                const colors = ['#FF6B6B', '#00BFFF', '#00FF88'];
                const mean = simulation.mean || 0;
                const maxMean = Math.max(
                  ...simulations.map((s) => s.mean || 0)
                );
                const barHeight = maxMean > 0 ? (mean / maxMean) * 100 : 0;

                return (
                  <View key={option.id} style={styles.distributionBar}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${barHeight}%`,
                          backgroundColor: colors[index % colors.length],
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>Opt {index + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayTouch: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ORACLE_COLORS.decide,
    letterSpacing: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  optionColumn: {
    width: width * 0.7,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  columnHeaderTop: {
    borderBottomColor: ORACLE_COLORS.decide,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  optionNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  optionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  topBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ORACLE_COLORS.decide,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 10,
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scoreValueTop: {
    color: ORACLE_COLORS.decide,
  },
  simulationSection: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  prosSection: {
    marginBottom: 12,
  },
  consSection: {
    marginBottom: 16,
  },
  proItem: {
    fontSize: 12,
    color: '#00FF88',
    lineHeight: 18,
    marginBottom: 4,
  },
  conItem: {
    fontSize: 12,
    color: '#FF6B6B',
    lineHeight: 18,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#555555',
    fontStyle: 'italic',
  },
  selectButton: {
    backgroundColor: '#333333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonTop: {
    backgroundColor: ORACLE_COLORS.decide,
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  distributionSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  distributionTitle: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  distributionChart: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 80,
  },
  distributionBar: {
    width: 40,
    height: '100%',
    marginHorizontal: 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
  },
});
