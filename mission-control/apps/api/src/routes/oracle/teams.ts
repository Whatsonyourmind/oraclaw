import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  Organization,
  Team,
  TeamMember,
  TeamInvite,
  OrgOracleSettings,
  APIResponse,
  OrgPlan,
  TeamMemberRole,
  TeamInviteStatus,
  CreateOrganizationRequest,
  CreateTeamRequest,
  InviteTeamMemberRequest,
  UpdateTeamMemberRequest,
  TeamWithMembers,
  OrganizationWithTeams,
} from '@mission-control/shared-types';

// Types for request bodies and params
interface OrgIdParams {
  id: string;
}

interface TeamIdParams {
  id: string;
}

interface MemberParams {
  id: string;
  userId: string;
}

interface InviteAcceptBody {
  token: string;
}

interface OrgFilters {
  limit?: number;
  offset?: number;
}

interface TeamFilters {
  org_id?: string;
  limit?: number;
  offset?: number;
}

interface MemberFilters {
  role?: TeamMemberRole;
  limit?: number;
  offset?: number;
}

// Mock user ID for now (would come from auth in production)
const getMockUserId = () => 'mock-user-id';
const getMockUserEmail = () => 'mock@example.com';

// In-memory stores for demo (would be database in production)
const orgsStore = new Map<string, Organization>();
const teamsStore = new Map<string, Team>();
const membersStore = new Map<string, TeamMember>();
const invitesStore = new Map<string, TeamInvite>();
const orgSettingsStore = new Map<string, OrgOracleSettings>();

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);
}

// Helper to generate invite token
function generateInviteToken(): string {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

export async function teamRoutes(fastify: FastifyInstance) {
  // ==========================================
  // ORGANIZATION ROUTES
  // ==========================================

  // POST /api/oracle/orgs - Create organization
  fastify.post('/api/oracle/orgs', async (
    request: FastifyRequest<{ Body: CreateOrganizationRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      if (!body.name || body.name.trim().length === 0) {
        reply.code(400);
        return { success: false, error: 'Organization name is required' };
      }

      const org: Organization = {
        id: crypto.randomUUID(),
        owner_id: userId,
        name: body.name.trim(),
        slug: body.slug || generateSlug(body.name),
        plan: body.plan || 'free',
        logo_url: undefined,
        billing_email: body.billing_email,
        is_active: true,
        trial_ends_at: undefined,
        settings: body.settings || {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      orgsStore.set(org.id, org);

      // Create default team (simulating the database trigger)
      const defaultTeam: Team = {
        id: crypto.randomUUID(),
        org_id: org.id,
        name: 'Default Team',
        description: 'Default team for the organization',
        is_default: true,
        settings: {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      teamsStore.set(defaultTeam.id, defaultTeam);

      // Add owner to default team
      const ownerMember: TeamMember = {
        id: crypto.randomUUID(),
        team_id: defaultTeam.id,
        user_id: userId,
        role: 'owner',
        invited_by: undefined,
        joined_at: new Date().toISOString(),
        permissions: {
          can_invite: true,
          can_manage_members: true,
          can_edit_settings: true,
          can_delete_team: true,
          can_view_analytics: true,
          can_export_data: true,
        },
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      membersStore.set(ownerMember.id, ownerMember);

      // Create default org settings
      const orgSettings: OrgOracleSettings = {
        id: crypto.randomUUID(),
        org_id: org.id,
        ai_enabled: true,
        default_ai_personality: undefined,
        ai_usage_limit_daily: undefined,
        features_enabled: {
          signals: true,
          decisions: true,
          plans: true,
          predictions: true,
        },
        default_decision_visibility: 'private',
        default_plan_visibility: 'private',
        require_2fa: false,
        allowed_domains: [],
        ip_whitelist: [],
        retention_days: 365,
        auto_archive_enabled: true,
        notification_settings: {
          email_enabled: true,
          push_enabled: true,
          slack_enabled: false,
          digest_frequency: 'daily',
        },
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      orgSettingsStore.set(org.id, orgSettings);

      const response: APIResponse<OrganizationWithTeams> = {
        success: true,
        data: {
          ...org,
          teams: [defaultTeam],
          team_count: 1,
        },
      };

      reply.code(201);
      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create organization' };
    }
  });

  // GET /api/oracle/orgs - List user's organizations
  fastify.get('/api/oracle/orgs', async (
    request: FastifyRequest<{ Querystring: OrgFilters }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { limit = 50, offset = 0 } = request.query;

      // Find orgs where user is owner or member
      const userOrgs: Organization[] = [];

      for (const org of orgsStore.values()) {
        if (org.owner_id === userId) {
          userOrgs.push(org);
        }
      }

      // Also check teams for membership
      for (const member of membersStore.values()) {
        if (member.user_id === userId) {
          const team = teamsStore.get(member.team_id);
          if (team) {
            const org = orgsStore.get(team.org_id);
            if (org && !userOrgs.find(o => o.id === org.id)) {
              userOrgs.push(org);
            }
          }
        }
      }

      const response: APIResponse<Organization[]> = {
        success: true,
        data: userOrgs.slice(offset, offset + limit),
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get organizations' };
    }
  });

  // GET /api/oracle/orgs/:id - Get organization by ID
  fastify.get('/api/oracle/orgs/:id', async (
    request: FastifyRequest<{ Params: OrgIdParams }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const org = orgsStore.get(id);

      if (!org) {
        reply.code(404);
        return { success: false, error: 'Organization not found' };
      }

      // Get teams for this org
      const teams: Team[] = [];
      for (const team of teamsStore.values()) {
        if (team.org_id === id) {
          teams.push(team);
        }
      }

      const response: APIResponse<OrganizationWithTeams> = {
        success: true,
        data: {
          ...org,
          teams,
          team_count: teams.length,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get organization' };
    }
  });

  // ==========================================
  // TEAM ROUTES
  // ==========================================

  // POST /api/oracle/orgs/:id/teams - Create team in organization
  fastify.post('/api/oracle/orgs/:id/teams', async (
    request: FastifyRequest<{ Params: OrgIdParams; Body: Omit<CreateTeamRequest, 'org_id'> }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { id: orgId } = request.params;
      const body = request.body;

      const org = orgsStore.get(orgId);
      if (!org) {
        reply.code(404);
        return { success: false, error: 'Organization not found' };
      }

      // Check if user is org owner or admin
      if (org.owner_id !== userId) {
        // Check for admin membership
        let isAdmin = false;
        for (const member of membersStore.values()) {
          const team = teamsStore.get(member.team_id);
          if (team && team.org_id === orgId && member.user_id === userId && ['owner', 'admin'].includes(member.role)) {
            isAdmin = true;
            break;
          }
        }
        if (!isAdmin) {
          reply.code(403);
          return { success: false, error: 'Not authorized to create teams in this organization' };
        }
      }

      if (!body.name || body.name.trim().length === 0) {
        reply.code(400);
        return { success: false, error: 'Team name is required' };
      }

      const team: Team = {
        id: crypto.randomUUID(),
        org_id: orgId,
        name: body.name.trim(),
        description: body.description,
        is_default: false,
        settings: body.settings || {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      teamsStore.set(team.id, team);

      // Add creator as team owner
      const creatorMember: TeamMember = {
        id: crypto.randomUUID(),
        team_id: team.id,
        user_id: userId,
        role: 'owner',
        invited_by: undefined,
        joined_at: new Date().toISOString(),
        permissions: {
          can_invite: true,
          can_manage_members: true,
          can_edit_settings: true,
          can_delete_team: true,
          can_view_analytics: true,
          can_export_data: true,
        },
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      membersStore.set(creatorMember.id, creatorMember);

      const response: APIResponse<TeamWithMembers> = {
        success: true,
        data: {
          ...team,
          members: [creatorMember],
          member_count: 1,
        },
      };

      reply.code(201);
      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create team' };
    }
  });

  // GET /api/oracle/teams - List user's teams
  fastify.get('/api/oracle/teams', async (
    request: FastifyRequest<{ Querystring: TeamFilters }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { org_id, limit = 50, offset = 0 } = request.query;

      const userTeams: Team[] = [];

      for (const member of membersStore.values()) {
        if (member.user_id === userId) {
          const team = teamsStore.get(member.team_id);
          if (team) {
            if (!org_id || team.org_id === org_id) {
              userTeams.push(team);
            }
          }
        }
      }

      const response: APIResponse<Team[]> = {
        success: true,
        data: userTeams.slice(offset, offset + limit),
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get teams' };
    }
  });

  // ==========================================
  // TEAM INVITE ROUTES
  // ==========================================

  // POST /api/oracle/teams/:id/invite - Send team invite
  fastify.post('/api/oracle/teams/:id/invite', async (
    request: FastifyRequest<{ Params: TeamIdParams; Body: Omit<InviteTeamMemberRequest, 'team_id'> }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { id: teamId } = request.params;
      const body = request.body;

      const team = teamsStore.get(teamId);
      if (!team) {
        reply.code(404);
        return { success: false, error: 'Team not found' };
      }

      // Check if user can invite (must be owner or admin)
      let canInvite = false;
      for (const member of membersStore.values()) {
        if (member.team_id === teamId && member.user_id === userId) {
          if (['owner', 'admin'].includes(member.role) || member.permissions.can_invite) {
            canInvite = true;
            break;
          }
        }
      }

      if (!canInvite) {
        reply.code(403);
        return { success: false, error: 'Not authorized to invite members to this team' };
      }

      if (!body.email || !body.email.includes('@')) {
        reply.code(400);
        return { success: false, error: 'Valid email is required' };
      }

      if ((body.role as string) === 'owner') {
        reply.code(400);
        return { success: false, error: 'Cannot invite as owner' };
      }

      // Check if already invited
      for (const invite of invitesStore.values()) {
        if (invite.team_id === teamId && invite.email === body.email && invite.status === 'pending') {
          reply.code(400);
          return { success: false, error: 'User already has a pending invite' };
        }
      }

      // Check if already a member
      for (const member of membersStore.values()) {
        if (member.team_id === teamId) {
          // In production, would check user email here
          // For now, skip this check
        }
      }

      const invite: TeamInvite = {
        id: crypto.randomUUID(),
        team_id: teamId,
        email: body.email.toLowerCase().trim(),
        role: body.role || 'member',
        invited_by: userId,
        token: generateInviteToken(),
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        accepted_at: undefined,
        accepted_by: undefined,
        message: body.message,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        team,
      };

      invitesStore.set(invite.id, invite);

      // In production, would send email here

      const response: APIResponse<TeamInvite> = {
        success: true,
        data: invite,
      };

      reply.code(201);
      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to send invite' };
    }
  });

  // POST /api/oracle/invites/accept - Accept team invite
  fastify.post('/api/oracle/invites/accept', async (
    request: FastifyRequest<{ Body: InviteAcceptBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const userEmail = getMockUserEmail();
      const { token } = request.body;

      if (!token) {
        reply.code(400);
        return { success: false, error: 'Invite token is required' };
      }

      // Find invite by token
      let invite: TeamInvite | undefined;
      for (const inv of invitesStore.values()) {
        if (inv.token === token) {
          invite = inv;
          break;
        }
      }

      if (!invite) {
        reply.code(404);
        return { success: false, error: 'Invite not found' };
      }

      // Check invite status
      if (invite.status !== 'pending') {
        reply.code(400);
        return { success: false, error: `Invite has already been ${invite.status}` };
      }

      // Check if expired
      if (new Date(invite.expires_at) < new Date()) {
        invite.status = 'expired';
        invite.updated_at = new Date().toISOString();
        invitesStore.set(invite.id, invite);
        reply.code(400);
        return { success: false, error: 'Invite has expired' };
      }

      // In production, would check if userEmail matches invite.email

      // Create team member
      const member: TeamMember = {
        id: crypto.randomUUID(),
        team_id: invite.team_id,
        user_id: userId,
        role: invite.role,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
        permissions: {
          can_invite: invite.role === 'admin',
          can_manage_members: invite.role === 'admin',
          can_edit_settings: invite.role === 'admin',
          can_delete_team: false,
          can_view_analytics: invite.role !== 'viewer',
          can_export_data: invite.role !== 'viewer',
        },
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      membersStore.set(member.id, member);

      // Update invite status
      invite.status = 'accepted';
      invite.accepted_at = new Date().toISOString();
      invite.accepted_by = userId;
      invite.updated_at = new Date().toISOString();
      invitesStore.set(invite.id, invite);

      const team = teamsStore.get(invite.team_id);

      const response: APIResponse<{ member: TeamMember; team: Team | undefined }> = {
        success: true,
        data: { member, team },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to accept invite' };
    }
  });

  // ==========================================
  // TEAM MEMBER ROUTES
  // ==========================================

  // GET /api/oracle/teams/:id/members - List team members
  fastify.get('/api/oracle/teams/:id/members', async (
    request: FastifyRequest<{ Params: TeamIdParams; Querystring: MemberFilters }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId();
      const { id: teamId } = request.params;
      const { role, limit = 50, offset = 0 } = request.query;

      const team = teamsStore.get(teamId);
      if (!team) {
        reply.code(404);
        return { success: false, error: 'Team not found' };
      }

      // Check if user is a member
      let isMember = false;
      for (const member of membersStore.values()) {
        if (member.team_id === teamId && member.user_id === userId) {
          isMember = true;
          break;
        }
      }

      if (!isMember) {
        reply.code(403);
        return { success: false, error: 'Not a member of this team' };
      }

      const members: TeamMember[] = [];
      for (const member of membersStore.values()) {
        if (member.team_id === teamId) {
          if (!role || member.role === role) {
            members.push(member);
          }
        }
      }

      const response: APIResponse<TeamMember[]> = {
        success: true,
        data: members.slice(offset, offset + limit),
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get team members' };
    }
  });

  // PATCH /api/oracle/teams/:id/members/:userId - Update member role
  fastify.patch('/api/oracle/teams/:id/members/:userId', async (
    request: FastifyRequest<{ Params: MemberParams; Body: UpdateTeamMemberRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const currentUserId = getMockUserId();
      const { id: teamId, userId: targetUserId } = request.params;
      const body = request.body;

      const team = teamsStore.get(teamId);
      if (!team) {
        reply.code(404);
        return { success: false, error: 'Team not found' };
      }

      // Check if current user can manage members
      let currentMember: TeamMember | undefined;
      for (const member of membersStore.values()) {
        if (member.team_id === teamId && member.user_id === currentUserId) {
          currentMember = member;
          break;
        }
      }

      if (!currentMember || (!['owner', 'admin'].includes(currentMember.role) && !currentMember.permissions.can_manage_members)) {
        reply.code(403);
        return { success: false, error: 'Not authorized to manage team members' };
      }

      // Find target member
      let targetMember: TeamMember | undefined;
      for (const member of membersStore.values()) {
        if (member.team_id === teamId && member.user_id === targetUserId) {
          targetMember = member;
          break;
        }
      }

      if (!targetMember) {
        reply.code(404);
        return { success: false, error: 'Member not found' };
      }

      // Prevent changing owner's role unless you're the owner
      if (targetMember.role === 'owner' && currentMember.role !== 'owner') {
        reply.code(403);
        return { success: false, error: 'Cannot change owner role' };
      }

      // Prevent non-owners from promoting to owner
      if (body.role === 'owner' && currentMember.role !== 'owner') {
        reply.code(403);
        return { success: false, error: 'Only owner can transfer ownership' };
      }

      // Update member
      if (body.role) {
        targetMember.role = body.role;
        // Update permissions based on new role
        targetMember.permissions = {
          can_invite: ['owner', 'admin'].includes(body.role),
          can_manage_members: ['owner', 'admin'].includes(body.role),
          can_edit_settings: ['owner', 'admin'].includes(body.role),
          can_delete_team: body.role === 'owner',
          can_view_analytics: body.role !== 'viewer',
          can_export_data: body.role !== 'viewer',
          ...body.permissions,
        };
      }

      if (body.permissions) {
        targetMember.permissions = { ...targetMember.permissions, ...body.permissions };
      }

      targetMember.updated_at = new Date().toISOString();
      membersStore.set(targetMember.id, targetMember);

      const response: APIResponse<TeamMember> = {
        success: true,
        data: targetMember,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update member' };
    }
  });

  // DELETE /api/oracle/teams/:id/members/:userId - Remove member from team
  fastify.delete('/api/oracle/teams/:id/members/:userId', async (
    request: FastifyRequest<{ Params: MemberParams }>,
    reply: FastifyReply
  ) => {
    try {
      const currentUserId = getMockUserId();
      const { id: teamId, userId: targetUserId } = request.params;

      const team = teamsStore.get(teamId);
      if (!team) {
        reply.code(404);
        return { success: false, error: 'Team not found' };
      }

      // Check if current user can manage members or is removing themselves
      let currentMember: TeamMember | undefined;
      for (const member of membersStore.values()) {
        if (member.team_id === teamId && member.user_id === currentUserId) {
          currentMember = member;
          break;
        }
      }

      const isSelfRemoval = currentUserId === targetUserId;

      if (!currentMember) {
        reply.code(403);
        return { success: false, error: 'Not a member of this team' };
      }

      if (!isSelfRemoval && !['owner', 'admin'].includes(currentMember.role) && !currentMember.permissions.can_manage_members) {
        reply.code(403);
        return { success: false, error: 'Not authorized to remove team members' };
      }

      // Find target member
      let targetMember: TeamMember | undefined;
      let targetMemberId: string | undefined;
      for (const [id, member] of membersStore.entries()) {
        if (member.team_id === teamId && member.user_id === targetUserId) {
          targetMember = member;
          targetMemberId = id;
          break;
        }
      }

      if (!targetMember || !targetMemberId) {
        reply.code(404);
        return { success: false, error: 'Member not found' };
      }

      // Prevent removing owner unless transferring ownership first
      if (targetMember.role === 'owner') {
        reply.code(400);
        return { success: false, error: 'Cannot remove team owner. Transfer ownership first.' };
      }

      membersStore.delete(targetMemberId);

      const response: APIResponse<{ removed: boolean; user_id: string }> = {
        success: true,
        data: { removed: true, user_id: targetUserId },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to remove member' };
    }
  });
}

export default teamRoutes;
