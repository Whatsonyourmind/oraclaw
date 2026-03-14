import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 15,
  },
  title: {
    color: '#00FF88',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

  // Grade Display
  gradeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  gradeBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  gradeText: {
    color: '#000000',
    fontSize: 32,
    fontWeight: 'bold',
  },
  gradeLabel: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 8,
  },
  performanceMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
    gap: 15,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  statLabel: {
    color: '#888888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Performance Breakdown
  breakdownContainer: {
    marginBottom: 40,
  },
  breakdownTitle: {
    color: '#00FF88',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  breakdownItem: {
    marginBottom: 15,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownCategory: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  breakdownScore: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Recommendations
  recommendationsContainer: {
    marginBottom: 40,
  },
  recommendationsTitle: {
    color: '#00FF88',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 12,
  },
  recommendationText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    gap: 10,
  },
  actionButtonPrimary: {
    backgroundColor: '#00FF88',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  actionButtonTextPrimary: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtonTextSecondary: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Mission Status
  missionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00FF88',
    gap: 10,
  },
  missionStatusText: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});