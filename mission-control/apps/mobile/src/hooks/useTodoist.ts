/**
 * ORACLE Todoist Hook
 * Story int-3 - React hook for Todoist integration
 *
 * Provides:
 * - OAuth2 flow management
 * - Task and project fetching
 * - Import tasks as signals
 * - Export steps as tasks
 * - Two-way completion sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import {
  todoistService,
  TodoistTask,
  TodoistProject,
  TodoistSection,
  TodoistLabel,
  TodoistSyncConfig,
  ProjectMapping,
  CreateTaskParams,
} from '../services/integrations/todoist';
import { IntegrationStatus, SyncResult } from '../services/integrations/googleCalendar';
import { Signal, ExecutionPlan, ExecutionStep } from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface TodoistState {
  status: IntegrationStatus;
  isConnected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  projects: TodoistProject[];
  sections: TodoistSection[];
  labels: TodoistLabel[];
  tasks: TodoistTask[];
  syncConfig: TodoistSyncConfig;
  lastSync: Date | null;
  error: string | null;
}

export interface UseTodoistReturn extends TodoistState {
  // Authentication
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Data fetching
  fetchProjects: () => Promise<TodoistProject[]>;
  fetchSections: (projectId?: string) => Promise<TodoistSection[]>;
  fetchLabels: () => Promise<TodoistLabel[]>;
  fetchTasks: (projectId?: string, filter?: string) => Promise<TodoistTask[]>;
  sync: () => Promise<SyncResult>;

  // Task operations
  createTask: (params: CreateTaskParams) => Promise<TodoistTask>;
  completeTask: (taskId: string) => Promise<void>;
  reopenTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Signal/Step sync
  importTasksAsSignals: (projectId?: string) => Promise<Partial<Signal>[]>;
  exportStepsToTasks: (plan: ExecutionPlan, steps: ExecutionStep[], projectId?: string) => Promise<TodoistTask[]>;
  syncCompletionStatus: (stepId: string, taskId: string, completed: boolean) => Promise<void>;

  // Project mapping
  setProjectMapping: (mapping: ProjectMapping) => Promise<void>;
  removeProjectMapping: (projectId: string) => Promise<void>;
  setDefaultProjects: (importProject?: string, exportProject?: string) => Promise<void>;

  // Utilities
  refresh: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useTodoist(): UseTodoistReturn {
  const [state, setState] = useState<TodoistState>({
    status: 'disconnected',
    isConnected: false,
    isLoading: true,
    isSyncing: false,
    projects: [],
    sections: [],
    labels: [],
    tasks: [],
    syncConfig: todoistService.getSyncConfig(),
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
      const isConnected = todoistService.isConnected();
      const lastSync = await todoistService.getLastSyncTime();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected,
          status: isConnected ? 'connected' : 'disconnected',
          lastSync,
          isLoading: false,
        }));

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
      const state = Math.random().toString(36).substring(2, 15);
      const authUrl = todoistService.getAuthorizationUrl(state);

      const supported = await Linking.canOpenURL(authUrl);
      if (!supported) {
        throw new Error('Cannot open authorization URL');
      }

      await Linking.openURL(authUrl);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          status: 'disconnected',
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
      await todoistService.exchangeCodeForTokens(code);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          status: 'connected',
          isLoading: false,
        }));

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
      await todoistService.disconnect();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          status: 'disconnected',
          projects: [],
          sections: [],
          labels: [],
          tasks: [],
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
      const result = await todoistService.sync();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          projects: todoistService.getProjects(),
          sections: todoistService.getSections(),
          labels: todoistService.getLabels(),
          tasks: todoistService.getTasks(),
          syncConfig: todoistService.getSyncConfig(),
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

  const fetchProjects = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const projects = await todoistService.fetchProjects();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          projects,
          isLoading: false,
        }));
      }

      return projects;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch projects',
        }));
      }
      throw error;
    }
  }, []);

  const fetchSections = useCallback(async (projectId?: string) => {
    try {
      const sections = await todoistService.fetchSections(projectId);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, sections }));
      }

      return sections;
    } catch (error) {
      throw error;
    }
  }, []);

  const fetchLabels = useCallback(async () => {
    try {
      const labels = await todoistService.fetchLabels();

      if (mountedRef.current) {
        setState(prev => ({ ...prev, labels }));
      }

      return labels;
    } catch (error) {
      throw error;
    }
  }, []);

  const fetchTasks = useCallback(async (projectId?: string, filter?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tasks = await todoistService.fetchTasks(projectId, filter);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks,
          isLoading: false,
        }));
      }

      return tasks;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch tasks',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Task Operations
  // --------------------------------------------------------------------------

  const createTask = useCallback(async (params: CreateTaskParams) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const task = await todoistService.createTask(params);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
          isLoading: false,
        }));
      }

      return task;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create task',
        }));
      }
      throw error;
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    try {
      await todoistService.completeTask(taskId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to complete task',
        }));
      }
      throw error;
    }
  }, []);

  const reopenTask = useCallback(async (taskId: string) => {
    try {
      await todoistService.reopenTask(taskId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to reopen task',
        }));
      }
      throw error;
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await todoistService.deleteTask(taskId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to delete task',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Signal/Step Sync
  // --------------------------------------------------------------------------

  const importTasksAsSignals = useCallback(async (projectId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const signals = await todoistService.importTasksAsSignals(projectId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
          isLoading: false,
        }));
      }

      return signals;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to import tasks',
        }));
      }
      throw error;
    }
  }, []);

  const exportStepsToTasks = useCallback(async (
    plan: ExecutionPlan,
    steps: ExecutionStep[],
    projectId?: string
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tasks = await todoistService.exportStepsToTasks(plan, steps, projectId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
          isLoading: false,
        }));
      }

      return tasks;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to export steps',
        }));
      }
      throw error;
    }
  }, []);

  const syncCompletionStatus = useCallback(async (
    stepId: string,
    taskId: string,
    completed: boolean
  ) => {
    try {
      await todoistService.syncCompletionStatus(stepId, taskId, completed);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          tasks: todoistService.getTasks(),
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to sync completion',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Project Mapping
  // --------------------------------------------------------------------------

  const setProjectMapping = useCallback(async (mapping: ProjectMapping) => {
    try {
      await todoistService.setProjectMapping(mapping);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: todoistService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const removeProjectMapping = useCallback(async (projectId: string) => {
    try {
      await todoistService.removeProjectMapping(projectId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: todoistService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const setDefaultProjects = useCallback(async (importProject?: string, exportProject?: string) => {
    try {
      await todoistService.setDefaultProjects(importProject, exportProject);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: todoistService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
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
    fetchProjects,
    fetchSections,
    fetchLabels,
    fetchTasks,
    sync: syncData,

    // Task operations
    createTask,
    completeTask,
    reopenTask,
    deleteTask,

    // Signal/Step sync
    importTasksAsSignals,
    exportStepsToTasks,
    syncCompletionStatus,

    // Project mapping
    setProjectMapping,
    removeProjectMapping,
    setDefaultProjects,

    // Utilities
    refresh,
    clearError,
  };
}

// ============================================================================
// DEEP LINK HANDLER
// ============================================================================

export function useTodoistAuthCallback(
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const { url } = event;

      if (!url.includes('oauth2callback/todoist')) return;

      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
          console.error('[Todoist] OAuth error:', error);
          onError?.(error);
          return;
        }

        if (code) {
          await todoistService.exchangeCodeForTokens(code);
          onSuccess?.();
        }
      } catch (err) {
        console.error('[Todoist] Failed to handle callback:', err);
        onError?.(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    return () => {
      subscription.remove();
    };
  }, [onSuccess, onError]);
}

export default useTodoist;
