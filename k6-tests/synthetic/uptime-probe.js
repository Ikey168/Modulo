import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Probe-specific metrics
export let probeResponseTime = new Trend('probe_response_time');
export let probeSuccessRate = new Rate('probe_success_rate');
export let probeFailures = new Counter('probe_failures');
export let probeAttempts = new Counter('probe_attempts');

// Uptime monitoring configuration
export let options = {
  scenarios: {
    uptime_probe: {
      executor: 'constant-arrival-rate',
      rate: 12, // 12 probes per minute = every 5 seconds
      timeUnit: '1m',
      duration: '60m', // Run continuously
      preAllocatedVUs: 1,
      maxVUs: 2,
    },
  },
  
  // Critical uptime thresholds
  thresholds: {
    'probe_success_rate': ['rate>0.999'], // 99.9% uptime SLO
    'probe_response_time': ['p(95)<2000'], // 95% of probes < 2s
    'http_req_failed': ['rate<0.001'], // Less than 0.1% HTTP failures
    'http_req_duration': ['p(95)<1000'], // 95% of requests < 1s
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

export default function() {
  probeAttempts.add(1);
  const probeStart = Date.now();
  let probeSuccess = true;

  try {
    // Critical path probe: liveness + readiness + basic API
    
    // 1. Liveness probe (most critical)
    let livenessResponse = http.get(`${BASE_URL}/api/actuator/health/liveness`, {
      timeout: '2s',
    });
    
    const livenessOk = check(livenessResponse, {
      'liveness probe responds': (r) => r.status === 200,
      'liveness status UP': (r) => {
        try {
          return r.json('status') === 'UP';
        } catch (e) {
          return false;
        }
      },
    });

    if (!livenessOk) {
      probeSuccess = false;
      console.error(`❌ Liveness probe failed: ${livenessResponse.status}`);
    }

    // 2. Readiness probe
    let readinessResponse = http.get(`${BASE_URL}/api/actuator/health/readiness`, {
      timeout: '2s',
    });
    
    const readinessOk = check(readinessResponse, {
      'readiness probe responds': (r) => r.status === 200,
      'readiness status UP': (r) => {
        try {
          return r.json('status') === 'UP';
        } catch (e) {
          return false;
        }
      },
    });

    if (!readinessOk) {
      probeSuccess = false;
      console.error(`❌ Readiness probe failed: ${readinessResponse.status}`);
    }

    // 3. Basic API endpoint check (application-level health)
    let apiResponse = http.get(`${BASE_URL}/api/actuator/health`, {
      timeout: '2s',
    });
    
    const apiOk = check(apiResponse, {
      'health endpoint responds': (r) => r.status === 200,
      'overall health UP': (r) => {
        try {
          return r.json('status') === 'UP';
        } catch (e) {
          return false;
        }
      },
    });

    if (!apiOk) {
      probeSuccess = false;
      console.error(`❌ Health endpoint failed: ${apiResponse.status}`);
    }

  } catch (error) {
    probeSuccess = false;
    console.error(`❌ Probe error: ${error.message}`);
  }

  // Record metrics
  const probeDuration = Date.now() - probeStart;
  probeResponseTime.add(probeDuration);
  probeSuccessRate.add(probeSuccess ? 1 : 0);
  
  if (!probeSuccess) {
    probeFailures.add(1);
  }

  // Brief pause to prevent overwhelming the system
  sleep(0.1);
}

export function setup() {
  console.log('🔍 Starting uptime monitoring probes');
  console.log(`Target: ${BASE_URL}`);
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`📊 Uptime monitoring completed. Duration: ${duration}s`);
}
