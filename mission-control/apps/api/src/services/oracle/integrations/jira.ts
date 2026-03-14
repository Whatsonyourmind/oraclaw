/**
 * Jira Integration Service for ORACLE v2.0
 *
 * Provides OAuth2 authentication with Jira Cloud, issue CRUD operations,
 * project/board listing, sprint management, webhook handlers, bi-directional
 * sync with ORACLE tasks, JQL query support, and attachment handling.
 *
 * @module services/oracle/integrations/jira
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Jira OAuth 2.0 token data
 */
export interface JiraOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number; // Calculated timestamp
}

/**
 * Jira accessible resource (site)
 */
export interface JiraAccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl: string;
}

/**
 * Jira project data
 */
export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  simplified: boolean;
  style: string;
  isPrivate: boolean;
  avatarUrls: Record<string, string>;
  lead?: {
    accountId: string;
    displayName: string;
  };
}

/**
 * Jira issue type
 */
export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

/**
 * Jira issue priority
 */
export interface JiraPriority {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
}

/**
 * Jira issue status
 */
export interface JiraStatus {
  id: string;
  name: string;
  description: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
    colorName: string;
  };
}

/**
 * Jira user data
 */
export interface JiraUser {
  accountId: string;
  accountType: string;
  emailAddress?: string;
  displayName: string;
  active: boolean;
  avatarUrls: Record<string, string>;
  timeZone?: string;
}

/**
 * Jira board data
 */
export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  location: {
    projectId: number;
    projectKey: string;
    projectName: string;
    displayName: string;
  };
}

/**
 * Jira sprint data
 */
export interface JiraSprint {
  id: number;
  self: string;
  state: 'future' | 'active' | 'closed';
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId: number;
  goal?: string;
}

/**
 * Jira attachment data
 */
export interface JiraAttachment {
  id: string;
  self: string;
  filename: string;
  author: JiraUser;
  created: string;
  size: number;
  mimeType: string;
  content: string;
  thumbnail?: string;
}

/**
 * Jira issue data
 */
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: string | null;
    issuetype: JiraIssueType;
    project: JiraProject;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;
    reporter: JiraUser;
    created: string;
    updated: string;
    duedate: string | null;
    labels: string[];
    components: Array<{ id: string; name: string }>;
    parent?: { key: string; id: string };
    subtasks?: Array<{ key: string; id: string }>;
    sprint?: JiraSprint;
    attachment?: JiraAttachment[];
    storyPoints?: number;
    timeoriginalestimate?: number;
    timespent?: number;
    timeestimate?: number;
    [key: string]: unknown; // Custom fields
  };
}

/**
 * Jira search results
 */
export interface JiraSearchResults {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

/**
 * Jira webhook event types
 */
export type JiraWebhookEvent =
  | 'jira:issue_created'
  | 'jira:issue_updated'
  | 'jira:issue_deleted'
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted'
  | 'attachment_created'
  | 'attachment_deleted'
  | 'sprint_created'
  | 'sprint_updated'
  | 'sprint_deleted'
  | 'sprint_started'
  | 'sprint_closed'
  | 'worklog_created'
  | 'worklog_updated'
  | 'worklog_deleted';

/**
 * Jira webhook payload
 */
export interface JiraWebhookPayload {
  timestamp: number;
  webhookEvent: JiraWebhookEvent;
  issue_event_type_name?: string;
  user?: JiraUser;
  issue?: JiraIssue;
  comment?: {
    id: string;
    self: string;
    author: JiraUser;
    body: string;
    created: string;
    updated: string;
  };
  attachment?: JiraAttachment;
  sprint?: JiraSprint;
  changelog?: {
    id: string;
    items: Array<{
      field: string;
      fieldtype: string;
      fieldId?: string;
      from?: string;
      fromString?: string;
      to?: string;
      toString?: string;
    }>;
  };
}

/**
 * Jira webhook registration
 */
export interface JiraWebhookRegistration {
  id: string;
  name: string;
  url: string;
  events: JiraWebhookEvent[];
  jqlFilter?: string;
  enabled: boolean;
  self: string;
  lastUpdatedUser?: JiraUser;
  lastUpdatedDisplayName?: string;
}

/**
 * ORACLE horizon mapping from Jira sprint
 */
export interface OracleHorizon {
  id: string;
  name: string;
  type: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  start_date: string | null;
  end_date: string | null;
  sprint_id: number | null;
  goal: string | null;
  status: 'active' | 'planned' | 'completed';
}

/**
 * ORACLE signal from Jira issue
 */
export interface JiraSignal {
  id: string;
  source: 'jira';
  type: 'issue' | 'subtask' | 'epic' | 'story' | 'bug' | 'task';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metadata: {
    project_key: string;
    issue_key: string;
    issue_type: string;
    status: string;
    priority: string;
    assignee: string | null;
    reporter: string;
    sprint: string | null;
    due_date: string | null;
    labels: string[];
    url: string;
    created_at: string;
    updated_at: string;
  };
}

/**
 * ORACLE task sync mapping
 */
export interface JiraOracleSyncMapping {
  jiraIssueId: string;
  jiraIssueKey: string;
  oracleTaskId: string;
  syncDirection: 'jira_to_oracle' | 'oracle_to_jira' | 'bidirectional';
  lastSyncedAt: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
}

/**
 * Sync result
 */
export interface JiraSyncResult {
  success: boolean;
  direction: 'jira_to_oracle' | 'oracle_to_jira';
  jiraIssueKey: string;
  oracleTaskId: string;
  changesApplied: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  conflicts?: Array<{
    field: string;
    jiraValue: any;
    oracleValue: any;
  }>;
  error?: string;
}

/**
 * Workload analysis for a user
 */
export interface WorkloadAnalysis {
  user_id: string;
  user_name: string;
  assigned_issues: number;
  total_story_points: number;
  estimated_hours: number;
  issues_by_priority: Record<string, number>;
  issues_by_status: Record<string, number>;
  overdue_count: number;
  due_this_week: number;
  workload_score: number; // 0-100, higher = more overloaded
  recommendations: string[];
}

/**
 * Custom field mapping configuration
 */
export interface CustomFieldMapping {
  story_points?: string;
  sprint?: string;
  epic_link?: string;
  team?: string;
  [key: string]: string | undefined;
}

/**
 * Priority to urgency mapping
 */
export interface PriorityMapping {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_PRIORITY_MAPPING: PriorityMapping = {
  critical: ['Highest', 'Blocker', 'Critical'],
  high: ['High'],
  medium: ['Medium'],
  low: ['Low', 'Lowest'],
};

// ============================================================================
// JQL Query Builder
// ============================================================================

/**
 * JQL Query Builder - Fluent interface for building Jira queries
 *
 * Time Complexity: O(n) where n = number of clauses
 */
export class JQLBuilder {
  private clauses: string[] = [];
  private orderByClause: string | null = null;

  /**
   * Add a project filter
   */
  project(key: string | string[]): this {
    const projects = Array.isArray(key) ? key : [key];
    this.clauses.push(`project IN (${projects.map(p => `"${p}"`).join(', ')})`);
    return this;
  }

  /**
   * Add an issue type filter
   */
  issueType(type: string | string[]): this {
    const types = Array.isArray(type) ? type : [type];
    this.clauses.push(`issuetype IN (${types.map(t => `"${t}"`).join(', ')})`);
    return this;
  }

  /**
   * Add a status filter
   */
  status(status: string | string[]): this {
    const statuses = Array.isArray(status) ? status : [status];
    this.clauses.push(`status IN (${statuses.map(s => `"${s}"`).join(', ')})`);
    return this;
  }

  /**
   * Add an assignee filter
   */
  assignee(accountId: string | null): this {
    if (accountId === null) {
      this.clauses.push('assignee IS EMPTY');
    } else if (accountId === 'currentUser()') {
      this.clauses.push('assignee = currentUser()');
    } else {
      this.clauses.push(`assignee = "${accountId}"`);
    }
    return this;
  }

  /**
   * Add a reporter filter
   */
  reporter(accountId: string): this {
    this.clauses.push(`reporter = "${accountId}"`);
    return this;
  }

  /**
   * Add a priority filter
   */
  priority(priority: string | string[]): this {
    const priorities = Array.isArray(priority) ? priority : [priority];
    this.clauses.push(`priority IN (${priorities.map(p => `"${p}"`).join(', ')})`);
    return this;
  }

  /**
   * Add a label filter
   */
  labels(labels: string[]): this {
    const labelClauses = labels.map(l => `labels = "${l}"`);
    this.clauses.push(`(${labelClauses.join(' OR ')})`);
    return this;
  }

  /**
   * Add a sprint filter
   */
  sprint(sprintId: number | 'openSprints()' | 'futureSprints()' | 'closedSprints()'): this {
    if (typeof sprintId === 'number') {
      this.clauses.push(`sprint = ${sprintId}`);
    } else {
      this.clauses.push(`sprint IN ${sprintId}`);
    }
    return this;
  }

  /**
   * Add a due date filter
   */
  dueDate(operator: '<' | '>' | '=' | '<=' | '>=' | 'IS EMPTY' | 'IS NOT EMPTY', date?: string): this {
    if (operator === 'IS EMPTY' || operator === 'IS NOT EMPTY') {
      this.clauses.push(`duedate ${operator}`);
    } else {
      this.clauses.push(`duedate ${operator} "${date}"`);
    }
    return this;
  }

  /**
   * Add an updated date filter
   */
  updatedAfter(date: string): this {
    this.clauses.push(`updated >= "${date}"`);
    return this;
  }

  /**
   * Add a created date filter
   */
  createdAfter(date: string): this {
    this.clauses.push(`created >= "${date}"`);
    return this;
  }

  /**
   * Add a text search
   */
  text(query: string): this {
    this.clauses.push(`text ~ "${query}"`);
    return this;
  }

  /**
   * Add a custom field filter
   */
  customField(fieldId: string, operator: string, value: string): this {
    this.clauses.push(`"${fieldId}" ${operator} "${value}"`);
    return this;
  }

  /**
   * Add raw JQL clause
   */
  raw(jql: string): this {
    this.clauses.push(jql);
    return this;
  }

  /**
   * Set order by clause
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'DESC'): this {
    this.orderByClause = `ORDER BY ${field} ${direction}`;
    return this;
  }

  /**
   * Build the final JQL query
   */
  build(): string {
    let query = this.clauses.join(' AND ');
    if (this.orderByClause) {
      query += ` ${this.orderByClause}`;
    }
    return query;
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.clauses = [];
    this.orderByClause = null;
    return this;
  }
}

// ============================================================================
// Jira Service Class
// ============================================================================

/**
 * JiraService - Full integration with Jira Cloud API
 *
 * Features:
 * - OAuth2 authentication with Jira Cloud
 * - Issue CRUD operations (create, read, update, delete)
 * - Project and board listing
 * - Sprint management
 * - Webhook handlers for issue updates
 * - Bi-directional sync with ORACLE tasks
 * - JQL query support
 * - Attachment handling
 *
 * Time Complexity:
 * - Most operations: O(1) API calls
 * - Issue search: O(n) where n = number of results
 * - Workload analysis: O(n) where n = number of issues
 */
export class JiraService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private cloudId: string | null = null;
  private tokens: JiraOAuthTokens | null = null;
  private priorityMapping: PriorityMapping;
  private customFieldMapping: CustomFieldMapping;
  private webhookBaseUrl: string;
  private baseUrl = 'https://api.atlassian.com';
  private authUrl = 'https://auth.atlassian.com';

  /**
   * Initialize Jira service with OAuth credentials
   *
   * @param clientId - OAuth client ID
   * @param clientSecret - OAuth client secret
   * @param redirectUri - OAuth redirect URI
   * @param priorityMapping - Custom priority to urgency mapping
   * @param customFieldMapping - Custom field ID mapping
   */
  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    priorityMapping?: Partial<PriorityMapping>,
    customFieldMapping?: CustomFieldMapping
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.priorityMapping = {
      ...DEFAULT_PRIORITY_MAPPING,
      ...priorityMapping,
    };
    this.customFieldMapping = customFieldMapping || {};
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://api.example.com';
  }

  // ==========================================================================
  // OAuth 2.0 Methods
  // ==========================================================================

  /**
   * Generate OAuth 2.0 authorization URL
   *
   * @param state - State parameter for CSRF protection
   * @returns Authorization URL
   */
  generateAuthUrl(state: string): string {
    const scopes = [
      'read:jira-work',
      'write:jira-work',
      'read:jira-user',
      'manage:jira-project',
      'manage:jira-webhook',
      'read:sprint:jira-software',
      'write:sprint:jira-software',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `${this.authUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code
   * @returns OAuth tokens
   */
  async exchangeCodeForTokens(code: string): Promise<JiraOAuthTokens> {
    const response = await fetch(`${this.authUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    const data = await response.json();

    const tokens: JiraOAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    this.tokens = tokens;
    return tokens;
  }

  /**
   * Set tokens from stored data
   */
  setTokens(tokens: JiraOAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Refresh access token
   *
   * @returns New OAuth tokens
   */
  async refreshAccessToken(): Promise<JiraOAuthTokens> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.authUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    const tokens: JiraOAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokens.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    this.tokens = tokens;
    return tokens;
  }

  /**
   * Ensure valid token, refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error('Not authenticated. Call setTokens() first.');
    }

    // Refresh if token expires in less than 5 minutes
    if (this.tokens.expires_at - Date.now() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }
  }

  // ==========================================================================
  // API Request Helpers
  // ==========================================================================

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureValidToken();

    if (!this.cloudId) {
      throw new Error('Cloud ID not set. Call getAccessibleResources() first.');
    }

    const url = `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens!.access_token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make an Agile API request
   */
  private async agileApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureValidToken();

    if (!this.cloudId) {
      throw new Error('Cloud ID not set. Call getAccessibleResources() first.');
    }

    const url = `${this.baseUrl}/ex/jira/${this.cloudId}/rest/agile/1.0${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens!.access_token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira Agile API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ==========================================================================
  // Resource Access Methods
  // ==========================================================================

  /**
   * Get accessible Jira sites/resources
   *
   * @returns List of accessible resources
   */
  async getAccessibleResources(): Promise<JiraAccessibleResource[]> {
    await this.ensureValidToken();

    const response = await fetch(`${this.baseUrl}/oauth/token/accessible-resources`, {
      headers: {
        Authorization: `Bearer ${this.tokens!.access_token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get accessible resources: ${error}`);
    }

    return response.json();
  }

  /**
   * Set the cloud ID for API requests
   */
  setCloudId(cloudId: string): void {
    this.cloudId = cloudId;
  }

  // ==========================================================================
  // Project Methods
  // ==========================================================================

  /**
   * List all projects
   *
   * @param options - Query options
   * @returns Array of projects
   */
  async listProjects(options?: {
    startAt?: number;
    maxResults?: number;
    orderBy?: string;
    query?: string;
  }): Promise<{ values: JiraProject[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.startAt !== undefined) params.set('startAt', String(options.startAt));
    if (options?.maxResults !== undefined) params.set('maxResults', String(options.maxResults));
    if (options?.orderBy) params.set('orderBy', options.orderBy);
    if (options?.query) params.set('query', options.query);

    const response = await this.apiRequest<{ values: JiraProject[]; total: number }>(
      `/project/search?${params.toString()}`
    );
    return response;
  }

  /**
   * Get a specific project
   */
  async getProject(projectKeyOrId: string): Promise<JiraProject> {
    return this.apiRequest<JiraProject>(`/project/${projectKeyOrId}`);
  }

  // ==========================================================================
  // Board Methods
  // ==========================================================================

  /**
   * List all boards
   *
   * @param options - Query options
   * @returns Array of boards
   */
  async listBoards(options?: {
    startAt?: number;
    maxResults?: number;
    type?: 'scrum' | 'kanban' | 'simple';
    name?: string;
    projectKeyOrId?: string;
  }): Promise<{ values: JiraBoard[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.startAt !== undefined) params.set('startAt', String(options.startAt));
    if (options?.maxResults !== undefined) params.set('maxResults', String(options.maxResults));
    if (options?.type) params.set('type', options.type);
    if (options?.name) params.set('name', options.name);
    if (options?.projectKeyOrId) params.set('projectKeyOrId', options.projectKeyOrId);

    return this.agileApiRequest<{ values: JiraBoard[]; total: number }>(
      `/board?${params.toString()}`
    );
  }

  /**
   * Get a specific board
   *
   * @param boardId - Board ID
   * @returns Board data
   */
  async getBoard(boardId: number): Promise<JiraBoard> {
    return this.agileApiRequest<JiraBoard>(`/board/${boardId}`);
  }

  /**
   * Get board configuration
   *
   * @param boardId - Board ID
   * @returns Board configuration
   */
  async getBoardConfiguration(boardId: number): Promise<{
    id: number;
    name: string;
    type: string;
    columnConfig: {
      columns: Array<{
        name: string;
        statuses: Array<{ id: string; self: string }>;
      }>;
    };
  }> {
    return this.agileApiRequest<any>(`/board/${boardId}/configuration`);
  }

  // ==========================================================================
  // Issue CRUD Methods
  // ==========================================================================

  /**
   * Search for issues using JQL
   *
   * @param jql - JQL query string
   * @param options - Search options
   * @returns Search results
   */
  async searchIssues(
    jql: string,
    options: {
      startAt?: number;
      maxResults?: number;
      fields?: string[];
      expand?: string[];
    } = {}
  ): Promise<JiraSearchResults> {
    const params = new URLSearchParams();
    params.set('jql', jql);

    if (options.startAt !== undefined) {
      params.set('startAt', options.startAt.toString());
    }
    if (options.maxResults !== undefined) {
      params.set('maxResults', options.maxResults.toString());
    }
    if (options.fields?.length) {
      params.set('fields', options.fields.join(','));
    }
    if (options.expand?.length) {
      params.set('expand', options.expand.join(','));
    }

    return this.apiRequest<JiraSearchResults>(`/search?${params.toString()}`);
  }

  /**
   * Get a specific issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @param fields - Fields to include
   * @param expand - Fields to expand
   * @returns Issue data
   */
  async getIssue(
    issueKeyOrId: string,
    fields?: string[],
    expand?: string[]
  ): Promise<JiraIssue> {
    const params = new URLSearchParams();
    if (fields?.length) params.set('fields', fields.join(','));
    if (expand?.length) params.set('expand', expand.join(','));

    const queryString = params.toString();
    return this.apiRequest<JiraIssue>(
      `/issue/${issueKeyOrId}${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Create a new issue
   *
   * @param issue - Issue creation data
   * @returns Created issue
   */
  async createIssue(issue: {
    projectKey: string;
    issueType: string;
    summary: string;
    description?: string;
    assignee?: string;
    priority?: string;
    labels?: string[];
    components?: string[];
    dueDate?: string;
    parentKey?: string;
    customFields?: Record<string, unknown>;
  }): Promise<JiraIssue> {
    const fields: Record<string, unknown> = {
      project: { key: issue.projectKey },
      issuetype: { name: issue.issueType },
      summary: issue.summary,
    };

    if (issue.description) {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: issue.description }],
          },
        ],
      };
    }

    if (issue.assignee) {
      fields.assignee = { accountId: issue.assignee };
    }

    if (issue.priority) {
      fields.priority = { name: issue.priority };
    }

    if (issue.labels?.length) {
      fields.labels = issue.labels;
    }

    if (issue.components?.length) {
      fields.components = issue.components.map((c) => ({ name: c }));
    }

    if (issue.dueDate) {
      fields.duedate = issue.dueDate;
    }

    if (issue.parentKey) {
      fields.parent = { key: issue.parentKey };
    }

    // Add custom fields
    if (issue.customFields) {
      Object.assign(fields, issue.customFields);
    }

    const response = await this.apiRequest<{ id: string; key: string; self: string }>(
      '/issue',
      {
        method: 'POST',
        body: JSON.stringify({ fields }),
      }
    );

    // Fetch the full issue
    return this.getIssue(response.key);
  }

  /**
   * Update an existing issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @param updates - Update data
   */
  async updateIssue(
    issueKeyOrId: string,
    updates: {
      summary?: string;
      description?: string;
      assignee?: string | null;
      priority?: string;
      labels?: string[];
      dueDate?: string | null;
      customFields?: Record<string, unknown>;
    }
  ): Promise<void> {
    const fields: Record<string, unknown> = {};

    if (updates.summary !== undefined) {
      fields.summary = updates.summary;
    }

    if (updates.description !== undefined) {
      fields.description = updates.description
        ? {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: updates.description }],
              },
            ],
          }
        : null;
    }

    if (updates.assignee !== undefined) {
      fields.assignee = updates.assignee ? { accountId: updates.assignee } : null;
    }

    if (updates.priority !== undefined) {
      fields.priority = { name: updates.priority };
    }

    if (updates.labels !== undefined) {
      fields.labels = updates.labels;
    }

    if (updates.dueDate !== undefined) {
      fields.duedate = updates.dueDate;
    }

    if (updates.customFields) {
      Object.assign(fields, updates.customFields);
    }

    await this.apiRequest(`/issue/${issueKeyOrId}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  /**
   * Delete an issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @param deleteSubtasks - Whether to delete subtasks
   */
  async deleteIssue(issueKeyOrId: string, deleteSubtasks: boolean = false): Promise<void> {
    const params = new URLSearchParams();
    if (deleteSubtasks) {
      params.set('deleteSubtasks', 'true');
    }

    await this.apiRequest(`/issue/${issueKeyOrId}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  /**
   * Transition an issue to a new status
   *
   * @param issueKeyOrId - Issue key or ID
   * @param transitionId - Transition ID
   * @param fields - Optional fields to update during transition
   * @param comment - Optional comment to add
   */
  async transitionIssue(
    issueKeyOrId: string,
    transitionId: string,
    fields?: Record<string, unknown>,
    comment?: string
  ): Promise<void> {
    const body: Record<string, any> = {
      transition: { id: transitionId },
    };

    if (fields) {
      body.fields = fields;
    }

    if (comment) {
      body.update = {
        comment: [{
          add: {
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: comment }],
                },
              ],
            },
          },
        }],
      };
    }

    await this.apiRequest(`/issue/${issueKeyOrId}/transitions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get available transitions for an issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @returns Available transitions
   */
  async getTransitions(issueKeyOrId: string): Promise<Array<{
    id: string;
    name: string;
    to: JiraStatus;
    hasScreen: boolean;
  }>> {
    const response = await this.apiRequest<{
      transitions: Array<{ id: string; name: string; to: JiraStatus; hasScreen: boolean }>;
    }>(`/issue/${issueKeyOrId}/transitions`);

    return response.transitions;
  }

  /**
   * Add a comment to an issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @param body - Comment text
   * @param visibility - Optional visibility restriction
   */
  async addComment(
    issueKeyOrId: string,
    body: string,
    visibility?: { type: 'group' | 'role'; value: string }
  ): Promise<{ id: string; self: string }> {
    const requestBody: Record<string, any> = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: body }],
          },
        ],
      },
    };

    if (visibility) {
      requestBody.visibility = visibility;
    }

    return this.apiRequest<{ id: string; self: string }>(
      `/issue/${issueKeyOrId}/comment`,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );
  }

  // ==========================================================================
  // Sprint Methods
  // ==========================================================================

  /**
   * Get sprints for a board
   *
   * @param boardId - Board ID
   * @param state - Sprint state filter
   * @returns Array of sprints
   */
  async getSprints(
    boardId: number,
    state?: 'future' | 'active' | 'closed'
  ): Promise<JiraSprint[]> {
    const params = state ? `?state=${state}` : '';
    const response = await this.agileApiRequest<{ values: JiraSprint[] }>(
      `/board/${boardId}/sprint${params}`
    );
    return response.values;
  }

  /**
   * Get a specific sprint
   *
   * @param sprintId - Sprint ID
   * @returns Sprint data
   */
  async getSprint(sprintId: number): Promise<JiraSprint> {
    return this.agileApiRequest<JiraSprint>(`/sprint/${sprintId}`);
  }

  /**
   * Get active sprint for a board
   *
   * @param boardId - Board ID
   * @returns Active sprint or null
   */
  async getActiveSprint(boardId: number): Promise<JiraSprint | null> {
    const sprints = await this.getSprints(boardId, 'active');
    return sprints.length > 0 ? sprints[0] : null;
  }

  /**
   * Create a new sprint
   *
   * @param boardId - Board ID
   * @param sprint - Sprint data
   * @returns Created sprint
   */
  async createSprint(
    boardId: number,
    sprint: {
      name: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<JiraSprint> {
    return this.agileApiRequest<JiraSprint>('/sprint', {
      method: 'POST',
      body: JSON.stringify({
        originBoardId: boardId,
        ...sprint,
      }),
    });
  }

  /**
   * Update a sprint
   *
   * @param sprintId - Sprint ID
   * @param updates - Sprint updates
   * @returns Updated sprint
   */
  async updateSprint(
    sprintId: number,
    updates: Partial<{
      name: string;
      goal: string;
      startDate: string;
      endDate: string;
      state: 'future' | 'active' | 'closed';
    }>
  ): Promise<JiraSprint> {
    return this.agileApiRequest<JiraSprint>(`/sprint/${sprintId}`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Start a sprint
   *
   * @param sprintId - Sprint ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Updated sprint
   */
  async startSprint(sprintId: number, startDate: string, endDate: string): Promise<JiraSprint> {
    return this.updateSprint(sprintId, {
      state: 'active',
      startDate,
      endDate,
    });
  }

  /**
   * Complete a sprint
   *
   * @param sprintId - Sprint ID
   * @returns Updated sprint
   */
  async completeSprint(sprintId: number): Promise<JiraSprint> {
    return this.updateSprint(sprintId, {
      state: 'closed',
    });
  }

  /**
   * Delete a sprint
   *
   * @param sprintId - Sprint ID
   */
  async deleteSprint(sprintId: number): Promise<void> {
    await this.agileApiRequest(`/sprint/${sprintId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Move issues to a sprint
   *
   * @param sprintId - Sprint ID
   * @param issueKeys - Issue keys to move
   */
  async moveIssuesToSprint(sprintId: number, issueKeys: string[]): Promise<void> {
    await this.agileApiRequest(`/sprint/${sprintId}/issue`, {
      method: 'POST',
      body: JSON.stringify({
        issues: issueKeys,
      }),
    });
  }

  /**
   * Move issues to backlog
   *
   * @param issueKeys - Issue keys to move
   */
  async moveIssuesToBacklog(issueKeys: string[]): Promise<void> {
    await this.agileApiRequest('/backlog/issue', {
      method: 'POST',
      body: JSON.stringify({
        issues: issueKeys,
      }),
    });
  }

  /**
   * Get issues in sprint
   *
   * @param sprintId - Sprint ID
   * @param options - Query options
   * @returns Issues in sprint
   */
  async getSprintIssues(
    sprintId: number,
    options?: {
      startAt?: number;
      maxResults?: number;
      jql?: string;
    }
  ): Promise<JiraSearchResults> {
    const params = new URLSearchParams();
    if (options?.startAt !== undefined) params.set('startAt', String(options.startAt));
    if (options?.maxResults !== undefined) params.set('maxResults', String(options.maxResults));
    if (options?.jql) params.set('jql', options.jql);

    return this.agileApiRequest<JiraSearchResults>(
      `/sprint/${sprintId}/issue?${params.toString()}`
    );
  }

  /**
   * Map Jira sprints to ORACLE horizons
   *
   * @param boardId - Jira board ID
   * @returns Array of ORACLE horizons
   */
  async mapSprintsToHorizons(boardId: number): Promise<OracleHorizon[]> {
    const [activeSprints, futureSprints, closedSprints] = await Promise.all([
      this.getSprints(boardId, 'active'),
      this.getSprints(boardId, 'future'),
      this.getSprints(boardId, 'closed'),
    ]);

    const horizons: OracleHorizon[] = [];

    // Map active sprint to immediate horizon
    for (const sprint of activeSprints) {
      horizons.push({
        id: `horizon-sprint-${sprint.id}`,
        name: sprint.name,
        type: 'immediate',
        start_date: sprint.startDate || null,
        end_date: sprint.endDate || null,
        sprint_id: sprint.id,
        goal: sprint.goal || null,
        status: 'active',
      });
    }

    // Map future sprints to short/medium term horizons
    futureSprints.slice(0, 3).forEach((sprint, index) => {
      horizons.push({
        id: `horizon-sprint-${sprint.id}`,
        name: sprint.name,
        type: index === 0 ? 'short_term' : 'medium_term',
        start_date: sprint.startDate || null,
        end_date: sprint.endDate || null,
        sprint_id: sprint.id,
        goal: sprint.goal || null,
        status: 'planned',
      });
    });

    // Map recent closed sprints to completed horizons
    closedSprints.slice(0, 2).forEach((sprint) => {
      horizons.push({
        id: `horizon-sprint-${sprint.id}`,
        name: sprint.name,
        type: 'immediate',
        start_date: sprint.startDate || null,
        end_date: sprint.completeDate || sprint.endDate || null,
        sprint_id: sprint.id,
        goal: sprint.goal || null,
        status: 'completed',
      });
    });

    return horizons;
  }

  // ==========================================================================
  // Attachment Methods
  // ==========================================================================

  /**
   * Get attachments for an issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @returns Array of attachments
   */
  async getAttachments(issueKeyOrId: string): Promise<JiraAttachment[]> {
    const issue = await this.getIssue(issueKeyOrId, ['attachment']);
    return issue.fields.attachment || [];
  }

  /**
   * Add an attachment to an issue
   *
   * @param issueKeyOrId - Issue key or ID
   * @param file - File to attach (Buffer or Blob)
   * @param filename - Filename
   * @returns Created attachment
   */
  async addAttachment(
    issueKeyOrId: string,
    file: Buffer | Blob,
    filename: string
  ): Promise<JiraAttachment[]> {
    await this.ensureValidToken();

    if (!this.cloudId) {
      throw new Error('Cloud ID not set');
    }

    const formData = new FormData();
    formData.append('file', file instanceof Buffer ? new Blob([file]) : file, filename);

    const response = await fetch(
      `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/issue/${issueKeyOrId}/attachments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens!.access_token}`,
          'X-Atlassian-Token': 'no-check',
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add attachment: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete an attachment
   *
   * @param attachmentId - Attachment ID
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.apiRequest(`/attachment/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get attachment metadata
   *
   * @param attachmentId - Attachment ID
   * @returns Attachment metadata
   */
  async getAttachment(attachmentId: string): Promise<JiraAttachment> {
    return this.apiRequest<JiraAttachment>(`/attachment/${attachmentId}`);
  }

  // ==========================================================================
  // Webhook Methods
  // ==========================================================================

  /**
   * Register a webhook
   *
   * @param name - Webhook name
   * @param events - Events to subscribe to
   * @param jqlFilter - Optional JQL filter
   * @returns Webhook registration
   */
  async registerWebhook(
    name: string,
    events: JiraWebhookEvent[],
    jqlFilter?: string
  ): Promise<JiraWebhookRegistration> {
    const body: Record<string, any> = {
      name,
      url: `${this.webhookBaseUrl}/api/integrations/jira/webhook`,
      events,
      excludeBody: false,
    };

    if (jqlFilter) {
      body.filters = {
        'issue-related-events-section': jqlFilter,
      };
    }

    const result = await this.apiRequest<any>('/webhook', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      id: result.webhookRegistrationResult?.[0]?.createdWebhookId || result.id,
      name,
      url: `${this.webhookBaseUrl}/api/integrations/jira/webhook`,
      events,
      jqlFilter,
      enabled: true,
      self: result.self || '',
    };
  }

  /**
   * List registered webhooks
   *
   * @returns Array of webhook registrations
   */
  async listWebhooks(): Promise<JiraWebhookRegistration[]> {
    const result = await this.apiRequest<{ values: any[] }>('/webhook');

    return result.values.map((w: any) => ({
      id: w.id,
      name: w.name || `Webhook ${w.id}`,
      url: w.url,
      events: w.events,
      jqlFilter: w.filters?.['issue-related-events-section'],
      enabled: w.enabled,
      self: w.self,
      lastUpdatedUser: w.lastUpdatedUser,
      lastUpdatedDisplayName: w.lastUpdatedDisplayName,
    }));
  }

  /**
   * Delete a webhook
   *
   * @param webhookId - Webhook ID
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.apiRequest('/webhook', {
      method: 'DELETE',
      body: JSON.stringify({
        webhookIds: [webhookId],
      }),
    });
  }

  /**
   * Handle incoming webhook notification
   *
   * @param payload - Webhook payload
   * @returns Parsed event data
   */
  handleWebhookNotification(payload: JiraWebhookPayload): {
    eventType: JiraWebhookEvent;
    issue?: JiraIssue;
    changes?: Array<{
      field: string;
      from: string | undefined;
      to: string | undefined;
    }>;
    user?: JiraUser;
    timestamp: Date;
    comment?: JiraWebhookPayload['comment'];
    attachment?: JiraAttachment;
    sprint?: JiraSprint;
  } {
    const result: ReturnType<typeof this.handleWebhookNotification> = {
      eventType: payload.webhookEvent,
      timestamp: new Date(payload.timestamp),
    };

    if (payload.issue) {
      result.issue = payload.issue;
    }

    if (payload.user) {
      result.user = payload.user;
    }

    if (payload.changelog?.items) {
      result.changes = payload.changelog.items.map(item => ({
        field: item.field,
        from: item.fromString,
        to: item.toString,
      }));
    }

    if (payload.comment) {
      result.comment = payload.comment;
    }

    if (payload.attachment) {
      result.attachment = payload.attachment;
    }

    if (payload.sprint) {
      result.sprint = payload.sprint;
    }

    return result;
  }

  /**
   * Process webhook and trigger ORACLE sync
   *
   * @param payload - Webhook payload
   * @param syncMapping - Existing sync mapping if available
   * @returns Sync result or null if no sync needed
   */
  async processWebhookForSync(
    payload: JiraWebhookPayload,
    syncMapping?: JiraOracleSyncMapping
  ): Promise<JiraSyncResult | null> {
    const event = this.handleWebhookNotification(payload);

    // Only process issue events
    if (!event.issue) {
      return null;
    }

    // If we have a sync mapping, update ORACLE
    if (syncMapping) {
      const changesApplied: JiraSyncResult['changesApplied'] = [];

      if (event.changes) {
        for (const change of event.changes) {
          changesApplied.push({
            field: change.field,
            oldValue: change.from,
            newValue: change.to,
          });
        }
      }

      return {
        success: true,
        direction: 'jira_to_oracle',
        jiraIssueKey: event.issue.key,
        oracleTaskId: syncMapping.oracleTaskId,
        changesApplied,
      };
    }

    return null;
  }

  // ==========================================================================
  // Signal Conversion Methods
  // ==========================================================================

  /**
   * Determine urgency from priority
   */
  determineUrgency(priority: string): 'critical' | 'high' | 'medium' | 'low' {
    const priorityLower = priority.toLowerCase();

    for (const [urgency, priorities] of Object.entries(this.priorityMapping)) {
      if (priorities.some((p) => p.toLowerCase() === priorityLower)) {
        return urgency as 'critical' | 'high' | 'medium' | 'low';
      }
    }

    return 'medium';
  }

  /**
   * Map issue type to signal type
   */
  private mapIssueType(issueType: string): JiraSignal['type'] {
    const typeLower = issueType.toLowerCase();

    if (typeLower.includes('epic')) return 'epic';
    if (typeLower.includes('story') || typeLower.includes('user story')) return 'story';
    if (typeLower.includes('bug')) return 'bug';
    if (typeLower.includes('sub-task') || typeLower.includes('subtask')) return 'subtask';
    if (typeLower.includes('task')) return 'task';

    return 'issue';
  }

  /**
   * Convert a Jira issue to an ORACLE signal
   */
  issueToSignal(issue: JiraIssue, baseUrl: string): JiraSignal {
    return {
      id: `jira-${issue.id}`,
      source: 'jira',
      type: this.mapIssueType(issue.fields.issuetype.name),
      urgency: this.determineUrgency(issue.fields.priority.name),
      title: issue.fields.summary,
      description: issue.fields.description || '',
      metadata: {
        project_key: issue.fields.project.key,
        issue_key: issue.key,
        issue_type: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        priority: issue.fields.priority.name,
        assignee: issue.fields.assignee?.displayName || null,
        reporter: issue.fields.reporter.displayName,
        sprint: issue.fields.sprint?.name || null,
        due_date: issue.fields.duedate,
        labels: issue.fields.labels,
        url: `${baseUrl}/browse/${issue.key}`,
        created_at: issue.fields.created,
        updated_at: issue.fields.updated,
      },
    };
  }

  /**
   * Import issues as ORACLE signals using JQL
   */
  async importIssuesAsSignals(
    jql: string,
    baseUrl: string
  ): Promise<JiraSignal[]> {
    const results = await this.searchIssues(jql, { maxResults: 100 });
    return results.issues.map((issue) => this.issueToSignal(issue, baseUrl));
  }

  // ==========================================================================
  // Bidirectional Sync Methods
  // ==========================================================================

  /**
   * Create Jira issue from ORACLE signal
   */
  async createIssueFromSignal(
    projectKey: string,
    signal: {
      id: string;
      title: string;
      description?: string;
      urgency: 'critical' | 'high' | 'medium' | 'low';
      type?: 'task' | 'bug' | 'story';
      assignee?: string;
      labels?: string[];
      dueDate?: string;
    }
  ): Promise<JiraIssue> {
    // Map urgency to priority
    const priorityMap: Record<string, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    const issueType = signal.type === 'bug' ? 'Bug' :
                      signal.type === 'story' ? 'Story' : 'Task';

    const description = [
      signal.description || '',
      '',
      '---',
      `*Created from ORACLE Signal: ${signal.id}*`,
    ].join('\n');

    return this.createIssue({
      projectKey,
      issueType,
      summary: signal.title,
      description,
      assignee: signal.assignee,
      priority: priorityMap[signal.urgency],
      labels: ['oracle-signal', ...(signal.labels || [])],
      dueDate: signal.dueDate,
    });
  }

  /**
   * Sync ORACLE update to Jira issue
   */
  async syncUpdateToIssue(
    issueKey: string,
    update: {
      type: 'status_change' | 'progress_update' | 'decision_made';
      title: string;
      details?: string;
    }
  ): Promise<void> {
    const comment = [
      `**ORACLE Update: ${update.title}**`,
      '',
      update.details || '',
      '',
      `_Synced at ${new Date().toISOString()}_`,
    ].join('\n');

    await this.addComment(issueKey, comment);
  }

  /**
   * Create sync mapping between Jira issue and ORACLE task
   *
   * @param jiraIssue - Jira issue
   * @param oracleTaskId - ORACLE task ID
   * @param direction - Sync direction
   * @returns Sync mapping
   */
  createSyncMapping(
    jiraIssue: JiraIssue,
    oracleTaskId: string,
    direction: JiraOracleSyncMapping['syncDirection'] = 'bidirectional'
  ): JiraOracleSyncMapping {
    return {
      jiraIssueId: jiraIssue.id,
      jiraIssueKey: jiraIssue.key,
      oracleTaskId,
      syncDirection: direction,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'synced',
    };
  }

  /**
   * Detect conflicts between Jira and ORACLE
   *
   * @param jiraIssue - Jira issue
   * @param oracleTask - ORACLE task data
   * @param lastSync - Last sync timestamp
   * @returns Conflict detection result
   */
  detectSyncConflicts(
    jiraIssue: JiraIssue,
    oracleTask: {
      title?: string;
      description?: string;
      priority?: string;
      status?: string;
      updatedAt?: string;
    },
    lastSync: string
  ): {
    hasConflicts: boolean;
    conflicts: Array<{
      field: string;
      jiraValue: any;
      oracleValue: any;
    }>;
  } {
    const conflicts: Array<{ field: string; jiraValue: any; oracleValue: any }> = [];
    const lastSyncDate = new Date(lastSync);
    const jiraUpdated = new Date(jiraIssue.fields.updated) > lastSyncDate;
    const oracleUpdated = oracleTask.updatedAt ? new Date(oracleTask.updatedAt) > lastSyncDate : false;

    // Only check for conflicts if both sides updated since last sync
    if (jiraUpdated && oracleUpdated) {
      if (jiraIssue.fields.summary !== oracleTask.title) {
        conflicts.push({
          field: 'title',
          jiraValue: jiraIssue.fields.summary,
          oracleValue: oracleTask.title,
        });
      }

      const oraclePriority = this.determineUrgency(jiraIssue.fields.priority.name);
      if (oraclePriority !== oracleTask.priority) {
        conflicts.push({
          field: 'priority',
          jiraValue: jiraIssue.fields.priority.name,
          oracleValue: oracleTask.priority,
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  // ==========================================================================
  // Workload Analysis Methods
  // ==========================================================================

  /**
   * Analyze workload for a user
   *
   * @param accountId - User account ID
   * @param projectKeys - Optional project filter
   * @returns Workload analysis
   *
   * Time Complexity: O(n) where n = number of assigned issues
   */
  async analyzeWorkload(
    accountId: string,
    projectKeys?: string[]
  ): Promise<WorkloadAnalysis> {
    // Build JQL query
    const builder = new JQLBuilder()
      .assignee(accountId)
      .status(['To Do', 'In Progress', 'In Review']);

    if (projectKeys?.length) {
      builder.project(projectKeys);
    }

    const jql = builder.build();
    const results = await this.searchIssues(jql, { maxResults: 200 });

    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let totalStoryPoints = 0;
    let estimatedHours = 0;
    let overdueCount = 0;
    let dueThisWeek = 0;
    const issuesByPriority: Record<string, number> = {};
    const issuesByStatus: Record<string, number> = {};

    for (const issue of results.issues) {
      // Count by priority
      const priority = issue.fields.priority.name;
      issuesByPriority[priority] = (issuesByPriority[priority] || 0) + 1;

      // Count by status
      const status = issue.fields.status.name;
      issuesByStatus[status] = (issuesByStatus[status] || 0) + 1;

      // Sum story points
      const storyPointsField = this.customFieldMapping.story_points;
      if (storyPointsField && issue.fields[storyPointsField]) {
        totalStoryPoints += Number(issue.fields[storyPointsField]) || 0;
      }

      // Sum time estimates
      if (issue.fields.timeoriginalestimate) {
        estimatedHours += issue.fields.timeoriginalestimate / 3600;
      }

      // Check due dates
      if (issue.fields.duedate) {
        const dueDate = new Date(issue.fields.duedate);
        if (dueDate < now) {
          overdueCount++;
        } else if (dueDate <= oneWeekFromNow) {
          dueThisWeek++;
        }
      }
    }

    // Calculate workload score (0-100)
    // Higher score = more overloaded
    let workloadScore = 0;

    // Base score from issue count (max 40 points)
    workloadScore += Math.min(results.total * 2, 40);

    // Points for overdue items (max 30 points)
    workloadScore += Math.min(overdueCount * 10, 30);

    // Points for high priority items (max 20 points)
    const highPriorityCount =
      (issuesByPriority['Highest'] || 0) +
      (issuesByPriority['High'] || 0) +
      (issuesByPriority['Blocker'] || 0);
    workloadScore += Math.min(highPriorityCount * 5, 20);

    // Points for items due this week (max 10 points)
    workloadScore += Math.min(dueThisWeek * 2, 10);

    // Generate recommendations
    const recommendations: string[] = [];

    if (overdueCount > 0) {
      recommendations.push(
        `Address ${overdueCount} overdue issue(s) immediately`
      );
    }

    if (highPriorityCount > 3) {
      recommendations.push(
        'Consider delegating some high-priority items'
      );
    }

    if (results.total > 15) {
      recommendations.push(
        'Workload is high - review and prioritize tasks'
      );
    }

    if (dueThisWeek > 5) {
      recommendations.push(
        `${dueThisWeek} items due this week - plan accordingly`
      );
    }

    if (workloadScore >= 70) {
      recommendations.push(
        'Critical workload level - escalate to manager'
      );
    }

    return {
      user_id: accountId,
      user_name: results.issues[0]?.fields.assignee?.displayName || 'Unknown',
      assigned_issues: results.total,
      total_story_points: totalStoryPoints,
      estimated_hours: Math.round(estimatedHours * 10) / 10,
      issues_by_priority: issuesByPriority,
      issues_by_status: issuesByStatus,
      overdue_count: overdueCount,
      due_this_week: dueThisWeek,
      workload_score: Math.min(workloadScore, 100),
      recommendations,
    };
  }

  /**
   * Analyze team workload
   */
  async analyzeTeamWorkload(
    projectKeys: string[]
  ): Promise<WorkloadAnalysis[]> {
    // Get all assignees for the projects
    const jql = new JQLBuilder()
      .project(projectKeys)
      .status(['To Do', 'In Progress', 'In Review'])
      .build();

    const results = await this.searchIssues(jql, { maxResults: 500 });

    // Get unique assignees
    const assigneeIds = new Set<string>();
    for (const issue of results.issues) {
      if (issue.fields.assignee?.accountId) {
        assigneeIds.add(issue.fields.assignee.accountId);
      }
    }

    // Analyze each assignee
    const analyses: WorkloadAnalysis[] = [];
    for (const accountId of assigneeIds) {
      const analysis = await this.analyzeWorkload(accountId, projectKeys);
      analyses.push(analysis);
    }

    // Sort by workload score (highest first)
    analyses.sort((a, b) => b.workload_score - a.workload_score);

    return analyses;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a JiraService instance
 *
 * @param priorityMapping - Optional custom priority mapping
 * @param customFieldMapping - Optional custom field mapping
 * @returns Configured service instance
 */
export function createJiraService(
  priorityMapping?: Partial<PriorityMapping>,
  customFieldMapping?: CustomFieldMapping
): JiraService {
  const clientId = process.env.JIRA_CLIENT_ID || '';
  const clientSecret = process.env.JIRA_CLIENT_SECRET || '';
  const redirectUri = process.env.JIRA_REDIRECT_URI || 'http://localhost:3001/oauth/jira/callback';

  return new JiraService(
    clientId,
    clientSecret,
    redirectUri,
    priorityMapping,
    customFieldMapping
  );
}

/**
 * Create a new JQL builder instance
 */
export function createJQLBuilder(): JQLBuilder {
  return new JQLBuilder();
}

export default JiraService;
