/**
 * ORACLE Phase 4 End-to-End Verification Script
 * Story verify-1 - Manual verification of Phase 4 features
 *
 * Verifies:
 * - Realtime updates work across devices
 * - Watch complications update
 * - At least one integration connects
 * - Offline mode works correctly
 * - No performance regressions
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

interface VerificationResult {
  feature: string;
  status: 'pass' | 'fail' | 'skip' | 'manual';
  message: string;
  duration?: number;
  details?: any;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    manual: number;
  };
  overallStatus: 'pass' | 'fail';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';

const PERFORMANCE_THRESHOLDS = {
  apiResponseMs: 1000,
  realtimeLatencyMs: 500,
  syncDurationMs: 5000,
  dbQueryMs: 200,
};

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

async function verifyRealtimeUpdates(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('\n📡 Verifying Realtime Updates...\n');

  // Test 1: Realtime table configuration
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const tables = ['oracle_signals', 'oracle_decisions', 'oracle_execution_steps', 'oracle_ghost_actions'];

    for (const table of tables) {
      const startTime = Date.now();
      const channel = supabase.channel(`test:${table}`);

      let subscribed = false;
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {});

      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            resolve();
          }
        });
        setTimeout(resolve, 3000);
      });

      await channel.unsubscribe();

      results.push({
        feature: `Realtime: ${table}`,
        status: subscribed ? 'pass' : 'fail',
        message: subscribed
          ? `Successfully subscribed to ${table} changes`
          : `Failed to subscribe to ${table}`,
        duration: Date.now() - startTime,
      });
    }
  } catch (error) {
    results.push({
      feature: 'Realtime: Configuration',
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Test 2: Cross-device sync (manual verification)
  results.push({
    feature: 'Realtime: Cross-device sync',
    status: 'manual',
    message: 'MANUAL: Create a signal on one device, verify it appears on another within 2 seconds',
  });

  return results;
}

async function verifyWatchComplications(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('\n⌚ Verifying Watch Complications...\n');

  // Watch verification requires manual testing
  results.push({
    feature: 'Watch: Apple Watch complications',
    status: 'manual',
    message: 'MANUAL: Verify watch face shows current OODA phase complication',
  });

  results.push({
    feature: 'Watch: Complication refresh',
    status: 'manual',
    message: 'MANUAL: Create a new signal, verify complication updates within 15 minutes',
  });

  results.push({
    feature: 'Watch: Notification handling',
    status: 'manual',
    message: 'MANUAL: Trigger a ghost action, verify watch shows notification with approve/dismiss actions',
  });

  results.push({
    feature: 'Watch: Wear OS tiles',
    status: 'manual',
    message: 'MANUAL: Verify Wear OS tiles display ORACLE status and signal count',
  });

  return results;
}

async function verifyIntegrations(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('\n🔗 Verifying Integrations...\n');

  // Test 1: Integration table exists
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('oracle_integrations')
      .select('id, integration_type, status')
      .eq('user_id', TEST_USER_ID)
      .limit(5);

    if (error) throw error;

    results.push({
      feature: 'Integration: Database tables',
      status: 'pass',
      message: `Integration table accessible, ${data?.length || 0} integrations found`,
    });

    // Check if at least one integration is connected
    const connectedIntegrations = data?.filter(i => i.status === 'connected') || [];

    results.push({
      feature: 'Integration: At least one connected',
      status: connectedIntegrations.length > 0 ? 'pass' : 'manual',
      message: connectedIntegrations.length > 0
        ? `${connectedIntegrations.length} integration(s) connected: ${connectedIntegrations.map(i => i.integration_type).join(', ')}`
        : 'MANUAL: Connect at least one integration (Google Calendar, Slack, etc.)',
    });
  } catch (error) {
    results.push({
      feature: 'Integration: Database',
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Manual integration tests
  results.push({
    feature: 'Integration: OAuth flow',
    status: 'manual',
    message: 'MANUAL: Complete OAuth flow for Google Calendar or Slack',
  });

  results.push({
    feature: 'Integration: Data sync',
    status: 'manual',
    message: 'MANUAL: After connecting, verify data syncs correctly',
  });

  return results;
}

async function verifyOfflineMode(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('\n📴 Verifying Offline Mode...\n');

  // Offline verification requires mobile app testing
  results.push({
    feature: 'Offline: Data persistence',
    status: 'manual',
    message: 'MANUAL: With airplane mode ON, verify you can view existing signals and decisions',
  });

  results.push({
    feature: 'Offline: Queue operations',
    status: 'manual',
    message: 'MANUAL: With airplane mode ON, create a signal. Turn WiFi ON and verify it syncs.',
  });

  results.push({
    feature: 'Offline: Conflict resolution',
    status: 'manual',
    message: 'MANUAL: Edit same signal on two devices while offline, verify conflict resolution',
  });

  results.push({
    feature: 'Offline: Sync indicator',
    status: 'manual',
    message: 'MANUAL: Verify sync progress indicator appears during sync',
  });

  return results;
}

async function verifyPerformance(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('\n⚡ Verifying Performance...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Test 1: API Response Time
  try {
    const startTime = Date.now();
    await supabase.from('oracle_signals').select('id').eq('user_id', TEST_USER_ID).limit(10);
    const duration = Date.now() - startTime;

    results.push({
      feature: 'Performance: API response time',
      status: duration < PERFORMANCE_THRESHOLDS.apiResponseMs ? 'pass' : 'fail',
      message: `API response: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.apiResponseMs}ms)`,
      duration,
    });
  } catch (error) {
    results.push({
      feature: 'Performance: API response time',
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Test 2: Database Query Performance
  try {
    const queries = [
      { name: 'Signals list', query: supabase.from('oracle_signals').select('*').eq('user_id', TEST_USER_ID).limit(50) },
      { name: 'Decisions with options', query: supabase.from('oracle_decisions').select('*, oracle_decision_options(*)').eq('user_id', TEST_USER_ID).limit(10) },
      { name: 'Plans with steps', query: supabase.from('oracle_execution_plans').select('*, oracle_execution_steps(*)').eq('user_id', TEST_USER_ID).limit(10) },
    ];

    for (const { name, query } of queries) {
      const startTime = Date.now();
      await query;
      const duration = Date.now() - startTime;

      results.push({
        feature: `Performance: ${name}`,
        status: duration < PERFORMANCE_THRESHOLDS.dbQueryMs * 2 ? 'pass' : 'fail',
        message: `Query time: ${duration}ms`,
        duration,
      });
    }
  } catch (error) {
    results.push({
      feature: 'Performance: Database queries',
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Test 3: Batch endpoint (if available)
  results.push({
    feature: 'Performance: Batch endpoint',
    status: 'manual',
    message: 'MANUAL: Test batch endpoint with 10+ operations, verify < 2s response',
  });

  // Test 4: Memory usage
  results.push({
    feature: 'Performance: No memory regressions',
    status: 'manual',
    message: 'MANUAL: Monitor app memory during 10 min usage, verify no significant growth',
  });

  return results;
}

async function verifySecurity(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('\n🔒 Verifying Security...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Test 1: Audit log table exists
  try {
    const { error } = await supabase
      .from('oracle_audit_logs')
      .select('id')
      .limit(1);

    results.push({
      feature: 'Security: Audit logs table',
      status: error ? 'fail' : 'pass',
      message: error ? `Error: ${error.message}` : 'Audit logs table accessible',
    });
  } catch (error) {
    results.push({
      feature: 'Security: Audit logs table',
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Test 2: Performance metrics table
  try {
    const { error } = await supabase
      .from('oracle_performance_metrics')
      .select('id')
      .limit(1);

    results.push({
      feature: 'Security: Performance metrics table',
      status: error ? 'fail' : 'pass',
      message: error ? `Error: ${error.message}` : 'Performance metrics table accessible',
    });
  } catch (error) {
    results.push({
      feature: 'Security: Performance metrics table',
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Manual security tests
  results.push({
    feature: 'Security: E2E encryption',
    status: 'manual',
    message: 'MANUAL: Enable encryption, create decision, verify data is encrypted in database',
  });

  results.push({
    feature: 'Security: Rate limiting',
    status: 'manual',
    message: 'MANUAL: Make 100+ requests quickly, verify rate limit headers and 429 response',
  });

  results.push({
    feature: 'Security: RLS policies',
    status: 'manual',
    message: 'MANUAL: Try accessing another user\'s data, verify access denied',
  });

  return results;
}

// ============================================================================
// MAIN VERIFICATION RUNNER
// ============================================================================

async function runVerification(): Promise<VerificationReport> {
  console.log('═'.repeat(60));
  console.log('  ORACLE Phase 4 End-to-End Verification');
  console.log('═'.repeat(60));
  console.log(`\nTimestamp: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  const allResults: VerificationResult[] = [];

  // Run all verification suites
  allResults.push(...await verifyRealtimeUpdates());
  allResults.push(...await verifyWatchComplications());
  allResults.push(...await verifyIntegrations());
  allResults.push(...await verifyOfflineMode());
  allResults.push(...await verifyPerformance());
  allResults.push(...await verifySecurity());

  // Generate summary
  const summary = {
    total: allResults.length,
    passed: allResults.filter(r => r.status === 'pass').length,
    failed: allResults.filter(r => r.status === 'fail').length,
    skipped: allResults.filter(r => r.status === 'skip').length,
    manual: allResults.filter(r => r.status === 'manual').length,
  };

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    results: allResults,
    summary,
    overallStatus: summary.failed === 0 ? 'pass' : 'fail',
  };

  // Print results
  console.log('\n' + '═'.repeat(60));
  console.log('  VERIFICATION RESULTS');
  console.log('═'.repeat(60) + '\n');

  for (const result of allResults) {
    const icon = result.status === 'pass' ? '✅' :
                 result.status === 'fail' ? '❌' :
                 result.status === 'manual' ? '👤' : '⏭️';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.feature}${duration}`);
    console.log(`   ${result.message}\n`);
  }

  console.log('═'.repeat(60));
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\n  Total:   ${summary.total}`);
  console.log(`  ✅ Pass:   ${summary.passed}`);
  console.log(`  ❌ Fail:   ${summary.failed}`);
  console.log(`  ⏭️ Skip:   ${summary.skipped}`);
  console.log(`  👤 Manual: ${summary.manual}`);
  console.log(`\n  Overall: ${report.overallStatus === 'pass' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('\n' + '═'.repeat(60));

  if (summary.manual > 0) {
    console.log('\n📋 MANUAL VERIFICATION CHECKLIST:\n');
    allResults
      .filter(r => r.status === 'manual')
      .forEach((r, i) => {
        console.log(`  [ ] ${i + 1}. ${r.message.replace('MANUAL: ', '')}`);
      });
    console.log('');
  }

  return report;
}

// ============================================================================
// EXPORT AND RUN
// ============================================================================

export { runVerification, VerificationReport, VerificationResult };

// Run if executed directly
if (require.main === module) {
  runVerification()
    .then(report => {
      process.exit(report.overallStatus === 'pass' ? 0 : 1);
    })
    .catch(error => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}
