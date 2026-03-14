import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Types for environment state
export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendarId: string;
}

export interface CalendarState {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
  details: any;
}

export interface BatteryState {
  level: number | null;
  isCharging: boolean;
  isLowPowerMode: boolean;
}

export interface AppStateInfo {
  current: AppStateStatus;
  isActive: boolean;
  isBackground: boolean;
  lastActiveTime: number | null;
}

export interface EnvironmentContext {
  location: LocationState;
  calendar: CalendarState;
  network: NetworkState;
  battery: BatteryState;
  appState: AppStateInfo;
  lastUpdated: number;
}

// ==========================================
// useLocation Hook
// ==========================================

export function useLocation(options?: {
  enableHighAccuracy?: boolean;
  watchPosition?: boolean;
  updateInterval?: number;
}): LocationState & { refreshLocation: () => Promise<void> } {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    isLoading: true,
    error: null,
    hasPermission: false,
  });

  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  const getLocation = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Location permission denied',
          hasPermission: false,
        }));
        return;
      }

      setState(prev => ({ ...prev, hasPermission: true }));

      const location = await Location.getCurrentPositionAsync({
        accuracy: options?.enableHighAccuracy
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,
      });

      setState(prev => ({
        ...prev,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get location',
      }));
    }
  }, [options?.enableHighAccuracy]);

  useEffect(() => {
    getLocation();

    if (options?.watchPosition) {
      const startWatching = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          watchSubscription.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: options.updateInterval || 30000,
              distanceInterval: 50,
            },
            (location) => {
              setState(prev => ({
                ...prev,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp,
              }));
            }
          );
        }
      };
      startWatching();
    }

    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }
    };
  }, [getLocation, options?.watchPosition, options?.updateInterval]);

  return { ...state, refreshLocation: getLocation };
}

// ==========================================
// useCalendarEvents Hook
// ==========================================

export function useCalendarEvents(options?: {
  daysAhead?: number;
  daysBehind?: number;
}): CalendarState & { refreshEvents: () => Promise<void> } {
  const [state, setState] = useState<CalendarState>({
    events: [],
    isLoading: true,
    error: null,
    hasPermission: false,
  });

  const fetchEvents = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Calendar permission denied',
          hasPermission: false,
        }));
        return;
      }

      setState(prev => ({ ...prev, hasPermission: true }));

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendarIds = calendars.map(cal => cal.id);

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - (options?.daysBehind || 1));

      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + (options?.daysAhead || 7));

      const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

      const mappedEvents: CalendarEvent[] = events.map(event => ({
        id: event.id,
        title: event.title,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        location: event.location || undefined,
        notes: event.notes || undefined,
        calendarId: event.calendarId,
      }));

      setState(prev => ({
        ...prev,
        events: mappedEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch calendar events',
      }));
    }
  }, [options?.daysAhead, options?.daysBehind]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { ...state, refreshEvents: fetchEvents };
}

// ==========================================
// useNetworkState Hook
// ==========================================

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
    details: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netInfoState: NetInfoState) => {
      setState({
        isConnected: netInfoState.isConnected ?? false,
        isInternetReachable: netInfoState.isInternetReachable,
        type: netInfoState.type,
        isWifi: netInfoState.type === 'wifi',
        isCellular: netInfoState.type === 'cellular',
        details: netInfoState.details,
      });
    });

    // Initial fetch
    NetInfo.fetch().then((netInfoState: NetInfoState) => {
      setState({
        isConnected: netInfoState.isConnected ?? false,
        isInternetReachable: netInfoState.isInternetReachable,
        type: netInfoState.type,
        isWifi: netInfoState.type === 'wifi',
        isCellular: netInfoState.type === 'cellular',
        details: netInfoState.details,
      });
    });

    return () => unsubscribe();
  }, []);

  return state;
}

// ==========================================
// useAppState Hook
// ==========================================

export function useAppState(): AppStateInfo {
  const [appState, setAppState] = useState<AppStateInfo>({
    current: AppState.currentState,
    isActive: AppState.currentState === 'active',
    isBackground: AppState.currentState === 'background',
    lastActiveTime: AppState.currentState === 'active' ? Date.now() : null,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      setAppState(prev => ({
        current: nextAppState,
        isActive: nextAppState === 'active',
        isBackground: nextAppState === 'background',
        lastActiveTime: nextAppState === 'active' ? Date.now() : prev.lastActiveTime,
      }));
    });

    return () => subscription.remove();
  }, []);

  return appState;
}

// ==========================================
// useBatteryLevel Hook
// ==========================================

export function useBatteryLevel(): BatteryState {
  const [state, setState] = useState<BatteryState>({
    level: null,
    isCharging: false,
    isLowPowerMode: false,
  });

  useEffect(() => {
    let batteryLevelSubscription: Battery.Subscription | null = null;
    let batteryStateSubscription: Battery.Subscription | null = null;
    let lowPowerModeSubscription: Battery.Subscription | null = null;

    const initBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const batteryState = await Battery.getBatteryStateAsync();
        const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();

        setState({
          level: level * 100,
          isCharging: batteryState === Battery.BatteryState.CHARGING,
          isLowPowerMode,
        });

        batteryLevelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
          setState(prev => ({ ...prev, level: batteryLevel * 100 }));
        });

        batteryStateSubscription = Battery.addBatteryStateListener(({ batteryState: newState }) => {
          setState(prev => ({
            ...prev,
            isCharging: newState === Battery.BatteryState.CHARGING,
          }));
        });

        lowPowerModeSubscription = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
          setState(prev => ({ ...prev, isLowPowerMode: lowPowerMode }));
        });
      } catch (error) {
        console.warn('Battery API not available:', error);
      }
    };

    initBattery();

    return () => {
      batteryLevelSubscription?.remove();
      batteryStateSubscription?.remove();
      lowPowerModeSubscription?.remove();
    };
  }, []);

  return state;
}

// ==========================================
// useEnvironmentContext Hook (Combined)
// ==========================================

export function useEnvironmentContext(options?: {
  enableLocation?: boolean;
  enableCalendar?: boolean;
  enableNetwork?: boolean;
  enableBattery?: boolean;
  locationWatchPosition?: boolean;
  calendarDaysAhead?: number;
}): EnvironmentContext & { refresh: () => Promise<void> } {
  const opts = {
    enableLocation: true,
    enableCalendar: true,
    enableNetwork: true,
    enableBattery: true,
    locationWatchPosition: false,
    calendarDaysAhead: 7,
    ...options,
  };

  const location = useLocation({
    enableHighAccuracy: false,
    watchPosition: opts.locationWatchPosition,
  });

  const calendar = useCalendarEvents({
    daysAhead: opts.calendarDaysAhead,
    daysBehind: 1,
  });

  const network = useNetworkState();
  const battery = useBatteryLevel();
  const appStateInfo = useAppState();

  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const refresh = useCallback(async () => {
    const promises: Promise<void>[] = [];
    if (opts.enableLocation) promises.push(location.refreshLocation());
    if (opts.enableCalendar) promises.push(calendar.refreshEvents());
    await Promise.all(promises);
    setLastUpdated(Date.now());
  }, [opts.enableLocation, opts.enableCalendar, location, calendar]);

  const context: EnvironmentContext = {
    location: {
      latitude: opts.enableLocation ? location.latitude : null,
      longitude: opts.enableLocation ? location.longitude : null,
      accuracy: opts.enableLocation ? location.accuracy : null,
      timestamp: opts.enableLocation ? location.timestamp : null,
      isLoading: opts.enableLocation ? location.isLoading : false,
      error: opts.enableLocation ? location.error : null,
      hasPermission: opts.enableLocation ? location.hasPermission : false,
    },
    calendar: {
      events: opts.enableCalendar ? calendar.events : [],
      isLoading: opts.enableCalendar ? calendar.isLoading : false,
      error: opts.enableCalendar ? calendar.error : null,
      hasPermission: opts.enableCalendar ? calendar.hasPermission : false,
    },
    network: opts.enableNetwork
      ? network
      : { isConnected: true, isInternetReachable: true, type: 'unknown', isWifi: false, isCellular: false, details: null },
    battery: opts.enableBattery
      ? battery
      : { level: null, isCharging: false, isLowPowerMode: false },
    appState: appStateInfo,
    lastUpdated,
  };

  return { ...context, refresh };
}

// Export default combined hook
export default useEnvironmentContext;
