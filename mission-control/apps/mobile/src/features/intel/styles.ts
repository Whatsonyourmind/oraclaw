import { StyleSheet } from 'react-native';
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  camera: {
    flex: 1,
  },

  // Permission styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  permissionText: {
    color: '#00FF88',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionSubtext: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#00FF88',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Scanning overlay
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  scanLine: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#00FF88',
    opacity: 0.8,
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: '30%',
    left: 20,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#00FF88',
  },
  cornerTopRight: {
    position: 'absolute',
    top: '30%',
    right: 20,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#00FF88',
  },
  cornerBottomLeft: {
    position: 'absolute',
    top: '50%',
    left: 20,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#00FF88',
  },
  cornerBottomRight: {
    position: 'absolute',
    top: '50%',
    right: 20,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#00FF88',
  },

  // Controls
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00FF88',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  captureButtonDisabled: {
    backgroundColor: '#333333',
    shadowOpacity: 0,
    elevation: 0,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00FF88',
  },

  // Mission indicator
  missionIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  missionText: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },

  // Intel overlay
  intelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  overlayField: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: 2,
    borderColor: '#00FF88',
    borderRadius: 4,
    padding: 4,
  },
  overlayText: {
    color: '#00FF88',
    fontSize: 10,
    fontWeight: 'bold',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Processing overlay
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#00FF88',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    letterSpacing: 1,
  },

  // Action buttons
  actionButton: {
    backgroundColor: '#00FF88',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    margin: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  actionButtonTextSecondary: {
    color: '#00FF88',
  },

  // Typography
  title: {
    color: '#00FF88',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },

  // Layout
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
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
  cardTitle: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },

  // Status indicators
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#00FF88',
  },
  statusPending: {
    backgroundColor: '#FFA500',
  },
  statusCompleted: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Intel Overlay additional styles
  imageContainer: { flex: 1, position: 'relative' as const },
  mockImage: { width: '100%' as any, height: '100%' as any, backgroundColor: '#1A1A1A' },
  intelSummary: { padding: 15, backgroundColor: '#1A1A1A', borderRadius: 8, margin: 10 },
  intelHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 10 },
  intelTitle: { color: '#00FF88', fontSize: 16, fontWeight: 'bold' as const },
  intelStats: { flexDirection: 'row' as const, gap: 15, marginBottom: 10 },
  statItem: { alignItems: 'center' as const },
  statNumber: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' as const },
  statLabel: { color: '#888888', fontSize: 11, marginTop: 2 },
  confidenceText: { color: '#00FF88', fontSize: 14, fontWeight: 'bold' as const },
  actionsSection: { padding: 15 },
  sectionTitle: { color: '#00FF88', fontSize: 14, fontWeight: 'bold' as const, letterSpacing: 1, marginBottom: 10 },
  actionsContainer: { gap: 8 },
  actionButtonLowConfidence: { opacity: 0.6 },
  overlayControls: { flexDirection: 'row' as const, justifyContent: 'space-around' as const, padding: 15, borderTopWidth: 1, borderTopColor: '#333333' },
  controlButton: { alignItems: 'center' as const, padding: 10 },
  controlButtonText: { color: '#FFFFFF', fontSize: 12, marginTop: 4 },
  confidenceWarning: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, padding: 10, backgroundColor: 'rgba(255, 165, 0, 0.1)', borderRadius: 6, margin: 10 },
  confidenceWarningText: { color: '#FFA500', fontSize: 12, flex: 1 },
});