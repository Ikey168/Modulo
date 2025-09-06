import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

// 📊 Performance Regression Metrics
const regressionDetected = new Counter('performance_regression_count');
const baselineDeviation = new Trend('baseline_deviation_percent');
const performanceDrift = new Trend('performance_drift_ms');
const throughputRegression = new Rate('throughput_regression_rate');
const latencyRegression = new Rate('latency_regression_rate');
const errorRateRegression = new Rate('error_rate_regression');

// Baseline comparison metrics
const currentVsBaseline = new Trend('current_vs_baseline_ratio');
const performanceScore = new Trend('performance_score');
const stabilityIndex = new Trend('stability_index');

// 🎯 Regression Detection Thresholds
export const thresholds = {
  // Core regression detection
  'performance_regression_count': ['count<5'], // Max 5 regressions detected
  'baseline_deviation_percent': ['p(95)<20'], // Max 20% deviation from baseline
  'performance_drift_ms': ['p(95)<100'], // Max 100ms performance drift
  
  // Regression rates
  'throughput_regression_rate': ['rate<0.1'], // Max 10% throughput regression
  'latency_regression_rate': ['rate<0.1'], // Max 10% latency regression
  'error_rate_regression': ['rate<0.05'], // Max 5% error rate regression
  
  // Performance scoring
  'current_vs_baseline_ratio': ['avg>0.8', 'avg<1.2'], // Within 20% of baseline
  'performance_score': ['avg>80'], // Minimum 80/100 performance score
  'stability_index': ['avg>90'], // Minimum 90% stability
  
  // Standard SLO thresholds (stricter for regression testing)
  'slo_read_latency': ['p(95)<180'], // 10% stricter than normal 200ms
  'slo_write_latency': ['p(95)<450'], // 10% stricter than normal 500ms
  'slo_error_rate': ['rate<0.0005'], // Stricter than normal 0.001
  
  // HTTP performance (regression testing)
  'http_req_duration': ['p(95)<300', 'avg<150'],
  'http_req_failed': ['rate<0.002'], // Very low failure rate for regression
  'http_reqs': ['rate>15'], // Higher throughput requirement
};

// 🚀 Regression Testing Configuration
export const options = {
  scenarios: {
    // Scenario 1: Baseline Performance Validation
    baseline_validation: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      exec: 'baselineValidationScenario',
    },
    
    // Scenario 2: Performance Drift Detection
    drift_detection: {
      executor: 'ramping-vus',
      startTime: '11m',
      startVUs: 10,
      stages: [
        { duration: '3m', target: 25 },
        { duration: '5m', target: 40 },
        { duration: '2m', target: 25 },
        { duration: '2m', target: 10 },
      ],
      exec: 'performanceDriftScenario',
    },
    
    // Scenario 3: Throughput Regression Test
    throughput_regression: {
      executor: 'constant-arrival-rate',
      rate: 25,
      timeUnit: '1s',
      duration: '8m',
      startTime: '23m',
      preAllocatedVUs: 30,
      exec: 'throughputRegressionScenario',
    },
    
    // Scenario 4: Latency Regression Test
    latency_regression: {
      executor: 'constant-vus',
      vus: 30,
      duration: '8m',
      startTime: '32m',
      exec: 'latencyRegressionScenario',
    },
    
    // Scenario 5: Stability Assessment
    stability_assessment: {
      executor: 'constant-vus',
      vus: 15,
      duration: '15m',
      startTime: '41m',
      exec: 'stabilityAssessmentScenario',
    },
  },
  thresholds,
};

// 🔧 Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const BASELINE_FILE = __ENV.BASELINE_FILE || './baselines/performance-baseline.json';
const STRICT_MODE = __ENV.STRICT_MODE === 'true';
const REGRESSION_TOLERANCE = parseFloat(__ENV.REGRESSION_TOLERANCE || '0.15'); // 15% default

// 📊 Baseline data (normally loaded from file)
const performanceBaseline = {
  read_latency_p95: 150, // ms
  write_latency_p95: 400, // ms
  throughput_rps: 20, // requests per second
  error_rate: 0.0005, // 0.05%
  cpu_utilization: 45, // %
  memory_usage: 512, // MB
  response_times: {
    notes_list: 80,
    notes_create: 200,
    notes_update: 180,
    notes_delete: 50,
    search: 120,
  }
};

// 📝 Test data for consistent regression testing
const regressionTestData = {
  title: 'Regression Test Note',
  content: 'This is a standardized note for performance regression testing. '.repeat(10),
  tags: ['regression-test', 'performance', 'baseline'],
  category: 'testing',
};

// 🏃‍♂️ Default scenario (not used, specific scenarios defined)
export default function() {
  sleep(1);
}

// 📊 Baseline Validation Scenario
export function baselineValidationScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'baseline-validation',
  };
  
  // Test each operation against baseline
  const operations = [
    { name: 'notes_list', endpoint: '/api/notes', method: 'GET' },
    { name: 'notes_create', endpoint: '/api/notes', method: 'POST' },
    { name: 'notes_search', endpoint: '/api/notes/search?q=test', method: 'GET' },
  ];
  
  operations.forEach(op => {
    const operationStart = Date.now();
    let response;
    
    if (op.method === 'GET') {
      response = http.get(`${BASE_URL}${op.endpoint}`, {
        headers,
        tags: { operation: 'baseline_validation', endpoint: op.name }
      });
    } else if (op.method === 'POST') {
      response = http.post(`${BASE_URL}${op.endpoint}`, JSON.stringify(regressionTestData), {
        headers,
        tags: { operation: 'baseline_validation', endpoint: op.name }
      });
    }
    
    const operationTime = Date.now() - operationStart;
    const baselineTime = performanceBaseline.response_times[op.name];
    
    if (baselineTime) {
      const deviation = ((operationTime - baselineTime) / baselineTime) * 100;
      baselineDeviation.add(Math.abs(deviation));
      
      if (Math.abs(deviation) > (REGRESSION_TOLERANCE * 100)) {
        regressionDetected.add(1);
      }
      
      // Calculate performance ratio
      const ratio = operationTime / baselineTime;
      currentVsBaseline.add(ratio);
      
      // Performance score (100 = baseline, lower is worse)
      const score = Math.max(0, 100 - Math.abs(deviation));
      performanceScore.add(score);
    }
    
    check(response, {
      [`${op.name}: status ok`]: (r) => r.status < 400,
      [`${op.name}: within baseline tolerance`]: (r) => {
        const actualTime = r.timings.duration;
        const expectedTime = performanceBaseline.response_times[op.name];
        return expectedTime ? (actualTime <= expectedTime * (1 + REGRESSION_TOLERANCE)) : true;
      },
    });
    
    // Track SLO-specific metrics
    if (op.name.includes('list') || op.name.includes('search')) {
      // Read operations
      const readLatency = response.timings.duration;
      if (readLatency > performanceBaseline.read_latency_p95 * (1 + REGRESSION_TOLERANCE)) {
        latencyRegression.add(1);
      }
    } else if (op.name.includes('create') || op.name.includes('update')) {
      // Write operations
      const writeLatency = response.timings.duration;
      if (writeLatency > performanceBaseline.write_latency_p95 * (1 + REGRESSION_TOLERANCE)) {
        latencyRegression.add(1);
      }
    }
    
    sleep(0.1);
  });
  
  sleep(1);
}

// 📈 Performance Drift Scenario
export function performanceDriftScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'drift-detection',
  };
  
  // Track performance over time within the same test
  const iterationStart = Date.now();
  
  // Standard CRUD operations
  const listResponse = http.get(`${BASE_URL}/api/notes?limit=20`, {
    headers,
    tags: { operation: 'drift_detection', type: 'read' }
  });
  
  const listTime = listResponse.timings.duration;
  
  const createResponse = http.post(`${BASE_URL}/api/notes`, JSON.stringify({
    ...regressionTestData,
    title: `${regressionTestData.title} - Drift ${__ITER}`,
  }), {
    headers,
    tags: { operation: 'drift_detection', type: 'write' }
  });
  
  const createTime = createResponse.timings.duration;
  
  // Calculate drift from baseline
  const readDrift = listTime - performanceBaseline.response_times.notes_list;
  const writeDrift = createTime - performanceBaseline.response_times.notes_create;
  
  performanceDrift.add(readDrift);
  performanceDrift.add(writeDrift);
  
  // Stability assessment (consistent performance over iterations)
  const iterationTime = Date.now() - iterationStart;
  const expectedIterationTime = 500; // Expected ~500ms per iteration
  const stability = Math.max(0, 100 - Math.abs(((iterationTime - expectedIterationTime) / expectedIterationTime) * 100));
  stabilityIndex.add(stability);
  
  check(listResponse, {
    'drift detection read: successful': (r) => r.status === 200,
    'drift detection read: no significant drift': (r) => Math.abs(readDrift) < 100,
  });
  
  check(createResponse, {
    'drift detection write: successful': (r) => r.status === 201,
    'drift detection write: no significant drift': (r) => Math.abs(writeDrift) < 150,
  });
  
  // Clean up created note
  if (createResponse.status === 201) {
    const noteId = createResponse.json().id;
    http.del(`${BASE_URL}/api/notes/${noteId}`, null, { headers });
  }
  
  sleep(0.5);
}

// 🚀 Throughput Regression Scenario
export function throughputRegressionScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'throughput-regression',
  };
  
  const requestStart = Date.now();
  
  // High-throughput read operation
  const response = http.get(`${BASE_URL}/api/notes?page=${__ITER % 10}&limit=50`, {
    headers,
    tags: { operation: 'throughput_regression', type: 'high_throughput' }
  });
  
  const requestTime = Date.now() - requestStart;
  
  // Check if throughput is maintaining baseline levels
  const expectedMaxTime = 1000 / performanceBaseline.throughput_rps; // Time per request at baseline RPS
  const actualThroughputCapable = 1000 / requestTime;
  
  if (actualThroughputCapable < performanceBaseline.throughput_rps * (1 - REGRESSION_TOLERANCE)) {
    throughputRegression.add(1);
  } else {
    throughputRegression.add(0);
  }
  
  check(response, {
    'throughput regression: request successful': (r) => r.status === 200,
    'throughput regression: maintains baseline RPS': (r) => requestTime <= expectedMaxTime * (1 + REGRESSION_TOLERANCE),
    'throughput regression: has data': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  
  // No sleep to maximize throughput testing
}

// ⏱️ Latency Regression Scenario
export function latencyRegressionScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'latency-regression',
  };
  
  // Test various operations for latency regression
  const operations = [
    {
      name: 'complex_search',
      request: () => http.get(`${BASE_URL}/api/notes/search?q=regression+test&sort=relevance&limit=100`, { headers }),
      baseline: performanceBaseline.response_times.search * 1.5, // Complex search takes longer
    },
    {
      name: 'bulk_read',
      request: () => http.get(`${BASE_URL}/api/notes?limit=200&include=tags,metadata`, { headers }),
      baseline: performanceBaseline.response_times.notes_list * 2, // Bulk read takes longer
    },
    {
      name: 'complex_create',
      request: () => http.post(`${BASE_URL}/api/notes`, JSON.stringify({
        ...regressionTestData,
        content: regressionTestData.content.repeat(5), // Larger content
        metadata: {
          tags: Array(50).fill().map(() => `tag-${Math.random()}`),
          complexity: 'high',
          regression_test: true,
        }
      }), { headers }),
      baseline: performanceBaseline.response_times.notes_create * 1.8,
    }
  ];
  
  operations.forEach(op => {
    const opStart = Date.now();
    const response = op.request();
    const opTime = Date.now() - opStart;
    
    const latencyIncrease = ((opTime - op.baseline) / op.baseline) * 100;
    
    if (latencyIncrease > (REGRESSION_TOLERANCE * 100)) {
      latencyRegression.add(1);
      regressionDetected.add(1);
    } else {
      latencyRegression.add(0);
    }
    
    // Track deviation
    baselineDeviation.add(Math.abs(latencyIncrease));
    
    check(response, {
      [`${op.name}: successful`]: (r) => r.status < 400,
      [`${op.name}: no latency regression`]: (r) => latencyIncrease <= (REGRESSION_TOLERANCE * 100),
      [`${op.name}: reasonable response time`]: (r) => opTime < op.baseline * 2, // Max 2x baseline
    });
    
    sleep(0.2);
  });
  
  sleep(1);
}

// 🔍 Stability Assessment Scenario
export function stabilityAssessmentScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'stability-assessment',
  };
  
  // Long-running stability test with consistent operations
  const stabilityStart = Date.now();
  
  // Consistent workload pattern
  const workloadPattern = [
    'read', 'read', 'write', 'read', 'search', 
    'read', 'update', 'read', 'read', 'delete'
  ];
  
  const operation = workloadPattern[__ITER % workloadPattern.length];
  let response;
  let operationTime;
  
  switch(operation) {
    case 'read':
      const readStart = Date.now();
      response = http.get(`${BASE_URL}/api/notes?limit=10`, { headers, tags: { operation: 'stability', type: 'read' } });
      operationTime = Date.now() - readStart;
      break;
      
    case 'write':
      const writeStart = Date.now();
      response = http.post(`${BASE_URL}/api/notes`, JSON.stringify({
        ...regressionTestData,
        title: `Stability Test ${__ITER}`,
      }), { headers, tags: { operation: 'stability', type: 'write' } });
      operationTime = Date.now() - writeStart;
      break;
      
    case 'search':
      const searchStart = Date.now();
      response = http.get(`${BASE_URL}/api/notes/search?q=stability`, { headers, tags: { operation: 'stability', type: 'search' } });
      operationTime = Date.now() - searchStart;
      break;
      
    case 'update':
      const updateStart = Date.now();
      // Get a note first, then update it
      const notesResponse = http.get(`${BASE_URL}/api/notes?limit=1`, { headers });
      if (notesResponse.status === 200 && notesResponse.json().length > 0) {
        const noteId = notesResponse.json()[0].id;
        response = http.put(`${BASE_URL}/api/notes/${noteId}`, JSON.stringify({
          ...regressionTestData,
          content: regressionTestData.content + ' - Updated for stability',
        }), { headers, tags: { operation: 'stability', type: 'update' } });
      }
      operationTime = Date.now() - updateStart;
      break;
      
    case 'delete':
      const deleteStart = Date.now();
      // Get a note first, then delete it
      const deleteNotesResponse = http.get(`${BASE_URL}/api/notes?limit=1`, { headers });
      if (deleteNotesResponse.status === 200 && deleteNotesResponse.json().length > 0) {
        const noteId = deleteNotesResponse.json()[0].id;
        response = http.del(`${BASE_URL}/api/notes/${noteId}`, null, { headers, tags: { operation: 'stability', type: 'delete' } });
      }
      operationTime = Date.now() - deleteStart;
      break;
  }
  
  // Calculate stability metrics
  const expectedTime = performanceBaseline.response_times[`notes_${operation}`] || 100;
  const variance = Math.abs(operationTime - expectedTime);
  const stabilityScore = Math.max(0, 100 - ((variance / expectedTime) * 100));
  
  stabilityIndex.add(stabilityScore);
  
  // Error rate regression check
  if (response && response.status >= 400) {
    if (response.status >= 400) {
      const currentErrorRate = 1; // This request failed
      const baselineErrorRate = performanceBaseline.error_rate;
      
      if (currentErrorRate > baselineErrorRate * (1 + REGRESSION_TOLERANCE)) {
        errorRateRegression.add(1);
      }
    }
  }
  
  check(response || {}, {
    'stability: operation successful': (r) => r && r.status < 400,
    'stability: consistent performance': () => stabilityScore > 80,
    'stability: no significant variance': () => variance < expectedTime * 0.5,
  });
  
  sleep(0.8); // Consistent timing
}

// 🧪 Setup function
export function setup() {
  console.log('📊 Starting Performance Regression Testing');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log(`🔍 Strict Mode: ${STRICT_MODE}`);
  console.log(`📏 Regression Tolerance: ${(REGRESSION_TOLERANCE * 100).toFixed(1)}%`);
  console.log('🎯 Baseline Performance Targets:');
  console.log(`  📖 Read Latency: ${performanceBaseline.read_latency_p95}ms P95`);
  console.log(`  ✏️ Write Latency: ${performanceBaseline.write_latency_p95}ms P95`);
  console.log(`  🚀 Throughput: ${performanceBaseline.throughput_rps} RPS`);
  console.log(`  🟢 Error Rate: ${(performanceBaseline.error_rate * 100).toFixed(3)}%`);
  console.log('📊 Regression Test Scenarios:');
  console.log('  1. Baseline Performance Validation');
  console.log('  2. Performance Drift Detection');
  console.log('  3. Throughput Regression Testing');
  console.log('  4. Latency Regression Analysis');
  console.log('  5. Long-term Stability Assessment');
  
  return { 
    timestamp: Date.now(),
    baseline: performanceBaseline,
    tolerance: REGRESSION_TOLERANCE
  };
}

// 🧹 Teardown
export function teardown(data) {
  const duration = ((Date.now() - data.timestamp) / 1000 / 60).toFixed(2);
  console.log('🏁 Performance Regression Testing Completed');
  console.log(`⏱️ Total Duration: ${duration} minutes`);
  console.log('📊 Regression analysis completed - check detailed metrics');
}

// 📊 Custom summary for regression testing
export function handleSummary(data) {
  const regressionReport = analyzeRegressions(data);
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/regression-test-summary.json': JSON.stringify({
      ...data,
      regression_analysis: regressionReport,
    }, null, 2),
    'results/regression-test-report.html': generateRegressionReport(data, regressionReport),
  };
}

function analyzeRegressions(data) {
  const analysis = {
    total_regressions: data.metrics.performance_regression_count?.values?.count || 0,
    performance_score: data.metrics.performance_score?.values?.avg || 0,
    stability_index: data.metrics.stability_index?.values?.avg || 0,
    baseline_deviation_avg: data.metrics.baseline_deviation_percent?.values?.avg || 0,
    recommendations: [],
  };
  
  // Generate recommendations based on results
  if (analysis.performance_score < 80) {
    analysis.recommendations.push('Performance significantly below baseline - investigate recent changes');
  }
  
  if (analysis.stability_index < 90) {
    analysis.recommendations.push('Performance stability issues detected - check for resource leaks or GC issues');
  }
  
  if (analysis.baseline_deviation_avg > 20) {
    analysis.recommendations.push('High deviation from baseline detected - review system configuration');
  }
  
  if (analysis.total_regressions > 3) {
    analysis.recommendations.push('Multiple regressions detected - consider rolling back recent changes');
  }
  
  return analysis;
}

function generateRegressionReport(data, analysis) {
  const timestamp = new Date().toISOString();
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Regression Test Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #e3f2fd; padding: 20px; border-radius: 5px; border-left: 5px solid #1976d2; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-title { font-weight: bold; color: #333; margin-bottom: 10px; }
        .metric-value { font-size: 24px; color: #1976d2; }
        .threshold-met { color: green; }
        .threshold-failed { color: red; }
        .regression-alert { background: #ffebee; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 3px solid #f44336; }
        .performance-good { background: #e8f5e8; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 3px solid #4caf50; }
        .recommendations { background: #fff3e0; padding: 15px; margin: 15px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Performance Regression Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Baseline Comparison:</strong> ${REGRESSION_TOLERANCE * 100}% tolerance</p>
        <p><strong>Duration:</strong> ${(data.state.testRunDurationMs / 1000 / 60).toFixed(2)} minutes</p>
    </div>
    
    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">🔍 Regressions Detected</div>
            <div class="metric-value ${analysis.total_regressions === 0 ? 'threshold-met' : 'threshold-failed'}">
                ${analysis.total_regressions}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">📈 Performance Score (/100)</div>
            <div class="metric-value ${analysis.performance_score >= 80 ? 'threshold-met' : 'threshold-failed'}">
                ${analysis.performance_score.toFixed(1)}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">⚖️ Stability Index (/100)</div>
            <div class="metric-value ${analysis.stability_index >= 90 ? 'threshold-met' : 'threshold-failed'}">
                ${analysis.stability_index.toFixed(1)}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">📏 Baseline Deviation (%)</div>
            <div class="metric-value ${analysis.baseline_deviation_avg <= 20 ? 'threshold-met' : 'threshold-failed'}">
                ${analysis.baseline_deviation_avg.toFixed(1)}%
            </div>
        </div>
    </div>
    
    ${analysis.total_regressions > 0 ? `
    <div class="regression-alert">
        <h3>⚠️ Performance Regressions Detected</h3>
        <p><strong>${analysis.total_regressions}</strong> performance regressions were identified during testing.</p>
        <p>Review the detailed metrics above and consider investigating recent changes to the system.</p>
    </div>
    ` : `
    <div class="performance-good">
        <h3>✅ No Performance Regressions Detected</h3>
        <p>All performance metrics are within acceptable bounds compared to the baseline.</p>
        <p>Performance Score: ${analysis.performance_score.toFixed(1)}/100 | Stability: ${analysis.stability_index.toFixed(1)}/100</p>
    </div>
    `}
    
    ${analysis.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
            ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    <div class="performance-good">
        <h3>📊 Test Scenarios Completed</h3>
        <ul>
            <li><strong>Baseline Validation:</strong> Compared current performance against established baseline</li>
            <li><strong>Drift Detection:</strong> Monitored performance consistency over time</li>
            <li><strong>Throughput Regression:</strong> Verified sustained request handling capacity</li>
            <li><strong>Latency Regression:</strong> Analyzed response time increases</li>
            <li><strong>Stability Assessment:</strong> Evaluated long-term performance consistency</li>
        </ul>
    </div>
</body>
</html>
  `;
}
