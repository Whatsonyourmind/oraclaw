/**
 * ORACLE Collaborative Decisions API Routes
 * Story adv-19 - Multi-user decision support routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  DecisionCollaborator,
  DecisionVote,
  DecisionComment,
  DecisionShare,
  VoteAggregation,
  CollaborativeDecisionState,
  CollaboratorRole,
  VoteType,
  ShareType,
  APIResponse,
} from '@mission-control/shared-types';
import { collaborativeDecisionsService } from '../../services/oracle/collaborativeDecisions';

// Request body types
interface InviteCollaboratorBody {
  email: string;
  role: CollaboratorRole;
  message?: string;
}

interface AcceptInvitationBody {
  invite_email: string;
}

interface UpdateRoleBody {
  role: CollaboratorRole;
}

interface CastVoteBody {
  option_id: string;
  vote_type: VoteType;
  preference_rank?: number;
  rationale?: string;
  confidence?: number;
  is_final?: boolean;
}

interface AddCommentBody {
  option_id?: string;
  parent_id?: string;
  content: string;
  content_type?: 'text' | 'markdown' | 'rich';
  mentions?: string[];
}

interface EditCommentBody {
  content: string;
}

interface ReactionBody {
  emoji: string;
}

interface CreateShareBody {
  share_type: ShareType;
  requires_auth?: boolean;
  allowed_domains?: string[];
  max_uses?: number;
  expires_at?: string;
}

// Mock user ID (would come from auth in production)
const getMockUserId = () => 'mock-user-id';

export async function collaborativeRoutes(fastify: FastifyInstance) {
  // =====================================================
  // COLLABORATOR ROUTES
  // =====================================================

  // POST /api/oracle/collab/:decisionId/init - Initialize collaboration
  fastify.post('/api/oracle/collab/:decisionId/init', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;

      const owner = await collaborativeDecisionsService.initializeCollaboration(
        decisionId,
        userId
      );

      const response: APIResponse<DecisionCollaborator> = {
        success: true,
        data: owner,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize collaboration',
      };
      return reply.status(400).send(response);
    }
  });

  // POST /api/oracle/collab/:decisionId/invite - Invite collaborator
  fastify.post('/api/oracle/collab/:decisionId/invite', async (
    request: FastifyRequest<{ Params: { decisionId: string }; Body: InviteCollaboratorBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;
      const body = request.body;

      const collaborator = await collaborativeDecisionsService.inviteCollaborator(userId, {
        decision_id: decisionId,
        email: body.email,
        role: body.role,
        message: body.message,
      });

      const response: APIResponse<DecisionCollaborator> = {
        success: true,
        data: collaborator,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to invite collaborator',
      };
      return reply.status(400).send(response);
    }
  });

  // POST /api/oracle/collab/:decisionId/accept - Accept invitation
  fastify.post('/api/oracle/collab/:decisionId/accept', async (
    request: FastifyRequest<{ Params: { decisionId: string }; Body: AcceptInvitationBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;
      const { invite_email } = request.body;

      const collaborator = await collaborativeDecisionsService.acceptInvitation(
        userId,
        decisionId,
        invite_email
      );

      if (!collaborator) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Invitation not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionCollaborator> = {
        success: true,
        data: collaborator,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept invitation',
      };
      return reply.status(400).send(response);
    }
  });

  // GET /api/oracle/collab/:decisionId/collaborators - Get collaborators
  fastify.get('/api/oracle/collab/:decisionId/collaborators', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { decisionId } = request.params;
      const collaborators = await collaborativeDecisionsService.getCollaborators(decisionId);

      const response: APIResponse<DecisionCollaborator[]> = {
        success: true,
        data: collaborators,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get collaborators',
      };
      return reply.status(500).send(response);
    }
  });

  // PATCH /api/oracle/collab/:decisionId/collaborators/:collaboratorId - Update role
  fastify.patch('/api/oracle/collab/:decisionId/collaborators/:collaboratorId', async (
    request: FastifyRequest<{
      Params: { decisionId: string; collaboratorId: string };
      Body: UpdateRoleBody;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId, collaboratorId } = request.params;
      const { role } = request.body;

      const collaborator = await collaborativeDecisionsService.updateCollaboratorRole(
        decisionId,
        collaboratorId,
        role,
        userId
      );

      if (!collaborator) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Collaborator not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionCollaborator> = {
        success: true,
        data: collaborator,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update collaborator',
      };
      return reply.status(400).send(response);
    }
  });

  // DELETE /api/oracle/collab/:decisionId/collaborators/:collaboratorId - Remove collaborator
  fastify.delete('/api/oracle/collab/:decisionId/collaborators/:collaboratorId', async (
    request: FastifyRequest<{ Params: { decisionId: string; collaboratorId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId, collaboratorId } = request.params;

      const removed = await collaborativeDecisionsService.removeCollaborator(
        decisionId,
        collaboratorId,
        userId
      );

      if (!removed) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Collaborator not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ removed: boolean }> = {
        success: true,
        data: { removed: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove collaborator',
      };
      return reply.status(400).send(response);
    }
  });

  // =====================================================
  // VOTING ROUTES
  // =====================================================

  // POST /api/oracle/collab/:decisionId/votes - Cast vote
  fastify.post('/api/oracle/collab/:decisionId/votes', async (
    request: FastifyRequest<{ Params: { decisionId: string }; Body: CastVoteBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;
      const body = request.body;

      const vote = await collaborativeDecisionsService.castVote(userId, {
        decision_id: decisionId,
        option_id: body.option_id,
        vote_type: body.vote_type,
        preference_rank: body.preference_rank,
        rationale: body.rationale,
        confidence: body.confidence,
        is_final: body.is_final,
      });

      const response: APIResponse<DecisionVote> = {
        success: true,
        data: vote,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cast vote',
      };
      return reply.status(400).send(response);
    }
  });

  // GET /api/oracle/collab/:decisionId/votes - Get votes
  fastify.get('/api/oracle/collab/:decisionId/votes', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { decisionId } = request.params;
      const votes = await collaborativeDecisionsService.getVotes(decisionId);

      const response: APIResponse<DecisionVote[]> = {
        success: true,
        data: votes,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get votes',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/collab/:decisionId/votes/me - Get user's votes
  fastify.get('/api/oracle/collab/:decisionId/votes/me', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;

      const votes = await collaborativeDecisionsService.getUserVotes(decisionId, userId);

      const response: APIResponse<DecisionVote[]> = {
        success: true,
        data: votes,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user votes',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/collab/:decisionId/votes/:optionId - Retract vote
  fastify.delete('/api/oracle/collab/:decisionId/votes/:optionId', async (
    request: FastifyRequest<{ Params: { decisionId: string; optionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId, optionId } = request.params;

      const retracted = await collaborativeDecisionsService.retractVote(
        decisionId,
        optionId,
        userId
      );

      if (!retracted) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Vote not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ retracted: boolean }> = {
        success: true,
        data: { retracted: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retract vote',
      };
      return reply.status(400).send(response);
    }
  });

  // GET /api/oracle/collab/:decisionId/aggregation - Get vote aggregation
  fastify.get('/api/oracle/collab/:decisionId/aggregation', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { decisionId } = request.params;
      const aggregation = await collaborativeDecisionsService.getAggregation(decisionId);

      const response: APIResponse<VoteAggregation[]> = {
        success: true,
        data: aggregation,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get aggregation',
      };
      return reply.status(500).send(response);
    }
  });

  // =====================================================
  // COMMENT ROUTES
  // =====================================================

  // POST /api/oracle/collab/:decisionId/comments - Add comment
  fastify.post('/api/oracle/collab/:decisionId/comments', async (
    request: FastifyRequest<{ Params: { decisionId: string }; Body: AddCommentBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;
      const body = request.body;

      const comment = await collaborativeDecisionsService.addComment(userId, {
        decision_id: decisionId,
        option_id: body.option_id,
        parent_id: body.parent_id,
        content: body.content,
        content_type: body.content_type,
        mentions: body.mentions,
      });

      const response: APIResponse<DecisionComment> = {
        success: true,
        data: comment,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      };
      return reply.status(400).send(response);
    }
  });

  // GET /api/oracle/collab/:decisionId/comments - Get comments
  fastify.get('/api/oracle/collab/:decisionId/comments', async (
    request: FastifyRequest<{
      Params: { decisionId: string };
      Querystring: { option_id?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { decisionId } = request.params;
      const { option_id } = request.query;

      const comments = await collaborativeDecisionsService.getComments(
        decisionId,
        option_id
      );

      const response: APIResponse<DecisionComment[]> = {
        success: true,
        data: comments,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get comments',
      };
      return reply.status(500).send(response);
    }
  });

  // PATCH /api/oracle/collab/comments/:commentId - Edit comment
  fastify.patch('/api/oracle/collab/comments/:commentId', async (
    request: FastifyRequest<{
      Params: { commentId: string };
      Body: EditCommentBody;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { commentId } = request.params;
      const { content } = request.body;

      const comment = await collaborativeDecisionsService.editComment(
        commentId,
        userId,
        content
      );

      if (!comment) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Comment not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionComment> = {
        success: true,
        data: comment,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit comment',
      };
      return reply.status(400).send(response);
    }
  });

  // DELETE /api/oracle/collab/comments/:commentId - Delete comment
  fastify.delete('/api/oracle/collab/comments/:commentId', async (
    request: FastifyRequest<{ Params: { commentId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { commentId } = request.params;

      const deleted = await collaborativeDecisionsService.deleteComment(
        commentId,
        userId
      );

      if (!deleted) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Comment not found',
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
        error: error instanceof Error ? error.message : 'Failed to delete comment',
      };
      return reply.status(400).send(response);
    }
  });

  // POST /api/oracle/collab/comments/:commentId/reactions - Add reaction
  fastify.post('/api/oracle/collab/comments/:commentId/reactions', async (
    request: FastifyRequest<{ Params: { commentId: string }; Body: ReactionBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { commentId } = request.params;
      const { emoji } = request.body;

      const comment = await collaborativeDecisionsService.addReaction(
        commentId,
        userId,
        emoji
      );

      if (!comment) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Comment not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<DecisionComment> = {
        success: true,
        data: comment,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add reaction',
      };
      return reply.status(400).send(response);
    }
  });

  // DELETE /api/oracle/collab/comments/:commentId/reactions/:emoji - Remove reaction
  fastify.delete('/api/oracle/collab/comments/:commentId/reactions/:emoji', async (
    request: FastifyRequest<{ Params: { commentId: string; emoji: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { commentId, emoji } = request.params;

      const removed = await collaborativeDecisionsService.removeReaction(
        commentId,
        userId,
        emoji
      );

      const response: APIResponse<{ removed: boolean }> = {
        success: true,
        data: { removed },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove reaction',
      };
      return reply.status(400).send(response);
    }
  });

  // =====================================================
  // SHARE LINK ROUTES
  // =====================================================

  // POST /api/oracle/collab/:decisionId/share - Create share link
  fastify.post('/api/oracle/collab/:decisionId/share', async (
    request: FastifyRequest<{ Params: { decisionId: string }; Body: CreateShareBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;
      const body = request.body;

      const share = await collaborativeDecisionsService.createShareLink(userId, {
        decision_id: decisionId,
        share_type: body.share_type,
        requires_auth: body.requires_auth,
        allowed_domains: body.allowed_domains,
        max_uses: body.max_uses,
        expires_at: body.expires_at,
      });

      const response: APIResponse<DecisionShare> = {
        success: true,
        data: share,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create share link',
      };
      return reply.status(400).send(response);
    }
  });

  // GET /api/oracle/collab/:decisionId/shares - Get share links
  fastify.get('/api/oracle/collab/:decisionId/shares', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;

      const shares = await collaborativeDecisionsService.getShareLinks(
        decisionId,
        userId
      );

      const response: APIResponse<DecisionShare[]> = {
        success: true,
        data: shares,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get share links',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/collab/shared/:token - Access shared decision
  fastify.get('/api/oracle/collab/shared/:token', async (
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { token } = request.params;

      const result = await collaborativeDecisionsService.accessSharedDecision(token);

      if (!result) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Share link not found or expired',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ share: DecisionShare; decision_id: string }> = {
        success: true,
        data: result,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to access shared decision',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/collab/shares/:shareId - Deactivate share link
  fastify.delete('/api/oracle/collab/shares/:shareId', async (
    request: FastifyRequest<{ Params: { shareId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { shareId } = request.params;

      const deactivated = await collaborativeDecisionsService.deactivateShareLink(
        shareId,
        userId
      );

      if (!deactivated) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Share link not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<{ deactivated: boolean }> = {
        success: true,
        data: { deactivated: true },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate share link',
      };
      return reply.status(400).send(response);
    }
  });

  // =====================================================
  // STATE ROUTE
  // =====================================================

  // GET /api/oracle/collab/:decisionId/state - Get full collaborative state
  fastify.get('/api/oracle/collab/:decisionId/state', async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { decisionId } = request.params;

      const state = await collaborativeDecisionsService.getCollaborativeState(
        decisionId,
        userId
      );

      const response: APIResponse<CollaborativeDecisionState> = {
        success: true,
        data: state,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get collaborative state',
      };
      return reply.status(500).send(response);
    }
  });
}
