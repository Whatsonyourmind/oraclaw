/**
 * ORACLE Wear OS Bridge
 * Stories watch-5, watch-6 - Android Wear OS companion app support
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OODAPhase,
  OODA_COLORS,
  SignalUrgency,
  WatchSignal,
  WatchStep,
  WatchGhostAction,
  ComplicationData,
} from './types';

// ============================================================================
// NATIVE MODULE INTERFACE
// ============================================================================

// Note: This requires a native module implementation in Android
// The TypeScript here defines the interface for the bridge

interface WearOSNativeModule {
  // Connection
  isWearOSSupported(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  getConnectedNodes(): Promise<WearNode[]>;

  // Messages
  sendMessage(nodeId: string, path: string, data: string): Promise<boolean>;
  sendMessageToAllNodes(path: string, data: string): Promise<void>;

  // Data Layer
  putDataItem(path: string, data: string): Promise<void>;
  getDataItem(path: string): Promise<string | null>;
  deleteDataItem(path: string): Promise<void>;

  // Tiles
  requestTileUpdate(): Promise<void>;
}

// Mock native module for development
const MockWearOSModule: WearOSNativeModule = {
  isWearOSSupported: async () => Platform.OS === 'android',
  isConnected: async () => false,
  getConnectedNodes: async () => [],
  sendMessage: async () => false,
  sendMessageToAllNodes: async () => {},
  putDataItem: async () => {},
  getDataItem: async () => null,
  deleteDataItem: async () => {},
  requestTileUpdate: async () => {},
};

const WearOSNative: WearOSNativeModule =
  Platform.OS === 'android' && NativeModules.WearOSBridge
    ? NativeModules.WearOSBridge
    : MockWearOSModule;

// ============================================================================
// TYPES
// ============================================================================

export interface WearNode {
  id: string;
  displayName: string;
  isNearby: boolean;
}

export type WearMessagePath =
  | '/oracle/sync'
  | '/oracle/phase'
  | '/oracle/signal'
  | '/oracle/ghost'
  | '/oracle/step'
  | '/oracle/tile'
  | '/oracle/action';

export interface WearOSState {
  isSupported: boolean;
  isConnected: boolean;
  nodes: WearNode[];
}

// ============================================================================
// WEAR OS BRIDGE CLASS
// ============================================================================

class OracleWearOSBridge {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private stateListeners: Set<(state: WearOSState) => void> = new Set();
  private isInitialized: boolean = false;
  private currentState: WearOSState = {
    isSupported: false,
    isConnected: false,
    nodes: [],
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[WearOSBridge] Wear OS only available on Android');
      return;
    }

    if (this.isInitialized) {
      return;
    }

    try {
      // Check if Wear OS is supported
      this.currentState.isSupported = await WearOSNative.isWearOSSupported();

      if (!this.currentState.isSupported) {
        console.log('[WearOSBridge] Wear OS not supported on this device');
        return;
      }

      // Set up event listeners
      this.setupEventListeners();

      // Get initial state
      await this.refreshState();

      this.isInitialized = true;
      console.log('[WearOSBridge] Initialized successfully', this.currentState);
    } catch (error) {
      console.error('[WearOSBridge] Initialization failed:', error);
    }
  }

  private setupEventListeners(): void {
    if (NativeModules.WearOSBridge) {
      this.eventEmitter = new NativeEventEmitter(NativeModules.WearOSBridge);

      this.eventEmitter.addListener('onNodeConnected', (node: WearNode) => {
        console.log('[WearOSBridge] Node connected:', node);
        this.currentState.nodes = [...this.currentState.nodes, node];
        this.currentState.isConnected = true;
        this.notifyStateListeners();
      });

      this.eventEmitter.addListener('onNodeDisconnected', (nodeId: string) => {
        console.log('[WearOSBridge] Node disconnected:', nodeId);
        this.currentState.nodes = this.currentState.nodes.filter(n => n.id !== nodeId);
        this.currentState.isConnected = this.currentState.nodes.length > 0;
        this.notifyStateListeners();
      });

      this.eventEmitter.addListener('onMessageReceived', (event: { path: string; data: string; nodeId: string }) => {
        this.handleIncomingMessage(event.path as WearMessagePath, event.data, event.nodeId);
      });

      this.eventEmitter.addListener('onDataChanged', (event: { path: string; data: string }) => {
        console.log('[WearOSBridge] Data changed:', event.path);
        // Handle data layer changes
      });
    }
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  async refreshState(): Promise<WearOSState> {
    if (Platform.OS !== 'android' || !this.currentState.isSupported) {
      return this.currentState;
    }

    try {
      const [isConnected, nodes] = await Promise.all([
        WearOSNative.isConnected(),
        WearOSNative.getConnectedNodes(),
      ]);

      this.currentState = {
        ...this.currentState,
        isConnected,
        nodes,
      };

      this.notifyStateListeners();
      return this.currentState;
    } catch (error) {
      console.error('[WearOSBridge] Failed to refresh state:', error);
      return this.currentState;
    }
  }

  getState(): WearOSState {
    return { ...this.currentState };
  }

  subscribeToState(listener: (state: WearOSState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    this.stateListeners.forEach(listener => listener(this.currentState));
  }

  // ==========================================
  // MESSAGE SENDING
  // ==========================================

  async sendMessage(path: WearMessagePath, data: any): Promise<boolean> {
    if (!this.currentState.isConnected || this.currentState.nodes.length === 0) {
      console.log('[WearOSBridge] No connected nodes, using Data Layer');
      await this.putDataItem(path, data);
      return true;
    }

    try {
      const jsonData = JSON.stringify(data);
      await WearOSNative.sendMessageToAllNodes(path, jsonData);
      return true;
    } catch (error) {
      console.error('[WearOSBridge] Failed to send message:', error);
      // Fallback to Data Layer
      await this.putDataItem(path, data);
      return false;
    }
  }

  async putDataItem(path: string, data: any): Promise<void> {
    try {
      const jsonData = JSON.stringify({
        ...data,
        timestamp: Date.now(),
      });
      await WearOSNative.putDataItem(path, jsonData);
    } catch (error) {
      console.error('[WearOSBridge] Failed to put data item:', error);
    }
  }

  // ==========================================
  // MESSAGE RECEIVING
  // ==========================================

  private handleIncomingMessage(path: WearMessagePath, data: string, nodeId: string): void {
    try {
      const parsedData = JSON.parse(data);
      console.log('[WearOSBridge] Received message:', path, nodeId);

      const listeners = this.listeners.get(path);
      if (listeners) {
        listeners.forEach(listener => listener(parsedData));
      }
    } catch (error) {
      console.error('[WearOSBridge] Failed to parse message:', error);
    }
  }

  subscribeToMessages(path: WearMessagePath, listener: (data: any) => void): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path)!.add(listener);
    return () => this.listeners.get(path)?.delete(listener);
  }

  // ==========================================
  // ORACLE-SPECIFIC METHODS
  // ==========================================

  async syncOracleState(data: {
    phase: OODAPhase;
    signals: WatchSignal[];
    currentStep: WatchStep | null;
    ghostActions: WatchGhostAction[];
    planProgress: number;
  }): Promise<void> {
    await this.sendMessage('/oracle/sync', data);
    await this.requestTileUpdate();
  }

  async updatePhase(phase: OODAPhase): Promise<void> {
    await this.sendMessage('/oracle/phase', {
      phase,
      color: OODA_COLORS[phase],
    });
  }

  async notifySignal(signal: WatchSignal): Promise<void> {
    await this.sendMessage('/oracle/signal', signal);
  }

  async notifyGhostAction(action: WatchGhostAction): Promise<void> {
    await this.sendMessage('/oracle/ghost', action);
  }

  async notifyStepUpdate(step: WatchStep): Promise<void> {
    await this.sendMessage('/oracle/step', step);
  }

  // ==========================================
  // TILE UPDATES
  // ==========================================

  async requestTileUpdate(): Promise<void> {
    try {
      await WearOSNative.requestTileUpdate();
    } catch (error) {
      console.error('[WearOSBridge] Failed to request tile update:', error);
    }
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  cleanup(): void {
    this.listeners.clear();
    this.stateListeners.clear();
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('onNodeConnected');
      this.eventEmitter.removeAllListeners('onNodeDisconnected');
      this.eventEmitter.removeAllListeners('onMessageReceived');
      this.eventEmitter.removeAllListeners('onDataChanged');
    }
    this.isInitialized = false;
  }
}

// ============================================================================
// WEAR OS TILE DATA
// ============================================================================

export interface WearTileData {
  tileId: string;
  title: string;
  lastUpdated: number;
}

export interface OracleStatusTile extends WearTileData {
  tileId: 'oracle_status';
  phase: OODAPhase;
  phaseColor: string;
  systemConfidence: number;
}

export interface SignalsSummaryTile extends WearTileData {
  tileId: 'signals_summary';
  signalCount: number;
  criticalCount: number;
  topSignals: { title: string; urgency: SignalUrgency }[];
}

export interface CurrentStepTile extends WearTileData {
  tileId: 'current_step';
  step: WatchStep | null;
  planTitle: string | null;
  planProgress: number;
}

/**
 * Generate ORACLE Status Tile data
 */
export function generateStatusTile(
  phase: OODAPhase,
  confidence: number
): OracleStatusTile {
  return {
    tileId: 'oracle_status',
    title: 'ORACLE Status',
    phase,
    phaseColor: OODA_COLORS[phase],
    systemConfidence: confidence,
    lastUpdated: Date.now(),
  };
}

/**
 * Generate Signals Summary Tile data
 */
export function generateSignalsTile(
  signals: WatchSignal[]
): SignalsSummaryTile {
  const criticalCount = signals.filter(s => s.urgency === 'critical').length;
  const urgencyOrder: SignalUrgency[] = ['critical', 'high', 'medium', 'low'];
  const topSignals = [...signals]
    .sort((a, b) => urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency))
    .slice(0, 3)
    .map(s => ({ title: s.title, urgency: s.urgency }));

  return {
    tileId: 'signals_summary',
    title: 'Signals',
    signalCount: signals.length,
    criticalCount,
    topSignals,
    lastUpdated: Date.now(),
  };
}

/**
 * Generate Current Step Tile data
 */
export function generateStepTile(
  step: WatchStep | null,
  planTitle: string | null,
  planProgress: number
): CurrentStepTile {
  return {
    tileId: 'current_step',
    title: 'Current Step',
    step,
    planTitle,
    planProgress,
    lastUpdated: Date.now(),
  };
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const wearOSBridge = new OracleWearOSBridge();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useWearOSConnectivity() {
  const [state, setState] = useState<WearOSState>(wearOSBridge.getState());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await wearOSBridge.initialize();
        if (isMounted) setIsInitialized(true);
      } catch (error) {
        console.error('[useWearOSConnectivity] Initialization failed:', error);
      }
    };

    init();

    const unsubscribe = wearOSBridge.subscribeToState(newState => {
      if (isMounted) setState(newState);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const syncOracleState = useCallback(
    (data: Parameters<typeof wearOSBridge.syncOracleState>[0]) =>
      wearOSBridge.syncOracleState(data),
    []
  );

  const subscribeToMessages = useCallback(
    (path: WearMessagePath, listener: (data: any) => void) =>
      wearOSBridge.subscribeToMessages(path, listener),
    []
  );

  return {
    ...state,
    isInitialized,
    syncOracleState,
    subscribeToMessages,
    updatePhase: wearOSBridge.updatePhase.bind(wearOSBridge),
    notifySignal: wearOSBridge.notifySignal.bind(wearOSBridge),
    notifyGhostAction: wearOSBridge.notifyGhostAction.bind(wearOSBridge),
    notifyStepUpdate: wearOSBridge.notifyStepUpdate.bind(wearOSBridge),
    requestTileUpdate: wearOSBridge.requestTileUpdate.bind(wearOSBridge),
    refreshState: wearOSBridge.refreshState.bind(wearOSBridge),
  };
}

export default wearOSBridge;
