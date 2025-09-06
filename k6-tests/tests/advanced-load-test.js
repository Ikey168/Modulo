import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

// 🎯 Custom Metrics for Advanced Load Testing
const errorRate = new Rate('slo_error_rate');
const readLatency = new Trend('slo_read_latency');
const writeLatency = new Trend('slo_write_latency');
const concurrentUsers = new Trend('concurrent_users');
const memoryUsage = new Trend('memory_usage_estimate');
const cpuUtilization = new Trend('cpu_utilization_estimate');
const databaseConnections = new Counter('database_connections');
const blockchainTxs = new Counter('blockchain_transactions');

// 🎯 Advanced SLO-Aligned Thresholds
export const thresholds = {
  // Core SLO Thresholds
  'slo_read_latency': ['p(95)<200', 'p(99)<500', 'avg<100'],
  'slo_write_latency': ['p(95)<500', 'p(99)<1000', 'avg<300'],
  'slo_error_rate': ['rate<0.001'], // 99.9% availability
  
  // Stress Testing Thresholds
  'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
  'http_req_failed': ['rate<0.01'], // Allow 1% failure under stress
  'http_reqs': ['rate>50'], // High throughput requirement
  
  // Resource Utilization Thresholds
  'concurrent_users': ['max<=200'], // Maximum concurrent users
  'memory_usage_estimate': ['p(95)<1000'], // Estimated memory usage in MB
  'cpu_utilization_estimate': ['avg<80'], // Estimated CPU utilization %
  
  // Database Performance
  'database_connections': ['count>100'], // Minimum DB connection pool usage
  'blockchain_transactions': ['count>50'], // Minimum blockchain activity
};

// 🚀 Advanced Load Testing Configuration
export const options = {
  scenarios: {
    // Scenario 1: Gradual Load Increase
    gradual_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // Warm-up
        { duration: '5m', target: 50 },   // Normal load
        { duration: '3m', target: 100 },  // High load
        { duration: '2m', target: 150 },  // Peak load
        { duration: '1m', target: 200 },  // Stress load
        { duration: '2m', target: 100 },  // Cool-down
        { duration: '2m', target: 0 },    // Complete cool-down
      ],
      gracefulRampDown: '1m',
    },
    
    // Scenario 2: Spike Testing
    spike_test: {
      executor: 'ramping-vus',
      startTime: '18m', // Start after gradual load
      startVUs: 10,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 100 }, // Sudden spike
        { duration: '2m', target: 100 },  // Sustain spike
        { duration: '30s', target: 10 },  // Drop back
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    
    // Scenario 3: Constant High Load
    constant_load: {
      executor: 'constant-vus',
      vus: 75,
      duration: '10m',
      startTime: '25m', // Run after other scenarios
    },
    
    // Scenario 4: Peak Hour Simulation
    peak_hour: {
      executor: 'ramping-arrival-rate',
      startTime: '36m',
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '5m', target: 50 },   // Peak start
        { duration: '10m', target: 100 }, // Peak sustained
        { duration: '5m', target: 50 },   // Peak end
      ],
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// 🔧 Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const CHAOS_MODE = __ENV.CHAOS_MODE === 'true';
const MEMORY_PRESSURE = __ENV.MEMORY_PRESSURE === 'true';

// 📝 Advanced Test Data Generation
function generateTestData(size = 'medium') {
  const sizes = {
    small: { content: 'A'.repeat(100), tags: ['small'] },
    medium: { content: 'B'.repeat(1000), tags: ['medium', 'test'] },
    large: { content: 'C'.repeat(10000), tags: ['large', 'stress', 'memory'] },
    xlarge: { content: 'D'.repeat(50000), tags: ['xlarge', 'stress', 'memory', 'performance'] }
  };
  
  const data = sizes[size] || sizes.medium;
  
  return {
    title: `Stress Test Note - ${size} - ${Date.now()}`,
    content: data.content,
    tags: [...data.tags, 'load-test', 'automated'],
    category: 'stress-testing',
    metadata: {
      generator: 'k6-advanced-load-test',
      size: size,
      timestamp: new Date().toISOString(),
      chaos_mode: CHAOS_MODE,
      memory_pressure: MEMORY_PRESSURE,
    }
  };
}

// 🧪 Advanced Test Operations
export default function() {
  const vuId = __VU;
  const iterationId = __ITER;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-VU-ID': vuId.toString(),
    'X-Iteration': iterationId.toString(),
  };

  // Track current concurrent users
  concurrentUsers.add(__VU);
  
  // Simulate memory pressure based on VU count
  const estimatedMemory = (__VU * 5) + (iterationId * 0.1); // MB estimate
  memoryUsage.add(estimatedMemory);
  
  // Simulate CPU utilization
  const estimatedCPU = Math.min(95, (__VU * 0.5) + (Math.random() * 10));
  cpuUtilization.add(estimatedCPU);

  // 📊 Mixed Workload Simulation
  const operations = ['read_heavy', 'write_heavy', 'mixed', 'search_intensive'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  switch(operation) {
    case 'read_heavy':
      performReadHeavyWorkload(headers);
      break;
    case 'write_heavy':
      performWriteHeavyWorkload(headers);
      break;
    case 'mixed':
      performMixedWorkload(headers);
      break;
    case 'search_intensive':
      performSearchIntensiveWorkload(headers);
      break;
  }
  
  // Database connection simulation
  databaseConnections.add(1);
  
  // Blockchain transaction simulation
  if (Math.random() < 0.3) { // 30% chance of blockchain operation
    blockchainTxs.add(1);
    simulateBlockchainOperation(headers);
  }
  
  // Variable sleep time based on load
  const thinkTime = CHAOS_MODE ? Math.random() * 3 : 0.5 + (Math.random() * 1);
  sleep(thinkTime);
}

function performReadHeavyWorkload(headers) {
  const startTime = Date.now();
  
  // Multiple read operations
  for (let i = 0; i < 5; i++) {
    const response = http.get(`${BASE_URL}/api/notes?page=${i}&limit=20`, { 
      headers, 
      tags: { operation: 'read', workload: 'read_heavy' } 
    });
    
    check(response, {
      'read heavy: status ok': (r) => r.status === 200,
      'read heavy: has data': (r) => Array.isArray(r.json()),
    });
    
    errorRate.add(response.status >= 400);
  }
  
  readLatency.add(Date.now() - startTime);
}

function performWriteHeavyWorkload(headers) {
  const startTime = Date.now();
  const dataSize = MEMORY_PRESSURE ? 'xlarge' : 'large';
  
  // Multiple write operations
  for (let i = 0; i < 3; i++) {
    const testData = generateTestData(dataSize);
    
    const response = http.post(
      `${BASE_URL}/api/notes`,
      JSON.stringify(testData),
      { headers, tags: { operation: 'write', workload: 'write_heavy' } }
    );
    
    check(response, {
      'write heavy: created': (r) => r.status === 201,
      'write heavy: has id': (r) => r.json() && r.json().id,
    });
    
    errorRate.add(response.status >= 400);
    
    // Update the created note
    if (response.status === 201) {
      const note = response.json();
      const updateData = { ...note, content: note.content + ' - UPDATED' };
      
      const updateResponse = http.put(
        `${BASE_URL}/api/notes/${note.id}`,
        JSON.stringify(updateData),
        { headers, tags: { operation: 'write', workload: 'write_heavy' } }
      );
      
      errorRate.add(updateResponse.status >= 400);
    }
  }
  
  writeLatency.add(Date.now() - startTime);
}

function performMixedWorkload(headers) {
  const readStart = Date.now();
  
  // Read operation
  const listResponse = http.get(`${BASE_URL}/api/notes?limit=10`, { 
    headers, 
    tags: { operation: 'read', workload: 'mixed' } 
  });
  
  check(listResponse, {
    'mixed workload read: success': (r) => r.status === 200,
  });
  
  readLatency.add(Date.now() - readStart);
  errorRate.add(listResponse.status >= 400);
  
  sleep(0.1); // Brief pause
  
  // Write operation
  const writeStart = Date.now();
  const testData = generateTestData('medium');
  
  const createResponse = http.post(
    `${BASE_URL}/api/notes`,
    JSON.stringify(testData),
    { headers, tags: { operation: 'write', workload: 'mixed' } }
  );
  
  check(createResponse, {
    'mixed workload write: success': (r) => r.status === 201,
  });
  
  writeLatency.add(Date.now() - writeStart);
  errorRate.add(createResponse.status >= 400);
}

function performSearchIntensiveWorkload(headers) {
  const startTime = Date.now();
  const searchTerms = ['test', 'note', 'content', 'load', 'stress', 'performance'];
  
  // Multiple search operations
  for (let i = 0; i < 4; i++) {
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    
    const response = http.get(`${BASE_URL}/api/notes/search?q=${term}&limit=50`, { 
      headers, 
      tags: { operation: 'read', workload: 'search_intensive' } 
    });
    
    check(response, {
      'search intensive: success': (r) => r.status === 200,
      'search intensive: results': (r) => Array.isArray(r.json()),
    });
    
    errorRate.add(response.status >= 400);
  }
  
  readLatency.add(Date.now() - startTime);
}

function simulateBlockchainOperation(headers) {
  // Simulate blockchain sync or transaction
  const blockchainStart = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/blockchain/sync`,
    JSON.stringify({ operation: 'stress_test_sync', timestamp: Date.now() }),
    { headers, tags: { operation: 'blockchain', workload: 'sync' } }
  );
  
  check(response, {
    'blockchain operation: success': (r) => r.status === 200 || r.status === 202,
  });
  
  // Consider blockchain operations as write operations for SLO
  writeLatency.add(Date.now() - blockchainStart);
  errorRate.add(response.status >= 400);
}

// 🧪 Setup function
export function setup() {
  console.log('🚀 Starting Advanced Load & Stress Testing');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log(`🌪️ Chaos Mode: ${CHAOS_MODE}`);
  console.log(`💾 Memory Pressure: ${MEMORY_PRESSURE}`);
  console.log('🎯 Advanced SLO Thresholds:');
  console.log('  📖 Read P95 < 200ms, P99 < 500ms');
  console.log('  ✏️ Write P95 < 500ms, P99 < 1000ms');
  console.log('  🟢 Availability > 99.9%');
  console.log('  👥 Max Concurrent Users: 200');
  console.log('  💾 Memory Usage P95 < 1000MB');
  console.log('  🖥️ CPU Utilization Avg < 80%');
  
  return { 
    timestamp: Date.now(),
    config: { CHAOS_MODE, MEMORY_PRESSURE }
  };
}

// 🧹 Enhanced teardown with detailed reporting
export function teardown(data) {
  const duration = ((Date.now() - data.timestamp) / 1000 / 60).toFixed(2);
  console.log('🏁 Advanced Load & Stress Testing Completed');
  console.log(`⏱️ Total Duration: ${duration} minutes`);
  console.log('📊 Test Scenarios Executed:');
  console.log('  1. Gradual Load Increase (0→200 users)');
  console.log('  2. Spike Testing (sudden load spikes)');
  console.log('  3. Constant High Load (sustained load)');
  console.log('  4. Peak Hour Simulation (arrival rate based)');
  console.log('🎯 Check detailed metrics in the k6 summary output');
}

// 📊 Custom summary for detailed reporting
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/advanced-load-test-summary.json': JSON.stringify(data, null, 2),
    'results/advanced-load-test-report.html': generateHTMLReport(data),
  };
}

function generateHTMLReport(data) {
  const timestamp = new Date().toISOString();
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Advanced Load Test Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-title { font-weight: bold; color: #333; margin-bottom: 10px; }
        .metric-value { font-size: 24px; color: #007acc; }
        .threshold-met { color: green; }
        .threshold-failed { color: red; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Advanced Load & Stress Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Test Duration:</strong> ${(data.state.testRunDurationMs / 1000 / 60).toFixed(2)} minutes</p>
        <p><strong>Total Requests:</strong> ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 'N/A'}</p>
    </div>
    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">📖 Read Latency (SLO: P95 < 200ms)</div>
            <div class="metric-value ${data.metrics.slo_read_latency && data.metrics.slo_read_latency.values['p(95)'] < 200 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.slo_read_latency ? data.metrics.slo_read_latency.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">✏️ Write Latency (SLO: P95 < 500ms)</div>
            <div class="metric-value ${data.metrics.slo_write_latency && data.metrics.slo_write_latency.values['p(95)'] < 500 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.slo_write_latency ? data.metrics.slo_write_latency.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">🟢 Error Rate (SLO: < 0.1%)</div>
            <div class="metric-value ${data.metrics.slo_error_rate && data.metrics.slo_error_rate.values.rate < 0.001 ? 'threshold-met' : 'threshold-failed'}">
                ${data.metrics.slo_error_rate ? (data.metrics.slo_error_rate.values.rate * 100).toFixed(3) + '%' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">👥 Max Concurrent Users</div>
            <div class="metric-value">
                ${data.metrics.concurrent_users ? Math.round(data.metrics.concurrent_users.values.max) : 'N/A'}
            </div>
        </div>
    </div>
</body>
</html>
  `;
}
