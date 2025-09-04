import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Custom metrics for authorization overhead
const authzLatency = new Trend('authz_latency', true);
const directLatency = new Trend('direct_latency', true);

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Warm up
    { duration: '30s', target: 50 }, // Load test
    { duration: '10s', target: 0 },  // Cool down
  ],
  thresholds: {
    'authz_latency': ['p(50)<5', 'p(95)<20'], // p50 < 5ms, p95 < 20ms
    'direct_latency': ['p(50)<2', 'p(95)<10'],
    'http_req_duration': ['p(95)<100'], // Overall response time
  },
};

// Sample JWT token for testing (valid for demo purposes)
const JWT_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJ1c2VyIl19LCJleHAiOjk5OTk5OTk5OTl9.dummy-signature';

const HEADERS = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json',
};

export default function () {
  // Test with Envoy + OPA (authorization overhead)
  const envoyStart = Date.now();
  const envoyResponse = http.get('http://localhost:8080/api/me', { headers: HEADERS });
  const envoyEnd = Date.now();
  
  check(envoyResponse, {
    'Envoy request successful': (r) => r.status === 200,
  });
  
  authzLatency.add(envoyEnd - envoyStart);

  // Test direct backend (no authorization overhead)
  const directStart = Date.now();
  const directResponse = http.get('http://localhost:8081/api/me', { headers: HEADERS });
  const directEnd = Date.now();
  
  check(directResponse, {
    'Direct request successful': (r) => r.status === 200,
  });
  
  directLatency.add(directEnd - directStart);

  sleep(0.1); // Brief pause between iterations
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'authz-benchmark-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = `\n${indent}Authorization Overhead Benchmark Results:\n`;
  summary += `${indent}========================================\n`;
  
  const authzP50 = data.metrics.authz_latency.values['p(50)'];
  const authzP95 = data.metrics.authz_latency.values['p(95)'];
  const directP50 = data.metrics.direct_latency.values['p(50)'];
  const directP95 = data.metrics.direct_latency.values['p(95)'];
  
  summary += `${indent}Envoy + OPA Latency:\n`;
  summary += `${indent}  p50: ${authzP50.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${authzP95.toFixed(2)}ms\n`;
  
  summary += `${indent}Direct Backend Latency:\n`;
  summary += `${indent}  p50: ${directP50.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${directP95.toFixed(2)}ms\n`;
  
  const overheadP50 = authzP50 - directP50;
  const overheadP95 = authzP95 - directP95;
  
  summary += `${indent}Authorization Overhead:\n`;
  summary += `${indent}  p50: ${overheadP50.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${overheadP95.toFixed(2)}ms\n`;
  
  const p50Status = authzP50 < 5 ? '✅ PASS' : '❌ FAIL';
  const p95Status = authzP95 < 20 ? '✅ PASS' : '❌ FAIL';
  
  summary += `${indent}Acceptance Criteria:\n`;
  summary += `${indent}  p50 < 5ms: ${p50Status}\n`;
  summary += `${indent}  p95 < 20ms: ${p95Status}\n`;
  
  return summary;
}
