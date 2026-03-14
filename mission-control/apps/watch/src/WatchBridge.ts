/**
 * ORACLE Watch Bridge
 * Story watch-1 - Bridge communication between iPhone and Apple Watch
 */

import {
  watchEvents,
  sendMessage,
  sendMessageData,
  transferUserInfo,
  transferFile,
  updateApplicationContext,
  getReachability,
  getIsWatchAppInstalled,
  getIsPaired,
  getSessionState,
} from 'react-native-watch-connectivity';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export type WatchMessageType =
  | 'SYNC_STATE'
  | 'UPDATE_PHASE'
  | 'NEW_SIGNAL'
  | 'GHOST_ACTION'
  | 'STEP_UPDATE'
  | 'SCAN_REQUEST'
  | 'APPROVE_ACTION'
  | 'COMPLETE_STEP'
  | 'DISMISS_SIGNAL'
  | 'COMPLICATION_UPDATE'
  | 'SETTINGS_SYNC';

export interface WatchMessage {
  type: WatchMessageType;
  payload: any;
  timestamp: number;
  id: string;
}

export interface WatchState {
  isPaired: boolean;
  isReachable: boolean;
  isWatchAppInstalled: boolean;
  sessionState: string;
}

export interface OracleWatchData {
  currentPhase: 'observe' | 'orient' | 'decide' | 'act' | 'idle';
  phaseColor: string;
  topSignal: {
    id: string;
    title: string;
    urgency: 'critical' | 'high' | 'medium' | 'low';
  } | null;
  currentStep: {
    id: string;
    title: string;
    status: string;
    progress: number;
  } | null;
  pendingGhostActions: number;
  planProgress: number;
  lastUpdated: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
  idle: '#808080',
};

// ============================================================================
// WATCH BRIDGE CLASS
// ============================================================================

class OracleWatchBridge {
  private listeners: Map<string, Set<(message: WatchMessage) => void>> = new Map();
  private stateListeners: Set<(state: WatchState) => void> = new Set();
  private isInitialized: boolean = false;
  private currentState: WatchState = {
    isPaired: false,
    isReachable: false,
    isWatchAppInstalled: false,
    sessionState: 'notActivated',
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async initialize(): Promise<void> {
    if (Platform.OS !== 'ios') {
      console.log('[WatchBridge] Watch connectivity only available on iOS');
      return;
    }

    if (this.isInitialized) {
      return;
    }

    try {
      // Set up event listeners
      this.setupEventListeners();

      // Get initial state
      await this.refreshState();

      this.isInitialized = true;
      console.log('[WatchBridge] Initialized successfully', this.currentState);
    } catch (error) {
      console.error('[WatchBridge] Initialization failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Reachability changes
    watchEvents.on('reachability', (reachable: boolean) => {
      this.currentState.isReachable = reachable;
      this.notifyStateListeners();
      console.log('[WatchBridge] Reachability changed:', reachable);
    });

    // Session state changes
    watchEvents.on('session', (session: any) => {
      this.currentState.sessionState = session.state;
      this.notifyStateListeners();
      console.log('[WatchBridge] Session state changed:', session.state);
    });

    // Incoming messages from Watch
    watchEvents.on('message', (message: any) => {
      this.handleIncomingMessage(message);
    });

    // User info received
    watchEvents.on('user-info', (userInfo: any) => {
      console.log('[WatchBridge] User info received:', userInfo);
      // Handle user info (persistent data)
    });

    // File received
    watchEvents.on('file', (file: any) => {
      console.log('[WatchBridge] File received:', file);
    });

    // Application context updated
    watchEvents.on('application-context', (context: any) => {
      console.log('[WatchBridge] Application context updated:', context);
    });
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  async refreshState(): Promise<WatchState> {
    if (Platform.OS !== 'ios') {
      return this.currentState;
    }

    try {
      const [isPaired, isWatchAppInstalled, isReachable, sessionState] = await Promise.all([
        getIsPaired(),
        getIsWatchAppInstalled(),
        getReachability(),
        getSessionState(),
      ]);

      this.currentState = {
        isPaired,
        isWatchAppInstalled,
        isReachable,
        sessionState: sessionState?.state || 'notActivated',
      };

      this.notifyStateListeners();
      return this.currentState;
    } catch (error) {
      console.error('[WatchBridge] Failed to refresh state:', error);
      throw error;
    }
  }

  getState(): WatchState {
    return { ...this.currentState };
  }

  subscribeToState(listener: (state: WatchState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState); // Immediate callback with current state
    return () => this.stateListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    this.stateListeners.forEach(listener => listener(this.currentState));
  }

  // ==========================================
  // MESSAGE SENDING
  // ==========================================

  async sendToWatch(type: WatchMessageType, payload: any): Promise<any> {
    if (Platform.OS !== 'ios') {
      console.log('[WatchBridge] Watch messaging only available on iOS');
      return null;
    }

    if (!this.currentState.isReachable) {
      // Use user info for persistent delivery when watch is not reachable
      console.log('[WatchBridge] Watch not reachable, using user info');
      return this.sendUserInfo({ type, payload, timestamp: Date.now() });
    }

    const message: WatchMessage = {
      type,
      payload,
      timestamp: Date.now(),
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    try {
      const reply = await sendMessage(message);
      console.log('[WatchBridge] Message sent successfully:', type, reply);
      return reply;
    } catch (error) {
      console.error('[WatchBridge] Failed to send message:', error);
      // Fallback to user info
      return this.sendUserInfo({ type, payload, timestamp: Date.now() });
    }
  }

  async sendUserInfo(info: any): Promise<void> {
    if (Platform.OS !== 'ios') return;

    try {
      await transferUserInfo(info);
      console.log('[WatchBridge] User info sent successfully');
    } catch (error) {
      console.error('[WatchBridge] Failed to send user info:', error);
    }
  }

  async updateContext(context: OracleWatchData): Promise<void> {
    if (Platform.OS !== 'ios') return;

    try {
      await updateApplicationContext(context);
      console.log('[WatchBridge] Application context updated');
    } catch (error) {
      console.error('[WatchBridge] Failed to update context:', error);
    }
  }

  // ==========================================
  // MESSAGE RECEIVING
  // ==========================================

  private handleIncomingMessage(message: any): void {
    const watchMessage = message as WatchMessage;
    console.log('[WatchBridge] Received message:', watchMessage.type);

    const listeners = this.listeners.get(watchMessage.type);
    if (listeners) {
      listeners.forEach(listener => listener(watchMessage));
    }

    // Also notify "all" listeners
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => listener(watchMessage));
    }
  }

  subscribeToMessages(
    type: WatchMessageType | '*',
    listener: (message: WatchMessage) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  // ==========================================
  // ORACLE-SPECIFIC METHODS
  // ==========================================

  async syncOracleState(data: OracleWatchData): Promise<void> {
    // Update both context (persistent) and send message (immediate if reachable)
    await this.updateContext(data);
    await this.sendToWatch('SYNC_STATE', data);
  }

  async updatePhase(phase: OracleWatchData['currentPhase']): Promise<void> {
    await this.sendToWatch('UPDATE_PHASE', {
      phase,
      color: ORACLE_COLORS[phase],
    });
  }

  async notifyNewSignal(signal: OracleWatchData['topSignal']): Promise<void> {
    await this.sendToWatch('NEW_SIGNAL', signal);
  }

  async notifyGhostAction(action: {
    id: string;
    title: string;
    type: string;
    confidence: number;
  }): Promise<void> {
    await this.sendToWatch('GHOST_ACTION', action);
  }

  async notifyStepUpdate(step: OracleWatchData['currentStep']): Promise<void> {
    await this.sendToWatch('STEP_UPDATE', step);
  }

  async updateComplication(data: {
    phase: string;
    phaseColor: string;
    signalCount: number;
    topUrgency: string;
    planProgress: number;
    nextAction: string | null;
  }): Promise<void> {
    await this.sendToWatch('COMPLICATION_UPDATE', data);
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  cleanup(): void {
    this.listeners.clear();
    this.stateListeners.clear();
    this.isInitialized = false;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const watchBridge = new OracleWatchBridge();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useWatchConnectivity() {
  const [state, setState] = useState<WatchState>(watchBridge.getState());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await watchBridge.initialize();
        if (isMounted) setIsInitialized(true);
      } catch (error) {
        console.error('[useWatchConnectivity] Initialization failed:', error);
      }
    };

    init();

    const unsubscribe = watchBridge.subscribeToState(newState => {
      if (isMounted) setState(newState);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const sendToWatch = useCallback(
    (type: WatchMessageType, payload: any) => watchBridge.sendToWatch(type, payload),
    []
  );

  const syncOracleState = useCallback(
    (data: OracleWatchData) => watchBridge.syncOracleState(data),
    []
  );

  const subscribeToMessages = useCallback(
    (type: WatchMessageType | '*', listener: (message: WatchMessage) => void) =>
      watchBridge.subscribeToMessages(type, listener),
    []
  );

  return {
    ...state,
    isInitialized,
    sendToWatch,
    syncOracleState,
    subscribeToMessages,
    updatePhase: watchBridge.updatePhase.bind(watchBridge),
    notifyNewSignal: watchBridge.notifyNewSignal.bind(watchBridge),
    notifyGhostAction: watchBridge.notifyGhostAction.bind(watchBridge),
    notifyStepUpdate: watchBridge.notifyStepUpdate.bind(watchBridge),
    updateComplication: watchBridge.updateComplication.bind(watchBridge),
    refreshState: watchBridge.refreshState.bind(watchBridge),
  };
}

export default watchBridge;
