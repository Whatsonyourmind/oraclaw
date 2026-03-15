/**
 * ORACLE Data Export API Routes
 * Story adv-28 - Data export endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type { APIResponse } from '@mission-control/shared-types';
import { dataExportService, ExportFormat, ExportType, ExportResult } from '../../services/oracle/dataExport';

export async function exportRoutes(fastify: FastifyInstance) {
  // GET /api/oracle/export/types - Get available export types
  fastify.get('/api/oracle/export/types', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const types = dataExportService.getExportTypes();

      const response: APIResponse<typeof types> = {
        success: true,
        data: types,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get export types',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/export/formats - Get available export formats
  fastify.get('/api/oracle/export/formats', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const formats = dataExportService.getExportFormats();

      const response: APIResponse<typeof formats> = {
        success: true,
        data: formats,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get export formats',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/export/estimate - Estimate export size
  fastify.post('/api/oracle/export/estimate', async (
    request: FastifyRequest<{
      Body: {
        type: ExportType;
        format: ExportFormat;
        date_range?: { start: string; end: string };
      }
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { type, format, date_range } = request.body;

      const estimate = await dataExportService.estimateExportSize({
        type,
        format,
        user_id: userId,
        date_range,
      });

      const response: APIResponse<typeof estimate> = {
        success: true,
        data: estimate,
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to estimate export size',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/export/:type - Export data
  fastify.get('/api/oracle/export/:type', async (
    request: FastifyRequest<{
      Params: { type: string };
      Querystring: {
        format?: ExportFormat;
        start_date?: string;
        end_date?: string;
        anonymize?: string;
        include_metadata?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;
      const { format = 'json', start_date, end_date, anonymize, include_metadata } = request.query;

      // Validate export type
      const validTypes: ExportType[] = ['decisions', 'predictions', 'analytics', 'journal', 'signals', 'scenarios', 'all'];
      if (!validTypes.includes(type as ExportType)) {
        const response: APIResponse<null> = {
          success: false,
          error: `Invalid export type: ${type}. Valid types are: ${validTypes.join(', ')}`,
        };
        return reply.status(400).send(response);
      }

      // Validate format
      const validFormats: ExportFormat[] = ['json', 'csv', 'pdf'];
      if (!validFormats.includes(format)) {
        const response: APIResponse<null> = {
          success: false,
          error: `Invalid format: ${format}. Valid formats are: ${validFormats.join(', ')}`,
        };
        return reply.status(400).send(response);
      }

      const result = await dataExportService.exportData({
        type: type as ExportType,
        format,
        user_id: userId,
        date_range: start_date && end_date ? { start: start_date, end: end_date } : undefined,
        anonymize: anonymize === 'true',
        include_metadata: include_metadata === 'true',
      });

      // Set appropriate headers
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      reply.header('Content-Type', result.content_type);
      reply.header('X-Record-Count', result.record_count.toString());
      reply.header('X-Generated-At', result.generated_at);

      return reply.send(result.content);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export data',
      };
      return reply.status(500).send(response);
    }
  });

  // POST /api/oracle/export - Export with full options (POST for complex requests)
  fastify.post('/api/oracle/export', async (
    request: FastifyRequest<{
      Body: {
        type: ExportType;
        format: ExportFormat;
        date_range?: { start: string; end: string };
        anonymize?: boolean;
        include_metadata?: boolean;
      }
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { type, format, date_range, anonymize, include_metadata } = request.body;

      const result = await dataExportService.exportData({
        type,
        format,
        user_id: userId,
        date_range,
        anonymize,
        include_metadata,
      });

      // Return metadata along with content for preview
      const response: APIResponse<{
        filename: string;
        content_type: string;
        size: number;
        record_count: number;
        generated_at: string;
        preview?: string;
      }> = {
        success: true,
        data: {
          filename: result.filename,
          content_type: result.content_type,
          size: result.size,
          record_count: result.record_count,
          generated_at: result.generated_at,
          // Include preview for smaller exports
          preview: result.size < 10000 ? (result.content as string).substring(0, 1000) : undefined,
        },
      };
      return reply.send(response);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export data',
      };
      return reply.status(500).send(response);
    }
  });

  // GET /api/oracle/export/:type/download - Direct download
  fastify.get('/api/oracle/export/:type/download', async (
    request: FastifyRequest<{
      Params: { type: string };
      Querystring: {
        format?: ExportFormat;
        start_date?: string;
        end_date?: string;
        anonymize?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;
      const { format = 'json', start_date, end_date, anonymize } = request.query;

      const result = await dataExportService.exportData({
        type: type as ExportType,
        format,
        user_id: userId,
        date_range: start_date && end_date ? { start: start_date, end: end_date } : undefined,
        anonymize: anonymize === 'true',
      });

      // Force download
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      reply.header('Content-Type', result.content_type);
      reply.header('Content-Length', result.size.toString());

      return reply.send(result.content);
    } catch (error) {
      const response: APIResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download export',
      };
      return reply.status(500).send(response);
    }
  });
}
