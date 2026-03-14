/**
 * ORACLE Notion Integration
 * Story int-4 - Connect with Notion for document context
 *
 * Features:
 * - OAuth2 flow for Notion
 * - Search Notion pages for context
 * - Create decision documents in Notion
 * - Link Notion pages to decisions
 * - Database sync for structured data
 */

import * as SecureStore from 'expo-secure-store';
import { Decision, Signal } from '@mission-control/shared-types';
import {
  IntegrationConfig,
  IntegrationStatus,
  SyncResult,
} from './googleCalendar';

// ============================================================================
// TYPES
// ============================================================================

export type NotionBlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'to_do'
  | 'toggle'
  | 'code'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'table'
  | 'image';

export type NotionPropertyType =
  | 'title'
  | 'rich_text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'status';

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  text?: {
    content: string;
    link?: { url: string };
  };
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href?: string;
}

export interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  created_by: { id: string };
  last_edited_by: { id: string };
  parent: {
    type: 'database_id' | 'page_id' | 'workspace';
    database_id?: string;
    page_id?: string;
  };
  archived: boolean;
  properties: Record<string, NotionProperty>;
  url: string;
  icon?: { type: 'emoji' | 'file'; emoji?: string; file?: { url: string } };
  cover?: { type: 'file' | 'external'; file?: { url: string }; external?: { url: string } };
  // ORACLE metadata
  oracle_decision_id?: string;
  oracle_signal_id?: string;
}

export interface NotionProperty {
  id: string;
  type: NotionPropertyType;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  number?: number;
  select?: { id: string; name: string; color: string };
  multi_select?: { id: string; name: string; color: string }[];
  date?: { start: string; end?: string; time_zone?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  status?: { id: string; name: string; color: string };
}

export interface NotionDatabase {
  id: string;
  object: 'database';
  title: NotionRichText[];
  description: NotionRichText[];
  created_time: string;
  last_edited_time: string;
  parent: { type: string; page_id?: string };
  url: string;
  properties: Record<string, { id: string; type: NotionPropertyType; name: string }>;
  is_inline: boolean;
  archived: boolean;
}

export interface NotionSearchResult {
  object: 'list';
  results: (NotionPage | NotionDatabase)[];
  next_cursor?: string;
  has_more: boolean;
}

export interface NotionBlock {
  id: string;
  object: 'block';
  type: NotionBlockType;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  [key: string]: any; // Block-specific content
}

export interface DatabaseMapping {
  notion_database_id: string;
  oracle_entity_type: 'decision' | 'signal' | 'step' | 'plan';
  property_mappings: Record<string, string>; // oracle_field -> notion_property
  sync_direction: 'import' | 'export' | 'bidirectional';
  auto_sync: boolean;
}

export interface NotionSyncConfig {
  enabled: boolean;
  workspaceId?: string;
  workspaceName?: string;
  databaseMappings: DatabaseMapping[];
  linkedPages: Record<string, string>; // oracle_id -> notion_page_id
  defaultDecisionDatabase?: string;
  lastSyncCursor?: string;
}

export interface CreatePageParams {
  parent_database_id?: string;
  parent_page_id?: string;
  title: string;
  icon?: string;
  properties?: Record<string, any>;
  content?: NotionBlock[];
  oracle_decision_id?: string;
  oracle_signal_id?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const NOTION_CONFIG: IntegrationConfig = {
  provider: 'notion',
  name: 'Notion',
  description: 'Connect with Notion for document context',
  icon: 'doc.text',
  scopes: [], // Notion uses capabilities, not scopes
  authUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
};

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'oracle_notion_access_token',
  WORKSPACE_ID: 'oracle_notion_workspace_id',
  BOT_ID: 'oracle_notion_bot_id',
  LAST_SYNC: 'oracle_notion_last_sync',
  SYNC_CONFIG: 'oracle_notion_sync_config',
} as const;

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// ============================================================================
// NOTION SERVICE
// ============================================================================

class NotionService {
  private accessToken: string | null = null;
  private status: IntegrationStatus = 'disconnected';
  private workspaceId: string | null = null;
  private workspaceName: string | null = null;
  private botId: string | null = null;
  private databases: NotionDatabase[] = [];
  private pages: NotionPage[] = [];
  private syncConfig: NotionSyncConfig;
  private syncInProgress = false;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.NOTION_CLIENT_ID || '';
    this.clientSecret = process.env.NOTION_CLIENT_SECRET || '';
    this.redirectUri = process.env.NOTION_REDIRECT_URI || 'com.missioncontrol.oracle:/oauth2callback/notion';

    this.syncConfig = {
      enabled: true,
      databaseMappings: [],
      linkedPages: {},
    };

    this.loadConfig();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  private async loadConfig(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        this.accessToken = token;
        this.status = 'connected';
      }

      const workspaceId = await SecureStore.getItemAsync(STORAGE_KEYS.WORKSPACE_ID);
      if (workspaceId) this.workspaceId = workspaceId;

      const config = await SecureStore.getItemAsync(STORAGE_KEYS.SYNC_CONFIG);
      if (config) {
        this.syncConfig = { ...this.syncConfig, ...JSON.parse(config) };
      }
    } catch (error) {
      console.warn('[Notion] Failed to load config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.SYNC_CONFIG,
        JSON.stringify(this.syncConfig)
      );
    } catch (error) {
      console.warn('[Notion] Failed to save config:', error);
    }
  }

  // --------------------------------------------------------------------------
  // OAuth2 Flow
  // --------------------------------------------------------------------------

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      owner: 'user',
      redirect_uri: this.redirectUri,
      state: state || Math.random().toString(36).substring(2, 15),
    });

    return `${NOTION_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<string> {
    console.log('[Notion] Exchanging code for token');

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(NOTION_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error || 'Unknown error'}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.workspaceId = data.workspace_id;
    this.workspaceName = data.workspace_name;
    this.botId = data.bot_id;

    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.WORKSPACE_ID, this.workspaceId);
    await SecureStore.setItemAsync(STORAGE_KEYS.BOT_ID, this.botId);

    this.syncConfig.workspaceId = this.workspaceId;
    this.syncConfig.workspaceName = this.workspaceName || undefined;
    await this.saveConfig();

    this.status = 'connected';
    console.log('[Notion] Successfully connected to workspace:', this.workspaceName);

    return this.accessToken;
  }

  /**
   * Disconnect and clear tokens
   */
  async disconnect(): Promise<void> {
    console.log('[Notion] Disconnecting');

    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.WORKSPACE_ID);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.BOT_ID);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);

    this.accessToken = null;
    this.workspaceId = null;
    this.workspaceName = null;
    this.botId = null;
    this.status = 'disconnected';
    this.databases = [];
    this.pages = [];
  }

  // --------------------------------------------------------------------------
  // API Helpers
  // --------------------------------------------------------------------------

  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${NOTION_API}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // Search Operations
  // --------------------------------------------------------------------------

  /**
   * Search Notion for pages and databases
   */
  async search(query: string, filter?: 'page' | 'database'): Promise<NotionSearchResult> {
    console.log('[Notion] Searching:', query);

    const body: any = { query };
    if (filter) {
      body.filter = { value: filter, property: 'object' };
    }

    const result = await this.apiRequest<NotionSearchResult>('/search', 'POST', body);
    console.log(`[Notion] Found ${result.results.length} results`);

    return result;
  }

  /**
   * Search for context relevant to a decision or signal
   */
  async searchForContext(
    keywords: string[],
    entityType?: 'decision' | 'signal'
  ): Promise<NotionPage[]> {
    console.log('[Notion] Searching for context:', keywords);

    const allPages: NotionPage[] = [];

    for (const keyword of keywords.slice(0, 5)) { // Limit to 5 keywords
      try {
        const result = await this.search(keyword, 'page');
        const pages = result.results.filter(r => r.object === 'page') as NotionPage[];
        allPages.push(...pages);
      } catch (error) {
        console.warn(`[Notion] Search failed for "${keyword}":`, error);
      }
    }

    // Deduplicate by ID
    const uniquePages = Array.from(
      new Map(allPages.map(p => [p.id, p])).values()
    );

    console.log(`[Notion] Found ${uniquePages.length} unique pages for context`);
    return uniquePages;
  }

  // --------------------------------------------------------------------------
  // Page Operations
  // --------------------------------------------------------------------------

  /**
   * Get page by ID
   */
  async getPage(pageId: string): Promise<NotionPage> {
    return this.apiRequest<NotionPage>(`/pages/${pageId}`);
  }

  /**
   * Get page content (blocks)
   */
  async getPageContent(pageId: string): Promise<NotionBlock[]> {
    const result = await this.apiRequest<{ results: NotionBlock[] }>(
      `/blocks/${pageId}/children`
    );
    return result.results;
  }

  /**
   * Create a new page
   */
  async createPage(params: CreatePageParams): Promise<NotionPage> {
    console.log('[Notion] Creating page:', params.title);

    const body: any = {
      properties: {
        title: {
          title: [{ text: { content: params.title } }],
        },
        ...params.properties,
      },
    };

    // Set parent
    if (params.parent_database_id) {
      body.parent = { database_id: params.parent_database_id };
    } else if (params.parent_page_id) {
      body.parent = { page_id: params.parent_page_id };
    } else {
      throw new Error('Parent database or page ID is required');
    }

    // Set icon
    if (params.icon) {
      body.icon = { type: 'emoji', emoji: params.icon };
    }

    // Set content
    if (params.content?.length) {
      body.children = params.content;
    }

    const page = await this.apiRequest<NotionPage>('/pages', 'POST', body);

    // Link to ORACLE entity
    if (params.oracle_decision_id) {
      this.syncConfig.linkedPages[params.oracle_decision_id] = page.id;
      page.oracle_decision_id = params.oracle_decision_id;
      await this.saveConfig();
    }
    if (params.oracle_signal_id) {
      this.syncConfig.linkedPages[params.oracle_signal_id] = page.id;
      page.oracle_signal_id = params.oracle_signal_id;
      await this.saveConfig();
    }

    this.pages.push(page);
    console.log('[Notion] Page created:', page.id);

    return page;
  }

  /**
   * Create a decision document in Notion
   */
  async createDecisionDocument(
    decision: Decision,
    databaseId?: string
  ): Promise<NotionPage> {
    console.log('[Notion] Creating decision document:', decision.id);

    const targetDb = databaseId || this.syncConfig.defaultDecisionDatabase;
    if (!targetDb) {
      throw new Error('No database specified for decision documents');
    }

    // Build content blocks
    const content: any[] = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Decision Overview' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: decision.description || 'No description provided.' } }],
        },
      },
      {
        object: 'block',
        type: 'divider',
        divider: {},
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Status' } }],
        },
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: this.getStatusEmoji(decision.status) },
          rich_text: [{ text: { content: `Status: ${decision.status}` } }],
          color: this.getStatusColor(decision.status),
        },
      },
    ];

    // Add options section if available
    if (decision.options?.length) {
      content.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Options' } }],
        },
      });

      for (const option of decision.options) {
        content.push({
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{ text: { content: option.title || `Option ${option.id}` } }],
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ text: { content: option.description || '' } }],
                },
              },
            ],
          },
        });
      }
    }

    // Add metadata footer
    content.push(
      {
        object: 'block',
        type: 'divider',
        divider: {},
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { text: { content: `ORACLE Decision ID: ${decision.id}\n`, annotations: { code: true } } },
            { text: { content: `Created: ${decision.created_at}` } },
          ],
        },
      }
    );

    return this.createPage({
      parent_database_id: targetDb,
      title: decision.title,
      icon: '🎯',
      content,
      oracle_decision_id: decision.id,
      properties: {
        Status: {
          select: { name: decision.status },
        },
      },
    });
  }

  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      pending: '⏳',
      analyzing: '🔍',
      decided: '✅',
      executed: '🚀',
      cancelled: '❌',
    };
    return emojis[status] || '📋';
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'yellow_background',
      analyzing: 'blue_background',
      decided: 'green_background',
      executed: 'purple_background',
      cancelled: 'red_background',
    };
    return colors[status] || 'gray_background';
  }

  // --------------------------------------------------------------------------
  // Database Operations
  // --------------------------------------------------------------------------

  /**
   * Get databases accessible to the integration
   */
  async fetchDatabases(): Promise<NotionDatabase[]> {
    console.log('[Notion] Fetching databases');

    const result = await this.search('', 'database');
    this.databases = result.results.filter(r => r.object === 'database') as NotionDatabase[];

    console.log(`[Notion] Fetched ${this.databases.length} databases`);
    return this.databases;
  }

  /**
   * Query a database
   */
  async queryDatabase(
    databaseId: string,
    filter?: any,
    sorts?: any[]
  ): Promise<NotionPage[]> {
    console.log('[Notion] Querying database:', databaseId);

    const body: any = {};
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;

    const result = await this.apiRequest<{ results: NotionPage[] }>(
      `/databases/${databaseId}/query`,
      'POST',
      body
    );

    return result.results;
  }

  /**
   * Sync database with ORACLE entity type
   */
  async syncDatabase(mapping: DatabaseMapping): Promise<SyncResult> {
    console.log('[Notion] Syncing database:', mapping.notion_database_id);

    try {
      const pages = await this.queryDatabase(mapping.notion_database_id);

      // Store in local cache
      this.pages = [...this.pages.filter(p =>
        p.parent.database_id !== mapping.notion_database_id
      ), ...pages];

      return {
        success: true,
        events_fetched: pages.length,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Linking Operations
  // --------------------------------------------------------------------------

  /**
   * Link a Notion page to an ORACLE decision
   */
  async linkPageToDecision(pageId: string, decisionId: string): Promise<void> {
    this.syncConfig.linkedPages[decisionId] = pageId;
    await this.saveConfig();
    console.log('[Notion] Linked page', pageId, 'to decision', decisionId);
  }

  /**
   * Get linked Notion page for an ORACLE entity
   */
  async getLinkedPage(oracleId: string): Promise<NotionPage | null> {
    const pageId = this.syncConfig.linkedPages[oracleId];
    if (!pageId) return null;

    try {
      return await this.getPage(pageId);
    } catch (error) {
      console.warn('[Notion] Failed to get linked page:', error);
      return null;
    }
  }

  /**
   * Unlink a page from an ORACLE entity
   */
  async unlinkPage(oracleId: string): Promise<void> {
    delete this.syncConfig.linkedPages[oracleId];
    await this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // Database Mapping
  // --------------------------------------------------------------------------

  /**
   * Set database mapping
   */
  async setDatabaseMapping(mapping: DatabaseMapping): Promise<void> {
    const existingIndex = this.syncConfig.databaseMappings.findIndex(
      m => m.notion_database_id === mapping.notion_database_id
    );

    if (existingIndex >= 0) {
      this.syncConfig.databaseMappings[existingIndex] = mapping;
    } else {
      this.syncConfig.databaseMappings.push(mapping);
    }

    await this.saveConfig();
    console.log('[Notion] Database mapping set:', mapping);
  }

  /**
   * Remove database mapping
   */
  async removeDatabaseMapping(databaseId: string): Promise<void> {
    this.syncConfig.databaseMappings = this.syncConfig.databaseMappings.filter(
      m => m.notion_database_id !== databaseId
    );
    await this.saveConfig();
  }

  /**
   * Set default decision database
   */
  async setDefaultDecisionDatabase(databaseId: string): Promise<void> {
    this.syncConfig.defaultDecisionDatabase = databaseId;
    await this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // Sync Operations
  // --------------------------------------------------------------------------

  /**
   * Full sync with Notion
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    console.log('[Notion] Starting sync');

    try {
      // Fetch databases
      await this.fetchDatabases();

      // Sync each mapped database
      let totalFetched = 0;
      for (const mapping of this.syncConfig.databaseMappings) {
        if (mapping.auto_sync) {
          const result = await this.syncDatabase(mapping);
          totalFetched += result.events_fetched;
        }
      }

      // Store last sync time
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      const result: SyncResult = {
        success: true,
        events_fetched: totalFetched,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
      };

      console.log('[Notion] Sync completed:', result);
      return result;
    } catch (error) {
      console.error('[Notion] Sync failed:', error);
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getStatus(): IntegrationStatus {
    return this.status;
  }

  getDatabases(): NotionDatabase[] {
    return this.databases;
  }

  getPages(): NotionPage[] {
    return this.pages;
  }

  getSyncConfig(): NotionSyncConfig {
    return this.syncConfig;
  }

  getConfig(): IntegrationConfig {
    return NOTION_CONFIG;
  }

  getWorkspaceInfo(): { id: string | null; name: string | null } {
    return { id: this.workspaceId, name: this.workspaceName };
  }

  isConnected(): boolean {
    return !!this.accessToken && this.status === 'connected';
  }

  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const notionService = new NotionService();

export {
  NotionService,
  NOTION_CONFIG,
  STORAGE_KEYS as NOTION_STORAGE_KEYS,
};

export default notionService;
