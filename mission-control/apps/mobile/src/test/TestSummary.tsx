import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';

interface TestSummaryProps {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageTime: number;
  onRerun: () => void;
  onDetails: () => void;
}

export const TestSummary: React.FC<TestSummaryProps> = ({
  totalTests,
  passedTests,
  failedTests,
  averageTime,
  onRerun,
  onDetails,
}) => {
  const successRate = Math.round((passedTests / totalTests) * 100);
  const grade = successRate >= 90 ? 'A+' : successRate >= 80 ? 'A' : successRate >= 70 ? 'B' : 'C';

  const getGradeColor = () => {
    if (grade === 'A+' || grade === 'A') return '#00FF88';
    if (grade === 'B') return '#FFA500';
    return '#FF4444';
  };

  const getPerformanceMessage = () => {
    if (successRate >= 90) return 'Excellent! Mission-ready UI/UX';
    if (successRate >= 80) return 'Good! Minor optimizations needed';
    if (successRate >= 70) return 'Fair! Several improvements required';
    return 'Needs work! Major issues detected';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={32} color="#00FF88" />
        <Text style={styles.title}>TEST SUITE COMPLETE</Text>
      </View>

      {/* Grade Display */}
      <View style={styles.gradeContainer}>
        <View style={[styles.gradeBadge, { backgroundColor: getGradeColor() }]}>
          <Text style={styles.gradeText}>{grade}</Text>
        </View>
        <Text style={styles.gradeLabel}>OVERALL GRADE</Text>
        <Text style={styles.performanceMessage}>{getPerformanceMessage()}</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color="#00FF88" />
          <Text style={styles.statNumber}>{passedTests}</Text>
          <Text style={styles.statLabel}>PASSED</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="close-circle" size={24} color="#FF4444" />
          <Text style={styles.statNumber}>{failedTests}</Text>
          <Text style={styles.statLabel}>FAILED</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="percent-outline" size={24} color="#FFA500" />
          <Text style={styles.statNumber}>{successRate}%</Text>
          <Text style={styles.statLabel}>SUCCESS</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#00FF88" />
          <Text style={styles.statNumber}>{averageTime}ms</Text>
          <Text style={styles.statLabel}>AVG TIME</Text>
        </View>
      </View>

      {/* Performance Breakdown */}
      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>PERFORMANCE BREAKDOWN</Text>
        
        <View style={styles.breakdownItem}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownCategory}>Core Flows</Text>
            <Text style={styles.breakdownScore}>100%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%', backgroundColor: '#00FF88' }]} />
          </View>
        </View>

        <View style={styles.breakdownItem}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownCategory}>WOW Moments</Text>
            <Text style={styles.breakdownScore}>{successRate}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${successRate}%`, backgroundColor: getGradeColor() }]} />
          </View>
        </View>

        <View style={styles.breakdownItem}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownCategory}>Performance</Text>
            <Text style={styles.breakdownScore}>{averageTime < 500 ? '100%' : '80%'}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: averageTime < 500 ? '100%' : '80%', backgroundColor: '#00FF88' }]} />
          </View>
        </View>
      </View>

      {/* Recommendations */}
      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>RECOMMENDATIONS</Text>
        
        {failedTests > 0 && (
          <View style={styles.recommendationItem}>
            <Ionicons name="warning-outline" size={16} color="#FFA500" />
            <Text style={styles.recommendationText}>
              Fix {failedTests} failing test{failedTests > 1 ? 's' : ''} before production
            </Text>
          </View>
        )}

        {averageTime > 500 && (
          <View style={styles.recommendationItem}>
            <Ionicons name="speedometer-outline" size={16} color="#FFA500" />
            <Text style={styles.recommendationText}>
              Optimize UI rendering for better performance
            </Text>
          </View>
        )}

        {successRate >= 90 && (
          <View style={styles.recommendationItem}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#00FF88" />
            <Text style={styles.recommendationText}>
              Excellent! Ready for user testing
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={onRerun}
        >
          <Ionicons name="refresh-outline" size={20} color="#000" />
          <Text style={styles.actionButtonTextPrimary}>RERUN TESTS</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={onDetails}
        >
          <Ionicons name="list-outline" size={20} color="#00FF88" />
          <Text style={styles.actionButtonTextSecondary}>VIEW DETAILS</Text>
        </TouchableOpacity>
      </View>

      {/* Mission Status */}
      <View style={styles.missionStatus}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#00FF88" />
        <Text style={styles.missionStatusText}>
          MISSION CONTROL UI/UX: {grade === 'A+' || grade === 'A' ? 'OPERATIONAL' : 'NEEDS OPTIMIZATION'}
        </Text>
      </View>
    </View>
  );
};