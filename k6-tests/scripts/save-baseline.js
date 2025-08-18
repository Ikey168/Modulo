#!/usr/bin/env node

/**
 * 📊 Save Performance Baseline Script
 * 
 * This script saves k6 test results as baseline metrics for regression detection.
 * Used in nightly CI/CD pipelines to establish performance benchmarks.
 */

const fs = require('fs');
const path = require('path');

// 📁 Configuration
const BASELINES_DIR = path.join(__dirname, '..', 'baselines');
const RESULTS_DIR = path.join(__dirname, '..', 'results');
const BASELINE_FILE = path.join(BASELINES_DIR, 'performance-baselines.json');

// 🎯 SLO Thresholds from docs/SLO_SPECIFICATION.md
const SLO_THRESHOLDS = {
  read_latency_p95: 200,      // ms
  write_latency_p95: 500,     // ms
  sync_latency_p95: 1000,     // ms
  availability: 99.9,         // percentage
  websocket_latency_p95: 200, // ms
  connection_success_rate: 99 // percentage
};

/**
 * 📊 Parse k6 JSON results
 */
function parseK6Results(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Extract key metrics from k6 results
    const metrics = {};
    
    if (data.metrics) {
      // HTTP Request Duration (Read/Write operations)
      if (data.metrics.http_req_duration) {
        metrics.http_req_duration_p95 = data.metrics.http_req_duration.values?.['p(95)'] || null;
        metrics.http_req_duration_avg = data.metrics.http_req_duration.values?.avg || null;
      }
      
      // Error Rate
      if (data.metrics.http_req_failed) {
        metrics.error_rate = (data.metrics.http_req_failed.values?.rate || 0) * 100;
      }
      
      // Request Rate (Throughput)
      if (data.metrics.http_reqs) {
        metrics.throughput = data.metrics.http_reqs.values?.rate || null;
      }
      
      // Custom SLO Metrics
      if (data.metrics.slo_read_latency) {
        metrics.read_latency_p95 = data.metrics.slo_read_latency.values?.['p(95)'] || null;
      }
      
      if (data.metrics.slo_write_latency) {
        metrics.write_latency_p95 = data.metrics.slo_write_latency.values?.['p(95)'] || null;
      }
      
      if (data.metrics.slo_sync_latency) {
        metrics.sync_latency_p95 = data.metrics.slo_sync_latency.values?.['p(95)'] || null;
      }
      
      if (data.metrics.slo_error_rate) {
        metrics.slo_error_rate = (data.metrics.slo_error_rate.values?.rate || 0) * 100;
      }
      
      // WebSocket Metrics
      if (data.metrics.ws_message_latency) {
        metrics.websocket_latency_p95 = data.metrics.ws_message_latency.values?.['p(95)'] || null;
      }
      
      if (data.metrics.ws_connection_error_rate) {
        metrics.websocket_error_rate = (data.metrics.ws_connection_error_rate.values?.rate || 0) * 100;
      }
    }
    
    return metrics;
  } catch (error) {
    console.error(`❌ Failed to parse k6 results from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * 💾 Save baseline metrics
 */
function saveBaseline() {
  // Ensure directories exist
  if (!fs.existsSync(BASELINES_DIR)) {
    fs.mkdirSync(BASELINES_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error(`❌ Results directory not found: ${RESULTS_DIR}`);
    console.log('💡 Run k6 tests first to generate results');
    process.exit(1);
  }
  
  // Find latest test results
  const resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => ({
      name: file,
      path: path.join(RESULTS_DIR, file),
      stat: fs.statSync(path.join(RESULTS_DIR, file))
    }))
    .sort((a, b) => b.stat.mtime - a.stat.mtime);
    
  if (resultFiles.length === 0) {
    console.error('❌ No k6 result files found in results directory');
    process.exit(1);
  }
  
  console.log('📊 Processing k6 results for baseline...');
  
  const aggregatedMetrics = {};
  const testResults = {};
  
  // Process each result file
  resultFiles.forEach(file => {
    console.log(`📄 Processing: ${file.name}`);
    const metrics = parseK6Results(file.path);
    
    if (metrics) {
      const testType = file.name.replace('.json', '').replace(/-\d+$/, ''); // Remove timestamp
      testResults[testType] = {
        ...metrics,
        timestamp: file.stat.mtime.toISOString(),
        file: file.name
      };
      
      // Aggregate for overall baseline
      Object.keys(metrics).forEach(key => {
        if (metrics[key] !== null) {
          if (!aggregatedMetrics[key]) {
            aggregatedMetrics[key] = [];
          }
          aggregatedMetrics[key].push(metrics[key]);
        }
      });
    }
  });
  
  // Calculate baseline from aggregated metrics
  const baseline = {
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      git_commit: process.env.GIT_COMMIT || 'unknown',
      slo_thresholds: SLO_THRESHOLDS
    },
    baselines: {},
    test_results: testResults
  };
  
  // Calculate percentile values for baseline
  Object.keys(aggregatedMetrics).forEach(metric => {
    const values = aggregatedMetrics[metric].sort((a, b) => a - b);
    const count = values.length;
    
    baseline.baselines[metric] = {
      min: values[0],
      max: values[count - 1],
      avg: values.reduce((sum, val) => sum + val, 0) / count,
      p50: values[Math.floor(count * 0.5)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)],
      samples: count
    };
  });
  
  // 🎯 SLO Compliance Check
  console.log('\n🎯 SLO Compliance Analysis:');
  const compliance = {};
  
  Object.keys(SLO_THRESHOLDS).forEach(sloMetric => {
    const threshold = SLO_THRESHOLDS[sloMetric];
    const baselineMetric = baseline.baselines[sloMetric];
    
    if (baselineMetric) {
      const p95Value = baselineMetric.p95;
      const compliant = sloMetric.includes('rate') || sloMetric.includes('availability') 
        ? p95Value >= threshold  // For rates/availability, higher is better
        : p95Value <= threshold; // For latency, lower is better
        
      compliance[sloMetric] = {
        threshold,
        baseline_p95: p95Value,
        compliant,
        margin: sloMetric.includes('rate') || sloMetric.includes('availability')
          ? p95Value - threshold
          : threshold - p95Value
      };
      
      const status = compliant ? '✅' : '❌';
      const comparison = sloMetric.includes('rate') || sloMetric.includes('availability')
        ? `${p95Value.toFixed(2)}% >= ${threshold}%`
        : `${p95Value.toFixed(2)}ms <= ${threshold}ms`;
        
      console.log(`  ${status} ${sloMetric}: ${comparison}`);
    } else {
      console.log(`  ⚠️ ${sloMetric}: No baseline data`);
    }
  });
  
  baseline.slo_compliance = compliance;
  
  // Save baseline file
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  
  console.log(`\n✅ Baseline saved: ${BASELINE_FILE}`);
  console.log(`📊 Processed ${resultFiles.length} test result files`);
  console.log(`🎯 ${Object.keys(compliance).length} SLO metrics analyzed`);
  
  // Generate summary
  const compliantCount = Object.values(compliance).filter(c => c.compliant).length;
  const totalSLOs = Object.keys(compliance).length;
  console.log(`📈 SLO Compliance: ${compliantCount}/${totalSLOs} (${((compliantCount/totalSLOs)*100).toFixed(1)}%)`);
  
  return baseline;
}

// 🚀 Main execution
if (require.main === module) {
  console.log('📊 Saving Performance Baseline...\n');
  
  try {
    const baseline = saveBaseline();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to save baseline:', error.message);
    process.exit(1);
  }
}

module.exports = { saveBaseline, parseK6Results, SLO_THRESHOLDS };
