import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Mission, Action, Briefing, Meeting } from '@mission-control/shared-types';

interface MissionState {
  // Current active mission
  currentMission: Mission | null;
  missions: Mission[];
  
  // Actions and intel
  currentActions: Action[];
  pendingExtractions: string[];
  
  // Briefings
  currentBriefing: Briefing | null;
  lastBriefingDate: string | null;
  
  // Meeting debriefs
  currentMeeting: Meeting | null;
  
  // UI State
  isOffline: boolean;
  isProcessing: boolean;
  
  // Actions
  setCurrentMission: (mission: Mission | null) => void;
  createMission: (title: string, priority?: string) => Mission;
  updateMission: (id: string, updates: Partial<Mission>) => void;
  
  addActions: (actions: Action[]) => void;
  updateAction: (id: string, updates: Partial<Action>) => void;
  
  setBriefing: (briefing: Briefing) => void;
  setMeeting: (meeting: Meeting) => void;
  
  setOfflineStatus: (isOffline: boolean) => void;
  setProcessingStatus: (isProcessing: boolean) => void;
  
  addPendingExtraction: (sourceId: string) => void;
  removePendingExtraction: (sourceId: string) => void;
  
  // Utility actions
  clearCurrentMission: () => void;
  resetStore: () => void;
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentMission: null,
      missions: [],
      currentActions: [],
      pendingExtractions: [],
      currentBriefing: null,
      lastBriefingDate: null,
      currentMeeting: null,
      isOffline: false,
      isProcessing: false,

      // Mission actions
      setCurrentMission: (mission) => set({ currentMission: mission }),

      createMission: (title, priority = 'medium') => {
        const newMission: Mission = {
          id: `mission_${Date.now()}`,
          user_id: 'current_user', // Would come from auth
          title,
          priority: priority as 'low' | 'medium' | 'high',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {},
        };

        set((state) => ({
          missions: [...state.missions, newMission],
          currentMission: newMission,
        }));

        return newMission;
      },

      updateMission: (id, updates) => set((state) => ({
        missions: state.missions.map((mission) =>
          mission.id === id 
            ? { ...mission, ...updates, updated_at: new Date().toISOString() }
            : mission
        ),
        currentMission: 
          state.currentMission?.id === id 
            ? { ...state.currentMission, ...updates, updated_at: new Date().toISOString() }
            : state.currentMission,
      })),

      // Action management
      addActions: (actions) => set((state) => ({
        currentActions: [...state.currentActions, ...actions],
      })),

      updateAction: (id, updates) => set((state) => ({
        currentActions: state.currentActions.map((action) =>
          action.id === id ? { ...action, ...updates } : action
        ),
      })),

      // Briefing
      setBriefing: (briefing) => set({
        currentBriefing: briefing,
        lastBriefingDate: new Date().toISOString().split('T')[0],
      }),

      // Meeting
      setMeeting: (meeting) => set({ currentMeeting: meeting }),

      // Status management
      setOfflineStatus: (isOffline) => set({ isOffline }),
      setProcessingStatus: (isProcessing) => set({ isProcessing }),

      // Extraction tracking
      addPendingExtraction: (sourceId) => set((state) => ({
        pendingExtractions: [...state.pendingExtractions, sourceId],
      })),

      removePendingExtraction: (sourceId) => set((state) => ({
        pendingExtractions: state.pendingExtractions.filter(id => id !== sourceId),
      })),

      // Utility actions
      clearCurrentMission: () => set({
        currentMission: null,
        currentActions: [],
        pendingExtractions: [],
      }),

      resetStore: () => set({
        currentMission: null,
        missions: [],
        currentActions: [],
        pendingExtractions: [],
        currentBriefing: null,
        lastBriefingDate: null,
        currentMeeting: null,
        isOffline: false,
        isProcessing: false,
      }),
    }),
    {
      name: 'mission-control-storage',
      partialize: (state) => ({
        missions: state.missions,
        currentMission: state.currentMission,
        lastBriefingDate: state.lastBriefingDate,
      }),
    }
  )
);

// Selectors for computed values
export const useMissionSelectors = {
  activeMissions: () => useMissionStore((state) => 
    state.missions.filter(m => m.status === 'active')
  ),
  
  completedMissions: () => useMissionStore((state) => 
    state.missions.filter(m => m.status === 'completed')
  ),
  
  pendingActions: () => useMissionStore((state) => 
    state.currentActions.filter(a => a.status === 'pending')
  ),
  
  highPriorityActions: () => useMissionStore((state) => 
    state.currentActions.filter(a => a.status === 'pending')
  ),
  
  hasCurrentMission: () => useMissionStore((state) => !!state.currentMission),
  
  currentMissionStats: () => useMissionStore((state) => ({
    totalActions: state.currentActions.length,
    pendingActions: state.currentActions.filter(a => a.status === 'pending').length,
    completedActions: state.currentActions.filter(a => a.status === 'completed').length,
    hasPendingExtractions: state.pendingExtractions.length > 0,
  })),
};

// Hooks for common operations
export const useMissionActions = () => {
  const store = useMissionStore();

  const completeAction = async (actionId: string) => {
    store.updateAction(actionId, { 
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  };

  const cancelAction = async (actionId: string) => {
    store.updateAction(actionId, { status: 'cancelled' });
  };

  const completeMission = async () => {
    if (store.currentMission) {
      store.updateMission(store.currentMission.id, { status: 'completed' });
      store.clearCurrentMission();
    }
  };

  const archiveMission = async (missionId: string) => {
    store.updateMission(missionId, { status: 'archived' });
  };

  return {
    completeAction,
    cancelAction,
    completeMission,
    archiveMission,
  };
};