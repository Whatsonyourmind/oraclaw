import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Signal, Decision, ExecutionStep, GhostAction } from '@mission-control/shared-types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Reconnection settings
const RECONNECT_DELAY_BASE = 1000; // 1 second
const RECONNECT_DELAY_MAX = 30000; // 30 seconds
const RECONNECT_DELAY_MULTIPLIER = 1.5;

// ============================================================================
// TYPES
// ============================================================================

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeEvent<T> {
  eventType: RealtimeEventType;
  new: T | null;
  old: T | null;
  timestamp: number;
}

export interface RealtimeState<T> {
  isSubscribed: boolean;
  connectionStatus: RealtimeConnectionStatus;
  lastEvent: RealtimeEvent<T> | null;
  error: string | null;
  reconnectAttempts: number;
}

export interface UseRealtimeOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

// ============================================================================
// SUPABASE CLIENT SINGLETON
// ============================================================================

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase URL and Anon Key are required for realtime subscriptions');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseClient;
}

// ============================================================================
// CONNECTION STATUS MANAGEMENT
// ============================================================================

export interface ConnectionState {
  status: RealtimeConnectionStatus;
  isOnline: boolean;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
}

let globalConnectionState: ConnectionState = {
  status: 'disconnected',
  isOnline: true,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
};

const connectionListeners: Set<(state: ConnectionState) => void> = new Set();

function updateConnectionState(updates: Partial<ConnectionState>) {
  globalConnectionState = { ...globalConnectionState, ...updates };
  connectionListeners.forEach(listener => listener(globalConnectionState));
}

export function useRealtimeConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(globalConnectionState);

  useEffect(() => {
    const listener = (newState: ConnectionState) => setState(newState);
    connectionListeners.add(listener);
    return () => { connectionListeners.delete(listener); };
  }, []);

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(netState => {
      const isOnline = netState.isConnected ?? false;
      if (globalConnectionState.isOnline !== isOnline) {
        updateConnectionState({
          isOnline,
          status: isOnline ? globalConnectionState.status : 'disconnected',
        });
      }
    });
    return () => unsubscribe();
  }, []);

  return state;
}

// ============================================================================
// BASE REALTIME HOOK
// ============================================================================

function useRealtimeBase<T>(
  tableName: string,
  userId: string | undefined,
  options: UseRealtimeOptions = {}
): RealtimeState<T> & {
  subscribe: () => void;
  unsubscribe: () => void;
} {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 10,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<RealtimeState<T>>({
    isSubscribed: false,
    connectionStatus: 'disconnected',
    lastEvent: null,
    error: null,
    reconnectAttempts: 0,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || !isMountedRef.current) return;
    if (state.reconnectAttempts >= maxReconnectAttempts) {
      setState(prev => ({
        ...prev,
        error: `Max reconnect attempts (${maxReconnectAttempts}) reached`,
        connectionStatus: 'error',
      }));
      onError?.(`Max reconnect attempts (${maxReconnectAttempts}) reached`);
      return;
    }

    const delay = Math.min(
      RECONNECT_DELAY_BASE * Math.pow(RECONNECT_DELAY_MULTIPLIER, state.reconnectAttempts),
      RECONNECT_DELAY_MAX
    );

    console.log(`[Realtime] Scheduling reconnect for ${tableName} in ${delay}ms (attempt ${state.reconnectAttempts + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
        subscribe();
      }
    }, delay);
  }, [autoReconnect, maxReconnectAttempts, state.reconnectAttempts, tableName, onError]);

  const subscribe = useCallback(() => {
    if (!userId) {
      setState(prev => ({ ...prev, error: 'User ID required for subscription' }));
      return;
    }

    try {
      const client = getSupabaseClient();
      const channelName = `oracle:${tableName}:${userId}`;

      // Unsubscribe existing channel if any
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
      }

      setState(prev => ({ ...prev, connectionStatus: 'connecting', error: null }));

      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `user_id=eq.${userId}`,
          },
          (payload: RealtimePostgresChangesPayload<T>) => {
            if (!isMountedRef.current) return;

            const event: RealtimeEvent<T> = {
              eventType: payload.eventType as RealtimeEventType,
              new: payload.new as T | null,
              old: payload.old as T | null,
              timestamp: Date.now(),
            };

            setState(prev => ({
              ...prev,
              lastEvent: event,
            }));
          }
        )
        .subscribe((status, err) => {
          if (!isMountedRef.current) return;

          if (status === 'SUBSCRIBED') {
            setState(prev => ({
              ...prev,
              isSubscribed: true,
              connectionStatus: 'connected',
              error: null,
              reconnectAttempts: 0,
            }));
            updateConnectionState({
              status: 'connected',
              lastConnectedAt: Date.now(),
            });
            onConnect?.();
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            const errorMsg = err?.message || 'Channel closed';
            setState(prev => ({
              ...prev,
              isSubscribed: false,
              connectionStatus: 'disconnected',
              error: errorMsg,
            }));
            updateConnectionState({
              status: 'disconnected',
              lastDisconnectedAt: Date.now(),
            });
            onDisconnect?.();
            scheduleReconnect();
          } else if (status === 'TIMED_OUT') {
            setState(prev => ({
              ...prev,
              connectionStatus: 'error',
              error: 'Connection timed out',
            }));
            onError?.('Connection timed out');
            scheduleReconnect();
          }
        });

      channelRef.current = channel;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to subscribe';
      setState(prev => ({
        ...prev,
        connectionStatus: 'error',
        error: errorMsg,
      }));
      onError?.(errorMsg);
      scheduleReconnect();
    }
  }, [userId, tableName, onConnect, onDisconnect, onError, scheduleReconnect]);

  const unsubscribe = useCallback(() => {
    clearReconnectTimeout();
    if (channelRef.current) {
      const client = getSupabaseClient();
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isSubscribed: false,
      connectionStatus: 'disconnected',
    }));
  }, [clearReconnectTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearReconnectTimeout();
      unsubscribe();
    };
  }, [unsubscribe, clearReconnectTimeout]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

// ============================================================================
// SIGNAL UPDATES HOOK
// ============================================================================

export interface SignalUpdateCallbacks {
  onSignalCreated?: (signal: Signal) => void;
  onSignalUpdated?: (signal: Signal, oldSignal: Signal | null) => void;
  onSignalDeleted?: (signalId: string) => void;
}

export function useSignalUpdates(
  userId: string | undefined,
  callbacks: SignalUpdateCallbacks = {},
  options: UseRealtimeOptions = {}
) {
  const realtimeState = useRealtimeBase<Signal>('oracle_signals', userId, options);

  // Process events and trigger callbacks
  useEffect(() => {
    if (!realtimeState.lastEvent) return;

    const { eventType, new: newSignal, old: oldSignal } = realtimeState.lastEvent;

    switch (eventType) {
      case 'INSERT':
        if (newSignal) callbacks.onSignalCreated?.(newSignal);
        break;
      case 'UPDATE':
        if (newSignal) callbacks.onSignalUpdated?.(newSignal, oldSignal);
        break;
      case 'DELETE':
        if (oldSignal?.id) callbacks.onSignalDeleted?.(oldSignal.id);
        break;
    }
  }, [realtimeState.lastEvent, callbacks]);

  // Auto-subscribe on mount
  useEffect(() => {
    if (userId) {
      realtimeState.subscribe();
    }
    return () => realtimeState.unsubscribe();
  }, [userId]);

  return realtimeState;
}

// ============================================================================
// DECISION UPDATES HOOK
// ============================================================================

export interface DecisionUpdateCallbacks {
  onDecisionCreated?: (decision: Decision) => void;
  onDecisionUpdated?: (decision: Decision, oldDecision: Decision | null) => void;
  onDecisionDeleted?: (decisionId: string) => void;
}

export function useDecisionUpdates(
  userId: string | undefined,
  callbacks: DecisionUpdateCallbacks = {},
  options: UseRealtimeOptions = {}
) {
  const realtimeState = useRealtimeBase<Decision>('oracle_decisions', userId, options);

  useEffect(() => {
    if (!realtimeState.lastEvent) return;

    const { eventType, new: newDecision, old: oldDecision } = realtimeState.lastEvent;

    switch (eventType) {
      case 'INSERT':
        if (newDecision) callbacks.onDecisionCreated?.(newDecision);
        break;
      case 'UPDATE':
        if (newDecision) callbacks.onDecisionUpdated?.(newDecision, oldDecision);
        break;
      case 'DELETE':
        if (oldDecision?.id) callbacks.onDecisionDeleted?.(oldDecision.id);
        break;
    }
  }, [realtimeState.lastEvent, callbacks]);

  useEffect(() => {
    if (userId) {
      realtimeState.subscribe();
    }
    return () => realtimeState.unsubscribe();
  }, [userId]);

  return realtimeState;
}

// ============================================================================
// EXECUTION STEP UPDATES HOOK
// ============================================================================

export interface StepUpdateCallbacks {
  onStepCreated?: (step: ExecutionStep) => void;
  onStepUpdated?: (step: ExecutionStep, oldStep: ExecutionStep | null) => void;
  onStepDeleted?: (stepId: string) => void;
}

export function useStepUpdates(
  userId: string | undefined,
  callbacks: StepUpdateCallbacks = {},
  options: UseRealtimeOptions = {}
) {
  // Note: oracle_execution_steps doesn't have user_id directly,
  // but through plan_id. For simplicity, we subscribe to all changes
  // and filter client-side, or use a DB function/view.
  // For now, we'll use a broader subscription pattern.
  const realtimeState = useRealtimeBase<ExecutionStep>('oracle_execution_steps', userId, {
    ...options,
    // Custom filter logic would be needed here in production
  });

  useEffect(() => {
    if (!realtimeState.lastEvent) return;

    const { eventType, new: newStep, old: oldStep } = realtimeState.lastEvent;

    switch (eventType) {
      case 'INSERT':
        if (newStep) callbacks.onStepCreated?.(newStep);
        break;
      case 'UPDATE':
        if (newStep) callbacks.onStepUpdated?.(newStep, oldStep);
        break;
      case 'DELETE':
        if (oldStep?.id) callbacks.onStepDeleted?.(oldStep.id);
        break;
    }
  }, [realtimeState.lastEvent, callbacks]);

  useEffect(() => {
    if (userId) {
      realtimeState.subscribe();
    }
    return () => realtimeState.unsubscribe();
  }, [userId]);

  return realtimeState;
}

// ============================================================================
// GHOST ACTION UPDATES HOOK
// ============================================================================

export interface GhostActionUpdateCallbacks {
  onGhostActionCreated?: (action: GhostAction) => void;
  onGhostActionUpdated?: (action: GhostAction, oldAction: GhostAction | null) => void;
  onGhostActionDeleted?: (actionId: string) => void;
  onGhostActionApproved?: (action: GhostAction) => void;
  onGhostActionExecuted?: (action: GhostAction) => void;
}

export function useGhostActionUpdates(
  userId: string | undefined,
  callbacks: GhostActionUpdateCallbacks = {},
  options: UseRealtimeOptions = {}
) {
  const realtimeState = useRealtimeBase<GhostAction>('oracle_ghost_actions', userId, options);

  useEffect(() => {
    if (!realtimeState.lastEvent) return;

    const { eventType, new: newAction, old: oldAction } = realtimeState.lastEvent;

    switch (eventType) {
      case 'INSERT':
        if (newAction) callbacks.onGhostActionCreated?.(newAction);
        break;
      case 'UPDATE':
        if (newAction) {
          callbacks.onGhostActionUpdated?.(newAction, oldAction);
          // Check for specific status changes
          if (oldAction?.status !== 'approved' && newAction.status === 'approved') {
            callbacks.onGhostActionApproved?.(newAction);
          }
          if (oldAction?.status !== 'executed' && newAction.status === 'executed') {
            callbacks.onGhostActionExecuted?.(newAction);
          }
        }
        break;
      case 'DELETE':
        if (oldAction?.id) callbacks.onGhostActionDeleted?.(oldAction.id);
        break;
    }
  }, [realtimeState.lastEvent, callbacks]);

  useEffect(() => {
    if (userId) {
      realtimeState.subscribe();
    }
    return () => realtimeState.unsubscribe();
  }, [userId]);

  return realtimeState;
}

// ============================================================================
// COMBINED ORACLE REALTIME HOOK
// ============================================================================

export interface OracleRealtimeState {
  signals: RealtimeState<Signal>;
  decisions: RealtimeState<Decision>;
  steps: RealtimeState<ExecutionStep>;
  ghostActions: RealtimeState<GhostAction>;
  connection: ConnectionState;
  subscribeAll: () => void;
  unsubscribeAll: () => void;
}

export interface OracleRealtimeCallbacks extends
  SignalUpdateCallbacks,
  DecisionUpdateCallbacks,
  StepUpdateCallbacks,
  GhostActionUpdateCallbacks {}

export function useOracleRealtime(
  userId: string | undefined,
  callbacks: OracleRealtimeCallbacks = {},
  options: UseRealtimeOptions = {}
): OracleRealtimeState {
  const signalState = useSignalUpdates(userId, {
    onSignalCreated: callbacks.onSignalCreated,
    onSignalUpdated: callbacks.onSignalUpdated,
    onSignalDeleted: callbacks.onSignalDeleted,
  }, options);

  const decisionState = useDecisionUpdates(userId, {
    onDecisionCreated: callbacks.onDecisionCreated,
    onDecisionUpdated: callbacks.onDecisionUpdated,
    onDecisionDeleted: callbacks.onDecisionDeleted,
  }, options);

  const stepState = useStepUpdates(userId, {
    onStepCreated: callbacks.onStepCreated,
    onStepUpdated: callbacks.onStepUpdated,
    onStepDeleted: callbacks.onStepDeleted,
  }, options);

  const ghostActionState = useGhostActionUpdates(userId, {
    onGhostActionCreated: callbacks.onGhostActionCreated,
    onGhostActionUpdated: callbacks.onGhostActionUpdated,
    onGhostActionDeleted: callbacks.onGhostActionDeleted,
    onGhostActionApproved: callbacks.onGhostActionApproved,
    onGhostActionExecuted: callbacks.onGhostActionExecuted,
  }, options);

  const connection = useRealtimeConnection();

  const subscribeAll = useCallback(() => {
    signalState.subscribe();
    decisionState.subscribe();
    stepState.subscribe();
    ghostActionState.subscribe();
  }, [signalState, decisionState, stepState, ghostActionState]);

  const unsubscribeAll = useCallback(() => {
    signalState.unsubscribe();
    decisionState.unsubscribe();
    stepState.unsubscribe();
    ghostActionState.unsubscribe();
  }, [signalState, decisionState, stepState, ghostActionState]);

  return {
    signals: signalState,
    decisions: decisionState,
    steps: stepState,
    ghostActions: ghostActionState,
    connection,
    subscribeAll,
    unsubscribeAll,
  };
}

// ============================================================================
// PRESENCE HOOK (for collaborative features)
// ============================================================================

export interface PresenceUser {
  id: string;
  name?: string;
  avatar?: string;
  lastSeen: number;
  isTyping?: boolean;
  cursorPosition?: { x: number; y: number };
}

export interface PresenceState {
  users: PresenceUser[];
  isConnected: boolean;
  error: string | null;
}

export function useDecisionPresence(
  decisionId: string | undefined,
  currentUser: { id: string; name?: string; avatar?: string } | undefined,
  options: {
    onUserJoined?: (user: PresenceUser) => void;
    onUserLeft?: (userId: string) => void;
    onUserUpdated?: (user: PresenceUser) => void;
  } = {}
): PresenceState & {
  setTyping: (isTyping: boolean) => void;
  setCursorPosition: (position: { x: number; y: number } | null) => void;
  leave: () => void;
} {
  const [state, setState] = useState<PresenceState>({
    users: [],
    isConnected: false,
    error: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  const setTyping = useCallback((isTyping: boolean) => {
    if (channelRef.current && currentUser) {
      channelRef.current.track({
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        lastSeen: Date.now(),
        isTyping,
      });
    }
  }, [currentUser]);

  const setCursorPosition = useCallback((position: { x: number; y: number } | null) => {
    if (channelRef.current && currentUser) {
      channelRef.current.track({
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        lastSeen: Date.now(),
        cursorPosition: position || undefined,
      });
    }
  }, [currentUser]);

  const leave = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.untrack();
      const client = getSupabaseClient();
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false, users: [] }));
  }, []);

  useEffect(() => {
    if (!decisionId || !currentUser) return;

    const client = getSupabaseClient();
    const channelName = `oracle:presence:${decisionId}`;

    const channel = client.channel(channelName, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: PresenceUser[] = [];

        Object.values(presenceState).forEach((presences: any[]) => {
          presences.forEach(presence => {
            users.push({
              id: presence.id,
              name: presence.name,
              avatar: presence.avatar,
              lastSeen: presence.lastSeen || Date.now(),
              isTyping: presence.isTyping,
              cursorPosition: presence.cursorPosition,
            });
          });
        });

        setState(prev => ({ ...prev, users }));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: any) => {
          options.onUserJoined?.({
            id: presence.id,
            name: presence.name,
            avatar: presence.avatar,
            lastSeen: Date.now(),
          });
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          options.onUserLeft?.(presence.id);
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            lastSeen: Date.now(),
          });
          setState(prev => ({ ...prev, isConnected: true, error: null }));
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            error: 'Presence channel closed',
          }));
        }
      });

    channelRef.current = channel;

    return () => {
      leave();
    };
  }, [decisionId, currentUser, options.onUserJoined, options.onUserLeft, leave]);

  return {
    ...state,
    setTyping,
    setCursorPosition,
    leave,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useOracleRealtime;
