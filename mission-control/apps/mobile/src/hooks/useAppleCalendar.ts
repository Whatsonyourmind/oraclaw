/**
 * ORACLE Apple Calendar Hook
 * Story int-2 - React hook for Apple Calendar integration
 *
 * Provides:
 * - Permission management
 * - Calendar and event fetching
 * - Event creation from execution plans
 * - Calendar selection preferences
 * - Background refresh control
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  appleCalendarService,
  AppleCalendar,
  AppleCalendarEvent,
  CalendarPermissionStatus,
  CalendarPreferences,
  BackgroundRefreshConfig,
} from '../services/integrations/appleCalendar';
import {
  SchedulingConflict,
  CreateEventParams,
  SyncResult,
  IntegrationStatus,
} from '../services/integrations/googleCalendar';
import { ExecutionPlan, ExecutionStep } from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface AppleCalendarState {
  status: IntegrationStatus;
  permissionStatus: CalendarPermissionStatus;
  isConnected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  calendars: AppleCalendar[];
  events: AppleCalendarEvent[];
  conflicts: SchedulingConflict[];
  preferences: CalendarPreferences;
  backgroundConfig: BackgroundRefreshConfig;
  lastSync: Date | null;
  error: string | null;
  isSupported: boolean;
}

export interface UseAppleCalendarReturn extends AppleCalendarState {
  // Permissions
  requestPermissions: () => Promise<CalendarPermissionStatus>;
  checkPermissions: () => Promise<CalendarPermissionStatus>;

  // Data fetching
  fetchCalendars: () => Promise<AppleCalendar[]>;
  fetchEvents: (startDate?: Date, endDate?: Date, calendarIds?: string[]) => Promise<AppleCalendarEvent[]>;
  sync: () => Promise<SyncResult>;

  // Calendar preferences
  setSelectedCalendars: (calendarIds: string[]) => Promise<void>;
  setDefaultCalendar: (calendarId: string) => Promise<void>;

  // Event operations
  createEvent: (params: CreateEventParams) => Promise<AppleCalendarEvent>;
  createEventsFromPlan: (plan: ExecutionPlan, steps: ExecutionStep[], calendarId?: string) => Promise<AppleCalendarEvent[]>;

  // Conflict detection
  detectConflicts: () => SchedulingConflict[];
  checkTimeSlotConflicts: (start: Date, end: Date) => AppleCalendarEvent[];
  findAvailableSlots: (date: Date, durationMinutes: number) => { start: Date; end: Date }[];

  // Background refresh
  enableBackgroundRefresh: (intervalMinutes?: number) => Promise<void>;
  disableBackgroundRefresh: () => Promise<void>;

  // Utilities
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAppleCalendar(): UseAppleCalendarReturn {
  const isSupported = Platform.OS === 'ios';

  const [state, setState] = useState<AppleCalendarState>({
    status: 'disconnected',
    permissionStatus: 'notDetermined',
    isConnected: false,
    isLoading: true,
    isSyncing: false,
    calendars: [],
    events: [],
    conflicts: [],
    preferences: appleCalendarService.getPreferences(),
    backgroundConfig: appleCalendarService.getBackgroundConfig(),
    lastSync: null,
    error: null,
    isSupported,
  });

  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (isSupported) {
      initializeConnection();
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Apple Calendar is only available on iOS',
      }));
    }

    return () => {
      mountedRef.current = false;
    };
  }, [isSupported]);

  const initializeConnection = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const permStatus = await appleCalendarService.getPermissionStatus();
      const lastSync = await appleCalendarService.getLastSyncTime();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          permissionStatus: permStatus,
          isConnected: permStatus === 'authorized',
          status: permStatus === 'authorized' ? 'connected' : 'disconnected',
          lastSync,
          isLoading: false,
        }));

        if (permStatus === 'authorized') {
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
  // Permissions
  // --------------------------------------------------------------------------

  const requestPermissions = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const status = await appleCalendarService.requestPermissions();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          permissionStatus: status,
          isConnected: status === 'authorized',
          status: status === 'authorized' ? 'connected' : 'disconnected',
          isLoading: false,
        }));

        if (status === 'authorized') {
          await syncData();
        }
      }

      return status;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to request permissions',
        }));
      }
      throw error;
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      const status = await appleCalendarService.getPermissionStatus();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          permissionStatus: status,
          isConnected: status === 'authorized',
          status: status === 'authorized' ? 'connected' : 'disconnected',
        }));
      }

      return status;
    } catch (error) {
      return 'notDetermined' as CalendarPermissionStatus;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------

  const syncData = useCallback(async () => {
    if (state.isSyncing) return;

    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await appleCalendarService.sync();

      if (mountedRef.current) {
        const conflicts = appleCalendarService.detectConflicts();

        setState(prev => ({
          ...prev,
          isSyncing: false,
          calendars: appleCalendarService.getCalendars(),
          events: appleCalendarService.getEvents(),
          conflicts,
          preferences: appleCalendarService.getPreferences(),
          backgroundConfig: appleCalendarService.getBackgroundConfig(),
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
      const calendars = await appleCalendarService.fetchCalendars();

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
    startDate?: Date,
    endDate?: Date,
    calendarIds?: string[]
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const events = await appleCalendarService.fetchEvents(startDate, endDate, calendarIds);
      const conflicts = appleCalendarService.detectConflicts(events);

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
  // Calendar Preferences
  // --------------------------------------------------------------------------

  const setSelectedCalendars = useCallback(async (calendarIds: string[]) => {
    try {
      await appleCalendarService.setSelectedCalendars(calendarIds);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          calendars: appleCalendarService.getCalendars(),
          preferences: appleCalendarService.getPreferences(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to update calendar selection',
        }));
      }
      throw error;
    }
  }, []);

  const setDefaultCalendar = useCallback(async (calendarId: string) => {
    try {
      await appleCalendarService.setDefaultCalendar(calendarId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          preferences: appleCalendarService.getPreferences(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to set default calendar',
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
      const event = await appleCalendarService.createEvent(params);
      const conflicts = appleCalendarService.detectConflicts();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          events: appleCalendarService.getEvents(),
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
      const events = await appleCalendarService.createEventsFromPlan(plan, steps, calendarId);
      const conflicts = appleCalendarService.detectConflicts();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          events: appleCalendarService.getEvents(),
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
    const conflicts = appleCalendarService.detectConflicts();
    setState(prev => ({ ...prev, conflicts }));
    return conflicts;
  }, []);

  const checkTimeSlotConflicts = useCallback((start: Date, end: Date) => {
    return appleCalendarService.checkTimeSlotConflicts(start, end);
  }, []);

  const findAvailableSlots = useCallback((date: Date, durationMinutes: number) => {
    return appleCalendarService.findAvailableSlots(date, durationMinutes);
  }, []);

  // --------------------------------------------------------------------------
  // Background Refresh
  // --------------------------------------------------------------------------

  const enableBackgroundRefresh = useCallback(async (intervalMinutes = 15) => {
    try {
      await appleCalendarService.enableBackgroundRefresh(intervalMinutes);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          backgroundConfig: appleCalendarService.getBackgroundConfig(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to enable background refresh',
        }));
      }
      throw error;
    }
  }, []);

  const disableBackgroundRefresh = useCallback(async () => {
    try {
      await appleCalendarService.disableBackgroundRefresh();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          backgroundConfig: appleCalendarService.getBackgroundConfig(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to disable background refresh',
        }));
      }
    }
  }, []);

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  const disconnect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await appleCalendarService.disconnect();

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
          preferences: appleCalendarService.getPreferences(),
          backgroundConfig: appleCalendarService.getBackgroundConfig(),
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

    // Permissions
    requestPermissions,
    checkPermissions,

    // Data fetching
    fetchCalendars,
    fetchEvents,
    sync: syncData,

    // Calendar preferences
    setSelectedCalendars,
    setDefaultCalendar,

    // Event operations
    createEvent,
    createEventsFromPlan,

    // Conflict detection
    detectConflicts,
    checkTimeSlotConflicts,
    findAvailableSlots,

    // Background refresh
    enableBackgroundRefresh,
    disableBackgroundRefresh,

    // Utilities
    disconnect,
    refresh,
    clearError,
  };
}

export default useAppleCalendar;
