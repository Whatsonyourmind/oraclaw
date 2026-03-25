/**
 * RiskOpportunityMatrix Component
 * Story 7.6 - 2x2 matrix visualization for risks and opportunities
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RiskOpportunityAssessment } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width } = Dimensions.get('window');
const MATRIX_SIZE = width - 64;
const QUADRANT_SIZE = MATRIX_SIZE / 2;

interface RiskOpportunityMatrixProps {
  assessments: RiskOpportunityAssessment[];
  onItemPress?: (assessment: RiskOpportunityAssessment) => void;
}

interface QuadrantItem {
  assessment: RiskOpportunityAssessment;
  position: { x: number; y: number };
}

export const RiskOpportunityMatrix: React.FC<RiskOpportunityMatrixProps> = ({
  assessments,
  onItemPress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedItem, setSelectedItem] = useState<RiskOpportunityAssessment | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();
  }, []);

  // Position items in quadrants based on type and impact
  const getQuadrantItems = (): {
    highRisk: QuadrantItem[];
    lowRisk: QuadrantItem[];
    highOpp: QuadrantItem[];
    lowOpp: QuadrantItem[];
  } => {
    const highRisk: QuadrantItem[] = [];
    const lowRisk: QuadrantItem[] = [];
    const highOpp: QuadrantItem[] = [];
    const lowOpp: QuadrantItem[] = [];

    assessments.forEach((assessment, index) => {
      const isRisk = assessment.assessment_type === 'risk';
      const isHighImpact = assessment.impact_level === 'high' || assessment.impact_level === 'critical';

      // Calculate position within quadrant with some randomness for visual interest
      const offset = (index % 4) * 15;
      const position = {
        x: 20 + offset,
        y: 20 + (index % 3) * 20,
      };

      const item = { assessment, position };

      if (isRisk) {
        if (isHighImpact) {
          highRisk.push(item);
        } else {
          lowRisk.push(item);
        }
      } else {
        if (isHighImpact) {
          highOpp.push(item);
        } else {
          lowOpp.push(item);
        }
      }
    });

    return { highRisk, lowRisk, highOpp, lowOpp };
  };

  const quadrants = getQuadrantItems();

  const handleItemPress = (assessment: RiskOpportunityAssessment) => {
    setSelectedItem(assessment);
    onItemPress?.(assessment);
  };

  const renderQuadrantItem = (item: QuadrantItem, index: number) => {
    const isRisk = item.assessment.assessment_type === 'risk';
    const color = isRisk ? '#FF6B6B' : '#00FF88';

    return (
      <TouchableOpacity
        key={item.assessment.id || index}
        style={[
          styles.matrixItem,
          {
            left: item.position.x,
            top: item.position.y,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
        onPress={() => handleItemPress(item.assessment)}
      >
        <Ionicons
          name={isRisk ? 'warning' : 'sunny'}
          size={12}
          color="#000000"
        />
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>RISK / OPPORTUNITY MATRIX</Text>

      {/* Matrix Grid */}
      <View style={styles.matrixContainer}>
        {/* Y-Axis Label */}
        <View style={styles.yAxisLabel}>
          <Text style={styles.axisLabelText}>IMPACT</Text>
        </View>

        <View style={styles.matrix}>
          {/* Top Row - High Impact */}
          <View style={styles.matrixRow}>
            {/* High Impact / Risk */}
            <View style={[styles.quadrant, styles.quadrantTopLeft]}>
              <Text style={styles.quadrantLabel}>HIGH RISK</Text>
              {quadrants.highRisk.map(renderQuadrantItem)}
              {quadrants.highRisk.length === 0 && (
                <Text style={styles.emptyQuadrant}>No items</Text>
              )}
            </View>

            {/* High Impact / Opportunity */}
            <View style={[styles.quadrant, styles.quadrantTopRight]}>
              <Text style={styles.quadrantLabel}>HIGH OPPORTUNITY</Text>
              {quadrants.highOpp.map(renderQuadrantItem)}
              {quadrants.highOpp.length === 0 && (
                <Text style={styles.emptyQuadrant}>No items</Text>
              )}
            </View>
          </View>

          {/* Bottom Row - Low Impact */}
          <View style={styles.matrixRow}>
            {/* Low Impact / Risk */}
            <View style={[styles.quadrant, styles.quadrantBottomLeft]}>
              <Text style={styles.quadrantLabel}>LOW RISK</Text>
              {quadrants.lowRisk.map(renderQuadrantItem)}
              {quadrants.lowRisk.length === 0 && (
                <Text style={styles.emptyQuadrant}>No items</Text>
              )}
            </View>

            {/* Low Impact / Opportunity */}
            <View style={[styles.quadrant, styles.quadrantBottomRight]}>
              <Text style={styles.quadrantLabel}>LOW OPPORTUNITY</Text>
              {quadrants.lowOpp.map(renderQuadrantItem)}
              {quadrants.lowOpp.length === 0 && (
                <Text style={styles.emptyQuadrant}>No items</Text>
              )}
            </View>
          </View>
        </View>

        {/* X-Axis Label */}
        <View style={styles.xAxisContainer}>
          <Text style={styles.xAxisLeft}>RISK</Text>
          <Text style={styles.axisLabelText}>TYPE</Text>
          <Text style={styles.xAxisRight}>OPPORTUNITY</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
          <Text style={styles.legendText}>
            Risk ({quadrants.highRisk.length + quadrants.lowRisk.length})
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00FF88' }]} />
          <Text style={styles.legendText}>
            Opportunity ({quadrants.highOpp.length + quadrants.lowOpp.length})
          </Text>
        </View>
      </View>

      {/* Detail Modal */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedItem(null)}
        >
          <View style={styles.modalContent}>
            {selectedItem && (
              <>
                <View style={styles.modalHeader}>
                  <Ionicons
                    name={selectedItem.assessment_type === 'risk' ? 'warning' : 'sunny'}
                    size={24}
                    color={selectedItem.assessment_type === 'risk' ? '#FF6B6B' : '#00FF88'}
                  />
                  <Text style={styles.modalTitle}>{selectedItem.title}</Text>
                  <TouchableOpacity onPress={() => setSelectedItem(null)}>
                    <Ionicons name="close" size={24} color="#888888" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.modalBadges}>
                    <View
                      style={[
                        styles.modalBadge,
                        {
                          backgroundColor:
                            selectedItem.assessment_type === 'risk' ? '#FF6B6B' : '#00FF88',
                        },
                      ]}
                    >
                      <Text style={styles.modalBadgeText}>
                        {selectedItem.assessment_type?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                    <View style={[styles.modalBadge, { backgroundColor: ORACLE_COLORS.orient }]}>
                      <Text style={styles.modalBadgeText}>
                        {selectedItem.impact_level?.toUpperCase() || 'MEDIUM'} IMPACT
                      </Text>
                    </View>
                  </View>

                  {selectedItem.description && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>DESCRIPTION</Text>
                      <Text style={styles.modalSectionText}>
                        {selectedItem.description}
                      </Text>
                    </View>
                  )}

                  {selectedItem.likelihood && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>LIKELIHOOD</Text>
                      <View style={styles.likelihoodBar}>
                        <View
                          style={[
                            styles.likelihoodFill,
                            { width: `${selectedItem.likelihood * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.likelihoodText}>
                        {Math.round(selectedItem.likelihood * 100)}%
                      </Text>
                    </View>
                  )}

                  {selectedItem.mitigations && selectedItem.mitigations.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>MITIGATIONS</Text>
                      {selectedItem.mitigations.map((mitigation, index) => (
                        <View key={index} style={styles.mitigationItem}>
                          <Ionicons name="shield-checkmark" size={14} color={ORACLE_COLORS.orient} />
                          <Text style={styles.mitigationText}>{typeof mitigation === 'string' ? mitigation : mitigation.action}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  matrixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisLabel: {
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  axisLabelText: {
    fontSize: 9,
    color: '#666666',
    fontWeight: '600',
    letterSpacing: 1,
    transform: [{ rotate: '-90deg' }],
  },
  matrix: {
    flex: 1,
  },
  matrixRow: {
    flexDirection: 'row',
  },
  quadrant: {
    width: QUADRANT_SIZE,
    height: QUADRANT_SIZE,
    padding: 8,
    position: 'relative',
  },
  quadrantTopLeft: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderTopLeftRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  quadrantTopRight: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  quadrantBottomLeft: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  quadrantBottomRight: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  quadrantLabel: {
    fontSize: 8,
    color: '#666666',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emptyQuadrant: {
    fontSize: 10,
    color: '#444444',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -6 }],
  },
  matrixItem: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  xAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 20,
  },
  xAxisLeft: {
    fontSize: 9,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  xAxisRight: {
    fontSize: 9,
    color: '#00FF88',
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#888888',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  modalBody: {
    padding: 16,
  },
  modalBadges: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modalSectionText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  likelihoodBar: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  likelihoodFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.orient,
    borderRadius: 3,
  },
  likelihoodText: {
    fontSize: 12,
    color: ORACLE_COLORS.orient,
    fontWeight: 'bold',
  },
  mitigationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  mitigationText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginLeft: 8,
  },
});
