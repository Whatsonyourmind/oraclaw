/**
 * ORACLE Natural Language Query API Routes
 * Story adv-24 - Natural language query endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { APIResponse } from '@mission-control/shared-types';
import { naturalLanguageService, QueryResult, ConversationContext } from '../../services/oracle/naturalLanguage';

// Request body types
interface QueryBody {
  query: string;
  conversation_id?: string;
}

// Mock user ID (would come from auth in production)
const getMockUserId = () => 'mock-user-id';

export async function queryRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/query - Process natural language query
  fastify.post('/api/oracle/query', async (
    request: FastifyRequest<{ Body: QueryBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { query, conversation_id } = request.body;

      if (!query || !query.trim()) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Query is required',
        };
        return reply.status(400).send(response);
      }

      const result = await naturalLanguageService.processQuery(
        userId,
        query.trim(),
        conversation_id
      );

      const response: APIResponse<QueryResult & { conversation_id: string }> = {
        success: true,
        data: {
          ...result,
          conversation_id: conversation_id || naturalLanguageService.getUserConversations(userId).slice(-1)[0]?.id || '',
        },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process query',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/query/conversations - Get user's conversations
  fastify.get('/api/oracle/query/conversations', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const conversations = naturalLanguageService.getUserConversations(userId);

      const response: APIResponse<ConversationContext[]> = {
        success: true,
        data: conversations,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversations',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/query/conversations/:id - Get conversation by ID
  fastify.get('/api/oracle/query/conversations/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const conversation = naturalLanguageService.getConversation(id);

      if (!conversation) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Conversation not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<ConversationContext> = {
        success: true,
        data: conversation,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/query/conversations/:id - Clear conversation
  fastify.delete('/api/oracle/query/conversations/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const cleared = naturalLanguageService.clearConversation(id);

      if (!cleared) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Conversation not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ cleared: boolean }> = {
        success: true,
        data: { cleared: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear conversation',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/query/suggestions - Get query suggestions
  fastify.get('/api/oracle/query/suggestions', async (
    request: FastifyRequest<{ Querystring: { context?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { context } = request.query;

      // Return contextual suggestions
      let suggestions: string[];

      if (context === 'signals') {
        suggestions = [
          "What signals need attention?",
          "Show me critical alerts",
          "What are the upcoming deadlines?",
          "Any new opportunities?",
        ];
      } else if (context === 'decisions') {
        suggestions = [
          "What decisions are pending?",
          "Help me decide on the top priority",
          "What are my options?",
          "Show decision history",
        ];
      } else if (context === 'analytics') {
        suggestions = [
          "How am I doing this week?",
          "Show my prediction accuracy",
          "What's my success rate?",
          "Compare to last month",
        ];
      } else {
        suggestions = [
          "What's my current status?",
          "What needs attention?",
          "Show me recommendations",
          "What are my pending decisions?",
          "How am I doing today?",
        ];
      }

      const response: APIResponse<string[]> = {
        success: true,
        data: suggestions,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get suggestions',
      };
      return reply.status(500).send(response);
    }
  });
}
