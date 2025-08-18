import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for synthetic monitoring
export let syntheticJourneyDuration = new Trend('synthetic_journey_duration');
export let syntheticStepFailures = new Rate('synthetic_step_failures');
export let syntheticJourneySuccessRate = new Rate('synthetic_journey_success_rate');
export let syntheticLoginDuration = new Trend('synthetic_login_duration');
export let syntheticNoteCreationDuration = new Trend('synthetic_note_creation_duration');
export let syntheticSyncDuration = new Trend('synthetic_sync_duration');
export let syntheticSearchDuration = new Trend('synthetic_search_duration');

// Counters for monitoring
export let syntheticJourneyAttempts = new Counter('synthetic_journey_attempts');
export let syntheticJourneySuccesses = new Counter('synthetic_journey_successes');
export let syntheticJourneyFailures = new Counter('synthetic_journey_failures');

// Test options for synthetic monitoring
export let options = {
  scenarios: {
    synthetic_health_check: {
      executor: 'constant-arrival-rate',
      rate: 1, // 1 synthetic journey per minute
      timeUnit: '1m',
      duration: '30m', // Run for 30 minutes (typical monitoring window)
      preAllocatedVUs: 1,
      maxVUs: 3,
    },
  },
  
  // SLO-aligned thresholds for synthetic monitoring
  thresholds: {
    // Overall journey should complete in under 10 seconds (P95)
    'synthetic_journey_duration': ['p(95)<10000'],
    
    // Individual step SLOs
    'synthetic_login_duration': ['p(95)<2000'],
    'synthetic_note_creation_duration': ['p(95)<1000'],
    'synthetic_sync_duration': ['p(95)<3000'],
    'synthetic_search_duration': ['p(95)<1000'],
    
    // Success rates (uptime requirements)
    'synthetic_journey_success_rate': ['rate>0.999'], // 99.9% uptime SLO
    'synthetic_step_failures': ['rate<0.001'],
    
    // HTTP checks
    'http_req_failed': ['rate<0.001'],
    'http_req_duration': ['p(95)<5000'],
  },
};

// Environment configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3000';

export default function() {
  syntheticJourneyAttempts.add(1);
  const journeyStartTime = Date.now();
  let journeySuccess = true;
  let stepFailure = false;

  try {
    // Step 1: Health Check - Verify system readiness
    console.log('🔍 Step 1: System Health Check');
    const healthCheckStart = Date.now();
    
    let healthResponse = http.get(`${BASE_URL}/api/actuator/health`);
    if (!check(healthResponse, {
      'health endpoint is available': (r) => r.status === 200,
      'health status is UP': (r) => r.json('status') === 'UP',
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Health check failed');
    }

    // Check readiness probe
    let readinessResponse = http.get(`${BASE_URL}/api/actuator/health/readiness`);
    if (!check(readinessResponse, {
      'readiness probe is healthy': (r) => r.status === 200,
      'readiness status is UP': (r) => r.json('status') === 'UP',
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Readiness check failed');
    }

    // Check liveness probe
    let livenessResponse = http.get(`${BASE_URL}/api/actuator/health/liveness`);
    if (!check(livenessResponse, {
      'liveness probe is healthy': (r) => r.status === 200,
      'liveness status is UP': (r) => r.json('status') === 'UP',
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Liveness check failed');
    }

    sleep(0.5);

    // Step 2: Frontend Availability Check
    console.log('🌐 Step 2: Frontend Availability');
    let frontendResponse = http.get(FRONTEND_URL);
    if (!check(frontendResponse, {
      'frontend is accessible': (r) => r.status === 200,
      'frontend loads correctly': (r) => r.body.includes('modulo') || r.body.includes('app'),
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Frontend availability check failed');
    }

    sleep(0.5);

    // Step 3: Authentication Flow Simulation
    console.log('🔐 Step 3: Authentication Flow Simulation');
    const loginStart = Date.now();
    
    // Check OAuth2 authorization endpoint availability
    let authResponse = http.get(`${BASE_URL}/api/oauth2/authorization/google`, {
      redirects: 0, // Don't follow redirects, just check if endpoint exists
    });
    
    if (!check(authResponse, {
      'auth endpoint is available': (r) => r.status === 302 || r.status === 200,
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Authentication endpoint check failed');
    }

    // Simulate authenticated user session (for API testing)
    const authHeaders = {
      'Content-Type': 'application/json',
      'X-Synthetic-User': 'true', // Mark as synthetic test
    };

    syntheticLoginDuration.add(Date.now() - loginStart);
    sleep(1);

    // Step 4: Note Creation Journey
    console.log('📝 Step 4: Note Creation Journey');
    const noteCreationStart = Date.now();
    
    const testNote = {
      title: `Synthetic Test Note - ${Date.now()}`,
      content: 'This is a synthetic monitoring test note created by k6',
      tags: ['synthetic', 'monitoring', 'test'],
    };

    // Create a note (simulate the API call)
    let createNoteResponse = http.post(
      `${BASE_URL}/api/notes`,
      JSON.stringify(testNote),
      { headers: authHeaders }
    );

    let noteId = null;
    if (check(createNoteResponse, {
      'note creation endpoint responds': (r) => r.status === 200 || r.status === 201 || r.status === 401,
      'note creation API is available': (r) => r.status !== 500 && r.status !== 503,
    })) {
      if (createNoteResponse.status === 201 || createNoteResponse.status === 200) {
        try {
          noteId = createNoteResponse.json('id');
        } catch (e) {
          console.log('Note creation response parsing issue (auth required)');
        }
      }
    } else {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Note creation API check failed');
    }

    syntheticNoteCreationDuration.add(Date.now() - noteCreationStart);
    sleep(1);

    // Step 5: Sync Operation Simulation
    console.log('🔄 Step 5: Sync Operation Simulation');
    const syncStart = Date.now();
    
    // Check network status endpoint
    let networkStatusResponse = http.get(`${BASE_URL}/api/network/status`, {
      headers: authHeaders
    });
    
    if (!check(networkStatusResponse, {
      'network status endpoint responds': (r) => r.status === 200 || r.status === 401,
      'network status API is available': (r) => r.status !== 500 && r.status !== 503,
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Network status check failed');
    }

    // Check blockchain sync status
    let syncStatusResponse = http.get(`${BASE_URL}/api/network/sync/status`, {
      headers: authHeaders
    });
    
    if (!check(syncStatusResponse, {
      'sync status endpoint responds': (r) => r.status === 200 || r.status === 401,
      'sync status API is available': (r) => r.status !== 500 && r.status !== 503,
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Sync status check failed');
    }

    syntheticSyncDuration.add(Date.now() - syncStart);
    sleep(1);

    // Step 6: Search Functionality
    console.log('🔍 Step 6: Search Functionality');
    const searchStart = Date.now();
    
    // Test search endpoint
    let searchResponse = http.get(`${BASE_URL}/api/notes/search?q=synthetic`, {
      headers: authHeaders
    });
    
    if (!check(searchResponse, {
      'search endpoint responds': (r) => r.status === 200 || r.status === 401,
      'search API is available': (r) => r.status !== 500 && r.status !== 503,
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Search functionality check failed');
    }

    syntheticSearchDuration.add(Date.now() - searchStart);
    sleep(0.5);

    // Step 7: WebSocket Connection Test
    console.log('🔌 Step 7: WebSocket Connection Test');
    
    // Check WebSocket endpoint availability (HTTP upgrade check)
    let wsHandshakeResponse = http.get(`${BASE_URL}/api/ws`, {
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'synthetic-test-key',
        'Sec-WebSocket-Version': '13',
      }
    });
    
    if (!check(wsHandshakeResponse, {
      'websocket endpoint available': (r) => r.status === 101 || r.status === 401 || r.status === 426,
      'websocket not server error': (r) => r.status !== 500 && r.status !== 503,
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ WebSocket endpoint check failed');
    }

    sleep(0.5);

    // Step 8: Performance Metrics Check
    console.log('📊 Step 8: Observability Check');
    
    // Check metrics endpoint
    let metricsResponse = http.get(`${BASE_URL}/api/actuator/prometheus`);
    if (!check(metricsResponse, {
      'metrics endpoint available': (r) => r.status === 200,
      'metrics contain expected data': (r) => r.body.includes('http_server_requests'),
    })) {
      stepFailure = true;
      journeySuccess = false;
      console.error('❌ Metrics endpoint check failed');
    }

    // Cleanup: Delete test note if created
    if (noteId) {
      let deleteResponse = http.del(`${BASE_URL}/api/notes/${noteId}`, {
        headers: authHeaders
      });
      check(deleteResponse, {
        'note cleanup attempted': (r) => r.status === 200 || r.status === 204 || r.status === 404 || r.status === 401,
      });
    }

  } catch (error) {
    console.error(`❌ Synthetic journey failed with error: ${error.message}`);
    journeySuccess = false;
    stepFailure = true;
  }

  // Record journey metrics
  const journeyDuration = Date.now() - journeyStartTime;
  syntheticJourneyDuration.add(journeyDuration);
  syntheticStepFailures.add(stepFailure ? 1 : 0);
  syntheticJourneySuccessRate.add(journeySuccess ? 1 : 0);

  if (journeySuccess) {
    syntheticJourneySuccesses.add(1);
    console.log(`✅ Synthetic journey completed successfully in ${journeyDuration}ms`);
  } else {
    syntheticJourneyFailures.add(1);
    console.log(`❌ Synthetic journey failed after ${journeyDuration}ms`);
  }

  // Small delay between iterations
  sleep(2);
}

// Setup function for synthetic monitoring
export function setup() {
  console.log('🚀 Starting synthetic user journey monitoring');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  
  // Pre-flight health check
  let healthCheck = http.get(`${BASE_URL}/api/actuator/health`);
  if (healthCheck.status !== 200) {
    console.warn('⚠️  Pre-flight health check failed, but continuing monitoring...');
  }
  
  return { startTime: Date.now() };
}

// Teardown function
export function teardown(data) {
  console.log(`📊 Synthetic monitoring completed. Duration: ${(Date.now() - data.startTime) / 1000}s`);
}
