/**
 * ORACLE Theme Constants
 * Story 9.1 - Phase-specific styling for the OODA loop
 */
import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// ORACLE Phase Colors
export const ORACLE_COLORS = {
  observe: '#00BFFF', // Electric blue - scanning
  orient: '#FFD700', // Gold - thinking
  decide: '#FF6B6B', // Coral - decision point
  act: '#00FF88', // Matrix green - executing
  idle: '#808080', // Gray - idle
} as const;

// Phase-specific gradients (for LinearGradient components)
export const ORACLE_GRADIENTS = {
  observe: ['#00BFFF', '#0099CC', '#006699'],
  orient: ['#FFD700', '#FFA500', '#CC8400'],
  decide: ['#FF6B6B', '#FF4444', '#CC3333'],
  act: ['#00FF88', '#00CC6A', '#009950'],
  idle: ['#808080', '#666666', '#4D4D4D'],
} as const;

// Animation timing constants
export const ORACLE_TIMING = {
  phaseTransition: 500, // ms for phase color transitions
  radarScan: 2000, // ms for full radar sweep
  pulseLoop: 1500, // ms for pulse animations
  fadeIn: 300, // ms for fade in animations
  fadeOut: 200, // ms for fade out animations
  stagger: 100, // ms stagger between list item animations
  blipAppear: 400, // ms for signal blip appearance
} as const;

// Shared ORACLE styles
export const oracleStyles = StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  // Headers
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },

  // Phase indicator
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  phaseText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Cards
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardContent: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },

  // Badges
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  urgencyHigh: {
    backgroundColor: '#FF4444',
  },
  urgencyMedium: {
    backgroundColor: '#FFA500',
  },
  urgencyLow: {
    backgroundColor: '#00FF88',
  },

  // Confidence indicator
  confidenceBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },

  // Buttons
  primaryButton: {
    backgroundColor: '#00FF88',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Lists
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listItemSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888888',
    marginTop: 12,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 12,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Radar specific
  radarContainer: {
    width: width - 40,
    height: width - 40,
    borderRadius: (width - 40) / 2,
    backgroundColor: 'rgba(0, 191, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(0, 191, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 20,
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(0, 191, 255, 0.2)',
  },
  radarScanLine: {
    position: 'absolute',
    width: 2,
    height: '50%',
    backgroundColor: ORACLE_COLORS.observe,
    bottom: '50%',
    transformOrigin: 'center bottom',
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
});

// Helper function to get phase color
export const getPhaseColor = (phase: string): string => {
  return ORACLE_COLORS[phase as keyof typeof ORACLE_COLORS] || ORACLE_COLORS.idle;
};

// Helper function to get urgency color
export const getUrgencyColor = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
    case 'high':
      return '#FF4444';
    case 'medium':
      return '#FFA500';
    case 'low':
    default:
      return '#00FF88';
  }
};

// Helper function to get impact color
export const getImpactColor = (impact: string): string => {
  switch (impact) {
    case 'high':
      return '#FF6B6B';
    case 'medium':
      return '#FFD700';
    case 'low':
    default:
      return '#00BFFF';
  }
};
