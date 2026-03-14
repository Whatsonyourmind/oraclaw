/**
 * GitHub Integration Routes for ORACLE v2.0
 *
 * Provides webhook handling, repository listing, and issue management
 * for the GitHub App integration.
 *
 * @module routes/oracle/integrations/github
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  GitHubService,
  createGitHubService,
  GitHubWebhookEvent,
  GitHubWebhookPayload,
  GitHubSignal,
} from '../../../services/oracle/integrations/github';

// ============================================================================
// Type Definitions
// ============================================================================

interface WebhookBody {
  action: string;
  [key: string]: unknown;
}

interface CreateIssueBody {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

interface CreateIssueFromDecisionBody {
  owner: string;
  repo: string;
  decision_id: string;
  title: string;
  description?: string;
  selected_option?: string;
  rationale?: string;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  assignees?: string[];
}

interface SyncCommentBody {
  owner: string;
  repo: string;
  issue_number: number;
  update_type: 'status_change' | 'progress_update' | 'decision_made' | 'action_completed';
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ImportIssuesBody {
  owner: string;
  repo: string;
  since?: string;
}

interface ListReposQuery {
  installation_id: number;
  page?: number;
  per_page?: number;
}

interface ListIssuesQuery {
  installation_id: number;
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string;
  assignee?: string;
  since?: string;
  page?: number;
  per_page?: number;
}

// ============================================================================
// Mock Storage (Replace with database in production)
// ============================================================================

// Store signals created from GitHub events
const signalStore = new Map<string, GitHubSignal>();

// Store installation ID to user mapping
const installationUserMap = new Map<number, string>();

// ============================================================================
// Route Definitions
// ============================================================================

export async function githubIntegrationRoutes(fastify: FastifyInstance) {
  // Get service instance
  const getService = (installationId?: number): GitHubService => {
    const service = createGitHubService();
    if (installationId) {
      service.setInstallationId(installationId);
    }
    return service;
  };

  // ==========================================================================
  // Webhook Routes
  // ==========================================================================

  /**
   * POST /api/integrations/github/webhook - Handle GitHub webhook events
   *
   * Receives webhook events from GitHub and converts them to ORACLE signals.
   * Verifies webhook signature for security.
   */
  fastify.post('/api/integrations/github/webhook', {
    config: {
      rawBody: true, // Need raw body for signature verification
    },
  }, async (
    request: FastifyRequest<{ Body: WebhookBody }>,
    reply: FastifyReply
  ) => {
    try {
      const signature = request.headers['x-hub-signature-256'] as string;
      const event = request.headers['x-github-event'] as GitHubWebhookEvent;
      const deliveryId = request.headers['x-github-delivery'] as string;

      if (!signature || !event) {
        reply.code(400).send({
          success: false,
          error: 'Missing required headers',
        });
        return;
      }

      const service = getService();

      // Verify webhook signature
      const rawBody = JSON.stringify(request.body);
      if (!service.verifyWebhookSignature(signature, rawBody)) {
        fastify.log.warn(`Invalid webhook signature for delivery ${deliveryId}`);
        reply.code(401).send({
          success: false,
          error: 'Invalid signature',
        });
        return;
      }

      fastify.log.info(`Received GitHub webhook: event=${event}, delivery=${deliveryId}`);

      // Process the webhook
      const payload = request.body as unknown as GitHubWebhookPayload;
      const result = service.processWebhook(event, payload);

      if (result.signal && result.action !== 'none') {
        // Store or update the signal
        if (result.action === 'delete') {
          signalStore.delete(result.signal.id);
          fastify.log.info(`Deleted signal: ${result.signal.id}`);
        } else {
          signalStore.set(result.signal.id, result.signal);
          fastify.log.info(`${result.action === 'create' ? 'Created' : 'Updated'} signal: ${result.signal.id}`);
        }

        // In production, emit to event bus or queue for processing
        // await eventBus.emit('github.signal', { signal: result.signal, action: result.action });
      }

      reply.code(200).send({
        success: true,
        data: {
          delivery_id: deliveryId,
          event,
          action: result.action,
          signal_id: result.signal?.id || null,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      // Always return 200 to acknowledge receipt (GitHub will retry on errors)
      reply.code(200).send({
        success: false,
        error: 'Processing failed',
      });
    }
  });

  // ==========================================================================
  // Repository Routes
  // ==========================================================================

  /**
   * GET /api/integrations/github/repos - List accessible repositories
   *
   * Lists all repositories that the GitHub App installation has access to.
   */
  fastify.get('/api/integrations/github/repos', async (
    request: FastifyRequest<{ Querystring: ListReposQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { installation_id, page = 1, per_page = 30 } = request.query;

      if (!installation_id) {
        reply.code(400).send({
          success: false,
          error: 'Missing installation_id parameter',
        });
        return;
      }

      const service = getService(installation_id);

      const result = await service.listRepositories(page, per_page);

      reply.code(200).send({
        success: true,
        data: {
          repositories: result.repositories.map((repo) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            owner: repo.owner.login,
            description: repo.description,
            default_branch: repo.default_branch,
            open_issues_count: repo.open_issues_count,
            html_url: repo.html_url,
          })),
          total_count: result.total_count,
          page,
          per_page,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to list repositories',
      });
    }
  });

  /**
   * GET /api/integrations/github/repos/:owner/:repo - Get specific repository
   */
  fastify.get('/api/integrations/github/repos/:owner/:repo', async (
    request: FastifyRequest<{
      Params: { owner: string; repo: string };
      Querystring: { installation_id: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { owner, repo } = request.params;
      const { installation_id } = request.query;

      if (!installation_id) {
        reply.code(400).send({
          success: false,
          error: 'Missing installation_id parameter',
        });
        return;
      }

      const service = getService(installation_id);
      const repository = await service.getRepository(owner, repo);

      reply.code(200).send({
        success: true,
        data: { repository },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to get repository',
      });
    }
  });

  // ==========================================================================
  // Issue Routes
  // ==========================================================================

  /**
   * GET /api/integrations/github/issues - List issues
   *
   * Lists issues from a repository with optional filters.
   */
  fastify.get('/api/integrations/github/issues', async (
    request: FastifyRequest<{ Querystring: ListIssuesQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const {
        installation_id,
        owner,
        repo,
        state,
        labels,
        assignee,
        since,
        page,
        per_page,
      } = request.query;

      if (!installation_id || !owner || !repo) {
        reply.code(400).send({
          success: false,
          error: 'Missing required parameters: installation_id, owner, repo',
        });
        return;
      }

      const service = getService(installation_id);

      const issues = await service.listIssues(owner, repo, {
        state,
        labels: labels?.split(','),
        assignee,
        since,
        page,
        per_page,
      });

      // Convert to signals for ORACLE integration
      const signals = issues.map((issue) =>
        service.issueToSignal(issue, `${owner}/${repo}`)
      );

      reply.code(200).send({
        success: true,
        data: {
          issues: issues.map((issue) => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: issue.labels.map((l) => l.name),
            assignees: issue.assignees.map((a) => a.login),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            html_url: issue.html_url,
          })),
          signals,
          count: issues.length,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to list issues',
      });
    }
  });

  /**
   * POST /api/integrations/github/issues - Create a new issue
   */
  fastify.post('/api/integrations/github/issues', async (
    request: FastifyRequest<{
      Body: CreateIssueBody;
      Querystring: { installation_id: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { installation_id } = request.query;
      const { owner, repo, title, body, labels, assignees, milestone } = request.body;

      if (!installation_id) {
        reply.code(400).send({
          success: false,
          error: 'Missing installation_id parameter',
        });
        return;
      }

      if (!owner || !repo || !title) {
        reply.code(400).send({
          success: false,
          error: 'Missing required fields: owner, repo, title',
        });
        return;
      }

      const service = getService(installation_id);

      const issue = await service.createIssue(owner, repo, {
        title,
        body,
        labels,
        assignees,
        milestone,
      });

      // Create and store signal
      const signal = service.issueToSignal(issue, `${owner}/${repo}`);
      signalStore.set(signal.id, signal);

      reply.code(201).send({
        success: true,
        data: {
          issue: {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            html_url: issue.html_url,
          },
          signal,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to create issue',
      });
    }
  });

  /**
   * POST /api/integrations/github/issues/from-decision - Create issue from ORACLE decision
   */
  fastify.post('/api/integrations/github/issues/from-decision', async (
    request: FastifyRequest<{
      Body: CreateIssueFromDecisionBody;
      Querystring: { installation_id: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { installation_id } = request.query;
      const {
        owner,
        repo,
        decision_id,
        title,
        description,
        selected_option,
        rationale,
        urgency,
        assignees,
      } = request.body;

      if (!installation_id) {
        reply.code(400).send({
          success: false,
          error: 'Missing installation_id parameter',
        });
        return;
      }

      if (!owner || !repo || !decision_id || !title) {
        reply.code(400).send({
          success: false,
          error: 'Missing required fields: owner, repo, decision_id, title',
        });
        return;
      }

      const service = getService(installation_id);

      const issue = await service.createIssueFromDecision(owner, repo, {
        id: decision_id,
        title,
        description,
        selectedOption: selected_option,
        rationale,
        urgency,
        assignees,
      });

      reply.code(201).send({
        success: true,
        data: {
          issue: {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            html_url: issue.html_url,
          },
          decision_id,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to create issue from decision',
      });
    }
  });

  /**
   * POST /api/integrations/github/issues/import - Import issues as ORACLE signals
   */
  fastify.post('/api/integrations/github/issues/import', async (
    request: FastifyRequest<{
      Body: ImportIssuesBody;
      Querystring: { installation_id: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { installation_id } = request.query;
      const { owner, repo, since } = request.body;

      if (!installation_id) {
        reply.code(400).send({
          success: false,
          error: 'Missing installation_id parameter',
        });
        return;
      }

      if (!owner || !repo) {
        reply.code(400).send({
          success: false,
          error: 'Missing required fields: owner, repo',
        });
        return;
      }

      const service = getService(installation_id);

      const signals = await service.importIssuesAsSignals(owner, repo, since);

      // Store all signals
      for (const signal of signals) {
        signalStore.set(signal.id, signal);
      }

      reply.code(200).send({
        success: true,
        data: {
          signals,
          imported_count: signals.length,
          repository: `${owner}/${repo}`,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to import issues',
      });
    }
  });

  // ==========================================================================
  // Comment Sync Routes
  // ==========================================================================

  /**
   * POST /api/integrations/github/comments/sync - Sync ORACLE update as comment
   */
  fastify.post('/api/integrations/github/comments/sync', async (
    request: FastifyRequest<{
      Body: SyncCommentBody;
      Querystring: { installation_id: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { installation_id } = request.query;
      const {
        owner,
        repo,
        issue_number,
        update_type,
        title,
        description,
        metadata,
      } = request.body;

      if (!installation_id) {
        reply.code(400).send({
          success: false,
          error: 'Missing installation_id parameter',
        });
        return;
      }

      if (!owner || !repo || !issue_number || !update_type || !title) {
        reply.code(400).send({
          success: false,
          error: 'Missing required fields',
        });
        return;
      }

      const service = getService(installation_id);

      const comment = await service.syncOracleUpdate(owner, repo, issue_number, {
        type: update_type,
        title,
        description,
        metadata,
      });

      reply.code(201).send({
        success: true,
        data: {
          comment: {
            id: comment.id,
            html_url: comment.html_url,
            created_at: comment.created_at,
          },
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to sync comment',
      });
    }
  });

  // ==========================================================================
  // Signal Routes
  // ==========================================================================

  /**
   * GET /api/integrations/github/signals - List GitHub signals
   */
  fastify.get('/api/integrations/github/signals', async (
    request: FastifyRequest<{
      Querystring: { type?: string; urgency?: string; repo?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { type, urgency, repo } = request.query;

      let signals = Array.from(signalStore.values());

      // Apply filters
      if (type) {
        signals = signals.filter((s) => s.type === type);
      }
      if (urgency) {
        signals = signals.filter((s) => s.urgency === urgency);
      }
      if (repo) {
        signals = signals.filter((s) => s.metadata.repo === repo);
      }

      // Sort by urgency priority
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      signals.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      reply.code(200).send({
        success: true,
        data: {
          signals,
          count: signals.length,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to list signals',
      });
    }
  });

  /**
   * DELETE /api/integrations/github/signals/:signal_id - Delete a signal
   */
  fastify.delete('/api/integrations/github/signals/:signal_id', async (
    request: FastifyRequest<{ Params: { signal_id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { signal_id } = request.params;

      if (!signalStore.has(signal_id)) {
        reply.code(404).send({
          success: false,
          error: 'Signal not found',
        });
        return;
      }

      signalStore.delete(signal_id);

      reply.code(200).send({
        success: true,
        data: { deleted: true, signal_id },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to delete signal',
      });
    }
  });

  // ==========================================================================
  // Pull Request Routes
  // ==========================================================================

  /**
   * GET /api/integrations/github/pulls - List pull requests
   */
  fastify.get('/api/integrations/github/pulls', async (
    request: FastifyRequest<{
      Querystring: {
        installation_id: number;
        owner: string;
        repo: string;
        state?: 'open' | 'closed' | 'all';
        page?: number;
        per_page?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { installation_id, owner, repo, state, page, per_page } = request.query;

      if (!installation_id || !owner || !repo) {
        reply.code(400).send({
          success: false,
          error: 'Missing required parameters: installation_id, owner, repo',
        });
        return;
      }

      const service = getService(installation_id);

      const pullRequests = await service.listPullRequests(owner, repo, {
        state,
        page,
        per_page,
      });

      // Convert to signals
      const signals = pullRequests.map((pr) =>
        service.pullRequestToSignal(pr, `${owner}/${repo}`)
      );

      reply.code(200).send({
        success: true,
        data: {
          pull_requests: pullRequests.map((pr) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            merged: pr.merged,
            draft: pr.draft,
            head_ref: pr.head.ref,
            base_ref: pr.base.ref,
            labels: pr.labels.map((l) => l.name),
            assignees: pr.assignees.map((a) => a.login),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            html_url: pr.html_url,
          })),
          signals,
          count: pullRequests.length,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to list pull requests',
      });
    }
  });
}

export default githubIntegrationRoutes;
