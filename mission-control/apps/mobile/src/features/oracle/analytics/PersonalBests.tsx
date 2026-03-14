/**
 * ORACLE Personal Bests
 * Achievement tracking with records, progress, and celebration animations
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, {
  Circle,
  Path,
  G,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

// Types
interface PersonalBest {
  id: string;
  metricId: string;
  metricName: string;
  category: string;
  value: number;
  unit?: string;
  achievedAt: Date;
  previousBest?: number;
  improvementPercent?: number;
  celebrated: boolean;
}

interface CurrentProgress {
  metricId: string;
  metricName: string;
  currentValue: number;
  personalBest: number;
  progressPercent: number;
  remaining: number;
  unit?: string;
  trend: 'improving' | 'stable' | 'declining';
}

interface HistoricalRecord {
  date: Date;
  value: number;
  wasBest: boolean;
}

interface PersonalBestsProps {
  personalBests: PersonalBest[];
  currentProgress: CurrentProgress[];
  historicalRecords?: Record<string, HistoricalRecord[]>;
  onCelebrate?: (bestId: string) => void;
  onViewHistory?: (metricId: string) => void;
  onShareBest?: (best: PersonalBest) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Celebration Animation Component
const CelebrationAnimation: React.FC<{
  visible: boolean;
  onComplete: () => void;
  improvement?: number;
}> = ({ visible, onComplete, improvement }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotation: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Main animation
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 6,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(2000),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        scaleAnim.setValue(0);
        opacityAnim.setValue(0);
        onComplete();
      });

      // Confetti animation
      confettiAnims.forEach((anim, i) => {
        const angle = (i / confettiAnims.length) * Math.PI * 2;
        const distance = 150 + Math.random() * 100;

        Animated.parallel([
          Animated.timing(anim.x, {
            toValue: Math.cos(angle) * distance,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.y, {
            toValue: Math.sin(angle) * distance + 100,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotation, {
            toValue: Math.random() * 360,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(600),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          anim.x.setValue(0);
          anim.y.setValue(0);
          anim.rotation.setValue(0);
          anim.opacity.setValue(1);
        });
      });
    }
  }, [visible]);

  if (!visible) return null;

  const confettiColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.celebrationOverlay}>
        {/* Confetti */}
        {confettiAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.confetti,
              {
                backgroundColor: confettiColors[i % confettiColors.length],
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                  {
                    rotate: anim.rotation.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
                opacity: anim.opacity,
              },
            ]}
          />
        ))}

        {/* Main content */}
        <Animated.View
          style={[
            styles.celebrationCard,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <Text style={styles.celebrationEmoji}>Trophy</Text>
          <Text style={styles.celebrationTitle}>New Personal Best!</Text>
          {improvement && (
            <Text style={styles.celebrationImprovement}>
              +{improvement.toFixed(1)}% improvement
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// Progress Ring Component
const ProgressRing: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}> = ({ progress, size = 100, strokeWidth = 8, color = '#4F46E5', children }) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Animate display
    const steps = 50;
    const stepValue = progress / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += stepValue;
      if (current >= progress) {
        setCurrentProgress(progress);
        clearInterval(interval);
      } else {
        setCurrentProgress(current);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [progress]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (currentProgress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="progressGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.progressRingContent, { width: size, height: size }]}>
        {children}
      </View>
    </View>
  );
};

// Personal Best Card
const PersonalBestCard: React.FC<{
  best: PersonalBest;
  onCelebrate?: () => void;
  onViewHistory?: () => void;
  onShare?: () => void;
}> = ({ best, onCelebrate, onViewHistory, onShare }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onViewHistory?.();
  };

  const getCategoryColor = () => {
    const colors: Record<string, [string, string]> = {
      productivity: ['#4F46E5', '#7C3AED'],
      focus: ['#0891B2', '#0D9488'],
      goals: ['#16A34A', '#22C55E'],
      habits: ['#EA580C', '#F97316'],
      wellness: ['#DB2777', '#EC4899'],
    };
    return colors[best.category.toLowerCase()] || ['#6B7280', '#9CA3AF'];
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
      <Animated.View style={[styles.bestCard, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={getCategoryColor()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bestCardGradient}
        >
          {/* Trophy icon for new records */}
          {!best.celebrated && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}

          <View style={styles.bestHeader}>
            <View style={styles.bestIcon}>
              <Text style={styles.bestIconText}>Trophy</Text>
            </View>
            <View style={styles.bestInfo}>
              <Text style={styles.bestCategory}>{best.category.toUpperCase()}</Text>
              <Text style={styles.bestMetricName}>{best.metricName}</Text>
            </View>
          </View>

          <View style={styles.bestValueContainer}>
            <Text style={styles.bestValue}>
              {best.value.toLocaleString()}{best.unit}
            </Text>
            {best.previousBest && (
              <Text style={styles.previousBest}>
                Previous: {best.previousBest.toLocaleString()}{best.unit}
              </Text>
            )}
          </View>

          {best.improvementPercent && (
            <View style={styles.improvementBadge}>
              <Text style={styles.improvementText}>
                +{best.improvementPercent.toFixed(1)}% improvement
              </Text>
            </View>
          )}

          <View style={styles.bestFooter}>
            <Text style={styles.bestDate}>
              Achieved {formatDate(best.achievedAt)}
            </Text>
            <View style={styles.bestActions}>
              {!best.celebrated && onCelebrate && (
                <TouchableOpacity
                  style={styles.celebrateButton}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onCelebrate();
                  }}
                >
                  <Text style={styles.celebrateButtonText}>Celebrate</Text>
                </TouchableOpacity>
              )}
              {onShare && (
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onShare();
                  }}
                >
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Progress Card
const ProgressCard: React.FC<{
  progress: CurrentProgress;
  onPress?: () => void;
}> = ({ progress, onPress }) => {
  const getTrendColor = () => {
    switch (progress.trend) {
      case 'improving': return '#22C55E';
      case 'declining': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getTrendIcon = () => {
    switch (progress.trend) {
      case 'improving': return 'Up';
      case 'declining': return 'Down';
      default: return 'Stable';
    }
  };

  return (
    <TouchableOpacity
      style={styles.progressCard}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      activeOpacity={0.8}
    >
      <View style={styles.progressCardContent}>
        <ProgressRing
          progress={progress.progressPercent}
          size={80}
          strokeWidth={6}
          color={progress.progressPercent >= 90 ? '#22C55E' : '#4F46E5'}
        >
          <Text style={styles.progressPercent}>
            {Math.round(progress.progressPercent)}%
          </Text>
        </ProgressRing>

        <View style={styles.progressInfo}>
          <Text style={styles.progressMetricName}>{progress.metricName}</Text>
          <View style={styles.progressValues}>
            <Text style={styles.progressCurrent}>
              {progress.currentValue.toLocaleString()}{progress.unit}
            </Text>
            <Text style={styles.progressSlash}> / </Text>
            <Text style={styles.progressBest}>
              {progress.personalBest.toLocaleString()}{progress.unit}
            </Text>
          </View>
          <View style={styles.progressTrend}>
            <Text style={[styles.progressTrendIcon, { color: getTrendColor() }]}>
              {getTrendIcon()}
            </Text>
            <Text style={[styles.progressTrendText, { color: getTrendColor() }]}>
              {progress.remaining > 0
                ? `${progress.remaining.toLocaleString()}${progress.unit} to beat`
                : 'Personal Best!'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Historical Comparison Chart
const HistoricalChart: React.FC<{
  records: HistoricalRecord[];
  currentBest: number;
}> = ({ records, currentBest }) => {
  if (records.length === 0) return null;

  const maxValue = Math.max(...records.map(r => r.value), currentBest) * 1.1;
  const chartWidth = SCREEN_WIDTH - 80;
  const chartHeight = 120;
  const barWidth = (chartWidth / records.length) - 8;

  return (
    <View style={styles.historicalChart}>
      <Text style={styles.historicalTitle}>Historical Records</Text>
      <View style={styles.chartContainer}>
        {records.slice(-10).map((record, index) => {
          const height = (record.value / maxValue) * chartHeight;
          return (
            <View key={index} style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height,
                    backgroundColor: record.wasBest ? '#22C55E' : '#D1D5DB',
                  },
                ]}
              />
              <Text style={styles.barLabel}>
                {record.date.toLocaleDateString('en-US', { month: 'short' })}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.bestLine, { bottom: (currentBest / maxValue) * chartHeight + 30 }]}>
        <Text style={styles.bestLineLabel}>Best</Text>
      </View>
    </View>
  );
};

// Main Component
export const PersonalBests: React.FC<PersonalBestsProps> = ({
  personalBests,
  currentProgress,
  historicalRecords = {},
  onCelebrate,
  onViewHistory,
  onShareBest,
}) => {
  const [celebratingBest, setCelebratingBest] = useState<PersonalBest | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = [...new Set(personalBests.map(b => b.category))];

  // Filter bests by category
  const filteredBests = selectedCategory
    ? personalBests.filter(b => b.category === selectedCategory)
    : personalBests;

  // Recent bests (last 30 days)
  const recentBests = personalBests.filter(b => {
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 30);
    return b.achievedAt >= dayAgo;
  });

  const handleCelebrate = (best: PersonalBest) => {
    setCelebratingBest(best);
    onCelebrate?.(best.id);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Stats */}
        <View style={styles.statsHeader}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{personalBests.length}</Text>
            <Text style={styles.statLabel}>Total Records</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{recentBests.length}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{categories.length}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
        </View>

        {/* Progress to Beat */}
        {currentProgress.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Progress to Beat</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.progressScroll}
            >
              {currentProgress.map((prog) => (
                <ProgressCard
                  key={prog.metricId}
                  progress={prog}
                  onPress={() => onViewHistory?.(prog.metricId)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category Filter */}
        <View style={styles.categoryFilter}>
          <TouchableOpacity
            style={[
              styles.categoryChip,
              !selectedCategory && styles.categoryChipActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedCategory(null);
            }}
          >
            <Text
              style={[
                styles.categoryChipText,
                !selectedCategory && styles.categoryChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(category);
              }}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Personal Bests List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedCategory ? `${selectedCategory} Records` : 'All Personal Bests'}
          </Text>
          {filteredBests.map((best) => (
            <PersonalBestCard
              key={best.id}
              best={best}
              onCelebrate={() => handleCelebrate(best)}
              onViewHistory={() => onViewHistory?.(best.metricId)}
              onShare={() => onShareBest?.(best)}
            />
          ))}

          {filteredBests.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>Trophy</Text>
              <Text style={styles.emptyStateTitle}>No records yet</Text>
              <Text style={styles.emptyStateDescription}>
                Keep pushing yourself to set new personal bests!
              </Text>
            </View>
          )}
        </View>

        {/* Historical Chart */}
        {filteredBests.length > 0 && historicalRecords[filteredBests[0]?.metricId] && (
          <HistoricalChart
            records={historicalRecords[filteredBests[0].metricId]}
            currentBest={filteredBests[0].value}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Celebration Animation */}
      <CelebrationAnimation
        visible={celebratingBest !== null}
        onComplete={() => setCelebratingBest(null)}
        improvement={celebratingBest?.improvementPercent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },

  // Stats Header
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },

  // Progress Cards
  progressScroll: {
    paddingRight: 24,
  },
  progressCard: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressRingContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  progressInfo: {
    flex: 1,
    marginLeft: 16,
  },
  progressMetricName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  progressValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  progressCurrent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  progressSlash: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  progressBest: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrendIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  progressTrendText: {
    fontSize: 12,
  },

  // Category Filter
  categoryFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#374151',
    textTransform: 'capitalize',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Best Card
  bestCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  bestCardGradient: {
    padding: 20,
  },
  newBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bestIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bestIconText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  bestInfo: {},
  bestCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bestMetricName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bestValueContainer: {
    marginBottom: 12,
  },
  bestValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  previousBest: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  improvementBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    marginBottom: 16,
  },
  improvementText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  bestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  celebrateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
  },
  celebrateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  shareButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Historical Chart
  historicalChart: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  historicalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 20,
    position: 'relative',
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 8,
  },
  bestLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#22C55E',
    borderStyle: 'dashed',
  },
  bestLineLabel: {
    position: 'absolute',
    right: 0,
    top: -16,
    fontSize: 10,
    color: '#22C55E',
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Celebration Animation
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  celebrationImprovement: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22C55E',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },

  bottomSpacer: {
    height: 32,
  },
});

export default PersonalBests;
