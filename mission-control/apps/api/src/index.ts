import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { geminiService } from './services/gemini-mock';
import { supabaseService } from './services/supabase-mock';

// RFC 9457 Problem Details
import { sendProblem, ProblemTypes } from './utils/problem-details';

// Auth
import { authRoutes } from './routes/auth';
import { authMiddleware } from './services/auth/authMiddleware';

// Unkey Auth (Public API)
import { unkey } from './services/unkey';
import { createAuthMiddleware, rateLimitHeadersHook } from './middleware/auth';

// Billing Metering
import { createMeterUsageHook } from './hooks/meter-usage';
import { stripe } from './services/billing/stripe';

// Free-tier rate limiting
import { registerFreeTierRateLimit } from './hooks/free-tier-rate-limit';

// Billing routes (subscribe + portal)
import { subscribeRoutes } from './routes/billing/subscribe';
import { portalRoutes } from './routes/billing/portal';

// AI discovery route
import { llmsTxtRoute } from './routes/llms-txt';

// Database
import { db } from './services/database/client';

// Plugins
import { registerSwagger } from './plugins/swagger';

// ORACLE Routes (Story 8.3)
import { observeRoutes } from './routes/oracle/observe';
import { orientRoutes } from './routes/oracle/orient';
import { decideRoutes } from './routes/oracle/decide';
import { actRoutes } from './routes/oracle/act';
import { probabilityRoutes } from './routes/oracle/probability';
import { environmentRoutes } from './routes/oracle/environment';
import { oracleRoutes } from './routes/oracle';
// ORACLE Analytics Routes (Phase 3 - adv-3)
import { analyticsRoutes } from './routes/oracle/analytics';
// ORACLE Webhook Routes (Phase 3 - adv-10)
import { webhookRoutes } from './routes/oracle/webhooks';
// ORACLE Decision Journal Routes (Phase 3 - adv-17)
import { journalRoutes } from './routes/oracle/journal';
// ORACLE Collaborative Decisions Routes (Phase 3 - adv-19)
import { collaborativeRoutes } from './routes/oracle/collaborative';
// ORACLE Natural Language Query Routes (Phase 3 - adv-24)
import { queryRoutes } from './routes/oracle/query';
// ORACLE Scenario Planning Routes (Phase 3 - adv-26)
import { scenarioRoutes } from './routes/oracle/scenarios';
// ORACLE Data Export Routes (Phase 3 - adv-28)
import { exportRoutes } from './routes/oracle/export';
// WebSocket Routes
import { wsRoutes } from './routes/ws';

const server = Fastify({
  logger: true,
  bodyLimit: 50 * 1024 * 1024, // 50MB for file uploads
});

// Register plugins
server.register(cors, {
  origin: ['exp://192.168.1.100:8081', 'http://localhost:19006'], // Expo default
  credentials: true,
});

server.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB free tier friendly
  },
});

// Register Swagger/OpenAPI documentation
registerSwagger(server);

// Free-tier rate limiting (100 calls/day by IP, skips authenticated requests)
registerFreeTierRateLimit(server);

// Unkey auth middleware for public API routes (/api/v1/*)
const unkeyAuthHandler = createAuthMiddleware(unkey);
server.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/v1/')) {
    await unkeyAuthHandler(request, reply);
  }
});

// Rate limit headers on all responses (picks up values set by auth middleware)
server.addHook('onSend', rateLimitHeadersHook);

// Stripe Billing Meter: emit usage event after every authenticated /api/v1/* response
const meterUsage = createMeterUsageHook(stripe, process.env.STRIPE_METER_EVENT_NAME || 'api_calls');
server.addHook('onResponse', async (request, reply) => {
  if (request.url.startsWith('/api/v1/')) {
    await meterUsage(request, reply);
  }
});

// API Routes

// Auth Routes (public)
server.register(authRoutes, { prefix: '/api/auth' });

// Apply auth middleware to all /api/oracle/* routes
server.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/oracle/')) {
    await authMiddleware(request, reply);
  }
});

// AI discovery (llms.txt)
server.register(llmsTxtRoute);

// Health check (always free)
server.get('/health', async () => {
  const dbHealth = await db.healthCheck();
  return {
    status: 'operational',
    timestamp: new Date().toISOString(),
    database: dbHealth,
  };
});

// ORACLE Subsystem Health Check (Story post-5)
server.get('/api/oracle/health', async () => {
  const oracleHealth = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    subsystems: {
      observe: { status: 'operational', description: 'Signal detection and radar scanning' },
      orient: { status: 'operational', description: 'Strategic context and horizon planning' },
      decide: { status: 'operational', description: 'Decision analysis and simulation' },
      act: { status: 'operational', description: 'Execution planning and copilot' },
      probability: { status: 'operational', description: 'Bayesian prediction engine' },
      environment: { status: 'operational', description: 'Context graph and ghost actions' },
    },
    capabilities: {
      radarScan: true,
      monteCarloSimulation: true,
      bayesianUpdates: true,
      ghostActions: true,
      backgroundSync: true,
    },
    rateLimits: {
      requestsPerMinute: 100,
      maxFileSize: '50MB',
    },
  };
  return oracleHealth;
});

// Upload source (file)
server.post('/api/sources', async (request, reply) => {
  try {
    const data = await request.file();
    if (!data) {
      sendProblem(reply, 400, ProblemTypes.VALIDATION, 'Validation Error', 'No file provided');
      return;
    }

    const { mission_id, type } = data.fields as any;
    const buffer = await data.toBuffer();

    // Store file in Supabase storage
    const uploadResult = await supabaseService.uploadFile(
      mission_id.value,
      buffer,
      data.filename
    );

    // Create source record
    const source = await supabaseService.createSource({
      mission_id: mission_id.value,
      type: type.value,
      file_path: uploadResult.path,
    });

    return { success: true, source_id: source.id };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to upload file');
  }
});

// Extract intelligence from source
server.post('/api/sources/:id/extract', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const { extraction_types } = request.body as { extraction_types: string[] };

    // Get source
    const source = await supabaseService.getSource(id);
    if (!source) {
      sendProblem(reply, 404, ProblemTypes.NOT_FOUND, 'Not Found', 'Source not found');
      return;
    }

    let intel;

    if (source.type === 'image') {
      // For images, use Gemini Vision
      const fileUrl = await supabaseService.getFileUrl(source.file_path);
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      
      intel = await geminiService.extractIntel(imageBase64, extraction_types);
    } else {
      // For text/PDF, use Gemini Pro
      intel = {
        overlays: [],
        structured: { fields: {}, entities: [], risks: [] },
        actions: [],
        confidence: 0.5
      };
    }

    // Save extraction results
    await supabaseService.createExtract({
      source_id: id,
      data_type: 'intel_extraction',
      confidence: intel.confidence,
      structured_data: intel,
    });

    return {
      success: true,
      data: intel,
      needs_user_confirmation: intel.confidence < 0.7,
    };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to extract intelligence');
  }
});

// Create actions
server.post('/api/actions', async (request, reply) => {
  try {
    const { mission_id, source_id, actions } = request.body as {
      mission_id: string;
      source_id?: string;
      actions: Array<{
        type: string;
        title: string;
        description?: string;
        metadata?: Record<string, any>;
      }>;
    };

    const createdActions = await supabaseService.createActions(
      actions.map(action => ({
        mission_id,
        source_id,
        ...action,
      }))
    );

    return {
      success: true,
      data: createdActions,
    };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to create actions');
  }
});

// Generate briefing
server.post('/api/briefing', async (request, reply) => {
  try {
    const { date_range, priorities } = request.body as {
      date_range?: { start: string; end: string };
      priorities: string[];
    };

    // This would integrate with calendar API in real implementation
    const mockCalendar: Record<string, unknown>[] = [];
    const mockTasks: Record<string, unknown>[] = [];
    const mockIntel: Record<string, unknown>[] = [];

    const briefing = await geminiService.generateBriefing({
      calendar: mockCalendar,
      tasks: mockTasks,
      recentIntel: mockIntel,
      priorities,
    });

    // Save briefing (in real app, would include user_id)
    const savedBriefing = await supabaseService.saveBriefing({
      user_id: 'mock-user-id', // Replace with actual user auth
      date: new Date().toISOString().split('T')[0],
      summary: briefing.summary,
      priorities: briefing.priorities,
      time_windows: briefing.time_windows,
      recommended_actions: briefing.recommended_actions,
    });

    return {
      success: true,
      data: { ...briefing, id: savedBriefing.id },
      needs_user_confirmation: briefing.needs_user_confirmation,
    };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to generate briefing');
  }
});

// Analyze meeting transcript
server.post('/api/meetings/analyze', async (request, reply) => {
  try {
    const { transcript, title } = request.body as {
      transcript: string;
      title?: string;
    };

    const analysis = await geminiService.analyzeTranscript(transcript);

    // Save meeting analysis
    const meeting = await supabaseService.saveMeeting({
      user_id: 'mock-user-id', // Replace with actual user auth
      title,
      transcript,
      decisions: analysis.decisions,
      follow_ups: analysis.follow_ups,
    });

    return {
      success: true,
      data: { ...analysis, meeting_id: meeting.id },
      confidence: analysis.confidence,
    };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to analyze meeting');
  }
});

// Get user's missions
server.get('/api/missions', async (request, reply) => {
  try {
    const { user_id } = request.query as { user_id: string };
    const { status } = request.query as { status?: string };

    const missions = await supabaseService.getMissions(user_id, status);
    
    return {
      success: true,
      data: missions,
    };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to get missions');
  }
});

// Get actions for a mission
server.get('/api/actions', async (request, reply) => {
  try {
    const { mission_id, status } = request.query as {
      mission_id: string;
      status?: string;
    };

    const actions = await supabaseService.getActions(mission_id, status);

    return {
      success: true,
      data: actions,
    };
  } catch (error) {
    server.log.error(error);
    return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'Failed to get actions');
  }
});

// ==========================================
// ORACLE Routes Registration (Story 8.3)
// ==========================================
server.register(observeRoutes, { prefix: '/api/oracle/observe' });
server.register(orientRoutes, { prefix: '/api/oracle/orient' });
server.register(decideRoutes, { prefix: '/api/oracle/decide' });
server.register(actRoutes, { prefix: '/api/oracle/act' });
server.register(probabilityRoutes, { prefix: '/api/oracle/probability' });
server.register(environmentRoutes, { prefix: '/api/oracle/environment' });
server.register(oracleRoutes, { prefix: '/api/oracle' });
// Phase 3 - Analytics Routes (adv-3)
server.register(analyticsRoutes, { prefix: '/api/oracle/analytics' });
// Phase 3 - Webhook Routes (adv-10)
server.register(webhookRoutes, { prefix: '/api/oracle/webhooks' });
// Phase 3 - Decision Journal Routes (adv-17)
server.register(journalRoutes, { prefix: '/api/oracle/journal' });
// Phase 3 - Collaborative Decisions Routes (adv-19)
server.register(collaborativeRoutes, { prefix: '/api/oracle/collab' });
// Phase 3 - Natural Language Query Routes (adv-24)
server.register(queryRoutes, { prefix: '/api/oracle/query' });
// Phase 3 - Scenario Planning Routes (adv-26)
server.register(scenarioRoutes, { prefix: '/api/oracle/scenarios' });
// Phase 3 - Data Export Routes (adv-28)
server.register(exportRoutes, { prefix: '/api/oracle/export' });
// WebSocket routes
server.register(wsRoutes);

// Billing routes (subscribe + portal)
server.register(subscribeRoutes, { prefix: '/api/v1/billing' });
server.register(portalRoutes, { prefix: '/api/v1/billing' });

// RFC 9457 GLOBAL ERROR HANDLER
server.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
  server.log.error(error);

  const status = error.statusCode || 500;

  // Fastify validation errors (schema validation failures)
  if (error.validation) {
    return sendProblem(reply, 400, ProblemTypes.VALIDATION, 'Validation Error', error.message);
  }

  // Rate limit exceeded
  if (status === 429) {
    return sendProblem(reply, 429, ProblemTypes.RATE_LIMITED, 'Rate limit exceeded', 'Too many requests. Please try again later.', { 'retry-after': 60 });
  }

  // Not found
  if (status === 404) {
    return sendProblem(reply, 404, ProblemTypes.NOT_FOUND, 'Not Found', error.message);
  }

  // Default: Internal server error (hide internal details)
  return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'An unexpected error occurred. Please try again.');
});

// Start server
const start = async () => {
  try {
    // Initialize database (with graceful fallback to in-memory)
    await db.initialize({
      connectionString: process.env.DATABASE_URL,
    });

    const port = parseInt(process.env.PORT || '3001');
    await server.listen({
      port,
      host: '0.0.0.0' // Allow connections from mobile devices
    });

    server.log.info(`Mission Control API ready on port ${port}`);
    server.log.info(`Database: ${db.isConnected() ? 'PostgreSQL connected' : 'in-memory fallback'}`);
    server.log.info(`Free tier limits: 100 req/min, 50MB files`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();