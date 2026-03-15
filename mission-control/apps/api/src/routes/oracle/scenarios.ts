/**
 * ORACLE Scenario Planning API Routes
 * Story adv-26 - What-if scenario analysis endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { APIResponse, Scenario, ScenarioVariable, ScenarioOutcome, ScenarioComparison, SensitivityAnalysis, CreateScenarioParams, UpdateVariableParams, RunSensitivityParams, CompareScenarioParams, ScenarioType, ScenarioStatus, VariableCategory, VariableType, ScenarioOutcomeType, SensitivityAnalysisType, VariableValue } from '@mission-control/shared-types';
import { scenarioPlanningService } from '../../services/oracle/scenarioPlanning';
import { getUserId } from '../../services/auth/authMiddleware.js';

export async function scenarioRoutes(fastify: FastifyInstance) {
  // ==================== SCENARIO CRUD ====================

  // POST /api/oracle/scenarios - Create new scenario
  fastify.post('/api/oracle/scenarios', async (
    request: FastifyRequest<{ Body: CreateScenarioParams }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const scenario = await scenarioPlanningService.createScenario(userId, request.body);

      const response: APIResponse<Scenario> = {
        success: true,
        data: scenario,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scenario',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios - List scenarios
  fastify.get('/api/oracle/scenarios', async (
    request: FastifyRequest<{
      Querystring: {
        decision_id?: string;
        scenario_type?: ScenarioType;
        status?: ScenarioStatus;
      }
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { decision_id, scenario_type, status } = request.query;

      const scenarios = await scenarioPlanningService.listScenarios(userId, {
        decision_id,
        scenario_type,
        status,
      });

      const response: APIResponse<Scenario[]> = {
        success: true,
        data: scenarios,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list scenarios',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios/:id - Get scenario by ID
  fastify.get('/api/oracle/scenarios/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const scenario = await scenarioPlanningService.getScenario(id);

      if (!scenario) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Scenario not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<Scenario> = {
        success: true,
        data: scenario,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scenario',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios/:id/full - Get full scenario state
  fastify.get('/api/oracle/scenarios/:id/full', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const state = await scenarioPlanningService.getFullScenarioState(id);

      if (!state.scenario) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Scenario not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<typeof state> = {
        success: true,
        data: state,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scenario state',
      };
      return reply.status(500).send(response);
    }
  });

  // PATCH /api/oracle/scenarios/:id - Update scenario
  fastify.patch('/api/oracle/scenarios/:id', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: Partial<Scenario>;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const scenario = await scenarioPlanningService.updateScenario(id, request.body);

      if (!scenario) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Scenario not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<Scenario> = {
        success: true,
        data: scenario,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scenario',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/scenarios/:id - Delete scenario
  fastify.delete('/api/oracle/scenarios/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const deleted = await scenarioPlanningService.deleteScenario(id);

      if (!deleted) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Scenario not found',
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
        error: error instanceof Error ? error.message : 'Failed to delete scenario',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/scenarios/:id/duplicate - Duplicate scenario
  fastify.post('/api/oracle/scenarios/:id/duplicate', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { name } = request.body;

      const scenario = await scenarioPlanningService.duplicateScenario(id, name);

      if (!scenario) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Original scenario not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<Scenario> = {
        success: true,
        data: scenario,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to duplicate scenario',
      };
      return reply.status(500).send(response);
    }
  });

  // ==================== VARIABLE MANAGEMENT ====================

  // POST /api/oracle/scenarios/:id/variables - Add variable
  fastify.post('/api/oracle/scenarios/:id/variables', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        name: string;
        description?: string;
        category: VariableCategory;
        variable_type: VariableType;
        current_value: VariableValue;
        baseline_value?: VariableValue;
        min_value?: VariableValue;
        max_value?: VariableValue;
        step_size?: VariableValue;
        options?: Array<{ value: string | number; label: string }>;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const variable = await scenarioPlanningService.addVariable(id, request.body);

      const response: APIResponse<ScenarioVariable> = {
        success: true,
        data: variable,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add variable',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios/:id/variables - Get variables
  fastify.get('/api/oracle/scenarios/:id/variables', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const variables = scenarioPlanningService.getScenarioVariables(id);

      const response: APIResponse<ScenarioVariable[]> = {
        success: true,
        data: variables,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get variables',
      };
      return reply.status(500).send(response);
    }
  });

  // PATCH /api/oracle/scenarios/variables/:variableId - Update variable value
  fastify.patch('/api/oracle/scenarios/variables/:variableId', async (
    request: FastifyRequest<{
      Params: { variableId: string };
      Body: { current_value: VariableValue };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { variableId } = request.params;
      const { current_value } = request.body;

      const variable = await scenarioPlanningService.updateVariable({
        variable_id: variableId,
        current_value,
      });

      if (!variable) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Variable not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<ScenarioVariable> = {
        success: true,
        data: variable,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update variable',
      };
      return reply.status(500).send(response);
    }
  });

  // DELETE /api/oracle/scenarios/variables/:variableId - Delete variable
  fastify.delete('/api/oracle/scenarios/variables/:variableId', async (
    request: FastifyRequest<{ Params: { variableId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { variableId } = request.params;
      const deleted = await scenarioPlanningService.deleteVariable(variableId);

      if (!deleted) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Variable not found',
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
        error: error instanceof Error ? error.message : 'Failed to delete variable',
      };
      return reply.status(500).send(response);
    }
  });

  // ==================== OUTCOME MANAGEMENT ====================

  // POST /api/oracle/scenarios/:id/outcomes - Add outcome
  fastify.post('/api/oracle/scenarios/:id/outcomes', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        outcome_type: ScenarioOutcomeType;
        name: string;
        description?: string;
        probability?: number;
        impact_score?: number;
        depends_on_variables?: string[];
        sensitivity_factors?: Record<string, number>;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const outcome = await scenarioPlanningService.addOutcome(id, request.body);

      const response: APIResponse<ScenarioOutcome> = {
        success: true,
        data: outcome,
      };
      return reply.status(201).send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add outcome',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios/:id/outcomes - Get outcomes
  fastify.get('/api/oracle/scenarios/:id/outcomes', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const outcomes = scenarioPlanningService.getScenarioOutcomes(id);

      const response: APIResponse<ScenarioOutcome[]> = {
        success: true,
        data: outcomes,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get outcomes',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/scenarios/:id/recalculate - Recalculate outcomes
  fastify.post('/api/oracle/scenarios/:id/recalculate', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      await scenarioPlanningService.recalculateOutcomes(id);

      const state = await scenarioPlanningService.getFullScenarioState(id);

      const response: APIResponse<typeof state> = {
        success: true,
        data: state,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to recalculate outcomes',
      };
      return reply.status(500).send(response);
    }
  });

  // ==================== SENSITIVITY ANALYSIS ====================

  // POST /api/oracle/scenarios/:id/sensitivity - Run sensitivity analysis
  fastify.post('/api/oracle/scenarios/:id/sensitivity', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        analysis_type?: SensitivityAnalysisType;
        iterations?: number;
        confidence_interval?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { analysis_type = 'tornado', iterations, confidence_interval } = request.body;

      const result = await scenarioPlanningService.runSensitivityAnalysis({
        scenario_id: id,
        analysis_type,
        iterations,
        confidence_interval,
      });

      const response: APIResponse<SensitivityAnalysis> = {
        success: true,
        data: result,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run sensitivity analysis',
      };
      return reply.status(500).send(response);
    }
  });

  // ==================== SCENARIO COMPARISON ====================

  // POST /api/oracle/scenarios/compare - Compare scenarios
  fastify.post('/api/oracle/scenarios/compare', async (
    request: FastifyRequest<{ Body: CompareScenarioParams }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const comparison = await scenarioPlanningService.compareScenarios(userId, request.body);

      const response: APIResponse<ScenarioComparison> = {
        success: true,
        data: comparison,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare scenarios',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios/comparisons - List comparisons
  fastify.get('/api/oracle/scenarios/comparisons', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const comparisons = await scenarioPlanningService.listComparisons(userId);

      const response: APIResponse<ScenarioComparison[]> = {
        success: true,
        data: comparisons,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list comparisons',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/scenarios/comparisons/:id - Get comparison by ID
  fastify.get('/api/oracle/scenarios/comparisons/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const comparison = await scenarioPlanningService.getComparison(id);

      if (!comparison) {
        const response: APIResponse<null> = {
          success: false,
          error: 'Comparison not found',
        };
        return reply.status(404).send(response);
      }

      const response: APIResponse<ScenarioComparison> = {
        success: true,
        data: comparison,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get comparison',
      };
      return reply.status(500).send(response);
    }
  });
}
