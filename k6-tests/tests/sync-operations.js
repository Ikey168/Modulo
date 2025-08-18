import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 🎯 Custom Metrics for Blockchain Sync SLOs
const syncErrorRate = new Rate('slo_sync_error_rate');
const syncLatency = new Trend('slo_sync_latency');
const blockchainCallLatency = new Trend('blockchain_call_latency');

// 🎯 SLO-Aligned Thresholds for Sync Operations
export const thresholds = {
  // Sync Performance SLO: P95 < 1000ms (1 second)
  'slo_sync_latency': ['p(95)<1000'],
  'http_req_duration{operation:sync}': ['p(95)<1000'],
  
  // Blockchain Operations: Relaxed thresholds due to external dependency
  'blockchain_call_latency': ['p(95)<2000'],
  'http_req_duration{operation:blockchain}': ['p(95)<2000'],
  
  // Availability for Sync Operations: > 99% (relaxed due to blockchain dependency)
  'slo_sync_error_rate': ['rate<0.01'], // 1% error rate = 99% availability
  'http_req_failed{operation:sync}': ['rate<0.01'],
  
  // Performance Thresholds
  'http_reqs': ['rate>5'], // Lower throughput for sync operations
  'http_req_connecting': ['p(95)<100'],
};

// 🚀 Test Configuration - Lower load for sync operations
export const options = {
  stages: [
    { duration: '30s', target: 2 },   // Warm-up
    { duration: '3m', target: 5 },    // Normal sync load
    { duration: '1m', target: 8 },    // Peak sync load
    { duration: '30s', target: 0 },   // Cool-down
  ],
  thresholds,
};

// 🔧 Test Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// 🏃‍♂️ Main Sync Test Scenario
export default function() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // 🔄 Blockchain Sync Status Check (SLO: P95 < 1000ms)
  const syncStart = Date.now();
  
  const syncStatusResponse = http.get(
    `${BASE_URL}/api/blockchain/sync/status`,
    { headers, tags: { operation: 'sync' } }
  );
  
  check(syncStatusResponse, {
    'sync status: status 200': (r) => r.status === 200,
    'sync status: has block height': (r) => {
      const data = r.json();
      return data.currentBlock !== undefined;
    },
    'sync status: has sync progress': (r) => {
      const data = r.json();
      return data.syncProgress !== undefined;
    },
  });
  
  const syncDuration = Date.now() - syncStart;
  syncLatency.add(syncDuration);
  syncErrorRate.add(syncStatusResponse.status >= 400);

  sleep(0.5);

  // 📊 Blockchain Metrics
  const metricsResponse = http.get(
    `${BASE_URL}/api/blockchain/metrics`,
    { headers, tags: { operation: 'sync' } }
  );
  
  check(metricsResponse, {
    'blockchain metrics: status 200': (r) => r.status === 200,
    'blockchain metrics: has transaction count': (r) => {
      const data = r.json();
      return data.transactionCount !== undefined;
    },
  });
  
  syncLatency.add(Date.now() - syncStart);
  syncErrorRate.add(metricsResponse.status >= 400);

  sleep(0.3);

  // 🔍 Check Specific Block Data
  const blockchainStart = Date.now();
  
  const latestBlockResponse = http.get(
    `${BASE_URL}/api/blockchain/blocks/latest`,
    { headers, tags: { operation: 'blockchain' } }
  );
  
  check(latestBlockResponse, {
    'latest block: status 200': (r) => r.status === 200,
    'latest block: has hash': (r) => {
      const data = r.json();
      return data.hash !== undefined;
    },
    'latest block: has timestamp': (r) => {
      const data = r.json();
      return data.timestamp !== undefined;
    },
  });
  
  const blockchainDuration = Date.now() - blockchainStart;
  blockchainCallLatency.add(blockchainDuration);
  syncErrorRate.add(latestBlockResponse.status >= 400);

  sleep(0.5);

  // 🔄 Trigger Manual Sync (if supported)
  const manualSyncResponse = http.post(
    `${BASE_URL}/api/blockchain/sync/trigger`,
    JSON.stringify({ 
      priority: 'normal',
      maxBlocks: 10 
    }),
    { headers, tags: { operation: 'sync' } }
  );
  
  check(manualSyncResponse, {
    'manual sync: accepted': (r) => r.status === 202 || r.status === 200,
    'manual sync: returns task id': (r) => {
      if (r.status === 202) {
        const data = r.json();
        return data.taskId !== undefined;
      }
      return true; // If sync is immediate (200), consider it successful
    },
  });
  
  syncLatency.add(Date.now() - syncStart);
  syncErrorRate.add(manualSyncResponse.status >= 400);

  sleep(1);

  // 📈 Performance Metrics for Sync Operations
  const perfResponse = http.get(
    `${BASE_URL}/api/blockchain/performance`,
    { headers, tags: { operation: 'sync' } }
  );
  
  check(perfResponse, {
    'performance metrics: status 200': (r) => r.status === 200,
    'performance metrics: has sync rate': (r) => {
      const data = r.json();
      return data.avgSyncTime !== undefined || data.blocksPerSecond !== undefined;
    },
  });
  
  syncLatency.add(Date.now() - syncStart);
  syncErrorRate.add(perfResponse.status >= 400);

  sleep(2); // Longer pause for sync operations
}

// 🧪 Setup function
export function setup() {
  console.log('🔄 Starting Blockchain Sync operations load test');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log('🎯 SLO Thresholds:');
  console.log('  🔄 Sync P95 < 1000ms');
  console.log('  🔗 Blockchain calls P95 < 2000ms');
  console.log('  🟢 Sync Availability > 99%');
  
  return { timestamp: Date.now() };
}

// 🧹 Cleanup function
export function teardown(data) {
  console.log('🏁 Blockchain Sync test completed');
  console.log(`⏱️ Test duration: ${((Date.now() - data.timestamp) / 1000).toFixed(2)}s`);
}
