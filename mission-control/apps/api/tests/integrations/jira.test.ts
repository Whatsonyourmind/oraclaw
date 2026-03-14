/**
 * Jira Integration Tests
 * Tests for Jira API operations with mocked responses
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: string | null;
    status: {
      id: string;
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    priority: {
      id: string;
      name: string;
    };
    issuetype: {
      id: string;
      name: string;
    };
    assignee: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    } | null;
    reporter: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    duedate: string | null;
    labels: string[];
    components: Array<{ id: string; name: string }>;
    customfield_10001?: number; // Story points
  };
}

interface JiraSearchResult {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

// ============================================================================
// Mock Jira Service
// ============================================================================

class JiraService {
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  private getAuthHeader(): string {
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    return `Basic ${auth}`;
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue/${issueKey}`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get issue: ${response.status}`);
    }

    return response.json();
  }

  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraSearchResult> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql,
          maxResults,
          fields: ['summary', 'status', 'priority', 'assignee', 'duedate', 'labels'],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    return response.json();
  }

  async createIssue(
    projectKey: string,
    summary: string,
    description: string,
    issueType: string = 'Task'
  ): Promise<JiraIssue> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }],
                },
              ],
            },
            issuetype: { name: issueType },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create issue: ${response.status}`);
    }

    return response.json();
  }

  async updateIssue(
    issueKey: string,
    updates: Partial<{ summary: string; description: string; assignee: string }>
  ): Promise<void> {
    const fields: Record<string, unknown> = {};

    if (updates.summary) {
      fields.summary = updates.summary;
    }
    if (updates.description) {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: updates.description }],
          },
        ],
      };
    }
    if (updates.assignee) {
      fields.assignee = { accountId: updates.assignee };
    }

    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue/${issueKey}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update issue: ${response.status}`);
    }
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get transitions: ${response.status}`);
    }

    const data = await response.json();
    return data.transitions;
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transition: { id: transitionId },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to transition issue: ${response.status}`);
    }
  }

  async getProjects(): Promise<JiraProject[]> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/project`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.status}`);
    }

    return response.json();
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.status}`);
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Jira Integration', () => {
  let jiraService: JiraService;
  let mockFetch: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    jiraService = new JiraService({
      baseUrl: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-api-token',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  // ============================================================================
  // Get Issue Tests
  // ============================================================================

  describe('getIssue', () => {
    it('should fetch a single issue by key', async () => {
      const mockIssue: JiraIssue = {
        id: '10001',
        key: 'TEST-1',
        self: 'https://test.atlassian.net/rest/api/3/issue/10001',
        fields: {
          summary: 'Test Issue',
          description: 'Test description',
          status: {
            id: '1',
            name: 'To Do',
            statusCategory: { key: 'new', name: 'To Do' },
          },
          priority: { id: '3', name: 'Medium' },
          issuetype: { id: '10001', name: 'Task' },
          assignee: null,
          reporter: {
            accountId: 'user-123',
            displayName: 'Test User',
            emailAddress: 'test@example.com',
          },
          created: '2024-01-01T10:00:00.000Z',
          updated: '2024-01-02T10:00:00.000Z',
          duedate: '2024-01-15',
          labels: ['oracle', 'high-priority'],
          components: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIssue),
      });

      const result = await jiraService.getIssue('TEST-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Basic /),
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.key).toBe('TEST-1');
      expect(result.fields.summary).toBe('Test Issue');
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(jiraService.getIssue('INVALID-1')).rejects.toThrow('Failed to get issue: 404');
    });

    it('should include proper authentication header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', key: 'TEST-1', fields: {} }),
      });

      await jiraService.getIssue('TEST-1');

      const authHeader = mockFetch.mock.calls[0][1].headers['Authorization'];
      expect(authHeader).toMatch(/^Basic /);

      // Decode and verify
      const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('test@example.com:test-api-token');
    });
  });

  // ============================================================================
  // Search Issues Tests
  // ============================================================================

  describe('searchIssues', () => {
    it('should search issues with JQL', async () => {
      const mockResult: JiraSearchResult = {
        startAt: 0,
        maxResults: 50,
        total: 2,
        issues: [
          {
            id: '10001',
            key: 'TEST-1',
            self: 'https://test.atlassian.net/rest/api/3/issue/10001',
            fields: {
              summary: 'Issue 1',
              description: null,
              status: {
                id: '1',
                name: 'To Do',
                statusCategory: { key: 'new', name: 'To Do' },
              },
              priority: { id: '3', name: 'Medium' },
              issuetype: { id: '10001', name: 'Task' },
              assignee: null,
              reporter: {
                accountId: 'user-1',
                displayName: 'User 1',
                emailAddress: 'user1@example.com',
              },
              created: '2024-01-01T10:00:00.000Z',
              updated: '2024-01-01T10:00:00.000Z',
              duedate: null,
              labels: [],
              components: [],
            },
          },
          {
            id: '10002',
            key: 'TEST-2',
            self: 'https://test.atlassian.net/rest/api/3/issue/10002',
            fields: {
              summary: 'Issue 2',
              description: null,
              status: {
                id: '2',
                name: 'In Progress',
                statusCategory: { key: 'indeterminate', name: 'In Progress' },
              },
              priority: { id: '2', name: 'High' },
              issuetype: { id: '10001', name: 'Task' },
              assignee: {
                accountId: 'user-2',
                displayName: 'User 2',
                emailAddress: 'user2@example.com',
              },
              reporter: {
                accountId: 'user-1',
                displayName: 'User 1',
                emailAddress: 'user1@example.com',
              },
              created: '2024-01-02T10:00:00.000Z',
              updated: '2024-01-02T10:00:00.000Z',
              duedate: '2024-01-20',
              labels: ['urgent'],
              components: [],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await jiraService.searchIssues('project = TEST AND status = "To Do"');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/search',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('project = TEST'),
        })
      );
      expect(result.total).toBe(2);
      expect(result.issues).toHaveLength(2);
    });

    it('should respect maxResults parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ startAt: 0, maxResults: 10, total: 0, issues: [] }),
      });

      await jiraService.searchIssues('project = TEST', 10);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.maxResults).toBe(10);
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          startAt: 0,
          maxResults: 50,
          total: 0,
          issues: [],
        }),
      });

      const result = await jiraService.searchIssues('project = EMPTY');

      expect(result.total).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should throw error on invalid JQL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(jiraService.searchIssues('invalid jql!')).rejects.toThrow('Search failed: 400');
    });
  });

  // ============================================================================
  // Create Issue Tests
  // ============================================================================

  describe('createIssue', () => {
    it('should create a new issue', async () => {
      const mockCreated: JiraIssue = {
        id: '10003',
        key: 'TEST-3',
        self: 'https://test.atlassian.net/rest/api/3/issue/10003',
        fields: {
          summary: 'New Issue',
          description: 'New description',
          status: {
            id: '1',
            name: 'To Do',
            statusCategory: { key: 'new', name: 'To Do' },
          },
          priority: { id: '3', name: 'Medium' },
          issuetype: { id: '10001', name: 'Task' },
          assignee: null,
          reporter: {
            accountId: 'user-1',
            displayName: 'User 1',
            emailAddress: 'user1@example.com',
          },
          created: '2024-01-10T10:00:00.000Z',
          updated: '2024-01-10T10:00:00.000Z',
          duedate: null,
          labels: [],
          components: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCreated),
      });

      const result = await jiraService.createIssue(
        'TEST',
        'New Issue',
        'New description'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.key).toBe('TEST-3');
    });

    it('should use default issue type when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', key: 'TEST-1', fields: {} }),
      });

      await jiraService.createIssue('TEST', 'Summary', 'Description');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.issuetype.name).toBe('Task');
    });

    it('should allow custom issue type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', key: 'TEST-1', fields: {} }),
      });

      await jiraService.createIssue('TEST', 'Summary', 'Description', 'Bug');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.issuetype.name).toBe('Bug');
    });

    it('should format description as Atlassian Document Format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', key: 'TEST-1', fields: {} }),
      });

      await jiraService.createIssue('TEST', 'Summary', 'My description text');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.description.type).toBe('doc');
      expect(body.fields.description.version).toBe(1);
      expect(body.fields.description.content[0].content[0].text).toBe('My description text');
    });
  });

  // ============================================================================
  // Update Issue Tests
  // ============================================================================

  describe('updateIssue', () => {
    it('should update issue summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await jiraService.updateIssue('TEST-1', { summary: 'Updated Summary' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.summary).toBe('Updated Summary');
    });

    it('should update issue assignee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await jiraService.updateIssue('TEST-1', { assignee: 'user-account-id' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.assignee.accountId).toBe('user-account-id');
    });

    it('should handle multiple field updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await jiraService.updateIssue('TEST-1', {
        summary: 'New Summary',
        description: 'New Description',
        assignee: 'user-123',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.summary).toBe('New Summary');
      expect(body.fields.assignee.accountId).toBe('user-123');
    });

    it('should throw on update failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(jiraService.updateIssue('TEST-1', { summary: 'New' }))
        .rejects.toThrow('Failed to update issue: 403');
    });
  });

  // ============================================================================
  // Transitions Tests
  // ============================================================================

  describe('Transitions', () => {
    it('should get available transitions', async () => {
      const mockTransitions: JiraTransition[] = [
        { id: '11', name: 'Start Progress', to: { id: '3', name: 'In Progress' } },
        { id: '21', name: 'Done', to: { id: '5', name: 'Done' } },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transitions: mockTransitions }),
      });

      const result = await jiraService.getTransitions('TEST-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Start Progress');
    });

    it('should transition an issue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await jiraService.transitionIssue('TEST-1', '21');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1/transitions',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.transition.id).toBe('21');
    });

    it('should throw on invalid transition', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(jiraService.transitionIssue('TEST-1', 'invalid'))
        .rejects.toThrow('Failed to transition issue: 400');
    });
  });

  // ============================================================================
  // Projects Tests
  // ============================================================================

  describe('getProjects', () => {
    it('should fetch all accessible projects', async () => {
      const mockProjects: JiraProject[] = [
        { id: '10000', key: 'TEST', name: 'Test Project', projectTypeKey: 'software' },
        { id: '10001', key: 'DEMO', name: 'Demo Project', projectTypeKey: 'software' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjects),
      });

      const result = await jiraService.getProjects();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('TEST');
    });
  });

  // ============================================================================
  // Comments Tests
  // ============================================================================

  describe('addComment', () => {
    it('should add comment to issue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await jiraService.addComment('TEST-1', 'This is a test comment');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1/comment',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.body.content[0].content[0].text).toBe('This is a test comment');
    });

    it('should throw on comment failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(jiraService.addComment('TEST-1', 'Comment'))
        .rejects.toThrow('Failed to add comment: 403');
    });
  });

  // ============================================================================
  // ORACLE Integration Tests
  // ============================================================================

  describe('ORACLE Integration Scenarios', () => {
    it('should find overdue issues for deadline risk assessment', async () => {
      const mockResult: JiraSearchResult = {
        startAt: 0,
        maxResults: 50,
        total: 3,
        issues: [
          {
            id: '1',
            key: 'TEST-1',
            self: '',
            fields: {
              summary: 'Overdue task',
              description: null,
              status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
              priority: { id: '1', name: 'High' },
              issuetype: { id: '1', name: 'Task' },
              assignee: null,
              reporter: { accountId: 'u1', displayName: 'User', emailAddress: 'u@test.com' },
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-01T00:00:00.000Z',
              duedate: '2024-01-01',
              labels: [],
              components: [],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await jiraService.searchIssues('duedate < now() AND status != Done');

      expect(result.issues.every(i => i.fields.duedate !== null)).toBe(true);
    });

    it('should find unassigned high priority issues', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          startAt: 0,
          maxResults: 50,
          total: 0,
          issues: [],
        }),
      });

      await jiraService.searchIssues('assignee = EMPTY AND priority in (High, Highest)');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.jql).toContain('assignee = EMPTY');
      expect(body.jql).toContain('priority');
    });

    it('should aggregate workload by assignee', async () => {
      const mockResult: JiraSearchResult = {
        startAt: 0,
        maxResults: 50,
        total: 4,
        issues: [
          {
            id: '1', key: 'TEST-1', self: '',
            fields: {
              summary: 'Task 1',
              description: null,
              status: { id: '1', name: 'In Progress', statusCategory: { key: 'ind', name: 'In Progress' } },
              priority: { id: '1', name: 'High' },
              issuetype: { id: '1', name: 'Task' },
              assignee: { accountId: 'user-a', displayName: 'Alice', emailAddress: 'alice@test.com' },
              reporter: { accountId: 'u1', displayName: 'User', emailAddress: 'u@test.com' },
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-01T00:00:00.000Z',
              duedate: null,
              labels: [],
              components: [],
              customfield_10001: 5,
            },
          },
          {
            id: '2', key: 'TEST-2', self: '',
            fields: {
              summary: 'Task 2',
              description: null,
              status: { id: '1', name: 'In Progress', statusCategory: { key: 'ind', name: 'In Progress' } },
              priority: { id: '2', name: 'Medium' },
              issuetype: { id: '1', name: 'Task' },
              assignee: { accountId: 'user-a', displayName: 'Alice', emailAddress: 'alice@test.com' },
              reporter: { accountId: 'u1', displayName: 'User', emailAddress: 'u@test.com' },
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-01T00:00:00.000Z',
              duedate: null,
              labels: [],
              components: [],
              customfield_10001: 3,
            },
          },
          {
            id: '3', key: 'TEST-3', self: '',
            fields: {
              summary: 'Task 3',
              description: null,
              status: { id: '1', name: 'In Progress', statusCategory: { key: 'ind', name: 'In Progress' } },
              priority: { id: '2', name: 'Medium' },
              issuetype: { id: '1', name: 'Task' },
              assignee: { accountId: 'user-b', displayName: 'Bob', emailAddress: 'bob@test.com' },
              reporter: { accountId: 'u1', displayName: 'User', emailAddress: 'u@test.com' },
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-01T00:00:00.000Z',
              duedate: null,
              labels: [],
              components: [],
              customfield_10001: 8,
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await jiraService.searchIssues('status = "In Progress"');

      // Aggregate by assignee
      const workload = new Map<string, number>();
      for (const issue of result.issues) {
        const assigneeId = issue.fields.assignee?.accountId || 'unassigned';
        const points = issue.fields.customfield_10001 || 0;
        workload.set(assigneeId, (workload.get(assigneeId) || 0) + points);
      }

      expect(workload.get('user-a')).toBe(8); // 5 + 3
      expect(workload.get('user-b')).toBe(8);
    });
  });
});
