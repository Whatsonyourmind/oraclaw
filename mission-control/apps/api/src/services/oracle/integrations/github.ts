/**
 * GitHub Integration Service for ORACLE v2.0
 *
 * Provides GitHub App authentication with JWT and installation tokens,
 * issue import as ORACLE signals, auto-creation of issues from decisions,
 * PR status webhooks, label mapping to urgency levels, and comment sync.
 *
 * @module services/oracle/integrations/github
 */

import * as crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * GitHub App installation token data
 */
export interface GitHubInstallationToken {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: 'all' | 'selected';
}

/**
 * GitHub repository data
 */
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: 'User' | 'Organization';
  };
  html_url: string;
  description: string | null;
  default_branch: string;
  open_issues_count: number;
  visibility: 'public' | 'private' | 'internal';
}

/**
 * GitHub issue data
 */
export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: 'completed' | 'reopened' | 'not_planned' | null;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  assignees: Array<{
    login: string;
    id: number;
    avatar_url: string;
  }>;
  milestone: {
    id: number;
    number: number;
    title: string;
    due_on: string | null;
  } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  comments: number;
}

/**
 * GitHub pull request data
 */
export interface GitHubPullRequest {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  draft: boolean;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    id: number;
  }>;
  requested_reviewers: Array<{
    login: string;
    id: number;
  }>;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub comment data
 */
export interface GitHubComment {
  id: number;
  node_id: string;
  body: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * GitHub webhook event types
 */
export type GitHubWebhookEvent =
  | 'issues'
  | 'issue_comment'
  | 'pull_request'
  | 'pull_request_review'
  | 'push'
  | 'create'
  | 'delete'
  | 'release';

/**
 * GitHub webhook payload base
 */
export interface GitHubWebhookPayload {
  action: string;
  sender: {
    login: string;
    id: number;
  };
  repository: GitHubRepository;
  installation?: {
    id: number;
  };
}

/**
 * Issue webhook payload
 */
export interface GitHubIssueWebhookPayload extends GitHubWebhookPayload {
  action: 'opened' | 'edited' | 'deleted' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'labeled' | 'unlabeled';
  issue: GitHubIssue;
  label?: { name: string; color: string };
  assignee?: { login: string; id: number };
}

/**
 * Pull request webhook payload
 */
export interface GitHubPRWebhookPayload extends GitHubWebhookPayload {
  action: 'opened' | 'edited' | 'closed' | 'reopened' | 'synchronize' | 'ready_for_review' | 'converted_to_draft';
  pull_request: GitHubPullRequest;
}

/**
 * Issue comment webhook payload
 */
export interface GitHubCommentWebhookPayload extends GitHubWebhookPayload {
  action: 'created' | 'edited' | 'deleted';
  issue: GitHubIssue;
  comment: GitHubComment;
}

/**
 * ORACLE signal created from GitHub
 */
export interface GitHubSignal {
  id: string;
  source: 'github';
  type: 'issue' | 'pr' | 'comment' | 'review';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metadata: {
    repo: string;
    number: number;
    url: string;
    author: string;
    labels: string[];
    assignees: string[];
    created_at: string;
    updated_at: string;
  };
}

/**
 * Label to urgency mapping configuration
 */
export interface LabelMappingConfig {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_LABEL_MAPPING: LabelMappingConfig = {
  critical: ['critical', 'blocker', 'urgent', 'P0', 'severity: critical', 'priority: critical'],
  high: ['high', 'important', 'P1', 'severity: high', 'priority: high', 'bug'],
  medium: ['medium', 'P2', 'severity: medium', 'priority: medium', 'enhancement'],
  low: ['low', 'P3', 'P4', 'severity: low', 'priority: low', 'nice to have', 'documentation'],
};

// ============================================================================
// GitHub Service Class
// ============================================================================

/**
 * GitHubService - Full integration with GitHub API
 *
 * Features:
 * - GitHub App authentication (JWT + installation tokens)
 * - Issue import as ORACLE signals
 * - Auto-create issues from decisions
 * - PR status webhooks
 * - Label mapping to urgency levels
 * - Comment sync
 *
 * Time Complexity:
 * - Most operations: O(1) API calls
 * - Issue list: O(n) where n = number of issues
 * - Label mapping: O(m) where m = number of labels
 */
export class GitHubService {
  private appId: string;
  private privateKey: string;
  private webhookSecret: string;
  private installationId: number | null = null;
  private installationToken: GitHubInstallationToken | null = null;
  private labelMapping: LabelMappingConfig;
  private baseUrl = 'https://api.github.com';

  /**
   * Initialize GitHub service with App credentials
   *
   * @param appId - GitHub App ID
   * @param privateKey - GitHub App private key (PEM format)
   * @param webhookSecret - Webhook secret for signature verification
   * @param labelMapping - Custom label to urgency mapping
   */
  constructor(
    appId: string,
    privateKey: string,
    webhookSecret: string,
    labelMapping?: Partial<LabelMappingConfig>
  ) {
    this.appId = appId;
    this.privateKey = privateKey;
    this.webhookSecret = webhookSecret;
    this.labelMapping = {
      ...DEFAULT_LABEL_MAPPING,
      ...labelMapping,
    };
  }

  // ==========================================================================
  // JWT & Authentication Methods
  // ==========================================================================

  /**
   * Generate a JWT for GitHub App authentication
   *
   * @returns JWT token string
   *
   * Time Complexity: O(1)
   */
  generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago to account for clock drift
      exp: now + 10 * 60, // Expires in 10 minutes (max allowed)
      iss: this.appId,
    };

    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(this.privateKey, 'base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Base64 URL encode helper
   */
  private base64UrlEncode(data: string): string {
    return Buffer.from(data)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Get an installation token for API requests
   *
   * @param installationId - GitHub App installation ID
   * @returns Installation token data
   */
  async getInstallationToken(installationId: number): Promise<GitHubInstallationToken> {
    // Check if we have a valid cached token
    if (
      this.installationToken &&
      this.installationId === installationId &&
      new Date(this.installationToken.expires_at) > new Date(Date.now() + 5 * 60 * 1000)
    ) {
      return this.installationToken;
    }

    const jwt = this.generateJWT();

    const response = await fetch(
      `${this.baseUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get installation token: ${error}`);
    }

    const token = await response.json() as GitHubInstallationToken;
    this.installationId = installationId;
    this.installationToken = token;

    return token;
  }

  /**
   * Set installation ID for subsequent API calls
   *
   * @param installationId - GitHub App installation ID
   */
  setInstallationId(installationId: number): void {
    this.installationId = installationId;
  }

  /**
   * Make an authenticated API request
   *
   * @param endpoint - API endpoint (without base URL)
   * @param options - Fetch options
   * @returns Response data
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.installationId) {
      throw new Error('Installation ID not set. Call setInstallationId() first.');
    }

    const token = await this.getInstallationToken(this.installationId);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ==========================================================================
  // Webhook Verification
  // ==========================================================================

  /**
   * Verify webhook signature
   *
   * @param signature - X-Hub-Signature-256 header value
   * @param payload - Raw request body
   * @returns Whether signature is valid
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!signature.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = 'sha256=' +
      crypto.createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Repository Methods
  // ==========================================================================

  /**
   * List repositories accessible by the installation
   *
   * @param page - Page number
   * @param perPage - Results per page
   * @returns List of repositories
   */
  async listRepositories(
    page: number = 1,
    perPage: number = 30
  ): Promise<{ repositories: GitHubRepository[]; total_count: number }> {
    const response = await this.apiRequest<{
      total_count: number;
      repositories: GitHubRepository[];
    }>(`/installation/repositories?page=${page}&per_page=${perPage}`);

    return response;
  }

  /**
   * Get a specific repository
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository data
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.apiRequest<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  // ==========================================================================
  // Issue Methods
  // ==========================================================================

  /**
   * List issues for a repository
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - Filter options
   * @returns List of issues
   */
  async listIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      labels?: string[];
      assignee?: string;
      since?: string;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams();

    if (options.state) params.set('state', options.state);
    if (options.labels?.length) params.set('labels', options.labels.join(','));
    if (options.assignee) params.set('assignee', options.assignee);
    if (options.since) params.set('since', options.since);
    if (options.page) params.set('page', options.page.toString());
    if (options.per_page) params.set('per_page', options.per_page.toString());

    const queryString = params.toString();
    const endpoint = `/repos/${owner}/${repo}/issues${queryString ? `?${queryString}` : ''}`;

    return this.apiRequest<GitHubIssue[]>(endpoint);
  }

  /**
   * Get a specific issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   * @returns Issue data
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
    return this.apiRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  /**
   * Create a new issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issue - Issue data
   * @returns Created issue
   */
  async createIssue(
    owner: string,
    repo: string,
    issue: {
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
      milestone?: number;
    }
  ): Promise<GitHubIssue> {
    return this.apiRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(issue),
    });
  }

  /**
   * Update an existing issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   * @param updates - Issue updates
   * @returns Updated issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      state_reason?: 'completed' | 'not_planned' | 'reopened';
      labels?: string[];
      assignees?: string[];
      milestone?: number | null;
    }
  ): Promise<GitHubIssue> {
    return this.apiRequest<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
  }

  /**
   * Create an issue from an ORACLE decision
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param decision - ORACLE decision data
   * @returns Created issue
   */
  async createIssueFromDecision(
    owner: string,
    repo: string,
    decision: {
      id: string;
      title: string;
      description?: string;
      selectedOption?: string;
      rationale?: string;
      urgency?: 'critical' | 'high' | 'medium' | 'low';
      assignees?: string[];
    }
  ): Promise<GitHubIssue> {
    // Build issue body
    const bodyParts = [
      '## ORACLE Decision',
      '',
      `**Decision ID:** \`${decision.id}\``,
    ];

    if (decision.description) {
      bodyParts.push('', '### Description', decision.description);
    }

    if (decision.selectedOption) {
      bodyParts.push('', '### Selected Option', decision.selectedOption);
    }

    if (decision.rationale) {
      bodyParts.push('', '### Rationale', decision.rationale);
    }

    bodyParts.push(
      '',
      '---',
      '*Created automatically by ORACLE Decision System*'
    );

    // Map urgency to labels
    const labels: string[] = ['oracle-decision'];
    if (decision.urgency) {
      const urgencyLabel = `priority: ${decision.urgency}`;
      labels.push(urgencyLabel);
    }

    return this.createIssue(owner, repo, {
      title: `[ORACLE] ${decision.title}`,
      body: bodyParts.join('\n'),
      labels,
      assignees: decision.assignees,
    });
  }

  // ==========================================================================
  // Comment Methods
  // ==========================================================================

  /**
   * List comments on an issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   * @returns List of comments
   */
  async listComments(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubComment[]> {
    return this.apiRequest<GitHubComment[]>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`
    );
  }

  /**
   * Create a comment on an issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   * @param body - Comment body
   * @returns Created comment
   */
  async createComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<GitHubComment> {
    return this.apiRequest<GitHubComment>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      }
    );
  }

  /**
   * Update a comment
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param commentId - Comment ID
   * @param body - New comment body
   * @returns Updated comment
   */
  async updateComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<GitHubComment> {
    return this.apiRequest<GitHubComment>(
      `/repos/${owner}/${repo}/issues/comments/${commentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      }
    );
  }

  /**
   * Sync ORACLE update as a comment
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   * @param update - ORACLE update data
   * @returns Created comment
   */
  async syncOracleUpdate(
    owner: string,
    repo: string,
    issueNumber: number,
    update: {
      type: 'status_change' | 'progress_update' | 'decision_made' | 'action_completed';
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<GitHubComment> {
    const emoji = {
      status_change: ':arrows_counterclockwise:',
      progress_update: ':chart_with_upwards_trend:',
      decision_made: ':white_check_mark:',
      action_completed: ':rocket:',
    };

    const bodyParts = [
      `## ${emoji[update.type]} ORACLE Update: ${update.title}`,
    ];

    if (update.description) {
      bodyParts.push('', update.description);
    }

    if (update.metadata) {
      bodyParts.push(
        '',
        '### Details',
        '```json',
        JSON.stringify(update.metadata, null, 2),
        '```'
      );
    }

    bodyParts.push(
      '',
      `---`,
      `*Synced from ORACLE at ${new Date().toISOString()}*`
    );

    return this.createComment(owner, repo, issueNumber, bodyParts.join('\n'));
  }

  // ==========================================================================
  // Pull Request Methods
  // ==========================================================================

  /**
   * List pull requests for a repository
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - Filter options
   * @returns List of pull requests
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      head?: string;
      base?: string;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<GitHubPullRequest[]> {
    const params = new URLSearchParams();

    if (options.state) params.set('state', options.state);
    if (options.head) params.set('head', options.head);
    if (options.base) params.set('base', options.base);
    if (options.page) params.set('page', options.page.toString());
    if (options.per_page) params.set('per_page', options.per_page.toString());

    const queryString = params.toString();
    const endpoint = `/repos/${owner}/${repo}/pulls${queryString ? `?${queryString}` : ''}`;

    return this.apiRequest<GitHubPullRequest[]>(endpoint);
  }

  /**
   * Get a specific pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Pull request data
   */
  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubPullRequest> {
    return this.apiRequest<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  }

  // ==========================================================================
  // Signal Conversion Methods
  // ==========================================================================

  /**
   * Determine urgency level from labels
   *
   * @param labels - Issue/PR labels
   * @returns Urgency level
   *
   * Time Complexity: O(n * m) where n = labels, m = mapping entries
   */
  determineUrgency(labels: Array<{ name: string }>): 'critical' | 'high' | 'medium' | 'low' {
    const labelNames = labels.map((l) => l.name.toLowerCase());

    // Check in order of priority
    for (const urgency of ['critical', 'high', 'medium', 'low'] as const) {
      const mappedLabels = this.labelMapping[urgency].map((l) => l.toLowerCase());
      if (labelNames.some((name) => mappedLabels.includes(name))) {
        return urgency;
      }
    }

    // Default to medium if no matching labels
    return 'medium';
  }

  /**
   * Convert a GitHub issue to an ORACLE signal
   *
   * @param issue - GitHub issue
   * @param repoFullName - Full repository name (owner/repo)
   * @returns ORACLE signal
   */
  issueToSignal(issue: GitHubIssue, repoFullName: string): GitHubSignal {
    return {
      id: `github-issue-${issue.id}`,
      source: 'github',
      type: 'issue',
      urgency: this.determineUrgency(issue.labels),
      title: issue.title,
      description: issue.body || '',
      metadata: {
        repo: repoFullName,
        number: issue.number,
        url: issue.html_url,
        author: issue.user.login,
        labels: issue.labels.map((l) => l.name),
        assignees: issue.assignees.map((a) => a.login),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
      },
    };
  }

  /**
   * Convert a GitHub pull request to an ORACLE signal
   *
   * @param pr - GitHub pull request
   * @param repoFullName - Full repository name (owner/repo)
   * @returns ORACLE signal
   */
  pullRequestToSignal(pr: GitHubPullRequest, repoFullName: string): GitHubSignal {
    return {
      id: `github-pr-${pr.id}`,
      source: 'github',
      type: 'pr',
      urgency: this.determineUrgency(pr.labels),
      title: pr.title,
      description: pr.body || '',
      metadata: {
        repo: repoFullName,
        number: pr.number,
        url: pr.html_url,
        author: pr.head.ref,
        labels: pr.labels.map((l) => l.name),
        assignees: pr.assignees.map((a) => a.login),
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      },
    };
  }

  /**
   * Import all open issues from a repository as signals
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param since - Only import issues updated after this date
   * @returns Array of ORACLE signals
   */
  async importIssuesAsSignals(
    owner: string,
    repo: string,
    since?: string
  ): Promise<GitHubSignal[]> {
    const issues = await this.listIssues(owner, repo, {
      state: 'open',
      since,
      per_page: 100,
    });

    const repoFullName = `${owner}/${repo}`;

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const actualIssues = issues.filter((issue) => !('pull_request' in issue));

    return actualIssues.map((issue) => this.issueToSignal(issue, repoFullName));
  }

  // ==========================================================================
  // Webhook Handling
  // ==========================================================================

  /**
   * Process a webhook event and return ORACLE signals
   *
   * @param event - Event type from X-GitHub-Event header
   * @param payload - Parsed webhook payload
   * @returns Processed signal and action to take
   */
  processWebhook(
    event: GitHubWebhookEvent,
    payload: GitHubWebhookPayload
  ): {
    signal: GitHubSignal | null;
    action: 'create' | 'update' | 'delete' | 'none';
    metadata: Record<string, unknown>;
  } {
    const repoFullName = payload.repository.full_name;

    switch (event) {
      case 'issues': {
        const issuePayload = payload as GitHubIssueWebhookPayload;
        const signal = this.issueToSignal(issuePayload.issue, repoFullName);

        let action: 'create' | 'update' | 'delete' | 'none';
        switch (issuePayload.action) {
          case 'opened':
            action = 'create';
            break;
          case 'edited':
          case 'closed':
          case 'reopened':
          case 'assigned':
          case 'unassigned':
          case 'labeled':
          case 'unlabeled':
            action = 'update';
            break;
          case 'deleted':
            action = 'delete';
            break;
          default:
            action = 'none';
        }

        return {
          signal,
          action,
          metadata: {
            webhook_action: issuePayload.action,
            sender: issuePayload.sender.login,
          },
        };
      }

      case 'pull_request': {
        const prPayload = payload as GitHubPRWebhookPayload;
        const signal = this.pullRequestToSignal(prPayload.pull_request, repoFullName);

        let action: 'create' | 'update' | 'delete' | 'none';
        switch (prPayload.action) {
          case 'opened':
            action = 'create';
            break;
          case 'edited':
          case 'closed':
          case 'reopened':
          case 'synchronize':
          case 'ready_for_review':
          case 'converted_to_draft':
            action = 'update';
            break;
          default:
            action = 'none';
        }

        return {
          signal,
          action,
          metadata: {
            webhook_action: prPayload.action,
            sender: prPayload.sender.login,
            merged: prPayload.pull_request.merged,
          },
        };
      }

      case 'issue_comment': {
        const commentPayload = payload as GitHubCommentWebhookPayload;

        // Don't create signals for bot comments (avoid infinite loops)
        if (commentPayload.comment.user.login.endsWith('[bot]')) {
          return { signal: null, action: 'none', metadata: {} };
        }

        // Create a signal for the issue, not the comment
        const signal = this.issueToSignal(commentPayload.issue, repoFullName);

        return {
          signal,
          action: 'update',
          metadata: {
            webhook_action: commentPayload.action,
            comment_id: commentPayload.comment.id,
            comment_author: commentPayload.comment.user.login,
            comment_body: commentPayload.comment.body.substring(0, 500),
          },
        };
      }

      default:
        return { signal: null, action: 'none', metadata: {} };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a GitHubService instance
 *
 * @param labelMapping - Optional custom label mapping
 * @returns Configured service instance
 */
export function createGitHubService(
  labelMapping?: Partial<LabelMappingConfig>
): GitHubService {
  const appId = process.env.GITHUB_APP_ID || '';
  const privateKey = (process.env.GITHUB_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';

  return new GitHubService(appId, privateKey, webhookSecret, labelMapping);
}

export default GitHubService;
