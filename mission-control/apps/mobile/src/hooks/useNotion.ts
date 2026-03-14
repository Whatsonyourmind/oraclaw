/**
 * ORACLE Notion Hook
 * Story int-4 - React hook for Notion integration
 *
 * Provides:
 * - OAuth2 flow management
 * - Search for context
 * - Create decision documents
 * - Link pages to decisions
 * - Database sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import {
  notionService,
  NotionPage,
  NotionDatabase,
  NotionBlock,
  NotionSearchResult,
  NotionSyncConfig,
  DatabaseMapping,
  CreatePageParams,
} from '../services/integrations/notion';
import { IntegrationStatus, SyncResult } from '../services/integrations/googleCalendar';
import { Decision } from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface NotionState {
  status: IntegrationStatus;
  isConnected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  databases: NotionDatabase[];
  pages: NotionPage[];
  syncConfig: NotionSyncConfig;
  workspaceId: string | null;
  workspaceName: string | null;
  lastSync: Date | null;
  error: string | null;
}

export interface UseNotionReturn extends NotionState {
  // Authentication
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Search
  search: (query: string, filter?: 'page' | 'database') => Promise<NotionSearchResult>;
  searchForContext: (keywords: string[]) => Promise<NotionPage[]>;

  // Page operations
  getPage: (pageId: string) => Promise<NotionPage>;
  getPageContent: (pageId: string) => Promise<NotionBlock[]>;
  createPage: (params: CreatePageParams) => Promise<NotionPage>;
  createDecisionDocument: (decision: Decision, databaseId?: string) => Promise<NotionPage>;

  // Database operations
  fetchDatabases: () => Promise<NotionDatabase[]>;
  queryDatabase: (databaseId: string, filter?: any, sorts?: any[]) => Promise<NotionPage[]>;

  // Linking
  linkPageToDecision: (pageId: string, decisionId: string) => Promise<void>;
  getLinkedPage: (oracleId: string) => Promise<NotionPage | null>;
  unlinkPage: (oracleId: string) => Promise<void>;

  // Database mapping
  setDatabaseMapping: (mapping: DatabaseMapping) => Promise<void>;
  removeDatabaseMapping: (databaseId: string) => Promise<void>;
  setDefaultDecisionDatabase: (databaseId: string) => Promise<void>;

  // Sync
  sync: () => Promise<SyncResult>;
  syncDatabase: (mapping: DatabaseMapping) => Promise<SyncResult>;

  // Utilities
  refresh: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useNotion(): UseNotionReturn {
  const workspaceInfo = notionService.getWorkspaceInfo();

  const [state, setState] = useState<NotionState>({
    status: 'disconnected',
    isConnected: false,
    isLoading: true,
    isSyncing: false,
    databases: [],
    pages: [],
    syncConfig: notionService.getSyncConfig(),
    workspaceId: workspaceInfo.id,
    workspaceName: workspaceInfo.name,
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
      const isConnected = notionService.isConnected();
      const lastSync = await notionService.getLastSyncTime();
      const workspaceInfo = notionService.getWorkspaceInfo();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected,
          status: isConnected ? 'connected' : 'disconnected',
          workspaceId: workspaceInfo.id,
          workspaceName: workspaceInfo.name,
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
      const authUrl = notionService.getAuthorizationUrl(state);

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
      await notionService.exchangeCodeForTokens(code);
      const workspaceInfo = notionService.getWorkspaceInfo();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          status: 'connected',
          workspaceId: workspaceInfo.id,
          workspaceName: workspaceInfo.name,
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
      await notionService.disconnect();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          status: 'disconnected',
          databases: [],
          pages: [],
          workspaceId: null,
          workspaceName: null,
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
  // Sync
  // --------------------------------------------------------------------------

  const syncData = useCallback(async () => {
    if (state.isSyncing) return;

    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await notionService.sync();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          databases: notionService.getDatabases(),
          pages: notionService.getPages(),
          syncConfig: notionService.getSyncConfig(),
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

  const syncDatabase = useCallback(async (mapping: DatabaseMapping) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await notionService.syncDatabase(mapping);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          pages: notionService.getPages(),
          isLoading: false,
        }));
      }

      return result;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to sync database',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  const search = useCallback(async (query: string, filter?: 'page' | 'database') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await notionService.search(query, filter);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }

      return result;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Search failed',
        }));
      }
      throw error;
    }
  }, []);

  const searchForContext = useCallback(async (keywords: string[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const pages = await notionService.searchForContext(keywords);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }

      return pages;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Context search failed',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Page Operations
  // --------------------------------------------------------------------------

  const getPage = useCallback(async (pageId: string) => {
    try {
      return await notionService.getPage(pageId);
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to get page',
        }));
      }
      throw error;
    }
  }, []);

  const getPageContent = useCallback(async (pageId: string) => {
    try {
      return await notionService.getPageContent(pageId);
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to get page content',
        }));
      }
      throw error;
    }
  }, []);

  const createPage = useCallback(async (params: CreatePageParams) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const page = await notionService.createPage(params);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          pages: notionService.getPages(),
          syncConfig: notionService.getSyncConfig(),
          isLoading: false,
        }));
      }

      return page;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create page',
        }));
      }
      throw error;
    }
  }, []);

  const createDecisionDocument = useCallback(async (
    decision: Decision,
    databaseId?: string
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const page = await notionService.createDecisionDocument(decision, databaseId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          pages: notionService.getPages(),
          syncConfig: notionService.getSyncConfig(),
          isLoading: false,
        }));
      }

      return page;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create decision document',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Database Operations
  // --------------------------------------------------------------------------

  const fetchDatabases = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const databases = await notionService.fetchDatabases();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          databases,
          isLoading: false,
        }));
      }

      return databases;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch databases',
        }));
      }
      throw error;
    }
  }, []);

  const queryDatabase = useCallback(async (
    databaseId: string,
    filter?: any,
    sorts?: any[]
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const pages = await notionService.queryDatabase(databaseId, filter, sorts);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }

      return pages;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to query database',
        }));
      }
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Linking
  // --------------------------------------------------------------------------

  const linkPageToDecision = useCallback(async (pageId: string, decisionId: string) => {
    try {
      await notionService.linkPageToDecision(pageId, decisionId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: notionService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const getLinkedPage = useCallback(async (oracleId: string) => {
    try {
      return await notionService.getLinkedPage(oracleId);
    } catch (error) {
      return null;
    }
  }, []);

  const unlinkPage = useCallback(async (oracleId: string) => {
    try {
      await notionService.unlinkPage(oracleId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: notionService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Database Mapping
  // --------------------------------------------------------------------------

  const setDatabaseMapping = useCallback(async (mapping: DatabaseMapping) => {
    try {
      await notionService.setDatabaseMapping(mapping);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: notionService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const removeDatabaseMapping = useCallback(async (databaseId: string) => {
    try {
      await notionService.removeDatabaseMapping(databaseId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: notionService.getSyncConfig(),
        }));
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const setDefaultDecisionDatabase = useCallback(async (databaseId: string) => {
    try {
      await notionService.setDefaultDecisionDatabase(databaseId);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          syncConfig: notionService.getSyncConfig(),
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

    // Search
    search,
    searchForContext,

    // Page operations
    getPage,
    getPageContent,
    createPage,
    createDecisionDocument,

    // Database operations
    fetchDatabases,
    queryDatabase,

    // Linking
    linkPageToDecision,
    getLinkedPage,
    unlinkPage,

    // Database mapping
    setDatabaseMapping,
    removeDatabaseMapping,
    setDefaultDecisionDatabase,

    // Sync
    sync: syncData,
    syncDatabase,

    // Utilities
    refresh,
    clearError,
  };
}

// ============================================================================
// DEEP LINK HANDLER
// ============================================================================

export function useNotionAuthCallback(
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const { url } = event;

      if (!url.includes('oauth2callback/notion')) return;

      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
          console.error('[Notion] OAuth error:', error);
          onError?.(error);
          return;
        }

        if (code) {
          await notionService.exchangeCodeForTokens(code);
          onSuccess?.();
        }
      } catch (err) {
        console.error('[Notion] Failed to handle callback:', err);
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

export default useNotion;
