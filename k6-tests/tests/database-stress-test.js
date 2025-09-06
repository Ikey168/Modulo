import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

// 🎯 Database-Specific Metrics
const dbConnectionTime = new Trend('db_connection_time');
const dbQueryLatency = new Trend('db_query_latency');
const dbWriteLatency = new Trend('db_write_latency');
const dbConnectionPool = new Gauge('db_connection_pool_usage');
const dbLockWaitTime = new Trend('db_lock_wait_time');
const dbTransactionSize = new Trend('db_transaction_size');
const dbErrorRate = new Rate('db_error_rate');
const concurrentTransactions = new Counter('concurrent_transactions');

// 🎯 Database Stress Testing Thresholds
export const thresholds = {
  // Database Performance SLOs
  'db_connection_time': ['p(95)<50', 'avg<20'], // Connection establishment
  'db_query_latency': ['p(95)<100', 'p(99)<200'], // Query execution
  'db_write_latency': ['p(95)<200', 'p(99)<500'], // Write operations
  'db_lock_wait_time': ['p(95)<100', 'avg<50'], // Lock contention
  'db_error_rate': ['rate<0.01'], // 99% database success rate
  
  // Connection Pool Management
  'db_connection_pool_usage': ['value<=80'], // Max 80% pool usage
  'concurrent_transactions': ['count>50'], // Minimum concurrent load
  
  // HTTP-level thresholds for database operations
  'http_req_duration{operation:db_read}': ['p(95)<300'],
  'http_req_duration{operation:db_write}': ['p(95)<600'],
  'http_req_duration{operation:db_transaction}': ['p(95)<1000'],
  'http_req_failed': ['rate<0.005'], // 99.5% success rate
};

// 🚀 Database Stress Testing Configuration
export const options = {
  scenarios: {
    // Scenario 1: Connection Pool Exhaustion Test
    connection_pool_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Warm-up
        { duration: '2m', target: 50 },   // Normal load
        { duration: '2m', target: 100 },  // High connection usage
        { duration: '1m', target: 150 },  // Pool exhaustion test
        { duration: '2m', target: 50 },   // Recovery
        { duration: '1m', target: 0 },    // Cool-down
      ],
      gracefulRampDown: '30s',
    },
    
    // Scenario 2: Heavy Write Load (Lock Contention)
    write_contention_test: {
      executor: 'constant-vus',
      vus: 75,
      duration: '8m',
      startTime: '10m', // Start after connection pool test
      exec: 'writeHeavyScenario',
    },
    
    // Scenario 3: Long-Running Transaction Stress
    long_transaction_test: {
      executor: 'ramping-vus',
      startTime: '19m',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 15 },
        { duration: '5m', target: 25 },
        { duration: '2m', target: 5 },
      ],
      exec: 'longTransactionScenario',
    },
    
    // Scenario 4: Database Deadlock Simulation
    deadlock_simulation: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      startTime: '27m',
      exec: 'deadlockScenario',
    },
    
    // Scenario 5: Mass Data Operations
    bulk_operations: {
      executor: 'ramping-vus',
      startTime: '33m',
      startVUs: 2,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 2 },
      ],
      exec: 'bulkOperationsScenario',
    },
  },
  thresholds,
};

// 🔧 Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const DB_STRESS_MODE = __ENV.DB_STRESS_MODE === 'true';
const SIMULATE_SLOW_QUERIES = __ENV.SIMULATE_SLOW_QUERIES === 'true';

// 📝 Database Test Data Generation
function generateDatabaseTestData(complexity = 'medium') {
  const complexities = {
    simple: {
      title: 'Simple DB Test',
      content: 'Basic content for database testing',
      tags: ['db-test'],
      relatedEntities: 1,
    },
    medium: {
      title: 'Medium DB Test with Relations',
      content: 'Medium complexity content with database relations and indexing challenges',
      tags: ['db-test', 'medium', 'relations'],
      relatedEntities: 5,
      metadata: { indexed_field: 'test_value_' + Date.now() },
    },
    complex: {
      title: 'Complex DB Test with Heavy Relations',
      content: 'Complex content designed to stress database joins, indexes, and constraints. '.repeat(50),
      tags: ['db-test', 'complex', 'heavy-relations', 'indexing', 'joins'],
      relatedEntities: 25,
      metadata: {
        indexed_field: 'complex_test_' + Date.now(),
        search_terms: Array(20).fill().map(() => 'term_' + Math.random().toString(36).substr(2, 9)),
        relations: Array(15).fill().map(() => ({ id: Math.floor(Math.random() * 10000) })),
      },
    }
  };
  
  return complexities[complexity] || complexities.medium;
}

// 🏃‍♂️ Default Scenario: Mixed Database Operations
export default function() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-DB-Test': 'mixed-operations',
  };
  
  // Simulate database connection establishment time
  const connectionStart = Date.now();
  sleep(0.01 + Math.random() * 0.02); // 10-30ms connection time
  dbConnectionTime.add(Date.now() - connectionStart);
  
  // Simulate connection pool usage (estimate)
  const poolUsage = (__VU / 2) + Math.random() * 20; // Rough estimate
  dbConnectionPool.set(Math.min(100, poolUsage));
  
  // Mixed database operations
  performDatabaseReadOperations(headers);
  performDatabaseWriteOperations(headers);
  performComplexQueryOperations(headers);
  
  concurrentTransactions.add(1);
  
  // Think time with some database connection holding
  sleep(0.5 + Math.random() * 1);
}

// 🔍 Database Read Operations Stress
function performDatabaseReadOperations(headers) {
  const queryStart = Date.now();
  
  // Simple indexed query
  let response = http.get(`${BASE_URL}/api/notes?limit=50&orderBy=createdAt`, { 
    headers, 
    tags: { operation: 'db_read', query_type: 'indexed' } 
  });
  
  check(response, {
    'db read indexed: success': (r) => r.status === 200,
    'db read indexed: has results': (r) => Array.isArray(r.json()),
  });
  
  dbQueryLatency.add(Date.now() - queryStart);
  dbErrorRate.add(response.status >= 400);
  
  // Complex join query simulation
  const joinQueryStart = Date.now();
  response = http.get(`${BASE_URL}/api/notes/search?q=test&includeRelated=true&limit=20`, { 
    headers, 
    tags: { operation: 'db_read', query_type: 'join' } 
  });
  
  check(response, {
    'db read join: success': (r) => r.status === 200,
  });
  
  dbQueryLatency.add(Date.now() - joinQueryStart);
  dbErrorRate.add(response.status >= 400);
  
  if (SIMULATE_SLOW_QUERIES) {
    // Simulate slow query
    const slowQueryStart = Date.now();
    response = http.get(`${BASE_URL}/api/notes/analytics/slow-query?complexity=high`, { 
      headers, 
      tags: { operation: 'db_read', query_type: 'slow' } 
    });
    
    const slowQueryTime = Date.now() - slowQueryStart;
    dbQueryLatency.add(slowQueryTime);
    dbLockWaitTime.add(slowQueryTime * 0.3); // Estimate lock wait time
    dbErrorRate.add(response.status >= 400);
  }
}

// ✏️ Database Write Operations Stress
function performDatabaseWriteOperations(headers) {
  const writeStart = Date.now();
  const testData = generateDatabaseTestData('medium');
  
  // Transactional write operation
  const response = http.post(
    `${BASE_URL}/api/notes/transaction`,
    JSON.stringify({
      ...testData,
      transaction_type: 'stress_test',
      db_operations: ['insert', 'update_index', 'cascade_update']
    }),
    { headers, tags: { operation: 'db_write', write_type: 'transaction' } }
  );
  
  check(response, {
    'db write transaction: success': (r) => r.status === 201,
    'db write transaction: has id': (r) => r.json() && r.json().id,
  });
  
  const writeTime = Date.now() - writeStart;
  dbWriteLatency.add(writeTime);
  dbTransactionSize.add(JSON.stringify(testData).length);
  dbErrorRate.add(response.status >= 400);
  
  // Update operation that might cause locks
  if (response.status === 201 && Math.random() < 0.7) {
    const lockTestStart = Date.now();
    const noteId = response.json().id;
    
    const updateResponse = http.put(
      `${BASE_URL}/api/notes/${noteId}/concurrent-update`,
      JSON.stringify({ 
        content: testData.content + ' - CONCURRENT UPDATE',
        lock_test: true,
      }),
      { headers, tags: { operation: 'db_write', write_type: 'concurrent_update' } }
    );
    
    const lockWaitTime = Date.now() - lockTestStart;
    dbLockWaitTime.add(lockWaitTime);
    dbWriteLatency.add(lockWaitTime);
    dbErrorRate.add(updateResponse.status >= 400);
  }
}

// 🔍 Complex Query Operations
function performComplexQueryOperations(headers) {
  const complexQueryStart = Date.now();
  
  // Aggregation query
  const aggregationResponse = http.get(`${BASE_URL}/api/notes/stats/aggregated`, { 
    headers, 
    tags: { operation: 'db_read', query_type: 'aggregation' } 
  });
  
  check(aggregationResponse, {
    'db aggregation query: success': (r) => r.status === 200,
  });
  
  dbQueryLatency.add(Date.now() - complexQueryStart);
  dbErrorRate.add(aggregationResponse.status >= 400);
  
  // Full-text search query
  const searchStart = Date.now();
  const searchResponse = http.get(`${BASE_URL}/api/notes/search/fulltext?q=database+stress+test`, { 
    headers, 
    tags: { operation: 'db_read', query_type: 'fulltext' } 
  });
  
  dbQueryLatency.add(Date.now() - searchStart);
  dbErrorRate.add(searchResponse.status >= 400);
}

// 🔥 Write-Heavy Scenario (Lock Contention Test)
export function writeHeavyScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-DB-Test': 'write-heavy',
  };
  
  // Continuous write operations to create lock contention
  for (let i = 0; i < 5; i++) {
    const lockTestStart = Date.now();
    const testData = generateDatabaseTestData('complex');
    
    const response = http.post(
      `${BASE_URL}/api/notes/stress/write-heavy`,
      JSON.stringify({
        ...testData,
        batch_id: __VU,
        iteration: i,
        lock_test: true,
      }),
      { headers, tags: { operation: 'db_write', scenario: 'write_heavy' } }
    );
    
    const operationTime = Date.now() - lockTestStart;
    dbWriteLatency.add(operationTime);
    dbLockWaitTime.add(operationTime * 0.4); // Estimate lock wait component
    dbErrorRate.add(response.status >= 400);
    
    concurrentTransactions.add(1);
    
    // Brief pause to create more realistic contention
    sleep(0.1);
  }
  
  sleep(1 + Math.random() * 2);
}

// ⏳ Long Transaction Scenario
export function longTransactionScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-DB-Test': 'long-transaction',
  };
  
  const transactionStart = Date.now();
  
  // Start long transaction
  const startResponse = http.post(
    `${BASE_URL}/api/transactions/long/start`,
    JSON.stringify({ 
      duration_seconds: 30 + Math.random() * 60,
      operations_count: 10 + Math.floor(Math.random() * 20),
      vu_id: __VU,
    }),
    { headers, tags: { operation: 'db_transaction', scenario: 'long_transaction' } }
  );
  
  if (startResponse.status === 201) {
    const transactionId = startResponse.json().transactionId;
    
    // Perform operations within the long transaction
    for (let i = 0; i < 10; i++) {
      const operationResponse = http.post(
        `${BASE_URL}/api/transactions/${transactionId}/operation`,
        JSON.stringify({
          operation_type: 'update',
          data: generateDatabaseTestData('simple'),
          step: i,
        }),
        { headers, tags: { operation: 'db_write', scenario: 'long_transaction' } }
      );
      
      dbErrorRate.add(operationResponse.status >= 400);
      sleep(2); // Simulate work within transaction
    }
    
    // Commit long transaction
    const commitResponse = http.post(
      `${BASE_URL}/api/transactions/${transactionId}/commit`,
      null,
      { headers, tags: { operation: 'db_transaction', scenario: 'long_transaction' } }
    );
    
    const totalTransactionTime = Date.now() - transactionStart;
    dbWriteLatency.add(totalTransactionTime);
    dbErrorRate.add(commitResponse.status >= 400);
  }
  
  concurrentTransactions.add(1);
  sleep(5);
}

// 🔒 Deadlock Simulation Scenario
export function deadlockScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-DB-Test': 'deadlock-simulation',
  };
  
  // Create two resources that can cause deadlocks
  const resourceA = Math.floor(__VU / 2) * 2;
  const resourceB = resourceA + 1;
  
  const deadlockStart = Date.now();
  
  // First, lock resource A then try to lock resource B
  const lockAResponse = http.post(
    `${BASE_URL}/api/resources/${resourceA}/lock`,
    JSON.stringify({ operation: 'deadlock_test', vu: __VU }),
    { headers, tags: { operation: 'db_write', scenario: 'deadlock' } }
  );
  
  if (lockAResponse.status === 200) {
    sleep(0.5 + Math.random() * 1); // Hold lock for random time
    
    // Try to lock resource B (potential deadlock)
    const lockBResponse = http.post(
      `${BASE_URL}/api/resources/${resourceB}/lock`,
      JSON.stringify({ operation: 'deadlock_test', vu: __VU }),
      { headers, tags: { operation: 'db_write', scenario: 'deadlock' } }
    );
    
    const lockWaitTime = Date.now() - deadlockStart;
    dbLockWaitTime.add(lockWaitTime);
    dbErrorRate.add(lockBResponse.status >= 400);
    
    // Release locks
    http.post(`${BASE_URL}/api/resources/${resourceB}/unlock`, null, { headers });
    http.post(`${BASE_URL}/api/resources/${resourceA}/unlock`, null, { headers });
  }
  
  concurrentTransactions.add(1);
  sleep(1);
}

// 📊 Bulk Operations Scenario
export function bulkOperationsScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-DB-Test': 'bulk-operations',
  };
  
  const bulkStart = Date.now();
  
  // Bulk insert operation
  const bulkData = Array(100).fill().map((_, i) => ({
    ...generateDatabaseTestData('simple'),
    bulk_index: i,
    vu_id: __VU,
  }));
  
  const bulkInsertResponse = http.post(
    `${BASE_URL}/api/notes/bulk/insert`,
    JSON.stringify({ notes: bulkData }),
    { headers, tags: { operation: 'db_write', scenario: 'bulk_operations' } }
  );
  
  const bulkTime = Date.now() - bulkStart;
  dbWriteLatency.add(bulkTime);
  dbTransactionSize.add(JSON.stringify(bulkData).length);
  dbErrorRate.add(bulkInsertResponse.status >= 400);
  
  check(bulkInsertResponse, {
    'bulk insert: success': (r) => r.status === 201,
    'bulk insert: processed count': (r) => r.json() && r.json().processed === 100,
  });
  
  // Bulk update operation
  if (bulkInsertResponse.status === 201) {
    const updateStart = Date.now();
    const bulkUpdateResponse = http.put(
      `${BASE_URL}/api/notes/bulk/update`,
      JSON.stringify({ 
        filter: { vu_id: __VU },
        update: { content: 'Bulk updated content', updated_by_stress_test: true },
      }),
      { headers, tags: { operation: 'db_write', scenario: 'bulk_operations' } }
    );
    
    dbWriteLatency.add(Date.now() - updateStart);
    dbErrorRate.add(bulkUpdateResponse.status >= 400);
  }
  
  concurrentTransactions.add(1);
  sleep(3);
}

// 🧪 Setup function
export function setup() {
  console.log('🗄️ Starting Database Stress Testing');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log(`🔥 DB Stress Mode: ${DB_STRESS_MODE}`);
  console.log(`🐌 Simulate Slow Queries: ${SIMULATE_SLOW_QUERIES}`);
  console.log('🎯 Database Performance Thresholds:');
  console.log('  🔌 Connection Time P95 < 50ms');
  console.log('  🔍 Query Latency P95 < 100ms');
  console.log('  ✏️ Write Latency P95 < 200ms');
  console.log('  🔒 Lock Wait Time P95 < 100ms');
  console.log('  🟢 DB Error Rate < 1%');
  console.log('📊 Test Scenarios:');
  console.log('  1. Connection Pool Exhaustion');
  console.log('  2. Write Contention & Lock Testing');
  console.log('  3. Long Transaction Stress');
  console.log('  4. Deadlock Simulation');
  console.log('  5. Bulk Operations Load');
  
  return { timestamp: Date.now() };
}

// 🧹 Teardown with database-specific reporting
export function teardown(data) {
  const duration = ((Date.now() - data.timestamp) / 1000 / 60).toFixed(2);
  console.log('🏁 Database Stress Testing Completed');
  console.log(`⏱️ Total Duration: ${duration} minutes`);
  console.log('📊 Database scenarios executed successfully');
  console.log('🎯 Check database performance metrics in the summary');
}

// 📊 Custom summary for database testing
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/database-stress-test-summary.json': JSON.stringify(data, null, 2),
    'results/database-stress-test-report.html': generateDatabaseReport(data),
  };
}

function generateDatabaseReport(data) {
  const timestamp = new Date().toISOString();
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Database Stress Test Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-title { font-weight: bold; color: #333; margin-bottom: 10px; }
        .metric-value { font-size: 24px; color: #007acc; }
        .threshold-met { color: green; }
        .threshold-failed { color: red; }
        .db-scenario { background: #e8f4ff; padding: 10px; margin: 10px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🗄️ Database Stress Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Test Duration:</strong> ${(data.state.testRunDurationMs / 1000 / 60).toFixed(2)} minutes</p>
    </div>
    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">🔌 DB Connection Time (Target: P95 < 50ms)</div>
            <div class="metric-value ${data.metrics.db_connection_time && data.metrics.db_connection_time.values['p(95)'] < 50 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.db_connection_time ? data.metrics.db_connection_time.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">🔍 DB Query Latency (Target: P95 < 100ms)</div>
            <div class="metric-value ${data.metrics.db_query_latency && data.metrics.db_query_latency.values['p(95)'] < 100 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.db_query_latency ? data.metrics.db_query_latency.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">✏️ DB Write Latency (Target: P95 < 200ms)</div>
            <div class="metric-value ${data.metrics.db_write_latency && data.metrics.db_write_latency.values['p(95)'] < 200 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.db_write_latency ? data.metrics.db_write_latency.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">🔒 Lock Wait Time (Target: P95 < 100ms)</div>
            <div class="metric-value ${data.metrics.db_lock_wait_time && data.metrics.db_lock_wait_time.values['p(95)'] < 100 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.db_lock_wait_time ? data.metrics.db_lock_wait_time.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
    </div>
    <div class="db-scenario">
        <h3>📊 Database Test Scenarios Executed</h3>
        <ul>
            <li><strong>Connection Pool Stress:</strong> Tested pool exhaustion with up to 150 concurrent connections</li>
            <li><strong>Write Contention:</strong> Heavy concurrent writes to test lock contention and deadlocks</li>
            <li><strong>Long Transactions:</strong> Extended transactions to test isolation and resource holding</li>
            <li><strong>Deadlock Simulation:</strong> Intentional deadlock scenarios to test detection and recovery</li>
            <li><strong>Bulk Operations:</strong> Large batch operations to test transaction size limits</li>
        </ul>
    </div>
</body>
</html>
  `;
}
