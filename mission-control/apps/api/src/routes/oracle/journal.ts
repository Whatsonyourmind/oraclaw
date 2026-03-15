/**
 * ORACLE Decision Journal API Routes
 * Story adv-17 - Journal entry management, search, and export
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  DecisionJournalEntry,
  JournalAttachment,
  JournalFollowup,
  JournalSearchFilters,
  JournalStats,
  JournalExport,
  JournalOutcomeStatus,
  JournalCategory,
  JournalImportance,
  JournalTimePressure,
  JournalFollowupType,
  APIResponse,
} from '@mission-control/shared-types';
import { decisionJournalService } from '../../services/oracle/decisionJournal';

// Request body types
interface CreateEntryBody {
  decision_id?: string;
  title: string;
  situation: string;
  options_considered?: string[];
  chosen_option?: string;
  reasoning?: string;
  category?: JournalCategory;
  importance?: JournalImportance;
  tags?: string[];
  time_pressure?: JournalTimePressure;
  deliberation_time_hours?: number;
  emotional_state_before?: string;
  stress_level?: number;
  confidence_in_decision?: number;
  stakeholders_involved?: string[];
  stakeholders_affected?: string[];
  is_private?: boolean;
  metadata?: Record<string, any>;
}

interface UpdateEntryBody {
  title?: string;
  situation?: string;
  options_considered?: string[];
  chosen_option?: string;
  reasoning?: string;
  outcome_status?: JournalOutcomeStatus;
  outcome_description?: string;
  outcome_date?: string;
  reflection?: string;
  lessons_learned?: string[];
  would_decide_differently?: boolean;
  alternative_considered?: string;
  tags?: string[];
  category?: JournalCategory;
  importance?: JournalImportance;
  emotional_state_after?: string;
  is_private?: boolean;
  is_favorite?: boolean;
  metadata?: Record<string, any>;
}

interface RecordOutcomeBody {
  status: JournalOutcomeStatus;
  description: string;
  date?: string;
}

interface AddReflectionBody {
  text: string;
  lessons_learned?: string[];
  would_decide_differently?: boolean;
  alternative_considered?: string;
  emotional_state_after?: string;
}

interface AddAttachmentBody {
  file_name: string;
  file_type: 'image' | 'document' | 'link' | 'note';
  file_path?: string;
  description?: string;
}

interface CreateFollowupBody {
  followup_type: JournalFollowupType;
  scheduled_date: string;
  notes?: string;
}

interface SearchQuery {
  query?: string;
  categories?: string;
  tags?: string;
  outcome_status?: string;
  importance?: string;
  date_from?: string;
  date_to?: string;
  favorites_only?: string;
  has_reflection?: string;
  has_outcome?: string;
}

interface ListQuery {
  limit?: string;
  offset?: string;
  sort_by?: 'decision_date' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

interface ExportQuery {
  format?: 'json' | 'csv' | 'markdown' | 'pdf';
}

export async function journalRoutes(fastify: FastifyInstance) {
  // =====================================================
  // JOURNAL ENTRY CRUD
  // =====================================================

  // POST /api/oracle/journal - Create journal entry
  fastify.post('/api/oracle/journal', async (
    request: FastifyRequest<{ Body: CreateEntryBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      const entry = await decisionJournalService.createEntry({
        user_id: userId,
        ...body,
      });

      const response: APIResponse<DecisionJournalEntry> = {
        success: true,
        data: entry,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create journal entry',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal - List journal entries
  fastify.get('/api/oracle/journal', async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const query = request.query;

      const entries = await decisionJournalService.listEntries({
        user_id: userId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        sort_by: query.sort_by,
        sort_order: query.sort_order,
      });

      const response: APIResponse<DecisionJournalEntry[]> = {
        success: true,
        data: entries,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list journal entries',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/:id - Get journal entry
  fastify.get('/api/oracle/journal/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const entry = await decisionJournalService.getEntry(id, userId);

      if (!entry) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Journal entry not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionJournalEntry> = {
        success: true,
        data: entry,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get journal entry',
      };
      return reply.status(500).send(response);
    }
  });

  // PATCH /api/oracle/journal/:id - Update journal entry
  fastify.patch('/api/oracle/journal/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateEntryBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = request.body;

      const entry = await decisionJournalService.updateEntry(id, userId, body);

      if (!entry) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Journal entry not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionJournalEntry> = {
        success: true,
        data: entry,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update journal entry',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/journal/:id - Delete journal entry
  fastify.delete('/api/oracle/journal/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const deleted = await decisionJournalService.deleteEntry(id, userId);

      if (!deleted) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Journal entry not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete journal entry',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // SEARCH AND FILTER
  // =====================================================

  // GET /api/oracle/journal/search - Search journal entries
  fastify.get('/api/oracle/journal/search', async (
    request: FastifyRequest<{ Querystring: SearchQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const query = request.query;

      const filters: JournalSearchFilters = {
        query: query.query,
        categories: query.categories?.split(',') as JournalCategory[],
        tags: query.tags?.split(','),
        outcome_status: query.outcome_status?.split(',') as JournalOutcomeStatus[],
        importance: query.importance?.split(',') as JournalImportance[],
        date_from: query.date_from,
        date_to: query.date_to,
        favorites_only: query.favorites_only === 'true',
        has_reflection: query.has_reflection === 'true',
        has_outcome: query.has_outcome === 'true',
      };

      const entries = await decisionJournalService.searchEntries(userId, filters);

      const response: APIResponse<DecisionJournalEntry[]> = {
        success: true,
        data: entries,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search journal entries',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/tags - Get all user tags
  fastify.get('/api/oracle/journal/tags', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const tags = await decisionJournalService.getUserTags(userId);

      const response: APIResponse<string[]> = {
        success: true,
        data: tags,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tags',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // OUTCOME AND REFLECTION
  // =====================================================

  // POST /api/oracle/journal/:id/outcome - Record outcome
  fastify.post('/api/oracle/journal/:id/outcome', async (
    request: FastifyRequest<{ Params: { id: string }; Body: RecordOutcomeBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = request.body;

      const entry = await decisionJournalService.recordOutcome(id, userId, body);

      if (!entry) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Journal entry not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionJournalEntry> = {
        success: true,
        data: entry,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record outcome',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/journal/:id/reflection - Add reflection
  fastify.post('/api/oracle/journal/:id/reflection', async (
    request: FastifyRequest<{ Params: { id: string }; Body: AddReflectionBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = request.body;

      const entry = await decisionJournalService.addReflection(id, userId, body);

      if (!entry) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Journal entry not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionJournalEntry> = {
        success: true,
        data: entry,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add reflection',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // FAVORITES
  // =====================================================

  // POST /api/oracle/journal/:id/favorite - Toggle favorite
  fastify.post('/api/oracle/journal/:id/favorite', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const isFavorite = await decisionJournalService.toggleFavorite(id, userId);

      const response: APIResponse<{ is_favorite: boolean }> = {
        success: true,
        data: { is_favorite: isFavorite },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle favorite',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // ATTACHMENTS
  // =====================================================

  // POST /api/oracle/journal/:id/attachments - Add attachment
  fastify.post('/api/oracle/journal/:id/attachments', async (
    request: FastifyRequest<{ Params: { id: string }; Body: AddAttachmentBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = request.body;

      const attachment = await decisionJournalService.addAttachment(id, userId, body);

      const response: APIResponse<JournalAttachment> = {
        success: true,
        data: attachment,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add attachment',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/:id/attachments - Get attachments
  fastify.get('/api/oracle/journal/:id/attachments', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const attachments = await decisionJournalService.getAttachments(id, userId);

      const response: APIResponse<JournalAttachment[]> = {
        success: true,
        data: attachments,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get attachments',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/journal/attachments/:attachmentId - Delete attachment
  fastify.delete('/api/oracle/journal/attachments/:attachmentId', async (
    request: FastifyRequest<{ Params: { attachmentId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { attachmentId } = request.params;

      const deleted = await decisionJournalService.deleteAttachment(attachmentId, userId);

      if (!deleted) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Attachment not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete attachment',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // FOLLOWUPS
  // =====================================================

  // POST /api/oracle/journal/:id/followups - Create followup
  fastify.post('/api/oracle/journal/:id/followups', async (
    request: FastifyRequest<{ Params: { id: string }; Body: CreateFollowupBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = request.body;

      const followup = await decisionJournalService.createFollowup({
        journal_id: id,
        user_id: userId,
        ...body,
      });

      const response: APIResponse<JournalFollowup> = {
        success: true,
        data: followup,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create followup',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/followups/pending - Get pending followups
  fastify.get('/api/oracle/journal/followups/pending', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const followups = await decisionJournalService.getPendingFollowups(userId);

      const response: APIResponse<JournalFollowup[]> = {
        success: true,
        data: followups,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending followups',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/followups/upcoming - Get upcoming followups
  fastify.get('/api/oracle/journal/followups/upcoming', async (
    request: FastifyRequest<{ Querystring: { days?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const days = request.query.days ? parseInt(request.query.days, 10) : 7;

      const followups = await decisionJournalService.getUpcomingFollowups(userId, days);

      const response: APIResponse<JournalFollowup[]> = {
        success: true,
        data: followups,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upcoming followups',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/journal/followups/:followupId/complete - Complete followup
  fastify.post('/api/oracle/journal/followups/:followupId/complete', async (
    request: FastifyRequest<{ Params: { followupId: string }; Body: { notes?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { followupId } = request.params;
      const { notes } = request.body || {};

      const followup = await decisionJournalService.completeFollowup(followupId, userId, notes);

      if (!followup) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Followup not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<JournalFollowup> = {
        success: true,
        data: followup,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete followup',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/journal/followups/:followupId/dismiss - Dismiss followup
  fastify.post('/api/oracle/journal/followups/:followupId/dismiss', async (
    request: FastifyRequest<{ Params: { followupId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { followupId } = request.params;

      const dismissed = await decisionJournalService.dismissFollowup(followupId, userId);

      if (!dismissed) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Followup not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ dismissed: boolean }> = {
        success: true,
        data: { dismissed: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dismiss followup',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // STATISTICS AND EXPORT
  // =====================================================

  // GET /api/oracle/journal/stats - Get journal statistics
  fastify.get('/api/oracle/journal/stats', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const stats = await decisionJournalService.getStats(userId);

      const response: APIResponse<JournalStats> = {
        success: true,
        data: stats,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/timeline - Get timeline view
  fastify.get('/api/oracle/journal/timeline', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const timeline = await decisionJournalService.getTimeline(userId);

      const response: APIResponse<Record<string, DecisionJournalEntry[]>> = {
        success: true,
        data: timeline,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get timeline',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/export - Export journal
  fastify.get('/api/oracle/journal/export', async (
    request: FastifyRequest<{ Querystring: ExportQuery & SearchQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { format = 'json', ...filterQuery } = request.query;

      const filters: JournalSearchFilters | undefined = filterQuery.query
        ? {
            query: filterQuery.query,
            categories: filterQuery.categories?.split(',') as JournalCategory[],
            tags: filterQuery.tags?.split(','),
            date_from: filterQuery.date_from,
            date_to: filterQuery.date_to,
          }
        : undefined;

      if (format === 'markdown') {
        const markdown = await decisionJournalService.exportToMarkdown(userId, filters);

        reply.header('Content-Type', 'text/markdown');
        reply.header('Content-Disposition', 'attachment; filename="decision-journal.md"');
        return reply.send(markdown);
      }

      const exportData = await decisionJournalService.exportJournal(userId, format, filters);

      if (format === 'json') {
        reply.header('Content-Disposition', 'attachment; filename="decision-journal.json"');
      }

      const response: APIResponse<JournalExport> = {
        success: true,
        data: exportData,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export journal',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // ORACLE DECISION INTEGRATION
  // =====================================================

  // POST /api/oracle/journal/from-decision - Create from ORACLE decision
  fastify.post('/api/oracle/journal/from-decision', async (
    request: FastifyRequest<{
      Body: {
        decision_id: string;
        title: string;
        situation: string;
        options: string[];
        chosen_option: string;
        reasoning?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      const entry = await decisionJournalService.createFromDecision(userId, body.decision_id, {
        title: body.title,
        situation: body.situation,
        options: body.options,
        chosen_option: body.chosen_option,
        reasoning: body.reasoning,
      });

      const response: APIResponse<DecisionJournalEntry> = {
        success: true,
        data: entry,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create journal from decision',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/journal/for-decision/:decisionId - Get entries for a decision
  fastify.get('/api/oracle/journal/for-decision/:decisionId', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { decisionId } = request.params;

      const entries = await decisionJournalService.getEntriesForDecision(userId, decisionId);

      const response: APIResponse<DecisionJournalEntry[]> = {
        success: true,
        data: entries,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get entries for decision',
      };
      return reply.status(500).send(response);
    }
  });
}
