/**
 * RadarScreen Component
 * Story 7.1 - Animated radar visualization for signal detection
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Signal, SignalType } from '@mission-control/shared-types';
import { useRadarStore, useRadarSelectors } from '../../../store/oracle';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles, getUrgencyColor } from '../theme';
import { SignalCard } from './SignalCard';
import { SignalClusterView } from './SignalClusterView';

const { width } = Dimensions.get('window');
const RADAR_SIZE = width - 80;
const RADAR_CENTER = RADAR_SIZE / 2;

const SIGNAL_TYPES: SignalType[] = [
  'calendar_conflict',
  'deadline_approaching',
  'pattern_anomaly',
  'opportunity_window',
  'resource_shortage',
  'stakeholder_signal',
  'external_event',
];

export const RadarScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const scanRotation = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [selectedTypes, setSelectedTypes] = useState<SignalType[]>([]);
  const [showClusters, setShowClusters] = useState(false);

  const {
    signals,
    clusters,
    isScanning,
    lastScanTime,
    startScan,
    setFilter,
  } = useRadarStore();

  const activeSignals = useRadarSelectors.activeSignals();
  const signalsByUrgency = useRadarSelectors.signalsByUrgency();

  // Radar scan animation
  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.timing(scanRotation, {
          toValue: 1,
          duration: ORACLE_TIMING.radarScan,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: ORACLE_TIMING.pulseLoop,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanRotation.stopAnimation();
      pulseAnim.stopAnimation();
    }
  }, [isScanning]);

  const handleScan = async () => {
    await startScan();
  };

  const toggleTypeFilter = (type: SignalType) => {
    const updated = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(updated);
    setFilter({ types: updated.length > 0 ? updated : undefined });
  };

  const scanRotationDeg = scanRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  // Position signal blips on radar
  const getBlipPosition = (signal: Signal, index: number) => {
    const angle = (index * 137.5 * Math.PI) / 180; // Golden angle for distribution
    const distance = (1 - signal.confidence) * (RADAR_CENTER - 20);
    return {
      left: RADAR_CENTER + Math.cos(angle) * distance - 6,
      top: RADAR_CENTER + Math.sin(angle) * distance - 6,
    };
  };

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[oracleStyles.header, { borderBottomColor: ORACLE_COLORS.observe }]}>
        <View>
          <Text style={[oracleStyles.headerTitle, { color: ORACLE_COLORS.observe }]}>
            RADAR
          </Text>
          <Text style={oracleStyles.headerSubtitle}>
            {lastScanTime
              ? `Last scan: ${new Date(lastScanTime).toLocaleTimeString()}`
              : 'No scans yet'}
          </Text>
        </View>
        <View style={[oracleStyles.phaseIndicator, { borderColor: ORACLE_COLORS.observe }]}>
          <View style={[oracleStyles.phaseDot, { backgroundColor: ORACLE_COLORS.observe }]} />
          <Text style={[oracleStyles.phaseText, { color: ORACLE_COLORS.observe }]}>
            OBSERVE
          </Text>
        </View>
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Radar Visualization */}
        <View style={styles.radarContainer}>
          {/* Radar rings */}
          {[0.25, 0.5, 0.75, 1].map((scale, i) => (
            <View
              key={i}
              style={[
                styles.radarRing,
                {
                  width: RADAR_SIZE * scale,
                  height: RADAR_SIZE * scale,
                  borderRadius: (RADAR_SIZE * scale) / 2,
                },
              ]}
            />
          ))}

          {/* Pulse effect */}
          <Animated.View
            style={[
              styles.radarPulse,
              {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
          />

          {/* Scan line */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ rotate: scanRotationDeg }],
              },
            ]}
          />

          {/* Signal blips */}
          {activeSignals.slice(0, 15).map((signal, index) => (
            <Animated.View
              key={signal.id}
              style={[
                styles.signalBlip,
                getBlipPosition(signal, index),
                {
                  backgroundColor: getUrgencyColor(signal.urgency),
                  shadowColor: getUrgencyColor(signal.urgency),
                },
              ]}
            />
          ))}

          {/* Center icon */}
          <View style={styles.radarCenter}>
            <Ionicons name="radio-outline" size={24} color={ORACLE_COLORS.observe} />
          </View>
        </View>

        {/* Scan Button */}
        <TouchableOpacity
          style={[
            styles.scanButton,
            isScanning && styles.scanButtonActive,
          ]}
          onPress={handleScan}
          disabled={isScanning}
        >
          <Ionicons
            name={isScanning ? 'sync' : 'scan-outline'}
            size={24}
            color="#000000"
          />
          <Text style={styles.scanButtonText}>
            {isScanning ? 'SCANNING...' : 'START SCAN'}
          </Text>
        </TouchableOpacity>

        {/* Filter Controls */}
        <View style={styles.filterSection}>
          <Text style={oracleStyles.sectionTitle}>SIGNAL FILTERS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SIGNAL_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  selectedTypes.includes(type) && styles.filterChipActive,
                ]}
                onPress={() => toggleTypeFilter(type)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTypes.includes(type) && styles.filterChipTextActive,
                  ]}
                >
                  {type.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Toggle between signals and clusters */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, !showClusters && styles.toggleButtonActive]}
            onPress={() => setShowClusters(false)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                !showClusters && styles.toggleButtonTextActive,
              ]}
            >
              SIGNALS ({activeSignals.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showClusters && styles.toggleButtonActive]}
            onPress={() => setShowClusters(true)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                showClusters && styles.toggleButtonTextActive,
              ]}
            >
              CLUSTERS ({clusters.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Signal List or Clusters */}
        {showClusters ? (
          <View style={styles.listSection}>
            {clusters.length === 0 ? (
              <View style={oracleStyles.emptyState}>
                <Ionicons name="layers-outline" size={48} color="#444444" />
                <Text style={oracleStyles.emptyStateText}>
                  No signal clusters detected
                </Text>
              </View>
            ) : (
              clusters.map((cluster) => (
                <SignalClusterView key={cluster.id} cluster={cluster} />
              ))
            )}
          </View>
        ) : (
          <View style={styles.listSection}>
            {activeSignals.length === 0 ? (
              <View style={oracleStyles.emptyState}>
                <Ionicons name="radio-outline" size={48} color="#444444" />
                <Text style={oracleStyles.emptyStateText}>
                  No signals detected. Start a scan to detect signals.
                </Text>
              </View>
            ) : (
              <>
                {signalsByUrgency.critical.length > 0 && (
                  <View style={styles.urgencySection}>
                    <Text style={[styles.urgencyLabel, { color: '#FF4444' }]}>
                      CRITICAL ({signalsByUrgency.critical.length})
                    </Text>
                    {signalsByUrgency.critical.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </View>
                )}
                {signalsByUrgency.high.length > 0 && (
                  <View style={styles.urgencySection}>
                    <Text style={[styles.urgencyLabel, { color: '#FFA500' }]}>
                      HIGH ({signalsByUrgency.high.length})
                    </Text>
                    {signalsByUrgency.high.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </View>
                )}
                {signalsByUrgency.medium.length > 0 && (
                  <View style={styles.urgencySection}>
                    <Text style={[styles.urgencyLabel, { color: '#FFD700' }]}>
                      MEDIUM ({signalsByUrgency.medium.length})
                    </Text>
                    {signalsByUrgency.medium.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </View>
                )}
                {signalsByUrgency.low.length > 0 && (
                  <View style={styles.urgencySection}>
                    <Text style={[styles.urgencyLabel, { color: '#00FF88' }]}>
                      LOW ({signalsByUrgency.low.length})
                    </Text>
                    {signalsByUrgency.low.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    backgroundColor: 'rgba(0, 191, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 20,
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(0, 191, 255, 0.2)',
  },
  radarPulse: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 2,
    borderColor: ORACLE_COLORS.observe,
  },
  scanLine: {
    position: 'absolute',
    width: 2,
    height: RADAR_SIZE / 2,
    backgroundColor: ORACLE_COLORS.observe,
    bottom: RADAR_SIZE / 2,
    shadowColor: ORACLE_COLORS.observe,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  signalBlip: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  radarCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 191, 255, 0.1)',
    borderWidth: 2,
    borderColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  scanButtonActive: {
    opacity: 0.7,
  },
  scanButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444444',
    marginRight: 8,
    backgroundColor: '#1A1A1A',
  },
  filterChipActive: {
    borderColor: ORACLE_COLORS.observe,
    backgroundColor: 'rgba(0, 191, 255, 0.1)',
  },
  filterChipText: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: ORACLE_COLORS.observe,
  },
  viewToggle: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
  },
  toggleButtonActive: {
    borderBottomColor: ORACLE_COLORS.observe,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
    letterSpacing: 1,
  },
  toggleButtonTextActive: {
    color: ORACLE_COLORS.observe,
  },
  listSection: {
    minHeight: 200,
  },
  urgencySection: {
    marginBottom: 16,
  },
  urgencyLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
});
