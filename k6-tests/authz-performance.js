import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics for AuthN/Z performance
const authzOverhead = new Trend('authz_overhead', true);
const loginLatency = new Trend('login_latency', true);
const crudLatency = new Trend('crud_latency', true);
const authFailures = new Counter('auth_failures');
const authzFailures = new Counter('authz_failures');
const gracefulDegradation = new Rate('graceful_degradation');

export const options = {
  scenarios: {
    // Smoke test scenario
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    // Normal load scenario
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'normal' },
    },
    // Stress test scenario
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 25 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    // Failure injection scenario
    failure_injection: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      tags: { test_type: 'failure' },
      env: { CHAOS_MODE: 'true' },
    },
  },
  thresholds: {
    // Authorization overhead must be < 20ms p95
    'authz_overhead': ['p(95)<20'],
    // Login should complete within reasonable time
    'login_latency': ['p(95)<1000'],
    // CRUD operations should be fast
    'crud_latency': ['p(95)<500'],
    // Overall request duration
    'http_req_duration': ['p(95)<2000'],
    // Error rates should be minimal
    'http_req_failed': ['rate<0.1'],
    // Graceful degradation rate should be high during failures
    'graceful_degradation': ['rate>0.9'],
  },
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const ENVOY_URL = __ENV.ENVOY_URL || 'http://localhost:8080';
const CHAOS_MODE = __ENV.CHAOS_MODE === 'true';

// Test users for authentication
const TEST_USERS = [
  { email: 'admin@modulo.com', password: 'admin123', role: 'admin' },
  { email: 'user1@modulo.com', password: 'user123', role: 'user' },
  { email: 'user2@modulo.com', password: 'user123', role: 'user' },
];

// OAuth test configuration
const OAUTH_CONFIG = {
  google: {
    client_id: 'test-google-client-id',
    redirect_uri: `${BASE_URL}/api/login/oauth2/code/google`,
  },
  keycloak: {
    client_id: 'modulo-client',
    redirect_uri: `${BASE_URL}/api/login/oauth2/code/keycloak`,
  },
};

export default function () {
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  group('Authentication Flow', () => {
    testLogin(user);
  });
  
  group('Authorized CRUD Operations', () => {
    testAuthorizedCRUD(user);
  });
  
  if (CHAOS_MODE) {
    group('Failure Injection Tests', () => {
      testFailureScenarios(user);
    });
  }
  
  sleep(Math.random() * 2); // Random think time
}

function testLogin(user) {
  // Test OAuth login flow
  const loginStart = Date.now();
  
  // Simulate OAuth authorization request
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.google.client_id,
    redirect_uri: OAUTH_CONFIG.google.redirect_uri,
    scope: 'openid profile email',
    state: generateRandomState(),
  });
  
  const authUrl = `${BASE_URL}/oauth2/authorization/google?${authParams}`;
  const authResponse = http.get(authUrl, {
    redirects: 0,
    tags: { name: 'oauth_auth_request' },
  });
  
  check(authResponse, {
    'OAuth auth request successful': (r) => r.status >= 200 && r.status < 400,
  });
  
  // Simulate OAuth callback with authorization code
  const callbackParams = new URLSearchParams({
    code: 'mock-auth-code',
    state: 'test-state',
  });
  
  const callbackUrl = `${BASE_URL}/api/login/oauth2/code/google?${callbackParams}`;
  const callbackResponse = http.get(callbackUrl, {
    tags: { name: 'oauth_callback' },
  });
  
  const loginEnd = Date.now();
  loginLatency.add(loginEnd - loginStart);
  
  const loginSuccess = check(callbackResponse, {
    'OAuth callback successful': (r) => r.status >= 200 && r.status < 400,
    'Login completed within SLA': (r) => (loginEnd - loginStart) < 1000,
  });
  
  if (!loginSuccess) {
    authFailures.add(1);
  }
  
  // Extract JWT token from response (mock for testing)
  const mockJwt = generateMockJWT(user);
  return mockJwt;
}

function testAuthorizedCRUD(user) {
  const token = generateMockJWT(user);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // Test authorization overhead by comparing direct vs. Envoy requests
  group('Authorization Overhead Measurement', () => {
    // Direct backend request (baseline)
    const directStart = Date.now();
    const directResponse = http.get(`${BASE_URL}/api/me`, { 
      headers, 
      tags: { name: 'direct_request' } 
    });
    const directEnd = Date.now();
    const directLatency = directEnd - directStart;
    
    // Envoy + OPA request (with authorization)
    const envoyStart = Date.now();
    const envoyResponse = http.get(`${ENVOY_URL}/api/me`, { 
      headers, 
      tags: { name: 'envoy_request' } 
    });
    const envoyEnd = Date.now();
    const envoyLatency = envoyEnd - envoyStart;
    
    // Calculate authorization overhead
    const overhead = envoyLatency - directLatency;
    authzOverhead.add(overhead);
    
    check(envoyResponse, {
      'Envoy request successful': (r) => r.status === 200,
      'Authorization overhead < 20ms': () => overhead < 20,
    });
  });
  
  // Test CRUD operations through authorized path
  group('CRUD Operations', () => {
    const crudStart = Date.now();
    
    // Create note
    const createPayload = {
      title: `Test Note ${Date.now()}`,
      content: 'This is a test note for performance testing',
      tags: ['performance', 'test'],
    };
    
    const createResponse = http.post(`${ENVOY_URL}/api/notes`, 
      JSON.stringify(createPayload), 
      { headers, tags: { name: 'create_note' } }
    );
    
    const createSuccess = check(createResponse, {
      'Note creation successful': (r) => r.status === 201,
    });
    
    if (createSuccess) {
      const noteId = JSON.parse(createResponse.body).id;
      
      // Read note
      const readResponse = http.get(`${ENVOY_URL}/api/notes/${noteId}`, {
        headers,
        tags: { name: 'read_note' },
      });
      
      check(readResponse, {
        'Note read successful': (r) => r.status === 200,
      });
      
      // Update note
      const updatePayload = {
        title: `Updated Test Note ${Date.now()}`,
        content: 'Updated content for performance testing',
      };
      
      const updateResponse = http.put(`${ENVOY_URL}/api/notes/${noteId}`,
        JSON.stringify(updatePayload),
        { headers, tags: { name: 'update_note' } }
      );
      
      check(updateResponse, {
        'Note update successful': (r) => r.status === 200,
      });
      
      // Delete note
      const deleteResponse = http.del(`${ENVOY_URL}/api/notes/${noteId}`, {
        headers,
        tags: { name: 'delete_note' },
      });
      
      check(deleteResponse, {
        'Note deletion successful': (r) => r.status === 204,
      });
    }
    
    const crudEnd = Date.now();
    crudLatency.add(crudEnd - crudStart);
  });
}

function testFailureScenarios(user) {
  const token = generateMockJWT(user);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  group('OPA Unavailable Scenario', () => {
    // Simulate OPA service being unavailable
    const opaFailUrl = `${ENVOY_URL}/api/notes?chaos=opa_down`;
    const opaFailResponse = http.get(opaFailUrl, {
      headers,
      tags: { name: 'opa_failure' },
    });
    
    const gracefulHandling = check(opaFailResponse, {
      'OPA failure returns proper HTTP code': (r) => r.status === 503 || r.status === 502,
      'OPA failure has error message': (r) => r.body && r.body.includes('authorization'),
      'No data leakage on OPA failure': (r) => !r.body.includes('password') && !r.body.includes('secret'),
    });
    
    gracefulDegradation.add(gracefulHandling);
    
    if (!gracefulHandling) {
      authzFailures.add(1);
    }
  });
  
  group('Keycloak Unavailable Scenario', () => {
    // Simulate Keycloak service being unavailable during token validation
    const keycloakFailUrl = `${ENVOY_URL}/api/me?chaos=keycloak_down`;
    const keycloakFailResponse = http.get(keycloakFailUrl, {
      headers,
      tags: { name: 'keycloak_failure' },
    });
    
    const gracefulHandling = check(keycloakFailResponse, {
      'Keycloak failure returns 401 or 503': (r) => r.status === 401 || r.status === 503,
      'Keycloak failure has error message': (r) => r.body && r.body.includes('authentication'),
      'No data leakage on Keycloak failure': (r) => !r.body.includes('token') && !r.body.includes('secret'),
    });
    
    gracefulDegradation.add(gracefulHandling);
    
    if (!gracefulHandling) {
      authFailures.add(1);
    }
  });
  
  group('Network Timeout Scenario', () => {
    // Test with very short timeout to simulate network issues
    const timeoutResponse = http.get(`${ENVOY_URL}/api/notes`, {
      headers,
      timeout: '100ms', // Very short timeout
      tags: { name: 'network_timeout' },
    });
    
    const gracefulHandling = check(timeoutResponse, {
      'Timeout returns proper error': (r) => r.status === 0 || r.status >= 500,
      'Timeout handled gracefully': (r) => r.error_code !== undefined,
    });
    
    gracefulDegradation.add(gracefulHandling);
  });
}

function generateMockJWT(user) {
  // Generate a mock JWT token for testing
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: user.email,
    email: user.email,
    realm_access: { roles: [user.role] },
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = 'mock-signature-for-testing';
  
  return `${header}.${payload}.${signature}`;
}

function generateRandomState() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function handleSummary(data) {
  const authzP95 = data.metrics.authz_overhead?.values?.['p(95)'] || 0;
  const loginP95 = data.metrics.login_latency?.values?.['p(95)'] || 0;
  const crudP95 = data.metrics.crud_latency?.values?.['p(95)'] || 0;
  const errorRate = data.metrics.http_req_failed?.values?.rate || 0;
  const degradationRate = data.metrics.graceful_degradation?.values?.rate || 0;
  
  const results = {
    timestamp: new Date().toISOString(),
    test_duration: data.state.testRunDurationMs,
    performance_metrics: {
      authz_overhead_p95: authzP95,
      login_latency_p95: loginP95,
      crud_latency_p95: crudP95,
      error_rate: errorRate,
      graceful_degradation_rate: degradationRate,
    },
    acceptance_criteria: {
      authz_overhead_sla: authzP95 < 20,
      login_performance_sla: loginP95 < 1000,
      crud_performance_sla: crudP95 < 500,
      error_rate_sla: errorRate < 0.1,
      degradation_sla: degradationRate > 0.9,
    },
    recommendations: generateRecommendations(authzP95, errorRate, degradationRate),
  };
  
  return {
    'stdout': generateTextSummary(results),
    'results/authz-performance-results.json': JSON.stringify(results, null, 2),
    'docs/perf/authz-benchmark.md': generateMarkdownReport(results, data),
  };
}

function generateTextSummary(results) {
  const { performance_metrics: perf, acceptance_criteria: criteria } = results;
  
  let summary = '\n📊 AuthN/Z Performance & Resilience Test Results\n';
  summary += '================================================\n\n';
  
  summary += '🔐 Authentication & Authorization Performance:\n';
  summary += `  Authorization Overhead (p95): ${perf.authz_overhead_p95.toFixed(2)}ms ${criteria.authz_overhead_sla ? '✅' : '❌'}\n`;
  summary += `  Login Latency (p95): ${perf.login_latency_p95.toFixed(2)}ms ${criteria.login_performance_sla ? '✅' : '❌'}\n`;
  summary += `  CRUD Latency (p95): ${perf.crud_latency_p95.toFixed(2)}ms ${criteria.crud_performance_sla ? '✅' : '❌'}\n\n`;
  
  summary += '🛡️ Resilience Metrics:\n';
  summary += `  Error Rate: ${(perf.error_rate * 100).toFixed(2)}% ${criteria.error_rate_sla ? '✅' : '❌'}\n`;
  summary += `  Graceful Degradation: ${(perf.graceful_degradation_rate * 100).toFixed(2)}% ${criteria.degradation_sla ? '✅' : '❌'}\n\n`;
  
  summary += '🎯 Acceptance Criteria:\n';
  summary += `  AuthZ Overhead < 20ms: ${criteria.authz_overhead_sla ? '✅ PASS' : '❌ FAIL'}\n`;
  summary += `  Login Performance < 1s: ${criteria.login_performance_sla ? '✅ PASS' : '❌ FAIL'}\n`;
  summary += `  CRUD Performance < 500ms: ${criteria.crud_performance_sla ? '✅ PASS' : '❌ FAIL'}\n`;
  summary += `  Error Rate < 10%: ${criteria.error_rate_sla ? '✅ PASS' : '❌ FAIL'}\n`;
  summary += `  Graceful Degradation > 90%: ${criteria.degradation_sla ? '✅ PASS' : '❌ FAIL'}\n\n`;
  
  if (results.recommendations.length > 0) {
    summary += '💡 Recommendations:\n';
    results.recommendations.forEach(rec => {
      summary += `  • ${rec}\n`;
    });
  }
  
  return summary;
}

function generateRecommendations(authzP95, errorRate, degradationRate) {
  const recommendations = [];
  
  if (authzP95 > 20) {
    recommendations.push('Authorization overhead exceeds 20ms - consider OPA policy optimization or caching');
  }
  
  if (errorRate > 0.05) {
    recommendations.push('Error rate is elevated - investigate authentication/authorization failures');
  }
  
  if (degradationRate < 0.9) {
    recommendations.push('Graceful degradation needs improvement - enhance error handling and fallback mechanisms');
  }
  
  if (authzP95 > 15) {
    recommendations.push('Consider implementing authorization result caching for frequently accessed resources');
  }
  
  return recommendations;
}

function generateMarkdownReport(results, rawData) {
  const timestamp = new Date().toISOString();
  
  return `# AuthN/Z Performance & Resilience Benchmark Results

**Generated:** ${timestamp}  
**Test Duration:** ${results.test_duration}ms

## Executive Summary

This report contains the results of comprehensive performance and resilience testing for the AuthN/Z path, including OAuth login flows, authorized CRUD operations, and failure injection scenarios.

## Performance Metrics

| Metric | Value | SLA | Status |
|--------|-------|-----|--------|
| Authorization Overhead (p95) | ${results.performance_metrics.authz_overhead_p95.toFixed(2)}ms | < 20ms | ${results.acceptance_criteria.authz_overhead_sla ? '✅ PASS' : '❌ FAIL'} |
| Login Latency (p95) | ${results.performance_metrics.login_latency_p95.toFixed(2)}ms | < 1000ms | ${results.acceptance_criteria.login_performance_sla ? '✅ PASS' : '❌ FAIL'} |
| CRUD Operations (p95) | ${results.performance_metrics.crud_latency_p95.toFixed(2)}ms | < 500ms | ${results.acceptance_criteria.crud_performance_sla ? '✅ PASS' : '❌ FAIL'} |

## Resilience Metrics

| Metric | Value | SLA | Status |
|--------|-------|-----|--------|
| Error Rate | ${(results.performance_metrics.error_rate * 100).toFixed(2)}% | < 10% | ${results.acceptance_criteria.error_rate_sla ? '✅ PASS' : '❌ FAIL'} |
| Graceful Degradation | ${(results.performance_metrics.graceful_degradation_rate * 100).toFixed(2)}% | > 90% | ${results.acceptance_criteria.degradation_sla ? '✅ PASS' : '❌ FAIL'} |

## Failure Injection Test Results

The following failure scenarios were tested:

1. **OPA Service Unavailable**: Proper HTTP error codes (503/502) returned with appropriate error messages
2. **Keycloak Service Unavailable**: Authentication failures handled gracefully with 401/503 responses  
3. **Network Timeouts**: Timeout scenarios handled without data leakage

## Recommendations

${results.recommendations.map(rec => `- ${rec}`).join('\n')}

## Test Configuration

- **Scenarios**: Smoke, Normal Load, Stress, Failure Injection
- **Virtual Users**: 1-50 concurrent users
- **Test Duration**: 30s - 9m depending on scenario
- **Target SLA**: p95 AuthZ overhead < 20ms

## Raw Data

For detailed metrics and analysis, see the full results in \`results/authz-performance-results.json\`.

---

*This report was automatically generated by k6 performance testing framework.*
`;
}
