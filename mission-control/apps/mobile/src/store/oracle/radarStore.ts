/**
 * ORACLE Radar Store - OBSERVE Module
 * Story 6.1
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Signal,
  SignalCluster,
  SignalType,
  UrgencyLevel,
  SignalStatus,
} from '@mission-control/shared-types';

interface SignalFilters {
  status?: SignalStatus;
  signalType?: SignalType;
  urgency?: UrgencyLevel;
  search?: string;
}

interface RadarState {
  // State
  signals: Signal[];
  clusters: SignalCluster[];
  isScanning: boolean;
  lastScanAt: string | null;
  signalFilters: SignalFilters;
  scanError: string | null;

  // Actions
  scan: () => Promise<void>;
  dismissSignal: (signalId: string) => void;
  acknowledgeSignal: (signalId: string) => void;
  resolveSignal: (signalId: string) => void;
  updateFilters: (filters: Partial<SignalFilters>) => void;
  clearFilters: () => void;
  setSignals: (signals: Signal[]) => void;
  setClusters: (clusters: SignalCluster[]) => void;
  addSignal: (signal: Signal) => void;
  removeSignal: (signalId: string) => void;
  setScanError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  signals: [],
  clusters: [],
  isScanning: false,
  lastScanAt: null,
  signalFilters: {},
  scanError: null,
};

export const useRadarStore = create<RadarState>()(
  persist(
    (set, get) => ({
      ...initialState,

      scan: async () => {
        set({ isScanning: true, scanError: null });
        try {
          // In production, call API: POST /api/oracle/observe/scan
          // const response = await fetch('/api/oracle/observe/scan', { method: 'POST' });
          // const result = await response.json();

          // For now, just update timestamp
          set({
            isScanning: false,
            lastScanAt: new Date().toISOString(),
          });
        } catch (error) {
          set({
            isScanning: false,
            scanError: error instanceof Error ? error.message : 'Scan failed',
          });
        }
      },

      dismissSignal: (signalId) => {
        set((state) => ({
          signals: state.signals.map((s) =>
            s.id === signalId ? { ...s, status: 'dismissed' as SignalStatus } : s
          ),
        }));
      },

      acknowledgeSignal: (signalId) => {
        set((state) => ({
          signals: state.signals.map((s) =>
            s.id === signalId ? { ...s, status: 'acknowledged' as SignalStatus } : s
          ),
        }));
      },

      resolveSignal: (signalId) => {
        set((state) => ({
          signals: state.signals.map((s) =>
            s.id === signalId ? { ...s, status: 'resolved' as SignalStatus } : s
          ),
        }));
      },

      updateFilters: (filters) => {
        set((state) => ({
          signalFilters: { ...state.signalFilters, ...filters },
        }));
      },

      clearFilters: () => {
        set({ signalFilters: {} });
      },

      setSignals: (signals) => set({ signals }),

      setClusters: (clusters) => set({ clusters }),

      addSignal: (signal) => {
        set((state) => ({
          signals: [signal, ...state.signals],
        }));
      },

      removeSignal: (signalId) => {
        set((state) => ({
          signals: state.signals.filter((s) => s.id !== signalId),
        }));
      },

      setScanError: (error) => set({ scanError: error }),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-radar-storage',
      partialize: (state) => ({
        lastScanAt: state.lastScanAt,
        signalFilters: state.signalFilters,
      }),
    }
  )
);

// Selectors
export const useRadarSelectors = {
  activeSignals: () =>
    useRadarStore((state) =>
      state.signals.filter((s) => s.status === 'active')
    ),

  filteredSignals: () =>
    useRadarStore((state) => {
      const { signalFilters, signals } = state;
      return signals.filter((s) => {
        if (signalFilters.status && s.status !== signalFilters.status) return false;
        if (signalFilters.signalType && s.signal_type !== signalFilters.signalType) return false;
        if (signalFilters.urgency && s.urgency !== signalFilters.urgency) return false;
        if (signalFilters.search) {
          const search = signalFilters.search.toLowerCase();
          if (!s.title.toLowerCase().includes(search) &&
              !s.description?.toLowerCase().includes(search)) {
            return false;
          }
        }
        return true;
      });
    }),

  criticalSignals: () =>
    useRadarStore((state) =>
      state.signals.filter((s) => s.status === 'active' && s.urgency === 'critical')
    ),

  signalsByUrgency: () =>
    useRadarStore((state) => {
      const grouped: Record<UrgencyLevel, Signal[]> = {
        critical: [],
        high: [],
        medium: [],
        low: [],
      };
      state.signals
        .filter((s) => s.status === 'active')
        .forEach((s) => grouped[s.urgency].push(s));
      return grouped;
    }),

  signalCount: () =>
    useRadarStore((state) => ({
      total: state.signals.length,
      active: state.signals.filter((s) => s.status === 'active').length,
      critical: state.signals.filter((s) => s.status === 'active' && s.urgency === 'critical').length,
    })),
};
