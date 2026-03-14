/**
 * ORACLE Load Testing Suite
 * Story test-4 - Performance under load
 *
 * Tests cover:
 * - /api/oracle/health endpoint
 * - /api/oracle/signals endpoint
 * - /api/oracle/predictions endpoint
 * - 100 VUs, 5 minute duration
 * - Thresholds: p95 < 200ms
 *
 * Run with: k6 run k6-oracle.js
 *
 * @requires k6
 */

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_PREFIX = __ENV.API_PREFIX || '/api/oracle';

// Custom metrics
const healthCheckDuration = new Trend('health_check_duration', true);
const signalsRequestDuration = new Trend('signals_request_duration', true);
const predictionsRequestDuration = new Trend('predictions_request_duration', true);
const errorRate = new Rate('error_rate');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const activeUsers = new Gauge('active_users');

// Test options
export const options = {
  // Stages for gradual ramp-up and ramp-down
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 VUs
    { duration: '1m', target: 50 },    // Ramp up to 50 VUs
    { duration: '2m', target: 100 },   // Ramp up to 100 VUs (main load)
    { duration: '1m', target: 100 },   // Stay at 100 VUs
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],

  // Performance thresholds
  thresholds: {
    // Overall HTTP request duration
    http_req_duration: ['p(95)<200', 'p(99)<500'],

    // Health check endpoint - should be very fast
    health_check_duration: ['p(95)<50', 'p(99)<100'],

    // Signals endpoint
    signals_request_duration: ['p(95)<200', 'p(99)<400'],

    // Predictions endpoint - may be slower due to computation
    predictions_request_duration: ['p(95)<300', 'p(99)<600'],

    // Error rate should be below 1%
    error_rate: ['rate<0.01'],

    // HTTP failures should be below 1%
    http_req_failed: ['rate<0.01'],

    // Ensure we complete most iterations
    'checks{type:health}': ['rate>0.99'],
    'checks{type:signals}': ['rate>0.95'],
    'checks{type:predictions}': ['rate>0.95'],
  },

  // Additional options
  noConnectionReuse: false,
  userAgent: 'K6-LoadTest/1.0',

  // Summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================================================
// Setup and Teardown
// ============================================================================

/**
 * Setup function - runs once before all VUs start
 */
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  // Verify the API is reachable
  const healthRes = http.get(`${BASE_URL}${API_PREFIX}/health`);

  if (healthRes.status !== 200) {
    console.error(`API health check failed: ${healthRes.status}`);
    fail('API is not healthy, cannot proceed with load test');
  }

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiPrefix: API_PREFIX,
  };
}

/**
 * Teardown function - runs once after all VUs finish
 */
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
  console.log(`Test ran against: ${data.baseUrl}${data.apiPrefix}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate mock JWT token for authenticated requests
 */
function generateMockToken() {
  // In a real scenario, this would be a valid JWT
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MDAwMDAwMDB9.mock';
}

/**
 * Get common headers for API requests
 */
function getHeaders(authenticated = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Request-ID': `k6-${__VU}-${__ITER}-${Date.now()}`,
  };

  if (authenticated) {
    headers['Authorization'] = `Bearer ${generateMockToken()}`;
  }

  return headers;
}

/**
 * Record request metrics
 */
function recordMetrics(response, metricTrend) {
  metricTrend.add(response.timings.duration);

  if (response.status >= 200 && response.status < 300) {
    successfulRequests.add(1);
    errorRate.add(0);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Test health endpoint
 * Expected: Very fast response, always available
 */
function testHealthEndpoint() {
  group('Health Check', function() {
    const response = http.get(`${BASE_URL}${API_PREFIX}/health`, {
      headers: getHeaders(false), // Health doesn't need auth
      tags: { name: 'health' },
    });

    recordMetrics(response, healthCheckDuration);

    const success = check(response, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 50ms': (r) => r.timings.duration < 50,
      'health body contains status': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'ok' || body.status === 'healthy';
        } catch {
          return false;
        }
      },
    }, { type: 'health' });

    return success;
  });
}

/**
 * Test signals endpoint
 * Expected: Returns list of signals for user
 */
function testSignalsEndpoint() {
  group('Signals API', function() {
    // GET signals
    const getResponse = http.get(`${BASE_URL}${API_PREFIX}/signals`, {
      headers: getHeaders(),
      tags: { name: 'signals_get' },
    });

    recordMetrics(getResponse, signalsRequestDuration);

    check(getResponse, {
      'signals GET status is 200': (r) => r.status === 200,
      'signals GET response time < 200ms': (r) => r.timings.duration < 200,
      'signals GET returns array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.signals) || Array.isArray(body);
        } catch {
          return false;
        }
      },
    }, { type: 'signals' });

    // POST new signal (less frequent)
    if (randomIntBetween(1, 10) === 1) {
      const newSignal = {
        title: `Test Signal ${Date.now()}`,
        type: randomItem(['conflict', 'deadline', 'opportunity', 'risk']),
        urgency: randomItem(['critical', 'high', 'medium', 'low']),
        source: 'k6-load-test',
      };

      const postResponse = http.post(
        `${BASE_URL}${API_PREFIX}/signals`,
        JSON.stringify(newSignal),
        {
          headers: getHeaders(),
          tags: { name: 'signals_post' },
        }
      );

      recordMetrics(postResponse, signalsRequestDuration);

      check(postResponse, {
        'signals POST status is 201 or 200': (r) => r.status === 201 || r.status === 200,
        'signals POST response time < 300ms': (r) => r.timings.duration < 300,
      }, { type: 'signals' });
    }
  });
}

/**
 * Test predictions endpoint
 * Expected: Returns predictions/recommendations
 */
function testPredictionsEndpoint() {
  group('Predictions API', function() {
    // GET predictions
    const getResponse = http.get(`${BASE_URL}${API_PREFIX}/predictions`, {
      headers: getHeaders(),
      tags: { name: 'predictions_get' },
    });

    recordMetrics(getResponse, predictionsRequestDuration);

    check(getResponse, {
      'predictions GET status is 200': (r) => r.status === 200,
      'predictions GET response time < 300ms': (r) => r.timings.duration < 300,
      'predictions GET returns data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body !== null && typeof body === 'object';
        } catch {
          return false;
        }
      },
    }, { type: 'predictions' });

    // POST prediction request (compute-intensive)
    if (randomIntBetween(1, 5) === 1) {
      const predictionRequest = {
        type: randomItem(['schedule', 'priority', 'outcome', 'risk']),
        context: {
          signals: randomIntBetween(1, 10),
          timeframe: randomItem(['hour', 'day', 'week']),
        },
        options: {
          includeConfidence: true,
          maxResults: randomIntBetween(3, 10),
        },
      };

      const postResponse = http.post(
        `${BASE_URL}${API_PREFIX}/predictions`,
        JSON.stringify(predictionRequest),
        {
          headers: getHeaders(),
          tags: { name: 'predictions_post' },
        }
      );

      recordMetrics(postResponse, predictionsRequestDuration);

      check(postResponse, {
        'predictions POST status is 200': (r) => r.status === 200,
        'predictions POST response time < 500ms': (r) => r.timings.duration < 500,
        'predictions POST returns predictions': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.predictions || body.recommendation || body.result;
          } catch {
            return false;
          }
        },
      }, { type: 'predictions' });
    }
  });
}

/**
 * Test decisions endpoint
 * Expected: CRUD operations on decisions
 */
function testDecisionsEndpoint() {
  group('Decisions API', function() {
    // GET decisions list
    const listResponse = http.get(`${BASE_URL}${API_PREFIX}/decisions`, {
      headers: getHeaders(),
      tags: { name: 'decisions_list' },
    });

    check(listResponse, {
      'decisions list status is 200': (r) => r.status === 200,
      'decisions list response time < 200ms': (r) => r.timings.duration < 200,
    }, { type: 'decisions' });

    // POST new decision (occasional)
    if (randomIntBetween(1, 20) === 1) {
      const newDecision = {
        title: `Test Decision ${Date.now()}`,
        description: 'Load test generated decision',
        options: [
          { id: 'opt-1', title: 'Option A', score: Math.random() },
          { id: 'opt-2', title: 'Option B', score: Math.random() },
        ],
        deadline: new Date(Date.now() + 86400000).toISOString(),
      };

      const postResponse = http.post(
        `${BASE_URL}${API_PREFIX}/decisions`,
        JSON.stringify(newDecision),
        {
          headers: getHeaders(),
          tags: { name: 'decisions_post' },
        }
      );

      check(postResponse, {
        'decisions POST status is 201 or 200': (r) => r.status === 201 || r.status === 200,
        'decisions POST response time < 300ms': (r) => r.timings.duration < 300,
      }, { type: 'decisions' });
    }
  });
}

/**
 * Test observe phase endpoints
 * Expected: RADAR and signal detection
 */
function testObserveEndpoints() {
  group('Observe Phase', function() {
    // GET RADAR data
    const radarResponse = http.get(`${BASE_URL}${API_PREFIX}/observe/radar`, {
      headers: getHeaders(),
      tags: { name: 'observe_radar' },
    });

    check(radarResponse, {
      'radar status is 200': (r) => r.status === 200,
      'radar response time < 200ms': (r) => r.timings.duration < 200,
    }, { type: 'observe' });

    // GET detected patterns
    const patternsResponse = http.get(`${BASE_URL}${API_PREFIX}/observe/patterns`, {
      headers: getHeaders(),
      tags: { name: 'observe_patterns' },
    });

    check(patternsResponse, {
      'patterns status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    }, { type: 'observe' });
  });
}

/**
 * Test orient phase endpoints
 * Expected: Analysis and context
 */
function testOrientEndpoints() {
  group('Orient Phase', function() {
    // GET analysis
    const analysisResponse = http.get(`${BASE_URL}${API_PREFIX}/orient/analysis`, {
      headers: getHeaders(),
      tags: { name: 'orient_analysis' },
    });

    check(analysisResponse, {
      'analysis status is 200': (r) => r.status === 200,
      'analysis response time < 300ms': (r) => r.timings.duration < 300,
    }, { type: 'orient' });
  });
}

/**
 * Test act phase endpoints
 * Expected: Execution tracking
 */
function testActEndpoints() {
  group('Act Phase', function() {
    // GET active plans
    const plansResponse = http.get(`${BASE_URL}${API_PREFIX}/act/plans`, {
      headers: getHeaders(),
      tags: { name: 'act_plans' },
    });

    check(plansResponse, {
      'plans status is 200': (r) => r.status === 200,
      'plans response time < 200ms': (r) => r.timings.duration < 200,
    }, { type: 'act' });
  });
}

// ============================================================================
// Main Test Function
// ============================================================================

/**
 * Main test function - executed by each VU
 */
export default function() {
  // Update active users gauge
  activeUsers.add(__VU);

  // Always run health check
  testHealthEndpoint();

  // Randomly select which endpoint to test (weighted distribution)
  const random = Math.random();

  if (random < 0.4) {
    // 40% - Signals (most common operation)
    testSignalsEndpoint();
  } else if (random < 0.7) {
    // 30% - Predictions
    testPredictionsEndpoint();
  } else if (random < 0.85) {
    // 15% - Decisions
    testDecisionsEndpoint();
  } else if (random < 0.93) {
    // 8% - Observe
    testObserveEndpoints();
  } else if (random < 0.97) {
    // 4% - Orient
    testOrientEndpoints();
  } else {
    // 3% - Act
    testActEndpoints();
  }

  // Think time between requests (simulates real user behavior)
  sleep(randomIntBetween(1, 3));
}

// ============================================================================
// Additional Scenarios
// ============================================================================

/**
 * Stress test scenario - push system to limits
 */
export function stressTest() {
  // Rapid-fire requests to test system limits
  for (let i = 0; i < 10; i++) {
    testSignalsEndpoint();
    testPredictionsEndpoint();
  }
}

/**
 * Soak test scenario - long-running stability test
 */
export function soakTest() {
  testHealthEndpoint();
  testSignalsEndpoint();
  sleep(5);
}

/**
 * Spike test scenario - sudden traffic spike
 */
export function spikeTest() {
  // Burst of requests
  const batch = [];
  for (let i = 0; i < 50; i++) {
    batch.push(['GET', `${BASE_URL}${API_PREFIX}/signals`]);
  }
  http.batch(batch);
}

// ============================================================================
// Scenario Exports (for CLI selection)
// ============================================================================

export const scenarios = {
  // Default scenario
  default: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: options.stages,
    gracefulRampDown: '30s',
  },

  // Constant load scenario
  constant_load: {
    executor: 'constant-vus',
    vus: 100,
    duration: '5m',
  },

  // Arrival rate scenario (requests per second)
  arrival_rate: {
    executor: 'constant-arrival-rate',
    rate: 100, // 100 requests per second
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 50,
    maxVUs: 200,
  },

  // Stress test scenario
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],
  },

  // Spike test scenario
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 10 },
      { duration: '1m', target: 10 },
      { duration: '10s', target: 200 }, // Spike
      { duration: '3m', target: 200 },
      { duration: '10s', target: 10 },
      { duration: '1m', target: 10 },
      { duration: '10s', target: 0 },
    ],
  },

  // Soak test scenario (long duration)
  soak: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
  },
};

// ============================================================================
// Summary Handler
// ============================================================================

/**
 * Handle summary - generate custom report
 */
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    // Console output
    stdout: textSummary(data, { indent: ' ', enableColors: true }),

    // JSON report
    [`reports/k6-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),

    // HTML report (if k6-reporter is installed)
    // [`reports/k6-summary-${timestamp}.html`]: htmlReport(data),
  };
}

/**
 * Generate text summary
 */
function textSummary(data, options) {
  const lines = [];

  lines.push('\n============================================');
  lines.push('         ORACLE Load Test Summary          ');
  lines.push('============================================\n');

  // Key metrics
  if (data.metrics) {
    lines.push('Key Performance Metrics:');
    lines.push('------------------------');

    if (data.metrics.http_req_duration) {
      const duration = data.metrics.http_req_duration;
      lines.push(`HTTP Request Duration:`);
      lines.push(`  - Average: ${duration.values.avg?.toFixed(2) || 'N/A'}ms`);
      lines.push(`  - P95: ${duration.values['p(95)']?.toFixed(2) || 'N/A'}ms`);
      lines.push(`  - P99: ${duration.values['p(99)']?.toFixed(2) || 'N/A'}ms`);
    }

    if (data.metrics.http_reqs) {
      lines.push(`\nTotal Requests: ${data.metrics.http_reqs.values.count || 0}`);
      lines.push(`Requests/sec: ${data.metrics.http_reqs.values.rate?.toFixed(2) || 'N/A'}`);
    }

    if (data.metrics.http_req_failed) {
      lines.push(`\nFailed Requests: ${(data.metrics.http_req_failed.values.rate * 100)?.toFixed(2) || 0}%`);
    }
  }

  // Threshold results
  lines.push('\nThreshold Results:');
  lines.push('------------------');

  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const status = threshold.ok ? 'PASS' : 'FAIL';
    lines.push(`${status}: ${name}`);
  }

  lines.push('\n============================================\n');

  return lines.join('\n');
}
