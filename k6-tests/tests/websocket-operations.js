import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 🎯 Custom Metrics for WebSocket SLOs
const wsConnectionErrors = new Rate('ws_connection_error_rate');
const wsMessageLatency = new Trend('ws_message_latency');
const wsConnectionTime = new Trend('ws_connection_time');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessagesSent = new Counter('ws_messages_sent');

// 🎯 WebSocket-specific Thresholds
export const thresholds = {
  // Connection Performance: P95 < 500ms
  'ws_connection_time': ['p(95)<500'],
  
  // Message Latency: P95 < 200ms (similar to read SLO)
  'ws_message_latency': ['p(95)<200'],
  
  // Connection Reliability: > 99% success rate
  'ws_connection_error_rate': ['rate<0.01'],
  
  // Throughput Thresholds
  'ws_messages_received': ['count>50'],
  'ws_messages_sent': ['count>50'],
  
  // General WebSocket Performance
  'ws_connecting': ['p(95)<500'],
  'ws_session_duration': ['p(95)>30000'], // Sessions should last at least 30s
};

// 🚀 Test Configuration for WebSocket load testing
export const options = {
  stages: [
    { duration: '30s', target: 3 },   // Gradual connection ramp-up
    { duration: '2m', target: 10 },   // Sustained WebSocket connections
    { duration: '1m', target: 15 },   // Peak concurrent connections
    { duration: '30s', target: 0 },   // Graceful disconnect
  ],
  thresholds,
};

// 🔧 Test Configuration
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/ws';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// 🏃‍♂️ Main WebSocket Test Scenario
export default function() {
  const connectionStart = Date.now();
  
  // 🔌 Establish WebSocket Connection
  const response = ws.connect(WS_URL, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    }
  }, function(socket) {
    const connectionTime = Date.now() - connectionStart;
    wsConnectionTime.add(connectionTime);
    
    console.log('🔌 WebSocket connected');
    
    // 📨 Test Message Scenarios
    const testMessages = [
      // Subscribe to real-time note updates
      {
        type: 'subscribe',
        channel: 'notes',
        event: 'updates'
      },
      // Subscribe to sync status updates
      {
        type: 'subscribe', 
        channel: 'blockchain',
        event: 'sync_progress'
      },
      // Send a ping message
      {
        type: 'ping',
        timestamp: Date.now()
      },
      // Request current active users
      {
        type: 'request',
        resource: 'active_users'
      }
    ];

    // 📤 Send test messages with latency tracking
    testMessages.forEach((message, index) => {
      const sendStart = Date.now();
      message.id = `test_${Date.now()}_${index}`;
      
      socket.send(JSON.stringify(message));
      wsMessagesSent.add(1);
      
      console.log(`📤 Sent message: ${message.type}`);
    });

    // 📥 Handle incoming messages
    socket.on('message', function(data) {
      const receiveTime = Date.now();
      wsMessagesReceived.add(1);
      
      try {
        const message = JSON.parse(data);
        console.log(`📥 Received: ${message.type || 'unknown'}`);
        
        // Track response latency for ping messages
        if (message.type === 'pong' && message.id) {
          const latency = receiveTime - parseInt(message.id.split('_')[1]);
          wsMessageLatency.add(latency);
        }
        
        // Track subscription confirmations
        if (message.type === 'subscription_confirmed') {
          console.log(`✅ Subscription confirmed: ${message.channel}`);
        }
        
        // Track real-time updates
        if (message.type === 'update') {
          console.log(`🔄 Real-time update: ${message.event}`);
          // Simulate processing time
          sleep(0.01);
        }
        
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    });

    // 🚨 Handle connection errors
    socket.on('error', function(e) {
      console.error('WebSocket error:', e);
      wsConnectionErrors.add(1);
    });

    // 🔌 Handle connection close
    socket.on('close', function() {
      console.log('🔌 WebSocket disconnected');
    });

    // ⏳ Keep connection alive for testing
    const sessionDuration = 30 + Math.random() * 30; // 30-60 seconds
    sleep(sessionDuration);
    
    // 📤 Send final ping before closing
    socket.send(JSON.stringify({
      type: 'ping',
      id: `final_${Date.now()}`,
      timestamp: Date.now()
    }));
    
    wsMessagesSent.add(1);
    
    // ⏱️ Small delay before closing
    sleep(1);
    
    socket.close();
  });

  // ✅ Check connection establishment
  check(response, {
    'websocket connection established': (r) => r && r.status === 101,
  });

  // Track connection errors
  if (!response || response.status !== 101) {
    wsConnectionErrors.add(1);
  }

  // 🛌 Inter-connection pause
  sleep(2);
}

// 🧪 Setup function
export function setup() {
  console.log('🔌 Starting WebSocket operations load test');
  console.log(`📍 WebSocket URL: ${WS_URL}`);
  console.log('🎯 WebSocket Thresholds:');
  console.log('  🔌 Connection P95 < 500ms');
  console.log('  📨 Message P95 < 200ms');
  console.log('  🟢 Connection Success > 99%');
  
  return { timestamp: Date.now() };
}

// 🧹 Cleanup function
export function teardown(data) {
  console.log('🏁 WebSocket operations test completed');
  console.log(`⏱️ Test duration: ${((Date.now() - data.timestamp) / 1000).toFixed(2)}s`);
}
