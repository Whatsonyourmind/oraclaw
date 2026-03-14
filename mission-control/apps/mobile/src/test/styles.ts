import { StyleSheet } from 'react-native';
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    color: '#00FF88',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Current Test
  currentTestContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  currentTestLabel: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  currentTestName: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  loadingSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00FF88',
    borderTopColor: 'transparent',
    // Add animation in real implementation
  },

  // Controls
  controlsContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
    gap: 15,
  },
  testButton: {
    backgroundColor: '#00FF88',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    gap: 10,
  },
  testButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.6,
  },
  testButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  testButtonTextSecondary: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Categories
  categoriesContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
    gap: 15,
  },
  category: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  categoryTitle: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  categoryDescription: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 16,
  },

  // Results
  resultsContainer: {
    flex: 1,
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  resultsTitle: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsStats: {
    flexDirection: 'row',
    gap: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultsList: {
    paddingHorizontal: 20,
  },
  resultItem: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultTestName: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  resultDuration: {
    color: '#888888',
    fontSize: 12,
  },
  resultDetails: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  footerText: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footerSubtext: {
    color: '#666666',
    fontSize: 10,
    marginTop: 2,
  },
});