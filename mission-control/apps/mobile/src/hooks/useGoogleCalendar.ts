/**
 * ORACLE Google Calendar Hook
 * Story int-1 - React hook for Google Calendar integration
 *
 * Provides:
 * - OAuth2 flow management
 * - Calendar and event fetching
 * - Event creation from execution plans
 * - Conflict detection
 * - Sync status tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import {
  googleCalendarService,
  Calendar,
  CalendarEvent,
  SchedulingConflict,
  CreateEventParams,
  SyncResult,
  IntegrationStatus,
} from '../services/integrations/googleCalendar';
import { ExecutionPlan, ExecutionStep } from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleCalendarState {
  status: IntegrationStatus;
  isConnected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  calendars: Calendar[];
  events: CalendarEvent[];
  conflicts: SchedulingConflict[];
  lastSync: Date | null;
  error: string | null;
}

export interface UseGoogleCalendarReturn extends GoogleCalendarState {
  // Authentication
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Data fetching
  fetchCalendars: () => Promise<Calendar[]>;
  fetchEvents: (calendarIds?: string[], timeMin?: Date, timeMax?: Date) => Promise<CalendarEvent[]>;
  sync: () => Promise<SyncResult>;

  // Event operations
  createEvent: (params: CreateEventParams) => Promise<CalendarEvent>;
  createEventsFromPlan: (plan: ExecutionPlan, steps: ExecutionStep[], calendarId?: string) => Promise<CalendarEvent[]>;

  // Conflict detection
  detectConflicts: () => SchedulingConflict[];
  checkTimeSlotConflicts: (start: Date, end: Date) => CalendarEvent[];
  findAvailableSlots: (date: Date, durationMinutes: number) => { start: Date; end: Date }[];

  // Utilities
  refresh: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useGoogleCalendar(): UseGoogleCalendarReturn {
  const [state, setState] = useState<GoogleCalendarState>({
    status: 'disconnected',
    isConnected: false,
    isLoading: true,
    isSyncing: false,
    calendars: [],
    events: [],
    conflicts: [],
    lastSync: null,
    error: null,
  });

  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    initializeConnection();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initializeConnection = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const isConnected = await googleCalendarService.isConnected();
      const lastSync = await googleCalendarService.getLastSyncTime();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected,
          status: isConnected ? 'connected' : 'disconnected',
          lastSync,
          isLoading: false,
        }));

        // If connected, fetch initial data
        if (isConnected) {
          await syncData();
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize',
        }));
      }
    } finally {
      initializingRef.current = false;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Generate a random state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15);

      // Get authorization URL
      const authUrl = googleCalendarService.getAuthorizationUrl(state);

      // Open the auth URL in the browser
      const supported = await Linking.canOpenURL(authUrl);
      if (!supported) {
        throw new Error('Cannot open authorization URL');
      }

      await Linking.openURL(authUrl);

      // Note: The actual token exchange happens when the app receives the
      // redirect callback with the authorization code. This is typically
      // handled by a deep link handler in the app's main navigation.

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          status: 'disconnected', // Will be updated when callback is received
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to connect',
        }));
      }
    }
  }, []);

  const handleAuthCallback = useCallback(async (code: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await googleCalendarService.exchangeCodeForTokens(code);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          status: 'connected',
          isLoading: false,
        }));

        // Sync initial data
        await syncData();
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to complete authentication',
        }));
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await googleCalendarService.disconnect();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          status: 'disconnected',
          calendars: [],
          events: [],
          conflicts: [],
          lastSync: null,
          isLoading: false,
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to disconnect',
        }));
      }
    }
  }, []);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------

  const syncData = useCallback(async () => {
    if (state.isSyncing) return;

    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await googleCalendarService.sync();

      if (mountedRef.current) {
        const conflicts = googleCalendarService.detectConflicts();

        setState(prev => ({
          ...prev,
          isSyncing: false,
          calendars: googleCalendarService.getCalendars(),
          events: googleCalendarService.getEvents(),
          conflicts,
          lastSync: result.last_sync,
          status: result.success ? 'connected' : 'error',
          error: result.error || null,
        }));
      }

      return result;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          status: 'error',
          error: error instanceof Error ? error.message : 'Sync failed',
        }));
      }
      throw error;
    }
  }, [state.isSyncing]);

  const fetchCalendars = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const calendars = await googleCalendarService.fetchCalendars();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          calendars,
          isLoading: false,
        }));
      }

      return calendars;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch calendars',
        }));
      }
      throw error;
    }
  }, []);

  const fetchEvents = useCallback(async (
    calendarIds?: string[],
    timeMin?: Date,
    timeMax?: Date
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const events = await googleCalendarService.fetchEvents(calendarIds, timeMin, timeMax);
      const conflicts = googleCalendarService.detectConflicts(events);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          events,
          conflicts,
          isLoading: false,
        }));
      }

      return events;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch events',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Event Operations
  // --------------------------------------------------------------------------

  const createEvent = useCallback(async (params: CreateEventParams) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const event = await googleCalendarService.createEvent(params);
      const conflicts = googleCalendarService.detectConflicts();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          events: googleCalendarService.getEvents(),
          conflicts,
          isLoading: false,
        }));
      }

      return event;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create event',
        }));
      }
      throw error;
    }
  }, []);

  const createEventsFromPlan = useCallback(async (
    plan: ExecutionPlan,
    steps: ExecutionStep[],
    calendarId?: string
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const events = await googleCalendarService.createEventsFromPlan(plan, steps, calendarId);
      const conflicts = googleCalendarService.detectConflicts();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          events: googleCalendarService.getEvents(),
          conflicts,
          isLoading: false,
        }));
      }

      return events;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create events from plan',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Conflict Detection
  // --------------------------------------------------------------------------

  const detectConflicts = useCallback(() => {
    const conflicts = googleCalendarService.detectConflicts();
    setState(prev => ({ ...prev, conflicts }));
    return conflicts;
  }, []);

  const checkTimeSlotConflicts = useCallback((start: Date, end: Date) => {
    return googleCalendarService.checkTimeSlotConflicts(start, end);
  }, []);

  const findAvailableSlots = useCallback((date: Date, durationMinutes: number) => {
    return googleCalendarService.findAvailableSlots(date, durationMinutes);
  }, []);

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    await syncData();
  }, [syncData]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    // State
    ...state,

    // Authentication
    connect,
    disconnect,

    // Data fetching
    fetchCalendars,
    fetchEvents,
    sync: syncData,

    // Event operations
    createEvent,
    createEventsFromPlan,

    // Conflict detection
    detectConflicts,
    checkTimeSlotConflicts,
    findAvailableSlots,

    // Utilities
    refresh,
    clearError,
  };
}

// ============================================================================
// DEEP LINK HANDLER HOOK
// ============================================================================

/**
 * Hook to handle OAuth callback deep links
 * Should be used at the app root level
 */
export function useGoogleCalendarAuthCallback(
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const { url } = event;

      // Check if this is our OAuth callback
      if (!url.includes('oauth2callback')) return;

      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
          console.error('[GoogleCalendar] OAuth error:', error);
          onError?.(error);
          return;
        }

        if (code) {
          await googleCalendarService.exchangeCodeForTokens(code);
          onSuccess?.();
        }
      } catch (err) {
        console.error('[GoogleCalendar] Failed to handle callback:', err);
        onError?.(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle URL that opened the app
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onSuccess, onError]);
}

export default useGoogleCalendar;
