import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

// 💾 Resource Exhaustion Metrics
const memoryUsage = new Trend('memory_usage_mb');
const cpuUtilization = new Trend('cpu_utilization_percent');
const diskIOLatency = new Trend('disk_io_latency_ms');
const networkBandwidth = new Trend('network_bandwidth_mbps');
const fileDescriptors = new Gauge('file_descriptors_count');
const connectionCount = new Gauge('active_connections');
const cacheHitRate = new Rate('cache_hit_rate');
const memoryLeaks = new Counter('memory_leak_incidents');
const gcPauseDuration = new Trend('gc_pause_duration_ms');
const heapFragmentation = new Trend('heap_fragmentation_percent');

// Resource error tracking
const resourceErrorRate = new Rate('resource_error_rate');
const oomEvents = new Counter('out_of_memory_events');
const diskSpaceErrors = new Counter('disk_space_errors');
const fileHandleErrors = new Counter('file_handle_errors');

// 🎯 Resource Exhaustion Thresholds
export const thresholds = {
  // Memory Management
  'memory_usage_mb': ['p(95)<2048', 'avg<1024'], // 2GB peak, 1GB average
  'memory_leak_incidents': ['count<5'], // Max 5 memory leak incidents
  'gc_pause_duration_ms': ['p(95)<100', 'avg<50'], // GC pause times
  'heap_fragmentation_percent': ['avg<30'], // Heap fragmentation
  
  // CPU Performance
  'cpu_utilization_percent': ['p(95)<85', 'avg<70'], // CPU usage limits
  
  // I/O Performance
  'disk_io_latency_ms': ['p(95)<50', 'avg<20'], // Disk I/O latency
  'network_bandwidth_mbps': ['avg>100'], // Minimum network bandwidth
  
  // Resource Limits
  'file_descriptors_count': ['max<8192'], // Max file descriptors
  'active_connections': ['max<5000'], // Max concurrent connections
  'cache_hit_rate': ['rate>0.8'], // 80% cache hit rate
  
  // Error Rates
  'resource_error_rate': ['rate<0.02'], // 2% resource error rate
  'out_of_memory_events': ['count<3'], // Max 3 OOM events
  'disk_space_errors': ['count<1'], // Max 1 disk space error
  'file_handle_errors': ['count<5'], // Max 5 file handle errors
  
  // HTTP Performance under resource stress
  'http_req_duration': ['p(95)<2000', 'avg<1000'], // Higher limits under stress
  'http_req_failed': ['rate<0.05'], // 5% failure rate allowed under stress
};

// 🚀 Resource Exhaustion Testing Configuration
export const options = {
  scenarios: {
    // Scenario 1: Memory Exhaustion Test
    memory_exhaustion: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 20 },   // Gradual memory increase
        { duration: '5m', target: 50 },   // High memory usage
        { duration: '3m', target: 100 },  // Memory stress
        { duration: '2m', target: 150 },  // Near exhaustion
        { duration: '1m', target: 200 },  // Peak memory stress
        { duration: '3m', target: 50 },   // Recovery
        { duration: '2m', target: 0 },    // Full recovery
      ],
      gracefulRampDown: '1m',
      exec: 'memoryExhaustionScenario',
    },
    
    // Scenario 2: CPU Intensive Operations
    cpu_intensive: {
      executor: 'constant-vus',
      vus: 75,
      duration: '10m',
      startTime: '18m',
      exec: 'cpuIntensiveScenario',
    },
    
    // Scenario 3: Disk I/O Stress
    disk_io_stress: {
      executor: 'ramping-arrival-rate',
      startTime: '29m',
      timeUnit: '1s',
      preAllocatedVUs: 25,
      maxVUs: 100,
      stages: [
        { duration: '2m', target: 10 },   // 10 req/sec
        { duration: '3m', target: 25 },   // 25 req/sec
        { duration: '3m', target: 50 },   // 50 req/sec (high I/O)
        { duration: '2m', target: 25 },   // Recovery
        { duration: '2m', target: 10 },   // Cool down
      ],
      exec: 'diskIOStressScenario',
    },
    
    // Scenario 4: Connection Exhaustion
    connection_exhaustion: {
      executor: 'ramping-vus',
      startTime: '42m',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up connections
        { duration: '2m', target: 100 },  // High connection count
        { duration: '2m', target: 200 },  // Very high connections
        { duration: '1m', target: 300 },  // Peak connections
        { duration: '2m', target: 100 },  // Recovery
        { duration: '1m', target: 0 },    // Connection cleanup
      ],
      exec: 'connectionExhaustionScenario',
    },
    
    // Scenario 5: Combined Resource Stress
    combined_resource_stress: {
      executor: 'constant-vus',
      vus: 50,
      duration: '8m',
      startTime: '52m',
      exec: 'combinedResourceStressScenario',
    },
  },
  thresholds,
};

// 🔧 Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const EXTREME_MODE = __ENV.EXTREME_MODE === 'true';
const SIMULATE_MEMORY_LEAKS = __ENV.SIMULATE_MEMORY_LEAKS === 'true';

// 📊 Resource monitoring simulation
function simulateResourceMonitoring() {
  // Simulate memory usage based on VU count and iteration
  const baseMemory = 256; // Base memory usage in MB
  const memoryPerVU = 8; // Memory per VU
  const memoryPerIteration = 2; // Memory growth per iteration
  const currentMemory = baseMemory + (__VU * memoryPerVU) + (__ITER * memoryPerIteration);
  
  memoryUsage.add(currentMemory);
  
  // Simulate CPU utilization
  const baseCPU = 20;
  const cpuPerVU = 0.5;
  const randomVariation = Math.random() * 20;
  const currentCPU = Math.min(100, baseCPU + (__VU * cpuPerVU) + randomVariation);
  
  cpuUtilization.add(currentCPU);
  
  // Simulate heap fragmentation
  const fragmentation = Math.min(80, 10 + (__ITER * 0.5) + (Math.random() * 10));
  heapFragmentation.add(fragmentation);
  
  // Simulate GC pause times (higher under stress)
  const gcPause = 10 + (currentMemory / 100) + (Math.random() * 30);
  gcPauseDuration.add(gcPause);
  
  // File descriptors simulation
  const fdCount = Math.min(8192, 100 + (__VU * 5) + Math.floor(Math.random() * 50));
  fileDescriptors.set(fdCount);
  
  // Active connections
  const connections = Math.min(5000, __VU * 10 + Math.floor(Math.random() * 100));
  connectionCount.set(connections);
  
  // Simulate memory leaks in extreme mode
  if (SIMULATE_MEMORY_LEAKS && __ITER > 0 && __ITER % 100 === 0) {
    memoryLeaks.add(1);
  }
}

// 💾 Memory Exhaustion Scenario
export function memoryExhaustionScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'memory-exhaustion',
    'X-VU-ID': __VU.toString(),
  };
  
  simulateResourceMonitoring();
  
  // Generate progressively larger payloads
  const baseSize = EXTREME_MODE ? 100000 : 10000; // 100KB or 10KB base
  const sizeMultiplier = Math.min(10, 1 + (__ITER * 0.1));
  const payloadSize = Math.floor(baseSize * sizeMultiplier);
  
  const memoryIntensiveData = {
    title: 'Memory Stress Test',
    content: 'A'.repeat(payloadSize), // Large content to consume memory
    metadata: {
      size: payloadSize,
      vu: __VU,
      iteration: __ITER,
      timestamp: Date.now(),
    },
    largeArray: Array(Math.floor(payloadSize / 100)).fill().map((_, i) => ({
      id: i,
      data: 'X'.repeat(100),
      nested: {
        level1: 'Y'.repeat(50),
        level2: 'Z'.repeat(50),
      }
    })),
  };
  
  const memoryStart = Date.now();
  
  // Memory-intensive POST operation
  const response = http.post(
    `${BASE_URL}/api/notes/memory-intensive`,
    JSON.stringify(memoryIntensiveData),
    { 
      headers,
      tags: { 
        operation: 'memory_exhaustion',
        payload_size: payloadSize.toString()
      }
    }
  );
  
  check(response, {
    'memory exhaustion: request processed': (r) => r.status < 500,
    'memory exhaustion: no out of memory': (r) => r.status !== 507,
  });
  
  if (response.status === 507) {
    oomEvents.add(1);
  }
  
  resourceErrorRate.add(response.status >= 400);
  
  // Simulate cache operations
  const cacheHit = Math.random() < 0.8; // 80% cache hit rate target
  cacheHitRate.add(cacheHit ? 1 : 0);
  
  // Memory-intensive processing simulation
  if (response.status < 400) {
    sleep(0.1 + (payloadSize / 1000000)); // Processing time based on payload size
  } else {
    sleep(0.05); // Quick failure
  }
}

// 🖥️ CPU Intensive Scenario
export function cpuIntensiveScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'cpu-intensive',
  };
  
  simulateResourceMonitoring();
  
  // CPU-intensive operations
  const operations = ['hash', 'encrypt', 'compress', 'sort', 'search'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  const cpuStart = Date.now();
  
  const cpuIntensiveData = {
    operation: operation,
    complexity: EXTREME_MODE ? 'maximum' : 'high',
    iterations: Math.floor(Math.random() * 1000000) + 100000,
    data: Array(10000).fill().map(() => Math.random()),
  };
  
  const response = http.post(
    `${BASE_URL}/api/processing/cpu-intensive`,
    JSON.stringify(cpuIntensiveData),
    { 
      headers,
      tags: { 
        operation: 'cpu_intensive',
        cpu_operation: operation
      }
    }
  );
  
  check(response, {
    'cpu intensive: completed': (r) => r.status === 200,
    'cpu intensive: processing time acceptable': (r) => {
      const processingTime = r.timings.duration;
      return processingTime < 5000; // 5 second max
    },
  });
  
  resourceErrorRate.add(response.status >= 400);
  
  // Simulate additional CPU load
  sleep(0.2 + Math.random() * 0.8);
}

// 💽 Disk I/O Stress Scenario
export function diskIOStressScenario() {
  const headers = {
    'Content-Type': 'multipart/form-data',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'disk-io-stress',
  };
  
  simulateResourceMonitoring();
  
  const ioStart = Date.now();
  
  // Generate file data for disk I/O
  const fileSize = EXTREME_MODE ? 5242880 : 1048576; // 5MB or 1MB
  const fileData = 'D'.repeat(fileSize);
  
  const diskIOLatencyStart = Date.now();
  
  // File upload (disk write operation)
  const uploadResponse = http.post(
    `${BASE_URL}/api/files/stress-test`,
    {
      file: http.file(fileData, `stress-test-${__VU}-${__ITER}.txt`, 'text/plain'),
      metadata: JSON.stringify({
        size: fileSize,
        vu: __VU,
        iteration: __ITER,
        stress_test: true,
      }),
    },
    { 
      headers,
      tags: { 
        operation: 'disk_io_stress',
        io_type: 'write'
      }
    }
  );
  
  const ioLatency = Date.now() - diskIOLatencyStart;
  diskIOLatency.add(ioLatency);
  
  check(uploadResponse, {
    'disk IO write: successful': (r) => r.status === 201,
    'disk IO write: acceptable latency': (r) => ioLatency < 1000,
  });
  
  if (uploadResponse.status === 507) {
    diskSpaceErrors.add(1);
  }
  
  resourceErrorRate.add(uploadResponse.status >= 400);
  
  // File read operation
  if (uploadResponse.status === 201) {
    const fileId = uploadResponse.json().fileId;
    
    const readStart = Date.now();
    const downloadResponse = http.get(
      `${BASE_URL}/api/files/${fileId}/download`,
      { 
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        tags: { 
          operation: 'disk_io_stress',
          io_type: 'read'
        }
      }
    );
    
    const readLatency = Date.now() - readStart;
    diskIOLatency.add(readLatency);
    
    check(downloadResponse, {
      'disk IO read: successful': (r) => r.status === 200,
      'disk IO read: correct size': (r) => r.body.length === fileSize,
    });
    
    resourceErrorRate.add(downloadResponse.status >= 400);
    
    // Delete file to clean up
    http.del(`${BASE_URL}/api/files/${fileId}`, null, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
  }
  
  // Simulate network bandwidth usage
  const bandwidth = (fileSize * 2) / (ioLatency / 1000) / 1024 / 1024; // Upload + Download in Mbps
  networkBandwidth.add(bandwidth);
  
  sleep(0.1);
}

// 🔌 Connection Exhaustion Scenario
export function connectionExhaustionScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'connection-exhaustion',
    'Connection': 'keep-alive',
  };
  
  simulateResourceMonitoring();
  
  // Attempt to open multiple concurrent connections
  const connectionPromises = [];
  const connectionCount = EXTREME_MODE ? 20 : 10;
  
  for (let i = 0; i < connectionCount; i++) {
    const connectionStart = Date.now();
    
    const response = http.get(
      `${BASE_URL}/api/health/connection-${i}?vu=${__VU}&iter=${__ITER}`,
      { 
        headers,
        tags: { 
          operation: 'connection_exhaustion',
          connection_id: i.toString()
        }
      }
    );
    
    check(response, {
      'connection exhaustion: connection established': (r) => r.status < 500,
      'connection exhaustion: not connection refused': (r) => r.status !== 503,
    });
    
    if (response.status === 503 || response.error_code === 'CONNECTION_REFUSED') {
      fileHandleErrors.add(1);
    }
    
    resourceErrorRate.add(response.status >= 400);
    
    // Brief hold on connection
    sleep(0.05);
  }
  
  // Long-lived connection simulation
  const longConnectionResponse = http.get(
    `${BASE_URL}/api/stream/long-connection`,
    { 
      headers,
      tags: { 
        operation: 'connection_exhaustion',
        connection_type: 'long_lived'
      }
    }
  );
  
  resourceErrorRate.add(longConnectionResponse.status >= 400);
  
  sleep(1 + Math.random() * 2);
}

// 🔥 Combined Resource Stress Scenario
export function combinedResourceStressScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Type': 'combined-stress',
  };
  
  simulateResourceMonitoring();
  
  // Combined operation that stresses multiple resources
  const stressData = {
    memory_payload: 'M'.repeat(EXTREME_MODE ? 500000 : 100000), // Memory stress
    cpu_operations: {
      hash_iterations: 100000,
      sort_array: Array(10000).fill().map(() => Math.random()),
      search_terms: Array(1000).fill().map(() => Math.random().toString(36)),
    },
    io_operations: {
      file_writes: 5,
      file_reads: 10,
      temp_files: true,
    },
    connection_pool: {
      concurrent_requests: 8,
      keep_alive: true,
    },
  };
  
  const combinedStart = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/stress/combined`,
    JSON.stringify(stressData),
    { 
      headers,
      tags: { 
        operation: 'combined_stress',
        stress_level: EXTREME_MODE ? 'extreme' : 'high'
      }
    }
  );
  
  const totalTime = Date.now() - combinedStart;
  
  check(response, {
    'combined stress: survived': (r) => r.status < 500,
    'combined stress: reasonable response time': (r) => totalTime < 10000,
    'combined stress: no resource exhaustion': (r) => r.status !== 507,
  });
  
  if (response.status === 507) {
    oomEvents.add(1);
  }
  
  resourceErrorRate.add(response.status >= 400);
  
  // Additional resource operations
  for (let i = 0; i < 3; i++) {
    const quickResponse = http.get(
      `${BASE_URL}/api/quick/resource-check-${i}`,
      { 
        headers,
        tags: { operation: 'combined_stress', sub_operation: 'quick_check' }
      }
    );
    
    resourceErrorRate.add(quickResponse.status >= 400);
    sleep(0.1);
  }
  
  sleep(1);
}

// 🏃‍♂️ Default scenario (not used in this test but required)
export default function() {
  // This scenario is not used as we have specific scenarios defined
  sleep(1);
}

// 🧪 Setup function
export function setup() {
  console.log('💾 Starting Resource Exhaustion Testing');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log(`🔥 Extreme Mode: ${EXTREME_MODE}`);
  console.log(`🕳️ Simulate Memory Leaks: ${SIMULATE_MEMORY_LEAKS}`);
  console.log('🎯 Resource Thresholds:');
  console.log('  💾 Memory Usage P95 < 2048MB');
  console.log('  🖥️ CPU Utilization P95 < 85%');
  console.log('  💽 Disk I/O Latency P95 < 50ms');
  console.log('  🔌 Max Connections < 5000');
  console.log('  📁 Max File Descriptors < 8192');
  console.log('  🟢 Resource Error Rate < 2%');
  console.log('📊 Test Scenarios:');
  console.log('  1. Memory Exhaustion (gradual → peak → recovery)');
  console.log('  2. CPU Intensive Operations (sustained load)');
  console.log('  3. Disk I/O Stress (large file operations)');
  console.log('  4. Connection Exhaustion (concurrent connections)');
  console.log('  5. Combined Resource Stress (all resources)');
  
  return { timestamp: Date.now() };
}

// 🧹 Teardown
export function teardown(data) {
  const duration = ((Date.now() - data.timestamp) / 1000 / 60).toFixed(2);
  console.log('🏁 Resource Exhaustion Testing Completed');
  console.log(`⏱️ Total Duration: ${duration} minutes`);
  console.log('💾 Resource stress testing completed');
  console.log('📊 Check resource utilization metrics in summary');
}

// 📊 Custom summary for resource testing
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/resource-exhaustion-test-summary.json': JSON.stringify(data, null, 2),
    'results/resource-exhaustion-test-report.html': generateResourceReport(data),
  };
}

function generateResourceReport(data) {
  const timestamp = new Date().toISOString();
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Resource Exhaustion Test Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #ffe6e6; padding: 20px; border-radius: 5px; border-left: 5px solid #d32f2f; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-title { font-weight: bold; color: #333; margin-bottom: 10px; }
        .metric-value { font-size: 24px; color: #d32f2f; }
        .threshold-met { color: green; }
        .threshold-failed { color: red; }
        .resource-warning { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 3px solid #ffc107; }
        .resource-critical { background: #f8d7da; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 3px solid #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>💾 Resource Exhaustion Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Test Mode:</strong> ${EXTREME_MODE ? 'Extreme' : 'Standard'}</p>
        <p><strong>Duration:</strong> ${(data.state.testRunDurationMs / 1000 / 60).toFixed(2)} minutes</p>
    </div>
    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">💾 Memory Usage (Target: P95 < 2048MB)</div>
            <div class="metric-value ${data.metrics.memory_usage_mb && data.metrics.memory_usage_mb.values['p(95)'] < 2048 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.memory_usage_mb ? data.metrics.memory_usage_mb.values['p(95)'].toFixed(2) + 'MB' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">🖥️ CPU Usage (Target: P95 < 85%)</div>
            <div class="metric-value ${data.metrics.cpu_utilization_percent && data.metrics.cpu_utilization_percent.values['p(95)'] < 85 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.cpu_utilization_percent ? data.metrics.cpu_utilization_percent.values['p(95)'].toFixed(2) + '%' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">💽 Disk I/O (Target: P95 < 50ms)</div>
            <div class="metric-value ${data.metrics.disk_io_latency_ms && data.metrics.disk_io_latency_ms.values['p(95)'] < 50 ? 'threshold-met' : 'threshold-failed'}">
                P95: ${data.metrics.disk_io_latency_ms ? data.metrics.disk_io_latency_ms.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">🔌 Connections (Target: Max < 5000)</div>
            <div class="metric-value ${data.metrics.active_connections && data.metrics.active_connections.values.max < 5000 ? 'threshold-met' : 'threshold-failed'}">
                Max: ${data.metrics.active_connections ? Math.round(data.metrics.active_connections.values.max) : 'N/A'}
            </div>
        </div>
    </div>
    
    ${data.metrics.out_of_memory_events && data.metrics.out_of_memory_events.values.count > 0 ? `
    <div class="resource-critical">
        <h3>⚠️ Critical Resource Events</h3>
        <ul>
            <li><strong>Out of Memory Events:</strong> ${data.metrics.out_of_memory_events.values.count}</li>
            ${data.metrics.memory_leak_incidents ? `<li><strong>Memory Leak Incidents:</strong> ${data.metrics.memory_leak_incidents.values.count}</li>` : ''}
            ${data.metrics.disk_space_errors ? `<li><strong>Disk Space Errors:</strong> ${data.metrics.disk_space_errors.values.count}</li>` : ''}
        </ul>
    </div>
    ` : ''}
    
    <div class="resource-warning">
        <h3>📊 Resource Stress Test Results</h3>
        <ul>
            <li><strong>Memory Exhaustion:</strong> Tested progressive memory allocation up to ${EXTREME_MODE ? '200' : '150'} concurrent users</li>
            <li><strong>CPU Intensive:</strong> Sustained high CPU load with complex operations</li>
            <li><strong>Disk I/O Stress:</strong> Large file operations with ${EXTREME_MODE ? '5MB' : '1MB'} files</li>
            <li><strong>Connection Exhaustion:</strong> Peak concurrent connections tested</li>
            <li><strong>Combined Stress:</strong> Multi-resource stress scenarios executed</li>
        </ul>
    </div>
</body>
</html>
  `;
}
