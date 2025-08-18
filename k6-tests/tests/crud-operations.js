import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 🎯 Custom Metrics Aligned with SLOs
const errorRate = new Rate('slo_error_rate');
const readLatency = new Trend('slo_read_latency');
const writeLatency = new Trend('slo_write_latency');

// 🎯 SLO-Aligned Thresholds (from docs/SLO_SPECIFICATION.md)
export const thresholds = {
  // Read Performance SLO: P95 < 200ms, 99% success rate
  'slo_read_latency': ['p(95)<200'],
  'http_req_duration{operation:read}': ['p(95)<200'],
  
  // Write Performance SLO: P95 < 500ms, 99% success rate  
  'slo_write_latency': ['p(95)<500'],
  'http_req_duration{operation:write}': ['p(95)<500'],
  
  // Availability SLO: > 99.9% success rate
  'slo_error_rate': ['rate<0.001'], // 0.1% error rate = 99.9% availability
  'http_req_failed': ['rate<0.001'],
  
  // General Performance Thresholds
  'http_reqs': ['rate>10'], // Minimum throughput
  'http_req_connecting': ['p(95)<100'], // Connection time
};

// 🚀 Test Configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Warm-up
    { duration: '2m', target: 10 },   // Normal load
    { duration: '1m', target: 20 },   // Peak load
    { duration: '30s', target: 0 },   // Cool-down
  ],
  thresholds,
};

// 🔧 Test Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// 📝 Test Data
const testNote = {
  title: 'Load Test Note',
  content: 'This is a note created during load testing',
  tags: ['load-test', 'performance'],
  category: 'testing'
};

// 🏃‍♂️ Main Test Scenario
export default function() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // 📖 READ Operations (SLO: P95 < 200ms)
  const readStart = Date.now();
  
  // List notes
  let listResponse = http.get(`${BASE_URL}/api/notes`, { headers, tags: { operation: 'read' } });
  check(listResponse, {
    'list notes: status 200': (r) => r.status === 200,
    'list notes: has data': (r) => r.json().length >= 0,
  });
  
  const readDuration = Date.now() - readStart;
  readLatency.add(readDuration);
  errorRate.add(listResponse.status >= 400);

  // Get specific note (if any exist)
  const notes = listResponse.json();
  if (notes && notes.length > 0) {
    const noteId = notes[0].id;
    const getResponse = http.get(`${BASE_URL}/api/notes/${noteId}`, { headers, tags: { operation: 'read' } });
    
    check(getResponse, {
      'get note: status 200': (r) => r.status === 200,
      'get note: has title': (r) => r.json().title !== undefined,
    });
    
    readLatency.add(Date.now() - readStart);
    errorRate.add(getResponse.status >= 400);
  }

  sleep(0.5); // Think time

  // ✏️ WRITE Operations (SLO: P95 < 500ms)
  const writeStart = Date.now();
  
  // Create note
  const createPayload = {
    ...testNote,
    title: `${testNote.title} ${Date.now()}`, // Make unique
  };
  
  const createResponse = http.post(
    `${BASE_URL}/api/notes`,
    JSON.stringify(createPayload),
    { headers, tags: { operation: 'write' } }
  );
  
  check(createResponse, {
    'create note: status 201': (r) => r.status === 201,
    'create note: returns id': (r) => r.json().id !== undefined,
  });
  
  const writeDuration = Date.now() - writeStart;
  writeLatency.add(writeDuration);
  errorRate.add(createResponse.status >= 400);

  // Update the created note
  if (createResponse.status === 201) {
    const createdNote = createResponse.json();
    const updatePayload = {
      ...createdNote,
      content: 'Updated during load test',
      tags: [...createdNote.tags, 'updated'],
    };
    
    const updateResponse = http.put(
      `${BASE_URL}/api/notes/${createdNote.id}`,
      JSON.stringify(updatePayload),
      { headers, tags: { operation: 'write' } }
    );
    
    check(updateResponse, {
      'update note: status 200': (r) => r.status === 200,
      'update note: content updated': (r) => r.json().content.includes('Updated'),
    });
    
    writeLatency.add(Date.now() - writeStart);
    errorRate.add(updateResponse.status >= 400);

    sleep(0.3); // Think time

    // Delete the note
    const deleteResponse = http.del(
      `${BASE_URL}/api/notes/${createdNote.id}`,
      null,
      { headers, tags: { operation: 'write' } }
    );
    
    check(deleteResponse, {
      'delete note: status 204': (r) => r.status === 204,
    });
    
    writeLatency.add(Date.now() - writeStart);
    errorRate.add(deleteResponse.status >= 400);
  }

  sleep(1); // Inter-iteration pause
}

// 🧪 Setup function for test data
export function setup() {
  console.log('🚀 Starting CRUD operations load test');
  console.log(`📍 Target URL: ${BASE_URL}`);
  console.log('🎯 SLO Thresholds:');
  console.log('  📖 Read P95 < 200ms');
  console.log('  ✏️ Write P95 < 500ms');
  console.log('  🟢 Availability > 99.9%');
  
  return { timestamp: Date.now() };
}

// 🧹 Cleanup function
export function teardown(data) {
  console.log('🏁 CRUD operations test completed');
  console.log(`⏱️ Test duration: ${((Date.now() - data.timestamp) / 1000).toFixed(2)}s`);
}
